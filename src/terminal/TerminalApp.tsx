import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { AnimatePresence, motion } from 'framer-motion';
import {
  VscChromeMinimize,
  VscChromeMaximize,
  VscChromeRestore,
  VscChromeClose,
  VscTerminal,
  VscAdd,
  VscCopy,
  VscClippy,
  VscTrash,
  VscSymbolColor,
  VscClose,
} from 'react-icons/vsc';

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
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  const tabsRef = useRef<TermTab[]>([]);
  const activeTabIdRef = useRef<string>('');
  const themeRef = useRef<TerminalTheme>(getThemeById(loadThemeId()));

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    themeRef.current = getThemeById(themeId);
  }, [themeId]);

  const theme = getThemeById(themeId);

  // ── Platform state initialization ──────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (api && api.window) {
      api.window.getPlatform().then((p: string) => {
        setPlatform(p);
      });
      api.window.isMaximized().then((max: boolean) => {
        setIsMaximized(max);
      });
      const unsub = api.window.onMaximizedState((_e: unknown, max: boolean) => {
        setIsMaximized(max);
      });
      return () => unsub?.();
    }
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.window.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.window.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.window.close();
  };

  // ── Close tab callback ──────────────────────────────────────────────────
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

  // ── Open SSH shell tab ───────────────────────────────────────────────────
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

    // Keystrokes → forward directly to SSH
    terminal.onData((data) => {
      if (!newTab.shellId || newTab.isClosed) return;
      window.electronAPI.terminal.writeShell(newTab.shellId, data);
    });

    // Resize → SSH
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

  // ── Keyboard Shortcuts Listener ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Switch tabs: Ctrl + 1..9
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

      // 2. Alt + F4 -> Close window
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        handleClose();
      }

      // 3. Ctrl+Shift+C -> Copy selection
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'C') {
        e.preventDefault();
        const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        if (activeTab && activeTab.terminal.hasSelection()) {
          const text = activeTab.terminal.getSelection();
          navigator.clipboard.writeText(text);
        }
      }

      // 4. Ctrl+Shift+V -> Paste selection
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'V') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
          if (activeTab && activeTab.shellId && !activeTab.isClosed) {
            window.electronAPI.terminal.writeShell(activeTab.shellId, text);
          }
        });
      }

      // 5. Ctrl+Shift+A -> Select All
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'A') {
        e.preventDefault();
        const activeTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        activeTab?.terminal.selectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Context Menu Actions ──────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  useEffect(() => {
    const handleOutsideClick = () => closeContextMenu();
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleCopy = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.terminal.hasSelection()) {
      const text = activeTab.terminal.getSelection();
      navigator.clipboard.writeText(text);
    }
    closeContextMenu();
  };

  const handlePaste = () => {
    navigator.clipboard.readText().then((text) => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab && activeTab.shellId && !activeTab.isClosed) {
        window.electronAPI.terminal.writeShell(activeTab.shellId, text);
      }
    });
    closeContextMenu();
  };

  const handleSelectAll = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    activeTab?.terminal.selectAll();
    closeContextMenu();
  };

  const handleClear = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    activeTab?.terminal.clear();
    closeContextMenu();
  };

  // ── Live theme switch ────────────────────────────────────────────────────
  const applyTheme = useCallback((newId: string) => {
    const t = getThemeById(newId);
    saveThemeId(newId);
    setThemeId(newId);
    themeRef.current = t;
    tabsRef.current.forEach((tab) => {
      tab.terminal.options.theme = xtermTheme(t);
    });
  }, []);

  // ── SSH data → xterm ─────────────────────────────────────────────────────
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

  // ── Shell close event → Auto Close Tab ────────────────────────────────────
  useEffect(() => {
    const unsub = window.electronAPI.terminal.onShellClose(
      (_e: unknown, shellId: string) => {
        const tab = tabsRef.current.find((t) => t.shellId === shellId);
        if (tab) {
          closeTab(tab.id);
        }
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
    ? '⚠ Disconnected'
    : activeTab.isConnected
    ? `● Connected · ${activeTab.label}`
    : '◉ Connecting...';

  const isTextSelected = !!activeTab?.terminal.hasSelection();

  return (
    <div className="w-screen h-screen flex flex-col bg-[#1a1a1a] text-sm overflow-hidden select-none font-sans relative">
      {/* ── Tab Bar / Integrated Titlebar ── */}
      <header
        className="h-[35px] bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center justify-start shrink-0 overflow-hidden"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {platform === 'darwin' && (
          // macOS spacer for native Traffic Lights
          <div
            className="w-[80px] h-full shrink-0"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          />
        )}

        {/* Tabs area */}
        <div
          className={`flex items-end h-full flex-1 overflow-hidden ${platform !== 'darwin' ? 'pl-4' : ''}`}
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const dotColor = tab.isClosed ? '#f14c4c' : tab.isConnected ? '#4ec9b0' : '#cca700';
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.label}
                className={`h-[31px] px-3 flex items-center gap-1.5 cursor-pointer shrink-0 border-r border-[#2d2d2d] border-t-2 transition-all duration-150 ${
                  isActive
                    ? 'border-t-[#29abee] bg-[#252526] text-[#cccccc]'
                    : 'border-t-transparent text-[#6e6e6e] hover:bg-[#2a2d2e] hover:text-[#ababab]'
                }`}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <VscTerminal className={`w-3.5 h-3.5 ${isActive ? 'text-[#29abee]' : ''}`} />
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: dotColor,
                    boxShadow:
                      tab.isConnected && !tab.isClosed ? `0 0 4px ${dotColor}` : 'none',
                  }}
                />
                <span className="max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                  {tab.label}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 w-4 h-4 rounded-[3px] border-none bg-transparent text-[#6e6e6e] hover:bg-[#f14c4c30] hover:text-[#f14c4c] cursor-pointer flex items-center justify-center text-xs outline-none"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  <VscClose className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={newTab}
            title="New terminal tab"
            className="w-[30px] h-[30px] bg-transparent border-none text-[#6e6e6e] hover:text-[#cccccc] cursor-pointer flex items-center justify-center shrink-0 self-center outline-none"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <VscAdd className="w-4 h-4" />
          </button>
        </div>

        {/* Windows / Linux Custom Control Buttons */}
        {platform !== 'darwin' && (
          <div
            className="flex items-center h-full shrink-0 ml-auto"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {/* Minimize */}
            <button
              onClick={handleMinimize}
              title="Minimize"
              className="w-[45px] h-full border-none bg-transparent text-[#888] hover:bg-[#2d2d2d] hover:text-white cursor-pointer flex items-center justify-center outline-none transition-colors duration-150"
            >
              <VscChromeMinimize className="w-3.5 h-3.5" />
            </button>
            {/* Maximize */}
            <button
              onClick={handleMaximize}
              title={isMaximized ? 'Restore' : 'Maximize'}
              className="w-[45px] h-full border-none bg-transparent text-[#888] hover:bg-[#2d2d2d] hover:text-white cursor-pointer flex items-center justify-center outline-none transition-colors duration-150"
            >
              {isMaximized ? (
                <VscChromeRestore className="w-3.5 h-3.5" />
              ) : (
                <VscChromeMaximize className="w-3.5 h-3.5" />
              )}
            </button>
            {/* Close */}
            <button
              onClick={handleClose}
              title="Close"
              className="w-[45px] h-full border-none bg-transparent text-[#888] hover:bg-[#e81123] hover:text-white cursor-pointer flex items-center justify-center outline-none transition-colors duration-150"
            >
              <VscChromeClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* ── Terminal Content ── */}
      <main
        className="flex-1 relative overflow-hidden"
        style={{ backgroundColor: theme.background }}
      >
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#444] gap-3">
            <VscTerminal className="w-[52px] h-[52px] stroke-[0.7]" />
            <span className="text-xs">No terminal tabs</span>
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
      <footer className="h-[22px] bg-[#007acc] text-white flex items-center px-4 gap-2.5 shrink-0">
        <VscTerminal className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold">SSH Terminal</span>
        {statusText && <span className="text-[11px] opacity-75">· {statusText}</span>}
        <div className="flex-1" />

        {/* Theme Picker Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker((p) => !p)}
            title="Change terminal color theme"
            className={`border-none rounded-[3px] cursor-pointer px-1.5 py-0.5 flex items-center gap-1.5 outline-none transition-colors duration-150 ${
              showThemePicker ? 'bg-white/15' : 'bg-transparent hover:bg-white/12'
            }`}
          >
            <VscSymbolColor className="w-3.5 h-3.5" style={{ color: theme.cyan }} />
            <span className="text-[11px] text-white/85">{theme.name}</span>
          </button>
          <AnimatePresence>
            {showThemePicker && (
              <ThemePicker
                currentThemeId={themeId}
                onSelect={applyTheme}
                onClose={() => setShowThemePicker(false)}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="w-[1px] h-2.5 bg-white/20" />
        <span className="text-[11px] text-white/60">
          {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
        </span>
      </footer>

      {/* ── Custom Context Menu (Rendered at root level to prevent offset) ── */}
      <AnimatePresence>
        {contextMenu && contextMenu.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="absolute z-[2000] w-48 bg-[#252526] border border-[#3c3c3c] rounded-md shadow-2xl py-1 select-none text-xs"
          >
            <button
              onClick={handleCopy}
              disabled={!isTextSelected}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#cccccc] hover:bg-[#37373d] disabled:opacity-40 disabled:hover:bg-transparent outline-none border-none cursor-pointer"
            >
              <VscCopy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <button
              onClick={handlePaste}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#cccccc] hover:bg-[#37373d] outline-none border-none cursor-pointer"
            >
              <VscClippy className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>
            <div className="border-t border-[#3c3c3c] my-1" />
            <button
              onClick={handleSelectAll}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#cccccc] hover:bg-[#37373d] outline-none border-none cursor-pointer"
            >
              <span>Select All</span>
            </button>
            <button
              onClick={handleClear}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#cccccc] hover:bg-[#37373d] outline-none border-none cursor-pointer"
            >
              <VscTrash className="w-3.5 h-3.5" />
              <span>Clear Terminal</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalApp;
