import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowStore } from '../../store/flowStore';
import { ApiNode } from './ApiNode';
import { AnnotationNode } from './AnnotationNode';
import { GroupNode } from './GroupNode';
import { ConditionNode } from './ConditionNode';
import { LoopNode } from './LoopNode';
import { ConnectionLine } from './ConnectionLine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  apiNode: ApiNode as any,
  annotationNode: AnnotationNode as any,
  groupNode: GroupNode as any,
  conditionNode: ConditionNode as any,
  loopNode: LoopNode as any,
};

const edgeTypes: EdgeTypes = {
  default: ConnectionLine,
};

export function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);
  const pushHistory = useFlowStore((s) => s.pushHistory);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleNodeDragStop = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/api-view-endpoint');
    if (!data) return;
    try {
      const entry = JSON.parse(data);
      // Use approximate drop position
      const bounds = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      const store = useFlowStore.getState();
      store.pushHistory();
      const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newNode = {
        id,
        type: 'apiNode' as const,
        position: { x: Math.max(50, x - 100), y: Math.max(50, y - 30) },
        data: { label: entry.label, config: entry.config },
      };
      store.addNodes([newNode], []);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="flex-1 h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        deleteKeyCode="Delete"
        className="bg-canvas-bg"
        defaultEdgeOptions={{ type: 'default' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'annotationNode') return '#94a3b8';
            if (node.type === 'groupNode') return '#334155';
            if (node.type === 'conditionNode') return '#eab308';
            if (node.type === 'loopNode') return '#a855f7';
            return '#3b82f6';
          }}
          maskColor="rgba(0,0,0,0.1)"
          className="!bg-surface !border-canvas-border"
        />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-1">
            <p className="text-canvas-text/40 text-sm font-medium">No nodes yet</p>
            <p className="text-canvas-text/25 text-xs">Use "+ Add Node" in the toolbar to begin</p>
          </div>
        </div>
      )}
    </div>
  );
}
