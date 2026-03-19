import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { FlowCanvas } from './components/canvas/FlowCanvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { FlowLibrary } from './components/library/FlowLibrary';
import { useFlowStore } from './store/flowStore';
import { useExecutionStore } from './store/executionStore';
import { useEnvironmentStore } from './store/environmentStore';
import { useLibraryStore } from './store/libraryStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { saveDraft, loadDraft, clearDraft } from './utils/autoSave';
import { saveFlow, loadFlow as loadFlowFile } from './utils/fileIO';
import { runFlow } from './engine/executor';

export default function App() {
  const [view, setView] = useState<'canvas' | 'library'>('canvas');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [showImportCurl, setShowImportCurl] = useState(false);
  const draftRef = useRef<ReturnType<typeof loadDraft>>(null);

  const isDirty = useFlowStore((s) => s.isDirty);

  // Check for draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.nodes.length > 0) {
      draftRef.current = draft;
      setShowDraftBanner(true);
    }
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (useFlowStore.getState().isDirty) {
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
    const state = useFlowStore.getState();
    const envState = useEnvironmentStore.getState();
    const data = state.exportFlow(envState.environments, envState.activeEnvironmentName);
    await saveFlow(data);
    state.setClean();
    clearDraft();
    useLibraryStore.getState().saveToLibrary(data);
  }, []);

  const handleOpen = useCallback(async () => {
    const file = await loadFlowFile();
    if (file) {
      useFlowStore.getState().loadFlow(file);
      useEnvironmentStore.getState().loadEnvironments(file.environments, file.activeEnvironmentName);
      useExecutionStore.getState().resetAll();
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

  return (
    <div className="h-full flex flex-col bg-canvas-bg">
      {showDraftBanner && (
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
        showImportCurl={showImportCurl}
        onShowImportCurl={setShowImportCurl}
      />

      {view === 'library' ? (
        <FlowLibrary onOpenFlow={() => setView('canvas')} />
      ) : (
        <div className="flex flex-1 overflow-hidden relative">
          <FlowCanvas />
          <InspectorPanel />
        </div>
      )}
    </div>
  );
}
