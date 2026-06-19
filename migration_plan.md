# SFTP Manager V2 Migration Plan & Tracker

This file tracks the step-by-step progress of migrating the Kotlin/JavaFX SFTP Manager to Electron + TypeScript + React + Vite.

---

## Phase Roadmap & Progress

### 🟩 Phase 1: Project Setup & Boilerplate (Completed)
- [x] Initialize `sftp-manager-v2` directory
- [x] Initialize a new Git repository inside `sftp-manager-v2`
- [x] Setup Electron + Vite + React + TypeScript boilerplate
- [x] Install production/development dependencies (`ssh2`, `electron`, `react`, `framer-motion`, `tailwindcss`, etc.)
- [x] Commit initial boilerplate setup

### ⬜ Phase 2: SSH Multi-Hop & MFA Logic Migration (Active)
- [ ] Implement SLF4J/Log4j style `Logger.ts` matching parent log format
- [ ] Migrate `SshConnector` (multi-hop jump proxy logic with netcat duplex stream relay)
- [ ] Migrate `SshClient` & `SshExecutor` (command execution, streams, and virtual term session wrappers)
- [ ] Migrate `SftpBrowser` (directory listings, permissions, folder stats)
- [ ] Migrate `SftpTransfer` (concurrent file & folder uploads/downloads, progress callback, cancellation)
- [ ] Create simple CLI connection test-driver (`test-connection.ts`) to compile and verify connection success
- [ ] Commit ported logic

### ⬜ Phase 3: SQLite & Authentication Strategies
- [ ] Integrate SQLite for connection profiles and state persistence
- [ ] Port Password, SSH Key, and Keyboard-Interactive Auth strategies
- [ ] Handle TOTP/MFA automatic responses in `StoredCredentialsUserInfo`
- [ ] Commit authentication and database logic

### ⬜ Phase 4: UI Screens Porting (Vite + React)
- [ ] Connection Screen (profiles manager, saved lists)
- [ ] Connection Wizard (multi-hop profile configurations step-by-step)
- [ ] Local & Remote File Explorer Screen (grid views, directory panels, drag/drop handlers)
- [ ] Settings Screen, Logging configuration, Known Hosts configuration, Help screen
- [ ] Decompiler Window (least priority)

---

## Technical Specs & Architecture Decisions

1. **TypeScript Only**: Strict compilation, no raw JS.
2. **Duplex Jump Proxy Relay**: Recreate Kotlin's `SshJumpProxy` using `ssh2` Client `exec` channel piped as a socket to the next `ssh2` hop.
3. **Structured Logs**: Custom Logger matching `[TIMESTAMP] [LEVEL] [Context] Message` formatting to ensure easy diagnostic tracing.
4. **Clean Code Comments**: No explanatory comments for what code does; comments are reserved strictly to explain the "why" behind complex hacks or API designs.
