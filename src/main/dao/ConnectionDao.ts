import { getDatabase } from '../config/Database';
import { Logger } from '../log/Logger';

const log = Logger.getLogger('ConnectionDao');

export interface ConnectionProfile {
  id: number;
  name: string;
  host: string;
  port: number;
  workingDir: string;
  connectionTypeId: number;
  connectionTypeCode: string;
  credentialId: number | null;
  tunnelViaConnectionId: number | null;
  lastUsed: number;
}

export interface ConnectionType {
  id: number;
  code: string;
  name: string;
}

export class ConnectionDao {
  static addConnection(
    name: string,
    host: string,
    port: number,
    workingDir: string,
    connectionTypeId: number,
    credentialId: number | null = null,
    tunnelViaConnectionId: number | null = null
  ): number {
    const db = getDatabase();
    try {
      const finalWorkingDir = (workingDir && workingDir.trim()) ? workingDir.trim() : '~';
      const stmt = db.prepare(`
        INSERT INTO connections (name, host, port, working_dir, connection_type_id, credential_id, tunnel_via_connection_id, last_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        name.trim(),
        host.trim(),
        port,
        finalWorkingDir,
        connectionTypeId,
        credentialId,
        tunnelViaConnectionId,
        Math.floor(Date.now() / 1000)
      );
      
      const connId = Number(info.lastInsertRowid);
      
      db.prepare(`
        INSERT OR IGNORE INTO connection_settings (connection_id) VALUES (?)
      `).run(connId);

      log.info(`Added connection profile: ${name} (id=${connId})`);
      return connId;
    } catch (err: unknown) {
      log.error(`addConnection failed for ${name}`, err);
      throw err;
    }
  }

  static getConnections(): ConnectionProfile[] {
    const db = getDatabase();
    try {
      const rows = db.prepare(`
        SELECT c.id, c.name, c.host, c.port, c.working_dir as workingDir, 
               c.connection_type_id as connectionTypeId, t.code as connectionTypeCode,
               c.credential_id as credentialId, c.tunnel_via_connection_id as tunnelViaConnectionId,
               c.last_used as lastUsed
        FROM connections c
        JOIN connection_types t ON c.connection_type_id = t.id
        ORDER BY c.name ASC
      `).all() as ConnectionProfile[];
      return rows;
    } catch (err: unknown) {
      log.error('getConnections failed', err);
      return [];
    }
  }

  static getConnection(id: number): ConnectionProfile | null {
    const db = getDatabase();
    try {
      const row = db.prepare(`
        SELECT c.id, c.name, c.host, c.port, c.working_dir as workingDir, 
               c.connection_type_id as connectionTypeId, t.code as connectionTypeCode,
               c.credential_id as credentialId, c.tunnel_via_connection_id as tunnelViaConnectionId,
               c.last_used as lastUsed
        FROM connections c
        JOIN connection_types t ON c.connection_type_id = t.id
        WHERE c.id = ?
      `).get(id) as ConnectionProfile | undefined;
      return row || null;
    } catch (err: unknown) {
      log.error(`getConnection failed for id=${id}`, err);
      return null;
    }
  }

  static updateConnection(
    id: number,
    name: string,
    host: string,
    port: number,
    workingDir: string,
    connectionTypeId: number,
    credentialId: number | null = null,
    tunnelViaConnectionId: number | null = null
  ): void {
    const db = getDatabase();
    try {
      const finalWorkingDir = (workingDir && workingDir.trim()) ? workingDir.trim() : '~';
      db.prepare(`
        UPDATE connections
        SET name = ?, host = ?, port = ?, working_dir = ?, connection_type_id = ?, credential_id = ?, tunnel_via_connection_id = ?
        WHERE id = ?
      `).run(
        name.trim(),
        host.trim(),
        port,
        finalWorkingDir,
        connectionTypeId,
        credentialId,
        tunnelViaConnectionId,
        id
      );
      log.info(`Updated connection profile id=${id}`);
    } catch (err: unknown) {
      log.error(`updateConnection failed for id=${id}`, err);
      throw err;
    }
  }

  static deleteConnection(id: number): void {
    const db = getDatabase();
    try {
      db.prepare('DELETE FROM connections WHERE id = ?').run(id);
      log.info(`Deleted connection profile id=${id}`);
    } catch (err: unknown) {
      log.error(`deleteConnection failed for id=${id}`, err);
      throw err;
    }
  }

  static touchConnection(id: number): void {
    const db = getDatabase();
    try {
      db.prepare('UPDATE connections SET last_used = ? WHERE id = ?').run(
        Math.floor(Date.now() / 1000),
        id
      );
    } catch (err: unknown) {
      log.error(`touchConnection failed for id=${id}`, err);
    }
  }

  static getConnectionTypes(): ConnectionType[] {
    const db = getDatabase();
    try {
      return db.prepare('SELECT id, code, name FROM connection_types').all() as ConnectionType[];
    } catch (err: unknown) {
      log.error('getConnectionTypes failed', err);
      return [];
    }
  }
}
export default ConnectionDao;
