import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AddChapterDto } from './dto/add-chapter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@Controller({ path: 'courses', version: '1' })
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    const result = await this.courseService.create(user.id, dto);
    return { success: true, data: result };
  }

  @Public()
  @Get()
  async findAll(@Query('status') status?: CourseStatus, @Query('targetExam') targetExam?: string) {
    const result = await this.courseService.findAll({ status, targetExam });
    return { success: true, data: result };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.courseService.findOne(id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    const result = await this.courseService.update(id, dto);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    const result = await this.courseService.publish(id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post(':id/archive')
  async archive(@Param('id') id: string) {
    const result = await this.courseService.archive(id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const result = await this.courseService.delete(id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post(':id/chapters')
  async addChapter(@Param('id') id: string, @Body() dto: AddChapterDto) {
    const result = await this.courseService.addChapter(id, dto);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':id/chapters/:chapterId')
  async removeChapter(@Param('id') id: string, @Param('chapterId') chapterId: string) {
    const result = await this.courseService.removeChapter(id, chapterId);
    return { success: true, data: result };
  }
}
