import type { ProxyRequest, ProxyResponse, ProxyErrorResponse } from '../types';

const PROXY_URL = 'http://localhost:3001/proxy';

export async function sendRequest(
  request: ProxyRequest,
  signal?: AbortSignal
): Promise<ProxyResponse | ProxyErrorResponse> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  return res.json();
}

export function isProxyError(
  response: ProxyResponse | ProxyErrorResponse
): response is ProxyErrorResponse {
  return 'error' in response;
}
