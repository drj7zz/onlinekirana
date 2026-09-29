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
  // Only VITE_API_URL is required now. The two cross-app URLs have safe
  // fallbacks (see lib/apps.js) and are reported as a console warning, so
  // demanding them here would block a build that actually works.
  const REQUIRED = ['VITE_API_URL'];
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
