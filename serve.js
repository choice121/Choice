const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = process.cwd();

// Ensure config.js and apply/config.js exist before serving requests
if (
  !fs.existsSync(path.join(PUBLIC_DIR, 'config.js')) ||
  (fs.existsSync(path.join(PUBLIC_DIR, 'apply')) && !fs.existsSync(path.join(PUBLIC_DIR, 'apply', 'config.js')))
) {
  const genScript = path.join(PUBLIC_DIR, 'generate-config.js');
  if (fs.existsSync(genScript)) {
    spawnSync(process.execPath, [genScript], {
      cwd: PUBLIC_DIR,
      env: { ...process.env, AIS_BUILD: 'true' },
      stdio: 'inherit'
    });
  }
}

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
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

const { handleAssistantApi } = require('./lib/assistant-router');

function redirect(res, location, statusCode = 302) {
  res.writeHead(statusCode, {
    Location: location,
    'Access-Control-Allow-Origin': '*'
  });
  res.end();
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  const qIndex = rawUrl.indexOf('?');
  const cleanUrl = decodeURIComponent(qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl);
  const querySuffix = qIndex >= 0 ? rawUrl.slice(qIndex) : '';

  // Route /api/assistant endpoints
  if (cleanUrl.startsWith('/api/assistant')) {
    return handleAssistantApi(req, res);
  }

  // Retired landlord portal redirects (matches functions/_middleware.js & _redirects)
  if (cleanUrl === '/landlord' || cleanUrl.startsWith('/landlord/')) {
    return redirect(res, '/admin/login.html', 302);
  }
  if (cleanUrl === '/apply.html') {
    return redirect(res, '/apply/' + querySuffix, 302);
  }
  if (cleanUrl === '/landlord-platform-agreement.html') {
    return redirect(res, '/how-it-works.html', 302);
  }

  // Normalize path and prevent directory traversal
  const relPath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  let filePath = path.join(PUBLIC_DIR, relPath === '' ? 'index.html' : relPath);
  let statusCode = 200;

  // If path is a directory, look for index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If not found directly, resolve clean routes & SPA rewrites
  if (!fs.existsSync(filePath)) {
    const trimmedPath = filePath.replace(/[/\\]+$/, '');
    const reqExt = path.extname(cleanUrl).toLowerCase();

    if (fs.existsSync(trimmedPath + '.html')) {
      filePath = trimmedPath + '.html';
    } else if (fs.existsSync(path.join(trimmedPath, 'index.html'))) {
      filePath = path.join(trimmedPath, 'index.html');
    } else if (!reqExt || reqExt === '.html') {
      // Match _redirects & Pages Functions for /property/*, /rent/*, and /apply/*
      if (cleanUrl.startsWith('/property/') || cleanUrl.startsWith('/rent/')) {
        filePath = path.join(PUBLIC_DIR, 'property.html');
      } else if (cleanUrl === '/apply' || cleanUrl.startsWith('/apply/')) {
        filePath = path.join(PUBLIC_DIR, 'apply', 'index.html');
      } else if (fs.existsSync(path.join(PUBLIC_DIR, '404.html'))) {
        filePath = path.join(PUBLIC_DIR, '404.html');
        statusCode = 404;
      } else {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }
    } else {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end('404 Not Found');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>', 'utf-8');
    } else {
      res.writeHead(statusCode, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties server running on port ${PORT} (0.0.0.0)`);
});
