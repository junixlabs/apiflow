import { useState, useCallback, useRef, useEffect } from 'react';
import { useEnvironmentStore } from '../store/environmentStore';
import { useExecutionStore } from '../store/executionStore';
import { useFlowStore } from '../store/flowStore';

interface Suggestion {
  label: string;
  value: string;
  type: 'env' | 'node';
}

interface AutocompleteState {
  showDropdown: boolean;
  query: string;
  suggestions: Suggestion[];
  selectedIndex: number;
  position: { top: number; left: number };
}

export function useVariableAutocomplete(
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
) {
  const [state, setState] = useState<AutocompleteState>({
    showDropdown: false,
    query: '',
    suggestions: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  });

  const matchStartRef = useRef<number>(0);
  const dropdownRef = useRef<boolean>(false);

  // Keep ref in sync so the document listener can check it
  dropdownRef.current = state.showDropdown;

  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentName = useEnvironmentStore((s) => s.activeEnvironmentName);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const nodes = useFlowStore((s) => s.nodes);

  const buildSuggestions = useCallback(
    (query: string): Suggestion[] => {
      const suggestions: Suggestion[] = [];
      const lowerQuery = query.toLowerCase();

      // Built-in variables
      const builtins: Suggestion[] = [
        { label: '$timestamp', value: '{{$timestamp}}', type: 'env' as const },
        { label: '$isoTimestamp', value: '{{$isoTimestamp}}', type: 'env' as const },
        { label: '$uuid', value: '{{$uuid}}', type: 'env' as const },
        { label: '$randomInt', value: '{{$randomInt}}', type: 'env' as const },
      ];
      for (const b of builtins) {
        if (b.label.toLowerCase().includes(lowerQuery) || lowerQuery === '' || lowerQuery.startsWith('$')) {
          suggestions.push(b);
        }
      }

      // Env variables
      const activeEnv = environments.find((e) => e.name === activeEnvironmentName);
      if (activeEnv) {
        for (const v of activeEnv.variables) {
          if (v.enabled && v.key) {
            if (v.key.toLowerCase().includes(lowerQuery) || lowerQuery === '') {
              suggestions.push({ label: v.key, value: `{{${v.key}}}`, type: 'env' });
            }
          }
        }
      }

      // Node response paths (depth up to 3 levels deep)
      for (const node of nodes) {
        if (node.type !== 'apiNode') continue;
        const result = nodeResults.get(node.id);
        if (!result) continue;

        const prefix = `nodes["${node.data.label}"].response`;
        addPaths(suggestions, result, prefix, node.data.label, lowerQuery, 0, 3);
      }

      return suggestions.slice(0, 15);
    },
    [environments, activeEnvironmentName, nodeResults, nodes]
  );

  const handleInput = useCallback(
    (value: string, cursorPos: number) => {
      // Look backwards from cursor to find {{
      const before = value.slice(0, cursorPos);
      const openIdx = before.lastIndexOf('{{');
      if (openIdx === -1) {
        setState((s) => ({ ...s, showDropdown: false }));
        return;
      }
      // Check if there's a closing }} between {{ and cursor
      const between = before.slice(openIdx);
      if (between.includes('}}')) {
        setState((s) => ({ ...s, showDropdown: false }));
        return;
      }

      const query = before.slice(openIdx + 2);
      matchStartRef.current = openIdx;
      const suggestions = buildSuggestions(query);

      if (suggestions.length === 0) {
        setState((s) => ({ ...s, showDropdown: false }));
        return;
      }

      // Calculate position relative to input
      const el = inputRef.current;
      let top = 0;
      let left = 0;
      if (el) {
        const rect = el.getBoundingClientRect();
        top = rect.bottom + 2;
        left = rect.left;
      }

      setState({
        showDropdown: true,
        query,
        suggestions,
        selectedIndex: 0,
        position: { top, left },
      });
    },
    [buildSuggestions, inputRef]
  );

  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      const el = inputRef.current;
      if (!el) return;

      const value = el.value;
      const start = matchStartRef.current;
      const cursorPos = el.selectionStart ?? value.length;
      const newValue = value.slice(0, start) + suggestion.value + value.slice(cursorPos);

      // Dispatch native input event to trigger React onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, newValue);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      setState((s) => ({ ...s, showDropdown: false }));
      el.focus();
    },
    [inputRef]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!state.showDropdown) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState((s) => ({
          ...s,
          selectedIndex: Math.min(s.selectedIndex + 1, s.suggestions.length - 1),
        }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState((s) => ({
          ...s,
          selectedIndex: Math.max(s.selectedIndex - 1, 0),
        }));
      } else if (e.key === 'Enter' && state.showDropdown) {
        e.preventDefault();
        handleSelect(state.suggestions[state.selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setState((s) => ({ ...s, showDropdown: false }));
      }
    },
    [state.showDropdown, state.selectedIndex, state.suggestions, handleSelect]
  );

  // Close dropdown when clicking outside — use setTimeout so click on dropdown
  // items can fire before the dropdown is removed from DOM
  useEffect(() => {
    if (!state.showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      // Don't close if clicking inside the dropdown (portal)
      const target = e.target as HTMLElement;
      if (target.closest('[data-autocomplete-dropdown]')) return;
      setState((s) => ({ ...s, showDropdown: false }));
    };
    // Use capture phase with slight delay to let onMouseDown preventDefault work
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [state.showDropdown]);

  return {
    showDropdown: state.showDropdown,
    query: state.query,
    position: state.position,
    suggestions: state.suggestions,
    selectedIndex: state.selectedIndex,
    handleInput,
    handleSelect,
    handleKeyDown,
  };
}

function addPaths(
  suggestions: Suggestion[],
  obj: unknown,
  prefix: string,
  nodeLabel: string,
  query: string,
  depth: number,
  maxDepth: number
) {
  if (depth > maxDepth || obj == null || typeof obj !== 'object') return;

  const entries = Object.entries(obj as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (key === 'nodeId' || key === 'resolvedRequest') continue;
    const path = `${prefix}.${key}`;
    const fullVar = `{{${path}}}`;

    if (path.toLowerCase().includes(query) || key.toLowerCase().includes(query)) {
      suggestions.push({ label: path, value: fullVar, type: 'node' });
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      addPaths(suggestions, value, path, nodeLabel, query, depth + 1, maxDepth);
    }
  }
}
