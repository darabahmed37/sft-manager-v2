import React, { useEffect, useState } from 'react';

interface FileManagerProps {
  connectionName: string;
  username: string;
  host: string;
  sessionId: string;
  onDisconnect: () => void;
}

interface LocalFile {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

interface RemoteFile {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  date: string;
  permissions: string;
  owner: string;
}

export const FileManager: React.FC<FileManagerProps> = ({
  connectionName,
  username,
  host,
  sessionId,
  onDisconnect,
}) => {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [localView, setLocalView] = useState<'list' | 'grid'>('list');
  const [remoteView, setRemoteView] = useState<'list' | 'grid'>('list');
  const [activeRemoteTab, setActiveRemoteTab] = useState(0);


  // Dynamic directory states
  const [localHome, setLocalHome] = useState('');
  const [localCurrentDir, setLocalCurrentDir] = useState('');
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [localSearch, setLocalSearch] = useState('');

  const [remoteHome, setRemoteHome] = useState('');
  const [remoteCurrentDir, setRemoteCurrentDir] = useState('');
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [remoteSearch, setRemoteSearch] = useState('');

  // Loading states
  const [localLoading, setLocalLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Size formatter
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const remoteDirTabs = [remoteCurrentDir || '/home/ubuntu'];

  // Directory navigation helpers (platform independent string parsing)
  const getParentLocal = (curPath: string) => {
    if (curPath.includes('\\')) {
      const parts = curPath.split('\\');
      if (parts.length <= 1) return curPath;
      parts.pop();
      const parent = parts.join('\\');
      return parent.endsWith(':') ? parent + '\\' : parent || '\\';
    } else {
      const parts = curPath.split('/');
      if (parts.length <= 1) return curPath;
      parts.pop();
      return parts.join('/') || '/';
    }
  };

  const getParentRemote = (curPath: string) => {
    const parts = curPath.split('/').filter(p => p);
    if (parts.length === 0) return '/';
    parts.pop();
    return '/' + parts.join('/');
  };

  const joinLocalPath = (parent: string, child: string) => {
    if (parent.includes('\\')) {
      return parent.endsWith('\\') ? `${parent}${child}` : `${parent}\\${child}`;
    } else {
      return parent.endsWith('/') ? `${parent}${child}` : `${parent}/${child}`;
    }
  };

  const joinRemotePath = (parent: string, child: string) => {
    return parent.endsWith('/') ? `${parent}${child}` : `${parent}/${child}`;
  };

  // Fetch local file list
  const loadLocalDirectory = async (dirPath: string) => {
    setLocalLoading(true);
    try {
      const filesList = await window.electronAPI.fs.listDirectory(dirPath);
      // Sort: folders first, then files alphabetically
      const sorted = [...filesList].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setLocalFiles(sorted);
      setLocalCurrentDir(dirPath);
    } catch (err: any) {
      console.error('Failed to load local directory', err);
      setErrorMsg(`Local error: ${err.message}`);
    } finally {
      setLocalLoading(false);
    }
  };

  // Fetch remote file list
  const loadRemoteDirectory = async (dirPath: string) => {
    setRemoteLoading(true);
    try {
      const filesList = await window.electronAPI.ssh.listDirectory(sessionId, dirPath);
      const sorted = [...filesList].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setRemoteFiles(sorted);
      setRemoteCurrentDir(dirPath);
    } catch (err: any) {
      console.error('Failed to load remote directory', err);
      setErrorMsg(`Remote error: ${err.message}`);
    } finally {
      setRemoteLoading(false);
    }
  };

  // Initialize directories on mount
  useEffect(() => {
    const initDirs = async () => {
      try {
        setLocalLoading(true);
        setRemoteLoading(true);

        const lHome = await window.electronAPI.fs.getHomeDir();
        setLocalHome(lHome);

        const rHome = await window.electronAPI.ssh.getHomeDir(sessionId);
        setRemoteHome(rHome);

        await Promise.all([
          loadLocalDirectory(lHome),
          loadRemoteDirectory(rHome),
        ]);
      } catch (err: any) {
        setErrorMsg(`Initialization failed: ${err.message}`);
      } finally {
        setLocalLoading(false);
        setRemoteLoading(false);
      }
    };

    initDirs();
  }, [sessionId]);

  const handleLocalDblClick = (file: LocalFile) => {
    if (file.isDirectory) {
      const nextDir = joinLocalPath(localCurrentDir, file.name);
      loadLocalDirectory(nextDir);
    }
  };

  const handleRemoteDblClick = (file: RemoteFile) => {
    if (file.isDirectory) {
      const nextDir = joinRemotePath(remoteCurrentDir, file.name);
      loadRemoteDirectory(nextDir);
    }
  };

  const handleLocalUp = () => {
    const parent = getParentLocal(localCurrentDir);
    if (parent !== localCurrentDir) {
      loadLocalDirectory(parent);
    }
  };

  const handleRemoteUp = () => {
    const parent = getParentRemote(remoteCurrentDir);
    if (parent !== remoteCurrentDir) {
      loadRemoteDirectory(parent);
    }
  };

  // Filter lists in memory based on search query
  const filteredLocalFiles = localFiles.filter(f => 
    f.name.toLowerCase().includes(localSearch.toLowerCase())
  );

  const filteredRemoteFiles = remoteFiles.filter(f => 
    f.name.toLowerCase().includes(remoteSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-app)] text-[13px] text-[var(--text-main)] font-sans select-none theme-transition">
      {errorMsg && (
        <div className="bg-red-950/30 border-b border-red-500/20 text-red-400 text-xs px-4.5 py-2 flex items-center justify-between shrink-0">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="bg-transparent border-none text-red-400 font-bold hover:text-white cursor-pointer outline-none">×</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* LOCAL PANEL */}
        {!localCollapsed ? (
          <div className="w-[280px] min-w-[180px] flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 overflow-hidden theme-transition">
            {/* Panel Label & Path */}
            <div className="h-[28px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2.5 gap-1.5 shrink-0 theme-transition">
              <span className="text-[10px] font-bold text-[var(--text-subtle)] uppercase tracking-widest flex-shrink-0">Local</span>
              <span className="text-[11px] font-mono text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={localCurrentDir}>
                {localCurrentDir}
              </span>
              <button 
                onClick={() => setLocalCollapsed(true)} 
                title="Collapse" 
                className="bg-transparent border-none p-0.5 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center shrink-0 outline-none"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="8,2 3,6 8,10"/>
                </svg>
              </button>
            </div>

            {/* Navigation Toolbar */}
            <div className="h-8 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center px-1 shrink-0 theme-transition">
              <button title="Back" className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="8,2 4,6.5 8,11"/></svg>
              </button>
              <button title="Forward" className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="5,2 9,6.5 5,11"/></svg>
              </button>
              <button 
                onClick={handleLocalUp} 
                title="Up" 
                className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="2,9 6.5,4 11,9"/></svg>
              </button>
              <button 
                onClick={() => loadLocalDirectory(localHome)} 
                title="Home" 
                className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8L7 3l5 5M4 6.5V12h2.5V9h1V12H10V6.5"/></svg>
              </button>
              <button 
                onClick={() => loadLocalDirectory(localCurrentDir)} 
                title="Refresh" 
                className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 6.5A5.5 5.5 0 1 1 6.5 1M12 1v4h-4"/></svg>
              </button>
              <button title="Bookmarks" className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors">
                <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z"/></svg>
              </button>
              <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
              
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Search…" 
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[3px] py-0.5 pl-6 pr-1.5 text-[var(--text-main)] placeholder-[var(--text-subtle)] text-xs outline-none transition-all"
                />
                <svg className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[var(--text-subtle)]" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>
              </div>
              <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
              
              {/* View Toggle */}
              <button 
                onClick={() => setLocalView('list')} 
                title="List view" 
                className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-all ${localView === 'list' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="4" y1="3" x2="12" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="4" y1="10" x2="12" y2="10"/><rect x="1" y="2" width="2" height="2" fill="currentColor"/><rect x="1" y="5.5" width="2" height="2" fill="currentColor"/><rect x="1" y="9" width="2" height="2" fill="currentColor"/></svg>
              </button>
              <button 
                onClick={() => setLocalView('grid')} 
                title="Grid view" 
                className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-all ${localView === 'grid' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.5"/></svg>
              </button>
            </div>

            {/* Sort Bar */}
            <div className="h-[22px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2 shrink-0 theme-transition">
              <span className="text-[11px] text-[var(--text-muted)]">Sort:</span>
              <span className="text-[11px] text-[var(--text-main)] ml-1 cursor-pointer hover:text-[var(--text-main)]">Name ↕</span>
            </div>

            {/* Local Files View */}
            <div className="flex-1 overflow-y-auto">
              {localLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">Loading...</div>
              ) : localView === 'list' ? (
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {filteredLocalFiles.map((lf, i) => (
                      <tr 
                        key={i} 
                        onDoubleClick={() => handleLocalDblClick(lf)}
                        className="hover:bg-[var(--glow-color)]/25 active:bg-[var(--glow-color)]/50 cursor-default h-[22px] transition-colors duration-75 border-b border-[var(--border-color)]/50"
                      >
                        <td className="w-[22px] pl-1.5 text-center align-middle">
                          {lf.isDirectory ? (
                            <svg width="14" height="12" viewBox="0 0 16 14" fill="none"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85"/></svg>
                          ) : (
                            <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M0 0h8l4 4v10H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M8 0l4 4H8z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                          )}
                        </td>
                        <td className="px-1 text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px] align-middle">{lf.name}</td>
                        <td className="w-[60px] pr-1.5 text-right text-[var(--text-muted)] font-mono text-[11px] align-middle whitespace-nowrap">{formatSize(lf.size)}</td>
                        <td className="w-[85px] pr-1.5 text-[var(--text-subtle)] font-mono text-[10px] align-middle whitespace-nowrap">{lf.modified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-1.5 flex flex-wrap gap-0.5 content-start items-start">
                  {filteredLocalFiles.map((lf, i) => (
                    <div 
                      key={i} 
                      onDoubleClick={() => handleLocalDblClick(lf)}
                      className="w-20 p-1.5 flex flex-col items-center gap-1 cursor-default hover:bg-[var(--glow-color)]/20 rounded-[2px]"
                    >
                      {lf.isDirectory ? (
                        <svg width="40" height="34" viewBox="0 0 44 38" fill="none"><path d="M0 6h20l4 5H44v27H0z" fill="var(--color-primary)" opacity="0.85"/><path d="M0 6h20l4 5H44v4H0z" fill="white" opacity="0.15"/></svg>
                      ) : (
                        <svg width="32" height="40" viewBox="0 0 32 40" fill="none"><path d="M0 0h22l10 10v30H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M22 0l10 10H22z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                      )}
                      <span className="text-[10px] text-[var(--text-main)] text-center overflow-hidden text-ellipsis whitespace-nowrap w-full block leading-normal">{lf.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)] text-center">{formatSize(lf.size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Local Status Bar */}
            <div className="h-5 bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-2 shrink-0 text-[11px] text-[var(--text-muted)] theme-transition">
              <span>{filteredLocalFiles.length} items</span>
            </div>
          </div>
        ) : (
          // Collapsed Local Strip
          <div 
            onClick={() => setLocalCollapsed(false)} 
            className="w-5 bg-[var(--bg-panel-header)] border-r border-[var(--border-color)] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[var(--bg-panel)] theme-transition"
            title="Expand local panel"
          >
            <div className="writing-mode-vertical text-[9px] text-[var(--text-subtle)] tracking-widest uppercase rotate-180 font-bold select-none">Local</div>
          </div>
        )}

        {/* Resize Handle Visual Separator */}
        <div className="w-[3px] bg-[var(--border-color)] shrink-0 theme-transition"></div>

        {/* REMOTE PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-panel)] theme-transition">
          {/* Panel Label & Host */}
          <div className="h-[28px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2.5 gap-1.5 shrink-0 theme-transition">
            <span className="text-[10px] font-bold text-[var(--text-subtle)] uppercase tracking-widest flex-shrink-0">Remote</span>
            <span className="text-[11px] font-mono text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={remoteCurrentDir}>
              {connectionName} — {username}@{host}:{remoteCurrentDir}
            </span>
          </div>

          {/* Remote Directory Tabs - Only visible when local panel is collapsed */}
          {localCollapsed && (
            <div className="h-[26px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-end overflow-hidden shrink-0 theme-transition">
              {remoteDirTabs.map((label: string, i: number) => (
                <div 
                  key={i}
                  onClick={() => setActiveRemoteTab(i)} 
                  className={`h-6 px-2.5 flex items-center gap-1.5 text-[11px] cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t ${
                    activeRemoteTab === i 
                      ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t border-t-[var(--color-primary)] font-semibold' 
                      : 'bg-transparent text-[var(--text-muted)] border-t-transparent hover:text-[var(--text-main)]'
                  }`}
                >
                  {label}
                  <span className="text-[var(--text-subtle)] text-xs ml-0.5 mt-[-1px] font-semibold">×</span>
                </div>
              ))}
              <div className="w-6 h-6 flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] text-[15px] shrink-0">+</div>
            </div>
          )}

          {/* Remote Navigation Toolbar */}
          <div className="h-8 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center px-1 shrink-0 theme-transition">
            <button title="Back" className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="8,2 4,6.5 8,11"/></svg>
            </button>
            <button title="Forward" className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="5,2 9,6.5 5,11"/></svg>
            </button>
            <button 
              onClick={handleRemoteUp} 
              title="Up" 
              className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="2,9 6.5,4 11,9"/></svg>
            </button>
            <button 
              onClick={() => loadRemoteDirectory(remoteHome)} 
              title="Home" 
              className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8L7 3l5 5M4 6.5V12h2.5V9h1V12H10V6.5"/></svg>
            </button>
            <button 
              onClick={() => loadRemoteDirectory(remoteCurrentDir)} 
              title="Refresh" 
              className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 6.5A5.5 5.5 0 1 1 6.5 1M12 1v4h-4"/></svg>
            </button>
            <button title="Bookmarks" className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors">
              <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z"/></svg>
            </button>
            {/* Path breadcrumbs */}
            <div className="flex-1 flex items-center gap-1 overflow-hidden px-1 font-mono text-[11px] text-[var(--text-muted)] select-text">
              {remoteCurrentDir.split('/').map((part, idx, arr) => {
                if (idx === 0 && part === '') {
                  return <span key={idx} onClick={() => loadRemoteDirectory('/')} className="cursor-pointer hover:text-[var(--text-main)] transition-colors">/</span>;
                }
                if (part === '') return null;
                const pathTarget = '/' + arr.slice(1, idx + 1).join('/');
                return (
                  <React.Fragment key={idx}>
                    <span onClick={() => loadRemoteDirectory(pathTarget)} className="cursor-pointer hover:text-[var(--text-main)] transition-colors">{part}</span>
                    {idx < arr.length - 1 && <span>/</span>}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
            
            <div className="relative shrink-0">
              <input 
                type="text" 
                value={remoteSearch}
                onChange={(e) => setRemoteSearch(e.target.value)}
                placeholder="Search…" 
                className="w-[140px] bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[3px] py-0.5 pl-6 pr-1.5 text-[var(--text-main)] placeholder-[var(--text-subtle)] text-xs outline-none transition-all"
              />
              <svg className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[var(--text-subtle)]" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>
            </div>
            <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
            
            {/* View Toggles */}
            <button 
              onClick={() => setRemoteView('list')} 
              title="List view" 
              className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-all ${remoteView === 'list' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="4" y1="3" x2="12" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="4" y1="10" x2="12" y2="10"/><rect x="1" y="2" width="2" height="2" fill="currentColor"/><rect x="1" y="5.5" width="2" height="2" fill="currentColor"/><rect x="1" y="9" width="2" height="2" fill="currentColor"/></svg>
            </button>
            <button 
              onClick={() => setRemoteView('grid')} 
              title="Grid view" 
              className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-all ${remoteView === 'grid' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.5"/></svg>
            </button>
            <button 
              onClick={() => (window as any).electronAPI.terminal.openWindow(sessionId, username, host)} 
              title="Open Terminal Window" 
              className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] ml-0.5 outline-none text-[var(--text-muted)] hover:text-[var(--active-tab-text)] hover:bg-[var(--glow-color)]/25 transition-colors`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><polyline points="4,5.5 6.5,8 4,10.5"/><line x1="7.5" y1="10.5" x2="11" y2="10.5"/></svg>
            </button>
          </div>

          {/* Table Header (only in List view) */}
          {remoteView === 'list' && (
            <div className="shrink-0 overflow-hidden flex flex-col">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-panel-header)] h-[22px] theme-transition">
                    <th className="w-[22px] py-1 pl-2 text-left"><input type="checkbox" className="w-[11px] h-[11px] accent-[var(--color-primary)] cursor-pointer"/></th>
                    <th className="text-left px-2 font-semibold text-[var(--text-muted)] tracking-wider cursor-pointer select-none">Name ↕</th>
                    <th className="text-right px-2 font-semibold text-[var(--text-muted)] tracking-wider w-[75px] cursor-pointer select-none">Size</th>
                    <th className="text-left px-2 font-semibold text-[var(--text-muted)] tracking-wider w-[110px] cursor-pointer select-none">Modified</th>
                    <th className="text-left px-2 font-semibold text-[var(--text-muted)] tracking-wider w-[70px] cursor-pointer select-none">Perms</th>
                  </tr>
                </thead>
              </table>
            </div>
          )}

          {/* Remote Grid Sort Bar (sync column alignments in grid view) */}
          {remoteView === 'grid' && (
            <div className="h-[22px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2 shrink-0 theme-transition">
              <span className="text-[11px] text-[var(--text-muted)]">Sort:</span>
              <span className="text-[11px] text-[var(--text-main)] ml-1 cursor-pointer hover:text-[var(--text-main)]">Name ↕</span>
            </div>
          )}

          {/* Remote Files list content */}
          <div className="flex-1 overflow-y-auto">
            {remoteLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">Loading...</div>
            ) : remoteView === 'list' ? (
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {filteredRemoteFiles.map((rf, i) => (
                    <tr 
                      key={i} 
                      onDoubleClick={() => handleRemoteDblClick(rf)}
                      className="h-[22px] cursor-default transition-colors duration-75 border-b border-[var(--border-color)]/50 hover:bg-[var(--glow-color)]/25 active:bg-[var(--glow-color)]/50"
                    >
                      <td className="w-[22px] pl-2 align-middle">
                        <input 
                          type="checkbox" 
                          onChange={() => {}}
                          className="w-[11px] h-[11px] accent-[var(--color-primary)] cursor-pointer"
                        />
                      </td>
                      <td className="px-1 align-middle">
                        <div className="flex items-center gap-1.5">
                          {rf.isDirectory ? (
                            <svg width="14" height="12" viewBox="0 0 16 14" fill="none"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85"/></svg>
                          ) : (
                            <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M0 0h8l4 4v10H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M8 0l4 4H8z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                          )}
                          <span className="text-[var(--text-main)]">{rf.name}</span>
                        </div>
                      </td>
                      <td className="w-[75px] px-2 text-right text-[var(--text-muted)] font-mono text-[11px] align-middle whitespace-nowrap">{formatSize(rf.size)}</td>
                      <td className="w-[110px] px-2 text-[var(--text-subtle)] font-mono text-[10px] align-middle whitespace-nowrap">{rf.date}</td>
                      <td className="w-[70px] px-2 text-[var(--text-subtle)] font-mono text-[10px] align-middle whitespace-nowrap">{rf.permissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-2 flex flex-wrap gap-0.5 content-start items-start">
                {filteredRemoteFiles.map((rf, i) => (
                  <div 
                    key={i} 
                    onDoubleClick={() => handleRemoteDblClick(rf)}
                    className="w-[88px] p-2 flex flex-col items-center gap-1 cursor-default rounded-[2px] border border-transparent hover:bg-[var(--glow-color)]/20 hover:border-[var(--color-primary)]/40"
                  >
                    {rf.isDirectory ? (
                      <svg width="48" height="40" viewBox="0 0 52 44" fill="none">
                        <path d="M0 8h22l5 6H52v30H0z" fill="var(--color-primary)" opacity="0.9"/>
                        <path d="M0 8h22l5 6H52v5H0z" fill="white" opacity="0.15"/>
                      </svg>
                    ) : (
                      <svg width="38" height="48" viewBox="0 0 38 48" fill="none">
                        <path d="M0 0h26l12 12v36H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/>
                        <path d="M26 0l12 12H26z" fill="currentColor" className="text-[var(--text-subtle)]"/>
                        <line x1="7" y1="20" x2="31" y2="20" stroke="var(--border-color)" strokeWidth="2"/>
                        <line x1="7" y1="26" x2="28" y2="26" stroke="var(--border-color)" strokeWidth="2"/>
                        <line x1="7" y1="32" x2="24" y2="32" stroke="var(--border-color)" strokeWidth="2"/>
                      </svg>
                    )}
                    <div className="text-[11px] text-[var(--text-main)] text-center overflow-hidden text-ellipsis whitespace-nowrap w-full leading-normal">{rf.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] text-center">{formatSize(rf.size) || '--'}</div>
                    <div className="text-[9px] text-[var(--text-subtle)] text-center font-mono">{rf.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Remote Status Bar */}
          <div className="h-5 bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-2 gap-3.5 shrink-0 text-[11px] text-[var(--text-muted)] theme-transition">
            <span>{filteredRemoteFiles.length} items</span>
          </div>

        </div>
      </div>

      {/* Connected Blue Status Bar */}
      <div className="h-5 bg-[var(--color-primary)] text-white flex items-center px-2.5 gap-3.5 shrink-0 text-[11px] font-medium border-t border-[var(--border-color)] select-none text-left">
        <span>● Connected · {username}@{host}</span>
        <span className="opacity-75">{remoteCurrentDir} · {filteredRemoteFiles.length} items</span>
        <div className="flex-1"></div>
        <button 
          onClick={onDisconnect} 
          className="bg-transparent border-none text-white hover:text-white/80 cursor-pointer font-bold select-none outline-none mr-2"
        >
          Disconnect Session
        </button>
      </div>
    </div>
  );
};

export default FileManager;
