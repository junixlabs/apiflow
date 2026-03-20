import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { FlowCanvas } from './components/canvas/FlowCanvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { FlowLibrary } from './components/library/FlowLibrary';
import { EndpointLibraryPanel } from './components/library/EndpointLibraryPanel';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProjectSelector } from './components/project/ProjectSelector';
import { useFlowStore } from './store/flowStore';
import { useExecutionStore } from './store/executionStore';
import { useEnvironmentStore } from './store/environmentStore';
import { useLibraryStore } from './store/libraryStore';
import { useProjectStore } from './store/projectStore';
import { useEndpointLibraryStore } from './store/endpointLibraryStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { saveDraft, loadDraft, clearDraft } from './utils/autoSave';
import { saveFlow, loadFlow as loadFlowFile } from './utils/fileIO';
import * as apiClient from './utils/apiClient';
import { getActiveProject } from './utils/apiClient';
import { useAssertionStore } from './store/assertionStore';
import { runFlow } from './engine/executor';
import { useThemeStore } from './store/themeStore';

export default function App() {
  const [view, setView] = useState<'canvas' | 'library' | 'dashboard'>('canvas');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [showImportCurl, setShowImportCurl] = useState(false);
  const [standaloneMode, setStandaloneMode] = useState(false);
  const [showEndpointLibrary, setShowEndpointLibrary] = useState(false);
  const draftRef = useRef<ReturnType<typeof loadDraft>>(null);

  const isDirty = useFlowStore((s) => s.isDirty);
  const isProjectMode = useProjectStore((s) => s.isProjectMode);

  // Apply theme on mount
  useEffect(() => {
    const theme = useThemeStore.getState().theme;
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  // Try to restore active project + last open flow on mount
  useEffect(() => {
    const init = async () => {
      await useProjectStore.getState().loadRecentProjects();
      const active = await getActiveProject();
      if (active) {
        await useProjectStore.getState().openProject(active.dir);
        // Load endpoint library for project
        useEndpointLibraryStore.getState().loadLibrary().catch(() => {});
        // Restore last open flow
        const lastFlow = localStorage.getItem('apiview_active_flow');
        if (lastFlow) {
          try {
            const flowData = await apiClient.getFlow(lastFlow);
            useFlowStore.getState().loadFlow(flowData as import('./types').ApiViewFileAny);
            if ((flowData as { version?: number }).version === 2 && (flowData as { assertions?: Record<string, unknown[]> }).assertions) {
              useAssertionStore.getState().loadFromFlow((flowData as import('./types').ApiViewFileV2).assertions!);
            }
            useProjectStore.getState().setActiveFlowName(lastFlow);
          } catch { /* flow may have been deleted */ }
        }
      }
    };
    init().catch(() => {});
  }, []);

  // Check for draft on mount (standalone mode only)
  useEffect(() => {
    if (isProjectMode) return;
    const draft = loadDraft();
    if (draft && draft.nodes.length > 0) {
      draftRef.current = draft;
      setShowDraftBanner(true);
    }
  }, [isProjectMode]);

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!useFlowStore.getState().isDirty) return;

      if (useProjectStore.getState().isProjectMode) {
        useProjectStore.getState().saveCurrentFlow().catch(() => {});
      } else {
        const state = useFlowStore.getState();
        const envState = useEnvironmentStore.getState();
        const flow = state.exportFlow(envState.environments, envState.activeEnvironmentName);
        saveDraft(flow);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // In project mode, auto-save handles persistence — no need to warn
      if (useProjectStore.getState().isProjectMode) return;
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleRestoreDraft = () => {
    if (draftRef.current) {
      useFlowStore.getState().loadFlow(draftRef.current);
      useEnvironmentStore.getState().loadEnvironments(
        draftRef.current.environments,
        draftRef.current.activeEnvironmentName
      );
      useExecutionStore.getState().resetAll();
    }
    setShowDraftBanner(false);
    draftRef.current = null;
  };

  const handleDismissDraft = () => {
    setShowDraftBanner(false);
    clearDraft();
    draftRef.current = null;
  };

  const handleUndo = useCallback(() => {
    useFlowStore.getState().undo();
  }, []);

  const handleRedo = useCallback(() => {
    useFlowStore.getState().redo();
  }, []);

  const handleSave = useCallback(async () => {
    if (useProjectStore.getState().isProjectMode) {
      await useProjectStore.getState().saveCurrentFlow();
    } else {
      const state = useFlowStore.getState();
      const envState = useEnvironmentStore.getState();
      const data = state.exportFlow(envState.environments, envState.activeEnvironmentName);
      await saveFlow(data);
      state.setClean();
      clearDraft();
      useLibraryStore.getState().saveToLibrary(data);
    }
  }, []);

  const handleOpen = useCallback(async () => {
    if (useProjectStore.getState().isProjectMode) {
      setView('library');
    } else {
      const file = await loadFlowFile();
      if (file) {
        useFlowStore.getState().loadFlow(file);
        useEnvironmentStore.getState().loadEnvironments(file.environments, file.activeEnvironmentName);
        useExecutionStore.getState().resetAll();
      }
    }
  }, []);

  const handleRunAll = useCallback(async () => {
    const state = useFlowStore.getState();
    if (state.nodes.length === 0) return;
    useExecutionStore.getState().resetAll();
    const variables = useEnvironmentStore.getState().getActiveVariables();
    await runFlow(state.nodes, state.edges, variables);
  }, []);

  const handleImportCurl = useCallback(() => setShowImportCurl(true), []);

  const handleEscape = useCallback(() => {
    useFlowStore.getState().setSelectedNodeId(null);
    setShowImportCurl(false);
  }, []);

  const shortcutHandlers = useMemo(() => ({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSave: handleSave,
    onOpen: handleOpen,
    onRunAll: handleRunAll,
    onImportCurl: handleImportCurl,
    onEscape: handleEscape,
  }), [handleUndo, handleRedo, handleSave, handleOpen, handleRunAll, handleImportCurl, handleEscape]);

  useKeyboardShortcuts(shortcutHandlers);

  // Show project selector if not in project mode and not standalone
  if (!isProjectMode && !standaloneMode) {
    return <ProjectSelector onStandalone={() => setStandaloneMode(true)} />;
  }

  return (
    <div className="h-full flex flex-col bg-canvas-bg">
      {showDraftBanner && !isProjectMode && (
        <div className="bg-method-put/20 border-b border-method-put/30 px-4 py-2 flex items-center gap-3 text-xs">
          <span className="text-canvas-text">Unsaved draft found from a previous session.</span>
          <button
            onClick={handleRestoreDraft}
            className="px-2.5 py-1 bg-method-put text-white rounded font-medium hover:bg-method-put/80"
          >
            Restore
          </button>
          <button
            onClick={handleDismissDraft}
            className="px-2.5 py-1 text-canvas-text/60 hover:text-canvas-text hover:bg-surface-hover rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      <Toolbar
        onShowLibrary={() => setView('library')}
        onShowDashboard={() => setView('dashboard')}
        showImportCurl={showImportCurl}
        onShowImportCurl={setShowImportCurl}
        isProjectMode={isProjectMode}
        showEndpointLibrary={showEndpointLibrary}
        onToggleEndpointLibrary={() => setShowEndpointLibrary((p) => !p)}
      />

      {view === 'dashboard' ? (
        <Dashboard onBack={() => setView('canvas')} onOpenFlow={() => setView('canvas')} />
      ) : view === 'library' ? (
        <FlowLibrary onOpenFlow={() => setView('canvas')} />
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          {showEndpointLibrary && isProjectMode && (
            <EndpointLibraryPanel onClose={() => setShowEndpointLibrary(false)} />
          )}
          <FlowCanvas />
          <InspectorPanel />
        </div>
      )}
    </div>
  );
}
