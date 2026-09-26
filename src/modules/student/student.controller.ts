import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { SetupProfileDto } from './dto/setup-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { PrivacySettingsDto } from './dto/privacy-settings.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller({ path: 'student/profile', version: '1' })
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post('setup')
  async setupProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetupProfileDto,
  ) {
    const result = await this.studentService.setupProfile(user.id, dto);
    return { success: true, data: result };
  }

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.studentService.getProfile(user.id);
    return { success: true, data: result };
  }

  @Patch()
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const result = await this.studentService.updateProfile(user.id, dto);
    return { success: true, data: result };
  }

  @Patch('notifications')
  async updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NotificationPreferencesDto,
  ) {
    const result = await this.studentService.updateNotificationPreferences(user.id, dto);
    return { success: true, data: result };
  }

  @Patch('privacy')
  async updatePrivacySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PrivacySettingsDto,
  ) {
    const result = await this.studentService.updatePrivacySettings(user.id, dto);
    return { success: true, data: result };
  }

  @Get('export')
  async exportData(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.studentService.exportData(user.id);
    return { success: true, data: result };
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ) {
    const result = await this.studentService.deleteAccount(user.id, dto);
    return { success: true, data: result };
  }
}
