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
  // Only VITE_API_URL is required. The cross-app URL has a safe fallback
  // (see the shared lib/apps.js) and is reported as a console warning, so
  // demanding it here would block a build that actually works.
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
    resolve: {
      // The @shared alias pulls source files out of ../client/src, but those files
      // import bare packages (axios, react, lucide-react, react-router-dom).
      // Node resolution walks UP from the importing file, so from client/src it
      // checks client/node_modules and the repo root — never partners/node_modules,
      // which is the only tree that exists on Vercel (root directory is `partners`).
      // The build therefore failed with "Rollup failed to resolve import axios",
      // and only on a real deploy, because a local checkout has both trees.
      //
      // These entries pin each shared dependency to THIS app's own copy, so a shared
      // module resolves exactly as if it lived inside partners/. Only dependencies
      // this app actually declares are listed — a name missing here fails the same
      // way, so keep the two package.json files in step.
      //
      // All of this must live in ONE alias object. A second `alias` key in the same
      // config silently replaces the first, which is what broke the build once.
      alias: {
        '@shared': path.resolve(__dirname, '../client/src'),
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
        axios: path.resolve(__dirname, 'node_modules/axios'),
        'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
        recharts: path.resolve(__dirname, 'node_modules/recharts'),
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
