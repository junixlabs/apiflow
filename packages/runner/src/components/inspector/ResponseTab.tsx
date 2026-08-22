import { useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ExecutionResult } from '../../types';
import { StatusBadge } from '../shared/StatusBadge';
import { JsonTreeView } from '../json-viewer/JsonTreeView';

export function ResponseTab({ result }: { result: ExecutionResult }) {
  const [showHeaders, setShowHeaders] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyBody = useCallback(async () => {
    try {
      const text = typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [result.body]);

  if (result.error) {
    return (
      <div className="p-3 bg-method-delete/10 border border-method-delete/30 rounded text-sm text-method-delete">
        {result.error}
      </div>
    );
  }

  const headerCount = Object.keys(result.headers).length;
  const isJsonBody = result.body !== null && typeof result.body === 'object';
  const isStringBody = typeof result.body === 'string';

  return (
    <div className="space-y-3">
      {/* Status + Timing */}
      <div className="flex items-center gap-3 text-sm">
        <StatusBadge status={result.status} />
        <span className="text-canvas-text/60">{result.statusText}</span>
        <span className={`ml-auto text-xs font-mono ${result.duration_ms > 1000 ? 'text-method-post' : 'text-canvas-text/70'}`}>
          {result.duration_ms}ms &middot; {formatBytes(result.size_bytes)}
        </span>
      </div>

      {/* Response Headers (collapsible) */}
      {headerCount > 0 && (
        <div>
          <button
            onClick={() => setShowHeaders(!showHeaders)}
            className="flex items-center gap-1 text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 hover:text-canvas-text/80"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${showHeaders ? 'rotate-90' : ''}`} />
            Headers ({headerCount})
          </button>
          {showHeaders && (
            <div className="bg-canvas-bg rounded p-2 border border-canvas-border">
              <JsonTreeView data={result.headers} />
            </div>
          )}
        </div>
      )}

      {/* Response Body */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-canvas-text/60 uppercase tracking-wide">
            Body
            {isJsonBody && <span className="ml-1.5 normal-case text-[10px] text-primary/50">JSON</span>}
            {isStringBody && <span className="ml-1.5 normal-case text-[10px] text-canvas-text/30">Text</span>}
          </label>
          <button
            onClick={handleCopyBody}
            className="text-[10px] text-canvas-text/40 hover:text-canvas-text/70"
          >
            {copied ? 'Copied' : 'Copy body'}
          </button>
        </div>

        <div className="bg-canvas-bg rounded p-2 border border-canvas-border">
          {isJsonBody ? (
            <JsonTreeView data={result.body} />
          ) : isStringBody ? (
            <pre className="font-mono text-xs text-canvas-text whitespace-pre-wrap break-all select-text leading-5 max-h-[60vh] overflow-auto">
              {result.body as string}
            </pre>
          ) : result.body === null ? (
            <span className="text-canvas-text/30 text-xs italic">Empty response</span>
          ) : (
            <JsonTreeView data={result.body} />
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
