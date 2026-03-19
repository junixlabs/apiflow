export function StatusBadge({ status }: { status: number }) {
  const color =
    status >= 200 && status < 300
      ? 'bg-method-get/20 text-method-get'
      : status >= 400
        ? 'bg-method-delete/20 text-method-delete'
        : 'bg-method-post/20 text-method-post';

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${color}`}>
      {status}
    </span>
  );
}
