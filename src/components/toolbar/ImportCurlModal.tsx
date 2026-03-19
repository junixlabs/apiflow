import { useState } from 'react';
import { parseCurl } from '../../utils/curlParser';
import { useFlowStore } from '../../store/flowStore';

interface Props {
  onClose: () => void;
}

export function ImportCurlModal({ onClose }: Props) {
  const [curlText, setCurlText] = useState('');
  const [error, setError] = useState('');
  const addNodeFromConfig = useFlowStore((s) => s.addNodeFromConfig);

  const handleImport = () => {
    if (!curlText.trim()) {
      setError('Please paste a cURL command');
      return;
    }

    try {
      const config = parseCurl(curlText.trim());
      if (!config.url) {
        setError('Could not parse URL from cURL command');
        return;
      }
      // Auto-format body JSON if valid
      if (config.body) {
        try {
          const parsed = JSON.parse(config.body);
          config.body = JSON.stringify(parsed, null, 2);
        } catch { /* not JSON, keep as-is */ }
      }
      addNodeFromConfig(config);
      onClose();
    } catch {
      setError('Failed to parse cURL command. Please check the format.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface border border-canvas-border rounded-lg shadow-xl w-[520px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-border">
          <h3 className="text-sm font-medium text-canvas-text">Import cURL</h3>
          <button onClick={onClose} className="text-canvas-text/40 hover:text-canvas-text">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-3">
          <textarea
            value={curlText}
            onChange={(e) => {
              setCurlText(e.target.value);
              setError('');
            }}
            placeholder={`curl -X POST https://api.example.com/endpoint \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`}
            rows={8}
            className="w-full bg-canvas-bg border border-canvas-border rounded px-3 py-2 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none resize-y"
            autoFocus
          />

          {error && (
            <p className="text-xs text-method-delete">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-canvas-text/60 hover:text-canvas-text hover:bg-surface-hover rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-3 py-1.5 text-xs bg-primary text-white hover:bg-primary/80 rounded font-medium"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
