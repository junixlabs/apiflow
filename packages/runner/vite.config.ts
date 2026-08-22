import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// cm:why publicDir points OUT of this package on purpose: public/ holds the brand mark, which the
// CLI's server-rendered pages inline as a string and vite serves as a file. One copy, two consumers.
// cm:edge lockstep -> packages/cli/src/view/theme.ts — the inlined copy of the mark lives there.
export default defineConfig({
  plugins: [react()],
  publicDir: '../../public',
});
