// cm:why A CLI that prints a list will be piped into `head`, and node's default answer to the closed
// pipe is an unhandled 'error' event: a 20-line stack trace and a crash exit code, on the most
// ordinary command a newcomer types. Measured on `apiflow impact <map> | head -6`.
// cm:guard Call this at the top of every CLI main(), before the first write. Registering it after a
// console.log is too late — the write that fails is the one that throws.
export function tolerateClosedPipe(): void {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') process.exit(0);
      throw err;
    });
  }
}
