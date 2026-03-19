import { useEffect } from 'react';

interface ShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onOpen?: () => void;
  onRunAll?: () => void;
  onImportCurl?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        // Don't fire global escape when focus is in an input — let autocomplete
        // or other local handlers consume it first. Only fire when not in input.
        if (!isInput) {
          e.preventDefault();
          handlers.onEscape?.();
        }
        return;
      }

      if (isInput) return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handlers.onRedo?.();
      } else if (meta && e.key === 'z') {
        e.preventDefault();
        handlers.onUndo?.();
      } else if (meta && e.key === 's') {
        e.preventDefault();
        handlers.onSave?.();
      } else if (meta && e.key === 'o') {
        e.preventDefault();
        handlers.onOpen?.();
      } else if (meta && e.key === 'Enter') {
        e.preventDefault();
        handlers.onRunAll?.();
      } else if (meta && e.key === 'i') {
        e.preventDefault();
        handlers.onImportCurl?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
