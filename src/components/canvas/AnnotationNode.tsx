import { memo, useState, useCallback } from 'react';
import { useFlowStore } from '../../store/flowStore';

interface AnnotationNodeProps {
  id: string;
  data: { label: string; fontSize?: number; color?: string };
  selected?: boolean;
}

export const AnnotationNode = memo(function AnnotationNode({
  id,
  data,
  selected,
}: AnnotationNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsEditing(false);
      updateNodeData(id, { label: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setIsEditing(false);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Ctrl/Cmd+Enter to save (plain Enter adds newlines in textarea)
        (e.target as HTMLTextAreaElement).blur();
      }
    },
    []
  );

  const fontSize = data.fontSize ?? 14;
  const color = data.color ?? '#94a3b8';

  return (
    <div
      className={`px-3 py-2 rounded ${selected ? 'ring-2 ring-primary/50' : ''}`}
      style={{ minWidth: 120, maxWidth: 300 }}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          defaultValue={data.label}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full bg-transparent border border-canvas-border rounded px-1 py-0.5 focus:outline-none resize-none"
          style={{ fontSize, color }}
          rows={3}
        />
      ) : (
        <div
          className="whitespace-pre-wrap cursor-text select-none"
          style={{ fontSize, color }}
        >
          {data.label || 'Double-click to edit'}
        </div>
      )}
    </div>
  );
});
