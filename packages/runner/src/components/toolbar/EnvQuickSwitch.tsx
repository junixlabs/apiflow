import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEnvironmentStore } from '../../store/environmentStore';

interface Props {
  onEdit?: () => void;
}

export function EnvQuickSwitch({ onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentName = useEnvironmentStore((s) => s.activeEnvironmentName);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1 text-xs text-canvas-text/60 hover:text-canvas-text hover:bg-surface-hover rounded border border-canvas-border flex items-center gap-1.5"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-method-get shrink-0" />
        <span className="truncate max-w-[80px]">{activeEnvironmentName}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[120px]">
          {onEdit && (
            <>
              <button
                onClick={() => { onEdit(); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-surface-hover"
              >
                Manage Environments...
              </button>
              <div className="border-t border-canvas-border" />
            </>
          )}
          {environments.map((env) => (
            <button
              key={env.name}
              onClick={() => {
                setActiveEnvironment(env.name);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover ${
                env.name === activeEnvironmentName ? 'bg-surface-hover' : ''
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  env.name === activeEnvironmentName ? 'bg-method-get' : 'bg-canvas-border'
                }`}
              />
              {env.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
