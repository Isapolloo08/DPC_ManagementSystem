import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = env.VITE_PUBLIC_API_URL || env.VITE_API_URL;
  if (!apiUrl) throw new Error('Set VITE_PUBLIC_API_URL to the public Render backend URL before building the invitation website.');
  const url = new URL(apiUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('VITE_PUBLIC_API_URL must be a public HTTPS API URL without credentials, query parameters or a fragment.');
  return {
    base: '/',
    plugins: [react(), {
      name: 'public-invitation-entry',
      transformIndexHtml: { order: 'pre', handler: () => readFileSync(fileURLToPath(new URL('./invitation.html', import.meta.url)), 'utf8') },
    }],
    build: { outDir: 'dist-invitations' },
  };
});
