import React, { useEffect, useState } from 'react';
import type { ConnectionProfile } from '../global';

interface NewConnectionWizardProps {
  connectionId?: number | null;
  onClose: () => void;
  onSave: () => void;
}

export const NewConnectionWizard: React.FC<NewConnectionWizardProps> = ({
  connectionId = null,
  onClose,
  onSave,
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(connectionId !== null);

  // Form Fields State
  const [name, setName] = useState<string>('');
  const [host, setHost] = useState<string>('');
  const [port, setPort] = useState<number>(22);
  const [workingDir, setWorkingDir] = useState<string>('~');
  const [connectionTypeId, setConnectionTypeId] = useState<number>(1); // 1 = DIRECT, 2 = BASTION
  const [tunnelViaConnectionId, setTunnelViaConnectionId] = useState<number | null>(null);

  // Embedded Credential Fields State
  const [username, setUsername] = useState<string>('');
  const [authMethod, setAuthMethod] = useState<'PASSWORD' | 'KEY' | 'KEYBOARD_INTERACTIVE'>('PASSWORD');
  const [password, setPassword] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [privateKeyPath, setPrivateKeyPath] = useState<string>('');
  const [passphrase, setPassphrase] = useState<string>('');

  // Dropdown list for Bastion jumps
  const [bastionProfiles, setBastionProfiles] = useState<ConnectionProfile[]>([]);

  // Testing connection state
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load existing profile if editing
  useEffect(() => {
    // Load bastion profiles for Gateway options
    window.electronAPI.db.getConnections().then((conns) => {
      // Filter out current profile if editing to avoid loops
      const list = conns.filter((c: ConnectionProfile) => connectionId === null || c.id !== connectionId);
      setBastionProfiles(list);
    });

    if (connectionId !== null) {
      window.electronAPI.db.getConnection(connectionId).then(async (conn) => {
        if (conn) {
          setName(conn.name);
          setHost(conn.host);
          setPort(conn.port);
          setWorkingDir(conn.workingDir || '~');
          setConnectionTypeId(conn.connectionTypeId);
          setTunnelViaConnectionId(conn.tunnelViaConnectionId);

          if (conn.credentialId) {
            const cred = await window.electronAPI.db.getCredential(conn.credentialId);
            if (cred) {
              setUsername(cred.username);
              setAuthMethod(cred.type === 'PASSWORD_TOTP' ? 'PASSWORD' : cred.type === 'KEY_ONLY' ? 'KEY' : 'KEYBOARD_INTERACTIVE');
              setPassword(cred.password || '');
              setTotpSecret(cred.totpSecret || '');
              if (cred.type === 'KEY_ONLY') {
                setPrivateKeyPath(cred.privateKeyName || cred.password || '');
                setPassphrase(cred.privateKeyPassphrase || '');
              }
            }
          }
        }
        setLoading(false);
      });
    }
  }, [connectionId]);

  const handleBrowseKeyFile = async () => {
    const filePath = await window.electronAPI.window.openFile();
    if (filePath) {
      setPrivateKeyPath(filePath);
    }
  };

  const getPrivateKeyFilename = (filePath: string) => {
    if (!filePath) return '';
    const cleanPath = filePath.replace(/\\/g, '/');
    const parts = cleanPath.split('/');
    return parts[parts.length - 1] || '';
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let keyName = '';
      let keyContent = '';
      let keyPassphrase = '';

      if (authMethod === 'KEY') {
        try {
          keyName = getPrivateKeyFilename(privateKeyPath);
          keyContent = await window.electronAPI.fs.readFile(privateKeyPath);
          keyPassphrase = passphrase;
        } catch (readErr: unknown) {
          let loaded = false;
          if (connectionId !== null) {
            const existingConn = await window.electronAPI.db.getConnection(connectionId);
            if (existingConn && existingConn.credentialId) {
              const cred = await window.electronAPI.db.getCredential(existingConn.credentialId);
              if (cred && (cred.privateKeyName === privateKeyPath || !privateKeyPath)) {
                keyName = cred.privateKeyName || '';
                keyContent = cred.privateKeyContent || '';
                keyPassphrase = passphrase || cred.privateKeyPassphrase || '';
                loaded = true;
              }
            }
          }
          if (!loaded) {
            throw readErr;
          }
        }
      }

      // Temporarily save connection profile configuration to test it
      const tempCredId = await window.electronAPI.db.addCredential({
        name: `TEMP_TEST_CRED_${Date.now()}`,
        username,
        passwordPlain: authMethod === 'KEY' ? '' : password,
        totpSecretPlain: totpSecret,
        isDefault: false,
        type: authMethod === 'PASSWORD' ? 'PASSWORD_TOTP' : authMethod === 'KEY' ? 'KEY_ONLY' : 'PASSWORD_TOTP',
        privateKeyName: keyName,
        privateKeyContentPlain: keyContent,
        privateKeyPassphrasePlain: keyPassphrase,
      });

      const tempConnId = await window.electronAPI.db.addConnection({
        name: `TEMP_TEST_CONN_${Date.now()}`,
        host,
        port,
        workingDir,
        connectionTypeId,
        credentialId: tempCredId,
        tunnelViaConnectionId,
      });

      // Execute connect test
      const res = await window.electronAPI.ssh.connect(tempConnId);

      // Clean up temp connection immediately
      await window.electronAPI.db.deleteConnection(tempConnId);
      if (tempCredId) {
        await window.electronAPI.db.deleteCredential(tempCredId);
      }

      if (res.success) {
        if (res.sessionId) {
          await window.electronAPI.ssh.disconnect(res.sessionId);
        }
        setTestResult({ success: true, message: 'Connection established successfully!' });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection failed.' });
      }
    } catch (err: unknown) {
      setTestResult({ success: false, message: (err as Error).message || 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !host.trim() || !username.trim()) {
      alert('Please fill in Connection Name, Host, and Username.');
      return;
    }

    setLoading(true);
    try {
      let keyName = '';
      let keyContent = '';
      let keyPassphrase = '';

      if (authMethod === 'KEY') {
        try {
          keyName = getPrivateKeyFilename(privateKeyPath);
          keyContent = await window.electronAPI.fs.readFile(privateKeyPath);
          keyPassphrase = passphrase;
        } catch (readErr: unknown) {
          let loaded = false;
          if (connectionId !== null) {
            const existingConn = await window.electronAPI.db.getConnection(connectionId);
            if (existingConn && existingConn.credentialId) {
              const cred = await window.electronAPI.db.getCredential(existingConn.credentialId);
              if (cred && (cred.privateKeyName === privateKeyPath || !privateKeyPath)) {
                keyName = cred.privateKeyName || '';
                keyContent = cred.privateKeyContent || '';
                keyPassphrase = passphrase || cred.privateKeyPassphrase || '';
                loaded = true;
              }
            }
          }
          if (!loaded) {
            throw readErr;
          }
        }
      }

      const credType = authMethod === 'PASSWORD' ? 'PASSWORD_TOTP' : authMethod === 'KEY' ? 'KEY_ONLY' : 'PASSWORD_TOTP';
      const passwordVal = authMethod === 'KEY' ? '' : password;

      let credId = null;

      if (connectionId !== null) {
        // Retrieve current connection profile to get existing credentialId
        const existingConn = await window.electronAPI.db.getConnection(connectionId);
        if (existingConn && existingConn.credentialId) {
          credId = existingConn.credentialId;
          await window.electronAPI.db.updateCredential({
            id: credId,
            name: `${name}_Credential`,
            username,
            passwordPlain: passwordVal,
            totpSecretPlain: totpSecret,
            isDefault: false,
            type: credType,
            privateKeyName: keyName,
            privateKeyContentPlain: keyContent,
            privateKeyPassphrasePlain: keyPassphrase,
          });
        }
      }

      if (!credId) {
        credId = await window.electronAPI.db.addCredential({
          name: `${name}_Credential`,
          username,
          passwordPlain: passwordVal,
          totpSecretPlain: totpSecret,
          isDefault: false,
          type: credType,
          privateKeyName: keyName,
          privateKeyContentPlain: keyContent,
          privateKeyPassphrasePlain: keyPassphrase,
        });
      }

      const connectionParams = {
        host,
        port: Number(port),
        workingDir: workingDir || '~',
        connectionTypeId,
        credentialId: credId,
        tunnelViaConnectionId,
      };

      if (connectionId !== null) {
        await window.electronAPI.db.updateConnection({
          id: connectionId,
          name: name.trim(),
          ...connectionParams,
        });
      } else {
        await window.electronAPI.db.addConnection({
          name: name.trim(),
          ...connectionParams,
        });
      }

      onSave();
    } catch (err: unknown) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  if (loading && step === 1) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-white text-sm">Loading profile details...</div>
      </div>
    );
  }

  const stepTitles = [
    'Host & Identity',
    'Authentication',
    'Gateway MFA',
    'Paths & Options',
  ];

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 select-none text-[13px] text-[var(--text-main)] font-sans">
      <div className="w-[520px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[8px] flex flex-col shadow-[var(--shadow-modal)] max-h-[85vh]">
        
        {/* Modal Title Bar */}
        <div className="h-[40px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-4 rounded-t-[8px] shrink-0">
          <span className="text-[13px] font-semibold text-[var(--text-main)]">
            {connectionId !== null ? 'Edit Connection' : 'New Connection'} — {stepTitles[step - 1]}
          </span>
          <button 
            onClick={onClose}
            className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors outline-none cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" />
              <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
            </svg>
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="h-[36px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-end px-2 shrink-0 overflow-x-auto">
          {stepTitles.map((title, idx) => {
            const num = idx + 1;
            const isActive = step === num;
            const isCompleted = step > num;
            return (
              <div 
                key={num}
                className={`h-8 px-4 flex items-center gap-2 text-[12px] font-medium border-r border-[var(--border-color)] transition-all rounded-t-[4px] ${
                  isActive 
                    ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t-[2px] border-t-[var(--color-primary)] font-semibold' 
                    : isCompleted 
                    ? 'text-emerald-500 bg-emerald-500/5 cursor-pointer font-medium' 
                    : 'text-[var(--text-subtle)] cursor-not-allowed'
                }`}
                onClick={() => isCompleted && setStep(num)}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  isActive ? 'bg-[var(--color-primary)] text-white font-bold' : isCompleted ? 'bg-emerald-500/20 text-emerald-500 font-bold' : 'bg-[var(--bg-panel-header)] text-[var(--text-subtle)] border border-[var(--border-color)]'
                }`}>
                  {isCompleted ? '✓' : num}
                </div>
                <span>{title}</span>
              </div>
            );
          })}
        </div>

        {/* Wizard Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* STEP 1: HOST & IDENTITY */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Connection Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Web Server" 
                  className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[4px] px-3 text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none transition-colors text-[12px]"
                />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">SSH Host</label>
                  <input 
                    type="text" 
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="domain.com or 192.168.1.100" 
                    className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[4px] px-3 text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none transition-colors text-[12px]"
                  />
                </div>
                <div className="w-[100px]">
                  <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Port</label>
                  <input 
                    type="number" 
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    placeholder="22" 
                    className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[4px] px-3 text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none transition-colors text-[12px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. root or ubuntu" 
                  className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[4px] px-3 text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none transition-colors text-[12px]"
                />
              </div>
            </div>
          )}

          {/* STEP 2: AUTHENTICATION */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Authentication Method</label>
              
              <div className="space-y-2">
                {/* Method Option: Key */}
                <div className={`p-4 border rounded-[6px] transition-all cursor-pointer ${
                  authMethod === 'KEY' ? 'border-[var(--color-primary)] bg-[var(--glow-color)]/20' : 'border-[var(--border-color)] bg-transparent hover:bg-[var(--bg-panel-header)]'
                }`} onClick={() => setAuthMethod('KEY')}>
                  <div className="flex items-center gap-3.5 mb-3">
                    <input 
                      type="radio" 
                      checked={authMethod === 'KEY'} 
                      onChange={() => setAuthMethod('KEY')}
                      className="accent-[var(--color-primary)]"
                    />
                    <div>
                      <div className="font-semibold text-[var(--text-main)] text-[13px]">SSH Private Key</div>
                      <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">Public/private key pair file authentication</div>
                    </div>
                  </div>
                  {authMethod === 'KEY' && (
                    <div className="space-y-3.5 mt-3 pt-3 border-t border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Private Key File</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={privateKeyPath}
                            onChange={(e) => setPrivateKeyPath(e.target.value)}
                            placeholder="C:\Users\name\.ssh\id_rsa"
                            className="flex-1 h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-3 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                          />
                          <button 
                            onClick={handleBrowseKeyFile}
                            className="h-8 border border-[var(--border-color)] bg-[var(--bg-panel-header)] hover:bg-[var(--bg-app)] hover:text-[var(--text-main)] px-4 rounded-[4px] text-[12px] font-semibold cursor-pointer outline-none transition-colors"
                          >
                            Browse...
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Passphrase</label>
                        <input 
                          type="password" 
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          placeholder="Optional"
                          className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-3 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Method Option: Password */}
                <div className={`p-4 border rounded-[6px] transition-all cursor-pointer ${
                  authMethod === 'PASSWORD' ? 'border-[var(--color-primary)] bg-[var(--glow-color)]/20' : 'border-[var(--border-color)] bg-transparent hover:bg-[var(--bg-panel-header)]'
                }`} onClick={() => setAuthMethod('PASSWORD')}>
                  <div className="flex items-center gap-3.5">
                    <input 
                      type="radio" 
                      checked={authMethod === 'PASSWORD'} 
                      onChange={() => setAuthMethod('PASSWORD')}
                      className="accent-[var(--color-primary)]"
                    />
                    <div>
                      <div className="font-semibold text-[var(--text-main)] text-[13px]">Password</div>
                      <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">SSH username + secret password</div>
                    </div>
                  </div>
                  {authMethod === 'PASSWORD' && (
                    <div className="mt-3.5 pt-3.5 border-t border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                      <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Password</label>
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter SSH password"
                        className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-3 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                      />
                    </div>
                  )}
                </div>

                {/* Method Option: Keyboard Interactive */}
                <div className={`p-4 border rounded-[6px] transition-all cursor-pointer ${
                  authMethod === 'KEYBOARD_INTERACTIVE' ? 'border-[var(--color-primary)] bg-[var(--glow-color)]/20' : 'border-[var(--border-color)] bg-transparent hover:bg-[var(--bg-panel-header)]'
                }`} onClick={() => setAuthMethod('KEYBOARD_INTERACTIVE')}>
                  <div className="flex items-center gap-3.5">
                    <input 
                      type="radio" 
                      checked={authMethod === 'KEYBOARD_INTERACTIVE'} 
                      onChange={() => setAuthMethod('KEYBOARD_INTERACTIVE')}
                      className="accent-[var(--color-primary)]"
                    />
                    <div>
                      <div className="font-semibold text-[var(--text-main)] text-[13px]">Keyboard Interactive</div>
                      <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">2FA / TOTP challenge authentication</div>
                    </div>
                  </div>
                  {authMethod === 'KEYBOARD_INTERACTIVE' && (
                    <div className="space-y-3 mt-3.5 pt-3.5 border-t border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">TOTP Secret (Base32)</label>
                        <input 
                          type="password" 
                          value={totpSecret}
                          onChange={(e) => setTotpSecret(e.target.value)}
                          placeholder="Optional token secret for automated response"
                          className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-3 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Password</label>
                        <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password prompt fallback"
                          className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-3 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: GATEWAY MFA */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Connection Type</label>
                <select 
                  value={connectionTypeId} 
                  onChange={(e) => setConnectionTypeId(Number(e.target.value))}
                  className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-2.5 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                >
                  <option value={1}>Direct SSH/SFTP Connection</option>
                  <option value={2}>Bastion Jump Proxy (Can act as gateway)</option>
                </select>
              </div>

              {connectionTypeId === 1 && (
                <div>
                  <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Tunnel via Jump Host</label>
                  <select 
                    value={tunnelViaConnectionId || ''} 
                    onChange={(e) => setTunnelViaConnectionId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-2.5 text-[var(--text-main)] outline-none focus:border-[var(--input-focus-border)] text-[12px]"
                  >
                    <option value="">None (Direct Connection)</option>
                    {bastionProfiles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.host})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    If selected, the connection will tunnel through this gateway using netcat/TCP duplex relay streams dynamically.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PATHS & OPTIONS */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Default Remote Path</label>
                <input 
                  type="text" 
                  value={workingDir}
                  onChange={(e) => setWorkingDir(e.target.value)}
                  placeholder="~ (Home directory)" 
                  className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] hover:border-[var(--text-subtle)] focus:border-[var(--input-focus-border)] rounded-[4px] px-3 text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none transition-colors text-[12px]"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Default Local Path</label>
                <input 
                  type="text" 
                  placeholder="~ (Home directory)" 
                  className="w-full h-8 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[4px] px-3 text-[var(--text-main)] placeholder-[var(--text-subtle)] outline-none transition-colors text-[12px]"
                  disabled
                />
              </div>

              <div className="p-4 bg-[var(--bg-panel-header)] border border-[var(--border-color)] rounded-[var(--radius-md)] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-main)]">Test Connection</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Verify connection parameters and credentials</p>
                </div>
                <button 
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="h-8 px-5 rounded-[4px] text-[12px] font-semibold border border-[var(--border-color)] bg-[var(--bg-panel)] hover:bg-[var(--bg-panel-header)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none select-none transition-colors"
                >
                  {testing ? 'Testing...' : '✓ Test'}
                </button>
              </div>

              {testResult && (
                <div className={`p-3 text-[12px] rounded-[4px] border ${
                  testResult.success 
                    ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-400' 
                    : 'bg-rose-950/20 border-rose-900/60 text-rose-400'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Dialog Footer Actions */}
        <div className="h-[60px] border-t border-[var(--border-color)] bg-[var(--bg-panel-header)] px-4 flex items-center justify-between shrink-0 rounded-b-[8px]">
          <button 
            onClick={onClose}
            className="border border-[var(--border-color)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-[12.5px] px-5 py-2 rounded-[5px] transition-all cursor-pointer outline-none"
          >
            Cancel
          </button>
          
          <div className="flex items-center">
            {step > 1 && (
              <button 
                onClick={prevStep}
                className="border border-[var(--border-color)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text-main)] text-[12.5px] px-5 py-2 rounded-[5px] mr-2 transition-all cursor-pointer outline-none"
              >
                ← Back
              </button>
            )}

            {step < 4 ? (
              <button 
                onClick={nextStep}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[12.5px] font-semibold px-6 py-2 rounded-[5px] transition-all cursor-pointer outline-none"
              >
                Next →
              </button>
            ) : (
              <button 
                onClick={handleSave}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[12.5px] font-semibold px-6 py-2 rounded-[5px] transition-all cursor-pointer outline-none"
              >
                Save Connection
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NewConnectionWizard;
