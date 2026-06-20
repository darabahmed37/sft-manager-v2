import React from 'react';

interface TerminalTabProps {
  termFontFamily: string;
  setTermFontFamily: (val: string) => void;
  termFontSize: number;
  setTermFontSize: (val: number) => void;
  termFontWeight: string;
  setTermFontWeight: (val: string) => void;
  termThemeDark: string;
  setTermThemeDark: (val: string) => void;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({
  termFontFamily,
  setTermFontFamily,
  termFontSize,
  setTermFontSize,
  termFontWeight,
  setTermFontWeight,
  termThemeDark,
  setTermThemeDark,
}) => {
  return (
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
  );
};
