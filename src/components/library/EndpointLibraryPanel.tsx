import { useState, useEffect, useCallback } from 'react';
import { X, Trash2, Search, GripVertical } from 'lucide-react';
import { useEndpointLibraryStore } from '../../store/endpointLibraryStore';
import { useFlowStore } from '../../store/flowStore';
import type { EndpointLibraryEntry } from '../../types/library';
import type { HttpMethod } from '../../types';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-method-get text-white',
  POST: 'bg-method-post text-white',
  PUT: 'bg-method-put text-white',
  DELETE: 'bg-method-delete text-white',
  PATCH: 'bg-method-patch text-white',
};

interface Props {
  onClose: () => void;
}

export function EndpointLibraryPanel({ onClose }: Props) {
  const [search, setSearch] = useState('');
  const entries = useEndpointLibraryStore((s) => s.entries);
  const isLoaded = useEndpointLibraryStore((s) => s.isLoaded);
  const loadLibrary = useEndpointLibraryStore((s) => s.loadLibrary);
  const removeEntry = useEndpointLibraryStore((s) => s.removeEntry);
  const addNodeFromConfig = useFlowStore((s) => s.addNodeFromConfig);

  useEffect(() => {
    if (!isLoaded) {
      loadLibrary();
    }
  }, [isLoaded, loadLibrary]);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.label.toLowerCase().includes(q) ||
      e.config.url.toLowerCase().includes(q) ||
      e.config.method.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  // Group by method
  const grouped = filtered.reduce<Record<string, EndpointLibraryEntry[]>>((acc, entry) => {
    const method = entry.config.method;
    if (!acc[method]) acc[method] = [];
    acc[method].push(entry);
    return acc;
  }, {});

  const methodOrder: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const sortedMethods = methodOrder.filter((m) => grouped[m]?.length);

  const handleUse = useCallback(
    (entry: EndpointLibraryEntry) => {
      addNodeFromConfig(JSON.parse(JSON.stringify(entry.config)), entry.label);
    },
    [addNodeFromConfig]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await removeEntry(id);
    },
    [removeEntry]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: EndpointLibraryEntry) => {
      e.dataTransfer.setData(
        'application/api-view-endpoint',
        JSON.stringify({ config: entry.config, label: entry.label })
      );
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  return (
    <div className="w-60 h-full border-r border-canvas-border bg-surface flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-canvas-border">
        <span className="text-xs font-semibold text-canvas-text">Endpoint Library</span>
        <button
          onClick={onClose}
          className="p-0.5 text-canvas-text/40 hover:text-canvas-text/70 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-canvas-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-canvas-text/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter endpoints..."
            className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1 pl-6 text-xs text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-auto">
        {!isLoaded ? (
          <div className="px-3 py-4 text-xs text-canvas-text/40 text-center">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-canvas-text/40">No saved endpoints</p>
            <p className="text-xs text-canvas-text/25 mt-1">
              Save endpoints from the node menu
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-canvas-text/40 text-center">
            No matches
          </div>
        ) : (
          sortedMethods.map((method) => (
            <div key={method}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-canvas-text/40 uppercase tracking-wider bg-canvas-bg/50">
                {method}
              </div>
              {grouped[method].map((entry) => (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, entry)}
                  className="group px-2 py-1.5 border-b border-canvas-border/50 hover:bg-surface-hover cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="w-3 h-3 text-canvas-text/20 shrink-0" />
                    <span
                      className={`px-1 py-0.5 text-[9px] font-bold rounded shrink-0 ${METHOD_COLORS[entry.config.method as HttpMethod] || 'bg-canvas-text/20 text-canvas-text'}`}
                    >
                      {entry.config.method}
                    </span>
                    <span className="text-xs text-canvas-text truncate flex-1">
                      {entry.label}
                    </span>
                  </div>
                  <div className="ml-[18px] mt-0.5 text-[10px] text-canvas-text/30 truncate">
                    {entry.config.url || '(no url)'}
                  </div>
                  {/* Action row */}
                  <div className="ml-[18px] mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleUse(entry)}
                      className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary hover:bg-primary/30 rounded"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-0.5 text-method-delete/40 hover:text-method-delete rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
