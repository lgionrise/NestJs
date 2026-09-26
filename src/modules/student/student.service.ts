import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SetupProfileDto } from './dto/setup-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { PrivacySettingsDto } from './dto/privacy-settings.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

const DEFAULT_NOTIFICATION_PREFS = {
  classReminders: true,
  testReminders: true,
  paymentReminders: true,
  newContentAlerts: true,
  doubtReplyAlerts: true,
  marketingEmails: false,
  doNotDisturb: false,
};

const DEFAULT_PRIVACY_SETTINGS = {
  showProfileToOtherStudents: true,
  showOnLeaderboard: true,
  allowDataForAnalytics: true,
};

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setupProfile(userId: string, dto: SetupProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.studentProfile) {
      throw new BadRequestException(
        'Profile already exists. Use the update profile endpoint instead.',
      );
    }

    const profile = await this.prisma.studentProfile.create({
      data: {
        userId,
        fullName: dto.fullName,
        photoUrl: dto.photoUrl,
        className: dto.className,
        targetExam: dto.targetExam,
        language: dto.language,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        schoolName: dto.schoolName,
        onboardingStep: 1,
        isOnboardingDone: true,
        notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
        privacySettings: DEFAULT_PRIVACY_SETTINGS,
      },
    });

    this.logger.log(`Student profile created for user: ${userId}`);

    return profile;
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isEmailVerified: true,
            isPhoneVerified: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Student profile not found. Please complete onboarding first.',
      );
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.studentProfile.findUnique({ where: { userId } });

    if (!existing) {
      throw new NotFoundException(
        'Student profile not found. Please complete onboarding first.',
      );
    }

    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.className !== undefined && { className: dto.className }),
        ...(dto.targetExam !== undefined && { targetExam: dto.targetExam }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.guardianName !== undefined && { guardianName: dto.guardianName }),
        ...(dto.guardianPhone !== undefined && { guardianPhone: dto.guardianPhone }),
        ...(dto.schoolName !== undefined && { schoolName: dto.schoolName }),
      },
    });

    this.logger.log(`Student profile updated for user: ${userId}`);

    return updated;
  }

  async updateNotificationPreferences(userId: string, dto: NotificationPreferencesDto) {
    const existing = await this.prisma.studentProfile.findUnique({ where: { userId } });

    if (!existing) {
      throw new NotFoundException('Student profile not found');
    }

    const currentPrefs = (existing.notificationPrefs as object) ?? DEFAULT_NOTIFICATION_PREFS;

    const merged = { ...currentPrefs, ...this.stripUndefined(dto) };

    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data: { notificationPrefs: merged },
    });

    return updated.notificationPrefs;
  }

  async updatePrivacySettings(userId: string, dto: PrivacySettingsDto) {
    const existing = await this.prisma.studentProfile.findUnique({ where: { userId } });

    if (!existing) {
      throw new NotFoundException('Student profile not found');
    }

    const currentSettings = (existing.privacySettings as object) ?? DEFAULT_PRIVACY_SETTINGS;

    const merged = { ...currentSettings, ...this.stripUndefined(dto) };

    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data: { privacySettings: merged },
    });

    return updated.privacySettings;
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        sessions: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    this.logger.log(`Data export generated for user: ${userId}`);

    return {
      exportedAt: new Date().toISOString(),
      account: safeUser,
    };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    if (dto.confirmationText !== 'DELETE MY ACCOUNT') {
      throw new BadRequestException(
        'Confirmation text must exactly match "DELETE MY ACCOUNT"',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!matches) {
      throw new UnauthorizedException('Incorrect password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is already deactivated');
    }

    // Soft delete: retain record for compliance/audit but anonymize + deactivate.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        email: user.email ? `deleted_${userId}@lgionrise.deleted` : null,
        phone: user.phone ? `deleted_${userId}` : null,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.prisma.session.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    this.logger.warn(`Account deleted (soft) for user: ${userId}`);

    return { message: 'Your account has been deleted successfully' };
  }

  private stripUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
  }
}
