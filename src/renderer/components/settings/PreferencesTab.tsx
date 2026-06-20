import React from 'react';

interface PreferencesTabProps {
  keepaliveInterval: number;
  setKeepaliveInterval: (val: number) => void;
  connectTimeout: number;
  setConnectTimeout: (val: number) => void;
  inactivityTimeout: number;
  setInactivityTimeout: (val: number) => void;
}

export const PreferencesTab: React.FC<PreferencesTabProps> = ({
  keepaliveInterval,
  setKeepaliveInterval,
  connectTimeout,
  setConnectTimeout,
  inactivityTimeout,
  setInactivityTimeout,
}) => {
  return (
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
  );
};
