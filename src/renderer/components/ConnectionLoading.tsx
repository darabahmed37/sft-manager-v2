import React from 'react';

interface ConnectionLoadingProps {
  connectionName: string;
  host: string;
  status: string;
  hasJump?: boolean;
  jumpHost?: string;
  onCancel: () => void;
  theme?: 'dark' | 'light';
}

export const ConnectionLoading: React.FC<ConnectionLoadingProps> = ({
  connectionName,
  host,
  status,
  hasJump = false,
  jumpHost = 'jump-gateway.net',
  onCancel,
  theme = 'dark',
}) => {
  // Determine highlight colors based on current status messages
  const isConnectingJump = status.toLowerCase().includes('connecting to') && status.toLowerCase().includes('1/');
  const isConnectingTarget = status.toLowerCase().includes('connecting to') && status.toLowerCase().includes('2/');
  const isAuthenticatingTarget = status.toLowerCase().includes('authenticating') || status.toLowerCase().includes('authenticated');

  const isLight = theme === 'light';

  // Highlight colors
  const activeColor = isLight ? '#2563eb' : '#29ABEE'; // Blue / Cyan
  const successColor = isLight ? '#10b981' : '#4ec9b0'; // Emerald / Mint
  const defaultBorder = isLight ? 'var(--border-color)' : '#2d2d2d';
  const defaultIcon = isLight ? 'var(--text-subtle)' : '#444';
  const defaultText = isLight ? 'var(--text-muted)' : '#666';
  const defaultIconBg = isLight ? 'var(--bg-panel-header)' : 'rgba(45,45,45,0.2)';
  const defaultDot = isLight ? 'var(--border-color)' : '#2d2d2d';

  // Node 1 (Jump Server) highlights
  const n1Border = isConnectingJump ? activeColor : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? successColor : defaultBorder;
  const n1Color = isConnectingJump ? activeColor : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? successColor : defaultIcon;
  const n1TextColor = isConnectingJump ? activeColor : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? successColor : defaultText;
  const n1IconBg = isConnectingJump 
    ? (isLight ? 'rgba(37,99,235,0.06)' : 'rgba(41,171,238,0.05)') 
    : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) 
      ? (isLight ? 'rgba(16,185,129,0.06)' : 'rgba(78,201,176,0.05)') 
      : defaultIconBg;
  const n1DotColor = isConnectingJump ? activeColor : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? successColor : defaultDot;
  const n1Anim = isConnectingJump ? 'nodeGlow 2s ease-in-out infinite' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? 'connGlow 2s ease-in-out infinite' : 'none';
  const n1DotAnim = isConnectingJump || (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? 'pulse 1.5s infinite' : 'none';

  // Node 2 (Target Server) highlights
  const n2Border = isConnectingTarget ? activeColor : isAuthenticatingTarget ? successColor : defaultBorder;
  const n2Color = isConnectingTarget ? activeColor : isAuthenticatingTarget ? successColor : defaultIcon;
  const n2TextColor = isConnectingTarget ? activeColor : isAuthenticatingTarget ? successColor : defaultText;
  const n2IconBg = isConnectingTarget 
    ? (isLight ? 'rgba(37,99,235,0.06)' : 'rgba(41,171,238,0.05)') 
    : isAuthenticatingTarget 
      ? (isLight ? 'rgba(16,185,129,0.06)' : 'rgba(78,201,176,0.05)') 
      : defaultIconBg;
  const n2DotColor = isConnectingTarget ? activeColor : isAuthenticatingTarget ? successColor : defaultDot;
  const n2Anim = isConnectingTarget ? 'nodeGlow 2s ease-in-out infinite' : isAuthenticatingTarget ? 'connGlow 2s ease-in-out infinite' : 'none';
  const n2DotAnim = isConnectingTarget || isAuthenticatingTarget ? 'pulse 1.5s infinite' : 'none';

  // Line Flow indicators
  const lineDefault = isLight ? 'var(--border-color)' : '#222';
  const line0Color = (isConnectingJump || isConnectingTarget || isAuthenticatingTarget) ? successColor : lineDefault;
  const line0Anim = (isConnectingJump || isConnectingTarget || isAuthenticatingTarget) ? 'flowDot 1.5s linear infinite' : 'none';

  const line1Color = isAuthenticatingTarget ? successColor : isConnectingTarget ? activeColor : lineDefault;
  const line1Anim = isAuthenticatingTarget ? 'flowDot 1.5s linear infinite' : isConnectingTarget ? 'flowDot 1.5s linear infinite' : 'none';

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-app)] animate-fade-up relative overflow-hidden select-none">
      {/* CSS Keyframes Injection */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        @keyframes flowDot {
          0% { top: -20px; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes nodeGlow {
          0%, 100% { box-shadow: 0 0 0 1px ${isLight ? 'rgba(37, 99, 235, 0.15)' : 'rgba(41, 171, 238, 0.3)'}; }
          50% { box-shadow: 0 0 12px 3px ${isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(41, 171, 238, 0.15)'}, 0 0 0 1.5px ${isLight ? 'rgba(37, 99, 235, 0.3)' : 'rgba(41, 171, 238, 0.5)'}; }
        }
        @keyframes connGlow {
          0%, 100% { box-shadow: 0 0 0 1px ${isLight ? 'rgba(16, 185, 129, 0.15)' : 'rgba(78, 201, 176, 0.3)'}; }
          50% { box-shadow: 0 0 12px 3px ${isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(78, 201, 176, 0.1)'}, 0 0 0 1.5px ${isLight ? 'rgba(16, 185, 129, 0.3)' : 'rgba(78, 201, 176, 0.5)'}; }
        }
        .animate-fade-up {
          animation: fadeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${isLight ? 'rgba(0,0,0,0.012)' : 'rgba(41, 171, 238, 0.015)'} 1px, transparent 1px), linear-gradient(90deg, ${isLight ? 'rgba(0,0,0,0.012)' : 'rgba(41, 171, 238, 0.015)'} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      ></div>

      {/* Status Details */}
      <div className="text-center mb-9 relative z-10">
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1.5">{connectionName}</h2>
        <p className="text-[11px] text-[var(--text-muted)] tracking-wide font-mono uppercase">{status}</p>
      </div>

      {/* Connection Nodes Stack */}
      <div className="flex flex-col items-center relative z-10 w-[240px]">
        
        {/* Node 0: Local Machine */}
        <div 
          className="w-full bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[6px] px-3.5 py-2.5 flex items-center gap-3"
          style={{ animation: 'connGlow 2.5s ease-in-out infinite' }}
        >
          <div className="w-[30px] h-[30px] bg-emerald-500/10 border border-emerald-500/20 rounded-[4px] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="14" height="9" rx="1" stroke={successColor} strokeWidth="1.4" />
              <path d="M0 13h18" stroke={successColor} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-[var(--text-main)] truncate">Local Machine</h3>
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 truncate">localhost</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0"></div>
        </div>

        {/* Line 0 -> 1 */}
        {hasJump && (
          <>
            <div className="w-[1px] h-12 bg-[var(--border-color)] relative overflow-hidden">
              <div 
                className="absolute w-full h-4"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${line0Color}, transparent)`,
                  animation: line0Anim,
                  top: '-20px',
                }}
              ></div>
            </div>

            {/* Node 1: Jump Proxy Server */}
            <div 
              className="w-full bg-[var(--bg-panel)] rounded-[6px] px-3.5 py-2.5 flex items-center gap-3 transition-all duration-300"
              style={{
                border: `1px solid ${n1Border}`,
                animation: n1Anim,
              }}
            >
              <div 
                className="w-[30px] h-[30px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors duration-300"
                style={{ backgroundColor: n1IconBg }}
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="2" width="16" height="5" rx="1" stroke={n1Color} strokeWidth="1.4" />
                  <rect x="1" y="11" width="16" height="5" rx="1" stroke={n1Color} strokeWidth="1.4" />
                  <circle cx="4" cy="4.5" r="1" fill={n1Color} />
                  <circle cx="4" cy="13.5" r="1" fill={n1Color} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold truncate" style={{ color: n1TextColor }}>Jump Server</h3>
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 truncate">{jumpHost}</p>
              </div>
              <div 
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300"
                style={{
                  backgroundColor: n1DotColor,
                  boxShadow: n1DotColor !== defaultDot ? `0 0 5px ${n1DotColor}` : 'none',
                  animation: n1DotAnim,
                }}
              ></div>
            </div>
          </>
        )}

        {/* Line 1 -> 2 (or Line 0 -> 2 if direct) */}
        <div className="w-[1px] h-12 bg-[var(--border-color)] relative overflow-hidden">
          <div 
            className="absolute w-full h-4"
            style={{
              background: `linear-gradient(to bottom, transparent, ${hasJump ? line1Color : line0Color}, transparent)`,
              animation: hasJump ? line1Anim : line0Anim,
              top: '-20px',
            }}
          ></div>
        </div>

        {/* Node 2: Target Server */}
        <div 
          className="w-full bg-[var(--bg-panel)] rounded-[6px] px-3.5 py-2.5 flex items-center gap-3 transition-all duration-300"
          style={{
            border: `1px solid ${n2Border}`,
            animation: n2Anim,
          }}
        >
          <div 
            className="w-[30px] h-[30px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors duration-300"
            style={{ backgroundColor: n2IconBg }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="2" width="16" height="5" rx="1" stroke={n2Color} strokeWidth="1.4" />
              <rect x="1" y="11" width="16" height="5" rx="1" stroke={n2Color} strokeWidth="1.4" />
              <circle cx="4" cy="4.5" r="1" fill={n2Color} />
              <circle cx="4" cy="13.5" r="1" fill={n2Color} />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold truncate" style={{ color: n2TextColor }}>{connectionName}</h3>
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 truncate">{host}</p>
          </div>
          <div 
            className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300"
            style={{
              backgroundColor: n2DotColor,
              boxShadow: n2DotColor !== defaultDot ? `0 0 5px ${n2DotColor}` : 'none',
              animation: n2DotAnim,
            }}
          ></div>
        </div>

      </div>

      {/* Progress Dots + Cancel Actions */}
      <div className="mt-8 flex flex-col items-center gap-4 relative z-10">
        <div className="flex gap-1.5">
          <div className="w-1 h-1 rounded-full bg-[var(--color-primary)]" style={{ animation: 'pulse 1.3s infinite' }}></div>
          <div className="w-1 h-1 rounded-full bg-[var(--color-primary)]" style={{ animation: 'pulse 1.3s infinite 0.15s' }}></div>
          <div className="w-1 h-1 rounded-full bg-[var(--color-primary)]" style={{ animation: 'pulse 1.3s infinite 0.3s' }}></div>
        </div>
        
        <button 
          onClick={onCancel}
          className="bg-[var(--bg-panel)] hover:bg-[var(--bg-panel-header)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold text-xs px-5 py-2 rounded-[6px] cursor-pointer transition-all outline-none"
        >
          Cancel Connection
        </button>
      </div>

    </div>
  );
};

export default ConnectionLoading;
