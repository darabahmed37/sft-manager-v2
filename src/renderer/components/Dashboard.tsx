import React, { useState } from 'react';
import { ConnectionCard } from './ConnectionCard';
import type { Connection } from './ConnectionCard';

interface DashboardProps {
  connections: Connection[];
  activeSessions: Set<number>;
  onConnect: (id: number) => void;
  onDisconnect: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  onNewConnection: () => void;
  onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  connections,
  activeSessions,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onDuplicate,
  onNewConnection,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter connections based on query
  const filteredConnections = connections.filter((conn) => {
    const q = searchQuery.toLowerCase();
    return (
      conn.name.toLowerCase().includes(q) ||
      conn.host.toLowerCase().includes(q) ||
      (conn.credentialUsername || '').toLowerCase().includes(q)
    );
  });

  const onlineCount = activeSessions.size;
  const totalCount = connections.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-app)] select-none text-[13px] text-[var(--text-main)] font-sans theme-transition">
      
      {/* Search Toolbar */}
      <div className="h-[34px] bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex items-center px-4.5 gap-2 shrink-0 select-none">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Connections</span>
        
        <div className="flex-1"></div>
        
        {/* Search Input Box */}
        <div className="relative">
          <svg 
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[var(--text-subtle)]" 
            width="12" 
            height="12" 
            viewBox="0 0 12 12" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.6"
          >
            <circle cx="5.5" cy="5.5" r="3.5" />
            <line x1="8.5" y1="8.5" x2="11" y2="11" />
          </svg>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connections..." 
            className="bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[3px] py-1 pl-6 pr-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none w-[200px] transition-colors"
          />
        </div>

        {/* Action Button */}
        <button 
          onClick={onNewConnection}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] border-none rounded-[3px] px-3.5 h-6 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-all outline-none"
        >
          <span className="text-base font-normal mt-[-2px] leading-none">+</span>
          New Connection
        </button>
      </div>

      {/* Connection Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4.5 flex flex-wrap gap-3 content-start items-start">
        {filteredConnections.length > 0 ? (
          filteredConnections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              isActive={activeSessions.has(conn.id)}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
            />
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center py-20 text-[var(--text-subtle)] font-medium">
            {searchQuery ? 'No matching connections found' : 'No connection profiles configured yet'}
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="h-5 bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-4 justify-between shrink-0 text-[10.5px] text-[var(--text-muted)] font-medium">
        <span>
          {onlineCount} of {totalCount} connection{totalCount !== 1 ? 's' : ''} online
        </span>
        <div className="flex items-center gap-4">
          <button 
            onClick={onOpenSettings}
            className="hover:text-[var(--text-main)] cursor-pointer border-none bg-transparent text-[10.5px] text-[var(--text-muted)] font-medium outline-none transition-colors"
          >
            ⚙ Settings
          </button>
          <span>Darab Ahmed</span>
        </div>
      </div>

    </div>
  );
};
export default Dashboard;
