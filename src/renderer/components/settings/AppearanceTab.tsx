import React from 'react';

interface AppearanceTabProps {
  uiTheme: 'dark' | 'light';
  setUiTheme: (val: 'dark' | 'light') => void;
  uiFontFamily: string;
  setUiFontFamily: (val: string) => void;
  uiFontSize: number;
  setUiFontSize: (val: number) => void;
  uiFontWeight: string;
  setUiFontWeight: (val: string) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  uiTheme,
  setUiTheme,
  uiFontFamily,
  setUiFontFamily,
  uiFontSize,
  setUiFontSize,
  uiFontWeight,
  setUiFontWeight,
}) => {
  return (
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
  );
};
