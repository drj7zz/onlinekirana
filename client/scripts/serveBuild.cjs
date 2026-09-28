// Serves the production build for a quick UI check, with /api proxied to the
// API server so the client can talk to it. Usage: node scripts/serveBuild.js [port]
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', 'dist');
const API_TARGET = { host: 'localhost', port: Number(process.env.PORT || 5000) };
const PORT = Number(process.argv[2] || 4173);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  // proxy the API and uploads through to the real server
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    const proxied = http.request(
      { ...API_TARGET, path: req.url, method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      }
    );
    proxied.on('error', () => { res.writeHead(502); res.end('{"message":"api unreachable"}'); });
    req.pipe(proxied);
    return;
  }

  // static file, falling back to index.html so client routes work
  const rel = req.url.split('?')[0];
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html');
  }
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => console.log(`build served on http://127.0.0.1:${PORT}`));
