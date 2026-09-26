import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ConsoleSmsProvider } from './providers/console-sms.provider';

@Module({
  providers: [OtpService, ConsoleEmailProvider, ConsoleSmsProvider],
  exports: [OtpService],
})
export class OtpModule {}
