interface Props {
  current: number;
  total: number;
  currentFlowName: string;
  onCancel: () => void;
}

export function BatchRunProgress({ current, total, currentFlowName, onCancel }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="bg-surface border border-canvas-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-canvas-text">
          Running flows... ({current}/{total})
        </span>
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
        >
          Cancel
        </button>
      </div>
      <div className="w-full h-2 bg-canvas-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {currentFlowName && (
        <div className="mt-1.5 text-[10px] text-canvas-text/40 truncate">
          Running: {currentFlowName}
        </div>
      )}
    </div>
  );
}
