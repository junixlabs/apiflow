import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  onStandalone: () => void;
}

export function ProjectSelector({ onStandalone }: Props) {
  const [dir, setDir] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isLoading = useProjectStore((s) => s.isLoading);
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const openProject = useProjectStore((s) => s.openProject);

  const handleOpen = async () => {
    if (!dir.trim()) return;
    setError(null);
    try {
      await openProject(dir.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project');
    }
  };

  const handleOpenRecent = async (recentDir: string) => {
    setError(null);
    try {
      await openProject(recentDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOpen();
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-canvas-bg">
      <div className="w-full max-w-md bg-surface border border-canvas-border rounded-lg p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-canvas-text mb-1">API View</h1>
        <p className="text-sm text-canvas-text/40 mb-6">Open a project to get started</p>

        <div className="space-y-3">
          <input
            type="text"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="/path/to/project"
            disabled={isLoading}
            className="w-full bg-canvas-bg border border-canvas-border rounded px-3 py-2 text-sm text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none disabled:opacity-50"
          />

          <button
            onClick={handleOpen}
            disabled={isLoading || !dir.trim()}
            className="w-full px-3 py-2 text-sm bg-primary text-white font-medium hover:bg-primary/80 disabled:opacity-40 rounded"
          >
            {isLoading ? 'Opening...' : 'Open Project'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-method-delete/10 border border-method-delete/20 rounded text-xs text-method-delete">
            {error}
          </div>
        )}

        {recentProjects.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-medium text-canvas-text/50 mb-2">Recent Projects</h2>
            <div className="space-y-1">
              {recentProjects.map((project) => (
                <button
                  key={project.dir}
                  onClick={() => handleOpenRecent(project.dir)}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 text-sm text-canvas-text hover:bg-surface-hover rounded transition-colors disabled:opacity-50"
                >
                  <div className="font-medium truncate">{project.name}</div>
                  <div className="text-xs text-canvas-text/30 truncate">{project.dir}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-canvas-border">
          <button
            onClick={onStandalone}
            disabled={isLoading}
            className="w-full px-3 py-2 text-xs text-canvas-text/40 hover:text-canvas-text hover:bg-surface-hover rounded transition-colors disabled:opacity-50"
          >
            Continue without project
          </button>
        </div>
      </div>
    </div>
  );
}
