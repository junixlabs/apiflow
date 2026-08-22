import { useHistoryResultStore } from '../../store/historyResultStore';
import { DiffViewer } from './DiffViewer';

interface Props {
  nodeId: string;
}

export function DiffTab({ nodeId }: Props) {
  // cm:why Reads the run history rather than remembering the previous result itself. Running from this
  // panel switches to the Response tab, which unmounts this component — so whatever it remembered was
  // thrown away exactly when the second result arrived, and the diff never appeared at all.
  // cm:edge contract -> src/store/historyResultStore.ts — newest result first, so [0] is the run just
  // finished and [1] is the one to compare it against.
  const [currentResult, previousResult] = useHistoryResultStore((s) => s.nodeHistory.get(nodeId)) ?? [];

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
