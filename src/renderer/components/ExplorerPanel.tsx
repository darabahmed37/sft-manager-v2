import React, { useState, useEffect } from 'react';
import { FaCloudUploadAlt, FaCloudDownloadAlt, FaExclamationTriangle } from 'react-icons/fa';
import { ExplorerToolbar } from './ExplorerToolbar';
import { ExplorerTable } from './ExplorerTable';
import { ExplorerGrid } from './ExplorerGrid';
import type { LocalFile, RemoteFile, Bookmark } from '../global';

interface ExplorerPanelProps {
  pane: 'local' | 'remote';
  loading: boolean;
  currentDir: string;
  files: (LocalFile | RemoteFile)[];
  selectedFile: LocalFile | RemoteFile | null;
  onSelect: (file: LocalFile | RemoteFile | null) => void;
  onDoubleClick: (file: LocalFile | RemoteFile) => void;
  onContextMenu: (e: React.MouseEvent, file: LocalFile | RemoteFile) => void;
  onBlankContextMenu: (e: React.MouseEvent) => void;
  onEmptySpaceClick: () => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  sortField: string;
  sortAsc: boolean;
  onSort: (field: 'name' | 'size' | 'modified' | 'owner' | 'permissions') => void;
  colWidths: {
    name: number;
    size: number;
    modified: number;
    owner?: number;
  };
  onResizeStart: (e: React.MouseEvent, column: string, currentWidth: number) => void;
  dragOverRow: string | null;
  onDragStart: (e: React.DragEvent, file: LocalFile | RemoteFile) => void;
  onDragEnterRow: (e: React.DragEvent, file: LocalFile | RemoteFile) => void;
  onDragLeaveRow: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, folderPath?: string) => void;
  joinPath: (parent: string, child: string) => string;
  formatSize: (bytes: number) => string;

  // Navigation
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onGoHome: () => void;
  onRefresh: () => void;
  onNavigatePath: (path: string) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  onBookmarkSelect: (path: string) => void;
  onAddBookmark: () => void;
  onDeleteBookmark: (id: number) => void;
  onSetDefaultBookmark: (id: number, isDefault: boolean) => void;
  isBookmarksOpen: boolean;
  setIsBookmarksOpen: (open: boolean) => void;

  // Header/Specific Layout
  onCollapse?: () => void;
  connectionName?: string;
  username?: string;
  host?: string;
  onOpenTerminal?: () => void;
  displayLimit: number;
  onOpenSettings?: () => void;

  // Tabbed navigation (Remote-only, visible when local panel is collapsed)
  localCollapsed?: boolean;
  remoteTabs?: { path: string; isPinned: boolean }[];
  activeRemoteTabIdx?: number;
  onSelectTab?: (idx: number) => void;
  onCloseTab?: (idx: number, e: React.MouseEvent) => void;
  onTabContextMenu?: (e: React.MouseEvent, idx: number) => void;
  onAddTab?: () => void;

  // Clipboard (for cut dimming)
  clipboard: {
    type: 'copy' | 'cut';
    pane: 'local' | 'remote';
    dir: string;
    items: { name: string; isDirectory: boolean }[];
  } | null;

  // Multi-select
  selectedFiles: (LocalFile | RemoteFile)[];
  onMultiSelectChange: (files: (LocalFile | RemoteFile)[]) => void;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  pane,
  loading,
  currentDir,
  files,
  selectedFile,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onBlankContextMenu,
  onEmptySpaceClick,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortAsc,
  onSort,
  colWidths,
  onResizeStart,
  dragOverRow,
  onDragStart,
  onDragEnterRow,
  onDragLeaveRow,
  onDrop,
  joinPath,
  formatSize,

  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onGoHome,
  onRefresh,
  onNavigatePath,

  bookmarks,
  onBookmarkSelect,
  onAddBookmark,
  onDeleteBookmark,
  onSetDefaultBookmark,
  isBookmarksOpen,
  setIsBookmarksOpen,

  onCollapse,
  connectionName,
  username,
  host,
  onOpenTerminal,
  displayLimit,
  onOpenSettings,

  localCollapsed,
  remoteTabs,
  activeRemoteTabIdx,
  onSelectTab,
  onCloseTab,
  onTabContextMenu,
  onAddTab,
  clipboard,
  selectedFiles,
  onMultiSelectChange,
}) => {
  const [dragCount, setDragCount] = useState(0);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    setForceShow(false);
  }, [currentDir]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/json')) {
      setDragCount((c) => c + 1);
    }
  };

  const handleDragLeave = () => {
    setDragCount((c) => Math.max(0, c - 1));
  };

  const handleDropInternal = async (e: React.DragEvent) => {
    setDragCount(0);
    onDrop(e);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Panel Label & Info Header (hidden on remote panel if local is collapsed to avoid redundancy) */}
      {!(pane === 'remote' && localCollapsed) && (
        <div className="h-[38px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2.5 gap-1.5 shrink-0 theme-transition">
          <span className="text-[11.5px] font-bold text-[var(--text-subtle)] uppercase tracking-widest flex-shrink-0">
            {pane === 'local' ? 'Local' : 'Remote'}
          </span>
          <span 
            className="text-[12px] font-mono text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap flex-1" 
            title={pane === 'local' ? currentDir : `${connectionName} — ${username}@${host}:${currentDir}`}
          >
            {pane === 'local' ? currentDir : `${connectionName} — ${username}@${host}:${currentDir}`}
          </span>
          {pane === 'local' && onCollapse && (
            <button 
              onClick={onCollapse} 
              title="Collapse" 
              className="w-8 h-8 flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)] rounded-full shrink-0 outline-none transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="8,2 3,6 8,10"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Tabs (Remote specific when local panel is collapsed) */}
      {pane === 'remote' && localCollapsed && remoteTabs && activeRemoteTabIdx !== undefined && onSelectTab && onCloseTab && onTabContextMenu && onAddTab && (
        <div className="h-[40px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-end overflow-hidden shrink-0 theme-transition select-none">
          <div className="flex items-end h-full pl-2">
            {remoteTabs.map((tab, i) => {
              const isActive = activeRemoteTabIdx === i;
              const pathParts = tab.path.split('/').filter(Boolean);
              const folderName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '/';
              return (
                <div 
                  key={i}
                  onClick={() => onSelectTab(i)} 
                  onContextMenu={(e) => onTabContextMenu(e, i)}
                  className={`h-[34px] px-3 flex items-center gap-1.5 text-[12px] cursor-pointer border-t border-r border-l shrink-0 transition-all select-none ${
                    isActive 
                      ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-[var(--border-color)] border-b-[var(--bg-panel)] font-semibold' 
                      : 'bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-white/5'
                  }`}
                  style={{
                    boxShadow: isActive ? 'inset 0 1.5px 0 var(--color-primary)' : 'none',
                    borderBottom: isActive ? '1px solid var(--bg-panel)' : 'none',
                    marginTop: '6px',
                    borderRadius: '4px 4px 0 0',
                    marginRight: '2px',
                  }}
                  title={tab.path}
                >
                  <span className="flex items-center justify-center shrink-0">
                    {tab.isPinned ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.56A2 2 0 0 1 15 9.2V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.2a2 2 0 0 1-.78 1.56L5.44 14a2 2 0 0 0-.44 1.24z" fill="currentColor" fillOpacity="0.1" />
                      </svg>
                    ) : (
                      <svg width="14" height="12" viewBox="0 0 18 16" fill="none">
                        <path d="M1.5 3a1.5 1.5 0 0 1 1.5-1.5h3.586a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H15a1.5 1.5 0 0 1 1.5 1.5v1.5H1.5V3z" fill="var(--color-primary)" opacity="0.75" />
                        <path d="M1.5 5.5C1.5 4.67 2.17 4 3 4h12c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H3c-.83 0-1.5-.67-1.5-1.5v-7z" fill="var(--color-primary)" />
                      </svg>
                    )}
                  </span>
                  <span className="leading-none">{folderName}</span>
                  {remoteTabs.length > 1 && (
                    <button 
                      onClick={(e) => onCloseTab(i, e)}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--text-subtle)] hover:bg-[var(--border-color)] hover:text-[var(--text-main)] border-none bg-transparent outline-none ml-1 cursor-pointer transition-colors"
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
            <button 
              onClick={onAddTab}
              className="w-[30px] h-[30px] flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 rounded-[4px] border-none bg-transparent outline-none shrink-0"
              style={{ marginBottom: '2px' }}
              title="New Remote Tab"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="5" y1="2" x2="5" y2="8" />
                <line x1="2" y1="5" x2="8" y2="5" />
              </svg>
            </button>
          </div>
          <div className="flex-1 border-b border-b-[var(--border-color)] h-full"></div>
          <div className="h-full flex items-center px-3 gap-2 border-b border-b-[var(--border-color)] text-[var(--text-muted)] text-[11.5px] font-medium shrink-0 select-text font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0] shrink-0"></span>
            <span>{username}@{host}</span>
          </div>
        </div>
      )}

      {/* Navigation Toolbar */}
      <ExplorerToolbar 
        pane={pane}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
        onGoUp={onGoUp}
        onGoHome={onGoHome}
        onRefresh={onRefresh}
        currentDir={currentDir}
        onNavigatePath={onNavigatePath}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        bookmarks={bookmarks}
        onBookmarkSelect={onBookmarkSelect}
        onAddBookmark={onAddBookmark}
        onDeleteBookmark={onDeleteBookmark}
        onSetDefaultBookmark={onSetDefaultBookmark}
        isBookmarksOpen={isBookmarksOpen}
        setIsBookmarksOpen={setIsBookmarksOpen}
        onOpenTerminal={onOpenTerminal}
      />

      {/* Panel Files List Content */}
      <div 
        className="flex-1 overflow-y-auto relative" 
        onContextMenu={onBlankContextMenu} 
        onClick={onEmptySpaceClick}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDropInternal}
      >
        {dragCount > 0 && (
          <div className="absolute inset-0 bg-[var(--bg-app)]/90 backdrop-blur-[3px] flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-primary)] m-3 rounded-[8px] z-50 pointer-events-none transition-all duration-200">
            {pane === 'local' ? (
              <>
                <FaCloudDownloadAlt className="text-[var(--color-primary)] text-4xl mb-3 animate-pulse" />
                <div className="text-[14px] font-semibold text-[var(--text-main)]">Drop files to download</div>
                <div className="text-[11.5px] text-[var(--text-muted)] mt-1">Copying/downloading files into local folder</div>
              </>
            ) : (
              <>
                <FaCloudUploadAlt className="text-[var(--color-primary)] text-4xl mb-3 animate-pulse" />
                <div className="text-[14px] font-semibold text-[var(--text-main)]">Drop files to upload</div>
                <div className="text-[11.5px] text-[var(--text-muted)] mt-1">Uploading files into remote folder</div>
              </>
            )}
          </div>
        )}

        {!forceShow && !loading && files.length > displayLimit ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[var(--bg-panel)] animate-fade-in select-none text-center">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/25 rounded-full flex items-center justify-center mb-4 text-amber-500 text-xl shrink-0">
              <FaExclamationTriangle size={20} />
            </div>
            <h3 className="text-[14.5px] font-semibold text-[var(--text-main)] mb-1">
              Too Many Items
            </h3>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed max-w-[340px] mb-6 font-medium">
              This folder contains <strong className="text-[var(--text-main)] font-bold">{files.length}</strong> items, which exceeds the display limit of <strong className="text-[var(--text-main)] font-bold">{displayLimit}</strong>. Please use the terminal to work with this folder, or change the limit using the settings window.
            </p>
            <div className="flex flex-col gap-2.5 justify-center items-center w-full max-w-[280px]">
              {pane === 'remote' && onOpenTerminal && (
                <button 
                  onClick={onOpenTerminal}
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[12.5px] px-4 py-2 rounded-[5px] font-semibold cursor-pointer outline-none transition-colors border-none"
                >
                  Open Terminal
                </button>
              )}
              {onOpenSettings && (
                <button 
                  onClick={onOpenSettings}
                  className="w-full bg-transparent hover:bg-white/5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-[12.5px] px-4 py-2 rounded-[5px] font-semibold cursor-pointer outline-none transition-colors"
                >
                  Open Settings
                </button>
              )}
              <button 
                onClick={() => setForceShow(true)}
                className="w-full bg-transparent border-none text-[var(--text-subtle)] hover:text-[var(--color-primary)] text-[11.5px] font-medium cursor-pointer py-1.5 outline-none transition-colors underline"
              >
                Display Files Anyway
              </button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <ExplorerTable 
            pane={pane}
            files={files}
            loading={loading}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onSelect={onSelect}
            onMultiSelectChange={onMultiSelectChange}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onEmptyContextMenu={onBlankContextMenu}
            sortField={sortField}
            sortAsc={sortAsc}
            onSort={onSort}
            colWidths={colWidths}
            onResizeStart={onResizeStart}
            dragOverRow={dragOverRow}
            onDragStart={onDragStart}
            onDragEnter={onDragEnterRow}
            onDragLeave={onDragLeaveRow}
            onDrop={onDrop}
            currentDir={currentDir}
            joinPath={joinPath}
            formatSize={formatSize}
            onEmptySpaceClick={onEmptySpaceClick}
            clipboard={clipboard}
          />
        ) : (
          <ExplorerGrid 
            pane={pane}
            files={files}
            loading={loading}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onSelect={onSelect}
            onMultiSelectChange={onMultiSelectChange}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onEmptyContextMenu={onBlankContextMenu}
            dragOverRow={dragOverRow}
            onDragStart={onDragStart}
            onDragEnter={onDragEnterRow}
            onDragLeave={onDragLeaveRow}
            onDrop={onDrop}
            currentDir={currentDir}
            joinPath={joinPath}
            formatSize={formatSize}
            onEmptySpaceClick={onEmptySpaceClick}
            clipboard={clipboard}
          />
        )}
      </div>

      {/* Bottom Panel Status Bar */}
      <div className="h-6 bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-3 shrink-0 text-[11.5px] text-[var(--text-muted)] theme-transition">
        <span>{files.length} items · {selectedFiles.length} selected</span>
      </div>
    </div>
  );
};
