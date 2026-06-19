import React, { useEffect, useState } from 'react';

interface FileManagerProps {
  connectionId?: number;
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
  connectionId,
  connectionName,
  username,
  host,
  sessionId,
  onDisconnect,
}) => {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [localView, setLocalView] = useState<'list' | 'grid'>('list');
  const [remoteView, setRemoteView] = useState<'list' | 'grid'>('list');
  const [remoteTabs, setRemoteTabs] = useState<{ path: string; isPinned: boolean }[]>([]);
  const [activeRemoteTabIdx, setActiveRemoteTabIdx] = useState(0);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabIdx: number } | null>(null);

  // Bookmarks state
  const [localBookmarks, setLocalBookmarks] = useState<any[]>([]);
  const [remoteBookmarks, setRemoteBookmarks] = useState<any[]>([]);
  const [isLocalBookmarksOpen, setIsLocalBookmarksOpen] = useState(false);
  const [isRemoteBookmarksOpen, setIsRemoteBookmarksOpen] = useState(false);

  // Sorting state
  const [localSortField, setLocalSortField] = useState<'name' | 'size' | 'modified'>('name');
  const [localSortAsc, setLocalSortAsc] = useState(true);
  const [remoteSortField, setRemoteSortField] = useState<'name' | 'size' | 'modified' | 'owner' | 'permissions'>('name');
  const [remoteSortAsc, setRemoteSortAsc] = useState(true);

  // Layout states
  const [localWidth, setLocalWidth] = useState(280);
  const [isDraggingSeparator, setIsDraggingSeparator] = useState(false);
  const [localColWidths, setLocalColWidths] = useState({
    name: 160,
    size: 70,
    modified: 100,
  });
  const [remoteColWidths, setRemoteColWidths] = useState({
    name: 180,
    size: 70,
    modified: 110,
    owner: 80,
    perms: 80,
  });
  const [activeResizeCol, setActiveResizeCol] = useState<{
    panel: 'local' | 'remote';
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const localColWidthsRef = React.useRef(localColWidths);
  const remoteColWidthsRef = React.useRef(remoteColWidths);

  useEffect(() => {
    localColWidthsRef.current = localColWidths;
  }, [localColWidths]);

  useEffect(() => {
    remoteColWidthsRef.current = remoteColWidths;
  }, [remoteColWidths]);

  const saveLayoutSettings = async (updates: any) => {
    if (!connectionId) return;
    try {
      await window.electronAPI.settings.updateConnectionSettings(connectionId, updates);
    } catch (err) {
      console.error('Failed to update connection settings', err);
    }
  };

  // Load layout settings and bookmarks
  useEffect(() => {
    const loadLayoutAndBookmarks = async () => {
      if (!connectionId) return;
      try {
        const settings = await window.electronAPI.settings.getConnectionSettings(connectionId);
        if (settings) {
          setLocalCollapsed(settings.localPanelCollapsed);
          setLocalSortField(settings.localSortField || 'name');
          setLocalSortAsc(settings.localSortAsc !== undefined ? settings.localSortAsc : true);
          setLocalSearch(settings.localFilterText || '');
          setRemoteSortField(settings.remoteSortField || 'name');
          setRemoteSortAsc(settings.remoteSortAsc !== undefined ? settings.remoteSortAsc : true);
          setRemoteSearch(settings.remoteFilterText || '');
          
          if (settings.localColName) {
            setLocalColWidths({
              name: settings.localColName,
              size: settings.localColSize || 70,
              modified: settings.localColModified || 100,
            });
            setLocalWidth(settings.localColName + (settings.localColSize || 70) + (settings.localColModified || 100) + 30);
          }
          if (settings.remoteColName) {
            setRemoteColWidths({
              name: settings.remoteColName,
              size: settings.remoteColSize || 70,
              modified: settings.remoteColModified || 110,
              owner: settings.remoteColOwner || 80,
              perms: settings.remoteColRights || 80,
            });
          }
        }

        // Load Bookmarks
        const lBookmarks = await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL');
        setLocalBookmarks(lBookmarks);
        const rBookmarks = await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE');
        setRemoteBookmarks(rBookmarks);
      } catch (err) {
        console.error('Failed to load layout/bookmarks settings', err);
      }
    };

    loadLayoutAndBookmarks();
  }, [connectionId]);

  const handleSeparatorMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSeparator(true);
  };

  const handleResizeStart = (e: React.MouseEvent, panel: 'local' | 'remote', column: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveResizeCol({
      panel,
      column,
      startX: e.clientX,
      startWidth: currentWidth,
    });
  };

  useEffect(() => {
    if (!isDraggingSeparator) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(600, e.clientX));
      setLocalWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsDraggingSeparator(false);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSeparator]);

  useEffect(() => {
    if (!activeResizeCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - activeResizeCol.startX;
      const newWidth = Math.max(50, activeResizeCol.startWidth + deltaX);
      if (activeResizeCol.panel === 'local') {
        setLocalColWidths(prev => ({
          ...prev,
          [activeResizeCol.column]: newWidth,
        }));
      } else {
        setRemoteColWidths(prev => ({
          ...prev,
          [activeResizeCol.column]: newWidth,
        }));
      }
    };
    const handleMouseUp = () => {
      if (activeResizeCol) {
        if (activeResizeCol.panel === 'local') {
          saveLayoutSettings({
            localColName: localColWidthsRef.current.name,
            localColSize: localColWidthsRef.current.size,
            localColModified: localColWidthsRef.current.modified,
          });
        } else {
          saveLayoutSettings({
            remoteColName: remoteColWidthsRef.current.name,
            remoteColSize: remoteColWidthsRef.current.size,
            remoteColModified: remoteColWidthsRef.current.modified,
            remoteColOwner: remoteColWidthsRef.current.owner,
            remoteColRights: remoteColWidthsRef.current.perms,
          });
        }
      }
      setActiveResizeCol(null);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeResizeCol]);


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

  const activeRemoteTabIdxRef = React.useRef(activeRemoteTabIdx);
  useEffect(() => {
    activeRemoteTabIdxRef.current = activeRemoteTabIdx;
  }, [activeRemoteTabIdx]);

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

      setRemoteTabs(prev => {
        const next = [...prev];
        const currentIdx = activeRemoteTabIdxRef.current;
        if (next[currentIdx]) {
          next[currentIdx] = { ...next[currentIdx], path: dirPath };
          if (next[currentIdx].isPinned && connectionId) {
            const pinnedOnly = next
              .map((t, idx) => ({ path: t.path, tabOrder: idx, isActive: idx === currentIdx, isPinned: t.isPinned }))
              .filter(t => t.isPinned);
            window.electronAPI.settings.saveRemoteTabs(connectionId, pinnedOnly).catch(console.error);
          }
        }
        return next;
      });
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

        let localPath = lHome;
        let remotePath = rHome;

        if (connectionId) {
          try {
            const lBookmarks = await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL');
            const defaultLocal = lBookmarks.find((b: any) => b.isDefault);
            if (defaultLocal) {
              localPath = defaultLocal.path;
            }
            
            const rBookmarks = await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE');
            const defaultRemote = rBookmarks.find((b: any) => b.isDefault);
            if (defaultRemote) {
              remotePath = defaultRemote.path;
            }
          } catch (e) {
            console.error('Failed to load default bookmarks', e);
          }
        }

        await Promise.all([
          loadLocalDirectory(localPath),
          loadRemoteDirectory(remotePath),
        ]);
      } catch (err: any) {
        setErrorMsg(`Initialization failed: ${err.message}`);
      } finally {
        setLocalLoading(false);
        setRemoteLoading(false);
      }
    };

    initDirs();
  }, [sessionId, connectionId]);

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

  const savePinnedTabsToDb = async (currentTabs: { path: string; isPinned: boolean }[], activeIdx: number) => {
    if (!connectionId) return;
    const pinnedOnly = currentTabs
      .map((t, idx) => ({ path: t.path, tabOrder: idx, isActive: idx === activeIdx, isPinned: t.isPinned }))
      .filter(t => t.isPinned);
    try {
      await window.electronAPI.settings.saveRemoteTabs(connectionId, pinnedOnly);
    } catch (err) {
      console.error('Failed to save pinned tabs', err);
    }
  };

  useEffect(() => {
    const initRemoteTabs = async () => {
      if (!connectionId) return;
      try {
        const savedTabs = await window.electronAPI.settings.getRemoteTabs(connectionId);
        if (savedTabs && savedTabs.length > 0) {
          const mapped = savedTabs.map((t: any) => ({
            path: t.path,
            isPinned: true
          }));
          setRemoteTabs(mapped);
          const activeIdx = savedTabs.findIndex((t: any) => t.isActive === 1);
          const finalIdx = activeIdx >= 0 ? activeIdx : 0;
          setActiveRemoteTabIdx(finalIdx);
          if (localCollapsed && mapped[finalIdx]) {
            loadRemoteDirectory(mapped[finalIdx].path);
          }
        } else {
          const defaultPath = remoteCurrentDir || remoteHome || '/';
          setRemoteTabs([{ path: defaultPath, isPinned: false }]);
          setActiveRemoteTabIdx(0);
        }
      } catch (err) {
        console.error('Failed to load remote tabs', err);
      }
    };

    if (localCollapsed) {
      initRemoteTabs();
    }
  }, [connectionId, localCollapsed]);

  const handleSelectTab = (idx: number) => {
    setActiveRemoteTabIdx(idx);
    const tab = remoteTabs[idx];
    if (tab) {
      loadRemoteDirectory(tab.path);
    }
  };

  const handleAddTab = () => {
    const newPath = remoteCurrentDir || remoteHome || '/';
    const nextTabs = [...remoteTabs, { path: newPath, isPinned: false }];
    setRemoteTabs(nextTabs);
    setActiveRemoteTabIdx(nextTabs.length - 1);
    loadRemoteDirectory(newPath);
  };

  const handleCloseRemoteTab = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (remoteTabs.length <= 1) return;
    const nextTabs = remoteTabs.filter((_, i) => i !== idx);
    let nextIdx = activeRemoteTabIdx;
    if (idx <= activeRemoteTabIdx) {
      nextIdx = Math.max(0, activeRemoteTabIdx - 1);
    }
    setRemoteTabs(nextTabs);
    setActiveRemoteTabIdx(nextIdx);
    if (nextTabs[nextIdx]) {
      loadRemoteDirectory(nextTabs[nextIdx].path);
    }
    savePinnedTabsToDb(nextTabs, nextIdx);
  };

  const handleDuplicateTab = (idx: number) => {
    const tabToDup = remoteTabs[idx];
    if (!tabToDup) return;
    const nextTabs = [...remoteTabs];
    nextTabs.splice(idx + 1, 0, { path: tabToDup.path, isPinned: false });
    setRemoteTabs(nextTabs);
    setActiveRemoteTabIdx(idx + 1);
    savePinnedTabsToDb(nextTabs, idx + 1);
  };

  const handleTogglePinTab = (idx: number) => {
    const nextTabs = remoteTabs.map((t, i) => i === idx ? { ...t, isPinned: !t.isPinned } : t);
    setRemoteTabs(nextTabs);
    savePinnedTabsToDb(nextTabs, activeRemoteTabIdx);
  };

  const handleTabContextMenu = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    setTabContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabIdx: idx
    });
  };

  useEffect(() => {
    const hideMenu = () => setTabContextMenu(null);
    document.addEventListener('click', hideMenu);
    return () => document.removeEventListener('click', hideMenu);
  }, []);

  const toggleLocalSort = (field: 'name' | 'size' | 'modified') => {
    let nextAsc = true;
    if (localSortField === field) {
      nextAsc = !localSortAsc;
    }
    setLocalSortField(field);
    setLocalSortAsc(nextAsc);
    saveLayoutSettings({ localSortField: field, localSortAsc: nextAsc });
  };

  const toggleRemoteSort = (field: 'name' | 'size' | 'modified' | 'owner' | 'permissions') => {
    let nextAsc = true;
    if (remoteSortField === field) {
      nextAsc = !remoteSortAsc;
    }
    setRemoteSortField(field);
    setRemoteSortAsc(nextAsc);
    saveLayoutSettings({ remoteSortField: field, remoteSortAsc: nextAsc });
  };

  const sortLocalFiles = (files: LocalFile[], field: 'name' | 'size' | 'modified', asc: boolean) => {
    return [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let comparison = 0;
      if (field === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (field === 'size') {
        comparison = a.size - b.size;
      } else if (field === 'modified') {
        comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      }
      return asc ? comparison : -comparison;
    });
  };

  const sortRemoteFiles = (files: RemoteFile[], field: 'name' | 'size' | 'modified' | 'owner' | 'permissions', asc: boolean) => {
    return [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let comparison = 0;
      if (field === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (field === 'size') {
        comparison = a.size - b.size;
      } else if (field === 'modified') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (field === 'owner') {
        comparison = a.owner.localeCompare(b.owner);
      } else if (field === 'permissions') {
        comparison = a.permissions.localeCompare(b.permissions);
      }
      return asc ? comparison : -comparison;
    });
  };

  // Filter and sort lists based on parameters
  const sortedLocalFiles = sortLocalFiles(
    localFiles.filter(f => f.name.toLowerCase().includes(localSearch.toLowerCase())),
    localSortField,
    localSortAsc
  );

  const sortedRemoteFiles = sortRemoteFiles(
    remoteFiles.filter(f => f.name.toLowerCase().includes(remoteSearch.toLowerCase())),
    remoteSortField,
    remoteSortAsc
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
          <div 
            style={{ width: `${localWidth}px` }}
            className="flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 overflow-hidden theme-transition"
          >
            {/* Panel Label & Path */}
            <div className="h-[28px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2.5 gap-1.5 shrink-0 theme-transition">
              <span className="text-[10px] font-bold text-[var(--text-subtle)] uppercase tracking-widest flex-shrink-0">Local</span>
              <span className="text-[11px] font-mono text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={localCurrentDir}>
                {localCurrentDir}
              </span>
              <button 
                onClick={() => {
                  setLocalCollapsed(true);
                  saveLayoutSettings({ localPanelCollapsed: true });
                }} 
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
              </button>              <div className="relative shrink-0">
                <button 
                  onClick={() => setIsLocalBookmarksOpen(!isLocalBookmarksOpen)} 
                  title="Bookmarks" 
                  className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-colors ${isLocalBookmarksOpen ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
                >
                  <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z" fill={localBookmarks.length > 0 ? "currentColor" : "none"}/></svg>
                </button>
                {isLocalBookmarksOpen && (
                  <div className="absolute left-0 mt-1 w-64 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[4px] shadow-lg z-50 py-1.5 text-xs text-[var(--text-main)] font-sans">
                    <div className="px-3 py-1.5 border-b border-[var(--border-color)] font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Local Bookmarks</div>
                    <button 
                      onClick={async () => {
                        if (connectionId && localCurrentDir) {
                          await window.electronAPI.settings.addBookmark(connectionId, 'LOCAL', localCurrentDir);
                          const list = await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL');
                          setLocalBookmarks(list);
                          setIsLocalBookmarksOpen(false);
                        }
                      }}
                      className="w-full text-left px-3 py-2 bg-transparent hover:bg-[var(--glow-color)]/25 border-none text-[var(--text-main)] cursor-pointer flex items-center gap-1.5 outline-none font-semibold text-xs transition-colors"
                    >
                      + Bookmark current directory
                    </button>
                    <div className="border-t border-[var(--border-color)]/50 my-1"></div>
                    <div className="max-h-48 overflow-y-auto">
                      {localBookmarks.length > 0 ? (
                        localBookmarks.map((bm) => (
                          <div key={bm.id} className="px-3 py-1.5 flex items-center justify-between hover:bg-[var(--glow-color)]/10">
                            <span 
                              onClick={() => {
                                loadLocalDirectory(bm.path);
                                setIsLocalBookmarksOpen(false);
                              }}
                              className="font-mono overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer flex-1 pr-2 hover:text-[var(--color-primary)] text-left"
                              title={bm.path}
                            >
                              {bm.path}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <button 
                                onClick={async () => {
                                  if (connectionId) {
                                    await window.electronAPI.settings.setDefaultBookmark(connectionId, 'LOCAL', bm.isDefault ? -1 : bm.id);
                                    const list = await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL');
                                    setLocalBookmarks(list);
                                  }
                                }}
                                className={`bg-transparent border-none cursor-pointer p-0.5 outline-none text-sm leading-none ${bm.isDefault ? 'text-amber-500' : 'text-[var(--text-subtle)] hover:text-amber-500'}`}
                                title={bm.isDefault ? "Default bookmark" : "Set as default"}
                              >
                                ★
                              </button>
                              <button 
                                onClick={async () => {
                                  await window.electronAPI.settings.deleteBookmark(bm.id);
                                  const list = await window.electronAPI.settings.getBookmarks(connectionId!, 'LOCAL');
                                  setLocalBookmarks(list);
                                }}
                                className="bg-transparent border-none cursor-pointer text-[var(--text-subtle)] hover:text-red-500 p-0.5 outline-none font-bold"
                                title="Remove Bookmark"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-center text-[var(--text-subtle)]">No bookmarks saved.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
              <button 
                onClick={() => toggleLocalSort('name')} 
                className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-1 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
              >
                Name {localSortField === 'name' ? (localSortAsc ? '▲' : '▼') : '↕'}
              </button>
              <button 
                onClick={() => toggleLocalSort('size')} 
                className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-2 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
              >
                Size {localSortField === 'size' ? (localSortAsc ? '▲' : '▼') : '↕'}
              </button>
              <button 
                onClick={() => toggleLocalSort('modified')} 
                className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-2 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
              >
                Modified {localSortField === 'modified' ? (localSortAsc ? '▲' : '▼') : '↕'}
              </button>
            </div>

            {/* Local Files View */}
            <div className="flex-1 overflow-y-auto">
              {localLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">Loading...</div>
              ) : localView === 'list' ? (
                <div className="flex-1 overflow-auto h-full">
                  <table className="w-full border-collapse text-[13px] table-fixed">
                    <colgroup>
                      <col style={{ width: '26px' }} />
                      <col style={{ width: `${localColWidths.name}px` }} />
                      <col style={{ width: `${localColWidths.size}px` }} />
                      <col style={{ width: `${localColWidths.modified}px` }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-[var(--bg-panel-header)] z-10 border-b border-[var(--border-color)]">
                      <tr className="h-[28px] text-[12px] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                        <th className="py-1 pl-2 text-left"></th>
                        <th 
                          onClick={() => toggleLocalSort('name')}
                          className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                        >
                          Name {localSortField === 'name' ? (localSortAsc ? '▲' : '▼') : ''}
                          <div 
                            onMouseDown={(e) => handleResizeStart(e, 'local', 'name', localColWidths.name)} 
                            className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                          />
                        </th>
                        <th 
                          onClick={() => toggleLocalSort('size')}
                          className="relative text-right px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                        >
                          Size {localSortField === 'size' ? (localSortAsc ? '▲' : '▼') : ''}
                          <div 
                            onMouseDown={(e) => handleResizeStart(e, 'local', 'size', localColWidths.size)} 
                            className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                          />
                        </th>
                        <th 
                          onClick={() => toggleLocalSort('modified')}
                          className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                        >
                          Modified {localSortField === 'modified' ? (localSortAsc ? '▲' : '▼') : ''}
                          <div 
                            onMouseDown={(e) => handleResizeStart(e, 'local', 'modified', localColWidths.modified)} 
                            className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLocalFiles.map((lf, i) => (
                        <tr 
                          key={i} 
                          onDoubleClick={() => handleLocalDblClick(lf)}
                          className="hover:bg-[var(--glow-color)]/25 active:bg-[var(--glow-color)]/50 cursor-default h-[30px] transition-colors duration-75 border-b border-[var(--border-color)]/50"
                        >
                          <td className="pl-1.5 text-center align-middle">
                            {lf.isDirectory ? (
                              <svg width="14" height="12" viewBox="0 0 16 14" fill="none"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85"/></svg>
                            ) : (
                              <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M0 0h8l4 4v10H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M8 0l4 4H8z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                            )}
                          </td>
                          <td className="px-2 text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap align-middle" title={lf.name}>{lf.name}</td>
                          <td className="px-2 text-right text-[var(--text-muted)] font-mono text-[12px] align-middle whitespace-nowrap">{formatSize(lf.size)}</td>
                          <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{lf.modified}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-1.5 flex flex-wrap gap-0.5 content-start items-start">
                  {sortedLocalFiles.map((lf, i) => (
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
              <span>{sortedLocalFiles.length} items</span>
            </div>
          </div>
        ) : (
          // Collapsed Local Strip
          <div 
            onClick={() => {
              setLocalCollapsed(false);
              saveLayoutSettings({ localPanelCollapsed: false });
            }}
            className="w-5 bg-[var(--bg-panel-header)] border-r border-[var(--border-color)] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[var(--bg-panel)] theme-transition"
            title="Expand local panel"
          >
            <div className="writing-mode-vertical text-[9px] text-[var(--text-subtle)] tracking-widest uppercase rotate-180 font-bold select-none">Local</div>
          </div>
        )}

        {/* Resize Handle Visual Separator */}
        <div 
          onMouseDown={handleSeparatorMouseDown}
          className={`w-[4px] cursor-col-resize shrink-0 transition-colors ${isDraggingSeparator ? 'bg-[var(--color-primary)]' : 'bg-[var(--border-color)] hover:bg-[var(--color-primary)]/50'}`}
        ></div>

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
            <div className="h-[26px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-end overflow-hidden shrink-0 theme-transition select-none">
              {remoteTabs.map((tab, i) => {
                const isActive = activeRemoteTabIdx === i;
                const pathParts = tab.path.split('/').filter(Boolean);
                const folderName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '/';
                return (
                  <div 
                    key={i}
                    onClick={() => handleSelectTab(i)} 
                    onContextMenu={(e) => handleTabContextMenu(e, i)}
                    className={`h-6 px-2.5 flex items-center gap-1.5 text-[11.5px] cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t transition-all ${
                      isActive 
                        ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t border-t-[var(--color-primary)] font-semibold' 
                        : 'bg-transparent text-[var(--text-muted)] border-t-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]/40'
                    }`}
                    title={tab.path}
                  >
                    <span>{tab.isPinned ? '📌 ' : ''}{folderName}</span>
                    <span 
                      onClick={(e) => handleCloseRemoteTab(i, e)}
                      className="text-[var(--text-subtle)] hover:text-[var(--text-main)] text-[13px] font-bold ml-1 cursor-pointer"
                    >
                      ×
                    </span>
                  </div>
                );
              })}
              <div 
                onClick={handleAddTab}
                className="w-6 h-6 flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] text-[16px] shrink-0 border-b border-b-[var(--border-color)]"
                title="New Remote Tab"
              >
                +
              </div>
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
            <div className="relative shrink-0">
              <button 
                onClick={() => setIsRemoteBookmarksOpen(!isRemoteBookmarksOpen)} 
                title="Bookmarks" 
                className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-colors ${isRemoteBookmarksOpen ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
              >
                <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z" fill={remoteBookmarks.length > 0 ? "currentColor" : "none"}/></svg>
              </button>
              {isRemoteBookmarksOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[4px] shadow-lg z-50 py-1.5 text-xs text-[var(--text-main)] font-sans">
                  <div className="px-3 py-1.5 border-b border-[var(--border-color)] font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Remote Bookmarks</div>
                  <button 
                    onClick={async () => {
                      if (connectionId && remoteCurrentDir) {
                        await window.electronAPI.settings.addBookmark(connectionId, 'REMOTE', remoteCurrentDir);
                        const list = await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE');
                        setRemoteBookmarks(list);
                        setIsRemoteBookmarksOpen(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 bg-transparent hover:bg-[var(--glow-color)]/25 border-none text-[var(--text-main)] cursor-pointer flex items-center gap-1.5 outline-none font-semibold text-xs transition-colors"
                  >
                    + Bookmark current directory
                  </button>
                  <div className="border-t border-[var(--border-color)]/50 my-1"></div>
                  <div className="max-h-48 overflow-y-auto">
                    {remoteBookmarks.length > 0 ? (
                      remoteBookmarks.map((bm) => (
                        <div key={bm.id} className="px-3 py-1.5 flex items-center justify-between hover:bg-[var(--glow-color)]/10">
                          <span 
                            onClick={() => {
                              loadRemoteDirectory(bm.path);
                              setIsRemoteBookmarksOpen(false);
                            }}
                            className="font-mono overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer flex-1 pr-2 hover:text-[var(--color-primary)] text-left"
                            title={bm.path}
                          >
                            {bm.path}
                          </span>
                          <div className="flex gap-1.5 shrink-0">
                            <button 
                              onClick={async () => {
                                if (connectionId) {
                                  await window.electronAPI.settings.setDefaultBookmark(connectionId, 'REMOTE', bm.isDefault ? -1 : bm.id);
                                  const list = await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE');
                                  setRemoteBookmarks(list);
                                }
                              }}
                              className={`bg-transparent border-none cursor-pointer p-0.5 outline-none text-sm leading-none ${bm.isDefault ? 'text-amber-500' : 'text-[var(--text-subtle)] hover:text-amber-500'}`}
                              title={bm.isDefault ? "Default bookmark" : "Set as default"}
                            >
                              ★
                            </button>
                            <button 
                              onClick={async () => {
                                await window.electronAPI.settings.deleteBookmark(bm.id);
                                const list = await window.electronAPI.settings.getBookmarks(connectionId!, 'REMOTE');
                                setRemoteBookmarks(list);
                              }}
                              className="bg-transparent border-none cursor-pointer text-[var(--text-subtle)] hover:text-red-500 p-0.5 outline-none font-bold"
                              title="Remove Bookmark"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-center text-[var(--text-subtle)]">No bookmarks saved.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
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

          {/* Sort Bar */}
          <div className="h-[22px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2 shrink-0 theme-transition">
            <span className="text-[11px] text-[var(--text-muted)]">Sort:</span>
            <button 
              onClick={() => toggleRemoteSort('name')} 
              className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-1 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
            >
              Name {remoteSortField === 'name' ? (remoteSortAsc ? '▲' : '▼') : '↕'}
            </button>
            <button 
              onClick={() => toggleRemoteSort('size')} 
              className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-2 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
            >
              Size {remoteSortField === 'size' ? (remoteSortAsc ? '▲' : '▼') : '↕'}
            </button>
            <button 
              onClick={() => toggleRemoteSort('modified')} 
              className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-2 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
            >
              Modified {remoteSortField === 'modified' ? (remoteSortAsc ? '▲' : '▼') : '↕'}
            </button>
            <button 
              onClick={() => toggleRemoteSort('owner')} 
              className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-2 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
            >
              Owner {remoteSortField === 'owner' ? (remoteSortAsc ? '▲' : '▼') : '↕'}
            </button>
            <button 
              onClick={() => toggleRemoteSort('permissions')} 
              className="bg-transparent border-none text-[11px] text-[var(--text-main)] ml-2 cursor-pointer hover:text-[var(--text-main)] font-semibold outline-none"
            >
              Perms {remoteSortField === 'permissions' ? (remoteSortAsc ? '▲' : '▼') : '↕'}
            </button>
          </div>

          {/* Remote Files list content */}
          <div className="flex-1 overflow-auto h-full">
            {remoteLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">Loading...</div>
            ) : remoteView === 'list' ? (
              <table className="w-full border-collapse text-[13px] table-fixed">
                <colgroup>
                  <col style={{ width: '26px' }} />
                  <col style={{ width: `${remoteColWidths.name}px` }} />
                  <col style={{ width: `${remoteColWidths.size}px` }} />
                  <col style={{ width: `${remoteColWidths.modified}px` }} />
                  <col style={{ width: `${remoteColWidths.owner}px` }} />
                  <col style={{ width: `${remoteColWidths.perms}px` }} />
                </colgroup>
                <thead className="sticky top-0 bg-[var(--bg-panel-header)] z-10 border-b border-[var(--border-color)]">
                  <tr className="h-[28px] text-[12px] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <th className="py-1 pl-2 text-left"><input type="checkbox" className="w-[11px] h-[11px] accent-[var(--color-primary)] cursor-pointer"/></th>
                    <th 
                      onClick={() => toggleRemoteSort('name')}
                      className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                    >
                      Name {remoteSortField === 'name' ? (remoteSortAsc ? '▲' : '▼') : ''}
                      <div 
                        onMouseDown={(e) => handleResizeStart(e, 'remote', 'name', remoteColWidths.name)} 
                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                      />
                    </th>
                    <th 
                      onClick={() => toggleRemoteSort('size')}
                      className="relative text-right px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                    >
                      Size {remoteSortField === 'size' ? (remoteSortAsc ? '▲' : '▼') : ''}
                      <div 
                        onMouseDown={(e) => handleResizeStart(e, 'remote', 'size', remoteColWidths.size)} 
                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                      />
                    </th>
                    <th 
                      onClick={() => toggleRemoteSort('modified')}
                      className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                    >
                      Modified {remoteSortField === 'modified' ? (remoteSortAsc ? '▲' : '▼') : ''}
                      <div 
                        onMouseDown={(e) => handleResizeStart(e, 'remote', 'modified', remoteColWidths.modified)} 
                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                      />
                    </th>
                    <th 
                      onClick={() => toggleRemoteSort('owner')}
                      className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                    >
                      Owner {remoteSortField === 'owner' ? (remoteSortAsc ? '▲' : '▼') : ''}
                      <div 
                        onMouseDown={(e) => handleResizeStart(e, 'remote', 'owner', remoteColWidths.owner)} 
                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                      />
                    </th>
                    <th 
                      onClick={() => toggleRemoteSort('permissions')}
                      className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                    >
                      Perms {remoteSortField === 'permissions' ? (remoteSortAsc ? '▲' : '▼') : ''}
                      <div 
                        onMouseDown={(e) => handleResizeStart(e, 'remote', 'perms', remoteColWidths.perms)} 
                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRemoteFiles.map((rf, i) => (
                    <tr 
                      key={i} 
                      onDoubleClick={() => handleRemoteDblClick(rf)}
                      className="h-[30px] cursor-default transition-colors duration-75 border-b border-[var(--border-color)]/50 hover:bg-[var(--glow-color)]/25 active:bg-[var(--glow-color)]/50"
                    >
                      <td className="pl-2 align-middle">
                        <input 
                          type="checkbox" 
                          onChange={() => {}}
                          className="w-[11px] h-[11px] accent-[var(--color-primary)] cursor-pointer"
                        />
                      </td>
                      <td className="px-2 align-middle">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {rf.isDirectory ? (
                            <svg width="14" height="12" viewBox="0 0 16 14" fill="none" className="shrink-0"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85"/></svg>
                          ) : (
                            <svg width="12" height="14" viewBox="0 0 12 14" fill="none" className="shrink-0"><path d="M0 0h8l4 4v10H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M8 0l4 4H8z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                          )}
                          <span className="text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap" title={rf.name}>{rf.name}</span>
                        </div>
                      </td>
                      <td className="px-2 text-right text-[var(--text-muted)] font-mono text-[12px] align-middle whitespace-nowrap">{formatSize(rf.size)}</td>
                      <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{rf.date}</td>
                      <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{rf.owner}</td>
                      <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{rf.permissions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-2 flex flex-wrap gap-0.5 content-start items-start">
                {sortedRemoteFiles.map((rf, i) => (
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
            <span>{sortedRemoteFiles.length} items</span>
          </div>

        </div>
      </div>

      {/* Connected Blue Status Bar */}
      <div className="h-5 bg-[var(--color-primary)] text-white flex items-center px-2.5 gap-3.5 shrink-0 text-[11px] font-medium border-t border-[var(--border-color)] select-none text-left">
        <span>● Connected · {username}@{host}</span>
        <span className="opacity-75">{remoteCurrentDir} · {sortedRemoteFiles.length} items</span>
        <div className="flex-1"></div>
        <button 
          onClick={onDisconnect} 
          className="bg-transparent border-none text-white hover:text-white/80 cursor-pointer font-bold select-none outline-none mr-2"
        >
          Disconnect Session
        </button>
      </div>
      {/* Remote Tab Right-Click Context Menu */}
      {tabContextMenu && (
        <div 
          style={{ top: `${tabContextMenu.y}px`, left: `${tabContextMenu.x}px` }}
          className="fixed bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[3px] shadow-lg py-1 z-[100] w-36 text-xs text-[var(--text-main)] font-sans"
        >
          <button 
            onClick={() => handleTogglePinTab(tabContextMenu.tabIdx)}
            className="w-full text-left px-3 py-1.5 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-xs text-left"
          >
            {remoteTabs[tabContextMenu.tabIdx]?.isPinned ? '📌 Unpin Tab' : '📌 Pin Tab'}
          </button>
          <button 
            onClick={() => handleDuplicateTab(tabContextMenu.tabIdx)}
            className="w-full text-left px-3 py-1.5 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-xs border-t border-[var(--border-color)]/50 text-left"
          >
            📋 Duplicate Tab
          </button>
        </div>
      )}
    </div>
  );
};

export default FileManager;
