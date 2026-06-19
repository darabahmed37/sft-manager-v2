import { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { Dashboard } from './components/Dashboard';
import { ConnectionLoading } from './components/ConnectionLoading';
import { NewConnectionWizard } from './components/NewConnectionWizard';
import type { Connection } from './components/ConnectionCard';

function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeSessions, setActiveSessions] = useState<Set<number>>(new Set());
  const [sessionIds, setSessionIds] = useState<Map<number, string>>(new Map());

  // Views & Overlay state
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'LOADING' | 'FILE_EXPLORER'>('DASHBOARD');
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);

  // Loading indicator details
  const [loadingState, setLoadingState] = useState<{
    connectionId: number;
    name: string;
    host: string;
    status: string;
    hasJump: boolean;
    jumpHost: string;
  }>({
    connectionId: 0,
    name: '',
    host: '',
    status: '',
    hasJump: false,
    jumpHost: '',
  });

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

  // Set up connection progress listener
  useEffect(() => {
    const unsub = window.electronAPI.ssh.onProgress((_event, data) => {
      setLoadingState((prev) => {
        if (prev.connectionId === data.connectionId) {
          return { ...prev, status: data.message };
        }
        return prev;
      });
    });
    return () => unsub();
  }, []);

  const handleConnect = async (id: number) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;

    setLoadingState({
      connectionId: id,
      name: conn.name,
      host: conn.host,
      status: 'Initializing connection sequence...',
      hasJump: conn.tunnelViaConnectionId !== null,
      jumpHost: conn.tunnelName || 'jump-gateway.net',
    });

    setCurrentView('LOADING');

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
        setCurrentView('DASHBOARD');
      } else {
        alert(`Connection Failed: ${res.error || 'Unknown error'}`);
        setCurrentView('DASHBOARD');
      }
    } catch (err: any) {
      alert(`Connection Exception: ${err.message}`);
      setCurrentView('DASHBOARD');
    }
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
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message}`);
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

  const handleCancelLoading = async () => {
    // Return to dashboard panel
    setCurrentView('DASHBOARD');
  };

  return (
    <div className="h-screen flex flex-col bg-[#141414] overflow-hidden">
      {/* Title Bar */}
      <TitleBar title="i2c SFTP" />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === 'DASHBOARD' && (
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
          />
        )}

        {currentView === 'LOADING' && (
          <ConnectionLoading
            connectionName={loadingState.name}
            host={`${loadingState.host}`}
            status={loadingState.status}
            hasJump={loadingState.hasJump}
            jumpHost={loadingState.jumpHost}
            onCancel={handleCancelLoading}
          />
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
    </div>
  );
}

export default App;
