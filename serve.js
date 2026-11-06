const http = require('http');
const fs = require('fs');
const path = require('path');

function resolvePort() {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    return parseInt(process.argv[portArgIdx + 1], 10);
  }
  if (process.env.DEFAULT_APP_PORT) {
    return parseInt(process.env.DEFAULT_APP_PORT, 10);
  }
  const envPort = parseInt(process.env.PORT || '3000', 10);
  if (envPort === 8080 || isNaN(envPort)) {
    return 3000;
  }
  return envPort;
}
const PORT = resolvePort();

const PUBLIC_DIR = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.map': 'application/json; charset=utf-8'
};

const { handleAssistantApi } = require('./lib/assistant-router');

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];

  // Route /api/assistant endpoints
  if (cleanUrl.startsWith('/api/assistant')) {
    return handleAssistantApi(req, res);
  }



  // Normalize path and prevent directory traversal
  let safePath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);

  // If path is a directory, look for index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If not found directly, check inside public/ directory
  if (!fs.existsSync(filePath)) {
    const publicCandidate = path.join(PUBLIC_DIR, 'public', safePath);
    if (fs.existsSync(publicCandidate) && !fs.statSync(publicCandidate).isDirectory()) {
      filePath = publicCandidate;
    }
  }

  // If not found directly, check with .html extension
  if (!fs.existsSync(filePath)) {
    // Strip trailing slash if any
    const trimmedPath = filePath.replace(/[/\\]+$/, '');
    if (fs.existsSync(trimmedPath + '.html')) {
      filePath = trimmedPath + '.html';
    } else if (fs.existsSync(path.join(trimmedPath, 'index.html'))) {
      filePath = path.join(trimmedPath, 'index.html');
    } else {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>', 'utf-8');
    } else {
      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      };
      if (ext === '.zip') {
        headers['Content-Disposition'] = `attachment; filename="${path.basename(filePath)}"`;
        headers['Content-Length'] = content.length;
      }
      res.writeHead(200, headers);
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties server running on port ${PORT} (0.0.0.0)`);
});
