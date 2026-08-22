import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { useExecutionStore } from '../../store/executionStore';

const EDGE_COLORS = {
  idle: '#334155',
  running: '#3B82F6',
  success: '#22C55E',
  error: '#EF4444',
};

export const ConnectionLine = memo(function ConnectionLine(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, source, target } = props;

  const sourceStatus = useExecutionStore((s) => s.nodeStatuses.get(source)) ?? 'idle';
  const targetStatus = useExecutionStore((s) => s.nodeStatuses.get(target)) ?? 'idle';

  // Edge color: if target ran successfully, green. If running, blue. If error, red. Else idle.
  let edgeStatus: keyof typeof EDGE_COLORS = 'idle';
  if (targetStatus === 'success' && sourceStatus === 'success') edgeStatus = 'success';
  else if (targetStatus === 'error' || sourceStatus === 'error') edgeStatus = 'error';
  else if (targetStatus === 'running' || sourceStatus === 'running') edgeStatus = 'running';

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: EDGE_COLORS[edgeStatus],
        strokeWidth: 2,
        strokeDasharray: edgeStatus === 'running' ? '5 5' : undefined,
        animation: edgeStatus === 'running' ? 'dashdraw 0.5s linear infinite' : undefined,
      }}
    />
  );
});
