import { useState, useCallback, useRef, useEffect } from 'react';
import { useFlowStore } from '../../store/flowStore';
import { useExecutionStore } from '../../store/executionStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { runSingleNode } from '../../engine/executor';
import { ConfigTab } from './ConfigTab';
import { RequestTab } from './RequestTab';
import { ResponseTab } from './ResponseTab';
import type { ApiNodeData } from '../../types';

type Tab = 'config' | 'request' | 'response';

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'config', label: 'Config' },
    { key: 'request', label: 'Request' },
    { key: 'response', label: 'Response' },
  ];

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
            onClick={() => deleteNode(selectedNode.id)}
            className="px-2 py-1 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-canvas-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-canvas-text/50 hover:text-canvas-text/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'config' && (
          <ConfigTab data={selectedNode.data} onChange={handleChange} />
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
      </div>
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
