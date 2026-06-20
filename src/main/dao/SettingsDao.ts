import { getDatabase } from '../config/Database';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('SettingsDao');

export interface Bookmark {
  id: number;
  connectionId: number;
  pane: string;
  path: string;
  isDefault: boolean;
  lastAccessed: number;
}

export interface KnownHost {
  id: number;
  host: string;
  port: number;
  keyType: string;
  publicKey: string;
  fingerprint: string;
  addedAt: number;
}

export interface ConnectionSettings {
  connectionId: number;
  localPanelCollapsed: boolean;
  localPanelWidth: number;
  localSortField: string;
  localSortAsc: boolean;
  localFilterText: string;
  remoteSortField: string;
  remoteSortAsc: boolean;
  remoteFilterText: string;
  localColName: number;
  localColSize: number;
  localColModified: number;
  remoteColName: number;
  remoteColSize: number;
  remoteColModified: number;
  remoteColOwner: number;
  remoteColRights: number;
}

interface ConnectionSettingsDbRow {
  connectionId: number;
  localPanelCollapsed: number;
  localPanelWidth: number;
  localSortField: string;
  localSortAsc: number;
  localFilterText: string;
  remoteSortField: string;
  remoteSortAsc: number;
  remoteFilterText: string;
  localColName: number;
  localColSize: number;
  localColModified: number;
  remoteColName: number;
  remoteColSize: number;
  remoteColModified: number;
  remoteColOwner: number;
  remoteColRights: number;
}

export interface RemoteTab {
  id: number;
  connectionId: number;
  path: string;
  tabOrder: number;
  isActive: boolean;
}

