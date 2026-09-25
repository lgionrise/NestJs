import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { Role } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      const values: Record<string, any> = {
        BCRYPT_SALT_ROUNDS: 4,
        ACCOUNT_LOCKOUT_MAX_ATTEMPTS: 5,
        ACCOUNT_LOCKOUT_DURATION_MINUTES: 30,
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return values[key] ?? defaultVal;
    }),
  };

  const mockRedis = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: '1', email: 'a@a.com' });

      await expect(
        service.register({ email: 'a@a.com', password: 'Password123!' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new user with hashed password', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'new@a.com',
        role: Role.STUDENT,
        passwordHash: 'hashed',
      });

      const result = await service.register({
        email: 'new@a.com',
        password: 'Password123!',
      } as any);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@x.com', password: 'wrong' } as any, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is locked', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        passwordHash: 'hash',
        isActive: true,
        lockedUntil: new Date(Date.now() + 10 * 60000),
        failedLoginAttempts: 5,
      });

      await expect(
        service.login({ email: 'a@a.com', password: 'wrong' } as any, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should increment failedLoginAttempts on wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        passwordHash: hash,
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 2,
        role: Role.STUDENT,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'a@a.com', password: 'wrong-password' } as any, {}),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        }),
      );
    });

    it('should lock account after max failed attempts', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        passwordHash: hash,
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 4,
        role: Role.STUDENT,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'a@a.com', password: 'wrong-password' } as any, {}),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should successfully login with correct credentials', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        passwordHash: hash,
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 0,
        role: Role.STUDENT,
      });
      jwtService.signAsync.mockResolvedValue('signed-token');
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.session.upsert.mockResolvedValue({});

      const result = await service.login(
        { email: 'a@a.com', password: 'correct-password' } as any,
        { userAgent: 'test', ipAddress: '127.0.0.1' },
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke all tokens on reuse of a revoked token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: '1',
        type: 'refresh',
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({});

      await expect(service.refreshTokens('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should throw UnauthorizedException for wrong current password', async () => {
      const hash = await bcrypt.hash('actual-password', 4);
      prisma.user.findUnique.mockResolvedValue({ id: '1', passwordHash: hash });

      await expect(
        service.changePassword('1', {
          currentPassword: 'wrong',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and revoke tokens on success', async () => {
      const hash = await bcrypt.hash('actual-password', 4);
      prisma.user.findUnique.mockResolvedValue({ id: '1', passwordHash: hash });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({});

      const result = await service.changePassword('1', {
        currentPassword: 'actual-password',
        newPassword: 'NewPassword123!',
      });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(result.message).toContain('successfully');
    });
  });
});
