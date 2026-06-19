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
    <div className="flex-1 flex flex-col overflow-hidden bg-[#141414] select-none text-[13px] text-neutral-300 font-sans">
      
      {/* Search Toolbar */}
      <div className="h-[34px] bg-[#1e1e1e] border-b border-[#252525] flex items-center px-4.5 gap-2 shrink-0 select-none">
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Connections</span>
        
        <div className="flex-1"></div>
        
        {/* Search Input Box */}
        <div className="relative">
          <svg 
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-600" 
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
            className="bg-[#2a2a2a] border border-[#3a3a3a] hover:border-neutral-700 focus:border-[#29ABEE] rounded-[3px] py-1 pl-6 pr-2.5 text-xs text-neutral-200 outline-none w-[200px] transition-colors"
          />
        </div>

        {/* Action Button */}
        <button 
          onClick={onNewConnection}
          className="bg-[#29ABEE] hover:bg-[#1a9ad9] active:bg-[#1685bc] border-none rounded-[3px] px-3.5 h-6 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-colors outline-none"
        >
          <span className="text-base font-normal mt-[-2px] leading-none">+</span>
          New Connection
        </button>
      </div>

      {/* Connection Cards Grid Grid */}
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
          <div className="flex-1 flex items-center justify-center py-20 text-neutral-600 font-medium">
            {searchQuery ? 'No matching connections found' : 'No connection profiles configured yet'}
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="h-5 bg-[#252526] border-t border-[#1a1a1a] flex items-center px-4 justify-between shrink-0 text-[10.5px] text-neutral-600 font-medium">
        <span>
          {onlineCount} of {totalCount} connection{totalCount !== 1 ? 's' : ''} online
        </span>
        <div className="flex items-center gap-4">
          <button className="hover:text-neutral-400 cursor-pointer outline-none">
            ⚙ Settings
          </button>
          <span>Darab Ahmed</span>
        </div>
      </div>

    </div>
  );
};
export default Dashboard;
