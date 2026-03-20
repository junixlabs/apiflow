import type { ProxyRequest, ProxyResponse, ProxyErrorResponse } from './types';

const PROXY_URL = 'http://localhost:3001/proxy';

// Proxy mode: POST to localhost:3001/proxy (for browser)
export async function sendRequestViaProxy(
  request: ProxyRequest,
  signal?: AbortSignal
): Promise<ProxyResponse | ProxyErrorResponse> {
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
    return res.json();
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort && signal?.aborted) {
      return { error: 'CANCELLED', message: 'Request was cancelled', duration_ms: 0 };
    }
    if (isAbort) {
      return { error: 'TIMEOUT', message: 'Request timeout — the server did not respond in time', duration_ms: 0 };
    }
    // Proxy server not running
    const message = err instanceof Error && err.message.includes('fetch')
      ? 'Cannot connect to proxy server — make sure `npm run dev` is running'
      : err instanceof Error ? err.message : 'Unknown error';
    return { error: 'PROXY_ERROR', message, duration_ms: 0 };
  }
}

// Direct mode: make HTTP request directly (for Node.js / MCP server)
export async function sendRequestDirect(
  request: ProxyRequest,
  signal?: AbortSignal
): Promise<ProxyResponse | ProxyErrorResponse> {
  const start = Date.now();
  // Combine external signal with timeout
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let effectiveSignal = signal;
  if (request.timeout && !signal) {
    controller = new AbortController();
    effectiveSignal = controller.signal;
    timeoutId = setTimeout(() => controller!.abort(), request.timeout);
  }
  try {
    const res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: effectiveSignal,
    });
    const bodyText = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return {
      status: res.status,
      statusText: res.statusText,
      headers,
      body,
      duration_ms: Date.now() - start,
      size_bytes: new TextEncoder().encode(bodyText).length,
    };
  } catch (err) {
    return {
      error: 'request_error',
      message: err instanceof Error ? (err.name === 'AbortError' && timeoutId ? `Timeout after ${request.timeout}ms` : err.message) : String(err),
      duration_ms: Date.now() - start,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Unified function type
export type SendRequestFn = (
  request: ProxyRequest,
  signal?: AbortSignal
) => Promise<ProxyResponse | ProxyErrorResponse>;

export function isProxyError(
  response: ProxyResponse | ProxyErrorResponse
): response is ProxyErrorResponse {
  return 'error' in response;
}
