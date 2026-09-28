import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOtpSender, OtpPurpose } from '../interfaces/otp-provider.interface';

const BREVO_SEND_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

const COLORS = {
  ink: '#10192E',
  inkSoft: '#1B2540',
  amber: '#DB8B2D',
  amberSoft: '#F0C894',
  teal: '#2F8F7D',
  paper: '#FAF8F3',
  paperDim: '#F1EDE4',
  slate: '#4B5571',
  danger: '#C0392B',
};

interface EmailContent {
  subject: string;
  eyebrow: string;
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaColor?: string;
  codeBlock?: string;
  footNote?: string;
}

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
    const content = this.buildOtpContent(otp, purpose);
    await this.dispatch(destination, content);
  }

  async sendWelcomeEmail(destination: string, fullNameOrEmail: string): Promise<void> {
    const content: EmailContent = {
      subject: 'Welcome to LGIONRISE 🎉',
      eyebrow: 'Account created',
      heading: `Welcome aboard, ${fullNameOrEmail}!`,
      bodyLines: [
        "You're in. LGIONRISE brings live classes, instant doubt support and rank-tracking tests together for JEE, NEET and Board exam prep.",
        'Verify your email to unlock your dashboard and start your first batch.',
      ],
      ctaLabel: 'Go to LGIONRISE',
      ctaColor: COLORS.amber,
      footNote: "If you didn't create this account, you can safely ignore this email.",
    };
    await this.dispatch(destination, content);
  }

  async sendNewLoginAlert(
    destination: string,
    meta: { ipAddress?: string; userAgent?: string; time: Date },
  ): Promise<void> {
    const content: EmailContent = {
      subject: 'New sign-in to your LGIONRISE account',
      eyebrow: 'Security alert',
      heading: 'We noticed a new sign-in',
      bodyLines: [
        `Time: ${meta.time.toUTCString()}`,
        `Device: ${meta.userAgent ?? 'Unknown device'}`,
        `IP address: ${meta.ipAddress ?? 'Unknown'}`,
        "If this was you, no action is needed. If you don't recognise this activity, secure your account immediately.",
      ],
      ctaLabel: 'Secure my account',
      ctaColor: COLORS.danger,
      footNote: 'This is an automated security notification from LGIONRISE.',
    };
    await this.dispatch(destination, content);
  }

  private buildOtpContent(otp: string, purpose: OtpPurpose): EmailContent {
    const map: Record<OtpPurpose, EmailContent> = {
      [OtpPurpose.EMAIL_VERIFICATION]: {
        subject: 'Verify your email — LGIONRISE',
        eyebrow: 'Email verification',
        heading: 'Confirm your email address',
        bodyLines: ['Enter this code in the app to verify your email. It expires in 5 minutes.'],
        codeBlock: otp,
        ctaColor: COLORS.amber,
      },
      [OtpPurpose.PHONE_VERIFICATION]: {
        subject: 'Verify your phone number — LGIONRISE',
        eyebrow: 'Phone verification',
        heading: 'Confirm your phone number',
        bodyLines: ['Enter this code in the app to verify your phone number. It expires in 5 minutes.'],
        codeBlock: otp,
        ctaColor: COLORS.amber,
      },
      [OtpPurpose.PASSWORD_RESET]: {
        subject: 'Reset your password — LGIONRISE',
        eyebrow: 'Password reset',
        heading: 'Reset your password',
        bodyLines: [
          'Use this code to set a new password. It expires in 5 minutes.',
          "If you didn't request this, you can safely ignore this email.",
        ],
        codeBlock: otp,
        ctaColor: COLORS.teal,
      },
      [OtpPurpose.TWO_FACTOR_AUTH]: {
        subject: 'Your two-factor authentication code — LGIONRISE',
        eyebrow: 'Two-factor authentication',
        heading: 'Complete your secure sign-in',
        bodyLines: ['Enter this code to finish signing in. It expires in 5 minutes.'],
        codeBlock: otp,
        ctaColor: COLORS.ink,
      },
    };

    return map[purpose];
  }

  private async dispatch(destination: string, content: EmailContent): Promise<void> {
    const payload = {
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: destination }],
      subject: content.subject,
      htmlContent: this.renderTemplate(content),
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
        throw new InternalServerErrorException('Failed to send email. Please try again.');
      }

      this.logger.log(`Email sent via Brevo to ${destination} | subject: ${content.subject}`);
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Brevo API request failed for ${destination}: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to send email. Please try again.');
    }
  }

  private renderTemplate(content: EmailContent): string {
    const { eyebrow, heading, bodyLines, ctaLabel, ctaColor, codeBlock, footNote } = content;
    const accent = ctaColor ?? COLORS.amber;

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:${COLORS.paperDim};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.paperDim};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:${COLORS.paper};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(16,25,46,0.08);">

          <tr>
            <td style="background:linear-gradient(135deg, ${COLORS.ink} 0%, ${COLORS.inkSoft} 100%);padding:28px 32px;">
              <span style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:${COLORS.paper};letter-spacing:0.5px;">LGIONRISE</span>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 8px 32px;">
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.4px;color:${accent};text-transform:none;">${eyebrow}</p>
              <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:24px;font-weight:600;color:${COLORS.ink};line-height:1.3;">${heading}</h1>
              ${bodyLines
                .map(
                  (line) =>
                    `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:${COLORS.slate};">${line}</p>`,
                )
                .join('')}
            </td>
          </tr>

          ${
            codeBlock
              ? `
          <tr>
            <td style="padding:8px 32px 24px 32px;">
              <div style="background-color:${COLORS.paperDim};border-radius:10px;padding:20px;text-align:center;">
                <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:${COLORS.ink};">${codeBlock}</span>
              </div>
            </td>
          </tr>`
              : ''
          }

          ${
            ctaLabel
              ? `
          <tr>
            <td style="padding:8px 32px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:${accent};border-radius:100px;">
                    <a href="#" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${COLORS.paper};text-decoration:none;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ''
          }

          <tr>
            <td style="padding:0 32px 32px 32px;border-top:1px solid ${COLORS.paperDim};">
              <p style="margin:20px 0 0 0;font-size:12px;color:${COLORS.slate};line-height:1.6;">
                ${footNote ?? 'This is an automated message from LGIONRISE.'}
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:20px 0 0 0;font-size:11px;color:${COLORS.slate};">© ${new Date().getFullYear()} LGIONRISE. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
