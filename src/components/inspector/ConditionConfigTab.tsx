import { useFlowStore } from '../../store/flowStore';
import type { ConditionRule } from '../../core/types';

const OPERATORS: { value: ConditionRule['operator']; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: '> (greater than)' },
  { value: 'lt', label: '< (less than)' },
  { value: 'exists', label: 'exists' },
  { value: 'not_exists', label: 'not exists' },
];

interface Props {
  nodeId: string;
  data: {
    label: string;
    sourceNodeLabel?: string;
    condition?: { fieldPath: string; operator: string; expected: string };
  };
}

export function ConditionConfigTab({ nodeId, data }: Props) {
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const apiNodes = nodes.filter((n) => n.type === 'apiNode');
  const condition = data.condition ?? { fieldPath: 'status', operator: 'equals', expected: '200' };
  const sourceNodeLabel = data.sourceNodeLabel ?? '';

  const update = (patch: Record<string, unknown>) => {
    updateNodeData(nodeId, patch);
  };

  const updateCondition = (patch: Partial<typeof condition>) => {
    update({ condition: { ...condition, ...patch } });
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Label
        </label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          placeholder="Condition name"
        />
      </div>

      {/* Source node */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Source Node
        </label>
        <select
          value={sourceNodeLabel}
          onChange={(e) => update({ sourceNodeLabel: e.target.value })}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm text-canvas-text focus:border-primary focus:outline-none"
        >
          <option value="">-- Select source node --</option>
          {apiNodes.map((n) => (
            <option key={n.id} value={n.data.label}>
              {n.data.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-canvas-text/30 mt-1">
          Which node's response to evaluate
        </p>
      </div>

      {/* Field path */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Field Path
        </label>
        <input
          type="text"
          value={condition.fieldPath}
          onChange={(e) => updateCondition({ fieldPath: e.target.value })}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          placeholder="status, body.data.id, headers.content-type"
        />
      </div>

      {/* Operator */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Operator
        </label>
        <select
          value={condition.operator}
          onChange={(e) => updateCondition({ operator: e.target.value })}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm text-canvas-text focus:border-primary focus:outline-none"
        >
          {OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Expected value */}
      {condition.operator !== 'exists' && condition.operator !== 'not_exists' && (
        <div>
          <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
            Expected Value
          </label>
          <input
            type="text"
            value={condition.expected}
            onChange={(e) => updateCondition({ expected: e.target.value })}
            className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
            placeholder="200"
          />
        </div>
      )}
    </div>
  );
}
