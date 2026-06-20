import React, { useState, useEffect } from 'react';
import { 
  FaPlus, 
  FaTrash, 
  FaEdit, 
  FaEye, 
  FaEyeSlash, 
  FaArrowLeft 
} from 'react-icons/fa';
import type { StoredCredential } from '../../global';

interface CredentialsTabProps {
  setLoadingGlobal: (loading: boolean) => void;
}

export const CredentialsTab: React.FC<CredentialsTabProps> = ({ setLoadingGlobal }) => {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [selectedCred, setSelectedCred] = useState<StoredCredential | null>(null);
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

  const loadCredentials = React.useCallback(async () => {
    try {
      Promise.resolve().then(() => setLoadingGlobal(true));
      const list = await window.electronAPI.db.getCredentials();
      setCredentials(list);
    } catch (err) {
      console.error('Failed to load credentials', err);
    } finally {
      setLoadingGlobal(false);
    }
  }, [setLoadingGlobal]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadCredentials();
    });
  }, [loadCredentials]);

  const selectCredential = async (cred: StoredCredential | null) => {
    if (!cred) {
      setSelectedCred(null);
      setIsEditingCred(false);
      return;
    }
    setLoadingGlobal(true);
    try {
      const fullCred = await window.electronAPI.db.getCredential(cred.id);
      if (fullCred) {
        setSelectedCred(fullCred);
        setCredName(fullCred.name);
        setCredType(fullCred.type);
        setCredUser(fullCred.username);
        setCredPass(fullCred.password || '');
        setCredTotp(fullCred.totpSecret || '');
        setCredKeyName(fullCred.privateKeyName || '');
        setCredKeyContent(fullCred.privateKeyContent || '');
        setCredKeyPassphrase(fullCred.privateKeyPassphrase || '');
      } else {
        setSelectedCred(null);
      }
      setIsEditingCred(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleSaveCredential = async () => {
    if (!credName.trim()) {
      alert('Profile Name is required.');
      return;
    }
    setLoadingGlobal(true);
    try {
      const data = {
        name: credName.trim(),
        username: credUser.trim(),
        passwordPlain: credType === 'KEY_ONLY' ? '' : credPass,
        totpSecretPlain: credTotp.trim(),
        isDefault: selectedCred ? !!selectedCred.isDefault : false,
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

      await loadCredentials();
      setSelectedCred(null);
      setIsEditingCred(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err as Error).message : String(err);
      alert(`Failed to save credential: ${msg}`);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleBrowseKey = async () => {
    const filePath = await window.electronAPI.window.openFile();
    if (filePath) {
      try {
        const content = await window.electronAPI.fs.readFile(filePath);
        const name = filePath.replace(/\\/g, '/').split('/').pop() || '';
        setCredKeyName(name);
        setCredKeyContent(content);
      } catch (err: unknown) {
        const msg = err instanceof Error ? (err as Error).message : String(err);
        alert(`Failed to read key file: ${msg}`);
      }
    }
  };

  const handleDeleteCredential = async () => {
    if (!selectedCred) return;
    if (confirm(`Are you sure you want to delete profile "${selectedCred.name}"?`)) {
      setLoadingGlobal(true);
      try {
        await window.electronAPI.db.deleteCredential(selectedCred.id);
        await loadCredentials();
        setSelectedCred(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? (err as Error).message : String(err);
        alert(msg);
      } finally {
        setLoadingGlobal(false);
      }
    }
  };

  return (
    <div className="flex-1 flex gap-4 overflow-hidden h-full">
      {!selectedCred ? (
        <div className="flex-1 flex flex-col bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] overflow-hidden">
          <div className="h-[30px] bg-[var(--bg-panel-header)] px-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Saved Profiles</span>
            <button 
              onClick={() => {
                setSelectedCred({ id: -1, name: '', type: 'PASSWORD_TOTP', username: '', isDefault: false });
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
  );
};
