import { useState } from 'react';
import { useEnvironmentStore } from '../../store/environmentStore';
import { KeyValueEditor } from '../inspector/KeyValueEditor';

interface Props {
  onClose: () => void;
}

export function EnvironmentPanel({ onClose }: Props) {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentName = useEnvironmentStore((s) => s.activeEnvironmentName);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const addEnvironment = useEnvironmentStore((s) => s.addEnvironment);
  const deleteEnvironment = useEnvironmentStore((s) => s.deleteEnvironment);
  const updateVariables = useEnvironmentStore((s) => s.updateVariables);
  const [newEnvName, setNewEnvName] = useState('');

  const activeEnv = environments.find((e) => e.name === activeEnvironmentName);

  const handleAddEnv = () => {
    if (newEnvName.trim()) {
      addEnvironment(newEnvName.trim());
      setNewEnvName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-canvas-border rounded-lg w-[560px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-border">
          <h2 className="text-sm font-medium">Environment Variables</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-canvas-text/40 hover:text-canvas-text w-6 h-6 flex items-center justify-center rounded hover:bg-surface-hover"
          >
            &times;
          </button>
        </div>

        {/* Environment Selector */}
        <div className="px-4 py-3 border-b border-canvas-border space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-canvas-text/50 w-20 shrink-0">Active env</label>
            <select
              value={activeEnvironmentName}
              onChange={(e) => setActiveEnvironment(e.target.value)}
              className="flex-1 bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm text-canvas-text focus:border-primary focus:outline-none"
            >
              {environments.map((env) => (
                <option key={env.name} value={env.name}>
                  {env.name}
                </option>
              ))}
            </select>
            {environments.length > 1 && (
              <button
                onClick={() => deleteEnvironment(activeEnvironmentName)}
                className="px-2 py-1.5 text-xs text-method-delete/70 hover:text-method-delete hover:bg-method-delete/10 rounded"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-canvas-text/50 w-20 shrink-0">New env</label>
            <input
              type="text"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
              placeholder="Environment name"
              className="flex-1 bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleAddEnv}
              className="px-2.5 py-1.5 text-xs bg-primary hover:bg-primary/80 text-white rounded"
            >
              Add
            </button>
          </div>
        </div>

        {/* Variables */}
        <div className="flex-1 overflow-auto p-4">
          {activeEnv && (
            <KeyValueEditor
              pairs={activeEnv.variables}
              onChange={(vars) => updateVariables(activeEnvironmentName, vars)}
              keyPlaceholder="Variable name"
              valuePlaceholder="Value"
            />
          )}
        </div>

        <div className="px-4 py-2 border-t border-canvas-border text-xs text-canvas-text/40">
          Use {'{{variable_name}}'} in node URLs, headers, and body
        </div>
      </div>
    </div>
  );
}
