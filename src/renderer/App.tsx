import { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { Dashboard } from './components/Dashboard';
import { ConnectionLoading } from './components/ConnectionLoading';
import { FileManager } from './components/FileManager';
import { NewConnectionWizard } from './components/NewConnectionWizard';
import { SettingsModal } from './components/SettingsModal';
import type { Connection } from './components/ConnectionCard';

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

      const mapped = conns.map((c: any) => {
        const cred = creds.find((cr: any) => cr.id === c.credentialId);
        const tunnel = conns.find((cn: any) => cn.id === c.tunnelViaConnectionId);
        return {
          ...c,
          credentialUsername: cred ? cred.username : 'root',
          credentialType: cred ? cred.type : 'PASSWORD_TOTP',
          tunnelName: tunnel ? tunnel.name : undefined,
        };
      });
      setConnections(mapped);
    } catch (err: any) {
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
    } catch (err: any) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'failed', error: err.message } : t));
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
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message}`);
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
      } catch (err: any) {
        alert(`Delete failed: ${err.message}`);
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
    } catch (err: any) {
      alert(`Duplicate failed: ${err.message}`);
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
      <div className="h-[30px] bg-[var(--bg-app)] border-b border-[var(--border-color)] flex items-end shrink-0 overflow-hidden select-none">
        {/* Connections home tab */}
        <div 
          onClick={() => setActiveTabId('connections')}
          className={`h-7 px-3.5 flex items-center gap-1.5 text-xs cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t ${
            activeTabId === 'connections' 
              ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t-[2px] border-t-[var(--color-primary)] border-b border-b-[var(--bg-panel)] font-medium' 
              : 'bg-[var(--bg-panel-header)] text-[var(--text-muted)] border-t-transparent border-b border-b-[var(--border-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]'
          }`}
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
              className={`h-7 px-3 flex items-center gap-1.5 text-xs cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t ${
                isActive 
                  ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t-[2px] border-t-[var(--color-primary)] border-b border-b-[var(--bg-panel)] font-medium' 
                  : 'bg-[var(--bg-panel-header)] text-[var(--text-muted)] border-t-transparent border-b border-b-[var(--border-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-main)]'
              }`}
            >
              <div 
                className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300"
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
                className="ml-1 text-[var(--text-subtle)] hover:text-[var(--text-main)] font-semibold text-[15px] leading-none mt-[-1px] outline-none cursor-pointer"
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
          className="h-7 w-[30px] flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] text-[17px] mt-[-1px] shrink-0 border-b border-[var(--border-color)]"
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
                <div className="flex-1 flex flex-col items-center justify-center bg-[#141414] select-none text-neutral-300 font-sans p-6">
                  <div className="w-[420px] bg-[#1e1e1e] border border-neutral-800 rounded-[4px] p-6 shadow-xl text-center">
                    <div className="w-12 h-12 bg-red-950/20 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 text-xl font-bold">
                      !
                    </div>
                    <h3 className="text-[14px] font-semibold text-neutral-200 mb-2">Connection Failed</h3>
                    <p className="text-xs text-neutral-500 font-mono bg-[#141414] p-3 rounded-[3px] border border-neutral-900/60 break-all text-left mb-6 leading-relaxed max-h-40 overflow-y-auto">
                      {currentTab.error}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button 
                        onClick={() => currentTab.connectionId && handleRetryConnect(currentTab.connectionId)}
                        className="bg-[#29ABEE] hover:bg-[#1a9ad9] active:bg-[#1685bc] border-none text-white text-xs px-5 py-2 rounded-[3px] font-semibold cursor-pointer outline-none transition-colors"
                      >
                        Retry Connection
                      </button>
                      <button 
                        onClick={() => handleCloseTab(currentTab.id)}
                        className="bg-transparent hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 text-xs px-5 py-2 rounded-[3px] font-medium cursor-pointer outline-none transition-colors"
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
    </div>
  );
}

export default App;
