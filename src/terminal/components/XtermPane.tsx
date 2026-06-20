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

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // 1. Attach terminal to DOM
    tab.terminal.open(containerRef.current);

    // 2. Attach custom key handler for shortcuts bypass (tab switches, alt+f4, copy, paste, select all)
    tab.terminal.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const isSwitchTab = e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key);
        const isAltF4 = e.altKey && e.key === 'F4';
        const isCopy = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c';
        const isPaste = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v';
        const isSelectAll = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a';

        if (isSwitchTab || isAltF4 || isCopy || isPaste || isSelectAll) {
          return false; // let the window.keydown handler take care of it!
        }
      }
      return true;
    });

    // 3. Load WebGL renderer (GPU-accelerated) with fallback
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        webglRef.current = null;
      });
      tab.terminal.loadAddon(webgl);
      webglRef.current = webgl;
    } catch {
      // Fallback to DOM rendering automatically
    }

    // 4. Fit and focus
    tab.fitAddon.fit();
    tab.terminal.focus();

    return () => {
      webglRef.current?.dispose();
      webglRef.current = null;
    };
  }, [tab]);

  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => {
      tab.fitAddon.fit();
      tab.terminal.focus();
    }, 50);
    return () => clearTimeout(t);
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
