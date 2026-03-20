import { useRef, useEffect } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { DiffViewer } from './DiffViewer';
import type { ExecutionResult } from '../../types';

interface Props {
  nodeId: string;
}

export function DiffTab({ nodeId }: Props) {
  const currentResult = useExecutionStore((s) => s.nodeResults.get(nodeId)) ?? null;
  const previousResultRef = useRef<ExecutionResult | null>(null);
  const lastResultRef = useRef<ExecutionResult | null>(null);

  useEffect(() => {
    if (currentResult && currentResult !== lastResultRef.current) {
      previousResultRef.current = lastResultRef.current;
      lastResultRef.current = currentResult;
    }
  }, [currentResult]);

  const previousResult = previousResultRef.current;

  if (!currentResult) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
        <p className="text-canvas-text/50 text-sm">No results yet</p>
        <p className="text-canvas-text/30 text-xs">
          Run this node at least twice to compare results
        </p>
      </div>
    );
  }

  if (!previousResult) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
        <p className="text-canvas-text/50 text-sm">Only one result available</p>
        <p className="text-canvas-text/30 text-xs">
          Run this node again to compare with the previous result
        </p>
      </div>
    );
  }

  return <DiffViewer resultA={previousResult} resultB={currentResult} />;
}