export class SettingsDao {
  // Key-value settings
  static getSetting(key: string, defaultValue: string): string {
    const db = getDatabase();
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : defaultValue;
    } catch (err: unknown) {
      log.error(`getSetting failed for key=${key}`, err);
      return defaultValue;
    }
  }

  static setSetting(key: string, value: string): void {
    const db = getDatabase();
    try {
      db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, value);
    } catch (err: unknown) {
      log.error(`setSetting failed for key=${key}`, err);
    }
  }

  static deleteSetting(key: string): void {
    const db = getDatabase();
    try {
      db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    } catch (err: unknown) {
      log.error(`deleteSetting failed for key=${key}`, err);
    }
  }

  static getAllSettings(): Record<string, string> {
    const db = getDatabase();
    try {
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const res: Record<string, string> = {};
      for (const r of rows) {
        res[r.key] = r.value;
      }
      return res;
    } catch (err: unknown) {
      log.error('getAllSettings failed', err);
      return {};
    }
  }

  // Bookmarks
  static getBookmarks(connectionId: number, pane: string): Bookmark[] {
    const db = getDatabase();
    try {
      const rows = db.prepare(`
        SELECT id, connection_id as connectionId, pane, path, is_default as isDefault, last_accessed as lastAccessed
        FROM bookmarks
        WHERE connection_id = ? AND pane = ?
        ORDER BY is_default DESC, last_accessed DESC, path ASC
      `).all(connectionId, pane) as { id: number; connectionId: number; pane: string; path: string; isDefault: number; lastAccessed: number }[];
      
      return rows.map(r => ({
        ...r,
        isDefault: r.isDefault === 1
      }));
    } catch (err: unknown) {
      log.error(`getBookmarks failed for connectionId=${connectionId}, pane=${pane}`, err);
      return [];
    }
  }

  static addBookmark(connectionId: number, pane: string, path: string): void {
    const db = getDatabase();
    try {
      // Check duplicate
      const exists = db.prepare(`
        SELECT id FROM bookmarks WHERE connection_id = ? AND pane = ? AND path = ?
      `).get(connectionId, pane, path);
      if (exists) return;

      db.prepare(`
        INSERT INTO bookmarks (connection_id, pane, path, last_accessed)
        VALUES (?, ?, ?, ?)
      `).run(connectionId, pane, path, Date.now());
    } catch (err: unknown) {
      log.error(`addBookmark failed for path=${path}`, err);
    }
  }

  static deleteBookmark(id: number): void {
    const db = getDatabase();
    try {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    } catch (err: unknown) {
      log.error(`deleteBookmark failed for id=${id}`, err);
    }
  }

  static setDefaultBookmark(connectionId: number, pane: string, id: number): void {
    const db = getDatabase();
    try {
      // Clear current default
      db.prepare('UPDATE bookmarks SET is_default = 0 WHERE connection_id = ? AND pane = ?').run(connectionId, pane);
      if (id >= 0) {
        db.prepare('UPDATE bookmarks SET is_default = 1 WHERE id = ?').run(id);
      }
    } catch (err: unknown) {
      log.error(`setDefaultBookmark failed for id=${id}`, err);
    }
  }

  static getDefaultBookmark(connectionId: number, pane: string): string | null {
    const db = getDatabase();
    try {
      const row = db.prepare('SELECT path FROM bookmarks WHERE connection_id = ? AND pane = ? AND is_default = 1').get(connectionId, pane) as { path: string } | undefined;
      return row ? row.path : null;
    } catch (err: unknown) {
      log.error(`getDefaultBookmark failed for conn=${connectionId}`, err);
      return null;
    }
  }

  // Known Hosts
  static getKnownHosts(): KnownHost[] {
    const db = getDatabase();
    try {
      return db.prepare(`
        SELECT id, host, port, key_type as keyType, public_key as publicKey, fingerprint, added_at as addedAt
        FROM known_hosts
        ORDER BY host ASC
      `).all() as KnownHost[];
    } catch (err: unknown) {
      log.error('getKnownHosts failed', err);
      return [];
    }
  }

  static deleteKnownHost(id: number): void {
    const db = getDatabase();
    try {
      db.prepare('DELETE FROM known_hosts WHERE id = ?').run(id);
    } catch (err: unknown) {
      log.error(`deleteKnownHost failed for id=${id}`, err);
    }
  }

  static addKnownHost(host: string, port: number, keyType: string, publicKey: string, fingerprint: string): void {
    const db = getDatabase();
    try {
      db.prepare(`
        INSERT INTO known_hosts (host, port, key_type, public_key, fingerprint, added_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(host, port, key_type) DO UPDATE SET public_key = excluded.public_key, fingerprint = excluded.fingerprint, added_at = excluded.added_at
      `).run(host, port, keyType, publicKey, fingerprint, Date.now());
    } catch (err: unknown) {
      log.error(`addKnownHost failed for host=${host}`, err);
    }
  }

  // Connection Specific Settings
  static getConnectionSettings(connectionId: number): ConnectionSettings | null {
    const db = getDatabase();
    try {
      const row = db.prepare(`
        SELECT connection_id as connectionId, local_panel_collapsed as localPanelCollapsed,
               local_panel_width as localPanelWidth,
               local_sort_field as localSortField, local_sort_asc as localSortAsc, local_filter_text as localFilterText,
               remote_sort_field as remoteSortField, remote_sort_asc as remoteSortAsc, remote_filter_text as remoteFilterText,
               local_col_name as localColName, local_col_size as localColSize, local_col_modified as localColModified,
               remote_col_name as remoteColName, remote_col_size as remoteColSize, remote_col_modified as remoteColModified,
               remote_col_owner as remoteColOwner, remote_col_rights as remoteColRights
        FROM connection_settings
        WHERE connection_id = ?
      `).get(connectionId) as ConnectionSettingsDbRow | undefined;
      if (!row) return null;
      return {
        ...row,
        localPanelCollapsed: row.localPanelCollapsed === 1,
        localSortAsc: row.localSortAsc === 1,
        remoteSortAsc: row.remoteSortAsc === 1,
      };
    } catch (err: unknown) {
      log.error(`getConnectionSettings failed for connectionId=${connectionId}`, err);
      return null;
    }
  }

  static updateConnectionSettings(connectionId: number, settings: Partial<ConnectionSettings>): void {
    const db = getDatabase();
    try {
      // Ensure row exists
      db.prepare('INSERT OR IGNORE INTO connection_settings (connection_id) VALUES (?)').run(connectionId);
      
      const fields: string[] = [];
      const values: unknown[] = [];
      
      if (settings.localPanelCollapsed !== undefined) {
        fields.push('local_panel_collapsed = ?');
        values.push(settings.localPanelCollapsed ? 1 : 0);
      }
      if (settings.localPanelWidth !== undefined) {
        fields.push('local_panel_width = ?');
        values.push(settings.localPanelWidth);
      }
      if (settings.localSortField !== undefined) {
        fields.push('local_sort_field = ?');
        values.push(settings.localSortField);
      }
      if (settings.localSortAsc !== undefined) {
        fields.push('local_sort_asc = ?');
        values.push(settings.localSortAsc ? 1 : 0);
      }
      if (settings.localFilterText !== undefined) {
        fields.push('local_filter_text = ?');
        values.push(settings.localFilterText);
      }
      if (settings.remoteSortField !== undefined) {
        fields.push('remote_sort_field = ?');
        values.push(settings.remoteSortField);
      }
      if (settings.remoteSortAsc !== undefined) {
        fields.push('remote_sort_asc = ?');
        values.push(settings.remoteSortAsc ? 1 : 0);
      }
      if (settings.remoteFilterText !== undefined) {
        fields.push('remote_filter_text = ?');
        values.push(settings.remoteFilterText);
      }
      if (settings.localColName !== undefined) {
        fields.push('local_col_name = ?');
        values.push(settings.localColName);
      }
      if (settings.localColSize !== undefined) {
        fields.push('local_col_size = ?');
        values.push(settings.localColSize);
      }
      if (settings.localColModified !== undefined) {
        fields.push('local_col_modified = ?');
        values.push(settings.localColModified);
      }
      if (settings.remoteColName !== undefined) {
        fields.push('remote_col_name = ?');
        values.push(settings.remoteColName);
      }
      if (settings.remoteColSize !== undefined) {
        fields.push('remote_col_size = ?');
        values.push(settings.remoteColSize);
      }
      if (settings.remoteColModified !== undefined) {
        fields.push('remote_col_modified = ?');
        values.push(settings.remoteColModified);
      }
      if (settings.remoteColOwner !== undefined) {
        fields.push('remote_col_owner = ?');
        values.push(settings.remoteColOwner);
      }
      if (settings.remoteColRights !== undefined) {
        fields.push('remote_col_rights = ?');
        values.push(settings.remoteColRights);
      }

      if (fields.length === 0) return;

      values.push(connectionId);
      db.prepare(`
        UPDATE connection_settings
        SET ${fields.join(', ')}
        WHERE connection_id = ?
      `).run(...values);
    } catch (err: unknown) {
      log.error(`updateConnectionSettings failed for connectionId=${connectionId}`, err);
    }
  }

  // Remote Tabs
  static getRemoteTabs(connectionId: number): RemoteTab[] {
    const db = getDatabase();
    try {
      const rows = db.prepare(`
        SELECT id, connection_id as connectionId, path, tab_order as tabOrder, is_active as isActive
        FROM remote_tabs
        WHERE connection_id = ?
        ORDER BY tab_order ASC
      `).all(connectionId) as { id: number; connectionId: number; path: string; tabOrder: number; isActive: number }[];
      
      return rows.map(r => ({
        ...r,
        isActive: r.isActive === 1
      }));
    } catch (err: unknown) {
      log.error(`getRemoteTabs failed for connectionId=${connectionId}`, err);
      return [];
    }
  }

  static saveRemoteTabs(connectionId: number, tabs: { path: string; tabOrder: number; isActive: boolean }[]): void {
    const db = getDatabase();
    try {
      const deleteStmt = db.prepare('DELETE FROM remote_tabs WHERE connection_id = ?');
      const insertStmt = db.prepare(`
        INSERT INTO remote_tabs (connection_id, path, tab_order, is_active)
        VALUES (?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        deleteStmt.run(connectionId);
        for (const t of tabs) {
          insertStmt.run(connectionId, t.path, t.tabOrder, t.isActive ? 1 : 0);
        }
      });
      transaction();
    } catch (err: unknown) {
      log.error(`saveRemoteTabs failed for connectionId=${connectionId}`, err);
    }
  }
}
