import { useState, useEffect, useRef } from 'react';
import {
  Workflow, Save, FolderOpen, Plus, Undo2, Redo2, Play, ChevronDown,
  Download, Upload, Image, FileImage, FileJson, Terminal, Square, LayoutDashboard,
  BookOpen, GitBranch, Repeat,
} from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { useExecutionStore } from '../../store/executionStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useHistoryStore } from '../../store/historyStore';
import { runFlow, initSteppingMode, runNextStep } from '../../engine/executor';
import { saveFlow, loadFlow } from '../../utils/fileIO';
import { exportToPng, exportToSvg } from '../../utils/canvasExport';
import { clearDraft } from '../../utils/autoSave';
import { exportToPostmanCollection } from '../../utils/postmanExporter';
import { generateAllCurls } from '../../utils/curlExporter';
import { useLibraryStore } from '../../store/libraryStore';
import { useProjectStore } from '../../store/projectStore';
import { EnvironmentPanel } from '../environment/EnvironmentPanel';
import { ImportCurlModal } from './ImportCurlModal';
import { ImportCollectionModal } from './ImportCollectionModal';
import { EnvQuickSwitch } from './EnvQuickSwitch';
import { ThemeToggle } from './ThemeToggle';
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
  onShowDashboard: () => void;
  showImportCurl: boolean;
  onShowImportCurl: (show: boolean) => void;
  isProjectMode?: boolean;
  showEndpointLibrary?: boolean;
  onToggleEndpointLibrary?: () => void;
}

