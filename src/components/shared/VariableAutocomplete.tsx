import { createPortal } from 'react-dom';

interface Suggestion {
  label: string;
  value: string;
  type: 'env' | 'node';
}

interface Props {
  show: boolean;
  suggestions: Suggestion[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (suggestion: Suggestion) => void;
}

export function VariableAutocomplete({ show, suggestions, selectedIndex, position, onSelect }: Props) {
  if (!show || suggestions.length === 0) return null;

  return createPortal(
    <div
      data-autocomplete-dropdown
      className="fixed z-50 bg-surface border border-canvas-border rounded shadow-lg max-h-48 overflow-y-auto min-w-[200px] max-w-[360px]"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {suggestions.map((s, i) => (
        <button
          key={s.value}
          className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 ${
            i === selectedIndex
              ? 'bg-primary/20 text-primary'
              : 'text-canvas-text hover:bg-surface-hover'
          }`}
          onClick={() => onSelect(s)}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              s.type === 'env' ? 'bg-method-put' : 'bg-primary'
            }`}
          />
          <span className="truncate">{s.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}
