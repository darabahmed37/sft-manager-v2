import * as crypto from 'crypto';

const ENC_PREFIX = 'ENC:';
const CLI_ENC_PREFIX = 'CLI_ENC:';
const FALLBACK_KEY_RAW = 'sftp-manager-v2-dev-fallback-key-32bytes-long';
const FALLBACK_KEY = Buffer.alloc(32, FALLBACK_KEY_RAW);

export class PlatformCipher {
  private static isSafeStorageAvailable(): boolean {
    try {
      // safeStorage is dynamically imported to prevent Node testing failures
      const electron = require('electron');
      return electron && electron.safeStorage && electron.safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  static encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    if (this.isSafeStorageAvailable()) {
      try {
        const { safeStorage } = require('electron');
        const buffer = safeStorage.encryptString(plaintext);
        return ENC_PREFIX + buffer.toString('base64');
      } catch (err: any) {
        console.warn(`[PlatformCipher] safeStorage.encryptString failed: ${err.message}`);
      }
    }

    // CLI/Node Fallback: AES-256-CBC
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', FALLBACK_KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return `${CLI_ENC_PREFIX}${iv.toString('base64')}:${encrypted}`;
  }

  static decrypt(ciphertext: string): string {
    if (!ciphertext) return ciphertext;

    // CLI Fallback decryption
    if (ciphertext.startsWith(CLI_ENC_PREFIX)) {
      try {
        const parts = ciphertext.substring(CLI_ENC_PREFIX.length).split(':');
        if (parts.length < 2) return '';
        const iv = Buffer.from(parts[0], 'base64');
        const data = parts[1];
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', FALLBACK_KEY, iv);
        let decrypted = decipher.update(data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (err: any) {
        console.warn(`[PlatformCipher] CLI fallback decrypt failed: ${err.message}`);
        return '';
      }
    }

    if (!ciphertext.startsWith(ENC_PREFIX)) {
      return ciphertext; // plain text fallback
    }

    if (this.isSafeStorageAvailable()) {
      try {
        const { safeStorage } = require('electron');
        const buffer = Buffer.from(ciphertext.substring(ENC_PREFIX.length), 'base64');
        return safeStorage.decryptString(buffer);
      } catch (err: any) {
        console.warn(`[PlatformCipher] safeStorage.decryptString failed: ${err.message}`);
        return '';
      }
    }

    console.warn('[PlatformCipher] Decryption requested but safeStorage is unavailable');
    return '';
  }
}
export default PlatformCipher;
