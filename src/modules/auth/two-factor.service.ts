import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';

const BACKUP_CODE_COUNT = 10;
const APP_NAME = 'LGIONRISE';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly encryptionSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionSecret = this.configService.get<string>('JWT_ACCESS_SECRET') as string;
    authenticator.options = { window: 1 };
  }

  async generateSetup(userId: string, email: string | undefined) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = authenticator.generateSecret();
    const encryptedSecret = EncryptionUtil.encrypt(secret, this.encryptionSecret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    });

    const label = email ?? user.phone ?? userId;
    const otpauthUrl = authenticator.keyuri(label, APP_NAME, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeDataUrl,
      message: 'Scan this QR code with an authenticator app, then confirm with a 6-digit code to enable 2FA.',
    };
  }

  async confirmSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('No pending 2FA setup found. Please start setup again.');
    }

    const secret = EncryptionUtil.decrypt(user.twoFactorSecret, this.encryptionSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    const backupCodes = await this.generateBackupCodes(userId);

    this.logger.log(`2FA enabled for user: ${userId}`);

    return {
      message: 'Two-factor authentication enabled successfully',
      backupCodes,
    };
  }

  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    if (code !== '__PASSWORD_VERIFIED__') {
      const secret = EncryptionUtil.decrypt(user.twoFactorSecret, this.encryptionSecret);
      const isValid = authenticator.verify({ token: code, secret });

      if (!isValid) {
        const isBackupValid = await this.verifyBackupCode(userId, code);
        if (!isBackupValid) {
          throw new BadRequestException('Invalid verification code');
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      }),
      this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`2FA disabled for user: ${userId}`);

    return { message: 'Two-factor authentication disabled successfully' };
  }

  async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor authentication is not configured');
    }

    const secret = EncryptionUtil.decrypt(user.twoFactorSecret, this.encryptionSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (isValid) {
      return true;
    }

    return this.verifyBackupCode(userId, code);
  }

  private async generateBackupCodes(userId: string): Promise<string[]> {
    await this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } });

    const plainCodes: string[] = [];
    const records: { userId: string; codeHash: string }[] = [];

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = randomBytes(5).toString('hex').toUpperCase();
      plainCodes.push(code);
      records.push({ userId, codeHash: this.hashCode(code) });
    }

    await this.prisma.twoFactorBackupCode.createMany({ data: records });

    return plainCodes;
  }

  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const codeHash = this.hashCode(code.toUpperCase());

    const backupCode = await this.prisma.twoFactorBackupCode.findFirst({
      where: { userId, codeHash, isUsed: false },
    });

    if (!backupCode) {
      return false;
    }

    await this.prisma.twoFactorBackupCode.update({
      where: { id: backupCode.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    this.logger.warn(`Backup code used for user: ${userId}`);

    return true;
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
