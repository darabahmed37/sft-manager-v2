import React, { useEffect, useState } from 'react';

export interface TitleBarTab {
  id: string; // 'connections' or `conn-${connectionId}`
  name: string;
  type: 'connections' | 'connection';
  status?: 'connecting' | 'connected' | 'failed';
}

interface TitleBarProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  tabs?: TitleBarTab[];
  activeTabId?: string;
  setActiveTabId?: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onNewConnection?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  theme = 'dark',
  onToggleTheme,
  tabs = [],
  activeTabId = 'connections',
  setActiveTabId,
  onCloseTab,
  onNewConnection,
}) => {
  const [platform, setPlatform] = useState<string>('win32');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.window) {
      window.electronAPI.window.getPlatform().then((p) => {
        setPlatform(p);
      });
      window.electronAPI.window.isMaximized().then((max) => {
        setIsMaximized(max);
      });
      const unsub = window.electronAPI.window.onMaximizedState((_e, max) => {
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

  const renderThemeToggle = () => (
    <button
      onClick={onToggleTheme}
      className="w-9 h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-panel-header)] hover:text-[var(--text-main)] transition-colors duration-150 outline-none border-none bg-transparent cursor-pointer"
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );

  const renderTabs = () => (
    <div 
      className="flex items-end h-full overflow-hidden"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        const statusDotColor = tab.status === 'connected' ? '#4ec9b0' : tab.status === 'failed' ? '#f44747' : '#29ABEE';
        
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTabId?.(tab.id)}
            className={`h-[38px] px-3.5 flex items-center gap-1.5 text-[12.5px] cursor-pointer border-t border-r border-l shrink-0 transition-all select-none ${
              isActive
                ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-[var(--border-color)] border-b-[var(--bg-panel)] font-semibold'
                : 'bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-white/5'
            }`}
            style={{
              boxShadow: isActive ? 'inset 0 2px 0 var(--color-primary)' : 'none',
              borderBottom: isActive ? '1px solid var(--bg-panel)' : 'none',
              marginTop: '8px',
              borderRadius: '6px 6px 0 0',
              marginLeft: '2px',
              marginRight: '2px',
            }}
          >
            {tab.type === 'connections' ? (
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="1" y="2" width="10" height="8" rx="1"/>
                <line x1="1" y1="4.5" x2="11" y2="4.5"/>
                <line x1="3.5" y1="6.5" x2="5.5" y2="6.5"/>
                <line x1="3.5" y1="8" x2="7.5" y2="8"/>
              </svg>
            ) : (
              <div 
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300"
                style={{ 
                  backgroundColor: statusDotColor,
                  boxShadow: tab.status === 'connecting' ? '0 0 3px #29ABEE' : tab.status === 'connected' ? '0 0 3px #4ec9b0' : 'none' 
                }}
              ></div>
            )}
            <span>{tab.name}</span>
            {tab.type === 'connection' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(tab.id);
                }}
                className="ml-1.5 w-[18px] h-[18px] rounded-full bg-transparent border-none flex items-center justify-center text-[var(--text-subtle)] hover:bg-[var(--border-color)] hover:text-[var(--text-main)] transition-colors cursor-pointer outline-none"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" />
                  <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {onNewConnection && (
        <button
          onClick={onNewConnection}
          className="h-[38px] w-[38px] flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-[6px] border-none bg-transparent outline-none ml-1 shrink-0 transition-colors"
          title="New Connection"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="6" y1="2" x2="6" y2="10" />
            <line x1="2" y1="6" x2="10" y2="6" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div 
      className="h-[46px] bg-[var(--bg-app)] flex items-center border-b border-[var(--border-color)] shrink-0 relative select-none theme-transition"
      style={{ WebkitAppRegion: 'drag', boxShadow: '0 1px 0 var(--border-color)' } as React.CSSProperties}
    >
      {platform === 'darwin' ? (
        // macOS Spacer for Native Traffic Lights
        <div className="w-[80px] shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}></div>
      ) : (
        // Spacing buffer on Windows/Linux
        <div className="w-2.5 shrink-0" />
      )}

      {/* Render Session Tabs */}
      {renderTabs()}

      {/* macOS Theme Toggle Placement */}
      {platform === 'darwin' && (
        <div 
          className="ml-auto flex items-center h-full pr-3 shrink-0 select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {renderThemeToggle()}
        </div>
      )}

      {/* Windows Window Controls */}
      {platform !== 'darwin' && (
        <div 
          className="ml-auto flex items-center h-full shrink-0 select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {renderThemeToggle()}
          
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-panel-header)] hover:text-[var(--text-main)] transition-colors duration-155 outline-none border-none bg-transparent cursor-pointer"
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="0" y1="0.5" x2="10" y2="0.5" />
            </svg>
          </button>
          
          {/* Maximize */}
          <button
            onClick={handleMaximize}
            className="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-panel-header)] hover:text-[var(--text-main)] transition-colors duration-155 outline-none border-none bg-transparent cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M3,1 L9,1 L9,7 M1,3 L7,3 L7,9 L1,9 Z" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0.5" y="0.5" width="8" height="8" />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-[46px] h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[#e81123] hover:text-white transition-colors duration-155 outline-none border-none bg-transparent cursor-pointer"
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default TitleBar;
