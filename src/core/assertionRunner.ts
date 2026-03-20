import type { Assertion, AssertionResult, ExecutionResult } from './types';

function getValueByPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.').flatMap((part) => {
    const match = part.match(/^(.+?)\[(\d+)\]$/);
    if (match) return [match[1], Number(match[2])];
    return [part];
  });

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[String(part)];
  }
  return current;
}

function runAssertion(assertion: Assertion, result: ExecutionResult): AssertionResult {
  switch (assertion.type) {
    case 'status_equals': {
      const expectedStatus = parseInt(assertion.expected, 10);
      const passed = result.status === expectedStatus;
      return {
        assertionId: assertion.id,
        passed,
        actual: String(result.status),
        message: passed
          ? `Status ${result.status} equals ${expectedStatus}`
          : `Expected status ${expectedStatus}, got ${result.status}`,
      };
    }

    case 'body_contains': {
      const bodyStr = JSON.stringify(result.body);
      const passed = bodyStr.includes(assertion.expected);
      return {
        assertionId: assertion.id,
        passed,
        actual: passed ? 'Found' : 'Not found',
        message: passed
          ? `Body contains "${assertion.expected}"`
          : `Body does not contain "${assertion.expected}"`,
      };
    }

    case 'jsonpath_match': {
      const value = getValueByPath(result.body, assertion.target);
      const actual = value === undefined ? 'undefined' : JSON.stringify(value);
      const passed = actual === assertion.expected || String(value) === assertion.expected;
      return {
        assertionId: assertion.id,
        passed,
        actual,
        message: passed
          ? `${assertion.target} equals ${assertion.expected}`
          : `Expected ${assertion.target} to be ${assertion.expected}, got ${actual}`,
      };
    }

    case 'header_exists': {
      const headerKey = assertion.target.toLowerCase();
      const headerEntry = Object.entries(result.headers).find(
        ([k]) => k.toLowerCase() === headerKey
      );
      const exists = headerEntry !== undefined;
      const valueMatches = assertion.expected
        ? exists && headerEntry![1] === assertion.expected
        : exists;
      const passed = assertion.expected ? valueMatches : exists;
      const actual = exists ? headerEntry![1] : 'Not present';
      return {
        assertionId: assertion.id,
        passed,
        actual,
        message: passed
          ? assertion.expected
            ? `Header "${assertion.target}" equals "${assertion.expected}"`
            : `Header "${assertion.target}" exists`
          : assertion.expected
            ? `Expected header "${assertion.target}" to be "${assertion.expected}", got "${actual}"`
            : `Header "${assertion.target}" does not exist`,
      };
    }
  }
}

export function runAssertions(assertions: Assertion[], result: ExecutionResult): AssertionResult[] {
  return assertions
    .filter((a) => a.enabled)
    .map((a) => runAssertion(a, result));
}
