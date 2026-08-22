import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ExecutionResult } from '../../types';
import { MethodBadge } from '../shared/MethodBadge';
import { JsonTreeView } from '../json-viewer/JsonTreeView';

export function RequestTab({ result }: { result: ExecutionResult }) {
  const { resolvedRequest } = result;
  const [showHeaders, setShowHeaders] = useState(false);
  const headerCount = Object.keys(resolvedRequest.headers).length;

  return (
    <div className="space-y-3">
      {/* Method + URL */}
      <div className="flex items-start gap-2">
        <MethodBadge method={resolvedRequest.method} />
        <span className="font-mono text-sm text-canvas-text break-all select-text">
          {resolvedRequest.url}
        </span>
      </div>

      {/* Headers (collapsible) */}
      <div>
        <button
          onClick={() => setShowHeaders(!showHeaders)}
          className="flex items-center gap-1 text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 hover:text-canvas-text/80"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${showHeaders ? 'rotate-90' : ''}`} />
          Headers ({headerCount})
        </button>
        {showHeaders && (
          headerCount > 0 ? (
            <div className="bg-canvas-bg rounded p-2 border border-canvas-border">
              <JsonTreeView data={resolvedRequest.headers} />
            </div>
          ) : (
            <p className="text-canvas-text/30 text-xs">No headers</p>
          )
        )}
      </div>

      {/* Body */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Body
        </label>
        {resolvedRequest.body ? (
          <div className="bg-canvas-bg rounded p-2 border border-canvas-border">
            <JsonTreeView data={tryParseJson(resolvedRequest.body)} />
          </div>
        ) : (
          <p className="text-canvas-text/30 text-xs">No body</p>
        )}
      </div>
    </div>
  );
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
