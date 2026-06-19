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
  const [terminalOpen, setTerminalOpen] = useState(false);
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
    <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e] text-[13px] text-neutral-300 font-sans select-none">
      {errorMsg && (
        <div className="bg-red-950/30 border-b border-red-500/20 text-red-400 text-xs px-4.5 py-2 flex items-center justify-between shrink-0">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="bg-transparent border-none text-red-400 font-bold hover:text-white cursor-pointer outline-none">×</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* LOCAL PANEL */}
        {!localCollapsed ? (
          <div className="w-[280px] min-w-[180px] flex flex-col border-r border-[#252525] bg-[#1e1e1e] shrink-0 overflow-hidden">
            {/* Panel Label & Path */}
            <div className="h-[26px] bg-[#252526] border-b border-[#1a1a1a] flex items-center px-2.5 gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex-shrink-0">Local</span>
              <span className="text-[11px] font-mono text-neutral-400 overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={localCurrentDir}>
                {localCurrentDir}
              </span>
              <button 
                onClick={() => setLocalCollapsed(true)} 
                title="Collapse" 
                className="bg-transparent border-none p-0.5 cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center shrink-0 outline-none"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="8,2 3,6 8,10"/>
                </svg>
              </button>
            </div>

            {/* Navigation Toolbar */}
            <div className="h-7 bg-[#1e1e1e] border-b border-[#252525] flex items-center px-1 shrink-0">
              <button title="Back" className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="8,2 4,6.5 8,11"/></svg>
              </button>
              <button title="Forward" className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="5,2 9,6.5 5,11"/></svg>
              </button>
              <button 
                onClick={handleLocalUp} 
                title="Up" 
                className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="2,9 6.5,4 11,9"/></svg>
              </button>
              <button 
                onClick={() => loadLocalDirectory(localHome)} 
                title="Home" 
                className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8L7 3l5 5M4 6.5V12h2.5V9h1V12H10V6.5"/></svg>
              </button>
              <button 
                onClick={() => loadLocalDirectory(localCurrentDir)} 
                title="Refresh" 
                className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 6.5A5.5 5.5 0 1 1 6.5 1M12 1v4h-4"/></svg>
              </button>
              <button title="Bookmarks" className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none">
                <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z"/></svg>
              </button>
              <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1 shrink-0"></div>
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Search…" 
                  className="w-full bg-transparent border-none py-1 pl-5 pr-1.5 text-neutral-400 text-xs outline-none"
                />
                <svg className="absolute left-1 top-1/2 transform -translate-y-1/2 text-neutral-700" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>
              </div>
              <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1 shrink-0"></div>
              {/* View Toggle */}
              <button 
                onClick={() => setLocalView('list')} 
                title="List view" 
                className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none ${localView === 'list' ? 'bg-[#29ABEE]/15 text-[#29ABEE]' : 'text-neutral-600 hover:text-neutral-400'}`}
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="4" y1="3" x2="12" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="4" y1="10" x2="12" y2="10"/><rect x="1" y="2" width="2" height="2" fill="currentColor"/><rect x="1" y="5.5" width="2" height="2" fill="currentColor"/><rect x="1" y="9" width="2" height="2" fill="currentColor"/></svg>
              </button>
              <button 
                onClick={() => setLocalView('grid')} 
                title="Grid view" 
                className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none ${localView === 'grid' ? 'bg-[#29ABEE]/15 text-[#29ABEE]' : 'text-neutral-600 hover:text-neutral-400'}`}
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.5"/></svg>
              </button>
            </div>

            {/* Sort Bar */}
            <div className="h-[22px] bg-[#1e1e1e] border-b border-[#1a1a1a] flex items-center px-2 shrink-0">
              <span className="text-[11px] text-neutral-600">Sort:</span>
              <span className="text-[11px] text-neutral-400 ml-1 cursor-pointer hover:text-neutral-200">Name ↕</span>
            </div>

            {/* Local Files View */}
            <div className="flex-1 overflow-y-auto">
              {localLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-600 font-mono">Loading...</div>
              ) : localView === 'list' ? (
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {filteredLocalFiles.map((lf, i) => (
                      <tr 
                        key={i} 
                        onDoubleClick={() => handleLocalDblClick(lf)}
                        className="hover:bg-[#29ABEE]/10 active:bg-[#29ABEE]/20 cursor-default h-[22px] transition-colors duration-75"
                      >
                        <td className="w-[22px] pl-1.5 text-center align-middle">
                          {lf.isDirectory ? (
                            <svg width="14" height="12" viewBox="0 0 16 14" fill="none"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="#29ABEE" opacity="0.85"/></svg>
                          ) : (
                            <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M0 0h8l4 4v10H0z" fill="#555"/><path d="M8 0l4 4H8z" fill="#777"/></svg>
                          )}
                        </td>
                        <td className="px-1 text-neutral-300 overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px] align-middle">{lf.name}</td>
                        <td className="w-[60px] pr-1.5 text-right text-neutral-600 font-mono text-[11px] align-middle whitespace-nowrap">{formatSize(lf.size)}</td>
                        <td className="w-[85px] pr-1.5 text-neutral-500 font-mono text-[10px] align-middle whitespace-nowrap">{lf.modified}</td>
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
                      className="w-20 p-1.5 flex flex-col items-center gap-1 cursor-default hover:bg-[#29ABEE]/10 rounded-[2px]"
                    >
                      {lf.isDirectory ? (
                        <svg width="40" height="34" viewBox="0 0 44 38" fill="none"><path d="M0 6h20l4 5H44v27H0z" fill="#29ABEE" opacity="0.85"/><path d="M0 6h20l4 5H44v4H0z" fill="#3BBFFF" opacity="0.5"/></svg>
                      ) : (
                        <svg width="32" height="40" viewBox="0 0 32 40" fill="none"><path d="M0 0h22l10 10v30H0z" fill="#444"/><path d="M22 0l10 10H22z" fill="#5a5a5a"/></svg>
                      )}
                      <span className="text-[10px] text-neutral-400 text-center overflow-hidden text-ellipsis whitespace-nowrap w-full block leading-normal">{lf.name}</span>
                      <span className="text-[10px] text-neutral-600 text-center">{formatSize(lf.size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Local Status Bar */}
            <div className="h-5 bg-[#252526] border-t border-[#1a1a1a] flex items-center px-2 shrink-0 text-[11px] text-neutral-600">
              <span>{filteredLocalFiles.length} items</span>
            </div>
          </div>
        ) : (
          // Collapsed Local Strip
          <div 
            onClick={() => setLocalCollapsed(false)} 
            className="w-5 bg-[#1e1e1e] border-r border-[#252525] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[#252526]"
            title="Expand local panel"
          >
            <div className="writing-mode-vertical text-[9px] text-[#444] tracking-widest uppercase rotate-180">Local</div>
          </div>
        )}

        {/* Resize Handle Visual Separator */}
        <div className="w-[3px] bg-[#1a1a1a] shrink-0"></div>

        {/* REMOTE PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          {/* Panel Label & Host */}
          <div className="h-[26px] bg-[#252526] border-b border-[#1a1a1a] flex items-center px-2.5 gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex-shrink-0">Remote</span>
            <span className="text-[11px] font-mono text-neutral-400 overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={remoteCurrentDir}>
              {connectionName} — {username}@{host}:{remoteCurrentDir}
            </span>
          </div>

          {/* Remote Directory Tabs */}
          <div className="h-[26px] bg-[#252526] border-b border-[#1a1a1a] flex items-end overflow-hidden shrink-0">
            {remoteDirTabs.map((label: string, i: number) => (
              <div 
                key={i}
                onClick={() => setActiveRemoteTab(i)} 
                className={`h-6 px-2.5 flex items-center gap-1.5 text-[11px] cursor-pointer border-r border-[#1a1a1a] shrink-0 border-t ${activeRemoteTab === i ? 'bg-[#1e1e1e] text-[#ccc] border-t-[#29ABEE]' : 'bg-transparent text-neutral-600 border-t-transparent'}`}
              >
                {label}
                <span className="text-[#333] text-xs ml-0.5 mt-[-1px] font-semibold">×</span>
              </div>
            ))}
            <div className="w-6 h-6 flex items-center justify-center cursor-pointer text-[#333] text-[15px] hover:text-[#555] shrink-0">+</div>
          </div>

          {/* Remote Navigation Toolbar */}
          <div className="h-7 bg-[#1e1e1e] border-b border-[#252525] flex items-center px-1 shrink-0">
            <button title="Back" className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="8,2 4,6.5 8,11"/></svg>
            </button>
            <button title="Forward" className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="5,2 9,6.5 5,11"/></svg>
            </button>
            <button 
              onClick={handleRemoteUp} 
              title="Up" 
              className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="2,9 6.5,4 11,9"/></svg>
            </button>
            <button 
              onClick={() => loadRemoteDirectory(remoteHome)} 
              title="Home" 
              className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8L7 3l5 5M4 6.5V12h2.5V9h1V12H10V6.5"/></svg>
            </button>
            <button 
              onClick={() => loadRemoteDirectory(remoteCurrentDir)} 
              title="Refresh" 
              className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 6.5A5.5 5.5 0 1 1 6.5 1M12 1v4h-4"/></svg>
            </button>
            <button title="Bookmarks" className="w-6 h-6 bg-transparent border-none cursor-pointer text-neutral-600 hover:text-neutral-300 flex items-center justify-center rounded-[3px] outline-none">
              <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z"/></svg>
            </button>
            {/* Path breadcrumbs */}
            <div className="flex-1 flex items-center gap-1 overflow-hidden px-1 font-mono text-[11px] text-neutral-500 select-text">
              {remoteCurrentDir.split('/').map((part, idx, arr) => {
                if (idx === 0 && part === '') {
                  return <span key={idx} onClick={() => loadRemoteDirectory('/')} className="cursor-pointer hover:text-neutral-300">/</span>;
                }
                if (part === '') return null;
                const pathTarget = '/' + arr.slice(1, idx + 1).join('/');
                return (
                  <React.Fragment key={idx}>
                    <span onClick={() => loadRemoteDirectory(pathTarget)} className="cursor-pointer hover:text-neutral-300">{part}</span>
                    {idx < arr.length - 1 && <span>/</span>}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1 shrink-0"></div>
            <div className="relative shrink-0">
              <input 
                type="text" 
                value={remoteSearch}
                onChange={(e) => setRemoteSearch(e.target.value)}
                placeholder="Search…" 
                className="w-[140px] bg-transparent border-none py-1 pl-5 pr-1.5 text-neutral-400 text-xs outline-none"
              />
              <svg className="absolute left-1 top-1/2 transform -translate-y-1/2 text-neutral-700" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>
            </div>
            <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1 shrink-0"></div>
            {/* View Toggles */}
            <button 
              onClick={() => setRemoteView('list')} 
              title="List view" 
              className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none ${remoteView === 'list' ? 'bg-[#29ABEE]/15 text-[#29ABEE]' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="4" y1="3" x2="12" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="4" y1="10" x2="12" y2="10"/><rect x="1" y="2" width="2" height="2" fill="currentColor"/><rect x="1" y="5.5" width="2" height="2" fill="currentColor"/><rect x="1" y="9" width="2" height="2" fill="currentColor"/></svg>
            </button>
            <button 
              onClick={() => setRemoteView('grid')} 
              title="Grid view" 
              className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none ${remoteView === 'grid' ? 'bg-[#29ABEE]/15 text-[#29ABEE]' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.5"/></svg>
            </button>
            <button 
              onClick={() => setTerminalOpen(!terminalOpen)} 
              title="Terminal" 
              className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] ml-0.5 outline-none ${terminalOpen ? 'bg-[#29ABEE]/15 text-[#29ABEE]' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><polyline points="4,5.5 6.5,8 4,10.5"/><line x1="7.5" y1="10.5" x2="11" y2="10.5"/></svg>
            </button>
          </div>

          {/* Table Header (only in List view) */}
          {remoteView === 'list' && (
            <div className="shrink-0 overflow-hidden flex flex-col">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#1a1a1a] bg-[#252526]">
                    <th className="w-[22px] py-1 pl-2 text-left"><input type="checkbox" className="w-[11px] h-[11px] accent-[#29ABEE] cursor-pointer"/></th>
                    <th className="text-left px-2 font-semibold text-neutral-500 tracking-wider cursor-pointer select-none">Name ↕</th>
                    <th className="text-right px-2 font-semibold text-neutral-500 tracking-wider w-[75px] cursor-pointer select-none">Size</th>
                    <th className="text-left px-2 font-semibold text-neutral-500 tracking-wider w-[110px] cursor-pointer select-none">Modified</th>
                    <th className="text-left px-2 font-semibold text-neutral-500 tracking-wider w-[70px] cursor-pointer select-none">Perms</th>
                  </tr>
                </thead>
              </table>
            </div>
          )}

          {/* Remote Files list content */}
          <div className="flex-1 overflow-y-auto">
            {remoteLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-600 font-mono">Loading...</div>
            ) : remoteView === 'list' ? (
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {filteredRemoteFiles.map((rf, i) => (
                    <tr 
                      key={i} 
                      onDoubleClick={() => handleRemoteDblClick(rf)}
                      className="h-[22px] cursor-default transition-colors duration-75 border-b border-[#1a1a1a] hover:bg-[#094771] active:bg-[#094771]/80"
                    >
                      <td className="w-[22px] pl-2 align-middle">
                        <input 
                          type="checkbox" 
                          onChange={() => {}}
                          className="w-[11px] h-[11px] accent-[#29ABEE] cursor-pointer"
                        />
                      </td>
                      <td className="px-1 align-middle">
                        <div className="flex items-center gap-1.5">
                          {rf.isDirectory ? (
                            <svg width="14" height="12" viewBox="0 0 16 14" fill="none"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="#29ABEE" opacity="0.85"/></svg>
                          ) : (
                            <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M0 0h8l4 4v10H0z" fill="#555"/><path d="M8 0l4 4H8z" fill="#666"/></svg>
                          )}
                          <span className="text-neutral-300">{rf.name}</span>
                        </div>
                      </td>
                      <td className="w-[75px] px-2 text-right text-neutral-600 font-mono text-[11px] align-middle whitespace-nowrap">{formatSize(rf.size)}</td>
                      <td className="w-[110px] px-2 text-neutral-500 font-mono text-[10px] align-middle whitespace-nowrap">{rf.date}</td>
                      <td className="w-[70px] px-2 text-neutral-600 font-mono text-[10px] align-middle whitespace-nowrap">{rf.permissions}</td>
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
                    className="w-[88px] p-2 flex flex-col items-center gap-1 cursor-default rounded-[2px] border border-transparent hover:bg-[#094771] hover:border-[#29ABEE]/50"
                  >
                    {rf.isDirectory ? (
                      <svg width="48" height="40" viewBox="0 0 52 44" fill="none">
                        <path d="M0 8h22l5 6H52v30H0z" fill="#29ABEE" opacity="0.9"/>
                        <path d="M0 8h22l5 6H52v5H0z" fill="white" opacity="0.08"/>
                      </svg>
                    ) : (
                      <svg width="38" height="48" viewBox="0 0 38 48" fill="none">
                        <path d="M0 0h26l12 12v36H0z" fill="#3c3c3c"/>
                        <path d="M26 0l12 12H26z" fill="#555"/>
                        <line x1="7" y1="20" x2="31" y2="20" stroke="#5a5a5a" strokeWidth="2"/>
                        <line x1="7" y1="26" x2="28" y2="26" stroke="#5a5a5a" strokeWidth="2"/>
                        <line x1="7" y1="32" x2="24" y2="32" stroke="#5a5a5a" strokeWidth="2"/>
                      </svg>
                    )}
                    <div className="text-[11px] text-neutral-300 text-center overflow-hidden text-ellipsis whitespace-nowrap w-full leading-normal">{rf.name}</div>
                    <div className="text-[10px] text-neutral-600 text-center">{formatSize(rf.size) || '--'}</div>
                    <div className="text-[9px] text-[#333] text-center font-mono">{rf.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Remote Status Bar */}
          <div className="h-5 bg-[#252526] border-t border-[#1a1a1a] flex items-center px-2 gap-3.5 shrink-0 text-[11px] text-neutral-600">
            <span>{filteredRemoteFiles.length} items</span>
          </div>

          {/* TERMINAL PANEL */}
          {terminalOpen && (
            <div className="h-[180px] bg-[#0d0d0d] border-t-2 border-[#29ABEE] flex flex-col shrink-0">
              {/* Terminal tab bar */}
              <div className="h-7 bg-[#141414] border-b border-[#1a1a1a] flex items-end shrink-0 overflow-hidden">
                <div className="h-6.5 px-3 flex items-center gap-1.5 text-[11px] text-neutral-300 bg-[#0d0d0d] border-t border-[#29ABEE] cursor-pointer shrink-0 border-r border-[#1a1a1a]">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="#29ABEE" strokeWidth="1.6"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><polyline points="4,5.5 6.5,8 4,10.5"/><line x1="7.5" y1="10.5" x2="11" y2="10.5"/></svg>
                  bash — {username}@{host}
                </div>
                <div className="h-6.5 px-3 flex items-center gap-1.5 text-[11px] text-[#444] cursor-pointer shrink-0 border-r border-[#1a1a1a]">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="#444" strokeWidth="1.6"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><polyline points="4,5.5 6.5,8 4,10.5"/><line x1="7.5" y1="10.5" x2="11" y2="10.5"/></svg>
                  bash — {username}@{host}
                </div>
                <div className="w-6 h-6 flex items-center justify-center cursor-pointer text-[#333] text-[15px] hover:text-[#555]">+</div>
                <div className="flex-1"></div>
                <button 
                  onClick={() => setTerminalOpen(false)} 
                  className="bg-transparent border-none p-1 cursor-pointer text-neutral-700 hover:text-neutral-500 flex items-center mr-1 outline-none"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                </button>
              </div>

              {/* Terminal content */}
              <div className="flex-1 overflow-auto p-2.5 font-mono text-xs leading-relaxed text-neutral-500">
                <div><span className="text-[#4ec9b0]">{username}@{host}</span><span className="text-neutral-600">:</span><span className="text-[#29ABEE]">~/projects</span><span className="text-neutral-600">$</span><span className="text-neutral-200"> ls -la</span></div>
                <div className="text-neutral-700 mt-0.5">total 48</div>
                <div><span className="text-[#29ABEE]">drwxr-xr-x</span><span className="text-neutral-600"> 9 ubuntu ubuntu 4096 Jun 13 14:22 </span><span className="text-neutral-400">.</span></div>
                <div><span className="text-neutral-600">-rw-r--r-- 1 ubuntu ubuntu 24576 Jun 13 14:21 app.js</span></div>
                <div><span className="text-neutral-600">-rw-r--r-- 1 ubuntu ubuntu  1204 Jun 12 12:00 package.json</span></div>
                <div className="mt-0.5"><span className="text-[#4ec9b0]">{username}@{host}</span><span className="text-neutral-600">:</span><span className="text-[#29ABEE]">~/projects</span><span className="text-neutral-600">$</span><span className="text-neutral-200 animate-pulse"> ▋</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connected Blue Status Bar */}
      <div className="h-5 bg-[#007acc] text-white flex items-center px-2.5 gap-3.5 shrink-0 text-[11px] font-medium border-t border-[#111] select-none text-left">
        <span>● Connected · {username}@{host}</span>
        <span className="opacity-70">{remoteCurrentDir} · {filteredRemoteFiles.length} items</span>
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
