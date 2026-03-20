import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, Maximize2, ChevronRight, Plus, Minus, Search } from 'lucide-react';

type ViewMode = 'tree' | 'raw';

export function JsonTreeView({ data, defaultMode = 'raw' }: { data: unknown; defaultMode?: ViewMode }) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode);
  const [expandLevel, setExpandLevel] = useState(0);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  }, [data]);

  const rawText = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const lowerSearch = search.toLowerCase();
  const rawLines = useMemo(() => (rawText ?? '').split('\n'), [rawText]);

  const toolbar = (
    <div className="flex items-center gap-1 mb-2">
      <button
        onClick={() => setViewMode('tree')}
        className={`px-2 py-0.5 text-[10px] rounded ${
          viewMode === 'tree' ? 'bg-primary/20 text-primary' : 'text-canvas-text/40 hover:text-canvas-text/70'
        }`}
      >
        Tree
      </button>
      <button
        onClick={() => setViewMode('raw')}
        className={`px-2 py-0.5 text-[10px] rounded ${
          viewMode === 'raw' ? 'bg-primary/20 text-primary' : 'text-canvas-text/40 hover:text-canvas-text/70'
        }`}
      >
        Raw
      </button>

      <div className="ml-auto flex items-center gap-1">
        {viewMode === 'tree' && (
          <>
            <button
              onClick={() => setExpandLevel((p) => p + 1)}
              title="Expand all"
              className="px-1 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 rounded hover:bg-surface-hover"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => setExpandLevel((p) => p - 1)}
              title="Collapse all"
              className="px-1 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 rounded hover:bg-surface-hover"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
          </>
        )}
        <button
          onClick={() => setShowSearch(!showSearch)}
          title="Search"
          className={`px-1 py-0.5 text-[10px] rounded ${
            showSearch || search ? 'text-primary bg-primary/10' : 'text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover'
          }`}
        >
          <Search className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className="px-1.5 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 rounded hover:bg-surface-hover"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={() => setExpanded(true)}
          title="Expand view"
          className="px-1 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 rounded hover:bg-surface-hover"
        >
          <Maximize2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );

  const searchBar = showSearch && (
    <div className="mb-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter keys or values..."
        autoFocus
        className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1 text-xs font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
        onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setShowSearch(false); } }}
      />
    </div>
  );

  const content = viewMode === 'raw' ? (
    <RawView rawLines={rawLines} lowerSearch={lowerSearch} maxHeight="60vh" />
  ) : (
    <div className="font-mono text-xs overflow-auto max-h-[60vh] select-text leading-5">
      <JsonValue value={data} depth={0} expandLevel={expandLevel} path="$" search={lowerSearch} />
    </div>
  );

  return (
    <div>
      {toolbar}
      {searchBar}
      {content}

      {expanded && (
        <JsonViewerModal
          data={data}
          rawText={rawText}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

// --- Full-screen JSON viewer modal ---

function JsonViewerModal({
  data,
  rawText,
  onClose,
}: {
  data: unknown;
  rawText: string;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expandLevel, setExpandLevel] = useState(0);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const lowerSearch = search.toLowerCase();
  const rawLines = useMemo(() => (rawText ?? '').split('\n'), [rawText]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [rawText]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        tabIndex={-1}
        ref={(el) => el?.focus()}
        className="bg-surface border border-canvas-border rounded-lg shadow-2xl flex flex-col focus:outline-none"
        style={{ width: '85vw', maxWidth: 1000, height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-canvas-border shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-2.5 py-1 text-xs rounded ${
                viewMode === 'tree' ? 'bg-primary/20 text-primary' : 'text-canvas-text/50 hover:text-canvas-text'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 text-xs rounded ${
                viewMode === 'raw' ? 'bg-primary/20 text-primary' : 'text-canvas-text/50 hover:text-canvas-text'
              }`}
            >
              Raw
            </button>

            {viewMode === 'tree' && (
              <>
                <div className="w-px h-4 bg-canvas-border mx-1" />
                <button
                  onClick={() => setExpandLevel((p) => p + 1)}
                  className="px-1.5 py-1 text-xs text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover rounded"
                  title="Expand all"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setExpandLevel((p) => p - 1)}
                  className="px-1.5 py-1 text-xs text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover rounded"
                  title="Collapse all"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </>
            )}

            <div className="w-px h-4 bg-canvas-border mx-1" />
            <span className="text-[10px] text-canvas-text/30">{rawLines.length} lines</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`px-2 py-1 text-xs rounded ${
                showSearch || search ? 'text-primary bg-primary/10' : 'text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover'
              }`}
            >
              Search
            </button>
            <button
              onClick={handleCopy}
              className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover rounded"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <div className="w-px h-4 bg-canvas-border mx-1" />
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs text-canvas-text/40 hover:text-canvas-text hover:bg-surface-hover rounded"
            >
              Close
            </button>
          </div>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="px-4 py-2 border-b border-canvas-border shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter keys or values..."
              autoFocus
              className="w-full bg-canvas-bg border border-canvas-border rounded px-2.5 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setShowSearch(false); } }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'raw' ? (
            <RawView rawLines={rawLines} lowerSearch={lowerSearch} maxHeight="none" />
          ) : (
            <div className="font-mono text-sm select-text leading-6">
              <JsonValue value={data} depth={0} expandLevel={expandLevel} path="$" search={lowerSearch} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Shared raw view with line numbers ---

function RawView({ rawLines, lowerSearch, maxHeight }: { rawLines: string[]; lowerSearch: string; maxHeight: string }) {
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="font-mono text-xs leading-5 select-text w-full">
        <tbody>
          {rawLines.map((line, i) => {
            const highlighted = lowerSearch && line.toLowerCase().includes(lowerSearch);
            return (
              <tr key={i} className={highlighted ? 'bg-method-put/15' : ''}>
                <td className="text-canvas-text/20 text-right pr-3 select-none align-top w-8 shrink-0">{i + 1}</td>
                <td className="text-canvas-text whitespace-pre-wrap break-all">{line}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Copy path helper ---
async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
  } catch { /* ignore */ }
}

// --- Collapsed preview: show first N keys ---
function objectPreview(entries: [string, unknown][], max = 3): string {
  const keys = entries.slice(0, max).map(([k]) => k);
  const suffix = entries.length > max ? ', ...' : '';
  return '{ ' + keys.join(', ') + suffix + ' }';
}

function arrayPreview(items: unknown[], max = 3): string {
  const previews = items.slice(0, max).map((v) => {
    if (v === null) return 'null';
    if (typeof v === 'string') return v.length > 20 ? `"${v.slice(0, 20)}..."` : `"${v}"`;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return `[${v.length}]`;
    if (typeof v === 'object') return '{...}';
    return String(v);
  });
  const suffix = items.length > max ? ', ...' : '';
  return '[ ' + previews.join(', ') + suffix + ' ]';
}

// --- Check if a subtree matches the search ---
function matchesSearch(value: unknown, search: string): boolean {
  if (!search) return true;
  if (value === null || value === undefined) return 'null'.includes(search);
  if (typeof value === 'string') return value.toLowerCase().includes(search);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase().includes(search);
  if (Array.isArray(value)) return value.some((v) => matchesSearch(v, search));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => k.toLowerCase().includes(search) || matchesSearch(v, search)
    );
  }
  return false;
}

function JsonValue({
  value,
  depth,
  expandLevel,
  path,
  search,
}: {
  value: unknown;
  depth: number;
  expandLevel: number;
  path: string;
  search: string;
}) {
  const autoExpand = depth < 2;
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);

  const hasSearchMatch = search ? matchesSearch(value, search) : false;
  const forceExpand = search && hasSearchMatch;

  const isExpanded = forceExpand
    ? true
    : manualCollapsed !== null
      ? !manualCollapsed
      : expandLevel > 0
        ? true
        : expandLevel < 0
          ? false
          : autoExpand;

  const toggle = useCallback(() => {
    setManualCollapsed((prev) => (prev === null ? autoExpand : !prev));
  }, [autoExpand]);

  const [prevLevel, setPrevLevel] = useState(expandLevel);
  if (expandLevel !== prevLevel) {
    setPrevLevel(expandLevel);
    if (manualCollapsed !== null) setManualCollapsed(null);
  }

  const highlight = useCallback((text: string) => {
    if (!search) return text;
    const idx = text.toLowerCase().indexOf(search);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-method-put/30 text-inherit rounded-sm">{text.slice(idx, idx + search.length)}</mark>
        {text.slice(idx + search.length)}
      </>
    );
  }, [search]);

  if (value === null) return <span className="text-gray-500 italic">null</span>;
  if (value === undefined) return <span className="text-gray-500 italic">undefined</span>;
  if (typeof value === 'boolean')
    return <span className="text-method-post font-medium">{String(value)}</span>;
  if (typeof value === 'number')
    return <span className="text-method-patch">{value}</span>;
  if (typeof value === 'string') {
    if (value.length > 300) {
      return (
        <span className="text-method-get">
          "{highlight(value.slice(0, 300))}
          <span className="text-canvas-text/30">... ({value.length} chars)</span>"
        </span>
      );
    }
    return <span className="text-method-get">"{highlight(value)}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-canvas-text/50">[]</span>;
    if (!isExpanded) {
      return (
        <span>
          <Chevron collapsed onClick={toggle} />
          <span className="text-canvas-text/40 ml-0.5 text-[10px]" title={arrayPreview(value)}>
            Array[{value.length}]
          </span>
          <span className="text-canvas-text/25 ml-1 text-[10px]">{arrayPreview(value, 2)}</span>
        </span>
      );
    }
    return (
      <span>
        <Chevron collapsed={false} onClick={toggle} />
        <span className="text-canvas-text/40 ml-0.5 text-[10px]">Array[{value.length}]</span>
        <div className="ml-4 border-l border-canvas-border/30 pl-2">
          {value.map((item, i) => {
            if (search && !matchesSearch(item, search)) return null;
            const childPath = `${path}[${i}]`;
            return (
              <div key={i} className="flex group/row hover:bg-primary/5 rounded -ml-1 pl-1">
                <span className="text-canvas-text/30 mr-1.5 select-none shrink-0">{i}:</span>
                <span className="flex-1">
                  <JsonValue value={item} depth={depth + 1} expandLevel={expandLevel} path={childPath} search={search} />
                </span>
                <CopyPathButton path={childPath} />
              </div>
            );
          })}
        </div>
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-canvas-text/50">{'{}'}</span>;
    if (!isExpanded) {
      return (
        <span>
          <Chevron collapsed onClick={toggle} />
          <span className="text-canvas-text/40 ml-0.5 text-[10px]">{objectPreview(entries)}</span>
        </span>
      );
    }
    return (
      <span>
        <Chevron collapsed={false} onClick={toggle} />
        <span className="text-canvas-text/40 ml-0.5 text-[10px]">{'{' + entries.length + '}'}</span>
        <div className="ml-4 border-l border-canvas-border/30 pl-2">
          {entries.map(([k, v]) => {
            if (search && !k.toLowerCase().includes(search) && !matchesSearch(v, search)) return null;
            const childPath = `${path}.${k}`;
            return (
              <div key={k} className="flex group/row hover:bg-primary/5 rounded -ml-1 pl-1">
                <span className="text-primary shrink-0 mr-1">{highlight(k)}:</span>
                <span className="flex-1">
                  <JsonValue value={v} depth={depth + 1} expandLevel={expandLevel} path={childPath} search={search} />
                </span>
                <CopyPathButton path={childPath} />
              </div>
            );
          })}
        </div>
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copyPath(path);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      title={`Copy path: ${path}`}
      className="opacity-0 group-hover/row:opacity-100 ml-1 px-1 text-[9px] text-canvas-text/30 hover:text-primary shrink-0 transition-opacity"
    >
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  );
}

function Chevron({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-3.5 h-3.5 text-canvas-text/40 hover:text-canvas-text/80 select-none shrink-0 align-middle"
    >
      <ChevronRight className={`w-2.5 h-2.5 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
    </button>
  );
}
