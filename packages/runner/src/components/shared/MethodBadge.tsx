import type { HttpMethod } from '../../types';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-method-get/20 text-method-get',
  POST: 'bg-method-post/20 text-method-post',
  PUT: 'bg-method-put/20 text-method-put',
  DELETE: 'bg-method-delete/20 text-method-delete',
  PATCH: 'bg-method-patch/20 text-method-patch',
};

export function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${METHOD_COLORS[method]}`}
    >
      {method}
    </span>
  );
}
