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
      `  For local development, fill them in:\n` +
      `      cp .env.example .env.development\n\n` +
      '  On Vercel, set them under Project -> Settings -> Environment Variables\n' +
      '  (they are read at BUILD time, so redeploy after changing them).\n'
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, '../client/src'),
      },
    },
    // The `@shared` alias points at ../client/src, which lives OUTSIDE this app's
    // root directory. Vite serves only files under the project root by default, and
    // on Vercel the root directory is `partners` — so without this the dev server
    // and the build both refuse to read the shared code and the portal fails to
    // compile. Granting access to the repo root is what makes the alias work.
    server: {
      port: 5174,
      host: true,
      fs: { allow: [path.resolve(__dirname, '..')] },
    },
    build: { outDir: 'dist' },
  };
});
