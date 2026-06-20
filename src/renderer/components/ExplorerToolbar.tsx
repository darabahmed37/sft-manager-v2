import React, { useState, useEffect } from 'react';
import { 
  LuChevronLeft, 
  LuChevronRight, 
  LuChevronUp, 
  LuRotateCw, 
  LuBookmark, 
  LuSearch, 
  LuList, 
  LuLayoutGrid, 
  LuTerminal 
} from 'react-icons/lu';
import { FiHome } from 'react-icons/fi';
import type { Bookmark } from '../global';

interface ExplorerToolbarProps {
  pane: 'local' | 'remote';
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onGoHome: () => void;
  onRefresh: () => void;
  currentDir: string;
  onNavigatePath: (path: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  bookmarks: Bookmark[];
  onBookmarkSelect: (path: string) => void;
  onAddBookmark: () => void;
  onDeleteBookmark: (id: number) => void;
  onSetDefaultBookmark: (id: number, isDefault: boolean) => void;
  isBookmarksOpen: boolean;
  setIsBookmarksOpen: (open: boolean) => void;
  onOpenTerminal?: () => void;
}

export const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  pane,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onGoHome,
  onRefresh,
  currentDir,
  onNavigatePath,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  bookmarks,
  onBookmarkSelect,
  onAddBookmark,
  onDeleteBookmark,
  onSetDefaultBookmark,
  isBookmarksOpen,
  setIsBookmarksOpen,
  onOpenTerminal,
}) => {
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInputVal, setPathInputVal] = useState(currentDir);

  useEffect(() => {
    setPathInputVal(currentDir);
  }, [currentDir]);

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInputVal.trim()) {
      onNavigatePath(pathInputVal.trim());
    }
    setIsEditingPath(false);
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setPathInputVal(currentDir);
      setIsEditingPath(false);
    }
  };

  const renderBreadcrumbs = () => {
    if (!currentDir) {
      return <span className="text-[var(--text-subtle)] font-mono text-[12px]">Root</span>;
    }

    const isWindows = pane === 'local' && (currentDir.includes('\\') || (currentDir.length >= 2 && currentDir[1] === ':'));
    const separator = isWindows ? '\\' : '/';
    const parts = currentDir.split(separator);
    
    return (
      <div className="flex items-center gap-1 overflow-hidden text-[12px] font-mono text-[var(--text-muted)] select-none">
        {parts.map((part, idx) => {
          if (part === '' && idx === 0 && !isWindows) {
            return (
              <span 
                key={idx} 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigatePath('/');
                }}
                className="cursor-pointer hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] px-1 py-0.5 rounded transition-all"
              >
                /
              </span>
            );
          }
          if (part === '') return null;
          
          let pathTarget = '';
          if (isWindows) {
            pathTarget = parts.slice(0, idx + 1).join('\\');
            if (pathTarget.endsWith(':')) pathTarget += '\\';
          } else {
            pathTarget = '/' + parts.slice(1, idx + 1).join('/');
          }
          
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-[var(--text-subtle)] text-[10px] select-none mx-0.5">›</span>}
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigatePath(pathTarget);
                }} 
                className="cursor-pointer hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] px-1 py-0.5 rounded transition-all whitespace-nowrap"
                title={pathTarget}
              >
                {part}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-12 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center px-2 shrink-0 theme-transition relative">
      {/* Navigation Cluster */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button 
          title="Back" 
          onClick={onGoBack} 
          disabled={!canGoBack}
          className={`w-9 h-9 bg-transparent border-none cursor-pointer flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors ${!canGoBack ? 'opacity-40 cursor-default text-[var(--text-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
        >
          <LuChevronLeft size={20} />
        </button>
        <button 
          title="Forward" 
          onClick={onGoForward} 
          disabled={!canGoForward}
          className={`w-9 h-9 bg-transparent border-none cursor-pointer flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors ${!canGoForward ? 'opacity-40 cursor-default text-[var(--text-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
        >
          <LuChevronRight size={20} />
        </button>
        <button 
          onClick={onGoUp} 
          title="Up" 
          className="w-9 h-9 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors"
        >
          <LuChevronUp size={20} />
        </button>
        <button 
          onClick={onGoHome} 
          title="Home" 
          className="w-9 h-9 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors"
        >
          <FiHome size={18} />
        </button>
        <button 
          onClick={onRefresh} 
          title="Refresh (F5)" 
          className="w-9 h-9 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors shrink-0"
        >
          <LuRotateCw size={16} />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-[var(--border-color)] mx-2.5 shrink-0"></div>

      {/* Bookmarks */}
      <div className="relative shrink-0">
        <button 
          onClick={() => setIsBookmarksOpen(!isBookmarksOpen)} 
          title="Bookmarks" 
          className={`w-9 h-9 border-none cursor-pointer flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-colors ${isBookmarksOpen ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
        >
          <LuBookmark size={18} className={bookmarks.length > 0 ? "fill-current" : ""} />
        </button>
        {isBookmarksOpen && (
          <div className="absolute left-0 mt-1.5 w-72 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[6px] shadow-[var(--shadow-dropdown)] z-50 py-2 text-[12px] text-[var(--text-main)] font-sans">
            <div className="px-3.5 py-1.5 border-b border-[var(--border-color)] font-bold text-[10.5px] text-[var(--text-muted)] uppercase tracking-wider">
              {pane === 'local' ? 'Local Bookmarks' : 'Remote Bookmarks'}
            </div>
            <button 
              onClick={onAddBookmark}
              className="w-full text-left px-3.5 py-2 bg-transparent hover:bg-[var(--glow-color)]/25 border-none text-[var(--text-main)] cursor-pointer flex items-center gap-1.5 outline-none font-semibold text-[12px] transition-colors"
            >
              + Bookmark current directory
            </button>
            <div className="border-t border-[var(--border-color)]/50 my-1.5"></div>
            <div className="max-h-48 overflow-y-auto">
              {bookmarks.length > 0 ? (
                bookmarks.map((bm) => (
                  <div key={bm.id} className="px-3.5 py-2 flex items-center justify-between hover:bg-[var(--glow-color)]/10">
                    <span 
                      onClick={() => onBookmarkSelect(bm.path)}
                      className="font-mono overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer flex-1 pr-2 hover:text-[var(--color-primary)] text-left"
                      title={bm.path}
                    >
                      {bm.path}
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                      <button 
                        onClick={() => onSetDefaultBookmark(bm.id, !bm.isDefault)}
                        className={`bg-transparent border-none cursor-pointer p-0.5 outline-none text-sm leading-none ${bm.isDefault ? 'text-amber-500' : 'text-[var(--text-subtle)] hover:text-amber-500'}`}
                        title={bm.isDefault ? "Default bookmark" : "Set as default"}
                      >
                        ★
                      </button>
                      <button 
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="bg-transparent border-none cursor-pointer text-[var(--text-subtle)] hover:text-red-500 p-0.5 outline-none font-bold"
                        title="Remove Bookmark"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-3.5 py-3 text-center text-[var(--text-subtle)]">No bookmarks saved.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-[var(--border-color)] mx-2 shrink-0"></div>

      {/* Path Address Bar (Breadcrumbs click-to-edit) */}
      <div className="flex-1 flex items-center overflow-hidden h-full">
        {isEditingPath ? (
          <form onSubmit={handlePathSubmit} className="flex-1 pr-2 flex items-center">
            <input
              type="text"
              value={pathInputVal}
              onChange={(e) => setPathInputVal(e.target.value)}
              onKeyDown={handlePathKeyDown}
              onBlur={() => {
                setTimeout(() => {
                  setIsEditingPath(false);
                  setPathInputVal(currentDir);
                }, 180);
              }}
              autoFocus
              className="w-full bg-[var(--input-bg)] border border-[var(--input-focus-border)] rounded-[4px] py-1 px-2.5 text-[var(--text-main)] text-[12.5px] font-mono outline-none"
            />
          </form>
        ) : (
          <div 
            onClick={() => {
              setPathInputVal(currentDir);
              setIsEditingPath(true);
            }}
            className="flex-1 flex items-center gap-1 overflow-hidden px-2 py-1 rounded hover:bg-white/5 cursor-text min-h-[28px]"
          >
            {renderBreadcrumbs()}
          </div>
        )}
      </div>

      <div className="w-[1px] h-6 bg-[var(--border-color)] mx-2.5 shrink-0"></div>

      {/* Search Input */}
      <div className="relative shrink-0">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…" 
          className="w-[140px] bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[var(--radius-md)] h-9 pl-8 pr-2.5 text-[var(--text-main)] placeholder-[var(--text-subtle)] text-[12px] outline-none transition-all"
        />
        <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-subtle)]" size={14} />
      </div>

      <div className="w-[1px] h-6 bg-[var(--border-color)] mx-2.5 shrink-0"></div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button 
          onClick={() => onViewModeChange('list')} 
          title="List view" 
          className={`w-9 h-9 border-none cursor-pointer flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-all ${viewMode === 'list' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
        >
          <LuList size={18} />
        </button>
        <button 
          onClick={() => onViewModeChange('grid')} 
          title="Grid view" 
          className={`w-9 h-9 border-none cursor-pointer flex items-center justify-center rounded-[var(--radius-md)] outline-none transition-all ${viewMode === 'grid' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
        >
          <LuLayoutGrid size={18} />
        </button>

        {pane === 'remote' && onOpenTerminal && (
          <button 
            onClick={onOpenTerminal} 
            title="Open Terminal Window" 
            className="w-9 h-9 border-none cursor-pointer flex items-center justify-center rounded-[var(--radius-md)] outline-none text-[var(--text-muted)] hover:text-[var(--active-tab-text)] hover:bg-[var(--glow-color)]/25 transition-colors"
          >
            <LuTerminal size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ExplorerToolbar;
