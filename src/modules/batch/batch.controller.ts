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
import { BatchStatus, Role } from '@prisma/client';
import { BatchService } from './batch.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller({ path: 'batches', version: '1' })
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(@Body() dto: CreateBatchDto) {
    const result = await this.batchService.create(dto);
    return { success: true, data: result };
  }

  @Public()
  @Get()
  async findAll(
    @Query('status') status?: BatchStatus,
    @Query('courseId') courseId?: string,
    @Query('teacherUserId') teacherUserId?: string,
  ) {
    const result = await this.batchService.findAll({ status, courseId, teacherUserId });
    return { success: true, data: result };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.batchService.findOne(id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBatchDto,
  ) {
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const result = await this.batchService.update(id, user.id, isAdmin, dto);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const result = await this.batchService.publish(id, user.id, isAdmin);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post(':id/archive')
  async archive(@Param('id') id: string) {
    const result = await this.batchService.archive(id);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
    const result = await this.batchService.delete(id, user.id, isAdmin);
    return { success: true, data: result };
  }
}
