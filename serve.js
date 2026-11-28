const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = process.cwd();

// Ensure generated runtime configs exist when booting directly via `npm run dev`
if (!fs.existsSync(path.join(PUBLIC_DIR, 'config.js')) || !fs.existsSync(path.join(PUBLIC_DIR, 'apply', 'config.js'))) {
  try {
    execFileSync(process.execPath, [path.join(PUBLIC_DIR, 'generate-config.js')], {
      cwd: PUBLIC_DIR,
      env: { ...process.env, AIS_BUILD: 'true' },
      stdio: 'inherit'
    });
  } catch (err) {
    console.warn('Warning: failed to auto-generate config.js:', err.message);
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
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.zip': 'application/zip'
};

const ASSET_EXTENSIONS = new Set([
  '.css', '.js', '.mjs', '.json', '.png', '.jpg', '.jpeg', '.webp',
  '.svg', '.ico', '.woff2', '.woff', '.ttf', '.xml', '.pdf', '.map', '.zip'
]);

const { handleAssistantApi } = require('./lib/assistant-router');
const { handleTenantAutoLogin } = require('./lib/tenant-auto-login');
const { handleAdminPinApi } = require('./lib/admin-pin-auth');

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];

  // Redirect legacy card checkout routes to Tenant Portal
  if (cleanUrl === '/apply/pay.html' || cleanUrl === '/apply/pay') {
    const queryIndex = req.url.indexOf('?');
    const qs = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
    res.writeHead(302, { Location: `/tenant/portal.html${qs}` });
    res.end();
    return;
  }

  // Route /api/assistant endpoints
  if (cleanUrl.startsWith('/api/assistant')) {
    return handleAssistantApi(req, res);
  }

  // Route /api/tenant/auto-login endpoint
  if (cleanUrl.startsWith('/api/tenant/auto-login')) {
    return handleTenantAutoLogin(req, res);
  }

  // Route /api/admin/trusted-devices and /api/admin/pin-login
  if (cleanUrl === '/api/admin/trusted-devices' || cleanUrl === '/api/admin/pin-login') {
    return handleAdminPinApi(req, res);
  }

  // Route /rent/<state>/<city>/<slug> and /property/<id> to property.html shell
  if (cleanUrl.startsWith('/rent/') || cleanUrl.startsWith('/property/')) {
    cleanUrl = '/property.html';
  }

  // Route /matches/<token> to matches.html shell
  if (cleanUrl.startsWith('/matches/')) {
    cleanUrl = '/matches.html';
  }

  // Normalize path and prevent directory traversal
  let safePath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);

  // If path is a directory, look for index.html inside it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If not found directly, check with .html extension
  if (!fs.existsSync(filePath)) {
    const reqExt = path.extname(safePath).toLowerCase();
    if (ASSET_EXTENSIONS.has(reqExt)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
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
      res.writeHead(200, {
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
