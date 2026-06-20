# SFTP Manager V2

SFTP Manager V2 is a modern, high-performance, and premium-designed desktop SFTP client and integrated SSH terminal emulator. Built on top of **Electron**, **React**, **TypeScript**, and **Tailwind CSS**, it delivers a seamless, native-feeling environment for managing remote servers, transferring files, and running shell commands.

---

## Key Features

### 📁 Dual-Pane File Explorer
- **Side-by-Side Panels**: Manage local files on the left and remote SFTP files on the right.
- **File Operations**: Effortlessly upload, download, rename, delete, and create folders.
- **Bookmarks**: Save frequently visited directories for both local and remote panes.

### 💻 Integrated SSH Terminal (VS Code Style)
- **Embedded Panel**: Multi-tab terminal embedded directly at the bottom of the main explorer window.
- **GPU Acceleration**: Utilizes the `@xterm/addon-webgl` renderer for ultra-low latency, GPU-powered text rendering.
- **Customizable Themes**: Choose from premium pre-built styles (Homebrew, Dracula, Monokai, Solarized Dark, GitHub Dark, Nord, One Dark).
- **Control & Resize**: Instantly toggle with `Ctrl+`` (Ctrl + Backtick) or drag the border to resize.
- **Keyboard Shortcuts**: Native clipboard copying (`Ctrl+Shift+C`), pasting (`Ctrl+Shift+V`), and fast tab switching (`Ctrl+1` through `Ctrl+9`).

### 🔗 Jump Host (Hop Chain) Routing
- Native configuration for complex SSH jump box paths.
- Duplex-stream jump host forwarding enables securely accessing internal servers through multiple intermediate gateways.

### 🔒 Enhanced Security & Credentials
- **Credential Vault**: Save connections and credentials locally.
- **2FA/MFA Support**: Integrated Google Authenticator / TOTP token generation directly inside the connection flow.
- **Interactive Verification**: Host key verification with local storage (`known_hosts` matching).

### 📝 Production-Grade File Logging
- Zero console logging in production to prevent performance degradation.
- Strict, rotating logs output to `logs/app.log` using `electron-log` for clean debugging.

---

## Supported Authentication Methods (In-Depth)

SFTP Manager V2 provides robust and secure authentication options for enterprise SSH and SFTP infrastructures, supporting standard password, public key, and multi-factor authentication (MFA) setups:

### 1. Password Authentication
- **Standard Authentication**: Supports traditional username and password credentials.
- **Secure Local Storage**: Passwords can be stored securely within the local database configurations, preventing exposure of plain credentials.

### 2. SSH Private Key Authentication
- **Key Types**: Fully compatible with common SSH key formats (including RSA, ECDSA, Ed25519, and DSA).
- **Passphrase Decryption**: If your private key is encrypted with a passphrase, SFTP Manager V2 decrypts and processes it securely during connection handshakes.
- **Direct Content Parsing**: Allows storing raw private key content directly for portability across environments.

### 3. Keyboard-Interactive Authentication
- Dynamically intercepts challenges from target servers that query inputs sequentially rather than in a single packet.

### 4. Multi-Factor Authentication (MFA / 2FA)
- **Automated TOTP Injection**: Full support for Time-based One-Time Passwords (TOTP) / Google Authenticator.
- **Dynamic Challenge Resolution**: Automatically listens to keyboard-interactive prompts containing `verification`, `totp`, `second`, `google`, or `token`.
- **Zero-Touch Login**: Generates the corresponding OTP verification code on-the-fly using the stored base32 secret and writes it directly to the SSH channel.

---


## Technology Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **State & Transitions**: [Framer Motion](https://www.framer.com/motion/)
- **Terminal**: [xterm.js](https://xtermjs.org/) (WebGL, Fit, Search, Unicode11 addons)
- **SSH/SFTP Protocol**: [ssh2](https://github.com/mscdex/ssh2)
- **Local Storage**: SQLite (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3))

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sftp-manager-v2.git
   cd sftp-manager-v2
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure native SQLite modules are built for your Electron version:
   ```bash
   npm run rebuild
   ```

### Development

Run the development environment (TypeScript compilation, Vite server, and Electron app in parallel):
```bash
npm run dev
```

### Production Build

1. Build the main process and compile frontend assets:
   ```bash
   npm run build
   ```

2. Packaging the Electron application:
   Refer to your preferred builder commands (e.g., `electron-builder` or `electron-forge`) to bundle the distribution.

---

## Directory Structure

```
├── data/                  # SQLite databases and persistent configs
├── logs/                  # Local log output (app.log)
├── scripts/               # Utility cleaner/build scripts
├── src/
│   ├── main/              # Electron Main Process (IPC, database, SSH/SFTP)
│   │   ├── config/        # Config wrappers
│   │   ├── dao/           # Data Access Objects (credentials, bookmarks, settings)
│   │   ├── ipc/           # IPC communication handlers
│   │   ├── log/           # File-only logger
│   │   └── ssh/           # SSH/SFTP client connection pool manager
│   ├── preload/           # Electron Context Bridge
│   └── renderer/          # React App Main UI Components
│       ├── components/    # File explorer, Terminal Panel, and toolbars
│       ├── App.tsx        # Main application router
│       └── index.css      # Core tailwind layers and scrollbars
└── package.json           # Scripts & package configurations
```

---

## License

This project is open-source and licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.
