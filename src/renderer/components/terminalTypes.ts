import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export interface TerminalTheme {
  id: string;
  name: string;
  description: string;
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TermTab {
  id: string;
  shellId: string;
  label: string;
  username: string;
  host: string;
  sessionId: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  isConnected: boolean;
  isClosed: boolean;
}
