import { useRef, useMemo, useCallback, useState } from 'react';
import type { ApiNodeData, HttpMethod } from '../../types';
import { KeyValueEditor } from './KeyValueEditor';
import { useVariableAutocomplete } from '../../hooks/useVariableAutocomplete';
import { VariableAutocomplete } from '../shared/VariableAutocomplete';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const METHOD_SELECT_COLORS: Record<HttpMethod, string> = {
  GET: 'text-method-get border-method-get/40',
  POST: 'text-method-post border-method-post/40',
  PUT: 'text-method-put border-method-put/40',
  DELETE: 'text-method-delete border-method-delete/40',
  PATCH: 'text-method-patch border-method-patch/40',
};

interface Props {
  data: ApiNodeData;
  onChange: (data: Partial<ApiNodeData>) => void;
}

export function ConfigTab({ data, onChange }: Props) {
  const { config } = data;
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const urlAutocomplete = useVariableAutocomplete(urlRef);
  const bodyAutocomplete = useVariableAutocomplete(bodyRef);

  const updateConfig = (patch: Partial<typeof config>) => {
    onChange({
      config: { ...config, ...patch },
      label: patch.method ? `${patch.method} Request` : data.label,
    });
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Label
        </label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
          placeholder="Request name"
        />
      </div>

      {/* Description / Notes */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Description / Notes
        </label>
        <textarea
          value={data.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Add notes about this request..."
          rows={2}
          className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none resize-y"
        />
      </div>

      {/* Method + URL */}
      <div className="flex gap-2 relative">
        <select
          value={config.method}
          onChange={(e) => updateConfig({ method: e.target.value as HttpMethod })}
          className={`bg-canvas-bg border rounded px-2 py-1.5 text-sm font-mono font-medium focus:outline-none ${METHOD_SELECT_COLORS[config.method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          ref={urlRef}
          type="text"
          value={config.url}
          onChange={(e) => {
            updateConfig({ url: e.target.value });
            urlAutocomplete.handleInput(e.target.value, e.target.selectionStart ?? 0);
          }}
          onKeyDown={urlAutocomplete.handleKeyDown}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 bg-canvas-bg border border-canvas-border rounded px-2 py-1.5 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
        />
        <VariableAutocomplete
          show={urlAutocomplete.showDropdown}
          suggestions={urlAutocomplete.suggestions}
          selectedIndex={urlAutocomplete.selectedIndex}
          position={urlAutocomplete.position}
          onSelect={urlAutocomplete.handleSelect}
        />
      </div>
      <p className="text-[10px] text-canvas-text/30 -mt-2">
        Use {'{{nodes["Name"].response.body.path}}'} to reference other nodes
      </p>

      {/* Headers */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Headers
        </label>
        <KeyValueEditor
          pairs={config.headers}
          onChange={(headers) => updateConfig({ headers })}
        />
      </div>

      {/* Params */}
      <div>
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide mb-1.5 block">
          Query Params
        </label>
        <KeyValueEditor
          pairs={config.params}
          onChange={(params) => updateConfig({ params })}
          keyPlaceholder="Param"
        />
      </div>

      {/* Body */}
      {config.method !== 'GET' && (
        <BodyEditor
          value={config.body}
          onChange={(body) => updateConfig({ body })}
          bodyRef={bodyRef}
          bodyAutocomplete={bodyAutocomplete}
        />
      )}
    </div>
  );
}

// --- Body Editor with JSON format + validation ---

type JsonStatus = 'valid' | 'invalid' | 'empty' | 'has-vars';

function getJsonStatus(text: string): { status: JsonStatus; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { status: 'empty' };
  // If it contains {{...}} variables, skip strict validation
  if (/\{\{.+?\}\}/.test(trimmed)) return { status: 'has-vars' };
  try {
    JSON.parse(trimmed);
    return { status: 'valid' };
  } catch (e) {
    return { status: 'invalid', error: (e as Error).message.replace(/^JSON\.parse:\s*/, '') };
  }
}

// Unique prefix to avoid collision with actual JSON content
const PH_PREFIX = `__APIVIEW_PH_${Math.random().toString(36).slice(2, 8)}_`;

function formatJson(text: string): string | null {
  // Preserve {{variables}} by temporarily replacing them
  const vars: string[] = [];
  const placeholder = (i: number) => `"${PH_PREFIX}${i}__"`;
  const withPlaceholders = text.replace(/\{\{.+?\}\}/g, (match) => {
    vars.push(match);
    return placeholder(vars.length - 1);
  });

  try {
    const parsed = JSON.parse(withPlaceholders);
    let formatted = JSON.stringify(parsed, null, 2);
    // Restore {{variables}}
    vars.forEach((v, i) => {
      formatted = formatted.replace(placeholder(i), v);
    });
    return formatted;
  } catch {
    return null;
  }
}

interface BodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  bodyAutocomplete: ReturnType<typeof useVariableAutocomplete>;
}

function BodyEditor({ value, onChange, bodyRef, bodyAutocomplete }: BodyEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const { status, error } = useMemo(() => getJsonStatus(value), [value]);

  const handleFormat = useCallback(() => {
    const result = formatJson(value);
    if (result !== null) onChange(result);
  }, [value, onChange]);

  const handleMinify = useCallback(() => {
    const vars: string[] = [];
    const ph = (i: number) => `"${PH_PREFIX}${i}__"`;
    const withPh = value.replace(/\{\{.+?\}\}/g, (match) => {
      vars.push(match);
      return ph(vars.length - 1);
    });
    try {
      const parsed = JSON.parse(withPh);
      let minified = JSON.stringify(parsed);
      vars.forEach((v, i) => {
        minified = minified.replace(ph(i), v);
      });
      onChange(minified);
    } catch { /* ignore */ }
  }, [value, onChange]);

  const canFormat = status === 'valid' || status === 'has-vars';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 2 spaces instead of moving focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = value.slice(0, start) + '  ' + value.slice(end);
      onChange(newValue);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
      return;
    }
    bodyAutocomplete.handleKeyDown(e);
  };

  return (
    <div className="relative">
      {/* Label row with actions */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-canvas-text/60 uppercase tracking-wide">
          Body
        </label>
        <div className="flex items-center gap-1">
          {/* JSON status indicator */}
          {status === 'valid' && (
            <span className="text-[10px] text-method-get/70">JSON</span>
          )}
          {status === 'has-vars' && (
            <span className="text-[10px] text-method-put/70">JSON+vars</span>
          )}
          {status === 'invalid' && (
            <span className="text-[10px] text-method-delete/70" title={error}>Invalid</span>
          )}

          {/* Format button */}
          <button
            onClick={handleFormat}
            disabled={!canFormat}
            className="px-1.5 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded disabled:opacity-30 disabled:cursor-default"
            title="Format JSON (pretty-print)"
          >
            Format
          </button>
          <button
            onClick={handleMinify}
            disabled={!canFormat}
            className="px-1.5 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded disabled:opacity-30 disabled:cursor-default"
            title="Minify JSON (single line)"
          >
            Minify
          </button>
          <button
            onClick={() => setExpanded(true)}
            className="px-1.5 py-0.5 text-[10px] text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded"
            title="Expand editor"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="inline">
              <path d="M1 3.5V1h2.5M6.5 1H9v2.5M9 6.5V9H6.5M3.5 9H1V6.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={bodyRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          bodyAutocomplete.handleInput(e.target.value, e.target.selectionStart ?? 0);
        }}
        onKeyDown={handleKeyDown}
        placeholder='{"key": "value"}'
        rows={8}
        spellCheck={false}
        className={`w-full bg-canvas-bg border rounded px-3 py-2 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:outline-none resize-y leading-5 ${
          status === 'invalid'
            ? 'border-method-delete/40 focus:border-method-delete/60'
            : 'border-canvas-border focus:border-primary'
        }`}
      />

      {/* Error detail */}
      {status === 'invalid' && error && (
        <p className="text-[10px] text-method-delete/60 mt-1 truncate" title={error}>
          {error}
        </p>
      )}

      <VariableAutocomplete
        show={bodyAutocomplete.showDropdown}
        suggestions={bodyAutocomplete.suggestions}
        selectedIndex={bodyAutocomplete.selectedIndex}
        position={bodyAutocomplete.position}
        onSelect={bodyAutocomplete.handleSelect}
      />

      {/* Expanded modal */}
      {expanded && (
        <ExpandedBodyModal
          value={value}
          onChange={onChange}
          status={status}
          error={error}
          canFormat={canFormat}
          onFormat={handleFormat}
          onMinify={handleMinify}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

// --- Expanded body editor modal ---

function ExpandedBodyModal({
  value,
  onChange,
  status,
  error,
  canFormat,
  onFormat,
  onMinify,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  status: JsonStatus;
  error?: string;
  canFormat: boolean;
  onFormat: () => void;
  onMinify: () => void;
  onClose: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);
  const lineCount = (value.match(/\n/g) || []).length + 1;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = value.slice(0, start) + '  ' + value.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const syncScroll = () => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-canvas-border rounded-lg shadow-2xl flex flex-col"
        style={{ width: '80vw', maxWidth: 900, height: '75vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-canvas-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-canvas-text">Body Editor</span>
            {status === 'valid' && <span className="text-[10px] text-method-get/70">JSON</span>}
            {status === 'has-vars' && <span className="text-[10px] text-method-put/70">JSON+vars</span>}
            {status === 'invalid' && <span className="text-[10px] text-method-delete/70" title={error}>Invalid JSON</span>}
            <span className="text-[10px] text-canvas-text/30">{lineCount} lines</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onFormat}
              disabled={!canFormat}
              className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover rounded disabled:opacity-30"
            >
              Format
            </button>
            <button
              onClick={onMinify}
              disabled={!canFormat}
              className="px-2 py-1 text-xs text-canvas-text/50 hover:text-canvas-text hover:bg-surface-hover rounded disabled:opacity-30"
            >
              Minify
            </button>
            <div className="w-px h-4 bg-canvas-border mx-1" />
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs text-canvas-text/40 hover:text-canvas-text hover:bg-surface-hover rounded"
            >
              Done
            </button>
          </div>
        </div>

        {/* Editor with line numbers */}
        <div className="flex-1 p-3 overflow-hidden flex flex-col">
          <div className={`flex-1 flex bg-canvas-bg border rounded overflow-hidden ${
            status === 'invalid'
              ? 'border-method-delete/40'
              : 'border-canvas-border'
          }`}>
            {/* Line numbers gutter */}
            <div
              ref={lineCountRef}
              className="shrink-0 py-3 pr-2 text-right select-none overflow-hidden bg-canvas-bg border-r border-canvas-border/50"
              style={{ width: 44 }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="text-[11px] font-mono leading-5 text-canvas-text/20 px-2">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              placeholder='{"key": "value"}'
              spellCheck={false}
              autoFocus
              className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-canvas-text placeholder:text-canvas-text/30 focus:outline-none resize-none leading-5"
            />
          </div>
          {status === 'invalid' && error && (
            <p className="text-[10px] text-method-delete/60 mt-1.5 truncate shrink-0" title={error}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
