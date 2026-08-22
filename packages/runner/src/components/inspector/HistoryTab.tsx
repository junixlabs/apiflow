import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useHistoryResultStore } from '../../store/historyResultStore';
import { StatusBadge } from '../shared/StatusBadge';
import { JsonTreeView } from '../json-viewer/JsonTreeView';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


export function HistoryTab({ nodeId }: { nodeId: string }) {
  const history = useHistoryResultStore((s) => s.nodeHistory.get(nodeId) ?? []);
  const clearHistory = useHistoryResultStore((s) => s.clearHistory);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
        <p className="text-canvas-text/50 text-sm">No history yet</p>
        <p className="text-canvas-text/30 text-xs">
          Run this node to start recording
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-canvas-text/60">
          {history.length} request{history.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => clearHistory(nodeId)}
          className="text-[10px] text-method-delete/60 hover:text-method-delete"
        >
          Clear
        </button>
      </div>

      {history.map((entry, i) => {
        const isExpanded = expandedIndex === i;

        return (
          <div key={i} className="border border-canvas-border rounded">
            <button
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-hover"
            >
              {entry.error ? (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium bg-method-delete/20 text-method-delete">
                  ERR
                </span>
              ) : (
                <StatusBadge status={entry.status} />
              )}
              <span className={`font-mono ${entry.duration_ms > 1000 ? 'text-method-post' : 'text-canvas-text/70'}`}>
                {entry.duration_ms}ms
              </span>
              <span className="text-canvas-text/40">
                {formatBytes(entry.size_bytes)}
              </span>
              <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>

            {isExpanded && (
              <div className="border-t border-canvas-border p-2">
                {entry.error ? (
                  <p className="text-xs text-method-delete">{entry.error}</p>
                ) : (
                  <div className="bg-canvas-bg rounded p-2 border border-canvas-border max-h-[40vh] overflow-auto">
                    {entry.body !== null && typeof entry.body === 'object' ? (
                      <JsonTreeView data={entry.body} />
                    ) : typeof entry.body === 'string' ? (
                      <pre className="font-mono text-xs text-canvas-text whitespace-pre-wrap break-all select-text leading-5">
                        {entry.body}
                      </pre>
                    ) : (
                      <span className="text-canvas-text/30 text-xs italic">Empty response</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