export function Toolbar({ onShowLibrary, onShowDashboard, showImportCurl, onShowImportCurl, isProjectMode, showEndpointLibrary, onToggleEndpointLibrary }: Props) {
  const [showEnv, setShowEnv] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRunMenu, setShowRunMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showImportCollection, setShowImportCollection] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const runMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAddMenu && !showRunMenu && !showExportMenu && !showImportMenu) return;
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
      if (showImportMenu && importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu, showRunMenu, showExportMenu, showImportMenu]);

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const addNode = useFlowStore((s) => s.addNode);
  const addAnnotation = useFlowStore((s) => s.addAnnotation);
  const addGroup = useFlowStore((s) => s.addGroup);
  const addConditionNode = useFlowStore((s) => s.addConditionNode);
  const addLoopNode = useFlowStore((s) => s.addLoopNode);
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
  const nodeResults = useExecutionStore((s) => s.nodeResults);

  const projectConfig = useProjectStore((s) => s.projectConfig);
  const activeFlowName = useProjectStore((s) => s.activeFlowName);

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
    if (isProjectMode) {
      await useProjectStore.getState().saveCurrentFlow();
    } else {
      const data = exportFlowFn(environments, activeEnvironmentName);
      await saveFlow(data);
      setClean();
      clearDraft();
      useLibraryStore.getState().saveToLibrary(data);
    }
  };

  const handleLoad = async () => {
    if (isProjectMode) {
      onShowLibrary();
    } else {
      const file = await loadFlow();
      if (file) {
        loadFlowFn(file);
        loadEnvironments(file.environments, file.activeEnvironmentName);
        resetAll();
      }
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

  const handleExportPostman = () => {
    const name = 'API View Collection';
    exportToPostmanCollection(nodes, edges, name, environments);
    setShowExportMenu(false);
  };

  const handleExportCurlAll = async () => {
    const variables = getActiveVariables();
    const curls = generateAllCurls(nodes, variables, nodeResults, nodes);
    await navigator.clipboard.writeText(curls);
    setShowExportMenu(false);
  };

  const isStepping = executionMode === 'stepping' && steppingLevels;
  const stepTotal = steppingLevels?.length ?? 0;
  const isLastStep = steppingLevels ? currentStepIndex >= stepTotal - 1 : false;

  const apiNodeCount = nodes.filter((n) => n.type === 'apiNode').length;

  return (
    <>
      <div className="h-12 border-b border-canvas-border bg-surface flex items-center px-3 gap-1 shrink-0">
        {/* Brand area */}
        <button
          onClick={onShowLibrary}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary mr-0.5 hover:text-primary/80 shrink-0"
          title="Flow Library"
        >
          <Workflow className="w-4 h-4" />
          API View
        </button>
        {isProjectMode && projectConfig && (
          <span className="text-xs text-canvas-text/40 mr-1 truncate max-w-[180px]">
            / {projectConfig.name} / {activeFlowName || 'No flow'}
          </span>
        )}
        <button
          onClick={onShowDashboard}
          className="p-1.5 text-canvas-text/30 hover:text-canvas-text/60 hover:bg-surface-hover rounded"
          title="Project Overview Dashboard"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
        </button>
        {isProjectMode && onToggleEndpointLibrary && (
          <button
            onClick={onToggleEndpointLibrary}
            className={`p-1.5 rounded ${showEndpointLibrary ? 'text-primary bg-primary/10' : 'text-canvas-text/30 hover:text-canvas-text/60 hover:bg-surface-hover'}`}
            title="Endpoint Library"
          >
            <BookOpen className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* File group */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text/80 hover:bg-surface-hover rounded flex items-center gap-1.5"
            title="Save"
          >
            <Save className="w-3.5 h-3.5" />
            Save{isDirty ? ' *' : ''}
            <ShortcutHint shortcut="Ctrl+S" />
          </button>
          <button
            onClick={handleLoad}
            className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text/80 hover:bg-surface-hover rounded flex items-center gap-1.5"
            title="Open"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open
          </button>
        </div>

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Edit group */}
        <div className="flex items-center gap-1">
          {/* Add Node */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-2.5 py-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Node
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
                <div className="border-t border-canvas-border" />
                <button
                  onClick={() => {
                    addConditionNode();
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <GitBranch className="w-3 h-3 text-method-put" />
                  Condition
                </button>
                <button
                  onClick={() => {
                    addLoopNode();
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <Repeat className="w-3 h-3 text-purple-400" />
                  Loop
                </button>
              </div>
            )}
          </div>

          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={pastLength === 0}
            className="p-1.5 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={futureLength === 0}
            className="p-1.5 text-xs text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Run group */}
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
              className="px-2.5 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          </div>
        ) : isFlowRunning ? (
          <button
            onClick={abort}
            className="px-3 py-1 text-xs bg-method-delete/20 text-method-delete hover:bg-method-delete/30 rounded flex items-center gap-1"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
        ) : (
          <div className="relative" ref={runMenuRef}>
            <div className="flex">
              <button
                onClick={handleRunAll}
                disabled={nodes.length === 0}
                className="px-3 py-1 text-xs bg-method-get text-white font-medium hover:bg-method-get/80 disabled:opacity-40 rounded-l flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                Run All
              </button>
              <button
                onClick={() => setShowRunMenu(!showRunMenu)}
                disabled={nodes.length === 0}
                className="px-1.5 py-1 text-xs bg-method-get text-white hover:bg-method-get/80 disabled:opacity-40 rounded-r border-l border-white/20"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            {showRunMenu && (
              <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[130px]">
                <button
                  onClick={() => { handleRunAll(); setShowRunMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
                >
                  Run All
                </button>
                <button
                  onClick={() => { handleStepThrough(); setShowRunMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover"
                >
                  Step Through
                </button>
              </div>
            )}
          </div>
        )}

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Import/Export group */}
        <div className="flex items-center gap-1">
          {/* Import dropdown */}
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text/80 hover:bg-surface-hover rounded flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Import
            </button>
            {showImportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[160px]">
                <button
                  onClick={() => { onShowImportCurl(true); setShowImportMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <Terminal className="w-3.5 h-3.5 text-canvas-text/40" />
                  cURL
                </button>
                <button
                  onClick={() => { setShowImportCollection(true); setShowImportMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5 text-canvas-text/40" />
                  OpenAPI / Postman
                </button>
              </div>
            )}
          </div>

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text/80 hover:bg-surface-hover rounded flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full left-0 mt-1 bg-surface border border-canvas-border rounded shadow-lg z-10 min-w-[160px]">
                <button
                  onClick={handleExportPng}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <Image className="w-3.5 h-3.5 text-canvas-text/40" />
                  PNG
                </button>
                <button
                  onClick={handleExportSvg}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <FileImage className="w-3.5 h-3.5 text-canvas-text/40" />
                  SVG
                </button>
                <div className="border-t border-canvas-border" />
                <button
                  onClick={handleExportPostman}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5 text-canvas-text/40" />
                  Postman Collection
                </button>
                <button
                  onClick={handleExportCurlAll}
                  className="w-full text-left px-3 py-1.5 text-xs text-canvas-text hover:bg-surface-hover flex items-center gap-2"
                >
                  <Terminal className="w-3.5 h-3.5 text-canvas-text/40" />
                  cURL (all)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-px h-5 bg-canvas-border mx-1" />

        {/* Env Quick Switch */}
        <EnvQuickSwitch onEdit={() => setShowEnv(true)} />

        {/* Right side: status + theme */}
        <div className="ml-auto flex items-center gap-3 text-xs text-canvas-text/40">
          <span>{apiNodeCount} node{apiNodeCount !== 1 ? 's' : ''}</span>
          {lastRunTime && (
            <span>Last run: {new Date(lastRunTime).toLocaleTimeString()}</span>
          )}
          <ThemeToggle />
        </div>
      </div>

      {showEnv && <EnvironmentPanel onClose={() => setShowEnv(false)} />}
      {showImportCurl && <ImportCurlModal onClose={() => onShowImportCurl(false)} />}
      {showImportCollection && <ImportCollectionModal onClose={() => setShowImportCollection(false)} />}
    </>
  );
}
