import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { AnimatePresence, motion } from 'framer-motion';
import {
  VscTerminal,
  VscAdd,
  VscCopy,
  VscClippy,
  VscTrash,
  VscSymbolColor,
} from 'react-icons/vsc';
import { LuX, LuKeyboard } from 'react-icons/lu';

import type { TermTab, TerminalTheme } from './terminalTypes';
import {
  getThemeById,
  xtermTheme,
  TERMINAL_THEMES
} from './terminalThemes';
import ThemePicker from './ThemePicker';
import XtermPane from './XtermPane';
import '@xterm/xterm/css/xterm.css';

// ── Utility: darken a hex color by a given factor ──────────────────────────────
function darkenHex(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * factor));
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * factor));
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Mapping DB value to Theme ID ───────────────────────────────────────────────
function getThemeIdFromDbValue(val: string): string {
  const v = val.toLowerCase();
  if (v.includes('homebrew')) return 'homebrew';
  if (v.includes('solarized')) return 'solarized-dark';
  if (v.includes('monokai')) return 'monokai';
  if (v.includes('dracula')) return 'dracula';
  if (v.includes('github')) return 'github-dark';
  if (v.includes('nord')) return 'nord';
  if (v.includes('one-dark')) return 'one-dark';
  return 'homebrew'; // fallback
}

