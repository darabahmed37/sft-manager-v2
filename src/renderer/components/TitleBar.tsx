import React, { useEffect, useState } from 'react';

interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'i2c SFTP' }) => {
  const [platform, setPlatform] = useState<string>('win32');

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.window) {
      window.electronAPI.window.getPlatform().then((p) => {
        setPlatform(p);
      });
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

  return (
    <div 
      className="h-[28px] bg-[#1a1a1a] flex items-center border-b border-[#252525] shrink-0 relative select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {platform === 'darwin' ? (
        // macOS Spacer for Native Traffic Lights
        <div className="w-[80px] shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}></div>
      ) : (
        // Windows/Linux App Icon & Menu items style on Left
        <div 
          className="flex items-center gap-2 pl-3 text-[#888] text-xs font-semibold select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <svg className="w-3.5 h-3.5 text-[#29ABEE]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="2" width="10" height="8" rx="1" />
            <line x1="1" y1="4.5" x2="11" y2="4.5" />
            <line x1="3.5" y1="6.5" x2="5.5" y2="6.5" />
            <line x1="3.5" y1="8" x2="7.5" y2="8" />
          </svg>
          <span className="text-[10px] uppercase tracking-wider text-[#555]">i2c SFTP</span>
        </div>
      )}

      {/* Central Window Title */}
      <div className="absolute left-1/2 transform -translate-x-1/2 text-xs text-[#888] font-medium pointer-events-none truncate max-w-[50%]">
        {title}
      </div>

      {/* Windows Window Controls */}
      {platform !== 'darwin' && (
        <div 
          className="ml-auto flex items-center h-full shrink-0 select-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Minimize */}
          <button
            onClick={handleMinimize}
            className="w-[45px] h-full flex items-center justify-center text-[#888] hover:bg-[#2d2d2d] hover:text-white transition-colors duration-150 outline-none"
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="0" y1="0.5" x2="10" y2="0.5" />
            </svg>
          </button>
          
          {/* Maximize */}
          <button
            onClick={handleMaximize}
            className="w-[45px] h-full flex items-center justify-center text-[#888] hover:bg-[#2d2d2d] hover:text-white transition-colors duration-150 outline-none"
            title="Maximize"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="8" height="8" />
            </svg>
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-[45px] h-full flex items-center justify-center text-[#888] hover:bg-[#e81123] hover:text-white transition-colors duration-150 outline-none"
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
