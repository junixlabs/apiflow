import type { ExecutionResult } from '../../types';

interface Props {
  resultA: ExecutionResult | null;
  resultB: ExecutionResult | null;
}

type DiffEntry = {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue?: string;
  newValue?: string;
};

function flattenObject(obj: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj == null || typeof obj !== 'object') {
    result[prefix || '(root)'] = String(obj);
    return result;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const key = prefix ? `${prefix}[${i}]` : `[${i}]`;
      Object.assign(result, flattenObject(item, key));
    });
    if (obj.length === 0) {
      result[prefix || '(root)'] = '[]';
    }
    return result;
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) {
    result[prefix || '(root)'] = '{}';
    return result;
  }
  for (const [k, v] of entries) {
    const key = prefix ? `${prefix}.${k}` : k;
    Object.assign(result, flattenObject(v, key));
  }
  return result;
}

function diffObjects(a: unknown, b: unknown): DiffEntry[] {
  const flatA = flattenObject(a);
  const flatB = flattenObject(b);
  const allKeys = new Set([...Object.keys(flatA), ...Object.keys(flatB)]);
  const entries: DiffEntry[] = [];

  for (const key of Array.from(allKeys).sort()) {
    const inA = key in flatA;
    const inB = key in flatB;
    if (inA && inB) {
      if (flatA[key] === flatB[key]) {
        entries.push({ key, type: 'unchanged', newValue: flatB[key] });
      } else {
        entries.push({ key, type: 'changed', oldValue: flatA[key], newValue: flatB[key] });
      }
    } else if (inA) {
      entries.push({ key, type: 'removed', oldValue: flatA[key] });
    } else {
      entries.push({ key, type: 'added', newValue: flatB[key] });
    }
  }
  return entries;
}

function diffHeaders(a: Record<string, string>, b: Record<string, string>): DiffEntry[] {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const entries: DiffEntry[] = [];
  for (const key of Array.from(allKeys).sort()) {
    const inA = key in a;
    const inB = key in b;
    if (inA && inB) {
      if (a[key] === b[key]) {
        entries.push({ key, type: 'unchanged', newValue: b[key] });
      } else {
        entries.push({ key, type: 'changed', oldValue: a[key], newValue: b[key] });
      }
    } else if (inA) {
      entries.push({ key, type: 'removed', oldValue: a[key] });
    } else {
      entries.push({ key, type: 'added', newValue: b[key] });
    }
  }
  return entries;
}

function DiffEntryRow({ entry }: { entry: DiffEntry }) {
  switch (entry.type) {
    case 'added':
      return (
        <div className="flex gap-2 text-method-get">
          <span className="font-medium">+</span>
          <span>{entry.key}:</span>
          <span>{entry.newValue}</span>
        </div>
      );
    case 'removed':
      return (
        <div className="flex gap-2 text-method-delete line-through">
          <span className="font-medium">-</span>
          <span>{entry.key}:</span>
          <span>{entry.oldValue}</span>
        </div>
      );
    case 'changed':
      return (
        <div className="flex gap-2">
          <span className="font-medium text-method-put">~</span>
          <span className="text-canvas-text">{entry.key}:</span>
          <span className="bg-method-put/10 text-method-put px-1 rounded">
            <span className="line-through opacity-60">{entry.oldValue}</span>
            {' \u2192 '}
            <span>{entry.newValue}</span>
          </span>
        </div>
      );
    case 'unchanged':
      return (
        <div className="flex gap-2 text-canvas-text/50">
          <span className="font-medium">&nbsp;</span>
          <span>{entry.key}:</span>
          <span>{entry.newValue}</span>
        </div>
      );
  }
}

export function DiffViewer({ resultA, resultB }: Props) {
  if (!resultA && !resultB) {
    return <p className="text-canvas-text/40 text-xs text-center py-4">No results to compare</p>;
  }
  if (!resultA || !resultB) {
    return <p className="text-canvas-text/40 text-xs text-center py-4">Need two results to compare</p>;
  }

  const headerDiff = diffHeaders(resultA.headers, resultB.headers);
  const bodyDiff = diffObjects(resultA.body, resultB.body);
  const statusChanged = resultA.status !== resultB.status;

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Status comparison */}
      <div>
        <div className="text-[10px] text-canvas-text/60 uppercase tracking-wide mb-1">Status</div>
        <div className={`flex gap-2 items-center ${statusChanged ? 'text-method-put' : 'text-canvas-text/50'}`}>
          <span>{resultA.status} {resultA.statusText}</span>
          <span>{'\u2192'}</span>
          <span>{resultB.status} {resultB.statusText}</span>
          {statusChanged && <span className="text-[10px] bg-method-put/10 px-1 rounded">changed</span>}
        </div>
      </div>

      {/* Duration comparison */}
      <div>
        <div className="text-[10px] text-canvas-text/60 uppercase tracking-wide mb-1">Duration</div>
        <div className="flex gap-2 items-center text-canvas-text/50">
          <span>{resultA.duration_ms}ms</span>
          <span>{'\u2192'}</span>
          <span>{resultB.duration_ms}ms</span>
          <span className="text-[10px]">
            ({resultB.duration_ms - resultA.duration_ms > 0 ? '+' : ''}{resultB.duration_ms - resultA.duration_ms}ms)
          </span>
        </div>
      </div>

      {/* Headers diff */}
      <div>
        <div className="text-[10px] text-canvas-text/60 uppercase tracking-wide mb-1">Headers</div>
        <div className="bg-canvas-bg border border-canvas-border rounded p-2 space-y-0.5 max-h-40 overflow-auto">
          {headerDiff.length === 0 && (
            <span className="text-canvas-text/30">No headers</span>
          )}
          {headerDiff.map((entry) => (
            <DiffEntryRow key={entry.key} entry={entry} />
          ))}
        </div>
      </div>

      {/* Body diff */}
      <div>
        <div className="text-[10px] text-canvas-text/60 uppercase tracking-wide mb-1">Body</div>
        <div className="bg-canvas-bg border border-canvas-border rounded p-2 space-y-0.5 max-h-60 overflow-auto">
          {bodyDiff.length === 0 && (
            <span className="text-canvas-text/30">No body</span>
          )}
          {bodyDiff.map((entry) => (
            <DiffEntryRow key={entry.key} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