interface TerminalPanelProps {
  sessionId: string;
  username: string;
  host: string;
  isOpen: boolean;
  onClose: () => void;
  height: number;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  sessionId,
  username,
  host,
  isOpen,
  onClose,
  height,
}) => {
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [themeId, setThemeId] = useState<string>('homebrew');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  // Terminal Settings
  const [fontFamily, setFontFamily] = useState('"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace');
  const [fontSize, setFontSize] = useState(13);
  const [fontWeight, setFontWeight] = useState('normal');

  const tabsRef = useRef<TermTab[]>([]);
  const activeTabIdRef = useRef<string>('');
  const themeRef = useRef<TerminalTheme>(getThemeById('homebrew'));

  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { themeRef.current = getThemeById(themeId); }, [themeId]);

  const theme = getThemeById(themeId);

  // Derive chrome colors from the terminal theme
  const chromeBg = darkenHex(theme.background, 0.7);
  const tabBarBg = darkenHex(theme.background, 0.85);
  const activeBg = theme.background;
  const borderColor = darkenHex(theme.background, 0.55);
  const accentColor = theme.cyan || theme.blue || '#29ABEE';

  // ── Load Settings on Open ──────────────────────────────────────────────────
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const ff = await window.electronAPI.settings.getSetting('terminal.font.family', 'Cascadia Code');
        const fsVal = await window.electronAPI.settings.getSetting('terminal.font.size', '13');
        const fw = await window.electronAPI.settings.getSetting('terminal.font.weight', 'normal');
        const themeVal = await window.electronAPI.settings.getSetting('terminal.theme.dark', 'Homebrew');
        
        setFontFamily(ff);
        setFontSize(parseInt(fsVal, 10) || 13);
        setFontWeight(fw);
        setThemeId(getThemeIdFromDbValue(themeVal));
      } catch {}
    };

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // ── Create a Terminal Instance ─────────────────────────────────────────────
  const createTerminalInstance = useCallback((currentTheme: TerminalTheme): {
    terminal: Terminal;
    fitAddon: FitAddon;
    searchAddon: SearchAddon;
  } => {
    const terminal = new Terminal({
      allowProposedApi: true,
      theme: xtermTheme(currentTheme),
      fontFamily: fontFamily.includes(',') ? fontFamily : `"${fontFamily}", "Fira Code", "JetBrains Mono", monospace`,
      fontSize: fontSize,
      fontWeight: fontWeight as 'normal' | 'bold',
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 50000,
      allowTransparency: false,
      convertEol: false,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      scrollSensitivity: 2,
      overviewRulerWidth: 8,
      minimumContrastRatio: 1,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(unicode11Addon);

    terminal.unicode.activeVersion = '11';

    return { terminal, fitAddon, searchAddon };
  }, [fontFamily, fontSize, fontWeight]);

  // ── Close tab callback ────────────────────────────────────────────────────
  const closeTab = useCallback((tabId: string) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab) return;
    if (tab.shellId && !tab.isClosed) {
      window.electronAPI.terminal.closeShell(tab.shellId);
    }
    tab.terminal.dispose();
    const remaining = tabsRef.current.filter((t) => t.id !== tabId);
    setTabs(remaining);
    tabsRef.current = remaining;
    
    if (activeTabIdRef.current === tabId) {
      const nextId = remaining.length > 0 ? remaining[remaining.length - 1].id : '';
      setActiveTabId(nextId);
      activeTabIdRef.current = nextId;
    }
    
    if (remaining.length === 0) {
      onClose();
    }
  }, [onClose]);

  // ── Open SSH shell tab ────────────────────────────────────────────────────
  const openShell = useCallback(async (targetSessionId: string, targetUsername: string, targetHost: string) => {
    const activeTheme = themeRef.current;
    const { terminal, fitAddon } = createTerminalInstance(activeTheme);
    const tabId = `tab-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const label = `${targetUsername}@${targetHost}`;

    let shellId = '';
    try {
      const res = await window.electronAPI.terminal.openShell(targetSessionId, tabId);
      if (!res.success) {
        terminal.write(`\r\n\x1b[31mFailed to open shell: ${res.error}\x1b[0m\r\n`);
      } else {
        shellId = res.shellId;
      }
    } catch (err: unknown) {
      terminal.write(`\r\n\x1b[31mError: ${(err as Error).message}\x1b[0m\r\n`);
    }

    const newTab: TermTab = {
      id: tabId,
      shellId,
      label,
      username: targetUsername,
      host: targetHost,
      sessionId: targetSessionId,
      terminal,
      fitAddon,
      isConnected: !!shellId,
      isClosed: false,
    };

    terminal.onData((data) => {
      if (!newTab.shellId || newTab.isClosed) return;
      window.electronAPI.terminal.writeShell(newTab.shellId, data);
    });

    terminal.onResize(({ cols, rows }) => {
      if (!newTab.shellId || newTab.isClosed) return;
      window.electronAPI.terminal.resizeShell(newTab.shellId, cols, rows);
    });

    setTabs((prev) => {
      const u = [...prev, newTab];
      tabsRef.current = u;
      return u;
    });
    setActiveTabId(tabId);
    activeTabIdRef.current = tabId;
  }, [createTerminalInstance]);

  // ── New tab with active connection ─────────────────────────────────────────
  const newTab = useCallback(() => {
    if (sessionId && username && host) {
      openShell(sessionId, username, host);
    }
  }, [sessionId, username, host, openShell]);

  // ── Auto open first tab on open ────────────────────────────────────────────
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasAutoOpenedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && tabs.length === 0 && sessionId && username && host && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      openShell(sessionId, username, host);
    }
  }, [isOpen, tabs.length, sessionId, username, host, openShell]);

  // ── Clean up all shells on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      tabsRef.current.forEach((t) => {
        if (t.shellId && !t.isClosed) {
          window.electronAPI.terminal.closeShell(t.shellId);
        }
        t.terminal.dispose();
      });
    };
  }, []);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          setTabs((currentTabs) => {
            if (currentTabs.length >= num) {
              const targetTab = currentTabs[num - 1];
              setActiveTabId(targetTab.id);
              activeTabIdRef.current = targetTab.id;
            }
            return currentTabs;
          });
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'C') {
        e.preventDefault();
        const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        if (activeTab?.terminal.hasSelection()) {
          navigator.clipboard.writeText(activeTab.terminal.getSelection());
        }
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'V') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
          if (activeTab?.shellId && !activeTab.isClosed) {
            window.electronAPI.terminal.writeShell(activeTab.shellId, text);
          }
        });
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        e.preventDefault();
        tabsRef.current.find((t) => t.id === activeTabIdRef.current)?.terminal.selectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ── Context Menu ──────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  };
  const closeContextMenu = () => setContextMenu(null);
  useEffect(() => {
    const h = () => closeContextMenu();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  const handleCopy = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab?.terminal.hasSelection()) {
      navigator.clipboard.writeText(activeTab.terminal.getSelection());
    }
    closeContextMenu();
  };
  const handlePaste = () => {
    navigator.clipboard.readText().then((text) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab?.shellId && !activeTab.isClosed) {
        window.electronAPI.terminal.writeShell(activeTab.shellId, text);
      }
    });
    closeContextMenu();
  };
  const handleSelectAll = () => {
    tabs.find((t) => t.id === activeTabId)?.terminal.selectAll();
    closeContextMenu();
  };
  const handleClear = () => {
    tabs.find((t) => t.id === activeTabId)?.terminal.clear();
    closeContextMenu();
  };

  // ── Live theme switch ─────────────────────────────────────────────────────
  const applyTheme = useCallback((newId: string) => {
    const t = getThemeById(newId);
    setThemeId(newId);
    themeRef.current = t;
    tabsRef.current.forEach((tab) => {
      tab.terminal.options.theme = xtermTheme(t);
    });
  }, []);

  // ── SSH data → xterm ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = window.electronAPI.terminal.onShellData(
      (_e: unknown, shellId: string, data: string) => {
        const tab = tabsRef.current.find((t) => t.shellId === shellId);
        if (!tab) return;
        tab.terminal.write(data);
      }
    );
    return () => unsub?.();
  }, []);

  // ── Shell close → auto close tab ─────────────────────────────────────────
  useEffect(() => {
    const unsub = window.electronAPI.terminal.onShellClose(
      (_e: unknown, shellId: string) => {
        const tab = tabsRef.current.find((t) => t.shellId === shellId);
        if (tab) closeTab(tab.id);
      }
    );
    return () => unsub?.();
  }, [closeTab]);

  // ── Resize active terminal on panel size changes ──────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      const timer = setTimeout(() => {
        try {
          activeTab.fitAddon.fit();
          activeTab.terminal.focus();
        } catch {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [height, activeTabId, isOpen, tabs]);

  // Window resize observer
  useEffect(() => {
    const onResize = () => {
      tabsRef.current.find((t) => t.id === activeTabIdRef.current)?.fitAddon.fit();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const statusText = !activeTab
    ? ''
    : activeTab.isClosed
    ? 'Disconnected'
    : activeTab.isConnected
    ? activeTab.label
    : 'Connecting...';

  const isTextSelected = !!activeTab?.terminal.hasSelection();

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col overflow-hidden select-none font-sans relative border-t border-[var(--border-color)] shrink-0 theme-transition"
      style={{
        height: `${height}px`,
        backgroundColor: theme.background,
        color: theme.foreground,
      }}
    >
      {/* ── Tab Bar / Panel Header ── */}
      <header
        className="flex items-end shrink-0 overflow-hidden select-none"
        style={{
          height: '35px',
          backgroundColor: tabBarBg,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {/* Tabs area */}
        <div className="flex items-end h-full flex-1 overflow-x-auto overflow-y-hidden pl-2">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabDot = tab.isClosed ? '#fc5c5c' : tab.isConnected ? '#4eca96' : '#f6ad4f';
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.label}
                className="flex items-center gap-1.5 cursor-pointer shrink-0 transition-all duration-150 relative"
                style={{
                  height: '30px',
                  padding: '0 12px',
                  backgroundColor: isActive ? activeBg : 'transparent',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                  opacity: isActive ? 1 : 0.65,
                }}
              >
                {/* Status Dot */}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: tabDot,
                    boxShadow: !tab.isConnected && !tab.isClosed ? `0 0 4px ${tabDot}` : 'none',
                  }}
                />

                {/* Tab Label */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isActive ? 600 : 400,
                    color: theme.foreground,
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </span>

                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="bg-transparent border-none p-0.5 cursor-pointer flex items-center justify-center rounded hover:bg-black/20 text-[10px] shrink-0"
                  style={{ color: theme.foreground, opacity: 0.6 }}
                >
                  <LuX size={10} />
                </button>
              </div>
            );
          })}

          {/* Add Tab Button */}
          <button
            onClick={newTab}
            title="Open New Tab"
            className="flex items-center justify-center bg-transparent border-none cursor-pointer rounded-full ml-1 mb-1 transition-all"
            style={{
              width: '24px',
              height: '24px',
              color: theme.foreground,
              opacity: 0.6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <VscAdd size={14} />
          </button>
        </div>

        {/* Panel controls (right-side) */}
        <div className="flex items-center gap-1.5 h-full px-2.5">
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            title="Switch Theme"
            className="flex items-center justify-center bg-transparent border-none cursor-pointer rounded transition-all"
            style={{
              width: '26px',
              height: '26px',
              color: theme.foreground,
              opacity: 0.6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <VscSymbolColor size={15} />
          </button>

          {/* Close Panel Button */}
          <button
            onClick={onClose}
            title="Close Terminal Panel"
            className="flex items-center justify-center bg-transparent border-none cursor-pointer rounded transition-all font-bold"
            style={{
              width: '26px',
              height: '26px',
              color: theme.foreground,
              opacity: 0.6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <LuX size={15} />
          </button>
        </div>
      </header>

      {/* ── Theme Picker Overlay ── */}
      <AnimatePresence>
        {showThemePicker && (
          <ThemePicker
            currentThemeId={themeId}
            onSelect={applyTheme}
            onClose={() => setShowThemePicker(false)}
            accentColor={accentColor}
            chromeBg={chromeBg}
            borderColor={borderColor}
            foreground={theme.foreground}
          />
        )}
      </AnimatePresence>

      {/* ── Active Terminal Pane ── */}
      <div className="flex-1 min-h-0 relative select-text" style={{ backgroundColor: theme.background }}>
        {tabs.map((tab) => (
          <XtermPane
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      {/* ── Status Bar / Accent Info line ── */}
      <footer
        className="h-5 flex items-center px-3.5 select-none shrink-0 gap-3 text-[10px] font-semibold tracking-wide uppercase opacity-75 justify-between"
        style={{
          backgroundColor: tabBarBg,
          borderTop: `1px solid ${borderColor}`,
          color: theme.foreground,
        }}
      >
        <div className="flex items-center gap-1.5">
          <VscTerminal size={11} style={{ color: accentColor }} />
          <span>{statusText}</span>
        </div>
        <div className="flex items-center gap-3">
          {isTextSelected && (
            <span style={{ color: accentColor, textTransform: 'none' }}>text selected</span>
          )}
          <span>xterm.js GPU WebGL</span>
        </div>
      </footer>

      {/* ── Context Menu ── */}
      {contextMenu?.visible && (
        <div
          className="absolute z-[10000] w-48 rounded-lg shadow-2xl border py-1 select-none flex flex-col"
          style={{
            top: contextMenu.y - (window.innerHeight - height - 10), // position relative to terminal container
            left: contextMenu.x,
            backgroundColor: chromeBg,
            borderColor: borderColor,
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={handleCopy}
            className="px-3.5 py-1.5 text-xs text-left cursor-pointer flex items-center justify-between border-none bg-transparent hover:bg-white/5 transition-all text-white"
          >
            <span className="flex items-center gap-2">
              <VscCopy size={13} style={{ opacity: 0.6 }} /> Copy
            </span>
            <span style={{ fontSize: '9px', opacity: 0.4 }}>Ctrl+Shift+C</span>
          </button>

          <button
            onClick={handlePaste}
            className="px-3.5 py-1.5 text-xs text-left cursor-pointer flex items-center justify-between border-none bg-transparent hover:bg-white/5 transition-all text-white"
          >
            <span className="flex items-center gap-2">
              <VscClippy size={13} style={{ opacity: 0.6 }} /> Paste
            </span>
            <span style={{ fontSize: '9px', opacity: 0.4 }}>Ctrl+Shift+V</span>
          </button>

          <div className="h-[1px] my-1" style={{ backgroundColor: borderColor }} />

          <button
            onClick={handleSelectAll}
            className="px-3.5 py-1.5 text-xs text-left cursor-pointer flex items-center justify-between border-none bg-transparent hover:bg-white/5 transition-all text-white"
          >
            <span className="flex items-center gap-1.5">
              <LuKeyboard size={13} style={{ opacity: 0.6 }} /> Select All
            </span>
            <span style={{ fontSize: '9px', opacity: 0.4 }}>Ctrl+Shift+A</span>
          </button>

          <button
            onClick={handleClear}
            className="px-3.5 py-1.5 text-xs text-left cursor-pointer flex items-center justify-between border-none bg-transparent hover:bg-white/5 transition-all text-white"
          >
            <span className="flex items-center gap-2 text-red-400">
              <VscTrash size={13} style={{ opacity: 0.8 }} /> Clear Scrollback
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
