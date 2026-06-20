import { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { Dashboard } from './components/Dashboard';
import { ConnectionLoading } from './components/ConnectionLoading';
import { FileManager } from './components/FileManager';
import { NewConnectionWizard } from './components/NewConnectionWizard';
import { SettingsModal } from './components/SettingsModal';
import type { Connection } from './components/ConnectionCard';
import type { ConnectionProfile, StoredCredential } from './global';

interface Tab {
  id: string; // 'connections' or `conn-${connectionId}`
  name: string;
  type: 'connections' | 'connection';
  connectionId?: number;
  status?: 'connecting' | 'connected' | 'failed';
  error?: string;
  loadingStatus?: string;
  hasJump?: boolean;
  jumpHost?: string;
}

function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeSessions, setActiveSessions] = useState<Set<number>>(new Set());
  const [sessionIds, setSessionIds] = useState<Map<number, string>>(new Map());

  // Views, tabs & Overlay state
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'connections', name: 'Connections', type: 'connections' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('connections');
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [hostKeyPrompt, setHostKeyPrompt] = useState<{
    host: string;
    port: number;
    keyType: string;
    fingerprint: string;
    publicKey: string;
  } | null>(null);

  // Listen to host key verification events
  useEffect(() => {
    const unsub = window.electronAPI.ssh.onHostKeyVerify((_event, data) => {
      setHostKeyPrompt(data);
    });
    return () => unsub();
  }, []);

  // Inactivity tracking and disconnect
  useEffect(() => {
    if (activeSessions.size === 0) return;

    let timeoutMinutes = 20;
    window.electronAPI.settings.getSetting('ssh.inactivity.timeout', '20')
      .then(val => {
        timeoutMinutes = parseInt(val, 10) || 20;
      })
      .catch(() => {});

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Disconnect all sessions
        setTabs(prev => {
          const conns = prev.filter(t => t.type === 'connection');
          conns.forEach(c => {
            if (c.connectionId) {
              const sessionId = sessionIds.get(c.connectionId);
              if (sessionId) {
                window.electronAPI.ssh.disconnect(sessionId).catch(console.error);
              }
            }
          });
          return [{ id: 'connections', name: 'Connections', type: 'connections' }];
        });
        setActiveSessions(new Set());
        setSessionIds(new Map());
        setActiveTabId('connections');
        alert('You have been disconnected due to inactivity.');
      }, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'click'];
    const handleEvent = () => resetTimer();
    events.forEach(ev => window.addEventListener(ev, handleEvent));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(ev => window.removeEventListener(ev, handleEvent));
    };
  }, [activeSessions, sessionIds]);

  // Global Dark/Light Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const refreshConnections = async () => {
    try {
      const conns = await window.electronAPI.db.getConnections();
      const creds = await window.electronAPI.db.getCredentials();

      const mapped = conns.map((c: ConnectionProfile) => {
        const cred = creds.find((cr: StoredCredential) => cr.id === c.credentialId);
        const tunnel = conns.find((cn: ConnectionProfile) => cn.id === c.tunnelViaConnectionId);
        return {
          ...c,
          credentialUsername: cred ? cred.username : 'root',
          credentialType: cred ? cred.type : 'PASSWORD_TOTP',
          tunnelName: tunnel ? tunnel.name : undefined,
        };
      });
      setConnections(mapped);
    } catch (err: unknown) {
      console.error('Failed to load connections', err);
    }
  };

  useEffect(() => {
    refreshConnections();
  }, []);

  // Set up connection progress listener across active tabs
  useEffect(() => {
    const unsub = window.electronAPI.ssh.onProgress((_event, data) => {
      setTabs((prev) => {
        return prev.map((t) => {
          if (t.type === 'connection' && t.connectionId === data.connectionId) {
            return { ...t, loadingStatus: data.message };
          }
          return t;
        });
      });
    });
    return () => unsub();
  }, []);

  const runConnectionFlow = async (id: number, tabId: string) => {
    try {
      const res = await window.electronAPI.ssh.connect(id);
      if (res.success && res.sessionId) {
        setActiveSessions((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        setSessionIds((prev) => {
          const next = new Map(prev);
          next.set(id, res.sessionId!);
          return next;
        });
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'connected' } : t));
      } else {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'failed', error: res.error || 'Unknown error' } : t));
      }
    } catch (err: unknown) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'failed', error: (err as Error).message } : t));
    }
  };

  const handleConnect = async (id: number) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;

    const tabId = `conn-${id}`;
    
    // If tab already exists, activate it
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      setActiveTabId(tabId);
      return;
    }

    const newTab: Tab = {
      id: tabId,
      name: conn.name,
      type: 'connection',
      connectionId: id,
      status: 'connecting',
      loadingStatus: 'Initializing connection sequence...',
      hasJump: conn.tunnelViaConnectionId !== null,
      jumpHost: conn.tunnelName || 'jump-gateway.net',
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);

    runConnectionFlow(id, tabId);
  };

  const handleRetryConnect = (id: number) => {
    const tabId = `conn-${id}`;
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'connecting', loadingStatus: 'Re-initializing connection sequence...' } : t));
    runConnectionFlow(id, tabId);
  };

  const handleDisconnect = async (id: number) => {
    const sessionId = sessionIds.get(id);
    if (!sessionId) return;

    try {
      await window.electronAPI.ssh.disconnect(sessionId);
      setActiveSessions((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSessionIds((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Update corresponding tab if it exists
      const tabId = `conn-${id}`;
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'failed', error: 'Session disconnected by user' } : t));
    } catch (err: unknown) {
      alert(`Disconnect failed: ${(err as Error).message}`);
    }
  };

  const handleCloseTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    setTabs(prev => prev.filter(t => t.id !== tabId));

    if (activeTabId === tabId) {
      setActiveTabId('connections');
    }

    if (tab.connectionId) {
      const sessionId = sessionIds.get(tab.connectionId);
      if (sessionId) {
        handleDisconnect(tab.connectionId);
      }
    }
  };

  const handleEdit = (id: number) => {
    setEditingConnectionId(id);
    setIsWizardOpen(true);
  };

  const handleDelete = async (id: number) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;

    if (confirm(`Are you sure you want to delete profile "${conn.name}"?`)) {
      try {
        await window.electronAPI.db.deleteConnection(id);
        refreshConnections();
        // Close tab if open
        handleCloseTab(`conn-${id}`);
      } catch (err: unknown) {
        alert(`Delete failed: ${(err as Error).message}`);
      }
    }
  };

  const handleDuplicate = async (id: number) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;

    try {
      await window.electronAPI.db.addConnection({
        name: `${conn.name} Copy`,
        host: conn.host,
        port: conn.port,
        workingDir: conn.workingDir,
        connectionTypeId: conn.connectionTypeId,
        credentialId: conn.credentialId,
        tunnelViaConnectionId: conn.tunnelViaConnectionId,
      });
      refreshConnections();
    } catch (err: unknown) {
      alert(`Duplicate failed: ${(err as Error).message}`);
    }
  };

  // Determine Title Bar title dynamically based on active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  let title = 'i2c SFTP';
  if (activeTab.type === 'connection') {
    if (activeTab.status === 'connecting') {
      title = 'Connecting...';
    } else if (activeTab.status === 'connected') {
      title = `i2c SFTP — ${activeTab.name}`;
    } else if (activeTab.status === 'failed') {
      title = `Connection Failed — ${activeTab.name}`;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden theme-transition">
      {/* Title Bar */}
      <TitleBar 
        title={title} 
        theme={theme} 
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
      />

      {/* Session Tab Strip */}
      <div className="h-[36px] bg-[var(--bg-app)] border-b border-[var(--border-color)] flex items-end shrink-0 overflow-hidden select-none">
        {/* Connections home tab */}
        <div 
          onClick={() => setActiveTabId('connections')}
          className={`h-8 px-4 flex items-center gap-1.5 text-[12.5px] cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t ${
            activeTabId === 'connections' 
              ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t-transparent border-b border-b-[var(--bg-panel)] font-medium' 
              : 'bg-[var(--bg-panel-header)] text-[var(--text-muted)] border-t-transparent border-b border-b-[var(--border-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]'
          }`}
          style={activeTabId === 'connections' ? { boxShadow: 'inset 0 -2px 0 var(--color-primary)' } as React.CSSProperties : undefined}
        >
          <svg className="w-3 h-3 text-[var(--text-muted)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="2" width="10" height="8" rx="1"/>
            <line x1="1" y1="4.5" x2="11" y2="4.5"/>
            <line x1="3.5" y1="6.5" x2="5.5" y2="6.5"/>
            <line x1="3.5" y1="8" x2="7.5" y2="8"/>
          </svg>
          Connections
        </div>

        {/* Active connection tabs */}
        {tabs.filter(t => t.type === 'connection').map((tab) => {
          const isActive = activeTabId === tab.id;
          const statusDotColor = tab.status === 'connected' ? '#4ec9b0' : tab.status === 'failed' ? '#f44747' : '#29ABEE';
          return (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-8 px-4 flex items-center gap-1.5 text-[12.5px] cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t ${
                isActive 
                  ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t-transparent border-b border-b-[var(--bg-panel)] font-medium' 
                  : 'bg-[var(--bg-panel-header)] text-[var(--text-muted)] border-t-transparent border-b border-b-[var(--border-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]'
              }`}
              style={isActive ? { boxShadow: 'inset 0 -2px 0 var(--color-primary)' } as React.CSSProperties : undefined}
            >
              <div 
                className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300"
                style={{ 
                  backgroundColor: statusDotColor,
                  boxShadow: tab.status === 'connecting' ? '0 0 3px #29ABEE' : tab.status === 'connected' ? '0 0 3px #4ec9b0' : 'none' 
                }}
              ></div>
              <span>{tab.name}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="ml-1.5 w-5 h-5 rounded-sm hover:bg-[var(--border-color)] hover:text-[var(--text-main)] flex items-center justify-center text-[14px] leading-none mt-[-1px] outline-none cursor-pointer text-[var(--text-subtle)] transition-colors"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Plus tab button */}
        <div 
          onClick={() => {
            setEditingConnectionId(null);
            setIsWizardOpen(true);
          }}
          className="h-8 w-[36px] flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] text-[18px] mt-[-1px] shrink-0 border-b border-[var(--border-color)]"
          title="New Connection"
        >
          +
        </div>
        <div className="flex-1 border-b border-b-[var(--border-color)]"></div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTabId === 'connections' ? (
          <Dashboard
            connections={connections}
            activeSessions={activeSessions}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onNewConnection={() => {
              setEditingConnectionId(null);
              setIsWizardOpen(true);
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          (() => {
            const currentTab = tabs.find(t => t.id === activeTabId);
            if (!currentTab) return null;

            if (currentTab.status === 'connecting') {
              return (
                <ConnectionLoading
                  connectionName={currentTab.name}
                  host={connections.find(c => c.id === currentTab.connectionId)?.host || ''}
                  status={currentTab.loadingStatus || ''}
                  hasJump={currentTab.hasJump}
                  jumpHost={currentTab.jumpHost}
                  onCancel={() => handleCloseTab(currentTab.id)}
                />
              );
            }

            if (currentTab.status === 'connected') {
              const conn = connections.find(c => c.id === currentTab.connectionId);
              return (
                <FileManager
                  connectionId={currentTab.connectionId}
                  connectionName={currentTab.name}
                  username={conn?.credentialUsername || 'ubuntu'}
                  host={conn?.host || ''}
                  sessionId={sessionIds.get(currentTab.connectionId!) || ''}
                  onDisconnect={() => {
                    if (currentTab.connectionId) {
                      handleDisconnect(currentTab.connectionId);
                    }
                  }}
                />
              );
            }

            if (currentTab.status === 'failed') {
              return (
                <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-app)] select-none text-[var(--text-main)] p-6">
                  <div className="w-[420px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[var(--radius-md)] p-6 shadow-[var(--shadow-modal)] text-center">
                    <div className="w-12 h-12 bg-red-950/20 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 text-xl font-bold">
                      !
                    </div>
                    <h3 className="text-[14.5px] font-semibold text-[var(--text-main)] mb-2">Connection Failed</h3>
                    <p className="text-[11.5px] text-[var(--text-muted)] font-mono bg-[var(--bg-app)] p-3.5 rounded-[var(--radius-sm)] border border-[var(--border-color)] break-all text-left mb-6 leading-relaxed max-h-40 overflow-y-auto">
                      {currentTab.error}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button 
                        onClick={() => currentTab.connectionId && handleRetryConnect(currentTab.connectionId)}
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] border-none text-white text-[12px] px-5 py-2 rounded-[var(--radius-sm)] font-semibold cursor-pointer outline-none transition-colors"
                      >
                        Retry Connection
                      </button>
                      <button 
                        onClick={() => handleCloseTab(currentTab.id)}
                        className="bg-transparent hover:bg-[var(--bg-panel-header)] border border-[var(--border-color)] text-[var(--text-muted)] text-[12px] px-5 py-2 rounded-[var(--radius-sm)] font-medium cursor-pointer outline-none transition-colors"
                      >
                        Close Tab
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })()
        )}
      </div>

      {/* Connection Wizard Modal Overlay */}
      {isWizardOpen && (
        <NewConnectionWizard
          connectionId={editingConnectionId}
          onClose={() => setIsWizardOpen(false)}
          onSave={() => {
            setIsWizardOpen(false);
            refreshConnections();
          }}
        />
      )}

      {/* Application Settings Modal Overlay */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onThemeChange={(newTheme) => setTheme(newTheme)}
        />
      )}

      {/* Host Key Verification Dialog Overlay */}
      {hostKeyPrompt && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-[200] text-[13px] text-[var(--text-main)] font-sans">
          <div className="w-[500px] bg-[var(--bg-panel)] border border-red-500/30 rounded-[4px] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.5)] overflow-hidden">
            
            {/* Header */}
            <div className="h-[36px] bg-red-950/20 border-b border-[var(--border-color)] flex items-center px-4.5 gap-2 text-red-400">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 11.5L7 3 2 11.5z"/>
                <line x1="7" y1="6.5" x2="7" y2="8.5"/>
                <circle cx="7" cy="10" r="0.5" fill="currentColor"/>
              </svg>
              <span className="font-bold text-[11.5px] uppercase tracking-wider">Security Warning: Untrusted Host Key</span>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col gap-3.5 leading-relaxed text-xs">
              <p className="text-[var(--text-main)] font-medium">
                The authenticity of the remote server <span className="font-mono text-cyan-400 font-semibold">{hostKeyPrompt.host}:{hostKeyPrompt.port}</span> cannot be verified.
              </p>
              <p className="text-[var(--text-muted)]">
                The server presented a public key with the following signature:
              </p>
              <div className="bg-[var(--bg-panel-header)] border border-[var(--border-color)]/70 rounded-[3px] p-3 flex flex-col gap-2 font-mono text-[11px] select-text">
                <div className="flex">
                  <span className="w-20 text-[var(--text-muted)] shrink-0">Key Type:</span>
                  <span className="text-emerald-400">{hostKeyPrompt.keyType}</span>
                </div>
                <div className="flex items-start">
                  <span className="w-20 text-[var(--text-muted)] shrink-0">Fingerprint:</span>
                  <span className="text-amber-500 break-all">{hostKeyPrompt.fingerprint}</span>
                </div>
              </div>
              <p className="text-[var(--text-muted)] mt-1">
                Are you sure you want to trust this key and proceed with the connection?
              </p>
            </div>

            {/* Footer */}
            <div className="h-[48px] bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-4.5 justify-end gap-2.5">
              <button 
                onClick={() => {
                  window.electronAPI.ssh.respondHostKeyVerify({ trust: true, save: true });
                  setHostKeyPrompt(null);
                }}
                className="bg-emerald-650 hover:bg-emerald-700 text-white border-none rounded-[3px] px-4.5 py-1.5 text-xs font-semibold cursor-pointer outline-none transition-all"
              >
                Trust & Connect
              </button>
              <button 
                onClick={() => {
                  window.electronAPI.ssh.respondHostKeyVerify({ trust: true, save: false });
                  setHostKeyPrompt(null);
                }}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[3px] px-4.5 py-1.5 text-xs font-semibold cursor-pointer outline-none transition-all"
              >
                Trust Once
              </button>
              <button 
                onClick={() => {
                  window.electronAPI.ssh.respondHostKeyVerify({ trust: false, save: false });
                  setHostKeyPrompt(null);
                }}
                className="bg-transparent border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white rounded-[3px] px-4.5 py-1.5 text-xs font-semibold cursor-pointer outline-none transition-all"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
