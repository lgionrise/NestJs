import { PartialType } from '@nestjs/mapped-types';
import { SubmitApplicationDto } from './submit-application.dto';

export class UpdateTeacherProfileDto extends PartialType(SubmitApplicationDto) {}
