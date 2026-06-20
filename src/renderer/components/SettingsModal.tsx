import React, { useState, useEffect } from 'react';
import { 
  FaUserShield, 
  FaPlug, 
  FaPaintBrush, 
  FaTerminal, 
  FaFolderOpen, 
  FaCogs, 
  FaKey, 
  FaListAlt 
} from 'react-icons/fa';

import { CredentialsTab } from './settings/CredentialsTab';
import { PreferencesTab } from './settings/PreferencesTab';
import { AppearanceTab } from './settings/AppearanceTab';
import { TerminalTab } from './settings/TerminalTab';
import { FilePanelTab } from './settings/FilePanelTab';
import { MaintenanceTab } from './settings/MaintenanceTab';
import { KnownHostsTab } from './settings/KnownHostsTab';
import { LoggingTab } from './settings/LoggingTab';

interface SettingsModalProps {
  onClose: () => void;
  onThemeChange?: (newTheme: 'dark' | 'light') => void;
}

type Category = 'credentials' | 'connection' | 'appearance' | 'terminal' | 'files' | 'maintenance' | 'known_hosts' | 'logging';

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onThemeChange }) => {
  const [activeCategory, setActiveCategory] = useState<Category>('credentials');
  const [loading, setLoading] = useState<boolean>(true);
  
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

  // File panel display limit
  const [filesDisplayLimit, setFilesDisplayLimit] = useState(4000);

  const loadAllSettings = async () => {
    try {
      const settings = await window.electronAPI.settings.getAllSettings();

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
      setFilesDisplayLimit(parseInt(settings['files.display.limit'] || '4000', 10));
      setLogLevel(settings['app.log.level'] || 'INFO');
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadAllSettings();
    });
  }, []);

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
        window.electronAPI.settings.setSetting('files.display.limit', filesDisplayLimit.toString()),
        window.electronAPI.settings.setSetting('app.log.level', logLevel)
      ]);

      if (onThemeChange) {
        onThemeChange(uiTheme);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err as Error).message : String(err);
      alert(`Failed to save settings: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 select-none text-[13px] text-[var(--text-main)] font-sans">
      <div className="w-[850px] h-[580px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[8px] flex flex-col shadow-[var(--shadow-modal)] overflow-hidden">
        
        <div className="h-[40px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-4 justify-between shrink-0">
          <span className="font-bold text-xs uppercase tracking-widest text-[var(--text-muted)]">Application Settings</span>
          <button 
            onClick={onClose}
            className="bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none text-base font-bold"
          >
            ×
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          <div className="w-[210px] border-r border-[var(--border-color)] bg-[var(--bg-panel-header)] flex flex-col p-2 gap-1.5 shrink-0 overflow-y-auto">
            
            <button 
              onClick={() => setActiveCategory('credentials')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'credentials' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaUserShield size={14} className="shrink-0" />
              Credentials Profiles
            </button>

            <button 
              onClick={() => setActiveCategory('connection')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'connection' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaPlug size={14} className="shrink-0" />
              Preferences
            </button>

            <button 
              onClick={() => setActiveCategory('appearance')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'appearance' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaPaintBrush size={13} className="shrink-0" />
              Theme & Panels
            </button>

            <button 
              onClick={() => setActiveCategory('terminal')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'terminal' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaTerminal size={13} className="shrink-0" />
              Terminal Options
            </button>

            <button 
              onClick={() => setActiveCategory('files')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'files' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaFolderOpen size={14} className="shrink-0" />
              File Panels
            </button>

            <button 
              onClick={() => setActiveCategory('maintenance')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'maintenance' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaCogs size={14} className="shrink-0" />
              System Maintenance
            </button>

            <button 
              onClick={() => setActiveCategory('known_hosts')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'known_hosts' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaKey size={14} className="shrink-0" />
              Known Hosts Key
            </button>

            <button 
              onClick={() => setActiveCategory('logging')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-[var(--radius-sm)] border-none outline-none cursor-pointer transition-all text-[12.5px] ${activeCategory === 'logging' ? 'bg-[var(--color-primary)] text-white font-semibold' : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--glow-color)]/25'}`}
            >
              <FaListAlt size={14} className="shrink-0" />
              Logging Settings
            </button>

          </div>

          <div className="flex-1 flex flex-col overflow-y-auto p-6">
            {activeCategory === 'credentials' && (
              <CredentialsTab setLoadingGlobal={setLoading} />
            )}

            {activeCategory === 'connection' && (
              <PreferencesTab 
                keepaliveInterval={keepaliveInterval}
                setKeepaliveInterval={setKeepaliveInterval}
                connectTimeout={connectTimeout}
                setConnectTimeout={setConnectTimeout}
                inactivityTimeout={inactivityTimeout}
                setInactivityTimeout={setInactivityTimeout}
              />
            )}

            {activeCategory === 'appearance' && (
              <AppearanceTab 
                uiTheme={uiTheme}
                setUiTheme={setUiTheme}
                uiFontFamily={uiFontFamily}
                setUiFontFamily={setUiFontFamily}
                uiFontSize={uiFontSize}
                setUiFontSize={setUiFontSize}
                uiFontWeight={uiFontWeight}
                setUiFontWeight={setUiFontWeight}
              />
            )}

            {activeCategory === 'terminal' && (
              <TerminalTab 
                termFontFamily={termFontFamily}
                setTermFontFamily={setTermFontFamily}
                termFontSize={termFontSize}
                setTermFontSize={setTermFontSize}
                termFontWeight={termFontWeight}
                setTermFontWeight={setTermFontWeight}
                termThemeDark={termThemeDark}
                setTermThemeDark={setTermThemeDark}
              />
            )}

            {activeCategory === 'files' && (
              <FilePanelTab 
                downloadDir={downloadDir}
                setDownloadDir={setDownloadDir}
                rightsFormat={rightsFormat}
                setRightsFormat={setRightsFormat}
                filesDisplayLimit={filesDisplayLimit}
                setFilesDisplayLimit={setFilesDisplayLimit}
              />
            )}

            {activeCategory === 'maintenance' && (
              <MaintenanceTab setLoadingGlobal={setLoading} />
            )}

            {activeCategory === 'known_hosts' && (
              <KnownHostsTab setLoadingGlobal={setLoading} />
            )}

            {activeCategory === 'logging' && (
              <LoggingTab 
                logLevel={logLevel}
                setLogLevel={setLogLevel}
              />
            )}
          </div>

        </div>

        <div className="h-[48px] bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-4.5 justify-end gap-2.5 shrink-0">
          <button 
            onClick={handleSaveAll}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[5px] px-6 py-2 text-[12.5px] font-semibold cursor-pointer select-none transition-all outline-none"
          >
            Apply Changes
          </button>
          <button 
            onClick={onClose}
            className="bg-transparent border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white rounded-[5px] px-6 py-2 text-[12.5px] font-semibold cursor-pointer select-none transition-all outline-none"
          >
            Cancel
          </button>
        </div>

      </div>

      {loading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center z-[110] gap-3">
          <svg className="animate-spin h-6 w-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div className="text-white text-[13px] font-semibold">Loading Settings...</div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;
