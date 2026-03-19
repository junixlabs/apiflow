import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ApiNodeData } from '../../types';
import { useExecutionStore } from '../../store/executionStore';
import { MethodBadge } from '../shared/MethodBadge';

const STATUS_STYLES: Record<string, string> = {
  idle: 'border-canvas-border',
  running: 'border-primary border-dashed animate-pulse',
  success: 'border-method-get',
  error: 'border-method-delete',
};

interface ApiNodeProps {
  id: string;
  data: ApiNodeData;
  selected?: boolean;
}

export const ApiNode = memo(function ApiNode({ id, data, selected }: ApiNodeProps) {
  const status = useExecutionStore((s) => s.nodeStatuses.get(id)) ?? 'idle';
  const borderStyle = STATUS_STYLES[status] || STATUS_STYLES.idle;

  const url = data.config.url || 'No URL set';
  const truncatedUrl = url.length > 35 ? url.slice(0, 35) + '...' : url;

  return (
    <div
      className={`bg-surface rounded-lg border-2 ${borderStyle} ${
        selected ? 'ring-2 ring-primary/50' : ''
      } px-3 py-2 min-w-[180px] max-w-[260px] transition-colors`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg !opacity-70 hover:!opacity-100 hover:!scale-125 !transition-all"
      />
      <div className="flex items-center gap-2 mb-1">
        <MethodBadge method={data.config.method} />
        {data.description && (
          <span className="text-canvas-text/30 text-xs" title={data.description}>
            &#x1f4dd;
          </span>
        )}
      </div>
      <div className="text-xs font-mono text-canvas-text/70 truncate" title={data.config.url}>
        {truncatedUrl}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg !opacity-70 hover:!opacity-100 hover:!scale-125 !transition-all"
      />
    </div>
  );
});
