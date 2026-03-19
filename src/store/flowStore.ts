import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import type { ApiNode, FlowEdge, ApiNodeData, ApiNodeConfig, HttpMethod, ApiViewFile } from '../types';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { useHistoryStore } from './historyStore';

interface FlowState {
  nodes: ApiNode[];
  edges: FlowEdge[];
  metadata: { name: string; createdAt: string; updatedAt: string };
  selectedNodeId: string | null;
  isDirty: boolean;

  onNodesChange: OnNodesChange<ApiNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;

  addNode: (method?: HttpMethod) => void;
  addNodeFromConfig: (config: ApiNodeConfig, label?: string) => void;
  addAnnotation: () => void;
  addGroup: () => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<ApiNodeData>) => void;
  setSelectedNodeId: (id: string | null) => void;
  deleteEdge: (edgeId: string) => void;
  exportFlow: (environments: ApiViewFile['environments'], activeEnvironmentName: string) => ApiViewFile;
  loadFlow: (file: ApiViewFile) => void;
  setClean: () => void;
  pushHistory: () => void;
  restoreSnapshot: (nodes: ApiNode[], edges: FlowEdge[]) => void;
  undo: () => void;
  redo: () => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  metadata: {
    name: 'Untitled Flow',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  selectedNodeId: null,
  isDirty: false,

  pushHistory: () => {
    const { nodes, edges } = get();
    useHistoryStore.getState().pushState({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
  },

  restoreSnapshot: (nodes, edges) => {
    set({ nodes, edges, isDirty: true });
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    get().pushHistory();
    const edgeId = generateEdgeId(connection.source!, connection.target!);
    set((state) => ({
      edges: addEdge({ ...connection, id: edgeId }, state.edges),
      isDirty: true,
    }));
  },

  addNode: (method = 'GET') => {
    get().pushHistory();
    const id = generateNodeId();
    const nodeCount = get().nodes.length;
    const newNode: ApiNode = {
      id,
      type: 'apiNode',
      position: { x: 200 + nodeCount * 280, y: 150 },
      data: {
        label: `${method} Request`,
        config: {
          method,
          url: '',
          headers: [{ key: '', value: '', enabled: true }],
          params: [],
          body: '',
        },
      },
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
    }));
  },

  addNodeFromConfig: (config, label) => {
    get().pushHistory();
    const id = generateNodeId();
    const nodeCount = get().nodes.length;
    const newNode: ApiNode = {
      id,
      type: 'apiNode',
      position: { x: 200 + nodeCount * 280, y: 150 },
      data: {
        label: label ?? `${config.method} Request`,
        config,
      },
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
    }));
  },

  addAnnotation: () => {
    get().pushHistory();
    const id = generateNodeId();
    const nodeCount = get().nodes.length;
    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id,
          type: 'annotationNode',
          position: { x: 100 + nodeCount * 50, y: 50 },
          data: { label: 'Annotation text' } as unknown as ApiNodeData,
        },
      ],
      isDirty: true,
    }));
  },

  addGroup: () => {
    get().pushHistory();
    const id = generateNodeId();
    const nodeCount = get().nodes.length;
    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id,
          type: 'groupNode',
          position: { x: 100 + nodeCount * 50, y: 80 },
          data: { label: 'Group', width: 400, height: 250 } as unknown as ApiNodeData,
          style: { width: 400, height: 250, zIndex: -1 },
        },
      ],
      isDirty: true,
    }));
  },

  deleteNode: (nodeId) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
      isDirty: true,
    }));
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  deleteEdge: (edgeId) => {
    get().pushHistory();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
      isDirty: true,
    }));
  },

  exportFlow: (environments, activeEnvironmentName) => {
    const state = get();
    return {
      version: 1 as const,
      metadata: { ...state.metadata, updatedAt: new Date().toISOString() },
      nodes: state.nodes,
      edges: state.edges,
      environments,
      activeEnvironmentName,
    };
  },

  loadFlow: (file) => {
    useHistoryStore.getState().clear();
    set({
      nodes: file.nodes,
      edges: file.edges,
      metadata: file.metadata,
      selectedNodeId: null,
      isDirty: false,
    });
  },

  setClean: () => set({ isDirty: false }),

  undo: () => {
    const { nodes, edges } = get();
    const snapshot = useHistoryStore.getState().undo({ nodes, edges });
    if (snapshot) {
      set({ nodes: snapshot.nodes, edges: snapshot.edges, isDirty: true });
    }
  },

  redo: () => {
    const { nodes, edges } = get();
    const snapshot = useHistoryStore.getState().redo({ nodes, edges });
    if (snapshot) {
      set({ nodes: snapshot.nodes, edges: snapshot.edges, isDirty: true });
    }
  },
}));
