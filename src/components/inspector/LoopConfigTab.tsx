import { useFlowStore } from '../../store/flowStore';

interface Props {
  nodeId: string;
  data: {
    label: string;
    loopConfig?: { mode: string; pageParam: string; startPage: number; maxIterations: number };
  };
}

export function LoopConfigTab({ nodeId, data }: Props) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const loopConfig = data.loopConfig ?? { mode: 'pagination', pageParam: 'page', startPage: 1, maxIterations: 20 };

  const update = (patch: Record<string, unknown>) => {
    updateNodeData(nodeId, patch);
  };

  const updateLoop = (patch: Partial<typeof loopConfig>) => {
    update({ loopConfig: { ...loopConfig, ...patch } });
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
          placeholder="Loop name"
        />
      </div>

      {/* Mode */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Mode
        </label>
        <select
          value={loopConfig.mode}
          disabled
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm text-canvas-text focus:border-primary focus:outline-none opacity-60"
        >
          <option value="pagination">Pagination</option>
        </select>
      </div>

      {/* Page param */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Page Parameter
        </label>
        <input
          type="text"
          value={loopConfig.pageParam}
          onChange={(e) => updateLoop({ pageParam: e.target.value })}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          placeholder="page"
        />
      </div>

      {/* Start page */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Start Page
        </label>
        <input
          type="number"
          value={loopConfig.startPage}
          onChange={(e) => updateLoop({ startPage: Number(e.target.value) })}
          min={0}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Max iterations */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Max Iterations
        </label>
        <input
          type="number"
          value={loopConfig.maxIterations}
          onChange={(e) => updateLoop({ maxIterations: Number(e.target.value) })}
          min={1}
          max={100}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
        />
        <p className="text-[10px] text-canvas-text/30 mt-1">
          Safety limit to prevent infinite loops
        </p>
      </div>
    </div>
  );
}
