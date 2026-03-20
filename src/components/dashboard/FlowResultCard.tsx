import { useState } from 'react';
import type { FlowRunResult } from '../../store/dashboardStore';

interface Props {
  result: FlowRunResult | undefined;
  flowName: string;
  flowId: string;
  nodeCount: number;
  onOpen: (id: string) => void;
}

export function FlowResultCard({ result, flowName, flowId, nodeCount, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false);

  let statusLabel: string;
  let statusColor: string;
  let badgeBg: string;

  if (!result) {
    statusLabel = 'Not Run';
    statusColor = 'text-canvas-text/40';
    badgeBg = 'bg-canvas-text/10';
  } else if (result.failedCount > 0) {
    statusLabel = 'Failed';
    statusColor = 'text-method-delete';
    badgeBg = 'bg-method-delete/15';
  } else {
    statusLabel = 'Passed';
    statusColor = 'text-method-get';
    badgeBg = 'bg-method-get/15';
  }

  return (
    <div className="bg-surface border border-canvas-border rounded-lg hover:border-primary/40 transition-colors">
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-canvas-text truncate flex-1 mr-2">
            {flowName}
          </h3>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badgeBg} ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-canvas-text/40">
          <span>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
          {result && (
            <>
              <span>{result.totalDuration}ms</span>
              <span>{result.passedCount} passed</span>
              {result.failedCount > 0 && (
                <span className="text-method-delete">{result.failedCount} failed</span>
              )}
            </>
          )}
        </div>

        {result && (
          <div className="text-[10px] text-canvas-text/30">
            {new Date(result.timestamp).toLocaleString()}
          </div>
        )}
      </div>

      <div className="flex border-t border-canvas-border">
        {result && result.nodeResults.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 px-3 py-1.5 text-xs text-canvas-text/40 hover:text-canvas-text hover:bg-surface-hover"
          >
            {expanded ? 'Collapse' : 'Details'}
          </button>
        )}
        <button
          onClick={() => onOpen(flowId)}
          className="flex-1 px-3 py-1.5 text-xs text-primary/60 hover:text-primary hover:bg-primary/5"
        >
          Open
        </button>
      </div>

      {expanded && result && (
        <div className="border-t border-canvas-border p-3 max-h-60 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-canvas-text/40 text-left">
                <th className="pb-1.5 font-medium">Node</th>
                <th className="pb-1.5 font-medium">Status</th>
                <th className="pb-1.5 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {result.nodeResults.map((nr) => (
                <tr key={nr.nodeId} className="border-t border-canvas-border/50">
                  <td className="py-1.5 text-canvas-text truncate max-w-[120px]">{nr.label}</td>
                  <td className="py-1.5">
                    {nr.error ? (
                      <span className="text-method-delete" title={nr.error}>
                        {nr.status || 'Error'}
                      </span>
                    ) : (
                      <span className={nr.status >= 200 && nr.status < 400 ? 'text-method-get' : 'text-method-delete'}>
                        {nr.status}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-canvas-text/40">{nr.duration_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
