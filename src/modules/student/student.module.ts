import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [StudentController, DashboardController],
  providers: [StudentService, DashboardService],
  exports: [StudentService, DashboardService],
})
export class StudentModule {}
