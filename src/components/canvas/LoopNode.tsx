import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Repeat } from 'lucide-react';

interface LoopNodeProps {
  id: string;
  data: { label: string; loopConfig: { mode: string; pageParam?: string; maxIterations: number } };
  selected?: boolean;
}

export const LoopNode = memo(function LoopNode({ id: _id, data, selected }: LoopNodeProps) {
  const config = data.loopConfig;
  const desc = config ? `${config.pageParam || 'page'} 1-${config.maxIterations}` : 'Configure loop';

  return (
    <div className={`bg-surface rounded-xl border-2 border-dashed border-purple-500/50 ${selected ? 'ring-2 ring-primary/40' : ''} px-3.5 py-2.5 min-w-[180px] max-w-[240px] shadow-sm`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg" />
      <div className="flex items-center gap-2 mb-1">
        <Repeat className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[13px] font-semibold text-canvas-text truncate">{data.label || 'Loop'}</span>
      </div>
      <div className="text-[10px] font-mono text-canvas-text/50">{desc}</div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg" />
    </div>
  );
});
