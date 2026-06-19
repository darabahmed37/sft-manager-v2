import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import { TERMINAL_THEMES } from '../themes';

interface ThemePickerProps {
  currentThemeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({ currentThemeId, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-1.5 bottom-6.5 z-[1000] w-64 max-h-[340px] overflow-y-auto bg-[#252526] border border-[#3c3c3c] rounded-md shadow-2xl py-1 select-none"
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[#6e6e6e] uppercase border-b border-[#3c3c3c] mb-1">
        Terminal Color Theme
      </div>
      {TERMINAL_THEMES.map((t) => {
        const isSelected = t.id === currentThemeId;
        return (
          <div
            key={t.id}
            onClick={() => {
              onSelect(t.id);
              onClose();
            }}
            className={`px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors duration-150 ${
              isSelected ? 'bg-[#37373d]' : 'hover:bg-[#2a2d2e]'
            }`}
          >
            <div className="flex gap-[2px] shrink-0">
              {[t.background, t.green, t.blue, t.red, t.magenta, t.cyan].map((color, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-[2px] border border-white/10 shrink-0"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs truncate ${
                  isSelected ? 'text-[#cccccc] font-semibold' : 'text-[#9d9d9d]'
                }`}
              >
                {t.name}
              </div>
              <div className="text-[10px] text-[#555] truncate">{t.description}</div>
            </div>
            {isSelected && <FiCheck className="w-3.5 h-3.5 text-[#29abee] shrink-0" />}
          </div>
        );
      })}
    </motion.div>
  );
};

export default ThemePicker;
