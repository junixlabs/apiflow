import { useState, useEffect } from 'react';
import { useLibraryStore } from '../../store/libraryStore';
import { useFlowStore } from '../../store/flowStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useExecutionStore } from '../../store/executionStore';
import { FlowCard } from './FlowCard';

interface Props {
  onOpenFlow: () => void;
}

export function FlowLibrary({ onOpenFlow }: Props) {
  const [search, setSearch] = useState('');
  const flows = useLibraryStore((s) => s.flows);
  const loadIndex = useLibraryStore((s) => s.loadIndex);
  const getFlow = useLibraryStore((s) => s.getFlow);
  const deleteFromLibrary = useLibraryStore((s) => s.deleteFromLibrary);
  const duplicateFlow = useLibraryStore((s) => s.duplicateFlow);
  const loadFlowFn = useFlowStore((s) => s.loadFlow);
  const loadEnvironments = useEnvironmentStore((s) => s.loadEnvironments);
  const resetAll = useExecutionStore((s) => s.resetAll);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  const filtered = flows
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleOpen = (id: string) => {
    const flow = getFlow(id);
    if (!flow) return;
    loadFlowFn(flow);
    loadEnvironments(flow.environments, flow.activeEnvironmentName);
    resetAll();
    // Store the current flow ID for save-back
    useLibraryStore.setState({ currentFlowId: id } as never);
    onOpenFlow();
  };

  const handleNew = () => {
    loadFlowFn({
      version: 1,
      metadata: {
        name: 'Untitled Flow',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nodes: [],
      edges: [],
      environments: [{ name: 'Default', variables: [{ key: '', value: '', enabled: true }] }],
      activeEnvironmentName: 'Default',
    });
    loadEnvironments(
      [{ name: 'Default', variables: [{ key: '', value: '', enabled: true }] }],
      'Default'
    );
    resetAll();
    onOpenFlow();
  };

  const handleDelete = (id: string) => {
    deleteFromLibrary(id);
  };

  const handleDuplicate = (id: string) => {
    duplicateFlow(id);
  };

  return (
    <div className="flex-1 h-full overflow-auto bg-canvas-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-canvas-text">Flow Library</h1>
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-xs bg-primary text-white hover:bg-primary/80 rounded font-medium"
          >
            + New Flow
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flows..."
          className="w-full bg-surface border border-canvas-border rounded px-3 py-2 text-sm text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none mb-4"
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-canvas-text/40 text-sm">
              {flows.length === 0 ? 'No saved flows yet' : 'No flows match your search'}
            </p>
            {flows.length === 0 && (
              <p className="text-canvas-text/25 text-xs mt-1">
                Create a new flow or save an existing one
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onOpen={handleOpen}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
