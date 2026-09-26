import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { VisibilitySettingsDto } from './dto/visibility-settings.dto';

@Injectable()
export class TeacherService {
  private readonly logger = new Logger(TeacherService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitApplication(userId: string, dto: SubmitApplicationDto) {
    const existing = await this.prisma.teacherProfile.findUnique({ where: { userId } });

    if (existing) {
      throw new BadRequestException(
        'You have already submitted a teacher application. Use the update endpoint instead.',
      );
    }

    const profile = await this.prisma.teacherProfile.create({
      data: {
        userId,
        fullName: dto.fullName,
        photoUrl: dto.photoUrl,
        bio: dto.bio,
        qualifications: dto.qualifications,
        experienceYears: dto.experienceYears,
        subjects: dto.subjects,
        videoIntroUrl: dto.videoIntroUrl,
        youtubeUrl: dto.youtubeUrl,
        linkedinUrl: dto.linkedinUrl,
        approvalStatus: ApprovalStatus.PENDING,
        onboardingStep: 1,
        isOnboardingDone: true,
      },
    });

    this.logger.log(`Teacher application submitted by user: ${userId}`);

    return profile;
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            isEmailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Teacher profile not found. Please submit your application first.',
      );
    }

    return profile;
  }

  async updateMyProfile(userId: string, dto: UpdateTeacherProfileDto) {
    const existing = await this.prisma.teacherProfile.findUnique({ where: { userId } });

    if (!existing) {
      throw new NotFoundException('Teacher profile not found. Please submit your application first.');
    }

    if (existing.approvalStatus === ApprovalStatus.APPROVED) {
      // Approved profile edits should not silently bypass moderation for material changes.
      // Subjects/bio/qualifications changes move the profile back to PENDING for re-review.
      const materialFieldsChanged =
        dto.bio !== undefined ||
        dto.qualifications !== undefined ||
        dto.subjects !== undefined ||
        dto.experienceYears !== undefined;

      const updated = await this.prisma.teacherProfile.update({
        where: { userId },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
          ...(dto.bio !== undefined && { bio: dto.bio }),
          ...(dto.qualifications !== undefined && { qualifications: dto.qualifications }),
          ...(dto.experienceYears !== undefined && { experienceYears: dto.experienceYears }),
          ...(dto.subjects !== undefined && { subjects: dto.subjects }),
          ...(dto.videoIntroUrl !== undefined && { videoIntroUrl: dto.videoIntroUrl }),
          ...(dto.youtubeUrl !== undefined && { youtubeUrl: dto.youtubeUrl }),
          ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
          ...(materialFieldsChanged && {
            approvalStatus: ApprovalStatus.PENDING,
            rejectionReason: null,
          }),
        },
      });

      if (materialFieldsChanged) {
        this.logger.log(`Teacher ${userId} profile changes triggered re-review`);
      }

      return updated;
    }

    return this.prisma.teacherProfile.update({
      where: { userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.qualifications !== undefined && { qualifications: dto.qualifications }),
        ...(dto.experienceYears !== undefined && { experienceYears: dto.experienceYears }),
        ...(dto.subjects !== undefined && { subjects: dto.subjects }),
        ...(dto.videoIntroUrl !== undefined && { videoIntroUrl: dto.videoIntroUrl }),
        ...(dto.youtubeUrl !== undefined && { youtubeUrl: dto.youtubeUrl }),
        ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
      },
    });
  }

  async updateVisibility(userId: string, dto: VisibilitySettingsDto) {
    const existing = await this.prisma.teacherProfile.findUnique({ where: { userId } });

    if (!existing) {
      throw new NotFoundException('Teacher profile not found');
    }

    if (existing.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException('Only approved teachers can change visibility settings');
    }

    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { isVisible: dto.isVisible },
    });
  }

  // ─── ADMIN OPERATIONS ─────────────────────────────────────────────────

  async listApplications(status?: ApprovalStatus) {
    return this.prisma.teacherProfile.findMany({
      where: status ? { approvalStatus: status } : undefined,
      include: {
        user: {
          select: { id: true, email: true, phone: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplicationById(teacherProfileId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherProfileId },
      include: {
        user: {
          select: { id: true, email: true, phone: true, createdAt: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Teacher application not found');
    }

    return profile;
  }

  async reviewApplication(
    teacherProfileId: string,
    reviewerId: string,
    dto: ReviewApplicationDto,
  ) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherProfileId },
    });

    if (!profile) {
      throw new NotFoundException('Teacher application not found');
    }

    if (profile.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `This application has already been ${profile.approvalStatus.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: {
        approvalStatus: dto.status,
        rejectionReason: dto.status === ApprovalStatus.REJECTED ? dto.rejectionReason : null,
        approvedAt: dto.status === ApprovalStatus.APPROVED ? new Date() : null,
        approvedByUserId: reviewerId,
      },
    });

    this.logger.log(
      `Teacher application ${teacherProfileId} ${dto.status} by admin ${reviewerId}`,
    );

    return updated;
  }
}
