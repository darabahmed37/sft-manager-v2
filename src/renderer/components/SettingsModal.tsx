import React, { useState, useEffect } from 'react';
import { 
  FaUserShield, 
  FaPlug, 
  FaPaintBrush, 
  FaTerminal, 
  FaFolderOpen, 
  FaCogs, 
  FaKey, 
  FaListAlt,
  FaPlus,
  FaTrash,
  FaEdit,
  FaEye,
  FaEyeSlash,
  FaArrowLeft
} from 'react-icons/fa';

interface SettingsModalProps {
  onClose: () => void;
  onThemeChange?: (newTheme: 'dark' | 'light') => void;
}

type Category = 'credentials' | 'connection' | 'appearance' | 'terminal' | 'files' | 'maintenance' | 'known_hosts' | 'logging';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onThemeChange }) => {
  const [activeCategory, setActiveCategory] = useState<Category>('credentials');
  
  const [loading, setLoading] = useState<boolean>(true);
  
  // Credentials profiles CRUD states
  const [credentials, setCredentials] = useState<any[]>([]);
  const [selectedCred, setSelectedCred] = useState<any | null>(null);
  const [isEditingCred, setIsEditingCred] = useState<boolean>(false);
  const [credName, setCredName] = useState('');
  const [credType, setCredType] = useState('PASSWORD_TOTP'); // PASSWORD_TOTP, KEY_ONLY
  const [credUser, setCredUser] = useState('');
  const [credPass, setCredPass] = useState('');
  const [credTotp, setCredTotp] = useState('');
  const [credKeyName, setCredKeyName] = useState('');
  const [credKeyContent, setCredKeyContent] = useState('');
  const [credKeyPassphrase, setCredKeyPassphrase] = useState('');
  const [passRevealed, setPassRevealed] = useState(false);

  // Known hosts list states
  const [knownHosts, setKnownHosts] = useState<any[]>([]);
  const [selectedHost, setSelectedHost] = useState<any | null>(null);

  // Connection settings states
  const [keepaliveInterval, setKeepaliveInterval] = useState(180);
  const [connectTimeout, setConnectTimeout] = useState(60);
  const [inactivityTimeout, setInactivityTimeout] = useState(20);

  // Theme & Font states
  const [uiTheme, setUiTheme] = useState<'dark' | 'light'>('dark');
  const [uiFontFamily, setUiFontFamily] = useState('Segoe UI');
  const [uiFontSize, setUiFontSize] = useState(13);
  const [uiFontWeight, setUiFontWeight] = useState('normal');

  // Terminal states
  const [termFontFamily, setTermFontFamily] = useState('Cascadia Code');
  const [termFontSize, setTermFontSize] = useState(13);
  const [termFontWeight, setTermFontWeight] = useState('normal');
  const [termThemeDark, setTermThemeDark] = useState('Homebrew');

  // File panel states
  const [downloadDir, setDownloadDir] = useState('');
  const [rightsFormat, setRightsFormat] = useState('grouped');

  // Logging states
  const [logLevel, setLogLevel] = useState('INFO');

  // Maintenance states
  const [statusMsg, setStatusMsg] = useState('');

  // Fetch all initial data from backend database/preferences
  const loadAllSettings = async () => {
    try {
      setLoading(true);
      const settings = await window.electronAPI.settings.getAllSettings();

      // Load connections settings values
      setKeepaliveInterval(parseInt(settings['ssh.keepalive.interval'] || '180', 10));
      setConnectTimeout(parseInt(settings['ssh.connect.timeout'] || '60', 10));
      setInactivityTimeout(parseInt(settings['ssh.inactivity.timeout'] || '20', 10));

      setUiTheme((settings['ui.theme'] || 'dark') as 'dark' | 'light');
      setUiFontFamily(settings['ui.font.family'] || 'Segoe UI');
      setUiFontSize(parseInt(settings['ui.font.size'] || '13', 10));
      setUiFontWeight(settings['ui.font.weight'] || 'normal');

      setTermFontFamily(settings['terminal.font.family'] || 'Cascadia Code');
      setTermFontSize(parseInt(settings['terminal.font.size'] || '13', 10));
      setTermFontWeight(settings['terminal.font.weight'] || 'normal');
      setTermThemeDark(settings['terminal.theme.dark'] || 'Homebrew');

      setDownloadDir(settings['download.dir'] || '~/Downloads');
      setRightsFormat(settings['rights.format'] || 'grouped');
      setLogLevel(settings['app.log.level'] || 'INFO');

      // Fetch stored credentials list
      const creds = await window.electronAPI.db.getCredentials();
      setCredentials(creds);
      
      // Fetch trusted host fingerprints
      const hosts = await window.electronAPI.settings.getKnownHosts();
      setKnownHosts(hosts);
    } catch (err: any) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  // Save all global settings to db
  const handleSaveAll = async () => {
    try {
      setLoading(true);
      await Promise.all([
        window.electronAPI.settings.setSetting('ssh.keepalive.interval', keepaliveInterval.toString()),
        window.electronAPI.settings.setSetting('ssh.connect.timeout', connectTimeout.toString()),
        window.electronAPI.settings.setSetting('ssh.inactivity.timeout', inactivityTimeout.toString()),
        window.electronAPI.settings.setSetting('ui.theme', uiTheme),
        window.electronAPI.settings.setSetting('ui.font.family', uiFontFamily),
        window.electronAPI.settings.setSetting('ui.font.size', uiFontSize.toString()),
        window.electronAPI.settings.setSetting('ui.font.weight', uiFontWeight),
        window.electronAPI.settings.setSetting('terminal.font.family', termFontFamily),
        window.electronAPI.settings.setSetting('terminal.font.size', termFontSize.toString()),
        window.electronAPI.settings.setSetting('terminal.font.weight', termFontWeight),
        window.electronAPI.settings.setSetting('terminal.theme.dark', termThemeDark),
        window.electronAPI.settings.setSetting('terminal.theme.light', termThemeDark),
        window.electronAPI.settings.setSetting('download.dir', downloadDir),
        window.electronAPI.settings.setSetting('rights.format', rightsFormat),
        window.electronAPI.settings.setSetting('app.log.level', logLevel)
      ]);

      // Apply theme changes instantly to index.css HTML root
      if (onThemeChange) {
        onThemeChange(uiTheme);
      }
      onClose();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Credential Selection
  const selectCredential = async (cred: any) => {
    if (!cred) {
      setSelectedCred(null);
      setIsEditingCred(false);
      return;
    }
    setLoading(true);
    try {
      const fullCred = await window.electronAPI.db.getCredential(cred.id);
      setSelectedCred(fullCred);
      setCredName(fullCred.name);
      setCredType(fullCred.type);
      setCredUser(fullCred.username);
      setCredPass(fullCred.password || '');
      setCredTotp(fullCred.totpSecret || '');
      setCredKeyName(fullCred.privateKeyName || '');
      setCredKeyContent(fullCred.privateKeyContent || '');
      setCredKeyPassphrase(fullCred.privateKeyPassphrase || '');
      setIsEditingCred(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Save Credential
  const handleSaveCredential = async () => {
    if (!credName.trim()) {
      alert('Profile Name is required.');
      return;
    }
    setLoading(true);
    try {
      const data = {
        name: credName.trim(),
        username: credUser.trim(),
        passwordPlain: credType === 'KEY_ONLY' ? '' : credPass,
        totpSecretPlain: credTotp.trim(),
        isDefault: selectedCred ? selectedCred.isDefault : false,
        type: credType,
        privateKeyName: credKeyName,
        privateKeyContentPlain: credKeyContent,
        privateKeyPassphrasePlain: credKeyPassphrase
      };

      if (selectedCred && selectedCred.id > 0) {
        await window.electronAPI.db.updateCredential({
          id: selectedCred.id,
          ...data
        });
      } else {
        await window.electronAPI.db.addCredential(data);
      }

      // Reload
      const list = await window.electronAPI.db.getCredentials();
      setCredentials(list);
      setSelectedCred(null);
      setIsEditingCred(false);
    } catch (err: any) {
      alert(`Failed to save credential: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Browse key file
  const handleBrowseKey = async () => {
    const filePath = await window.electronAPI.window.openFile();
    if (filePath) {
      try {
        const content = await window.electronAPI.fs.readFile(filePath);
        const name = filePath.replace(/\\/g, '/').split('/').pop() || '';
        setCredKeyName(name);
        setCredKeyContent(content);
      } catch (err: any) {
        alert(`Failed to read key file: ${err.message}`);
      }
    }
  };

  // Delete Credential
  const handleDeleteCredential = async () => {
    if (!selectedCred) return;
    if (confirm(`Are you sure you want to delete profile "${selectedCred.name}"?`)) {
      setLoading(true);
      try {
        await window.electronAPI.db.deleteCredential(selectedCred.id);
        const list = await window.electronAPI.db.getCredentials();
        setCredentials(list);
        setSelectedCred(null);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Delete Known Host
  const handleDeleteHost = async (id: number, hostStr: string) => {
    if (confirm(`Remove trusted SSH host key fingerprint for "${hostStr}"?`)) {
      setLoading(true);
      try {
        await window.electronAPI.settings.deleteKnownHost(id);
        const hosts = await window.electronAPI.settings.getKnownHosts();
        setKnownHosts(hosts);
        setSelectedHost(null);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Browse download path
  const handleBrowseDownload = async () => {
    const path = await window.electronAPI.window.openFile();
    if (path) {
      setDownloadDir(path);
    }
  };

  if (loading && credentials.length === 0 && knownHosts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-white text-sm">Loading application settings...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 select-none text-[13px] text-[var(--text-main)] font-sans">
      <div className="w-[850px] h-[580px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[4px] flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.4)] overflow-hidden">
        
        {/* Header Title */}
        <div className="h-[38px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-4 justify-between shrink-0">
          <span className="font-bold text-xs uppercase tracking-widest text-[var(--text-muted)]">Application Settings</span>
          <button 
            onClick={onClose}
            className="bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none text-base font-bold"
          >
            ×
          </button>
        </div>

        {/* Workspace Panels Split */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Navigation Category List */}
          <div className="w-[200px] border-r border-[var(--border-color)] bg-[var(--bg-panel-header)] flex flex-col p-2 gap-1.5 shrink-0 overflow-y-auto">
            
            <button 
              onClick={() => setActiveCategory('credentials')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'credentials' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaUserShield size={14} className="shrink-0" />
              Credentials Profiles
            </button>

            <button 
              onClick={() => setActiveCategory('connection')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'connection' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaPlug size={14} className="shrink-0" />
              Preferences
            </button>

            <button 
              onClick={() => setActiveCategory('appearance')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'appearance' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaPaintBrush size={13} className="shrink-0" />
              Theme & Panels
            </button>

            <button 
              onClick={() => setActiveCategory('terminal')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'terminal' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaTerminal size={13} className="shrink-0" />
              Terminal Options
            </button>

            <button 
              onClick={() => setActiveCategory('files')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'files' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaFolderOpen size={14} className="shrink-0" />
              File Panels
            </button>

            <button 
              onClick={() => setActiveCategory('maintenance')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'maintenance' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaCogs size={14} className="shrink-0" />
              System Maintenance
            </button>

            <button 
              onClick={() => setActiveCategory('known_hosts')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'known_hosts' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaKey size={14} className="shrink-0" />
              Known Hosts Key
            </button>

            <button 
              onClick={() => setActiveCategory('logging')}
              className={`flex items-center gap-2.5 px-3 py-2 text-left rounded-[3px] border-none outline-none cursor-pointer transition-all ${activeCategory === 'logging' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaListAlt size={14} className="shrink-0" />
              Logging Settings
            </button>

          </div>

          {/* Right Category Details Form */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5">
            
            {/* 1. CREDENTIAL PROFILES */}
            {activeCategory === 'credentials' && (
              <div className="flex-1 flex gap-4 overflow-hidden h-full">
                
                {/* Profiles Master List */}
                {!selectedCred ? (
                  <div className="flex-1 flex flex-col bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] overflow-hidden">
                    <div className="h-[30px] bg-[var(--bg-panel-header)] px-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Saved Profiles</span>
                      <button 
                        onClick={() => {
                          setSelectedCred({ id: -1 });
                          setCredName('');
                          setCredType('PASSWORD_TOTP');
                          setCredUser('');
                          setCredPass('');
                          setCredTotp('');
                          setCredKeyName('');
                          setCredKeyContent('');
                          setCredKeyPassphrase('');
                          setIsEditingCred(true);
                        }}
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[2px] p-1 cursor-pointer flex items-center outline-none"
                      >
                        <FaPlus size={10} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
                      {credentials.length > 0 ? (
                        credentials.map((cr) => (
                          <div 
                            key={cr.id}
                            onClick={() => selectCredential(cr)}
                            className="px-2.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-[3px] flex items-center justify-between cursor-pointer transition-all"
                          >
                            <span className="font-medium text-[var(--text-main)]">{cr.name}</span>
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-panel-header)] text-[var(--text-subtle)] border border-[var(--border-color)]">
                              {cr.type === 'PASSWORD_TOTP' ? 'Password' : cr.type === 'KEY_ONLY' ? 'Private Key' : cr.type}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-subtle)] font-medium py-20 text-center">
                          No saved credential profiles found. Click + to add one.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] p-4.5 overflow-y-auto">
                    {/* Profile Detail and Edit forms */}
                    <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2 mb-2">
                      <button 
                        onClick={() => selectCredential(null)}
                        className="bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none flex items-center"
                        title="Back to Profiles"
                      >
                        <FaArrowLeft size={12} />
                      </button>
                      <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">
                        {selectedCred.id <= 0 ? 'Create Profile' : isEditingCred ? 'Edit Profile' : 'Profile Details'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 items-center gap-3.5">
                      <label className="text-[var(--text-muted)] font-semibold">Profile Name:</label>
                      <input 
                        type="text"
                        disabled={!isEditingCred}
                        value={credName}
                        onChange={(e) => setCredName(e.target.value)}
                        placeholder="e.g. My Ubuntu Host"
                        className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none disabled:opacity-50"
                      />
                    </div>

                    <div className="grid grid-cols-3 items-center gap-3.5">
                      <label className="text-[var(--text-muted)] font-semibold">Auth Type:</label>
                      <select 
                        disabled={!isEditingCred}
                        value={credType}
                        onChange={(e) => setCredType(e.target.value)}
                        className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none disabled:opacity-50"
                      >
                        <option value="PASSWORD_TOTP">SSH Password (+ Google MFA)</option>
                        <option value="KEY_ONLY">SSH Private Key</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 items-center gap-3.5">
                      <label className="text-[var(--text-muted)] font-semibold">Username:</label>
                      <input 
                        type="text"
                        disabled={!isEditingCred}
                        value={credUser}
                        onChange={(e) => setCredUser(e.target.value)}
                        placeholder="ubuntu / root"
                        className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none disabled:opacity-50"
                      />
                    </div>

                    {credType === 'PASSWORD_TOTP' ? (
                      <>
                        <div className="grid grid-cols-3 items-center gap-3.5">
                          <label className="text-[var(--text-muted)] font-semibold">Password:</label>
                          <div className="col-span-2 relative flex items-center">
                            <input 
                              type={passRevealed ? 'text' : 'password'}
                              disabled={!isEditingCred}
                              value={credPass}
                              onChange={(e) => setCredPass(e.target.value)}
                              placeholder={selectedCred.id > 0 && !isEditingCred ? '••••••••' : 'Enter Password'}
                              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] pl-2.5 pr-8 py-1 text-xs outline-none disabled:opacity-50"
                            />
                            {isEditingCred && (
                              <button 
                                onClick={() => setPassRevealed(!passRevealed)}
                                className="absolute right-2 bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none flex items-center"
                              >
                                {passRevealed ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 items-center gap-3.5">
                          <label className="text-[var(--text-muted)] font-semibold">MFA Secret Key:</label>
                          <input 
                            type="text"
                            disabled={!isEditingCred}
                            value={credTotp}
                            onChange={(e) => setCredTotp(e.target.value)}
                            placeholder={selectedCred.id > 0 && !isEditingCred && credTotp ? '••••••••' : 'TOTP Secret (Base32, optional)'}
                            className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none disabled:opacity-50"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 items-center gap-3.5">
                          <label className="text-[var(--text-muted)] font-semibold">Private Key File:</label>
                          <div className="col-span-2 flex gap-1.5 items-center">
                            <input 
                              type="text"
                              disabled
                              value={credKeyName || 'No file selected'}
                              className="flex-1 bg-[var(--bg-panel-header)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none opacity-80"
                            />
                            {isEditingCred && (
                              <button 
                                onClick={handleBrowseKey}
                                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[3px] px-3.5 py-1 text-xs cursor-pointer select-none transition-all outline-none"
                              >
                                Browse
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 items-center gap-3.5">
                          <label className="text-[var(--text-muted)] font-semibold">Key Passphrase:</label>
                          <input 
                            type="password"
                            disabled={!isEditingCred}
                            value={credKeyPassphrase}
                            onChange={(e) => setCredKeyPassphrase(e.target.value)}
                            placeholder={selectedCred.id > 0 && !isEditingCred ? '••••••••' : 'Enter Passphrase (optional)'}
                            className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none disabled:opacity-50"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 justify-end mt-4.5 border-t border-[var(--border-color)] pt-3.5">
                      {selectedCred.id > 0 && !isEditingCred && (
                        <>
                          <button 
                            onClick={() => setIsEditingCred(true)}
                            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer flex items-center gap-1.5 select-none transition-all outline-none"
                          >
                            <FaEdit size={11} /> Edit Profile
                          </button>
                          <button 
                            onClick={handleDeleteCredential}
                            className="bg-red-650 hover:bg-red-700 text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer flex items-center gap-1.5 select-none transition-all outline-none"
                          >
                            <FaTrash size={11} /> Delete
                          </button>
                        </>
                      )}
                      {isEditingCred && (
                        <>
                          <button 
                            onClick={handleSaveCredential}
                            className="bg-green-650 hover:bg-green-700 text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer select-none transition-all outline-none"
                          >
                            Save Profile
                          </button>
                          <button 
                            onClick={() => {
                              if (selectedCred.id <= 0) {
                                setSelectedCred(null);
                              } else {
                                selectCredential(selectedCred);
                              }
                            }}
                            className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs cursor-pointer select-none transition-all outline-none"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* 2. PREFERENCES (CONNECTION) */}
            {activeCategory === 'connection' && (
              <div className="flex flex-col gap-4.5">
                <div className="border-b border-[var(--border-color)] pb-1 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">SSH Tunnel Preferences</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold block">Keepalive Interval (s):</label>
                    <span className="text-[11.5px] text-[var(--text-subtle)] mt-0.5 block leading-normal">Interval between periodic packets</span>
                  </div>
                  <input 
                    type="number"
                    min="30"
                    max="3600"
                    value={keepaliveInterval}
                    onChange={(e) => setKeepaliveInterval(parseInt(e.target.value, 10) || 180)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold block">Connect Timeout (s):</label>
                    <span className="text-[11.5px] text-[var(--text-subtle)] mt-0.5 block leading-normal">Timeout establishing handshake</span>
                  </div>
                  <input 
                    type="number"
                    min="15"
                    max="120"
                    value={connectTimeout}
                    onChange={(e) => setConnectTimeout(parseInt(e.target.value, 10) || 60)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold block">Inactivity Limit (m):</label>
                    <span className="text-[11.5px] text-[var(--text-subtle)] mt-0.5 block leading-normal">Auto-disconnects when inactive</span>
                  </div>
                  <input 
                    type="number"
                    min="1"
                    max="120"
                    value={inactivityTimeout}
                    onChange={(e) => setInactivityTimeout(parseInt(e.target.value, 10) || 20)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {/* 3. THEME & PANELS */}
            {activeCategory === 'appearance' && (
              <div className="flex flex-col gap-4.5">
                <div className="border-b border-[var(--border-color)] pb-1 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">User Interface Theme</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">UI Palette Theme:</label>
                  <div className="col-span-2 flex gap-3">
                    <button 
                      onClick={() => setUiTheme('dark')}
                      className={`flex-1 border rounded-[3px] py-2 text-xs font-semibold cursor-pointer transition-all outline-none ${uiTheme === 'dark' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)] border-[var(--color-primary)]' : 'bg-transparent text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-subtle)]'}`}
                    >
                      Dark Slate Mode
                    </button>
                    <button 
                      onClick={() => setUiTheme('light')}
                      className={`flex-1 border rounded-[3px] py-2 text-xs font-semibold cursor-pointer transition-all outline-none ${uiTheme === 'light' ? 'bg-[var(--glow-color)] text-[var(--active-tab-text)] border-[var(--color-primary)]' : 'bg-transparent text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-subtle)]'}`}
                    >
                      Light Obsidian Mode
                    </button>
                  </div>
                </div>

                <div className="border-b border-[var(--border-color)] pb-1 mt-3 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">Typography Settings</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Font Family:</label>
                  <select 
                    value={uiFontFamily}
                    onChange={(e) => setUiFontFamily(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="Segoe UI">Segoe UI Variable Text (Windows)</option>
                    <option value="Inter">Inter UI (Premium)</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Outfit">Outfit</option>
                    <option value="system-ui">Default System UI</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Font Size (px):</label>
                  <input 
                    type="number"
                    min="11"
                    max="20"
                    value={uiFontSize}
                    onChange={(e) => setUiFontSize(parseInt(e.target.value, 10) || 13)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Font Weight:</label>
                  <select 
                    value={uiFontWeight}
                    onChange={(e) => setUiFontWeight(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="normal">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi-Bold (600)</option>
                    <option value="bold">Bold (700)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 4. TERMINAL */}
            {activeCategory === 'terminal' && (
              <div className="flex flex-col gap-4.5">
                <div className="border-b border-[var(--border-color)] pb-1 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">SSH Terminal Styles</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Font Family:</label>
                  <select 
                    value={termFontFamily}
                    onChange={(e) => setTermFontFamily(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="Cascadia Code">Cascadia Code (Monospace)</option>
                    <option value="Consolas">Consolas</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Font Size (px):</label>
                  <input 
                    type="number"
                    min="8"
                    max="28"
                    value={termFontSize}
                    onChange={(e) => setTermFontSize(parseInt(e.target.value, 10) || 13)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-[var(--input-focus-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Font Weight:</label>
                  <select 
                    value={termFontWeight}
                    onChange={(e) => setTermFontWeight(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="normal">Regular (400)</option>
                    <option value="bold">Bold (700)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Color Preset Theme:</label>
                  <select 
                    value={termThemeDark}
                    onChange={(e) => setTermThemeDark(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="Homebrew">Homebrew (Green on Black)</option>
                    <option value="VIOLET">Violet Lavender</option>
                    <option value="Solarized">Solarized Dark</option>
                    <option value="Monokai">Monokai Retro</option>
                    <option value="Dracula">Dracula Goth</option>
                  </select>
                </div>
              </div>
            )}

            {/* 5. FILE PANELS */}
            {activeCategory === 'files' && (
              <div className="flex flex-col gap-4.5">
                <div className="border-b border-[var(--border-color)] pb-1 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">File Manager Panel Preferences</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Default Download Folder:</label>
                  <div className="col-span-2 flex gap-1.5 items-center">
                    <input 
                      type="text" 
                      disabled
                      value={downloadDir}
                      className="flex-1 bg-[var(--bg-panel-header)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none opacity-80"
                    />
                    <button 
                      onClick={handleBrowseDownload}
                      className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[3px] px-3.5 py-1 text-xs cursor-pointer select-none transition-all outline-none"
                    >
                      Browse
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <label className="text-[var(--text-muted)] font-semibold">Unix Rights Format:</label>
                  <select 
                    value={rightsFormat}
                    onChange={(e) => setRightsFormat(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="grouped">Grouped segments (rwx | r-x | r-x)</option>
                    <option value="unix">Unix raw format (rwxrwxrwx)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 6. MAINTENANCE */}
            {activeCategory === 'maintenance' && (
              <div className="flex flex-col gap-4">
                <div className="border-b border-[var(--border-color)] pb-1 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">System Diagnostics & Reset</h3>
                </div>

                {statusMsg && (
                  <div className="p-2.5 bg-[var(--glow-color)]/20 border border-[var(--color-primary)]/30 rounded-[3px] text-xs text-[var(--text-main)] mb-1 leading-relaxed">
                    {statusMsg}
                  </div>
                )}

                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--border-color)]/40">
                    <div>
                      <span className="font-semibold text-[var(--text-main)] block">Explore Temporary Directory</span>
                      <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Open application downloads cache path</span>
                    </div>
                    <button 
                      onClick={async () => {
                        await window.electronAPI.settings.openTemp();
                        setStatusMsg('Successfully opened temp folder in system file manager.');
                      }}
                      className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
                    >
                      Open Cache
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--border-color)]/40">
                    <div>
                      <span className="font-semibold text-[var(--text-main)] block">Clear Temporary Files</span>
                      <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Wipe cached folder assets and downloads</span>
                    </div>
                    <button 
                      onClick={async () => {
                        const res = await window.electronAPI.settings.clearTemp();
                        setStatusMsg(`Cache cleared: deleted ${res.clearedCount} temporary cache files.`);
                      }}
                      className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
                    >
                      Clear Cache
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--border-color)]/40">
                    <div>
                      <span className="font-semibold text-[var(--text-main)] block">Truncate Diagnostics Logs</span>
                      <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Clear logging logs inside app data logs folder</span>
                    </div>
                    <button 
                      onClick={async () => {
                        const res = await window.electronAPI.settings.clearLogs();
                        setStatusMsg(`Logs truncated: cleaned up ${res.clearedCount} log files.`);
                      }}
                      className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
                    >
                      Clear Logs
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border-color)]/40">
                    <div>
                      <span className="font-semibold text-red-500 block">Reset Application Data</span>
                      <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Permanently wipe all credentials, connections, and layout options</span>
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm('CRITICAL: This will delete your database and wipe ALL profiles. Are you sure you want to reset and exit?')) {
                          await window.electronAPI.settings.resetApp();
                        }
                      }}
                      className="bg-red-650 hover:bg-red-700 text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
                    >
                      Reset App
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 7. KNOWN HOSTS */}
            {activeCategory === 'known_hosts' && (
              <div className="flex-1 flex gap-4 overflow-hidden h-full">
                
                {/* Host Lists */}
                {!selectedHost ? (
                  <div className="flex-1 flex flex-col bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] overflow-hidden">
                    <div className="h-[30px] bg-[var(--bg-panel-header)] px-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Trusted Hosts</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
                      {knownHosts.length > 0 ? (
                        knownHosts.map((kh) => (
                          <div 
                            key={kh.id}
                            onClick={() => setSelectedHost(kh)}
                            className="px-2.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-[3px] flex items-center justify-between cursor-pointer transition-all"
                          >
                            <span className="font-medium text-[var(--text-main)]">{kh.host}:{kh.port}</span>
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-panel-header)] text-[var(--text-subtle)] border border-[var(--border-color)]">
                              {kh.keyType}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[var(--text-subtle)] font-medium py-20 text-center">
                          No trusted host fingerprinted entries.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] p-4.5 overflow-y-auto">
                    {/* Host Details */}
                    <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2 mb-2">
                      <button 
                        onClick={() => setSelectedHost(null)}
                        className="bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none flex items-center"
                      >
                        <FaArrowLeft size={12} />
                      </button>
                      <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Host Fingerprint Details</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      <span className="text-[var(--text-muted)] font-semibold">Host / Host IP:</span>
                      <span className="col-span-2 text-[var(--text-main)] font-mono">{selectedHost.host}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      <span className="text-[var(--text-muted)] font-semibold">Port Number:</span>
                      <span className="col-span-2 text-[var(--text-main)] font-mono">{selectedHost.port}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      <span className="text-[var(--text-muted)] font-semibold">Key Algorithm:</span>
                      <span className="col-span-2 text-[var(--text-main)] font-mono">{selectedHost.keyType}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      <span className="text-[var(--text-muted)] font-semibold">SHA-256 Fingerprint:</span>
                      <span className="col-span-2 text-[var(--text-main)] font-mono whitespace-pre-wrap select-text">{selectedHost.fingerprint}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      <span className="text-[var(--text-muted)] font-semibold">Date Trusted:</span>
                      <span className="col-span-2 text-[var(--text-main)] font-mono">
                        {new Date(selectedHost.addedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex gap-2 justify-end mt-4 border-t border-[var(--border-color)] pt-3">
                      <button 
                        onClick={() => handleDeleteHost(selectedHost.id, selectedHost.host)}
                        className="bg-red-650 hover:bg-red-700 text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer flex items-center gap-1.5 select-none transition-all outline-none"
                      >
                        <FaTrash size={11} /> Remove Trust
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* 8. LOGGING */}
            {activeCategory === 'logging' && (
              <div className="flex flex-col gap-4.5">
                <div className="border-b border-[var(--border-color)] pb-1 mb-1">
                  <h3 className="text-sm font-semibold text-[var(--text-main)]">Application Diagnostics Logging</h3>
                </div>

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="text-[var(--text-muted)] font-semibold block">Log Verbosity Level:</label>
                    <span className="text-[11.5px] text-[var(--text-subtle)] mt-0.5 block leading-normal">Requires application restart</span>
                  </div>
                  <select 
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                    className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
                  >
                    <option value="DEBUG">DEBUG (All logs, verbose diagnostics)</option>
                    <option value="INFO">INFO (Standard warnings, normal operation)</option>
                    <option value="WARN">WARN (Warnings and errors only)</option>
                    <option value="ERROR">ERROR (Critical exceptions and failures)</option>
                  </select>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer Actions */}
        <div className="h-[48px] bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-4.5 justify-end gap-2.5 shrink-0">
          <button 
            onClick={handleSaveAll}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[3px] px-5 py-2 text-xs font-semibold cursor-pointer select-none transition-all outline-none"
          >
            Apply Changes
          </button>
          <button 
            onClick={onClose}
            className="bg-transparent border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white rounded-[3px] px-5 py-2 text-xs font-semibold cursor-pointer select-none transition-all outline-none"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};
export default SettingsModal;
