import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LuCheck } from 'react-icons/lu';
import { TERMINAL_THEMES } from './terminalThemes';

interface ThemePickerProps {
  currentThemeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  accentColor: string;
  chromeBg: string;
  borderColor: string;
  foreground: string;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({
  currentThemeId,
  onSelect,
  onClose,
  accentColor,
  chromeBg,
  borderColor,
  foreground,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute right-0 bottom-8 z-[1000] w-72 max-h-[360px] overflow-y-auto rounded-xl shadow-2xl py-1.5 select-none"
      style={{
        backgroundColor: chromeBg,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div
        className="px-3.5 pt-1 pb-2 flex items-center gap-2"
        style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: `${foreground}44`,
          borderBottom: `1px solid ${foreground}10`,
          marginBottom: '4px',
        }}
      >
        <span style={{ color: accentColor, opacity: 0.7 }}>◈</span>
        Terminal Color Theme
      </div>

      {TERMINAL_THEMES.map((t) => {
        const isSelected = t.id === currentThemeId;
        return (
          <div
            key={t.id}
            onClick={() => { onSelect(t.id); onClose(); }}
            className="px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-all duration-100 relative"
            style={{
              backgroundColor: isSelected ? `${accentColor}15` : 'transparent',
              borderLeft: isSelected ? `2px solid ${accentColor}` : '2px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLDivElement).style.backgroundColor = `${foreground}08`;
            }}
            onMouseLeave={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
            }}
          >
            {/* Color swatches */}
            <div className="flex gap-[2px] shrink-0 rounded overflow-hidden">
              {[t.background, t.green, t.blue, t.red, t.magenta, t.cyan].map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: color,
                    outline: `1px solid ${foreground}15`,
                  }}
                />
              ))}
            </div>

            {/* Theme info */}
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: '12px',
                  color: isSelected ? foreground : `${foreground}99`,
                  fontWeight: isSelected ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: `${foreground}44`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.description}
              </div>
            </div>

            {/* Selected check */}
            {isSelected && <LuCheck size={13} style={{ color: accentColor, flexShrink: 0 }} />}
          </div>
        );
      })}
    </motion.div>
  );
};

export default ThemePicker;
