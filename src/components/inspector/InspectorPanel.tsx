import { useState, useCallback, useRef, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { useFlowStore } from '../../store/flowStore';
import { useExecutionStore } from '../../store/executionStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useHistoryResultStore } from '../../store/historyResultStore';
import { useAssertionStore } from '../../store/assertionStore';
import { runSingleNode } from '../../engine/executor';
import { generateCurl } from '../../utils/curlExporter';
import { ConfigTab } from './ConfigTab';
import { ConditionConfigTab } from './ConditionConfigTab';
import { LoopConfigTab } from './LoopConfigTab';
import { RequestTab } from './RequestTab';
import { ResponseTab } from './ResponseTab';
import { DiffTab } from './DiffTab';
import { HistoryTab } from './HistoryTab';
import type { ApiNodeData } from '../../types';

type Tab = 'config' | 'request' | 'response' | 'diff' | 'history';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 420;
const WIDTH_KEY = 'apiview_inspector_width';

function loadWidth(): number {
  try {
    const saved = localStorage.getItem(WIDTH_KEY);
    if (saved) {
      const n = Number(saved);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

export function InspectorPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [width, setWidth] = useState(loadWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const dragStartRef = useRef<{ x: number; width: number } | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const getActiveVariables = useEnvironmentStore((s) => s.getActiveVariables);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, width };
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = dragStartRef.current.x - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartRef.current.width + delta));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist width
      if (dragStartRef.current) {
        try { localStorage.setItem(WIDTH_KEY, String(widthRef.current)); } catch { /* ignore */ }
      }
      dragStartRef.current = null;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div style={{ width }} className="shrink-0 border-l border-canvas-border bg-surface flex items-center justify-center relative">
        <ResizeHandle onMouseDown={handleMouseDown} isDragging={isDragging} />
        <p className="text-canvas-text/40 text-sm">Select a node to inspect</p>
      </div>
    );
  }

  // Condition node inspector
  if (selectedNode.type === 'conditionNode') {
    return (
      <div style={{ width }} className="shrink-0 border-l border-canvas-border bg-surface flex flex-col relative">
        <ResizeHandle onMouseDown={handleMouseDown} isDragging={isDragging} />
        <div className="flex items-center justify-between px-3 py-2 border-b border-canvas-border">
          <span className="text-sm font-medium truncate">{(selectedNode.data as Record<string, unknown>).label as string || 'Condition'}</span>
          <button
            onClick={() => deleteNode(selectedNode.id)}
            className="px-2 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
          >
            Delete
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <ConditionConfigTab nodeId={selectedNode.id} data={selectedNode.data as unknown as { label: string; sourceNodeLabel?: string; condition?: { fieldPath: string; operator: string; expected: string } }} />
        </div>
      </div>
    );
  }

  // Loop node inspector
  if (selectedNode.type === 'loopNode') {
    return (
      <div style={{ width }} className="shrink-0 border-l border-canvas-border bg-surface flex flex-col relative">
        <ResizeHandle onMouseDown={handleMouseDown} isDragging={isDragging} />
        <div className="flex items-center justify-between px-3 py-2 border-b border-canvas-border">
          <span className="text-sm font-medium truncate">{(selectedNode.data as Record<string, unknown>).label as string || 'Loop'}</span>
          <button
            onClick={() => deleteNode(selectedNode.id)}
            className="px-2 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
          >
            Delete
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <LoopConfigTab nodeId={selectedNode.id} data={selectedNode.data as unknown as { label: string; loopConfig?: { mode: string; pageParam: string; startPage: number; maxIterations: number } }} />
        </div>
      </div>
    );
  }

  if (selectedNode.type !== 'apiNode') {
    return (
      <div style={{ width }} className="shrink-0 border-l border-canvas-border bg-surface flex items-center justify-center relative">
        <ResizeHandle onMouseDown={handleMouseDown} isDragging={isDragging} />
        <p className="text-canvas-text/40 text-sm">Select an API node to inspect</p>
      </div>
    );
  }

  const result = nodeResults.get(selectedNode.id);
  const status = nodeStatuses.get(selectedNode.id) ?? 'idle';
  const isRunning = status === 'running';

  const handleRunNode = async () => {
    const variables = getActiveVariables();
    await runSingleNode(selectedNode, variables, undefined, nodeResults, nodes);
    setActiveTab('response');
  };

  const handleChange = (data: Partial<ApiNodeData>) => {
    updateNodeData(selectedNode.id, data);
  };

  const handleCopyCurl = async () => {
    const variables = getActiveVariables();
    const curl = generateCurl(selectedNode, variables, nodeResults, nodes);
    await navigator.clipboard.writeText(curl);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 1500);
  };

  return (
    <div style={{ width }} className="shrink-0 border-l border-canvas-border bg-surface flex flex-col relative">
      <ResizeHandle onMouseDown={handleMouseDown} isDragging={isDragging} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-canvas-border">
        <span className="text-sm font-medium truncate">{selectedNode.data.label}</span>
        <div className="flex gap-1.5">
          <button
            onClick={handleRunNode}
            disabled={isRunning || !selectedNode.data.config.url}
            className="px-2.5 py-1 text-xs bg-primary hover:bg-primary/80 disabled:opacity-40 text-white rounded"
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button
            onClick={handleCopyCurl}
            className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text/80 hover:bg-surface-hover rounded flex items-center gap-1"
            title="Copy as cURL"
          >
            <Copy className="w-3 h-3" />
            {curlCopied ? 'Copied' : 'cURL'}
          </button>
          <button
            onClick={() => deleteNode(selectedNode.id)}
            className="px-2 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs with badges */}
      <TabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nodeId={selectedNode.id}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'config' && (
          <ConfigTab data={selectedNode.data} onChange={handleChange} nodeId={selectedNode.id} />
        )}
        {activeTab === 'request' && result && <RequestTab result={result} />}
        {activeTab === 'request' && !result && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <p className="text-canvas-text/50 text-sm">No request data yet</p>
            <p className="text-canvas-text/30 text-xs">Click <span className="text-primary font-medium">Run</span> to execute this request</p>
          </div>
        )}
        {activeTab === 'response' && result && <ResponseTab result={result} />}
        {activeTab === 'response' && !result && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <p className="text-canvas-text/50 text-sm">No response yet</p>
            <p className="text-canvas-text/30 text-xs">Click <span className="text-primary font-medium">Run</span> to execute this request</p>
          </div>
        )}
        {activeTab === 'diff' && <DiffTab nodeId={selectedNode.id} />}
        {activeTab === 'history' && <HistoryTab nodeId={selectedNode.id} />}
      </div>
    </div>
  );
}

