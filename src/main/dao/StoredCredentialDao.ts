import { getDatabase } from '../config/Database';
import { PlatformCipher } from '../cipher/PlatformCipher';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('StoredCredentialDao');

export interface StoredCredential {
  id: number;
  name: string;
  username: string;
  passwordEncrypted: string;
  totpSecretEncrypted: string;
  isDefault: boolean;
  type: string;
  password?: string;
  totpSecret?: string;
  privateKeyName?: string;
  privateKeyContent?: string;
  privateKeyPassphrase?: string;
}

export class StoredCredentialDao {
  static addCredential(
    name: string,
    username: string,
    passwordPlain: string,
    totpSecretPlain: string,
    isDefault = false,
    type = 'PASSWORD_TOTP',
    privateKeyName = '',
    privateKeyContentPlain = '',
    privateKeyPassphrasePlain = ''
  ): number {
    const db = getDatabase();
    const pwdEnc = PlatformCipher.encrypt(passwordPlain);
    const totpEnc = PlatformCipher.encrypt(totpSecretPlain);
    const keyContentEnc = PlatformCipher.encrypt(privateKeyContentPlain);
    const keyPassphraseEnc = PlatformCipher.encrypt(privateKeyPassphrasePlain);

    try {
      const stmt = db.prepare(`
        INSERT INTO stored_credentials (name, username, password, totp_secret, private_key_name, private_key_content, private_key_passphrase, is_default, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        name.trim(),
        username.trim(),
        pwdEnc,
        totpEnc,
        privateKeyName.trim(),
        keyContentEnc,
        keyPassphraseEnc,
        isDefault ? 1 : 0,
        type
      );
      log.info(`Added credential profile: ${name} (id=${info.lastInsertRowid})`);
      return Number(info.lastInsertRowid);
    } catch (err: any) {
      log.error(`addCredential failed for ${name}`, err);
      throw err;
    }
  }

  static getCredentials(): StoredCredential[] {
    const db = getDatabase();
    try {
      const rows = db.prepare(`
        SELECT id, name, username, password as passwordEncrypted, totp_secret as totpSecretEncrypted,
               private_key_name as privateKeyName, private_key_content as privateKeyContentEncrypted,
               private_key_passphrase as privateKeyPassphraseEncrypted, is_default as isDefault, type
        FROM stored_credentials
        ORDER BY name ASC
      `).all() as any[];

      return rows.map(r => this.mapRow(r));
    } catch (err: any) {
      log.error('getCredentials failed', err);
      return [];
    }
  }

  static getCredential(id: number): StoredCredential | null {
    const db = getDatabase();
    try {
      const row = db.prepare(`
        SELECT id, name, username, password as passwordEncrypted, totp_secret as totpSecretEncrypted,
               private_key_name as privateKeyName, private_key_content as privateKeyContentEncrypted,
               private_key_passphrase as privateKeyPassphraseEncrypted, is_default as isDefault, type
        FROM stored_credentials
        WHERE id = ?
      `).get(id) as any;

      return row ? this.mapRow(row) : null;
    } catch (err: any) {
      log.error(`getCredential failed for id=${id}`, err);
      return null;
    }
  }

  static updateCredential(
    id: number,
    name: string,
    username: string,
    passwordPlain: string,
    totpSecretPlain: string,
    isDefault = false,
    type = 'PASSWORD_TOTP',
    privateKeyName = '',
    privateKeyContentPlain = '',
    privateKeyPassphrasePlain = ''
  ): void {
    const db = getDatabase();
    const pwdEnc = PlatformCipher.encrypt(passwordPlain);
    const totpEnc = PlatformCipher.encrypt(totpSecretPlain);
    const keyContentEnc = PlatformCipher.encrypt(privateKeyContentPlain);
    const keyPassphraseEnc = PlatformCipher.encrypt(privateKeyPassphrasePlain);

    try {
      db.prepare(`
        UPDATE stored_credentials
        SET name = ?, username = ?, password = ?, totp_secret = ?, private_key_name = ?, private_key_content = ?, private_key_passphrase = ?, is_default = ?, type = ?
        WHERE id = ?
      `).run(
        name.trim(),
        username.trim(),
        pwdEnc,
        totpEnc,
        privateKeyName.trim(),
        keyContentEnc,
        keyPassphraseEnc,
        isDefault ? 1 : 0,
        type,
        id
      );
      log.info(`Updated credential profile id=${id}`);
    } catch (err: any) {
      log.error(`updateCredential failed for id=${id}`, err);
      throw err;
    }
  }

  static deleteCredential(id: number): void {
    const db = getDatabase();
    try {
      db.prepare(`
        DELETE FROM stored_credentials WHERE id = ?
      `).run(id);
      log.info(`Deleted credential profile id=${id}`);
    } catch (err: any) {
      log.error(`deleteCredential failed for id=${id}`, err);
      throw err;
    }
  }

  static setDefaultCredential(id: number): void {
    const db = getDatabase();
    
    const transaction = db.transaction(() => {
      db.prepare('UPDATE stored_credentials SET is_default = 0').run();
      db.prepare('UPDATE stored_credentials SET is_default = 1 WHERE id = ?').run(id);
    });

    try {
      transaction();
      log.info(`Set credential profile id=${id} as default`);
    } catch (err: any) {
      log.error(`setDefaultCredential failed for id=${id}`, err);
      throw err;
    }
  }

  static getDefaultCredential(): StoredCredential | null {
    const db = getDatabase();
    try {
      const row = db.prepare(`
        SELECT id, name, username, password as passwordEncrypted, totp_secret as totpSecretEncrypted,
               private_key_name as privateKeyName, private_key_content as privateKeyContentEncrypted,
               private_key_passphrase as privateKeyPassphraseEncrypted, is_default as isDefault, type
        FROM stored_credentials
        WHERE is_default = 1
        LIMIT 1
      `).get() as any;

      return row ? this.mapRow(row) : null;
    } catch (err: any) {
      log.error('getDefaultCredential failed', err);
      return null;
    }
  }

  private static mapRow(row: any): StoredCredential {
    const passwordEncrypted = row.passwordEncrypted || '';
    const totpSecretEncrypted = row.totpSecretEncrypted || '';
    const keyContentEnc = row.privateKeyContentEncrypted || '';
    const keyPassphraseEnc = row.privateKeyPassphraseEncrypted || '';
    
    return {
      id: row.id,
      name: row.name || '',
      username: row.username || '',
      passwordEncrypted,
      totpSecretEncrypted,
      isDefault: row.isDefault === 1,
      type: row.type || 'PASSWORD_TOTP',
      password: PlatformCipher.decrypt(passwordEncrypted),
      totpSecret: PlatformCipher.decrypt(totpSecretEncrypted),
      privateKeyName: row.privateKeyName || '',
      privateKeyContent: PlatformCipher.decrypt(keyContentEnc),
      privateKeyPassphrase: PlatformCipher.decrypt(keyPassphraseEnc),
    };
  }
}
export default StoredCredentialDao;
