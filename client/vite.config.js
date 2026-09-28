import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Fail the BUILD, not the page, when a URL variable is missing.
  //
  // These are read at module scope (lib/apps.js, api.js), so a missing value
  // only blows up in the visitor's browser — as an unhandled throw and a blank
  // white page. Checking here makes it a build error naming the exact variable.
  //
  // VITE_STOREFRONT_URL is included because lib/apps.js requires it too. Leaving
  // it out let that one through the build and then throw at runtime instead —
  // a blank screen with no console error, which is the worst possible failure.
  const REQUIRED = ['VITE_API_URL', 'VITE_PARTNERS_URL', 'VITE_STOREFRONT_URL'];
  const missing = REQUIRED.filter((k) => !env[k]);

  if (missing.length) {
    throw new Error(
      `\n\n  Missing environment ${missing.length > 1 ? 'variables' : 'variable'}: ` +
      `${missing.join(', ')}\n\n` +
      `  For local development, fill them in:\n` +
      `      cp .env.example .env.development\n\n` +
      '  On Vercel, set them under Project -> Settings -> Environment Variables\n' +
      '  (they are read at BUILD time, so redeploy after changing them).\n'
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
  };
});
