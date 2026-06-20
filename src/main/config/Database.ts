import DatabaseConnection from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

let dbInstance: DatabaseConnection.Database | null = null;

export function getDatabase(): DatabaseConnection.Database {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'settings.db');
  const db = new DatabaseConnection(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);

  dbInstance = db;
  return db;
}

function initializeSchema(db: DatabaseConnection.Database) {
  try {
    let ddlPath = path.join(process.cwd(), 'src/main/config/ddl.sql');
    if (!fs.existsSync(ddlPath)) {
      ddlPath = path.join(__dirname, 'ddl.sql');
    }
    if (!fs.existsSync(ddlPath)) {
      ddlPath = path.join(__dirname, '../config/ddl.sql');
    }

    if (fs.existsSync(ddlPath)) {
      const ddl = fs.readFileSync(ddlPath, 'utf8');
      db.exec(ddl);
    } else {
      throw new Error(`ddl.sql file not found at expected paths`);
    }
  } catch (err: unknown) {
    console.error(`Failed to initialize database schema: ${(err as Error).message}`);
    throw err;
  }
}

export default getDatabase;
