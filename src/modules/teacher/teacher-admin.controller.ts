import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { TeacherService } from './teacher.service';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller({ path: 'admin/teachers', version: '1' })
export class TeacherAdminController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('applications')
  async listApplications(@Query('status') status?: ApprovalStatus) {
    const result = await this.teacherService.listApplications(status);
    return { success: true, data: result };
  }

  @Get('applications/:id')
  async getApplication(@Param('id') id: string) {
    const result = await this.teacherService.getApplicationById(id);
    return { success: true, data: result };
  }

  @Post('applications/:id/review')
  async reviewApplication(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewApplicationDto,
  ) {
    const result = await this.teacherService.reviewApplication(id, admin.id, dto);
    return { success: true, data: result };
  }
}
