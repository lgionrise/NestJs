import { Injectable, Logger } from '@nestjs/common';
import { IOtpSender, OtpPurpose } from '../interfaces/otp-provider.interface';

/**
 * Placeholder SMS provider — logs OTP instead of sending real SMS.
 * Will be replaced by a real SMS gateway integration later.
 */
@Injectable()
export class ConsoleSmsProvider implements IOtpSender {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(destination: string, otp: string, purpose: OtpPurpose): Promise<void> {
    this.logger.log(`[SMS-OTP] To: ${destination} | Purpose: ${purpose} | OTP: ${otp}`);
  }
}
