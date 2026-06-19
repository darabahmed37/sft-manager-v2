-- Production-Grade Database Schema for SFTP Manager V2

-- 1. Reference Data: Connection Types
CREATE TABLE IF NOT EXISTS connection_types (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

-- Seed Connection Types
INSERT OR IGNORE INTO connection_types (id, code, name) VALUES (1, 'DIRECT', 'Direct SSH/SFTP Connection');
INSERT OR IGNORE INTO connection_types (id, code, name) VALUES (2, 'BASTION', 'Bastion Jump Proxy');

-- 2. Stored Authentication Credentials
CREATE TABLE IF NOT EXISTS stored_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',           -- Encrypted via PlatformCipher
    totp_secret TEXT NOT NULL DEFAULT '',        -- Encrypted via PlatformCipher
    private_key_name TEXT NOT NULL DEFAULT '',
    private_key_content TEXT NOT NULL DEFAULT '', -- Encrypted via PlatformCipher
    private_key_passphrase TEXT NOT NULL DEFAULT '', -- Encrypted via PlatformCipher
    is_default INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'PASSWORD_TOTP'   -- PASSWORD_TOTP, KEY_ONLY, KEY_PASSPHRASE
);

-- 3. Connection Profiles
CREATE TABLE IF NOT EXISTS connections (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT    NOT NULL UNIQUE DEFAULT '',
    host                  TEXT    NOT NULL DEFAULT '',
    port                  INTEGER NOT NULL DEFAULT 22,
    working_dir           TEXT    NOT NULL DEFAULT '/',
    connection_type_id    INTEGER NOT NULL REFERENCES connection_types(id),
    credential_id         INTEGER REFERENCES stored_credentials(id) ON DELETE SET NULL,
    tunnel_via_connection_id INTEGER REFERENCES connections(id) ON DELETE SET NULL,
    last_used             INTEGER NOT NULL DEFAULT 0
);

-- 4. Connection Specific Display & UI Settings (Decoupled)
CREATE TABLE IF NOT EXISTS connection_settings (
    connection_id         INTEGER PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
    local_panel_collapsed INTEGER NOT NULL DEFAULT 0,
    local_sort_field      TEXT    NOT NULL DEFAULT 'Name',
    local_sort_asc        INTEGER NOT NULL DEFAULT 1,
    local_filter_text     TEXT    NOT NULL DEFAULT '',
    remote_sort_field     TEXT    NOT NULL DEFAULT 'Name',
    remote_sort_asc       INTEGER NOT NULL DEFAULT 1,
    remote_filter_text    TEXT    NOT NULL DEFAULT '',
    local_col_name        REAL    NOT NULL DEFAULT 285.0,
    local_col_size        REAL    NOT NULL DEFAULT 70.0,
    local_col_modified    REAL    NOT NULL DEFAULT 120.0,
    remote_col_name       REAL    NOT NULL DEFAULT 262.0,
    remote_col_size       REAL    NOT NULL DEFAULT 68.0,
    remote_col_modified   REAL    NOT NULL DEFAULT 120.0,
    remote_col_owner      REAL    NOT NULL DEFAULT 80.0,
    remote_col_rights     REAL    NOT NULL DEFAULT 90.0
);

-- 5. Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    pane TEXT NOT NULL DEFAULT 'REMOTE', -- LOCAL, REMOTE
    path TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    last_accessed INTEGER NOT NULL DEFAULT 0
);

-- 6. Remote Session Tabs
CREATE TABLE IF NOT EXISTS remote_tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    path TEXT NOT NULL DEFAULT '',
    tab_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 0
);

-- 7. Known Hosts Fingerprints
CREATE TABLE IF NOT EXISTS known_hosts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    host        TEXT    NOT NULL,
    port        INTEGER NOT NULL DEFAULT 22,
    key_type    TEXT    NOT NULL,
    public_key  TEXT    NOT NULL,
    fingerprint TEXT    NOT NULL,
    added_at    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (host, port, key_type)
);

-- 8. General Key-Value Application Preferences
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bookmarks_connection_pane ON bookmarks (connection_id, pane);
CREATE INDEX IF NOT EXISTS idx_remote_tabs_connection ON remote_tabs (connection_id);
CREATE INDEX IF NOT EXISTS idx_connections_credential ON connections (credential_id);
CREATE INDEX IF NOT EXISTS idx_connections_tunnel_via ON connections (tunnel_via_connection_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON connections (connection_type_id);
CREATE INDEX IF NOT EXISTS idx_stored_credentials_default ON stored_credentials (is_default);
