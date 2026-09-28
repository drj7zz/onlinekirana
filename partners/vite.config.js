import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The partner portal lives on its own port (5174) and shares core logic —
// including the whole stylesheet — with the storefront app.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Fail the BUILD, not the page, when a URL variable is missing.
  //
  // These are read at module scope by the app (see lib/apps.js), so a missing
  // value only blows up in the visitor's browser — as an unhandled throw and a
  // blank white page with no explanation. Checking here turns that into a build
  // error naming the exact variable, which is the difference between "the site
  // is broken" and "you forgot one env var".
  const REQUIRED = ['VITE_API_URL', 'VITE_STOREFRONT_URL'];
  const missing = REQUIRED.filter((k) => !env[k]);

  if (missing.length) {
    throw new Error(
      `\n\n  Missing environment ${missing.length > 1 ? 'variables' : 'variable'}: ` +
      `${missing.join(', ')}\n\n` +
      `  Copy .env.example to .env and fill ${missing.length > 1 ? 'them' : 'it'} in:\n` +
      `      cp .env.example .env\n\n` +
      '  On Vercel, set them under Project -> Settings -> Environment Variables\n' +
      '  (they are read at BUILD time, so redeploy after changing them).\n'
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5174, host: true },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, '../client/src'),
      },
    },
    build: { outDir: 'dist' },
  };
});
