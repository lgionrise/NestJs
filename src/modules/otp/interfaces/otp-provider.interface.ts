export enum OtpChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum OtpPurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PHONE_VERIFICATION = 'PHONE_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TWO_FACTOR_AUTH = 'TWO_FACTOR_AUTH',
}

export interface IOtpSender {
  send(destination: string, otp: string, purpose: OtpPurpose): Promise<void>;
}
