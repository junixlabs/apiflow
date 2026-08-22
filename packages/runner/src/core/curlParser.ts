import type { ApiNodeConfig, HttpMethod, KeyValuePair } from './types';

// Flags that consume the next argument
const FLAGS_WITH_ARGS = new Set([
  '-X', '--request',
  '-H', '--header',
  '-d', '--data', '--data-raw', '--data-binary', '--data-urlencode',
  '-u', '--user',
  '-o', '--output',
  '-A', '--user-agent',
  '-e', '--referer',
  '-b', '--cookie',
  '-c', '--cookie-jar',
  '-T', '--upload-file',
  '--connect-timeout',
  '--max-time',
  '-m',
]);

function universalBtoa(str: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (typeof g.Buffer !== 'undefined') {
    return g.Buffer.from(str).toString('base64');
  }
  return btoa(str);
}

export function parseCurl(curlString: string): ApiNodeConfig {
  // Normalize multi-line continuations and trim
  const normalized = curlString
    .replace(/\\\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove leading 'curl' keyword
  const withoutCurl = normalized.replace(/^curl\s+/, '');

  const tokens = tokenize(withoutCurl);

  let method: HttpMethod = 'GET';
  let url = '';
  const headers: KeyValuePair[] = [];
  let body = '';

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      i++;
      if (i < tokens.length) {
        method = tokens[i].toUpperCase() as HttpMethod;
      }
    } else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const headerStr = tokens[i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          headers.push({
            key: headerStr.slice(0, colonIdx).trim(),
            value: headerStr.slice(colonIdx + 1).trim(),
            enabled: true,
          });
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      i++;
      if (i < tokens.length) {
        body = tokens[i];
        if (method === 'GET') method = 'POST';
      }
    } else if (token === '-u' || token === '--user') {
      i++;
      if (i < tokens.length) {
        const encoded = universalBtoa(tokens[i]);
        headers.push({
          key: 'Authorization',
          value: `Basic ${encoded}`,
          enabled: true,
        });
      }
    } else if (token.startsWith('-')) {
      // Unknown flag — skip its argument if it's a known arg-consuming flag
      if (FLAGS_WITH_ARGS.has(token)) {
        i++; // skip the argument
      }
      // Otherwise it's a boolean flag like --compressed, --insecure — just skip it
    } else if (!url) {
      url = token;
    }
    i++;
  }

  if (headers.length === 0) {
    headers.push({ key: '', value: '', enabled: true });
  }

  return {
    method,
    url,
    headers,
    params: [],
    body,
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && input[i] === ' ') i++;
    if (i >= input.length) break;

    const char = input[i];

    if (char === "'" || char === '"') {
      // Quoted string
      const quote = char;
      i++;
      let value = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && quote === '"') {
          i++;
          if (i < input.length) value += input[i];
        } else {
          value += input[i];
        }
        i++;
      }
      if (i < input.length) i++; // skip closing quote (only if found)
      tokens.push(value);
    } else {
      // Unquoted token
      let value = '';
      while (i < input.length && input[i] !== ' ') {
        value += input[i];
        i++;
      }
      tokens.push(value);
    }
  }

  return tokens;
}
