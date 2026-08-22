const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

interface Props {
  shortcut: string; // e.g. "Ctrl+S"
  className?: string;
}

export function ShortcutHint({ shortcut, className = '' }: Props) {
  const display = isMac ? shortcut.replace('Ctrl', '⌘') : shortcut;
  return (
    <kbd className={`text-[10px] text-canvas-text/30 font-mono ${className}`}>
      {display}
    </kbd>
  );
}
