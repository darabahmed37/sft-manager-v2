# SFTP Manager V2 Development Plan & Tracker

This is an internal private application written from scratch. We are rewriting the SFTP Manager application under `sftp-manager-v2` using Electron + TypeScript + React + Vite.

---

## Phase Roadmap & Progress

### 🟩 Phase 1: Project Setup & Boilerplate (Completed)
- [x] Initialize `sftp-manager-v2` directory
- [x] Initialize a new Git repository inside `sftp-manager-v2`
- [x] Setup Electron + Vite + React + TypeScript boilerplate
- [x] Install production/development dependencies (`ssh2`, `electron`, `react`, `framer-motion`, `tailwindcss`, etc.)
- [x] Commit initial boilerplate setup

### 🟩 Phase 2: SSH Multi-Hop & MFA Logic Implementation (Completed)
- [x] Implement SLF4J/Log4j style `Logger.ts` matching parent log format
- [x] Implement `SshConnector` (multi-hop jump proxy logic with netcat duplex stream relay)
- [x] Implement `SshClient` & `SshExecutor` (command execution, streams, and virtual term session wrappers)
- [x] Implement `SftpBrowser` (directory listings, permissions, folder stats)
- [x] Implement `SftpTransfer` (concurrent file & folder uploads/downloads, progress callback, cancellation)
- [x] Create simple CLI connection test-driver (`test-connection.ts`) to compile and verify connection success
- [x] Commit logic implementation

### 🟩 Phase 3: SQLite & Authentication Strategies (Completed)
- [x] Integrate SQLite for connection profiles and state persistence
- [x] Implement Password, SSH Key, and Keyboard-Interactive Auth strategies
- [x] Handle TOTP/MFA automatic responses in connection flows
- [x] Commit authentication and database logic

### ⬜ Phase 4: UI Screens Development (Vite + React)
- [ ] Connection Screen (profiles manager, saved lists)
- [ ] Connection Wizard (multi-hop profile configurations step-by-step)
- [ ] Local & Remote File Explorer Screen (grid views, directory panels, drag/drop handlers)
- [ ] Settings Screen, Logging configuration, Known Hosts configuration, Help screen
- [ ] Decompiler Window (least priority)

---

## Technical Specs & Architecture Decisions

1. **Written From Scratch**: Built cleanly without copy-pasting legacy baggage.
2. **TypeScript Only**: Strict compilation, no raw JS.
3. **Duplex Jump Proxy Relay**: Recreate custom `SshJumpProxy` behavior using `ssh2` Client `exec` channel piped as a socket to the next `ssh2` hop.
4. **Structured Logs**: Custom Logger matching `[TIMESTAMP] [LEVEL] [Context] Message` formatting to ensure easy diagnostic tracing.
5. **Clean Code Comments**: No explanatory comments for what code does; comments are reserved strictly to explain the "why" behind complex hacks or API designs.
