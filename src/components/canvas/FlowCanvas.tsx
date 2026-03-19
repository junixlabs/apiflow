import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowStore } from '../../store/flowStore';
import { ApiNode } from './ApiNode';
import { AnnotationNode } from './AnnotationNode';
import { GroupNode } from './GroupNode';
import { ConnectionLine } from './ConnectionLine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  apiNode: ApiNode as any,
  annotationNode: AnnotationNode as any,
  groupNode: GroupNode as any,
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

  return (
    <div className="flex-1 h-full">
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
