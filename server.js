const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const ROOT = __dirname;

// Ensure config.js exists
if (!fs.existsSync(path.join(ROOT, 'config.js'))) {
  try {
    require('./generate-config.js');
  } catch (e) {
    console.warn('⚠️ Could not run generate-config.js on startup:', e.message);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.eot':  'application/vnd.ms-fontobject',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function resolveFilePath(reqUrl) {
  let [pathname] = reqUrl.split('?');
  pathname = decodeURIComponent(pathname);

  if (pathname === '/') {
    return path.join(ROOT, 'index.html');
  }

  // Exact file match
  let directPath = path.join(ROOT, pathname);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  // Exact directory match with index.html
  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    const indexPath = path.join(directPath, 'index.html');
    if (fs.existsSync(indexPath)) return indexPath;
  }

  // Try appending .html
  let withHtml = path.join(ROOT, pathname + '.html');
  if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) {
    return withHtml;
  }

  // Specific Choice Properties route rules
  if (pathname.startsWith('/apply')) {
    const applyIndex = path.join(ROOT, 'apply', 'index.html');
    if (fs.existsSync(applyIndex)) return applyIndex;
  }

  if (pathname.startsWith('/property/') || pathname.startsWith('/rent/')) {
    const propertyHtml = path.join(ROOT, 'property.html');
    if (fs.existsSync(propertyHtml)) return propertyHtml;
  }

  if (pathname === '/admin' || pathname === '/admin/') {
    const adminDash = path.join(ROOT, 'admin', 'dashboard.html');
    if (fs.existsSync(adminDash)) return adminDash;
  }

  if (pathname === '/landlord' || pathname === '/landlord/') {
    const landlordDash = path.join(ROOT, 'landlord', 'dashboard.html');
    if (fs.existsSync(landlordDash)) return landlordDash;
  }

  if (pathname === '/tenant' || pathname === '/tenant/') {
    const tenantPortal = path.join(ROOT, 'tenant', 'portal.html');
    if (fs.existsSync(tenantPortal)) return tenantPortal;
  }

  return null;
}

const server = http.createServer((req, res) => {
  const resolved = resolveFilePath(req.url);

  if (!resolved || !resolved.startsWith(ROOT)) {
    const notFound = path.join(ROOT, '404.html');
    if (fs.existsSync(notFound)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(notFound));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    };

    if (ext === '.html') {
      const nonce = crypto.randomBytes(16).toString('base64');
      let htmlStr = data.toString('utf8');
      htmlStr = htmlStr.replace(/__CSP_NONCE__/g, nonce);
      res.writeHead(200, headers);
      res.end(htmlStr);
      return;
    }

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties server running on http://0.0.0.0:${PORT}`);
});
