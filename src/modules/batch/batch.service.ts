import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BatchStatus, ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { slugify, generateUniqueSlugSuffix } from '../../common/utils/slugify.util';

@Injectable()
export class BatchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBatchDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: dto.teacherUserId },
    });

    if (!teacherProfile || teacherProfile.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('Batch can only be assigned to an approved teacher');
    }

    if (dto.discountedPriceInPaise !== undefined && dto.discountedPriceInPaise > dto.priceInPaise) {
      throw new BadRequestException('Discounted price cannot exceed the base price');
    }

    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    const existing = await this.prisma.batch.findUnique({ where: { slug } });
    if (existing) {
      slug = `${baseSlug}-${generateUniqueSlugSuffix()}`;
    }

    return this.prisma.batch.create({
      data: {
        courseId: dto.courseId,
        name: dto.name,
        slug,
        description: dto.description,
        teacherUserId: dto.teacherUserId,
        language: dto.language,
        priceInPaise: dto.priceInPaise,
        discountedPriceInPaise: dto.discountedPriceInPaise,
        validityDays: dto.validityDays,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        maxStudents: dto.maxStudents,
        status: BatchStatus.DRAFT,
        schedules: {
          create: dto.schedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject,
          })),
        },
      },
      include: { schedules: true },
    });
  }

  async findAll(filters: { status?: BatchStatus; courseId?: string; teacherUserId?: string }) {
    return this.prisma.batch.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.courseId && { courseId: filters.courseId }),
        ...(filters.teacherUserId && { teacherUserId: filters.teacherUserId }),
      },
      include: {
        schedules: true,
        course: { select: { id: true, title: true, targetExam: true } },
        teacher: {
          select: {
            id: true,
            teacherProfile: { select: { fullName: true, photoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: {
        schedules: true,
        course: true,
        teacher: {
          select: {
            id: true,
            teacherProfile: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return batch;
  }

  async update(id: string, requesterId: string, isAdmin: boolean, dto: UpdateBatchDto) {
    const batch = await this.ensureExists(id);

    if (!isAdmin && batch.teacherUserId !== requesterId) {
      throw new ForbiddenException('You can only edit your own batches');
    }

    if (
      dto.discountedPriceInPaise !== undefined &&
      dto.priceInPaise === undefined &&
      dto.discountedPriceInPaise > batch.priceInPaise
    ) {
      throw new BadRequestException('Discounted price cannot exceed the base price');
    }

    return this.prisma.batch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.priceInPaise !== undefined && { priceInPaise: dto.priceInPaise }),
        ...(dto.discountedPriceInPaise !== undefined && {
          discountedPriceInPaise: dto.discountedPriceInPaise,
        }),
        ...(dto.validityDays !== undefined && { validityDays: dto.validityDays }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.maxStudents !== undefined && { maxStudents: dto.maxStudents }),
      },
      include: { schedules: true },
    });
  }

  async publish(id: string, requesterId: string, isAdmin: boolean) {
    const batch = await this.ensureExists(id);

    if (!isAdmin && batch.teacherUserId !== requesterId) {
      throw new ForbiddenException('You can only publish your own batches');
    }

    return this.prisma.batch.update({
      where: { id },
      data: { status: BatchStatus.UPCOMING },
    });
  }

  async archive(id: string) {
    await this.ensureExists(id);
    return this.prisma.batch.update({
      where: { id },
      data: { status: BatchStatus.ARCHIVED },
    });
  }

  async delete(id: string, requesterId: string, isAdmin: boolean) {
    const batch = await this.ensureExists(id);

    if (!isAdmin && batch.teacherUserId !== requesterId) {
      throw new ForbiddenException('You can only delete your own batches');
    }

    if (batch.status !== BatchStatus.DRAFT) {
      throw new BadRequestException('Only draft batches can be deleted. Archive it instead.');
    }

    await this.prisma.batch.delete({ where: { id } });
    return { message: 'Batch deleted successfully' };
  }

  private async ensureExists(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    return batch;
  }
}
