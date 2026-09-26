import { Injectable, Logger } from '@nestjs/common';
import { IOtpSender, OtpPurpose } from '../interfaces/otp-provider.interface';

/**
 * Placeholder email provider — logs OTP to console/logger instead of sending real email.
 * Will be replaced by BrevoEmailProvider in the Notifications feature-group.
 * Kept behind the IOtpSender interface so swapping providers requires no changes
 * to OtpService or any consumer.
 */
@Injectable()
export class ConsoleEmailProvider implements IOtpSender {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(destination: string, otp: string, purpose: OtpPurpose): Promise<void> {
    this.logger.log(`[EMAIL-OTP] To: ${destination} | Purpose: ${purpose} | OTP: ${otp}`);
  }
}
