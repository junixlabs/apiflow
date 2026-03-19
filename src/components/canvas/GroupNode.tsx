import { memo, useState, useCallback } from 'react';
import { NodeResizer } from '@xyflow/react';
import { useFlowStore } from '../../store/flowStore';

interface GroupNodeProps {
  id: string;
  data: { label: string; color?: string; width: number; height: number };
  selected?: boolean;
}

export const GroupNode = memo(function GroupNode({
  id,
  data,
  selected,
}: GroupNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(false);
      updateNodeData(id, { label: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  const color = data.color ?? '#334155';

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineClassName="!border-primary/30"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-canvas-bg"
      />
      <div
        className="w-full h-full rounded-lg border-2 border-dashed"
        style={{
          borderColor: color,
          backgroundColor: color + '10',
        }}
        onDoubleClick={handleDoubleClick}
      >
        <div className="px-3 py-1.5">
          {isEditing ? (
            <input
              defaultValue={data.label}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              className="bg-transparent border-b border-canvas-border text-xs font-medium focus:outline-none w-full"
              style={{ color }}
            />
          ) : (
            <span
              className="text-xs font-medium select-none cursor-text"
              style={{ color }}
            >
              {data.label || 'Group'}
            </span>
          )}
        </div>
      </div>
    </>
  );
});
