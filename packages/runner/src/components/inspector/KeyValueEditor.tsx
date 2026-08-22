import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import type { KeyValuePair } from '../../types';

interface Props {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: Props) {
  const [bulkMode, setBulkMode] = useState(false);

  const updatePair = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = pairs.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    // Auto-add ghost row when typing in the last row
    if (field === 'key' && typeof value === 'string' && value && index === pairs.length - 1) {
      updated.push({ key: '', value: '', enabled: true });
    }
    onChange(updated);
  };

  const removePair = (index: number) => {
    const filtered = pairs.filter((_, i) => i !== index);
    // Always keep at least one row
    if (filtered.length === 0) {
      onChange([{ key: '', value: '', enabled: true }]);
    } else {
      onChange(filtered);
    }
  };

  const addPair = () => {
    onChange([...pairs, { key: '', value: '', enabled: true }]);
  };

  // Bulk edit: convert pairs to text and back
  const bulkText = pairs
    .filter((p) => p.key || p.value)
    .map((p) => `${p.key}: ${p.value}`)
    .join('\n');

  const handleBulkChange = (text: string) => {
    const lines = text.split('\n');
    const newPairs: KeyValuePair[] = lines.map((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return { key: line.trim(), value: '', enabled: true };
      return {
        key: line.slice(0, colonIdx).trim(),
        value: line.slice(colonIdx + 1).trim(),
        enabled: true,
      };
    });
    // Always have at least one row
    if (newPairs.length === 0) {
      newPairs.push({ key: '', value: '', enabled: true });
    }
    onChange(newPairs);
  };

  const bulkRef = useRef(bulkText);
  if (bulkMode) {
    return (
      <div className="space-y-1.5">
        <div className="flex justify-end">
          <button
            onClick={() => {
              // Commit any uncommitted edits before switching back
              handleBulkChange(bulkRef.current);
              setBulkMode(false);
            }}
            className="text-[10px] text-primary hover:text-primary/80"
          >
            Key-Value
          </button>
        </div>
        <textarea
          defaultValue={bulkText}
          onChange={(e) => { bulkRef.current = e.target.value; }}
          onBlur={(e) => handleBulkChange(e.target.value)}
          placeholder={`${keyPlaceholder}: ${valuePlaceholder}\nContent-Type: application/json`}
          rows={5}
          spellCheck={false}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none resize-y leading-5"
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={(e) => updatePair(i, 'enabled', e.target.checked)}
            className="accent-primary shrink-0"
          />
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="w-[35%] shrink-0 bg-canvas-bg border border-canvas-border rounded px-2 py-1 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 bg-canvas-bg border border-canvas-border rounded px-2 py-1 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => removePair(i)}
            aria-label="Remove row"
            className="text-canvas-text/30 hover:text-method-delete shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-method-delete/10"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex justify-between">
        <button onClick={addPair} className="text-xs text-primary hover:text-primary/80">
          + Add
        </button>
        <button
          onClick={() => setBulkMode(true)}
          className="text-[10px] text-canvas-text/30 hover:text-canvas-text/60"
        >
          Bulk Edit
        </button>
      </div>
    </div>
  );
}
