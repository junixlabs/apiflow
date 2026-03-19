import { useState, useEffect, useRef } from 'react';
import { useFlowStore } from '../../store/flowStore';
import { useExecutionStore } from '../../store/executionStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useHistoryStore } from '../../store/historyStore';
import { runFlow, initSteppingMode, runNextStep } from '../../engine/executor';
import { saveFlow, loadFlow } from '../../utils/fileIO';
import { exportToPng, exportToSvg } from '../../utils/canvasExport';
import { clearDraft } from '../../utils/autoSave';
import { useLibraryStore } from '../../store/libraryStore';
import { EnvironmentPanel } from '../environment/EnvironmentPanel';
import { ImportCurlModal } from './ImportCurlModal';
import { ShortcutHint } from '../shared/ShortcutHint';
import type { HttpMethod } from '../../types';

const ADD_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const METHOD_DOT_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-method-get',
  POST: 'bg-method-post',
  PUT: 'bg-method-put',
  DELETE: 'bg-method-delete',
  PATCH: 'bg-method-patch',
};

interface Props {
  onShowLibrary: () => void;
  showImportCurl: boolean;
  onShowImportCurl: (show: boolean) => void;
}

export function Toolbar({ onShowLibrary, showImportCurl, onShowImportCurl }: Props) {
  const [showEnv, setShowEnv] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRunMenu, setShowRunMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const runMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddMenu && !showRunMenu && !showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showAddMenu && addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
      if (showRunMenu && runMenuRef.current && !runMenuRef.current.contains(e.target as Node)) {
        setShowRunMenu(false);
      }
      if (showExportMenu && exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu, showRunMenu, showExportMenu]);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const addNode = useFlowStore((s) => s.addNode);
  const addAnnotation = useFlowStore((s) => s.addAnnotation);
  const addGroup = useFlowStore((s) => s.addGroup);
  const exportFlowFn = useFlowStore((s) => s.exportFlow);
  const loadFlowFn = useFlowStore((s) => s.loadFlow);
  const setClean = useFlowStore((s) => s.setClean);
  const isDirty = useFlowStore((s) => s.isDirty);
  const undoFlow = useFlowStore((s) => s.undo);
  const redoFlow = useFlowStore((s) => s.redo);

  const isFlowRunning = useExecutionStore((s) => s.isFlowRunning);
  const abort = useExecutionStore((s) => s.abort);
  const resetAll = useExecutionStore((s) => s.resetAll);
  const lastRunTime = useExecutionStore((s) => s.lastRunTime);
  const executionMode = useExecutionStore((s) => s.executionMode);
  const steppingLevels = useExecutionStore((s) => s.steppingLevels);
  const currentStepIndex = useExecutionStore((s) => s.currentStepIndex);
  const stopStepping = useExecutionStore((s) => s.stopStepping);

  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentName = useEnvironmentStore((s) => s.activeEnvironmentName);
  const getActiveVariables = useEnvironmentStore((s) => s.getActiveVariables);
  const loadEnvironments = useEnvironmentStore((s) => s.loadEnvironments);

  const pastLength = useHistoryStore((s) => s.past.length);
  const futureLength = useHistoryStore((s) => s.future.length);

  const handleRunAll = async () => {
    if (nodes.length === 0) return;
    resetAll();
    const variables = getActiveVariables();
    await runFlow(nodes, edges, variables);
  };

  const handleStepThrough = async () => {
    if (nodes.length === 0) return;
    resetAll();
    const variables = getActiveVariables();
    await initSteppingMode(nodes, edges, variables);
  };

  const handleNextStep = async () => {
    const variables = getActiveVariables();
    await runNextStep(nodes, variables);
  };

  const handleStopStepping = () => {
    stopStepping();
  };

  const handleSave = async () => {
    const data = exportFlowFn(environments, activeEnvironmentName);
    await saveFlow(data);
    setClean();
    clearDraft();
    // Also save to library
    useLibraryStore.getState().saveToLibrary(data);
  };

  const handleLoad = async () => {
    const file = await loadFlow();
    if (file) {
      loadFlowFn(file);
      loadEnvironments(file.environments, file.activeEnvironmentName);
      resetAll();
    }
  };

  const handleUndo = () => undoFlow();
  const handleRedo = () => redoFlow();

  const handleExportPng = async () => {
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (el) await exportToPng(el);
    setShowExportMenu(false);
  };

  const handleExportSvg = async () => {
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (el) await exportToSvg(el);
    setShowExportMenu(false);
  };

  const isStepping = executionMode === 'stepping' && steppingLevels;
  const stepTotal = steppingLevels?.length ?? 0;
  const isLastStep = steppingLevels ? currentStepIndex >= stepTotal - 1 : false;

  return (
    <>
      <div className="h-12 border-b border-canvas-border bg-surface flex items-center px-3 gap-2 shrink-0">
        {/* Home / Brand */}
        <button
          onClick={onShowLibrary}
          className="text-sm font-semibold text-primary mr-2 hover:text-primary/80"
          title="Flow Library"
        >
          API View
        </button>

        {/* File Ops */}
        <button
          onClick={handleLoad}
          className="px-2.5 py-1 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded"
        >
          Open
        </button>
        <button
          onClick={handleSave}
          className="px-2.5 py-1 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded flex items-center gap-1"
        >
          Save{isDirty ? ' *' : ''}
          <ShortcutHint shortcut="Ctrl+S" />
        </button>

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Add Node */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-2.5 py-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded"
          >
            + Add Node
          </button>
          {showAddMenu && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[120px]">
              {ADD_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    addNode(method);
                    setShowAddMenu(false);
                  }}
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs font-mono text-canvas-text hover:bg-surface-hover"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${METHOD_DOT_COLORS[method]}`} />
                  {method}
                </button>
              ))}
              <div className="border-t border-canvas-border" />
              <button
                onClick={() => {
                  addAnnotation();
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
              >
                Annotation
              </button>
              <button
                onClick={() => {
                  addGroup();
                  setShowAddMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
              >
                Group Frame
              </button>
            </div>
          )}
        </div>

        {/* Import cURL */}
        <button
          onClick={() => onShowImportCurl(true)}
          className="px-2.5 py-1 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded"
        >
          Import cURL
        </button>

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Undo/Redo */}
        <button
          onClick={handleUndo}
          disabled={pastLength === 0}
          className="px-2 py-1 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          &#x21A9;
        </button>
        <button
          onClick={handleRedo}
          disabled={futureLength === 0}
          className="px-2 py-1 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >
          &#x21AA;
        </button>

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Run / Step */}
        {isStepping ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleNextStep}
              disabled={isLastStep}
              className="px-3 py-1 text-xs bg-method-put text-white font-medium hover:bg-method-put/80 disabled:opacity-40 rounded"
            >
              Next Step ({currentStepIndex + 1}/{stepTotal})
            </button>
            <button
              onClick={handleStopStepping}
              className="px-2.5 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
            >
              Stop
            </button>
          </div>
        ) : isFlowRunning ? (
          <button
            onClick={abort}
            className="px-3 py-1 text-xs bg-method-delete/20 text-method-delete hover:bg-method-delete/30 rounded"
          >
            Stop
          </button>
        ) : (
          <div className="relative" ref={runMenuRef}>
            <div className="flex">
              <button
                onClick={handleRunAll}
                disabled={nodes.length === 0}
                className="px-3 py-1 text-xs bg-method-get text-white font-medium hover:bg-method-get/80 disabled:opacity-40 rounded-l"
              >
                Run All
              </button>
              <button
                onClick={() => setShowRunMenu(!showRunMenu)}
                disabled={nodes.length === 0}
                className="px-1.5 py-1 text-xs bg-method-get text-white hover:bg-method-get/80 disabled:opacity-40 rounded-r border-l border-white/20"
              >
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              </button>
            </div>
            {showRunMenu && (
              <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[130px]">
                <button
                  onClick={() => {
                    handleRunAll();
                    setShowRunMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
                >
                  Run All
                </button>
                <button
                  onClick={() => {
                    handleStepThrough();
                    setShowRunMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
                >
                  Step Through
                </button>
              </div>
            )}
          </div>
        )}

        {/* Export */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-2.5 py-1 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded"
          >
            Export
          </button>
          {showExportMenu && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[100px]">
              <button
                onClick={handleExportPng}
                className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
              >
                PNG
              </button>
              <button
                onClick={handleExportSvg}
                className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
              >
                SVG
              </button>
            </div>
          )}
        </div>

        {/* Env */}
        <button
          onClick={() => setShowEnv(true)}
          className="px-2.5 py-1 text-xs text-canvas-text/60 hover:text-canvas-text hover:bg-surface-hover rounded border border-canvas-border flex items-center gap-1"
        >
          <span>Env: {activeEnvironmentName}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-50">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </button>

        {/* Status Bar */}
        <div className="ml-auto flex items-center gap-3 text-xs text-canvas-text/40">
          <span>{nodes.filter((n) => n.type === 'apiNode').length} node{nodes.filter((n) => n.type === 'apiNode').length !== 1 ? 's' : ''}</span>
          {lastRunTime && (
            <span>
              Last run: {new Date(lastRunTime).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {showEnv && <EnvironmentPanel onClose={() => setShowEnv(false)} />}
      {showImportCurl && <ImportCurlModal onClose={() => onShowImportCurl(false)} />}
    </>
  );
}
