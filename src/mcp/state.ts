import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CoreApiNode,
  CoreFlowEdge,
  ExecutionResult,
  ExecutionCallbacks,
  Environment,
  ApiNodeConfig,
  ApiNodeData,
  ApiViewFile,
  ApiViewFileV2,
  NodeStatus,
  Assertion,
  AssertionResult,
  ProjectConfig,
} from '../core/types.ts';
import { generateNodeId, generateEdgeId } from '../core/idGenerator.ts';

export class McpState {
  nodes: CoreApiNode[] = [];
  edges: CoreFlowEdge[] = [];
  metadata = {
    name: 'Untitled Flow',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  nodeResults = new Map<string, ExecutionResult>();
  nodeStatuses = new Map<string, NodeStatus>();

  environments: Environment[] = [
    { name: 'Default', variables: [{ key: '', value: '', enabled: true }] },
  ];
  activeEnvironmentName = 'Default';

  nodeAssertions = new Map<string, Assertion[]>();
  nodeAssertionResults = new Map<string, AssertionResult[]>();

  // Project mode
  projectDir: string | null = null;
  projectConfig: ProjectConfig | null = null;
  activeFlowName: string | null = null;

  getCallbacks(): ExecutionCallbacks {
    return {
      onNodeStatusChange: (nodeId: string, status: NodeStatus) => {
        this.nodeStatuses.set(nodeId, status);
      },
      onNodeResult: (nodeId: string, result: ExecutionResult) => {
        this.nodeResults.set(nodeId, result);
      },
      getAssertions: (nodeId: string) => {
        return this.nodeAssertions.get(nodeId) ?? [];
      },
      onAssertionResults: (nodeId: string, results: AssertionResult[]) => {
        this.nodeAssertionResults.set(nodeId, results);
      },
    };
  }

  getActiveVariables(): Record<string, string> {
    const env = this.environments.find(
      (e) => e.name === this.activeEnvironmentName
    );
    if (!env) return {};
    const vars: Record<string, string> = {};
    for (const v of env.variables) {
      if (v.enabled && v.key) {
        vars[v.key] = v.value;
      }
    }
    return vars;
  }

  addNode(config: ApiNodeConfig, label?: string): CoreApiNode {
    const id = generateNodeId();
    const nodeLabel =
      label ?? `${config.method} ${config.url || 'New Request'}`;
    const node: CoreApiNode = {
      id,
      type: 'apiNode',
      position: { x: 200, y: this.nodes.length * 200 },
      data: {
        label: nodeLabel,
        config,
      },
    };
    this.nodes.push(node);
    return node;
  }

  updateNode(nodeId: string, patch: Partial<ApiNodeData>): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);
    if (patch.label !== undefined) node.data.label = patch.label;
    if (patch.config !== undefined) {
      node.data.config = { ...node.data.config, ...patch.config };
    }
    if (patch.description !== undefined)
      node.data.description = patch.description;
    this.metadata.updatedAt = new Date().toISOString();
  }

  deleteNode(nodeId: string): void {
    const idx = this.nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) throw new Error(`Node not found: ${nodeId}`);
    this.nodes.splice(idx, 1);
    this.edges = this.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId
    );
    this.nodeResults.delete(nodeId);
    this.nodeStatuses.delete(nodeId);
    this.nodeAssertions.delete(nodeId);
    this.nodeAssertionResults.delete(nodeId);
    this.metadata.updatedAt = new Date().toISOString();
  }

  connectNodes(sourceId: string, targetId: string): CoreFlowEdge {
    const sourceExists = this.nodes.some((n) => n.id === sourceId);
    const targetExists = this.nodes.some((n) => n.id === targetId);
    if (!sourceExists) throw new Error(`Source node not found: ${sourceId}`);
    if (!targetExists) throw new Error(`Target node not found: ${targetId}`);
    const edge: CoreFlowEdge = {
      id: generateEdgeId(sourceId, targetId),
      source: sourceId,
      target: targetId,
    };
    this.edges.push(edge);
    this.metadata.updatedAt = new Date().toISOString();
    return edge;
  }

  toApiViewFile(): ApiViewFile {
    return {
      version: 1,
      metadata: { ...this.metadata },
      nodes: this.nodes,
      edges: this.edges,
      environments: this.environments,
      activeEnvironmentName: this.activeEnvironmentName,
    };
  }

  loadFromApiViewFile(file: ApiViewFile): void {
    this.nodes = file.nodes;
    this.edges = file.edges;
    this.metadata = { ...file.metadata };
    this.environments = file.environments;
    this.activeEnvironmentName = file.activeEnvironmentName;
    this.resetResults();
  }

  loadFromFile(filePath: string): void {
    if (this.projectDir) {
      // In project mode, load from .apiview/flows/
      const flowPath = path.join(this.projectDir, '.apiview', 'flows', filePath);
      if (fs.existsSync(flowPath)) {
        const content = fs.readFileSync(flowPath, 'utf-8');
        const file = JSON.parse(content);
        this.loadFromAnyFile(file);
        this.activeFlowName = filePath;
        return;
      }
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const file = JSON.parse(content) as ApiViewFile;
    this.loadFromApiViewFile(file);
  }

  saveToFile(filePath: string): void {
    this.metadata.updatedAt = new Date().toISOString();
    if (this.projectDir) {
      // In project mode, save to .apiview/flows/
      const flowsDir = path.join(this.projectDir, '.apiview', 'flows');
      if (!fs.existsSync(flowsDir)) {
        fs.mkdirSync(flowsDir, { recursive: true });
      }
      const flowPath = path.join(flowsDir, filePath);
      const v2File = this.toApiViewFileV2();
      fs.writeFileSync(flowPath, JSON.stringify(v2File, null, 2), 'utf-8');
      this.activeFlowName = filePath;
      return;
    }
    const file = this.toApiViewFile();
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf-8');
  }

  resetResults(): void {
    this.nodeResults.clear();
    this.nodeStatuses.clear();
    this.nodeAssertionResults.clear();
  }

  // Project mode methods

  openProjectDir(dir: string): void {
    this.projectDir = dir;
    this.projectConfig = null;
    this.activeFlowName = null;

    const base = path.join(dir, '.apiview');

    // Create .apiview directory structure if it doesn't exist
    if (!fs.existsSync(base)) {
      fs.mkdirSync(base, { recursive: true });
    }
    const flowsDir = path.join(base, 'flows');
    if (!fs.existsSync(flowsDir)) {
      fs.mkdirSync(flowsDir, { recursive: true });
    }

    // Load config
    const configPath = path.join(base, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        this.projectConfig = JSON.parse(content) as ProjectConfig;
      } catch {
        // Invalid config, use default
      }
    }

    if (!this.projectConfig) {
      this.projectConfig = {
        name: path.basename(dir),
        activeEnvironment: 'Default',
        defaultTimeout: 30000,
      };
      fs.writeFileSync(configPath, JSON.stringify(this.projectConfig, null, 2), 'utf-8');
    }

    // Load environments
    const envsDir = path.join(base, 'environments');
    if (fs.existsSync(envsDir)) {
      const envFiles = fs.readdirSync(envsDir).filter((f) => f.endsWith('.json'));
      if (envFiles.length > 0) {
        this.environments = [];
        for (const envFile of envFiles) {
          try {
            const content = fs.readFileSync(path.join(envsDir, envFile), 'utf-8');
            const env = JSON.parse(content) as Environment;
            this.environments.push(env);
          } catch {
            // Skip invalid env files
          }
        }
        if (this.environments.length === 0) {
          this.environments = [{ name: 'Default', variables: [{ key: '', value: '', enabled: true }] }];
        }
        this.activeEnvironmentName = this.projectConfig.activeEnvironment || this.environments[0].name;
      }
    }
  }

  listProjectFlows(): { name: string; fileName: string }[] {
    if (!this.projectDir) return [];
    const flowsDir = path.join(this.projectDir, '.apiview', 'flows');
    if (!fs.existsSync(flowsDir)) return [];

    const files = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.apiview'));
    return files.map((fileName) => {
      try {
        const content = fs.readFileSync(path.join(flowsDir, fileName), 'utf-8');
        const data = JSON.parse(content);
        return { name: data.metadata?.name || fileName, fileName };
      } catch {
        return { name: fileName, fileName };
      }
    });
  }

  saveCurrentFlow(): void {
    if (!this.projectDir || !this.activeFlowName) return;
    this.saveToFile(this.activeFlowName);
  }

  toApiViewFileV2(): ApiViewFileV2 {
    const assertions: Record<string, Assertion[]> = {};
    this.nodeAssertions.forEach((list, nodeId) => {
      if (list.length > 0) {
        assertions[nodeId] = list;
      }
    });
    return {
      version: 2,
      metadata: { ...this.metadata, updatedAt: new Date().toISOString() },
      nodes: this.nodes,
      edges: this.edges,
      assertions,
    };
  }

  private loadFromAnyFile(file: ApiViewFile | ApiViewFileV2): void {
    this.nodes = file.nodes;
    this.edges = file.edges;
    this.metadata = { ...file.metadata };
    if (file.version === 1) {
      const v1 = file as ApiViewFile;
      this.environments = v1.environments;
      this.activeEnvironmentName = v1.activeEnvironmentName;
    }
    if (file.version === 2) {
      const v2 = file as ApiViewFileV2;
      if (v2.assertions) {
        this.nodeAssertions.clear();
        for (const [nodeId, list] of Object.entries(v2.assertions)) {
          this.nodeAssertions.set(nodeId, list);
        }
      }
    }
    this.resetResults();
  }
}
