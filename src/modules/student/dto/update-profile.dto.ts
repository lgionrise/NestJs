import { PartialType } from '@nestjs/mapped-types';
import { SetupProfileDto } from './setup-profile.dto';

export class UpdateProfileDto extends PartialType(SetupProfileDto) {}
