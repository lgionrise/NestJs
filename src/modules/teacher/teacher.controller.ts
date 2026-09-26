import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { VisibilitySettingsDto } from './dto/visibility-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
@Controller({ path: 'teacher/profile', version: '1' })
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post('apply')
  async submitApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitApplicationDto,
  ) {
    const result = await this.teacherService.submitApplication(user.id, dto);
    return { success: true, data: result };
  }

  @Get()
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.teacherService.getMyProfile(user.id);
    return { success: true, data: result };
  }

  @Patch()
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    const result = await this.teacherService.updateMyProfile(user.id, dto);
    return { success: true, data: result };
  }

  @Patch('visibility')
  async updateVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VisibilitySettingsDto,
  ) {
    const result = await this.teacherService.updateVisibility(user.id, dto);
    return { success: true, data: result };
  }
}
