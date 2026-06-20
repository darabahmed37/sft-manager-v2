import React, { useEffect, useState } from 'react';
import { PropertiesModal } from './PropertiesModal';
import { ExplorerPanel } from './ExplorerPanel';
import { useFolderHistory } from '../hooks/useFolderHistory';
import type { LocalFile, RemoteFile, Bookmark, ConnectionSettings } from '../global';

interface FileManagerProps {
  connectionId?: number;
  connectionName: string;
  username: string;
  host: string;
  sessionId: string;
  onDisconnect: () => void;
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

  // Clipboard state
  const [clipboard, setClipboard] = useState<{
    type: 'copy' | 'cut';
    pane: 'local' | 'remote';
    dir: string;
    items: { name: string; isDirectory: boolean }[];
  } | null>(null);

  // Explorer Item/Space Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    pane: 'local' | 'remote';
    item: LocalFile | RemoteFile | null; // null for blank space click
  } | null>(null);

  // Properties modal trigger state
  const [propertiesFile, setPropertiesFile] = useState<{
    pane: 'local' | 'remote';
    file: {
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modified: string;
      owner?: string;
      permissions?: string;
    };
  } | null>(null);

  // Bookmarks state
  const [localBookmarks, setLocalBookmarks] = useState<Bookmark[]>([]);
  const [remoteBookmarks, setRemoteBookmarks] = useState<Bookmark[]>([]);
  const [isLocalBookmarksOpen, setIsLocalBookmarksOpen] = useState(false);
  const [isRemoteBookmarksOpen, setIsRemoteBookmarksOpen] = useState(false);

  // Sorting state
  const [localSortField, setLocalSortField] = useState<'name' | 'size' | 'modified'>('name');
  const [localSortAsc, setLocalSortAsc] = useState(true);
  const [remoteSortField, setRemoteSortField] = useState<'name' | 'size' | 'modified' | 'owner' | 'permissions'>('name');
  const [remoteSortAsc, setRemoteSortAsc] = useState(true);

  // Layout states
  const [localWidthPercent, setLocalWidthPercent] = useState(50.0);
  const [isDraggingSeparator, setIsDraggingSeparator] = useState(false);

  // Active panel and selected items state
  const [activePanel, setActivePanel] = useState<'local' | 'remote'>('local');
  const [selectedLocalFile, setSelectedLocalFile] = useState<LocalFile | null>(null);
  const [selectedRemoteFile, setSelectedRemoteFile] = useState<RemoteFile | null>(null);

  // Drag and drop target states
  const [dragOverLocalRow, setDragOverLocalRow] = useState<string | null>(null);
  const [dragOverRemoteRow, setDragOverRemoteRow] = useState<string | null>(null);

  // Column resizing state
  const [localColWidths, setLocalColWidths] = useState({
    name: 200,
    size: 70,
    modified: 100,
  });
  const [remoteColWidths, setRemoteColWidths] = useState({
    name: 220,
    size: 70,
    modified: 130,
    owner: 80,
  });
  const [activeResizeCol, setActiveResizeCol] = useState<{
    panel: 'local' | 'remote';
    column: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Multi-select state
  const [localSelectedFiles, setLocalSelectedFiles] = useState<(LocalFile | RemoteFile)[]>([]);
  const [remoteSelectedFiles, setRemoteSelectedFiles] = useState<(LocalFile | RemoteFile)[]>([]);

  // Directory hooks
  const localHistory = useFolderHistory('');
  const remoteHistory = useFolderHistory('');

  // Files lists
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [localSearch, setLocalSearch] = useState('');
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [remoteSearch, setRemoteSearch] = useState('');

  // Loading states
  const [localLoading, setLocalLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const localColWidthsRef = React.useRef(localColWidths);
  const remoteColWidthsRef = React.useRef(remoteColWidths);
  const localWidthPercentRef = React.useRef(localWidthPercent);

  useEffect(() => { localColWidthsRef.current = localColWidths; }, [localColWidths]);
  useEffect(() => { remoteColWidthsRef.current = remoteColWidths; }, [remoteColWidths]);
  useEffect(() => { localWidthPercentRef.current = localWidthPercent; }, [localWidthPercent]);

  const saveLayoutSettings = React.useCallback(async (updates: Partial<ConnectionSettings>) => {
    if (!connectionId) return;
    try {
      await window.electronAPI.settings.updateConnectionSettings(connectionId, updates);
    } catch (err) {
      console.error('Failed to update connection settings', err);
    }
  }, [connectionId]);

  // Load layout settings and bookmarks
  useEffect(() => {
    const loadLayoutAndBookmarks = async () => {
      if (!connectionId) return;
      try {
        const settings = await window.electronAPI.settings.getConnectionSettings(connectionId);
        if (settings) {
          setLocalCollapsed(settings.localPanelCollapsed === true || settings.localPanelCollapsed === 1);
          setLocalSortField(settings.localSortField || 'name');
          setLocalSortAsc(settings.localSortAsc === true || settings.localSortAsc === 1);
          setLocalSearch(settings.localFilterText || '');
          setRemoteSortField(settings.remoteSortField || 'name');
          setRemoteSortAsc(settings.remoteSortAsc === true || settings.remoteSortAsc === 1);
          setRemoteSearch(settings.remoteFilterText || '');
          
          if (settings.localColName) {
            setLocalColWidths({
              name: settings.localColName,
              size: settings.localColSize || 70,
              modified: settings.localColModified || 100,
            });
          }
          if (settings.localPanelWidth !== undefined) {
            setLocalWidthPercent(settings.localPanelWidth);
          } else {
            setLocalWidthPercent(50.0);
          }
          if (settings.remoteColName) {
            setRemoteColWidths({
              name: settings.remoteColName,
              size: settings.remoteColSize || 70,
              modified: settings.remoteColModified || 110,
              owner: settings.remoteColOwner || 80,
            });
          }
        }

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
      const percent = (e.clientX / window.innerWidth) * 100;
      const newPercent = Math.max(5, Math.min(95, percent));
      setLocalWidthPercent(newPercent);
    };
    const handleMouseUp = () => {
      setIsDraggingSeparator(false);
      const finalPercent = localWidthPercentRef.current;
      const finalPixels = (finalPercent / 100) * window.innerWidth;
      
      if (finalPixels < 120) {
        setLocalCollapsed(true);
        saveLayoutSettings({ localPanelCollapsed: true });
      } else {
        saveLayoutSettings({ localPanelWidth: finalPercent });
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSeparator, saveLayoutSettings]);

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
  }, [activeResizeCol, saveLayoutSettings]);

  // Size formatter
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  // Directory path utilities
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

  // Directory loaders
  const loadLocalDirectory = React.useCallback(async (dirPath: string) => {
    setLocalLoading(true);
    try {
      const filesList = await window.electronAPI.fs.listDirectory(dirPath);
      const sorted = [...filesList].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setLocalFiles(sorted);
    } catch (err: unknown) {
      console.error('Failed to load local directory', err);
      setErrorMsg(`Local error: ${(err as Error).message}`);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  const activeRemoteTabIdxRef = React.useRef(activeRemoteTabIdx);
  useEffect(() => {
    activeRemoteTabIdxRef.current = activeRemoteTabIdx;
  }, [activeRemoteTabIdx]);

  const loadRemoteDirectory = React.useCallback(async (dirPath: string) => {
    setRemoteLoading(true);
    try {
      const filesList = await window.electronAPI.ssh.listDirectory(sessionId, dirPath);
      const sorted = [...filesList].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setRemoteFiles(sorted);

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
    } catch (err: unknown) {
      console.error('Failed to load remote directory', err);
      setErrorMsg(`Remote error: ${(err as Error).message}`);
    } finally {
      setRemoteLoading(false);
    }
  }, [sessionId, connectionId]);

  const changeLocalDirectory = React.useCallback(async (dirPath: string, pushState = true) => {
    setSelectedLocalFile(null);
    await localHistory.changeDirectory(dirPath, loadLocalDirectory, pushState);
  }, [localHistory, loadLocalDirectory]);

  const changeRemoteDirectory = React.useCallback(async (dirPath: string, pushState = true) => {
    setSelectedRemoteFile(null);
    await remoteHistory.changeDirectory(dirPath, loadRemoteDirectory, pushState);
  }, [remoteHistory, loadRemoteDirectory]);

  const handleLocalHistoryBack = React.useCallback(() => {
    setSelectedLocalFile(null);
    localHistory.goBack(loadLocalDirectory);
  }, [localHistory, loadLocalDirectory]);

  const handleLocalHistoryForward = React.useCallback(() => {
    setSelectedLocalFile(null);
    localHistory.goForward(loadLocalDirectory);
  }, [localHistory, loadLocalDirectory]);

  const handleRemoteHistoryBack = React.useCallback(() => {
    setSelectedRemoteFile(null);
    remoteHistory.goBack(loadRemoteDirectory);
  }, [remoteHistory, loadRemoteDirectory]);

  const handleRemoteHistoryForward = React.useCallback(() => {
    setSelectedRemoteFile(null);
    remoteHistory.goForward(loadRemoteDirectory);
  }, [remoteHistory, loadRemoteDirectory]);

  // Drag handles
  const handleLocalDragStart = (e: React.DragEvent, file: LocalFile) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      source: 'local',
      name: file.name,
      isDirectory: file.isDirectory
    }));
    const absolutePath = joinLocalPath(localHistory.currentDir, file.name);
    window.electronAPI.window.startDrag(absolutePath, 'favicon.png');
  };

  const handleRemoteDragStart = (e: React.DragEvent, file: RemoteFile) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      source: 'remote',
      name: file.name,
      isDirectory: file.isDirectory
    }));
  };

  const handleLocalDrop = async (e: React.DragEvent, folderPath?: string) => {
    e.preventDefault();
    const targetDir = folderPath || dragOverLocalRow || localHistory.currentDir;
    setDragOverLocalRow(null);

    const dataStr = e.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.source === 'remote') {
          setRemoteLoading(true);
          setLocalLoading(true);
          try {
            const src = joinRemotePath(remoteHistory.currentDir, data.name);
            if (data.isDirectory) {
              await window.electronAPI.ssh.downloadFolder(sessionId, src, targetDir);
            } else {
              await window.electronAPI.ssh.download(sessionId, src, targetDir);
            }
          } catch (err: unknown) {
            setErrorMsg(`Download failed: ${(err as Error).message}`);
          } finally {
            await loadLocalDirectory(localHistory.currentDir);
            await loadRemoteDirectory(remoteHistory.currentDir);
          }
          return;
        } else if (data.source === 'local') {
          const src = joinLocalPath(localHistory.currentDir, data.name);
          const dest = joinLocalPath(targetDir, data.name);
          if (src !== dest) {
            setLocalLoading(true);
            try {
              await window.electronAPI.fs.copy(src, dest);
            } catch (err: unknown) {
              setErrorMsg(`Copy failed: ${(err as Error).message}`);
            } finally {
              await loadLocalDirectory(localHistory.currentDir);
            }
          }
          return;
        }
      } catch { /* ignore */ }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setLocalLoading(true);
      try {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const localPath = (file as File & { path: string }).path;
          if (!localPath) continue;

          const targetPath = joinLocalPath(targetDir, file.name);
          await window.electronAPI.fs.copy(localPath, targetPath);
        }
      } catch (err: unknown) {
        setErrorMsg(`Copy failed: ${(err as Error).message}`);
      } finally {
        await loadLocalDirectory(localHistory.currentDir);
      }
    }
  };

  const handleRemoteDrop = async (e: React.DragEvent, folderPath?: string) => {
    e.preventDefault();
    const targetDir = folderPath || dragOverRemoteRow || remoteHistory.currentDir;
    setDragOverRemoteRow(null);

    const dataStr = e.dataTransfer.getData('application/json');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.source === 'local') {
          setRemoteLoading(true);
          setLocalLoading(true);
          try {
            const src = joinLocalPath(localHistory.currentDir, data.name);
            if (data.isDirectory) {
              await window.electronAPI.ssh.uploadFolder(sessionId, src, targetDir);
            } else {
              await window.electronAPI.ssh.upload(sessionId, src, targetDir);
            }
          } catch (err: unknown) {
            setErrorMsg(`Upload failed: ${(err as Error).message}`);
          } finally {
            await loadLocalDirectory(localHistory.currentDir);
            await loadRemoteDirectory(remoteHistory.currentDir);
          }
          return;
        } else if (data.source === 'remote') {
          const src = joinRemotePath(remoteHistory.currentDir, data.name);
          const dest = joinRemotePath(targetDir, data.name);
          if (src !== dest) {
            setRemoteLoading(true);
            try {
              await window.electronAPI.ssh.copy(sessionId, src, dest);
            } catch (err: unknown) {
              setErrorMsg(`Copy failed: ${(err as Error).message}`);
            } finally {
              await loadRemoteDirectory(remoteHistory.currentDir);
            }
          }
          return;
        }
      } catch { /* ignore */ }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setRemoteLoading(true);
      setLocalLoading(true);
      try {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const localPath = (file as File & { path: string }).path;
          if (!localPath) continue;

          const isDir = await window.electronAPI.fs.isDirectory(localPath);
          if (isDir) {
            await window.electronAPI.ssh.uploadFolder(sessionId, localPath, targetDir);
          } else {
            await window.electronAPI.ssh.upload(sessionId, localPath, targetDir);
          }
        }
      } catch (err: unknown) {
        setErrorMsg(`Upload failed: ${(err as Error).message}`);
      } finally {
        await loadLocalDirectory(localHistory.currentDir);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    }
  };

  // Init folders
  useEffect(() => {
    const initDirs = async () => {
      try {
        setLocalLoading(true);
        setRemoteLoading(true);

        const lHome = await window.electronAPI.fs.getHomeDir();
        const rHome = await window.electronAPI.ssh.getHomeDir(sessionId);

        let localPath = lHome;
        let remotePath = rHome;

        if (connectionId) {
          try {
            const lBookmarks = await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL');
            const defaultLocal = lBookmarks.find((b) => b.isDefault);
            if (defaultLocal) {
              localPath = defaultLocal.path;
            }
            
            const rBookmarks = await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE');
            const defaultRemote = rBookmarks.find((b) => b.isDefault);
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

        localHistory.resetHistory(localPath);
        remoteHistory.resetHistory(remotePath);
      } catch (err: unknown) {
        setErrorMsg(`Initialization failed: ${(err as Error).message}`);
      } finally {
        setLocalLoading(false);
        setRemoteLoading(false);
      }
    };

    initDirs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, connectionId]);

  const handleLocalDblClick = (file: LocalFile) => {
    if (file.isDirectory) {
      changeLocalDirectory(joinLocalPath(localHistory.currentDir, file.name));
    }
  };

  const handleRemoteDblClick = (file: RemoteFile) => {
    if (file.isDirectory) {
      changeRemoteDirectory(joinRemotePath(remoteHistory.currentDir, file.name));
    }
  };

  const handleLocalUp = () => {
    const parent = getParentLocal(localHistory.currentDir);
    if (parent !== localHistory.currentDir) {
      changeLocalDirectory(parent);
    }
  };

  const handleRemoteUp = () => {
    const parent = getParentRemote(remoteHistory.currentDir);
    if (parent !== remoteHistory.currentDir) {
      changeRemoteDirectory(parent);
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

  // Remote Tabs Load
  useEffect(() => {
    const initRemoteTabs = async () => {
      if (!connectionId) return;
      try {
        const savedTabs = await window.electronAPI.settings.getRemoteTabs(connectionId);
        if (savedTabs && savedTabs.length > 0) {
          const mapped = savedTabs.map((t) => ({
            path: t.path,
            isPinned: !!t.isPinned
          }));
          setRemoteTabs(mapped);
          const activeIdx = savedTabs.findIndex((t) => t.isActive === 1 || t.isActive === true);
          const finalIdx = activeIdx >= 0 ? activeIdx : 0;
          setActiveRemoteTabIdx(finalIdx);
          if (localCollapsed && mapped[finalIdx]) {
            changeRemoteDirectory(mapped[finalIdx].path, true);
          }
        } else {
          setRemoteTabs(prev => {
            if (prev.length > 0) return prev;
            const defaultPath = remoteHistory.currentDir || '/';
            return [{ path: defaultPath, isPinned: false }];
          });
          setActiveRemoteTabIdx(0);
        }
      } catch (err) {
        console.error('Failed to load remote tabs', err);
      }
    };

    if (localCollapsed) {
      initRemoteTabs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, localCollapsed]);

  const handleSelectTab = (idx: number) => {
    setActiveRemoteTabIdx(idx);
    const tab = remoteTabs[idx];
    if (tab) {
      changeRemoteDirectory(tab.path, false);
    }
  };

  const handleAddTab = () => {
    const newPath = remoteHistory.currentDir || '/';
    const nextTabs = [...remoteTabs, { path: newPath, isPinned: false }];
    setRemoteTabs(nextTabs);
    setActiveRemoteTabIdx(nextTabs.length - 1);
    changeRemoteDirectory(newPath, false);
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
      changeRemoteDirectory(nextTabs[nextIdx].path, false);
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
    const hideMenus = () => {
      setTabContextMenu(null);
      setContextMenu(null);
    };
    document.addEventListener('click', hideMenus);
    return () => document.removeEventListener('click', hideMenus);
  }, []);



  const handleItemContextMenu = (e: React.MouseEvent, pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pane,
      item,
    });
  };

  const handleBlankContextMenu = (e: React.MouseEvent, pane: 'local' | 'remote') => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      pane,
      item: null,
    });
  };

  const handleRefresh = React.useCallback((pane: 'local' | 'remote') => {
    if (pane === 'local') {
      loadLocalDirectory(localHistory.currentDir);
    } else {
      loadRemoteDirectory(remoteHistory.currentDir);
    }
  }, [loadLocalDirectory, localHistory.currentDir, loadRemoteDirectory, remoteHistory.currentDir]);

  // CRUD File Operations
  const handleNewFolder = async (pane: 'local' | 'remote') => {
    const name = prompt('Enter new folder name:');
    if (!name || !name.trim()) return;
    try {
      if (pane === 'local') {
        const target = joinLocalPath(localHistory.currentDir, name.trim());
        await window.electronAPI.fs.mkdir(target);
        await loadLocalDirectory(localHistory.currentDir);
      } else {
        const target = joinRemotePath(remoteHistory.currentDir, name.trim());
        await window.electronAPI.ssh.mkdir(sessionId, target);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    } catch (err: unknown) {
      setErrorMsg(`New folder failed: ${(err as Error).message}`);
    }
  };

  const handleNewFile = async (pane: 'local' | 'remote') => {
    const name = prompt('Enter new file name:');
    if (!name || !name.trim()) return;
    try {
      if (pane === 'local') {
        const target = joinLocalPath(localHistory.currentDir, name.trim());
        await window.electronAPI.fs.createFile(target);
        await loadLocalDirectory(localHistory.currentDir);
      } else {
        const target = joinRemotePath(remoteHistory.currentDir, name.trim());
        await window.electronAPI.ssh.createFile(sessionId, target);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    } catch (err: unknown) {
      setErrorMsg(`New file failed: ${(err as Error).message}`);
    }
  };

  const handleRename = React.useCallback(async (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    const newName = prompt('Enter new name:', item.name);
    if (!newName || !newName.trim() || newName.trim() === item.name) return;
    try {
      if (pane === 'local') {
        const from = joinLocalPath(localHistory.currentDir, item.name);
        const to = joinLocalPath(localHistory.currentDir, newName.trim());
        await window.electronAPI.fs.rename(from, to);
        await loadLocalDirectory(localHistory.currentDir);
      } else {
        const from = joinRemotePath(remoteHistory.currentDir, item.name);
        const to = joinRemotePath(remoteHistory.currentDir, newName.trim());
        await window.electronAPI.ssh.rename(sessionId, from, to);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    } catch (err: unknown) {
      setErrorMsg(`Rename failed: ${(err as Error).message}`);
    }
  }, [sessionId, loadLocalDirectory, localHistory.currentDir, loadRemoteDirectory, remoteHistory.currentDir]);

  const handleDelete = React.useCallback(async (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    try {
      if (pane === 'local') {
        const target = joinLocalPath(localHistory.currentDir, item.name);
        await window.electronAPI.fs.delete(target, true);
        await loadLocalDirectory(localHistory.currentDir);
      } else {
        const target = joinRemotePath(remoteHistory.currentDir, item.name);
        await window.electronAPI.ssh.delete(sessionId, target, true);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    } catch (err: unknown) {
      setErrorMsg(`Delete failed: ${(err as Error).message}`);
    }
  }, [sessionId, loadLocalDirectory, localHistory.currentDir, loadRemoteDirectory, remoteHistory.currentDir]);

  // Global Keyboard Actions
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.hasAttribute('contenteditable'))) {
        return;
      }

      if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        handleRefresh(activePanel);
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (activePanel === 'local' && selectedLocalFile) {
          handleRename('local', selectedLocalFile);
        } else if (activePanel === 'remote' && selectedRemoteFile) {
          handleRename('remote', selectedRemoteFile);
        }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        if (activePanel === 'local' && selectedLocalFile) {
          handleDelete('local', selectedLocalFile);
        } else if (activePanel === 'remote' && selectedRemoteFile) {
          handleDelete('remote', selectedRemoteFile);
        }
      } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        if (activePanel === 'local') {
          handleLocalHistoryBack();
        } else {
          handleRemoteHistoryBack();
        }
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (activePanel === 'local') {
          handleLocalHistoryForward();
        } else {
          handleRemoteHistoryForward();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    activePanel,
    selectedLocalFile,
    selectedRemoteFile,
    localHistory,
    remoteHistory,
    handleRefresh,
    handleRename,
    handleDelete,
    handleLocalHistoryBack,
    handleLocalHistoryForward,
    handleRemoteHistoryBack,
    handleRemoteHistoryForward,
  ]);

  const handleCompress = async (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    const tarName = `${item.name}.tar.gz`;
    try {
      if (pane === 'local') {
        setLocalLoading(true);
        const src = joinLocalPath(localHistory.currentDir, item.name);
        const dest = joinLocalPath(localHistory.currentDir, tarName);
        await window.electronAPI.fs.compress(src, dest);
        await loadLocalDirectory(localHistory.currentDir);
      } else {
        setRemoteLoading(true);
        const src = joinRemotePath(remoteHistory.currentDir, item.name);
        const dest = joinRemotePath(remoteHistory.currentDir, tarName);
        await window.electronAPI.ssh.compress(sessionId, src, dest);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    } catch (err: unknown) {
      setErrorMsg(`Compress failed: ${(err as Error).message}`);
    } finally {
      setLocalLoading(false);
      setRemoteLoading(false);
    }
  };

  const handleExtract = async (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    const destDirName = item.name.replace(/\.tar\.gz$/, '').replace(/\.tgz$/, '');
    try {
      if (pane === 'local') {
        setLocalLoading(true);
        const src = joinLocalPath(localHistory.currentDir, item.name);
        const dest = joinLocalPath(localHistory.currentDir, destDirName);
        await window.electronAPI.fs.extract(src, dest);
        await loadLocalDirectory(localHistory.currentDir);
      } else {
        setRemoteLoading(true);
        const src = joinRemotePath(remoteHistory.currentDir, item.name);
        const dest = joinRemotePath(remoteHistory.currentDir, destDirName);
        await window.electronAPI.ssh.extract(sessionId, src, dest);
        await loadRemoteDirectory(remoteHistory.currentDir);
      }
    } catch (err: unknown) {
      setErrorMsg(`Extract failed: ${(err as Error).message}`);
    } finally {
      setLocalLoading(false);
      setRemoteLoading(false);
    }
  };

  const handleProperties = (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    const fullPath = pane === 'local' 
      ? joinLocalPath(localHistory.currentDir, item.name) 
      : joinRemotePath(remoteHistory.currentDir, item.name);
    setPropertiesFile({
      pane,
      file: {
        name: item.name,
        path: fullPath,
        isDirectory: item.isDirectory,
        size: item.size,
        modified: pane === 'local' ? (item as LocalFile).modified : (item as RemoteFile).date,
        owner: (item as RemoteFile).owner,
        permissions: (item as RemoteFile).permissions
      }
    });
  };

  const handleCopy = (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    setClipboard({
      type: 'copy',
      pane,
      dir: pane === 'local' ? localHistory.currentDir : remoteHistory.currentDir,
      items: [{ name: item.name, isDirectory: item.isDirectory }]
    });
  };

  const handleCut = (pane: 'local' | 'remote', item: LocalFile | RemoteFile) => {
    setClipboard({
      type: 'cut',
      pane,
      dir: pane === 'local' ? localHistory.currentDir : remoteHistory.currentDir,
      items: [{ name: item.name, isDirectory: item.isDirectory }]
    });
  };

  const handlePaste = async (pane: 'local' | 'remote') => {
    if (!clipboard) return;
    setRemoteLoading(true);
    setLocalLoading(true);
    try {
      const targetPane = pane;
      const sourcePane = clipboard.pane;

      if (sourcePane === 'local' && targetPane === 'local') {
        for (const clItem of clipboard.items) {
          const src = joinLocalPath(clipboard.dir, clItem.name);
          const dest = joinLocalPath(localHistory.currentDir, clItem.name);
          if (clipboard.type === 'copy') {
            await window.electronAPI.fs.copy(src, dest);
          } else {
            await window.electronAPI.fs.rename(src, dest);
          }
        }
      } else if (sourcePane === 'remote' && targetPane === 'remote') {
        for (const clItem of clipboard.items) {
          const src = joinRemotePath(clipboard.dir, clItem.name);
          const dest = joinRemotePath(remoteHistory.currentDir, clItem.name);
          if (clipboard.type === 'copy') {
            await window.electronAPI.ssh.copy(sessionId, src, dest);
          } else {
            await window.electronAPI.ssh.rename(sessionId, src, dest);
          }
        }
      } else if (sourcePane === 'local' && targetPane === 'remote') {
        for (const clItem of clipboard.items) {
          const src = joinLocalPath(clipboard.dir, clItem.name);
          if (clItem.isDirectory) {
            await window.electronAPI.ssh.uploadFolder(sessionId, src, remoteHistory.currentDir);
          } else {
            await window.electronAPI.ssh.upload(sessionId, src, remoteHistory.currentDir);
          }
        }
      } else if (sourcePane === 'remote' && targetPane === 'local') {
        for (const clItem of clipboard.items) {
          const src = joinRemotePath(clipboard.dir, clItem.name);
          if (clItem.isDirectory) {
            await window.electronAPI.ssh.downloadFolder(sessionId, src, localHistory.currentDir);
          } else {
            await window.electronAPI.ssh.download(sessionId, src, localHistory.currentDir);
          }
        }
      }

      if (clipboard.type === 'cut') {
        if (sourcePane === 'local' && targetPane === 'remote') {
          for (const clItem of clipboard.items) {
            const src = joinLocalPath(clipboard.dir, clItem.name);
            await window.electronAPI.fs.delete(src, true);
          }
        } else if (sourcePane === 'remote' && targetPane === 'local') {
          for (const clItem of clipboard.items) {
            const src = joinRemotePath(clipboard.dir, clItem.name);
            await window.electronAPI.ssh.delete(sessionId, src, true);
          }
        }
        setClipboard(null);
      }
    } catch (err: unknown) {
      console.error('Paste operation failed', err);
      setErrorMsg(`Paste failed: ${(err as Error).message}`);
    } finally {
      await loadLocalDirectory(localHistory.currentDir);
      await loadRemoteDirectory(remoteHistory.currentDir);
    }
  };
  // Sort states helpers
  const toggleLocalSort = (field: 'name' | 'size' | 'modified' | 'owner' | 'permissions') => {
    if (field === 'owner' || field === 'permissions') return;
    const nextAsc = localSortField === field ? !localSortAsc : true;
    setLocalSortField(field);
    setLocalSortAsc(nextAsc);
    saveLayoutSettings({ localSortField: field, localSortAsc: nextAsc });
  };

  const toggleRemoteSort = (field: 'name' | 'size' | 'modified' | 'owner' | 'permissions') => {
    const nextAsc = remoteSortField === field ? !remoteSortAsc : true;
    setRemoteSortField(field);
    setRemoteSortAsc(nextAsc);
    saveLayoutSettings({ remoteSortField: field, remoteSortAsc: nextAsc });
  };

  // Sorting logics
  const sortedLocalFiles = [...localFiles]
    .filter(f => f.name.toLowerCase().includes(localSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      let comp = 0;
      if (localSortField === 'name') comp = a.name.localeCompare(b.name);
      else if (localSortField === 'size') comp = a.size - b.size;
      else if (localSortField === 'modified') comp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      return localSortAsc ? comp : -comp;
    });

  const sortedRemoteFiles = [...remoteFiles]
    .filter(f => f.name.toLowerCase().includes(remoteSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      let comp = 0;
      if (remoteSortField === 'name') comp = a.name.localeCompare(b.name);
      else if (remoteSortField === 'size') comp = a.size - b.size;
      else if (remoteSortField === 'modified') comp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (remoteSortField === 'owner') comp = a.owner.localeCompare(b.owner);
      else if (remoteSortField === 'permissions') comp = a.permissions.localeCompare(b.permissions);
      return remoteSortAsc ? comp : -comp;
    });

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
            style={{ width: `${localWidthPercent}%` }}
            className="flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 overflow-hidden theme-transition"
          >
            <ExplorerPanel
              pane="local"
              loading={localLoading}
              currentDir={localHistory.currentDir}
              files={sortedLocalFiles}
              selectedFile={selectedLocalFile}
              onSelect={(file) => setSelectedLocalFile(file as LocalFile | null)}
              onDoubleClick={(file) => handleLocalDblClick(file as LocalFile)}
              onContextMenu={(e, file) => handleItemContextMenu(e, 'local', file as LocalFile)}
              onBlankContextMenu={(e) => handleBlankContextMenu(e, 'local')}
              onEmptySpaceClick={() => { setSelectedLocalFile(null); setActivePanel('local'); }}
              viewMode={localView}
              onViewModeChange={setLocalView}
              searchQuery={localSearch}
              onSearchChange={setLocalSearch}
              sortField={localSortField}
              sortAsc={localSortAsc}
              onSort={toggleLocalSort}
              colWidths={localColWidths}
              onResizeStart={(e, col, curWidth) => handleResizeStart(e, 'local', col, curWidth)}
              dragOverRow={dragOverLocalRow}
              onDragStart={(e, file) => handleLocalDragStart(e, file as LocalFile)}
              onDragEnterRow={(_, file) => {
                if (file.isDirectory) setDragOverLocalRow(joinLocalPath(localHistory.currentDir, file.name));
              }}
              onDragLeaveRow={() => setDragOverLocalRow(null)}
              onDrop={handleLocalDrop}
              joinPath={joinLocalPath}
              formatSize={formatSize}
              
              canGoBack={localHistory.canGoBack}
              canGoForward={localHistory.canGoForward}
              onGoBack={handleLocalHistoryBack}
              onGoForward={handleLocalHistoryForward}
              onGoUp={handleLocalUp}
              onGoHome={() => changeLocalDirectory(localHistory.history[0] || '')}
              onRefresh={() => loadLocalDirectory(localHistory.currentDir)}
              onNavigatePath={changeLocalDirectory}

              bookmarks={localBookmarks}
              onBookmarkSelect={changeLocalDirectory}
              onAddBookmark={async () => {
                if (connectionId && localHistory.currentDir) {
                  await window.electronAPI.settings.addBookmark(connectionId, 'LOCAL', localHistory.currentDir);
                  setLocalBookmarks(await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL'));
                  setIsLocalBookmarksOpen(false);
                }
              }}
              onDeleteBookmark={async (id) => {
                await window.electronAPI.settings.deleteBookmark(id);
                if (connectionId) setLocalBookmarks(await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL'));
              }}
              onSetDefaultBookmark={async (id, isDefault) => {
                if (connectionId) {
                  await window.electronAPI.settings.setDefaultBookmark(connectionId, 'LOCAL', isDefault ? id : -1);
                  setLocalBookmarks(await window.electronAPI.settings.getBookmarks(connectionId, 'LOCAL'));
                }
              }}
              isBookmarksOpen={isLocalBookmarksOpen}
              setIsBookmarksOpen={setIsLocalBookmarksOpen}
              onCollapse={() => { setLocalCollapsed(true); saveLayoutSettings({ localPanelCollapsed: true }); }}
              clipboard={clipboard}
              selectedFiles={localSelectedFiles}
              onMultiSelectChange={setLocalSelectedFiles}
            />
          </div>
        ) : (
          <div 
            onClick={() => {
              setLocalCollapsed(false);
              saveLayoutSettings({ localPanelCollapsed: false });
              if (localWidthPercentRef.current < 15) {
                setLocalWidthPercent(25.0);
                saveLayoutSettings({ localPanelWidth: 25.0 });
              }
            }}
            className="w-5 bg-[var(--bg-panel-header)] border-r border-[var(--border-color)] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[var(--bg-panel)] theme-transition"
            title="Expand local panel"
          >
            <div className="writing-mode-vertical text-[9px] text-[var(--text-subtle)] tracking-widest uppercase rotate-180 font-bold select-none">Local</div>
          </div>
        )}
        {/* Separator Resize Handle */}
        <div 
          onMouseDown={handleSeparatorMouseDown}
          className={`w-[5px] hover:w-[6px] cursor-col-resize shrink-0 transition-all duration-150 ${isDraggingSeparator ? 'bg-[var(--color-primary)] w-[6px]' : 'bg-[var(--border-color)] hover:bg-[var(--color-primary)]/50'}`}
        ></div>

        {/* REMOTE PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-panel)] theme-transition">
          <ExplorerPanel
            pane="remote"
            loading={remoteLoading}
            currentDir={remoteHistory.currentDir}
            files={sortedRemoteFiles}
            selectedFile={selectedRemoteFile}
            onSelect={(file) => setSelectedRemoteFile(file as RemoteFile | null)}
            onDoubleClick={(file) => handleRemoteDblClick(file as RemoteFile)}
            onContextMenu={(e, file) => handleItemContextMenu(e, 'remote', file as RemoteFile)}
            onBlankContextMenu={(e) => handleBlankContextMenu(e, 'remote')}
            onEmptySpaceClick={() => { setSelectedRemoteFile(null); setActivePanel('remote'); }}
            viewMode={remoteView}
            onViewModeChange={setRemoteView}
            searchQuery={remoteSearch}
            onSearchChange={setRemoteSearch}
            sortField={remoteSortField}
            sortAsc={remoteSortAsc}
            onSort={toggleRemoteSort}
            colWidths={remoteColWidths}
            onResizeStart={(e, col, curWidth) => handleResizeStart(e, 'remote', col, curWidth)}
            dragOverRow={dragOverRemoteRow}
            onDragStart={(e, file) => handleRemoteDragStart(e, file as RemoteFile)}
            onDragEnterRow={(_, file) => {
              if (file.isDirectory) setDragOverRemoteRow(joinRemotePath(remoteHistory.currentDir, file.name));
            }}
            onDragLeaveRow={() => setDragOverRemoteRow(null)}
            onDrop={handleRemoteDrop}
            joinPath={joinRemotePath}
            formatSize={formatSize}
            
            canGoBack={remoteHistory.canGoBack}
            canGoForward={remoteHistory.canGoForward}
            onGoBack={handleRemoteHistoryBack}
            onGoForward={handleRemoteHistoryForward}
            onGoUp={handleRemoteUp}
            onGoHome={() => changeRemoteDirectory(remoteHistory.history[0] || '')}
            onRefresh={() => loadRemoteDirectory(remoteHistory.currentDir)}
            onNavigatePath={changeRemoteDirectory}

            bookmarks={remoteBookmarks}
            onBookmarkSelect={changeRemoteDirectory}
            onAddBookmark={async () => {
              if (connectionId && remoteHistory.currentDir) {
                await window.electronAPI.settings.addBookmark(connectionId, 'REMOTE', remoteHistory.currentDir);
                setRemoteBookmarks(await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE'));
                setIsRemoteBookmarksOpen(false);
              }
            }}
            onDeleteBookmark={async (id) => {
              await window.electronAPI.settings.deleteBookmark(id);
              if (connectionId) setRemoteBookmarks(await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE'));
            }}
            onSetDefaultBookmark={async (id, isDefault) => {
              if (connectionId) {
                await window.electronAPI.settings.setDefaultBookmark(connectionId, 'REMOTE', isDefault ? id : -1);
                setRemoteBookmarks(await window.electronAPI.settings.getBookmarks(connectionId, 'REMOTE'));
              }
            }}
            isBookmarksOpen={isRemoteBookmarksOpen}
            setIsBookmarksOpen={setIsRemoteBookmarksOpen}
            
            connectionName={connectionName}
            username={username}
            host={host}
            onOpenTerminal={() => window.electronAPI.terminal.openWindow(sessionId, username, host)}
            
            localCollapsed={localCollapsed}
            remoteTabs={remoteTabs}
            activeRemoteTabIdx={activeRemoteTabIdx}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseRemoteTab}
            onTabContextMenu={handleTabContextMenu}
            onAddTab={handleAddTab}
            clipboard={clipboard}
            selectedFiles={remoteSelectedFiles}
            onMultiSelectChange={setRemoteSelectedFiles}
          />
        </div>
      </div>

      {/* Blue Global Connected Footer Status Bar */}
      <div className="h-6 bg-[var(--color-primary)] text-white flex items-center px-3 gap-3.5 shrink-0 text-[12px] font-medium border-t border-[var(--border-color)] select-none text-left">
        <span>● Connected · {username}@{host}</span>
        <span className="opacity-75">{remoteHistory.currentDir} · {sortedRemoteFiles.length} items</span>
        <div className="flex-1"></div>
        <button 
          onClick={onDisconnect} 
          className="bg-transparent border-none text-white hover:text-white/80 cursor-pointer font-bold select-none outline-none mr-2 px-3 py-0.5 rounded-[4px] hover:bg-white/10 transition-colors"
        >
          Disconnect Session
        </button>
      </div>

      {/* Remote Tab Right-Click Context Menu */}
      {tabContextMenu && (
        <div 
          style={{ top: `${tabContextMenu.y}px`, left: `${tabContextMenu.x}px` }}
          className="fixed bg-[var(--bg-panel)]/90 backdrop-blur-sm border border-[var(--border-color)] rounded-[6px] shadow-[var(--shadow-dropdown)] py-2 z-[100] w-48 text-[12px] text-[var(--text-main)] font-sans"
        >
          <button 
            onClick={() => handleTogglePinTab(tabContextMenu.tabIdx)}
            className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
          >
            {remoteTabs[tabContextMenu.tabIdx]?.isPinned ? '📌 Unpin Tab' : '📌 Pin Tab'}
          </button>
          <button 
            onClick={() => handleDuplicateTab(tabContextMenu.tabIdx)}
            className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px] border-t border-[var(--border-color)]/50 mt-1.5 pt-2"
          >
            📋 Duplicate Tab
          </button>
        </div>
      )}

      {/* Explorer Right-Click Context Menu */}
      {contextMenu && (
        <div 
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed bg-[var(--bg-panel)]/90 backdrop-blur-sm border border-[var(--border-color)] rounded-[6px] shadow-[var(--shadow-dropdown)] py-2 z-[100] w-52 text-[12px] text-[var(--text-main)] font-sans"
        >
          {contextMenu.item === null ? (
            <>
              <button 
                onClick={() => handleRefresh(contextMenu.pane)}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                🔄 Refresh
              </button>
              <button 
                onClick={() => handleNewFolder(contextMenu.pane)}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                📁 New Folder
              </button>
              <button 
                onClick={() => handleNewFile(contextMenu.pane)}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                📄 New File
              </button>
              {clipboard && (
                <button 
                  onClick={() => handlePaste(contextMenu.pane)}
                  className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px] border-t border-[var(--border-color)]/40 mt-1.5 pt-2"
                >
                  📋 Paste ({clipboard.type === 'copy' ? 'Copy' : 'Cut'} items)
                </button>
              )}
            </>
          ) : (
            <>
              {/* Open / Open in New Tab for folders (remote) */}
              {contextMenu.pane === 'remote' && contextMenu.item?.isDirectory && (
                <>
                  <button
                    onClick={() => {
                      const item = contextMenu.item;
                      if (item) changeRemoteDirectory(joinRemotePath(remoteHistory.currentDir, item.name));
                    }}
                    className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
                  >
                    📂 Open
                  </button>
                  {localCollapsed && (
                    <button
                      onClick={() => {
                        const item = contextMenu.item;
                        if (!item) return;
                        const newPath = joinRemotePath(remoteHistory.currentDir, item.name);
                        const nextTabs = [...remoteTabs, { path: newPath, isPinned: false }];
                        setRemoteTabs(nextTabs);
                        setActiveRemoteTabIdx(nextTabs.length - 1);
                        changeRemoteDirectory(newPath, false);
                      }}
                      className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
                    >
                      🗂️ Open in New Tab
                    </button>
                  )}
                  <div className="border-t border-[var(--border-color)]/40 my-1.5"></div>
                </>
              )}
              <button 
                onClick={async () => {
                  const item = contextMenu.item;
                  if (!item) return;
                  setLocalLoading(true);
                  setRemoteLoading(true);
                  try {
                    if (contextMenu.pane === 'local') {
                      const src = joinLocalPath(localHistory.currentDir, item.name);
                      if (item.isDirectory) {
                        await window.electronAPI.ssh.uploadFolder(sessionId, src, remoteHistory.currentDir);
                      } else {
                        await window.electronAPI.ssh.upload(sessionId, src, remoteHistory.currentDir);
                      }
                    } else {
                      const src = joinRemotePath(remoteHistory.currentDir, item.name);
                      if (item.isDirectory) {
                        await window.electronAPI.ssh.downloadFolder(sessionId, src, localHistory.currentDir);
                      } else {
                        await window.electronAPI.ssh.download(sessionId, src, localHistory.currentDir);
                      }
                    }
                  } catch (err: unknown) {
                    setErrorMsg(`Transfer failed: ${(err as Error).message}`);
                  } finally {
                    await loadLocalDirectory(localHistory.currentDir);
                    await loadRemoteDirectory(remoteHistory.currentDir);
                  }
                }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                {contextMenu.pane === 'local' ? '📤 Upload' : '📥 Download'}
              </button>
              <div className="border-t border-[var(--border-color)]/40 my-1.5"></div>
              <button 
                onClick={() => { if (contextMenu.item) handleCopy(contextMenu.pane, contextMenu.item); }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                📋 Copy
              </button>
              <button 
                onClick={() => { if (contextMenu.item) handleCut(contextMenu.pane, contextMenu.item); }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                ✂️ Cut
              </button>
              {clipboard && (
                <button 
                  onClick={() => handlePaste(contextMenu.pane)}
                  className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
                >
                  📋 Paste
                </button>
              )}
              <div className="border-t border-[var(--border-color)]/40 my-1.5"></div>
              <button 
                onClick={() => { if (contextMenu.item) handleRename(contextMenu.pane, contextMenu.item); }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                ✏️ Rename
              </button>
              <button 
                onClick={() => { if (contextMenu.item) handleDelete(contextMenu.pane, contextMenu.item); }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px] text-rose-500 hover:text-rose-400"
              >
                ❌ Delete
              </button>
              <div className="border-t border-[var(--border-color)]/40 my-1.5"></div>
              <button 
                onClick={() => { if (contextMenu.item) handleCompress(contextMenu.pane, contextMenu.item); }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                📦 Compress to tar.gz
              </button>
              {contextMenu.item && (contextMenu.item.name.endsWith('.tar.gz') || contextMenu.item.name.endsWith('.tgz')) && (
                <button 
                  onClick={() => { if (contextMenu.item) handleExtract(contextMenu.pane, contextMenu.item); }}
                  className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
                >
                  📂 Extract Archive
                </button>
              )}
              <div className="border-t border-[var(--border-color)]/40 my-1.5"></div>
              <button 
                onClick={() => { if (contextMenu.item) handleProperties(contextMenu.pane, contextMenu.item); }}
                className="w-full text-left px-4 py-2 bg-transparent border-none text-[var(--text-main)] hover:bg-[var(--glow-color)]/25 cursor-pointer outline-none font-semibold text-[12px]"
              >
                ℹ️ Properties
              </button>
            </>
          )}
        </div>
      )}

      {/* Properties Dialog Modal */}
      {propertiesFile && (
        <PropertiesModal
          pane={propertiesFile.pane}
          sessionId={sessionId}
          file={propertiesFile.file}
          onClose={() => setPropertiesFile(null)}
        />
      )}
    </div>
  );
};

export default FileManager;