const EMPTY_ARRAY: never[] = [];

function TabBar({ activeTab, setActiveTab, nodeId }: { activeTab: Tab; setActiveTab: (t: Tab) => void; nodeId: string }) {
  const result = useExecutionStore((s) => s.nodeResults.get(nodeId));
  const historyEntries = useHistoryResultStore((s) => s.nodeHistory.get(nodeId)) ?? EMPTY_ARRAY;
  const assertions = useAssertionStore((s) => s.nodeAssertions.get(nodeId)) ?? EMPTY_ARRAY;

  const historyCount = historyEntries.length;
  const assertionCount = assertions.length;

  const tabs: { key: Tab; label: string; badge?: React.ReactNode }[] = [
    {
      key: 'config',
      label: 'Config',
      badge: assertionCount > 0 ? (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-mono ml-1">
          {assertionCount}
        </span>
      ) : undefined,
    },
    { key: 'request', label: 'Request' },
    {
      key: 'response',
      label: 'Response',
      badge: result ? (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ml-1 ${
          result.status >= 200 && result.status < 300
            ? 'bg-method-get/15 text-method-get'
            : result.status >= 400
              ? 'bg-method-delete/15 text-method-delete'
              : 'bg-method-post/15 text-method-post'
        }`}>
          {result.status}
        </span>
      ) : undefined,
    },
    {
      key: 'diff',
      label: 'Diff',
    },
    {
      key: 'history',
      label: 'History',
      badge: historyCount > 0 ? (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-canvas-text/10 text-canvas-text/50 font-mono ml-1">
          {historyCount}
        </span>
      ) : undefined,
    },
  ];

  return (
    <div className="flex border-b border-canvas-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors flex items-center justify-center ${
            activeTab === tab.key
              ? 'text-primary border-b-2 border-primary'
              : 'text-canvas-text/50 hover:text-canvas-text/80'
          }`}
        >
          {tab.label}
          {tab.badge}
        </button>
      ))}
    </div>
  );
}

function ResizeHandle({ onMouseDown, isDragging }: { onMouseDown: (e: React.MouseEvent) => void; isDragging: boolean }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group ${
        isDragging ? 'bg-primary/40' : 'hover:bg-primary/20'
      }`}
    >
      <div className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full transition-colors ${
        isDragging ? 'bg-primary' : 'bg-canvas-border group-hover:bg-primary/60'
      }`} />
    </div>
  );
}
