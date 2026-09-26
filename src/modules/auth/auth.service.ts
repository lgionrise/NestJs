import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';
import { OtpService } from '../otp/otp.service';
import { OtpChannel, OtpPurpose } from '../otp/interfaces/otp-provider.interface';

interface DeviceMeta {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds: number;
  private readonly maxLoginAttempts: number;
  private readonly lockoutDurationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly twoFactorService: TwoFactorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12);
    this.maxLoginAttempts = this.configService.get<number>('ACCOUNT_LOCKOUT_MAX_ATTEMPTS', 5);
    this.lockoutDurationMinutes = this.configService.get<number>(
      'ACCOUNT_LOCKOUT_DURATION_MINUTES',
      30,
    );
  }

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (existing) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role ?? Role.STUDENT,
      },
    });

    this.logger.log(`New user registered: ${user.id} (${user.role})`);

    return this.sanitizeUser(user);
  }

async login(dto: LoginDto, meta: DeviceMeta) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account is locked due to multiple failed attempts. Try again in ${minutesLeft} minute(s).`,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (user.twoFactorEnabled) {
      const mfaToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email ?? undefined,
          phone: user.phone ?? undefined,
          role: user.role,
          type: 'mfa',
        } as JwtPayload,
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );

      return {
        requiresTwoFactor: true,
        mfaToken,
        message: 'Please provide your two-factor authentication code to complete login',
      };
    }

    const tokens = await this.generateTokenPair(user.id, user.email, user.phone, user.role);
    await this.createSession(user.id, dto.deviceId, meta);

    this.logger.log(`User logged in: ${user.id}`);

    return {
      requiresTwoFactor: false,
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async verifyTwoFactorLogin(mfaToken: string, code: string, meta: DeviceMeta) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(mfaToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA session. Please log in again.');
    }

    if (payload.type !== 'mfa') {
      throw new UnauthorizedException('Invalid token type');
    }

    const isValid = await this.twoFactorService.verifyTotpCode(payload.sub, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor authentication code');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokenPair(user.id, user.email, user.phone, user.role);
    await this.createSession(user.id, meta.deviceId, meta);

    this.logger.log(`User completed 2FA login: ${user.id}`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async handleFailedLogin(userId: string, currentAttempts: number) {
    const attempts = currentAttempts + 1;
    const shouldLock = attempts >= this.maxLoginAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + this.lockoutDurationMinutes * 60000)
          : null,
      },
    });

    if (shouldLock) {
      this.logger.warn(`Account locked due to failed attempts: ${userId}`);
    }
  }

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      if (storedToken?.isRevoked) {
        await this.revokeAllUserTokens(payload.sub);
        this.logger.warn(
          `Reuse of revoked refresh token detected for user ${payload.sub}. All sessions revoked.`,
        );
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return this.generateTokenPair(user.id, user.email, user.phone, user.role);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { isRevoked: true, revokedAt: new Date() },
      });
    }
    return { message: 'Logged out successfully' };
  }

  async logoutAllDevices(userId: string) {
    await this.revokeAllUserTokens(userId);
    await this.prisma.session.updateMany({ where: { userId }, data: { isActive: false } });
    return { message: 'Logged out from all devices' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    await this.revokeAllUserTokens(userId);

    this.logger.log(`Password changed for user: ${userId}`);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ─── OTP-DEPENDENT FLOWS ──────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto) {
    const destination = dto.email ?? dto.phone;

    if (!destination) {
      throw new BadRequestException('Either email or phone is required');
    }

    if (
      dto.purpose === OtpPurpose.PASSWORD_RESET ||
      dto.purpose === OtpPurpose.EMAIL_VERIFICATION ||
      dto.purpose === OtpPurpose.PHONE_VERIFICATION
    ) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(
            Boolean,
          ) as any,
        },
      });

      if (dto.purpose === OtpPurpose.PASSWORD_RESET && !user) {
        // Do not reveal whether account exists — respond identically either way.
        return { message: 'If an account exists, an OTP has been sent.', expiresInSeconds: 300 };
      }
    }

    const channel = dto.email ? OtpChannel.EMAIL : OtpChannel.SMS;
    return this.otpService.requestOtp(destination, channel, dto.purpose);
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const destination = dto.email ?? dto.phone;

    if (!destination) {
      throw new BadRequestException('Either email or phone is required');
    }

    await this.otpService.verifyOtp(destination, dto.purpose, dto.otp);

    if (dto.purpose === OtpPurpose.EMAIL_VERIFICATION && dto.email) {
      await this.prisma.user.updateMany({
        where: { email: dto.email },
        data: { isEmailVerified: true },
      });
    }

    if (dto.purpose === OtpPurpose.PHONE_VERIFICATION && dto.phone) {
      await this.prisma.user.updateMany({
        where: { phone: dto.phone },
        data: { isPhoneVerified: true },
      });
    }

    return { message: 'OTP verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    return this.sendOtp({
      email: dto.email,
      phone: dto.phone,
      purpose: OtpPurpose.PASSWORD_RESET,
    } as SendOtpDto);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const destination = dto.email ?? dto.phone;

    if (!destination) {
      throw new BadRequestException('Either email or phone is required');
    }

    await this.otpService.verifyOtp(destination, OtpPurpose.PASSWORD_RESET, dto.otp);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(
          Boolean,
        ) as any,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid request');
    }

    const newHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.revokeAllUserTokens(user.id);

    this.logger.log(`Password reset via OTP for user: ${user.id}`);

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  // ─── TOKEN / SESSION HELPERS ──────────────────────────────────────────

  private async generateTokenPair(userId: string, email: string | null, phone: string | null, role: Role) {
    const jti = randomUUID();

    const accessPayload: JwtPayload = {
      sub: userId,
      email: email ?? undefined,
      phone: phone ?? undefined,
      role,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email: email ?? undefined,
      phone: phone ?? undefined,
      role,
      type: 'refresh',
      jti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private async createSession(userId: string, deviceId: string | undefined, meta: DeviceMeta) {
    const finalDeviceId = deviceId ?? meta.deviceId ?? randomUUID();

    await this.prisma.session.upsert({
      where: { id: `${userId}_${finalDeviceId}` },
      create: {
        id: `${userId}_${finalDeviceId}`,
        userId,
        deviceId: finalDeviceId,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
      update: {
        lastActiveAt: new Date(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        isActive: true,
      },
    });
  }

  private async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, ...safeUser } = user;
    return safeUser;
  }
}
