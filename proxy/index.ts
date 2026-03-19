import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/proxy', async (req, res) => {
  const { method, url, headers = {}, body, timeout = 30000 } = req.body;

  if (!url) {
    res.json({ error: 'MISSING_URL', message: 'URL is required', duration_ms: 0 });
    return;
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers,
      signal: controller.signal,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const duration_ms = Date.now() - start;
    const responseText = await response.text();
    const size_bytes = new TextEncoder().encode(responseText).length;

    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration_ms,
      size_bytes,
    });
  } catch (err) {
    const duration_ms = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.json({
      error: 'REQUEST_FAILED',
      message,
      duration_ms,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[proxy] CORS proxy running on http://localhost:${PORT}`);
});
