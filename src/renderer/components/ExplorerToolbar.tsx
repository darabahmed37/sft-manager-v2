import React from 'react';
import { MdRefresh } from 'react-icons/md';
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
  return (
    <div className="h-8 bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center px-1 shrink-0 theme-transition">
      <button 
        title="Back" 
        onClick={onGoBack} 
        disabled={!canGoBack}
        className={`w-6 h-6 bg-transparent border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-colors ${!canGoBack ? 'opacity-40 cursor-default text-[var(--text-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="8,2 4,6.5 8,11"/></svg>
      </button>
      <button 
        title="Forward" 
        onClick={onGoForward} 
        disabled={!canGoForward}
        className={`w-6 h-6 bg-transparent border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-colors ${!canGoForward ? 'opacity-40 cursor-default text-[var(--text-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="5,2 9,6.5 5,11"/></svg>
      </button>
      <button 
        onClick={onGoUp} 
        title="Up" 
        className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="2,9 6.5,4 11,9"/></svg>
      </button>
      <button 
        onClick={onGoHome} 
        title="Home" 
        className="w-6 h-6 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center justify-center rounded-[3px] outline-none transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8L7 3l5 5M4 6.5V12h2.5V9h1V12H10V6.5"/></svg>
      </button>
      <button 
        onClick={onRefresh} 
        title="Refresh (F5)" 
        className="h-6 px-2 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)] flex items-center gap-1 rounded-[3px] outline-none transition-colors shrink-0"
      >
        <MdRefresh size={15} />
        <span className="text-[11px] font-medium">Refresh</span>
      </button>
      
      <div className="relative shrink-0">
        <button 
          onClick={() => setIsBookmarksOpen(!isBookmarksOpen)} 
          title="Bookmarks" 
          className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-colors ${isBookmarksOpen ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-panel-header)]'}`}
        >
          <svg width="11" height="13" viewBox="0 0 11 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 1h9v12L5.5 9.5 1 13z" fill={bookmarks.length > 0 ? "currentColor" : "none"}/></svg>
        </button>
        {isBookmarksOpen && (
          <div className="absolute left-0 mt-1 w-64 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[4px] shadow-lg z-50 py-1.5 text-xs text-[var(--text-main)] font-sans">
            <div className="px-3 py-1.5 border-b border-[var(--border-color)] font-bold text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              {pane === 'local' ? 'Local Bookmarks' : 'Remote Bookmarks'}
            </div>
            <button 
              onClick={onAddBookmark}
              className="w-full text-left px-3 py-2 bg-transparent hover:bg-[var(--glow-color)]/25 border-none text-[var(--text-main)] cursor-pointer flex items-center gap-1.5 outline-none font-semibold text-xs transition-colors"
            >
              + Bookmark current directory
            </button>
            <div className="border-t border-[var(--border-color)]/50 my-1"></div>
            <div className="max-h-48 overflow-y-auto">
              {bookmarks.length > 0 ? (
                bookmarks.map((bm) => (
                  <div key={bm.id} className="px-3 py-1.5 flex items-center justify-between hover:bg-[var(--glow-color)]/10">
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
                <div className="px-3 py-3 text-center text-[var(--text-subtle)]">No bookmarks saved.</div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
      
      {pane === 'remote' ? (
        <div className="flex-1 flex items-center gap-1 overflow-hidden px-1 font-mono text-[11px] text-[var(--text-muted)] select-text">
          {currentDir.split('/').map((part, idx, arr) => {
            if (idx === 0 && part === '') {
              return <span key={idx} onClick={() => onNavigatePath('/')} className="cursor-pointer hover:text-[var(--text-main)] transition-colors">/</span>;
            }
            if (part === '') return null;
            const pathTarget = '/' + arr.slice(1, idx + 1).join('/');
            return (
              <React.Fragment key={idx}>
                <span onClick={() => onNavigatePath(pathTarget)} className="cursor-pointer hover:text-[var(--text-main)] transition-colors">{part}</span>
                {idx < arr.length - 1 && <span>/</span>}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="flex-1"></div>
      )}

      <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
      
      <div className="relative shrink-0">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…" 
          className="w-[140px] bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[3px] py-0.5 pl-6 pr-1.5 text-[var(--text-main)] placeholder-[var(--text-subtle)] text-xs outline-none transition-all"
        />
        <svg className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[var(--text-subtle)]" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>
      </div>

      <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1 shrink-0"></div>
      
      <button 
        onClick={() => onViewModeChange('list')} 
        title="List view" 
        className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-all ${viewMode === 'list' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
      >
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="4" y1="3" x2="12" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="4" y1="10" x2="12" y2="10"/><rect x="1" y="2" width="2" height="2" fill="currentColor"/><rect x="1" y="5.5" width="2" height="2" fill="currentColor"/><rect x="1" y="9" width="2" height="2" fill="currentColor"/></svg>
      </button>
      <button 
        onClick={() => onViewModeChange('grid')} 
        title="Grid view" 
        className={`w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] outline-none transition-all ${viewMode === 'grid' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
      >
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.5"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.5"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.5"/></svg>
      </button>

      {pane === 'remote' && onOpenTerminal && (
        <>
          <button 
            onClick={onOpenTerminal} 
            title="Open Terminal Window" 
            className="w-6 h-6 border-none cursor-pointer flex items-center justify-center rounded-[3px] ml-0.5 outline-none text-[var(--text-muted)] hover:text-[var(--active-tab-text)] hover:bg-[var(--glow-color)]/25 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><polyline points="4,5.5 6.5,8 4,10.5"/><line x1="7.5" y1="10.5" x2="11" y2="10.5"/></svg>
          </button>
        </>
      )}
    </div>
  );
};
