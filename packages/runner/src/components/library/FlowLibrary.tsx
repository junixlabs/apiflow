import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FolderPlus } from 'lucide-react';
import { useLibraryStore } from '../../store/libraryStore';
import { useFlowStore } from '../../store/flowStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useExecutionStore } from '../../store/executionStore';
import { useProjectStore } from '../../store/projectStore';
import { useAssertionStore } from '../../store/assertionStore';
import * as apiClient from '../../utils/apiClient';
import { FlowCard } from './FlowCard';
import type { ApiViewFileAny, ApiViewFileV2 } from '../../types';

interface Props {
  onOpenFlow: () => void;
}

export function FlowLibrary({ onOpenFlow }: Props) {
  const [search, setSearch] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const isProjectMode = useProjectStore((s) => s.isProjectMode);

  // Library mode (standalone)
  const libraryFlows = useLibraryStore((s) => s.flows);
  const loadIndex = useLibraryStore((s) => s.loadIndex);
  const getFlow = useLibraryStore((s) => s.getFlow);
  const deleteFromLibrary = useLibraryStore((s) => s.deleteFromLibrary);
  const duplicateFlow = useLibraryStore((s) => s.duplicateFlow);

  // Project mode
  const projectFlowList = useProjectStore((s) => s.flowList);
  const loadFlowList = useProjectStore((s) => s.loadFlowList);
  const setActiveFlowName = useProjectStore((s) => s.setActiveFlowName);
  const deleteProjectFlow = useProjectStore((s) => s.deleteFlow);
  const flowFolders = useProjectStore((s) => s.flowFolders);

  const loadFlowFn = useFlowStore((s) => s.loadFlow);
  const loadEnvironments = useEnvironmentStore((s) => s.loadEnvironments);
  const resetAll = useExecutionStore((s) => s.resetAll);

  useEffect(() => {
    if (isProjectMode) {
      loadFlowList();
    } else {
      loadIndex();
    }
  }, [isProjectMode, loadIndex, loadFlowList]);

  // Map project flows to same shape as library flows for FlowCard
  const flows = isProjectMode
    ? projectFlowList.map((f) => ({
        id: f.fileName,
        name: f.name,
        updatedAt: f.updatedAt || new Date().toISOString(),
        nodeCount: f.nodeCount,
        folder: f.folder,
      }))
    : libraryFlows.map((f) => ({ ...f, folder: undefined as string | undefined }));

  const filtered = flows
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleOpen = async (id: string) => {
    if (isProjectMode) {
      try {
        const flowData = await apiClient.getFlow(id) as ApiViewFileAny;
        loadFlowFn(flowData);
        if (flowData.version === 2 && (flowData as ApiViewFileV2).assertions) {
          useAssertionStore.getState().loadFromFlow((flowData as ApiViewFileV2).assertions!);
        } else {
          useAssertionStore.getState().loadFromFlow({});
        }
        setActiveFlowName(id);
        resetAll();
        onOpenFlow();
      } catch {
        // Failed to load flow
      }
    } else {
      const flow = getFlow(id);
      if (!flow) return;
      loadFlowFn(flow);
      loadEnvironments(flow.environments, flow.activeEnvironmentName);
      resetAll();
      useLibraryStore.setState({ currentFlowId: id } as never);
      onOpenFlow();
    }
  };

  const handleNew = async () => {
    if (isProjectMode) {
      const now = new Date().toISOString();
      const newFlow: ApiViewFileV2 = {
        version: 2,
        metadata: {
          name: 'Untitled Flow',
          createdAt: now,
          updatedAt: now,
        },
        nodes: [],
        edges: [],
        assertions: {},
      };
      const fileName = `untitled-${Date.now()}.apiview`;
      try {
        await apiClient.saveFlow(fileName, newFlow);
        loadFlowFn(newFlow);
        useAssertionStore.getState().loadFromFlow({});
        setActiveFlowName(fileName);
        resetAll();
        await loadFlowList();
        onOpenFlow();
      } catch {
        // Failed to create flow
      }
    } else {
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
    }
  };

  const handleDelete = async (id: string) => {
    if (isProjectMode) {
      try {
        await deleteProjectFlow(id);
      } catch {
        // Failed to delete flow
      }
    } else {
      deleteFromLibrary(id);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (isProjectMode) {
      try {
        const flowData = await apiClient.getFlow(id) as ApiViewFileV2;
        const cloned: ApiViewFileV2 = JSON.parse(JSON.stringify(flowData));
        cloned.metadata.name = flowData.metadata.name + ' (copy)';
        cloned.metadata.createdAt = new Date().toISOString();
        cloned.metadata.updatedAt = new Date().toISOString();
        const newFileName = id.replace('.apiview', `-copy-${Date.now()}.apiview`);
        await apiClient.saveFlow(newFileName, cloned);
        await loadFlowList();
      } catch {
        // Failed to duplicate flow
      }
    } else {
      duplicateFlow(id);
    }
  };

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      await apiClient.createFlowFolder(trimmed);
      await loadFlowList();
      setNewFolderName('');
      setShowNewFolder(false);
    } catch {
      // Failed to create folder
    }
  };

  // Group flows by folder for project mode
  const groupedByFolder = isProjectMode
    ? filtered.reduce<Record<string, typeof filtered>>((acc, flow) => {
        const key = flow.folder || '';
        if (!acc[key]) acc[key] = [];
        acc[key].push(flow);
        return acc;
      }, {})
    : { '': filtered };

  // Get all unique folders (including empty ones from flowFolders)
  const allFolders = isProjectMode
    ? Array.from(new Set([...Object.keys(groupedByFolder), ...flowFolders.map((f) => f)])).sort()
    : [''];

  const hasFolders = isProjectMode && allFolders.some((f) => f !== '');

  return (
    <div className="flex-1 h-full overflow-auto bg-canvas-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-canvas-text">Flow Library</h1>
          <div className="flex items-center gap-2">
            {isProjectMode && (
              <button
                onClick={() => setShowNewFolder(true)}
                className="px-2.5 py-1.5 text-xs text-canvas-text/50 hover:text-canvas-text/80 hover:bg-surface-hover border border-canvas-border rounded flex items-center gap-1"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                New Folder
              </button>
            )}
            <button
              onClick={handleNew}
              className="px-3 py-1.5 text-xs bg-primary text-white hover:bg-primary/80 rounded font-medium"
            >
              + New Flow
            </button>
          </div>
        </div>

        {showNewFolder && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
              }}
              placeholder="Folder name..."
              autoFocus
              className="flex-1 bg-surface border border-canvas-border rounded px-3 py-1.5 text-sm text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1.5 text-xs bg-primary text-white hover:bg-primary/80 rounded"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
              className="px-3 py-1.5 text-xs text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover rounded"
            >
              Cancel
            </button>
          </div>
        )}

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
        ) : hasFolders ? (
          <div className="space-y-4">
            {allFolders.map((folder) => {
              const folderFlows = groupedByFolder[folder] || [];
              if (folderFlows.length === 0 && folder === '') return null;
              const isCollapsed = collapsedFolders.has(folder || '__root__');
              const folderLabel = folder || 'Root';

              return (
                <div key={folder || '__root__'}>
                  <button
                    onClick={() => toggleFolder(folder || '__root__')}
                    className="flex items-center gap-1.5 mb-2 text-sm font-medium text-canvas-text/60 hover:text-canvas-text"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {folderLabel}
                    <span className="text-xs text-canvas-text/30">({folderFlows.length})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {folderFlows.map((flow) => (
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
              );
            })}
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
