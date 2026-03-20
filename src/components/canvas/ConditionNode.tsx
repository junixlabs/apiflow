import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { useExecutionStore } from '../../store/executionStore';

const STATUS_STYLES: Record<string, string> = {
  idle: 'border-canvas-border',
  running: 'border-primary border-dashed animate-pulse',
  success: 'border-method-get',
  error: 'border-method-delete',
};

interface ConditionNodeProps {
  id: string;
  data: { label: string; sourceNodeLabel: string; condition: { fieldPath: string; operator: string; expected: string } };
  selected?: boolean;
}

export const ConditionNode = memo(function ConditionNode({ id, data, selected }: ConditionNodeProps) {
  const status = useExecutionStore((s) => s.nodeStatuses.get(id)) ?? 'idle';
  const borderStyle = STATUS_STYLES[status] || STATUS_STYLES.idle;
  const condStr = `${data.condition?.fieldPath || '?'} ${data.condition?.operator || '?'} ${data.condition?.expected || '?'}`;

  return (
    <div className={`bg-surface rounded-xl border-2 ${borderStyle} ${selected ? 'ring-2 ring-primary/40' : ''} px-3.5 py-2.5 min-w-[180px] max-w-[240px] shadow-sm`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-3.5 h-3.5 text-method-put" />
        <span className="text-[13px] font-semibold text-canvas-text truncate">{data.label || 'Condition'}</span>
      </div>
      <div className="text-[10px] font-mono text-canvas-text/50 truncate">{condStr}</div>
      <div className="flex justify-between mt-1 text-[9px] font-mono text-canvas-text/30 px-0.5">
        <span />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-method-get">true</span>
          <span className="text-method-delete">false</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="true" style={{ top: '30%' }} className="!w-3 !h-3 !bg-method-get !border-2 !border-canvas-bg" />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '70%' }} className="!w-3 !h-3 !bg-method-delete !border-2 !border-canvas-bg" />
    </div>
  );
});
