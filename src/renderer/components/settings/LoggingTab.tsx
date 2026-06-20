import React from 'react';

interface LoggingTabProps {
  logLevel: string;
  setLogLevel: (val: string) => void;
}

export const LoggingTab: React.FC<LoggingTabProps> = ({ logLevel, setLogLevel }) => {
  return (
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
  );
};
