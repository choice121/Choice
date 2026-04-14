// Choice Properties — Replit local static file server
// Serves static HTML/CSS/JS files for local preview only.
// Production is hosted on Cloudflare Pages; this server is Replit-only.

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
  '.xml':  'application/xml',
  '.ttf':  'font/ttf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Strip trailing slash (except root)
  if (urlPath !== '/' && urlPath.endsWith('/')) {
    urlPath = urlPath.slice(0, -1);
  }

  let filePath = path.join(ROOT, urlPath);

  // Directory → try index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // No extension → try .html
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath = filePath + '.html';
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    serveFile(res, filePath);
  } else {
    // Fallback: serve 404.html if it exists, otherwise plain 404
    const notFound = path.join(ROOT, '404.html');
    if (fs.existsSync(notFound)) {
      fs.readFile(notFound, (err, data) => {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(err ? '404 Not Found' : data);
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties static server running on port ${PORT}`);
  console.log(`Preview: http://localhost:${PORT}`);
  console.log('Backend: Supabase cloud (tlfmwetmhthpyrytrcfo.supabase.co)');
  console.log('Production: Cloudflare Pages — edit files here, push to GitHub to deploy.');
});
