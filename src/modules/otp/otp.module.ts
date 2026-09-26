import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { BrevoEmailProvider } from './providers/brevo-email.provider';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ConsoleSmsProvider } from './providers/console-sms.provider';

@Module({
  providers: [OtpService, BrevoEmailProvider, ConsoleEmailProvider, ConsoleSmsProvider],
  exports: [OtpService],
})
export class OtpModule {}
