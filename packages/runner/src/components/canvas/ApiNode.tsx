import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StickyNote, MoreVertical } from 'lucide-react';
import type { ApiNodeData } from '../../types';
import { useExecutionStore } from '../../store/executionStore';
import { useAssertionStore } from '../../store/assertionStore';
import { MethodBadge } from '../shared/MethodBadge';

const STATUS_STYLES: Record<string, string> = {
  idle: 'border-canvas-border',
  running: 'border-primary border-dashed animate-pulse',
  success: 'border-method-get',
  error: 'border-method-delete',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ApiNodeProps {
  id: string;
  data: ApiNodeData;
  selected?: boolean;
}

export const ApiNode = memo(function ApiNode({ id, data, selected }: ApiNodeProps) {
  const status = useExecutionStore((s) => s.nodeStatuses.get(id)) ?? 'idle';
  const result = useExecutionStore((s) => s.nodeResults.get(id));
  const assertionResults = useAssertionStore((s) => s.nodeAssertionResults.get(id));
  const assertions = useAssertionStore((s) => s.nodeAssertions.get(id));
  const borderStyle = STATUS_STYLES[status] || STATUS_STYLES.idle;

  const url = data.config.url || 'No URL set';
  const truncatedUrl = url.length > 35 ? url.slice(0, 35) + '...' : url;

  return (
    <div
      className={`bg-surface rounded-xl border-2 ${borderStyle} ${
        selected ? 'ring-2 ring-primary/40' : ''
      } px-3.5 py-2.5 min-w-[200px] max-w-[280px] transition-all shadow-sm hover:shadow-md group`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg !opacity-70 hover:!opacity-100 hover:!scale-125 !transition-all"
      />
      {/* Header row: method badge + label + hover menu */}
      <div className="flex items-center gap-2 mb-1">
        <MethodBadge method={data.config.method} />
        <span className="font-semibold text-[13px] text-canvas-text truncate flex-1">
          {data.label}
        </span>
        {data.description && (
          <span className="text-canvas-text/30 shrink-0" title={data.description}>
            <StickyNote className="w-3 h-3" />
          </span>
        )}
        {assertions && assertions.length > 0 && assertionResults && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              assertionResults.every((r) => r.passed) ? 'bg-method-get' : 'bg-method-delete'
            }`}
            title={
              assertionResults.every((r) => r.passed)
                ? 'All assertions passed'
                : `${assertionResults.filter((r) => !r.passed).length} assertion(s) failed`
            }
          />
        )}
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-canvas-text/30 hover:text-canvas-text shrink-0">
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* URL row */}
      <div className="text-xs font-mono text-canvas-text/50 truncate" title={data.config.url}>
        {truncatedUrl}
      </div>
      {/* Status row — only after execution */}
      {result && (
        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-canvas-border/50 text-[10px] font-mono">
          <span className={result.status < 400 ? 'text-method-get font-semibold' : 'text-method-delete font-semibold'}>
            {result.status}
          </span>
          <span className="text-canvas-text/40">{result.duration_ms}ms</span>
          {result.retryCount ? (
            <span className="text-method-put text-[9px]">retry:{result.retryCount}</span>
          ) : null}
          <span className="text-canvas-text/30 ml-auto">{formatBytes(result.size_bytes)}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg !opacity-70 hover:!opacity-100 hover:!scale-125 !transition-all"
      />
    </div>
  );
});
