import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EFormCredentialService {
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly config: ConfigService) {}

  private getKey(): Buffer {
    const secret = this.config.get<string>('EFORM_ENCRYPTION_KEY');
    if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
      throw new Error('EFormCredentialService requires a 32-byte EFORM_ENCRYPTION_KEY');
    }
    return Buffer.from(secret, 'hex');
  }

  encrypt(text: string): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);
    let ciphertext = cipher.update(text, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { ciphertext, iv: iv.toString('hex'), authTag };
  }

  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.getKey(),
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }
}
