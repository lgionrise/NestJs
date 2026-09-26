import { Injectable, BadRequestException, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { IOtpSender, OtpChannel, OtpPurpose } from './interfaces/otp-provider.interface';
import { BrevoEmailProvider } from './providers/brevo-email.provider';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ConsoleSmsProvider } from './providers/console-sms.provider';

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 5 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly emailProvider: IOtpSender;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly brevoEmailProvider: BrevoEmailProvider,
    private readonly consoleEmailProvider: ConsoleEmailProvider,
    private readonly smsProvider: ConsoleSmsProvider,
  ) {
    const providerChoice = this.configService.get<string>('OTP_EMAIL_PROVIDER', 'brevo');
    this.emailProvider = providerChoice === 'console' ? this.consoleEmailProvider : this.brevoEmailProvider;
    this.logger.log(`OTP email provider active: ${providerChoice}`);
  }

  private buildKey(destination: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${destination}`;
  }

  private buildCooldownKey(destination: string, purpose: OtpPurpose): string {
    return `otp:cooldown:${purpose}:${destination}`;
  }

  private buildAttemptsKey(destination: string, purpose: OtpPurpose): string {
    return `otp:attempts:${purpose}:${destination}`;
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private generateOtp(): string {
    return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
  }

  async requestOtp(destination: string, channel: OtpChannel, purpose: OtpPurpose) {
    const cooldownKey = this.buildCooldownKey(destination, purpose);
    const isOnCooldown = await this.redis.get(cooldownKey);

    if (isOnCooldown) {
      const ttl = await this.redis.ttl(cooldownKey);
      throw new BadRequestException(
        `Please wait ${ttl} second(s) before requesting another OTP`,
      );
    }

    const otp = this.generateOtp();
    const otpKey = this.buildKey(destination, purpose);
    const attemptsKey = this.buildAttemptsKey(destination, purpose);

    await this.redis
      .multi()
      .set(otpKey, this.hashOtp(otp), 'EX', OTP_TTL_SECONDS)
      .set(cooldownKey, '1', 'EX', OTP_RESEND_COOLDOWN_SECONDS)
      .del(attemptsKey)
      .exec();

    const provider = channel === OtpChannel.EMAIL ? this.emailProvider : this.smsProvider;
    await provider.send(destination, otp, purpose);

    this.logger.log(`OTP requested for ${destination} | purpose: ${purpose}`);

    return {
      message: `OTP sent successfully via ${channel.toLowerCase()}`,
      expiresInSeconds: OTP_TTL_SECONDS,
    };
  }

  async verifyOtp(destination: string, purpose: OtpPurpose, submittedOtp: string): Promise<boolean> {
    const otpKey = this.buildKey(destination, purpose);
    const attemptsKey = this.buildAttemptsKey(destination, purpose);

    const storedHash = await this.redis.get(otpKey);

    if (!storedHash) {
      throw new BadRequestException('OTP has expired or was never requested. Please request a new one.');
    }

    const attempts = parseInt((await this.redis.get(attemptsKey)) ?? '0', 10);

    if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(otpKey);
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    const submittedHash = this.hashOtp(submittedOtp);

    if (submittedHash !== storedHash) {
      await this.redis.multi().incr(attemptsKey).expire(attemptsKey, OTP_TTL_SECONDS).exec();
      throw new BadRequestException('Invalid OTP');
    }

    await this.redis.multi().del(otpKey).del(attemptsKey).exec();

    this.logger.log(`OTP verified successfully for ${destination} | purpose: ${purpose}`);

    return true;
  }
}
