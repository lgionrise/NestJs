import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOtpSender, OtpPurpose } from '../interfaces/otp-provider.interface';

const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

const PURPOSE_SUBJECT_MAP: Record<OtpPurpose, string> = {
  [OtpPurpose.EMAIL_VERIFICATION]: 'Verify your email — LGIONRISE',
  [OtpPurpose.PHONE_VERIFICATION]: 'Verify your phone number — LGIONRISE',
  [OtpPurpose.PASSWORD_RESET]: 'Reset your password — LGIONRISE',
  [OtpPurpose.TWO_FACTOR_AUTH]: 'Your two-factor authentication code — LGIONRISE',
};

@Injectable()
export class BrevoEmailProvider implements IOtpSender {
  private readonly logger = new Logger(BrevoEmailProvider.name);
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY') as string;
    this.senderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL') as string;
    this.senderName = this.configService.get<string>('BREVO_SENDER_NAME', 'LGIONRISE');
  }

  async send(destination: string, otp: string, purpose: OtpPurpose): Promise<void> {
    const subject = PURPOSE_SUBJECT_MAP[purpose] ?? 'Your OTP code — LGIONRISE';
    const htmlContent = this.buildHtml(otp, purpose);

    const payload = {
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: destination }],
      subject,
      htmlContent,
    };

    try {
      const response = await fetch(BREVO_SEND_EMAIL_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `Brevo send failed for ${destination} | status: ${response.status} | body: ${errorBody}`,
        );
        throw new InternalServerErrorException('Failed to send verification email. Please try again.');
      }

      this.logger.log(`OTP email sent via Brevo to ${destination} | purpose: ${purpose}`);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Brevo API request failed for ${destination}: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to send verification email. Please try again.');
    }
  }

  private buildHtml(otp: string, purpose: OtpPurpose): string {
    const purposeText: Record<OtpPurpose, string> = {
      [OtpPurpose.EMAIL_VERIFICATION]: 'verify your email address',
      [OtpPurpose.PHONE_VERIFICATION]: 'verify your phone number',
      [OtpPurpose.PASSWORD_RESET]: 'reset your password',
      [OtpPurpose.TWO_FACTOR_AUTH]: 'complete your secure login',
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #111827; margin-bottom: 8px;">LGIONRISE</h2>
        <p style="color: #374151; font-size: 15px;">
          Use the code below to ${purposeText[purpose] ?? 'complete your request'}.
          This code expires in <strong>5 minutes</strong>.
        </p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          If you did not request this code, you can safely ignore this email.
        </p>
      </div>
    `;
  }
}
