import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AddChapterDto } from './dto/add-chapter.dto';
import { slugify, generateUniqueSlugSuffix } from '../../common/utils/slugify.util';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createdByUserId: string, dto: CreateCourseDto) {
    const baseSlug = slugify(dto.title);
    let slug = baseSlug;

    const existing = await this.prisma.course.findUnique({ where: { slug } });
    if (existing) {
      slug = `${baseSlug}-${generateUniqueSlugSuffix()}`;
    }

    return this.prisma.course.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        targetExam: dto.targetExam,
        className: dto.className,
        createdByUserId,
        status: CourseStatus.DRAFT,
      },
    });
  }

  async findAll(filters: { status?: CourseStatus; targetExam?: string }) {
    return this.prisma.course.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.targetExam && { targetExam: filters.targetExam as any }),
      },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { orderIndex: 'asc' } },
        batches: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.ensureExists(id);

    return this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.targetExam !== undefined && { targetExam: dto.targetExam }),
        ...(dto.className !== undefined && { className: dto.className }),
      },
    });
  }

  async publish(id: string) {
    const course = await this.ensureExists(id);

    const chapterCount = await this.prisma.chapter.count({ where: { courseId: id } });
    if (chapterCount === 0) {
      throw new BadRequestException('Cannot publish a course with no chapters');
    }

    return this.prisma.course.update({
      where: { id },
      data: { status: CourseStatus.PUBLISHED },
    });
  }

  async archive(id: string) {
    await this.ensureExists(id);
    return this.prisma.course.update({
      where: { id },
      data: { status: CourseStatus.ARCHIVED },
    });
  }

  async delete(id: string) {
    await this.ensureExists(id);

    const batchCount = await this.prisma.batch.count({ where: { courseId: id } });
    if (batchCount > 0) {
      throw new ConflictException('Cannot delete a course that has batches. Archive it instead.');
    }

    await this.prisma.course.delete({ where: { id } });
    return { message: 'Course deleted successfully' };
  }

  async addChapter(courseId: string, dto: AddChapterDto) {
    await this.ensureExists(courseId);

    return this.prisma.chapter.create({
      data: {
        courseId,
        title: dto.title,
        orderIndex: dto.orderIndex,
        topics: dto.topics ?? [],
      },
    });
  }

  async removeChapter(courseId: string, chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });

    if (!chapter || chapter.courseId !== courseId) {
      throw new NotFoundException('Chapter not found in this course');
    }

    await this.prisma.chapter.delete({ where: { id: chapterId } });
    return { message: 'Chapter removed successfully' };
  }

  private async ensureExists(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }
}
