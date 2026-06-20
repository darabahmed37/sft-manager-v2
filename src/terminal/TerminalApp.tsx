import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
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

import type { TermTab, TerminalTheme } from './types';
import {
  getThemeById,
  loadThemeId,
  saveThemeId,
  xtermTheme,
} from './themes';
import ThemePicker from './components/ThemePicker';
import XtermPane from './components/XtermPane';
import '@xterm/xterm/css/xterm.css';

// ── Utility: darken a hex color by a given factor ──────────────────────────────
function darkenHex(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * factor));
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * factor));
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Utility: compute a readable symbol color from background brightness ────────
function symbolColorFor(bgHex: string): string {
  const h = bgHex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#333333' : '#a0aec0';
}

function createTerminalInstance(theme: TerminalTheme): {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
} {
  const terminal = new Terminal({
    theme: xtermTheme(theme),
    fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace',
    fontSize: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 5000,
    allowTransparency: false,
    convertEol: false,
  });
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(searchAddon);
  return { terminal, fitAddon, searchAddon };
}

const TerminalApp: React.FC = () => {
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [themeId, setThemeId] = useState<string>(loadThemeId);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [platform, setPlatform] = useState<string>('win32');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  const tabsRef = useRef<TermTab[]>([]);
  const activeTabIdRef = useRef<string>('');
  const themeRef = useRef<TerminalTheme>(getThemeById(loadThemeId()));

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

  // ── Platform state initialization ──────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (api && api.window) {
      api.window.getPlatform().then((p: string) => setPlatform(p));
    }
  }, []);

  // ── Sync overlay color with terminal theme ────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (api?.terminal?.setOverlayColor && platform === 'win32') {
      const sym = symbolColorFor(chromeBg);
      api.terminal.setOverlayColor(chromeBg, sym);
    }
  }, [themeId, chromeBg, platform]);

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
      window.electronAPI?.window.close();
    }
  }, []);

  // ── Open SSH shell tab ────────────────────────────────────────────────────
  const openShell = useCallback(async (sessionId: string, username: string, host: string) => {
    const { terminal, fitAddon } = createTerminalInstance(themeRef.current);
    const tabId = `tab-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const label = `${username}@${host}`;

    let shellId = '';
    try {
      const res = await window.electronAPI.terminal.openShell(sessionId, tabId);
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
      username,
      host,
      sessionId,
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
  }, []);

  const newTab = useCallback(() => {
    const ref = tabsRef.current[0];
    if (ref) openShell(ref.sessionId, ref.username, ref.host);
  }, [openShell]);

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (e.altKey && e.key === 'F4') { e.preventDefault(); window.electronAPI?.window.close(); }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'C') {
        e.preventDefault();
        const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        if (activeTab?.terminal.hasSelection()) navigator.clipboard.writeText(activeTab.terminal.getSelection());
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'V') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
          if (activeTab?.shellId && !activeTab.isClosed)
            window.electronAPI.terminal.writeShell(activeTab.shellId, text);
        });
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        e.preventDefault();
        tabsRef.current.find((t) => t.id === activeTabIdRef.current)?.terminal.selectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    if (activeTab?.terminal.hasSelection()) navigator.clipboard.writeText(activeTab.terminal.getSelection());
    closeContextMenu();
  };
  const handlePaste = () => {
    navigator.clipboard.readText().then((text) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab?.shellId && !activeTab.isClosed)
        window.electronAPI.terminal.writeShell(activeTab.shellId, text);
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
    saveThemeId(newId);
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

  // ── IPC: open new tab from main process ──────────────────────────────────
  useEffect(() => {
    const unsub = window.electronAPI.terminal.onOpenTab(
      (_e: unknown, sessionId: string, username: string, host: string) =>
        openShell(sessionId, username, host)
    );
    return () => unsub?.();
  }, [openShell]);

  // ── Initial shell from URL params ─────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sessionId = p.get('sessionId') || '';
    const username = p.get('username') || '';
    const host = p.get('host') || '';
    if (sessionId && username && host) openShell(sessionId, username, host);
  }, [openShell]);

  // ── Resize active terminal on window resize ───────────────────────────────
  useEffect(() => {
    const onResize = () =>
      tabsRef.current.find((t) => t.id === activeTabIdRef.current)?.fitAddon.fit();
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

  // ── Status dot color ──────────────────────────────────────────────────────
  const dotColor = !activeTab
    ? 'transparent'
    : activeTab.isClosed
    ? '#fc5c5c'
    : activeTab.isConnected
    ? '#4eca96'
    : '#f6ad4f';

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden select-none font-sans relative"
      style={{ backgroundColor: theme.background, color: theme.foreground }}
    >
      {/* ── Tab Bar / Integrated Titlebar ── */}
      <header
        className="flex items-end shrink-0 overflow-hidden"
        style={{
          height: '40px',
          backgroundColor: tabBarBg,
          borderBottom: `1px solid ${borderColor}`,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        {platform === 'darwin' && (
          <div
            className="w-[80px] h-full shrink-0"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          />
        )}

        {/* Tabs area */}
        <div
          className="flex items-end h-full flex-1 overflow-hidden pl-2"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {tabs.map((tab, i) => {
            const isActive = tab.id === activeTabId;
            const tabDot = tab.isClosed ? '#fc5c5c' : tab.isConnected ? '#4eca96' : '#f6ad4f';
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.label}
                className="flex items-center gap-1.5 cursor-pointer shrink-0 transition-all duration-150 relative"
                style={{
                  height: '34px',
                  maxWidth: '200px',
                  minWidth: '100px',
                  paddingLeft: '12px',
                  paddingRight: '6px',
                  marginRight: '2px',
                  borderRadius: '6px 6px 0 0',
                  backgroundColor: isActive ? activeBg : 'transparent',
                  borderTop: isActive ? `1.5px solid ${borderColor}` : '1.5px solid transparent',
                  borderLeft: isActive ? `1px solid ${borderColor}` : '1px solid transparent',
                  borderRight: isActive ? `1px solid ${borderColor}` : '1px solid transparent',
                  boxShadow: isActive ? `inset 0 2px 0 ${accentColor}` : 'none',
                  WebkitAppRegion: 'no-drag',
                } as React.CSSProperties}
              >
                <VscTerminal
                  size={12}
                  style={{ color: isActive ? accentColor : `${theme.foreground}66`, flexShrink: 0 }}
                />
                {/* Connection dot */}
                <div
                  className="rounded-full shrink-0"
                  style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: tabDot,
                    boxShadow: tab.isConnected && !tab.isClosed ? `0 0 5px ${tabDot}` : 'none',
                  }}
                />
                <span
                  className="overflow-hidden text-ellipsis whitespace-nowrap flex-1"
                  style={{
                    fontSize: '11.5px',
                    color: isActive ? theme.foreground : `${theme.foreground}77`,
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {i + 1}. {tab.label}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="flex items-center justify-center rounded shrink-0 border-none cursor-pointer outline-none transition-all duration-150"
                  title="Close tab"
                  style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: 'transparent',
                    color: `${theme.foreground}55`,
                    WebkitAppRegion: 'no-drag',
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fc5c5c33';
                    (e.currentTarget as HTMLButtonElement).style.color = '#fc5c5c';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = `${theme.foreground}55`;
                  }}
                >
                  <LuX size={10} />
                </button>
              </div>
            );
          })}

          {/* New tab button */}
          <button
            onClick={newTab}
            title="New terminal tab (same connection)"
            className="flex items-center justify-center border-none cursor-pointer outline-none transition-all duration-150 shrink-0 rounded self-center ml-1"
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'transparent',
              color: `${theme.foreground}55`,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}22`;
              (e.currentTarget as HTMLButtonElement).style.color = accentColor;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = `${theme.foreground}55`;
            }}
          >
            <VscAdd size={14} />
          </button>
        </div>

        {/* On Windows, reserve right space for native overlay (138px = approx control strip width) */}
        {platform !== 'darwin' && (
          <div
            className="shrink-0"
            style={{ width: '138px', WebkitAppRegion: 'drag' } as React.CSSProperties}
          />
        )}
      </header>

      {/* ── Terminal Content ── */}
      <main
        className="flex-1 relative overflow-hidden"
        style={{ backgroundColor: theme.background }}
      >
        {tabs.length === 0 ? (
          // ── Empty State ──
          <div
            className="flex flex-col items-center justify-center h-full gap-5"
            style={{ color: `${theme.foreground}44` }}
          >
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: `${accentColor}18`,
                border: `1px solid ${accentColor}33`,
              }}
            >
              <VscTerminal size={32} style={{ color: `${accentColor}99` }} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span style={{ fontSize: '13px', color: `${theme.foreground}66`, fontWeight: 500 }}>
                No terminal sessions
              </span>
              <span style={{ fontSize: '11px', color: `${theme.foreground}33` }}>
                A session opens automatically when you arrive here
              </span>
            </div>
            <div
              className="flex flex-col gap-2 mt-1 rounded-xl px-5 py-3"
              style={{
                backgroundColor: `${theme.foreground}08`,
                border: `1px solid ${theme.foreground}12`,
              }}
            >
              {[
                ['Ctrl+Shift+C', 'Copy selection'],
                ['Ctrl+Shift+V', 'Paste'],
                ['Ctrl+Shift+A', 'Select all'],
                ['Ctrl+1-9', 'Switch tabs'],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center gap-3" style={{ fontSize: '11px' }}>
                  <LuKeyboard size={12} style={{ color: `${accentColor}77`, flexShrink: 0 }} />
                  <kbd
                    className="rounded px-1.5 py-0.5 font-mono"
                    style={{
                      fontSize: '10px',
                      backgroundColor: `${theme.foreground}10`,
                      color: accentColor,
                      border: `1px solid ${theme.foreground}20`,
                    }}
                  >
                    {k}
                  </kbd>
                  <span style={{ color: `${theme.foreground}44` }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <XtermPane
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </main>

      {/* ── Status Bar ── */}
      <footer
        className="flex items-center px-4 gap-2.5 shrink-0"
        style={{
          height: '28px',
          background: `linear-gradient(90deg, ${chromeBg} 0%, ${darkenHex(chromeBg, 0.9)} 100%)`,
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className="rounded-full"
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: dotColor,
              boxShadow: activeTab?.isConnected && !activeTab?.isClosed ? `0 0 6px ${dotColor}` : 'none',
            }}
          />
          <span style={{ fontSize: '11px', color: `${theme.foreground}aa`, fontWeight: 500 }}>
            {activeTab?.isClosed
              ? 'Disconnected'
              : activeTab?.isConnected
              ? statusText
              : activeTab
              ? 'Connecting…'
              : 'SSH Terminal'}
          </span>
        </div>

        <div className="flex-1" />

        {/* Tab count pill */}
        {tabs.length > 0 && (
          <span
            className="flex items-center justify-center rounded-full px-2"
            style={{
              fontSize: '10px',
              height: '16px',
              backgroundColor: `${theme.foreground}12`,
              color: `${theme.foreground}66`,
              fontWeight: 500,
            }}
          >
            {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
          </span>
        )}

        <div
          style={{ width: '1px', height: '12px', backgroundColor: `${theme.foreground}20` }}
        />

        {/* Theme Picker Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker((p) => !p)}
            title="Change terminal color theme"
            className="flex items-center gap-1.5 border-none cursor-pointer outline-none transition-all duration-150 rounded-md px-2"
            style={{
              height: '20px',
              backgroundColor: showThemePicker ? `${theme.foreground}18` : 'transparent',
              color: `${theme.foreground}77`,
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              if (!showThemePicker)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${theme.foreground}12`;
            }}
            onMouseLeave={(e) => {
              if (!showThemePicker)
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <VscSymbolColor size={12} style={{ color: accentColor }} />
            <span style={{ fontSize: '11px' }}>{theme.name}</span>
          </button>
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
        </div>
      </footer>

      {/* ── Custom Context Menu ── */}
      <AnimatePresence>
        {contextMenu && contextMenu.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: chromeBg,
              border: `1px solid ${borderColor}`,
              backdropFilter: 'blur(12px)',
            }}
            className="absolute z-[2000] w-48 rounded-lg shadow-2xl py-1.5 select-none overflow-hidden"
          >
            {[
              { label: 'Copy', icon: <VscCopy size={13} />, action: handleCopy, disabled: !isTextSelected },
              { label: 'Paste', icon: <VscClippy size={13} />, action: handlePaste, disabled: false },
            ].map(({ label, icon, action, disabled }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-left border-none cursor-pointer outline-none transition-colors duration-100"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: disabled ? `${theme.foreground}33` : `${theme.foreground}cc`,
                }}
                onMouseEnter={(e) => {
                  if (!disabled)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}18`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ color: disabled ? `${theme.foreground}22` : `${accentColor}99` }}>{icon}</span>
                <span>{label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: `${theme.foreground}33` }}>
                  {label === 'Copy' ? 'Ctrl+Shift+C' : 'Ctrl+Shift+V'}
                </span>
              </button>
            ))}

            <div style={{ height: '1px', backgroundColor: `${theme.foreground}15`, margin: '4px 8px' }} />

            {[
              { label: 'Select All', icon: null, action: handleSelectAll },
              { label: 'Clear Terminal', icon: <VscTrash size={13} />, action: handleClear },
            ].map(({ label, icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="w-full px-3 py-1.5 flex items-center gap-2.5 text-left border-none cursor-pointer outline-none transition-colors duration-100"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: `${theme.foreground}cc`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}18`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {icon && <span style={{ color: `${accentColor}99` }}>{icon}</span>}
                {!icon && <span style={{ width: '13px' }} />}
                <span>{label}</span>
                {label === 'Select All' && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: `${theme.foreground}33` }}>
                    Ctrl+Shift+A
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalApp;
