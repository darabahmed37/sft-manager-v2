import React, { useEffect, useState } from 'react';

interface TitleBarProps {
  title?: string;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'i2c SFTP',
  theme = 'dark',
  onToggleTheme,
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
      className="w-9 h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-panel-header)] hover:text-[var(--text-main)] transition-colors duration-150 outline-none cursor-pointer"
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

  return (
    <div 
      className="h-[28px] bg-[var(--bg-app)] flex items-center border-b border-[var(--border-color)] shrink-0 relative select-none theme-transition"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {platform === 'darwin' ? (
        // macOS Spacer for Native Traffic Lights
        <div className="w-[80px] shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}></div>
      ) : (
        // Windows/Linux App Icon & Menu items style on Left
        <div 
          className="flex items-center gap-2 pl-3 text-[var(--text-subtle)] text-xs font-semibold select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="2" width="10" height="8" rx="1" />
            <line x1="1" y1="4.5" x2="11" y2="4.5" />
            <line x1="3.5" y1="6.5" x2="5.5" y2="6.5" />
            <line x1="3.5" y1="8" x2="7.5" y2="8" />
          </svg>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-subtle)]">i2c SFTP</span>
        </div>
      )}

      {/* Central Window Title */}
      <div className="absolute left-1/2 transform -translate-x-1/2 text-xs text-[var(--text-muted)] font-medium pointer-events-none truncate max-w-[50%]">
        {title}
      </div>

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
            className="w-[45px] h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-panel-header)] hover:text-[var(--text-main)] transition-colors duration-150 outline-none"
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="0" y1="0.5" x2="10" y2="0.5" />
            </svg>
          </button>
          
          {/* Maximize */}
          <button
            onClick={handleMaximize}
            className="w-[45px] h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-panel-header)] hover:text-[var(--text-main)] transition-colors duration-150 outline-none"
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
            className="w-[45px] h-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[#e81123] hover:text-white transition-colors duration-150 outline-none"
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
