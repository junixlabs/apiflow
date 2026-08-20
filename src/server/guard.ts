import type { Request, Response, NextFunction } from 'express';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

const hostOf = (value: string): string => {
  const bracketed = /^(\[[^\]]+\])(?::\d+)?$/.exec(value);
  if (bracketed) return bracketed[1];
  return value.split(':')[0];
};

// cm:why A write route accepts a filesystem path, which reverses the read-only rule the GET routes
// live under, so it needs its own fence. Without this, any page in the same browser could POST to
// 127.0.0.1 and register the user's home directory as a project, then have it scanned.
// cm:guard Checks the HOST header, not just Origin: a name that resolves to 127.0.0.1 (DNS
// rebinding) makes an attacker's page same-origin with this server, and then Origin agrees with it.
export function localWritesOnly(req: Request, res: Response, next: NextFunction): void {
  const host = hostOf(req.headers.host ?? '');
  if (!LOOPBACK.has(host)) {
    res.status(403).json({
      error: 'HOST_NOT_LOOPBACK',
      message: `apiflow chỉ nhận lệnh ghi qua 127.0.0.1, không qua tên ${host || '(trống)'}`,
    });
    return;
  }

  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') {
    res.status(403).json({ error: 'CROSS_SITE', message: `lệnh ghi đến từ ${site}, bị chặn` });
    return;
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    let sameHost = false;
    try {
      sameHost = LOOPBACK.has(hostOf(new URL(origin).host));
    } catch {
      sameHost = false;
    }
    if (!sameHost) {
      res.status(403).json({ error: 'BAD_ORIGIN', message: `lệnh ghi đến từ ${origin}, bị chặn` });
      return;
    }
  }
  next();
}
