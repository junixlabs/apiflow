import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { parseOpenApiSpec } from '../../utils/openApiParser';
import { parsePostmanCollection } from '../../utils/postmanParser';
import { useFlowStore } from '../../store/flowStore';

interface Props {
  onClose: () => void;
}

function detectAndParse(content: string): { nodes: import('../../core/types').CoreApiNode[]; edges: import('../../core/types').CoreFlowEdge[] } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Not JSON — try as YAML (only OpenAPI uses YAML)
    return parseOpenApiSpec(content);
  }

  // Detect format from parsed JSON
  if (typeof parsed.openapi === 'string') {
    return parseOpenApiSpec(content);
  }

  const info = parsed.info as Record<string, unknown> | undefined;
  if (info && typeof info.schema === 'string' && info.schema.includes('postman')) {
    return parsePostmanCollection(content);
  }

  // Fallback heuristics
  if (parsed.item && info) {
    return parsePostmanCollection(content);
  }

  if (parsed.paths) {
    return parseOpenApiSpec(content);
  }

  throw new Error('Unknown format. Please provide an OpenAPI 3.x or Postman collection file.');
}

export function ImportCollectionModal({ onClose }: Props) {
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addNodes = useFlowStore((s) => s.addNodes);

  const handleImport = (content: string) => {
    if (!content.trim()) {
      setError('Please provide a file or paste content');
      return;
    }

    try {
      const { nodes, edges } = detectAndParse(content.trim());
      if (nodes.length === 0) {
        setError('No API endpoints found in the provided content');
        return;
      }
      addNodes(nodes, edges);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse collection');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleImport(reader.result);
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface border border-canvas-border rounded-lg shadow-xl w-[520px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-border">
          <h3 className="text-sm font-medium text-canvas-text">Import Collection</h3>
          <button onClick={onClose} className="text-canvas-text/40 hover:text-canvas-text">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-canvas-text/60 mb-1">Upload file (.json, .yaml, .yml)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileChange}
              className="w-full text-xs text-canvas-text file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-surface-hover file:text-canvas-text hover:file:bg-surface-hover/80"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-canvas-border" />
            <span className="text-xs text-canvas-text/40">or paste content</span>
            <div className="flex-1 h-px bg-canvas-border" />
          </div>

          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setError('');
            }}
            placeholder="Paste OpenAPI or Postman JSON/YAML here..."
            rows={8}
            className="w-full bg-canvas-bg border border-canvas-border rounded px-3 py-2 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none resize-y"
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
              onClick={() => handleImport(pasteText)}
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
