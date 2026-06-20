import React, { useEffect, useRef } from 'react';
import { WebglAddon } from '@xterm/addon-webgl';
import type { TermTab } from '../types';

interface XtermPaneProps {
  tab: TermTab;
  isActive: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const XtermPane: React.FC<XtermPaneProps> = ({ tab, isActive, onContextMenu }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const webglRef = useRef<WebglAddon | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // 1. Attach terminal to DOM
    tab.terminal.open(containerRef.current);

    // 2. Block xterm from handling shortcuts we intercept at the window level
    tab.terminal.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const isSwitchTab = e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key);
        const isAltF4 = e.altKey && e.key === 'F4';
        const isCopy = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c';
        const isPaste = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v';
        const isSelectAll = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a';
        if (isSwitchTab || isAltF4 || isCopy || isPaste || isSelectAll) return false;
      }
      return true;
    });

    // 3. Load WebGL renderer (GPU-accelerated) with DOM canvas fallback
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        webglRef.current = null;
      });
      tab.terminal.loadAddon(webgl);
      webglRef.current = webgl;
    } catch {
      // DOM renderer fallback is automatic
    }

    // 4. Initial fit via rAF so the browser has laid out the container first
    //    This prevents the common "0-column" issue on first open.
    rafRef.current = requestAnimationFrame(() => {
      tab.fitAddon.fit();
      tab.terminal.focus();
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      webglRef.current?.dispose();
      webglRef.current = null;
    };
  }, [tab]);

  useEffect(() => {
    if (!isActive) return;
    // Defer fit until after the pane is visible in the DOM
    rafRef.current = requestAnimationFrame(() => {
      tab.fitAddon.fit();
      tab.terminal.focus();
      rafRef.current = null;
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, tab]);

  return (
    <div
      ref={containerRef}
      onContextMenu={onContextMenu}
      className={`absolute inset-0 pt-1 pl-2 ${isActive ? 'block' : 'hidden'}`}
    />
  );
};

export default XtermPane;
