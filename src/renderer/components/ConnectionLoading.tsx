import React from 'react';

interface ConnectionLoadingProps {
  connectionName: string;
  host: string;
  status: string;
  hasJump?: boolean;
  jumpHost?: string;
  onCancel: () => void;
}

export const ConnectionLoading: React.FC<ConnectionLoadingProps> = ({
  connectionName,
  host,
  status,
  hasJump = false,
  jumpHost = 'jump-gateway.net',
  onCancel,
}) => {
  // Determine highlight colors based on current status messages
  const isConnectingJump = status.toLowerCase().includes('connecting to') && status.toLowerCase().includes('1/');
  const isConnectingTarget = status.toLowerCase().includes('connecting to') && status.toLowerCase().includes('2/');
  const isAuthenticatingTarget = status.toLowerCase().includes('authenticating') || status.toLowerCase().includes('authenticated');

  // Node 1 (Jump Server) highlights
  const n1Border = isConnectingJump ? '#29ABEE' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? '#4ec9b0' : '#2d2d2d';
  const n1Color = isConnectingJump ? '#29ABEE' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? '#4ec9b0' : '#444';
  const n1TextColor = isConnectingJump ? '#29ABEE' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? '#4ec9b0' : '#666';
  const n1IconBg = isConnectingJump ? 'rgba(41,171,238,0.05)' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? 'rgba(78,201,176,0.05)' : 'rgba(45,45,45,0.2)';
  const n1DotColor = isConnectingJump ? '#29ABEE' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? '#4ec9b0' : '#2d2d2d';
  const n1Anim = isConnectingJump ? 'nodeGlow 2s ease-in-out infinite' : (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? 'connGlow 2s ease-in-out infinite' : 'none';
  const n1DotAnim = isConnectingJump || (hasJump && (isConnectingTarget || isAuthenticatingTarget)) ? 'pulse 1.5s infinite' : 'none';

  // Node 2 (Target Server) highlights
  const n2Border = isConnectingTarget ? '#29ABEE' : isAuthenticatingTarget ? '#4ec9b0' : '#2d2d2d';
  const n2Color = isConnectingTarget ? '#29ABEE' : isAuthenticatingTarget ? '#4ec9b0' : '#444';
  const n2TextColor = isConnectingTarget ? '#29ABEE' : isAuthenticatingTarget ? '#4ec9b0' : '#666';
  const n2IconBg = isConnectingTarget ? 'rgba(41,171,238,0.05)' : isAuthenticatingTarget ? 'rgba(78,201,176,0.05)' : 'rgba(45,45,45,0.2)';
  const n2DotColor = isConnectingTarget ? '#29ABEE' : isAuthenticatingTarget ? '#4ec9b0' : '#2d2d2d';
  const n2Anim = isConnectingTarget ? 'nodeGlow 2s ease-in-out infinite' : isAuthenticatingTarget ? 'connGlow 2s ease-in-out infinite' : 'none';
  const n2DotAnim = isConnectingTarget || isAuthenticatingTarget ? 'pulse 1.5s infinite' : 'none';

  // Line Flow indicators
  const line0Color = (isConnectingJump || isConnectingTarget || isAuthenticatingTarget) ? '#4ec9b0' : '#2a2a2a';
  const line0Anim = (isConnectingJump || isConnectingTarget || isAuthenticatingTarget) ? 'flowDot 1.5s linear infinite' : 'none';

  const line1Color = isAuthenticatingTarget ? '#4ec9b0' : isConnectingTarget ? '#29ABEE' : '#2a2a2a';
  const line1Anim = isAuthenticatingTarget ? 'flowDot 1.5s linear infinite' : isConnectingTarget ? 'flowDot 1.5s linear infinite' : 'none';

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#141414] animate-fade-up relative overflow-hidden select-none">
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
          0%, 100% { box-shadow: 0 0 0 1px rgba(41, 171, 238, 0.3); }
          50% { box-shadow: 0 0 12px 3px rgba(41, 171, 238, 0.15), 0 0 0 1.5px rgba(41, 171, 238, 0.5); }
        }
        @keyframes connGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(78, 201, 176, 0.3); }
          50% { box-shadow: 0 0 12px 3px rgba(78, 201, 176, 0.1), 0 0 0 1.5px rgba(78, 201, 176, 0.5); }
        }
        .animate-fade-up {
          animation: fadeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(41, 171, 238, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(41, 171, 238, 0.015) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      ></div>

      {/* Status Details */}
      <div className="text-center mb-9 relative z-10">
        <h2 className="text-sm font-semibold text-[#e0e0e0] mb-1.5">{connectionName}</h2>
        <p className="text-[11px] text-[#666] tracking-wide font-mono uppercase">{status}</p>
      </div>

      {/* Connection Nodes Stack */}
      <div className="flex flex-col items-center relative z-10 w-[240px]">
        
        {/* Node 0: Local Machine */}
        <div 
          className="w-full bg-[#1c1c1c] border border-[#4ec9b0] rounded-[3px] px-3.5 py-2.5 flex items-center gap-3"
          style={{ animation: 'connGlow 2.5s ease-in-out infinite' }}
        >
          <div className="w-[30px] h-[30px] bg-emerald-950/20 border border-emerald-500/20 rounded-[3px] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="14" height="9" rx="1" stroke="#4ec9b0" strokeWidth="1.4" />
              <path d="M0 13h18" stroke="#4ec9b0" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-[#4ec9b0] truncate">Local Machine</h3>
            <p className="text-[10px] font-mono text-[#555] mt-0.5 truncate">localhost</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0] shadow-[0_0_5px_#4ec9b0] shrink-0"></div>
        </div>

        {/* Line 0 -> 1 */}
        {hasJump && (
          <>
            <div className="w-[1px] h-12 bg-[#222] relative overflow-hidden">
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
              className="w-full bg-[#1c1c1c] rounded-[3px] px-3.5 py-2.5 flex items-center gap-3 transition-all duration-300"
              style={{
                border: `1px solid ${n1Border}`,
                animation: n1Anim,
              }}
            >
              <div 
                className="w-[30px] h-[30px] rounded-[3px] flex items-center justify-center shrink-0 transition-colors duration-300"
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
                <p className="text-[10px] font-mono text-[#555] mt-0.5 truncate">{jumpHost}</p>
              </div>
              <div 
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300"
                style={{
                  backgroundColor: n1DotColor,
                  boxShadow: n1DotColor !== '#2d2d2d' ? `0 0 5px ${n1DotColor}` : 'none',
                  animation: n1DotAnim,
                }}
              ></div>
            </div>
          </>
        )}

        {/* Line 1 -> 2 (or Line 0 -> 2 if direct) */}
        <div className="w-[1px] h-12 bg-[#222] relative overflow-hidden">
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
          className="w-full bg-[#1c1c1c] rounded-[3px] px-3.5 py-2.5 flex items-center gap-3 transition-all duration-300"
          style={{
            border: `1px solid ${n2Border}`,
            animation: n2Anim,
          }}
        >
          <div 
            className="w-[30px] h-[30px] rounded-[3px] flex items-center justify-center shrink-0 transition-colors duration-300"
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
            <p className="text-[10px] font-mono text-[#555] mt-0.5 truncate">{host}</p>
          </div>
          <div 
            className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300"
            style={{
              backgroundColor: n2DotColor,
              boxShadow: n2DotColor !== '#2d2d2d' ? `0 0 5px ${n2DotColor}` : 'none',
              animation: n2DotAnim,
            }}
          ></div>
        </div>

      </div>

      {/* Progress Dots + Cancel Actions */}
      <div className="mt-8 flex flex-col items-center gap-4 relative z-10">
        <div className="flex gap-1.5">
          <div className="w-1 h-1 rounded-full bg-[#29ABEE]" style={{ animation: 'pulse 1.3s infinite' }}></div>
          <div className="w-1 h-1 rounded-full bg-[#29ABEE]" style={{ animation: 'pulse 1.3s infinite 0.15s' }}></div>
          <div className="w-1 h-1 rounded-full bg-[#29ABEE]" style={{ animation: 'pulse 1.3s infinite 0.3s' }}></div>
        </div>
        
        <button 
          onClick={onCancel}
          className="bg-transparent hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 active:bg-neutral-950 text-neutral-500 hover:text-neutral-400 font-medium text-xs px-5 py-1.5 rounded-[3px] cursor-pointer transition-all outline-none"
        >
          Cancel Connection
        </button>
      </div>

    </div>
  );
};

export default ConnectionLoading;
