import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Symmetric encryption for sensitive fields at rest (e.g. TOTP secrets).
 * Key is derived from JWT_ACCESS_SECRET via scrypt so no extra env var is required,
 * but a dedicated ENCRYPTION_KEY env var is recommended for production hardening.
 */
export class EncryptionUtil {
  private static getKey(secret: string): Buffer {
    return scryptSync(secret, 'lgionrise-static-salt-v1', 32);
  }

  static encrypt(plainText: string, secret: string): string {
    const key = this.getKey(secret);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  static decrypt(cipherText: string, secret: string): string {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted payload format');
    }

    const key = this.getKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
