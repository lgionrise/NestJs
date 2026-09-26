import { Module } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { TeacherAdminController } from './teacher-admin.controller';

@Module({
  controllers: [TeacherController, TeacherAdminController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
