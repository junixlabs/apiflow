import { useState } from 'react';
import { Check, X, ChevronRight } from 'lucide-react';
import { useAssertionStore } from '../../store/assertionStore';
import type { Assertion, AssertionType } from '../../types';

const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: 'status_equals', label: 'Status Equals' },
  { value: 'body_contains', label: 'Body Contains' },
  { value: 'jsonpath_match', label: 'JSONPath Match' },
  { value: 'header_exists', label: 'Header Exists' },
];

const TARGET_PLACEHOLDERS: Record<AssertionType, string> = {
  status_equals: '',
  body_contains: '',
  jsonpath_match: 'data.id',
  header_exists: 'Content-Type',
};

const EXPECTED_PLACEHOLDERS: Record<AssertionType, string> = {
  status_equals: '200',
  body_contains: 'search text',
  jsonpath_match: 'expected value',
  header_exists: 'application/json (optional)',
};

interface Props {
  nodeId: string;
}

export function AssertionsSection({ nodeId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const assertions = useAssertionStore((s) => s.nodeAssertions.get(nodeId)) ?? [];
  const results = useAssertionStore((s) => s.nodeAssertionResults.get(nodeId));
  const setAssertions = useAssertionStore((s) => s.setAssertions);

  const updateAssertion = (index: number, patch: Partial<Assertion>) => {
    const updated = assertions.map((a, i) => (i === index ? { ...a, ...patch } : a));
    setAssertions(nodeId, updated);
  };

  const removeAssertion = (index: number) => {
    setAssertions(nodeId, assertions.filter((_, i) => i !== index));
  };

  const addAssertion = () => {
    const newAssertion: Assertion = {
      id: crypto.randomUUID(),
      type: 'status_equals',
      target: '',
      expected: '200',
      enabled: true,
    };
    setAssertions(nodeId, [...assertions, newAssertion]);
  };

  const getResultForAssertion = (assertionId: string) => {
    if (!results) return null;
    return results.find((r) => r.assertionId === assertionId) ?? null;
  };

  return (
    <div className="border border-canvas-border rounded">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-canvas-text/60 uppercase tracking-wide hover:bg-surface-hover rounded-t"
      >
        <span>Assertions ({assertions.length})</span>
        <ChevronRight className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-2">
          {assertions.map((assertion, index) => {
            const result = getResultForAssertion(assertion.id);
            return (
              <div key={assertion.id} className="space-y-1 p-2 bg-canvas-bg rounded border border-canvas-border/50">
                <div className="flex items-center gap-1.5">
                  {/* Enabled checkbox */}
                  <input
                    type="checkbox"
                    checked={assertion.enabled}
                    onChange={(e) => updateAssertion(index, { enabled: e.target.checked })}
                    className="shrink-0"
                  />

                  {/* Type dropdown */}
                  <select
                    value={assertion.type}
                    onChange={(e) => updateAssertion(index, { type: e.target.value as AssertionType })}
                    className="bg-canvas-bg border border-canvas-border rounded px-1.5 py-1 text-[11px] font-mono text-canvas-text focus:outline-none flex-1 min-w-0"
                  >
                    {ASSERTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  {/* Result indicator */}
                  {result && (
                    <span
                      className={`shrink-0 w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full ${
                        result.passed
                          ? 'bg-method-get/20 text-method-get'
                          : 'bg-method-delete/20 text-method-delete'
                      }`}
                      title={result.message}
                    >
                      {result.passed ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                    </span>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => removeAssertion(index)}
                    className="shrink-0 text-canvas-text/30 hover:text-method-delete leading-none px-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Target input (for jsonpath_match and header_exists) */}
                {(assertion.type === 'jsonpath_match' || assertion.type === 'header_exists') && (
                  <input
                    type="text"
                    value={assertion.target}
                    onChange={(e) => updateAssertion(index, { target: e.target.value })}
                    placeholder={TARGET_PLACEHOLDERS[assertion.type]}
                    className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1 text-[11px] font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
                  />
                )}

                {/* Expected input */}
                <input
                  type="text"
                  value={assertion.expected}
                  onChange={(e) => updateAssertion(index, { expected: e.target.value })}
                  placeholder={EXPECTED_PLACEHOLDERS[assertion.type]}
                  className="w-full bg-canvas-bg border border-canvas-border rounded px-2 py-1 text-[11px] font-mono text-canvas-text placeholder:text-canvas-text/30 focus:border-primary focus:outline-none"
                />

                {/* Result message */}
                {result && (
                  <p className={`text-[10px] truncate ${result.passed ? 'text-method-get/70' : 'text-method-delete/70'}`} title={result.message}>
                    {result.message}
                  </p>
                )}
              </div>
            );
          })}

          {/* Add button */}
          <button
            onClick={addAssertion}
            className="w-full py-1.5 text-[11px] text-canvas-text/40 hover:text-canvas-text/70 hover:bg-surface-hover rounded border border-dashed border-canvas-border"
          >
            + Add Assertion
          </button>
        </div>
      )}
    </div>
  );
}
