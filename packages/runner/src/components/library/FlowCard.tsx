import type { FlowMeta } from '../../store/libraryStore';

interface Props {
  flow: FlowMeta;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FlowCard({ flow, onOpen, onDuplicate, onDelete }: Props) {
  return (
    <div className="bg-surface border border-canvas-border rounded-lg hover:border-primary/40 transition-colors group">
      <button
        onClick={() => onOpen(flow.id)}
        className="w-full text-left p-4 space-y-2"
      >
        <h3 className="text-sm font-medium text-canvas-text truncate">
          {flow.name}
        </h3>
        <div className="flex items-center gap-3 text-xs text-canvas-text/40">
          <span>{flow.nodeCount} node{flow.nodeCount !== 1 ? 's' : ''}</span>
          <span>{new Date(flow.updatedAt).toLocaleDateString()}</span>
        </div>
      </button>
      <div className="flex border-t border-canvas-border">
        <button
          onClick={() => onDuplicate(flow.id)}
          className="flex-1 px-3 py-1.5 text-xs text-canvas-text/40 hover:text-canvas-text hover:bg-surface-hover"
        >
          Duplicate
        </button>
        <button
          onClick={() => onDelete(flow.id)}
          className="flex-1 px-3 py-1.5 text-xs text-method-delete/50 hover:text-method-delete hover:bg-method-delete/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
