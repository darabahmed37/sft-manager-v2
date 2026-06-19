import React, { useState } from 'react';

export interface Connection {
  id: number;
  name: string;
  host: string;
  port: number;
  workingDir: string;
  connectionTypeId: number;
  connectionTypeCode: string;
  credentialId: number | null;
  tunnelViaConnectionId: number | null;
  lastUsed: number;
  credentialName?: string;
  credentialUsername?: string;
  credentialType?: string;
  tunnelName?: string;
}

interface ConnectionCardProps {
  connection: Connection;
  isActive: boolean;
  onConnect: (id: number) => void;
  onDisconnect: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  isActive,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Status mapping
  const statusColor = isActive ? '#10b981' : connection.connectionTypeId === 2 ? '#febc2e' : '#64748b';
  const statusLabel = isActive ? 'Online' : connection.connectionTypeId === 2 ? 'Warning' : 'Offline';

  const userHost = `${connection.credentialUsername || 'root'}@${connection.host}:${connection.port}`;
  const authLabel = connection.credentialType === 'KEY_ONLY' ? 'SSH Key' : 'Password';
  const lastConn = connection.lastUsed > 0 
    ? `Last used: ${new Date(connection.lastUsed * 1000).toLocaleDateString()}` 
    : 'Never connected';

  return (
    <div className="w-[calc(50%-6px)] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[3px] flex overflow-visible cursor-default transition-all duration-200 hover:border-[var(--card-hover-border)] hover:shadow-sm select-none">
      
      {/* Dynamic Status Stripe */}
      <div 
        className="w-1.5 shrink-0 rounded-l-[3px] transition-colors duration-300" 
        style={{ backgroundColor: statusColor }}
      ></div>
      
      {/* Card Contents */}
      <div className="flex-1 p-3.5 relative overflow-visible">
        
        {/* Header Title & Dots */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="text-[var(--text-main)] font-semibold truncate text-[13.5px] max-w-[85%]">{connection.name}</div>
          
          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold px-1.5 text-base leading-none shrink-0 outline-none cursor-pointer"
            >
              ⋮
            </button>
            {menuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setMenuOpen(false)}
                ></div>
                <div className="absolute right-0 top-6 bg-[var(--bg-panel-header)] border border-[var(--border-color)] shadow-xl rounded-[3px] py-1 w-36 z-20 text-xs text-[var(--text-main)]">
                  <button 
                    onClick={() => { setMenuOpen(false); onEdit(connection.id); }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={() => { setMenuOpen(false); onDuplicate(connection.id); }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)] cursor-pointer"
                  >
                    Duplicate
                  </button>
                  <button 
                    onClick={() => { setMenuOpen(false); onDelete(connection.id); }}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-[var(--bg-panel)] hover:text-rose-400 cursor-pointer text-rose-500 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* User / Host monospace specs */}
        <div className="text-[11px] font-mono text-[var(--text-muted)] mb-1.5 truncate">{userHost}</div>

        {/* Tunnel display */}
        {connection.tunnelName && (
          <div className="text-[11px] text-[var(--active-tab-text)] mb-1.5 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="2" cy="6" r="1.5"/>
              <circle cx="10" cy="6" r="1.5"/>
              <line x1="3.5" y1="6" x2="8.5" y2="6"/>
              <line x1="6" y1="4" x2="6" y2="8"/>
            </svg>
            via {connection.tunnelName}
          </div>
        )}

        {/* Auth Method Badge & Timestamp */}
        <div className="flex items-center gap-2.5 mt-2">
          <span className="text-[10px] bg-[var(--bg-panel-header)] border border-[var(--border-color)] rounded-[2px] px-2.5 py-0.5 text-[var(--text-muted)] font-medium select-none">
            {authLabel}
          </span>
          <span className="text-[11px] text-[var(--text-subtle)]">
            {lastConn}
          </span>
        </div>

        {/* Action Button Row */}
        <div className="mt-3 flex gap-4 items-center">
          {isActive ? (
            <button 
              onClick={() => onDisconnect(connection.id)}
              className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-app)] active:bg-[var(--bg-panel-header)] border border-[var(--border-color)] text-[var(--text-main)] text-xs px-4 py-1 rounded-[3px] cursor-pointer font-medium select-none transition-all outline-none"
            >
              Disconnect
            </button>
          ) : (
            <button 
              onClick={() => onConnect(connection.id)}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs px-4 py-1 rounded-[3px] cursor-pointer font-semibold select-none transition-all outline-none"
            >
              Connect
            </button>
          )}

          {/* Status Indicator */}
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-medium select-none">
            <div 
              className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300"
              style={{ 
                backgroundColor: statusColor,
                boxShadow: isActive ? '0 0 4px #10b981' : 'none',
              }}
            ></div>
            {statusLabel}
          </span>
        </div>

      </div>
    </div>
  );
};
export default ConnectionCard;
