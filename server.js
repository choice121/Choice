const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Remove trailing slash (except root)
  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    urlPath = urlPath.slice(0, -1);
  }

  let filePath = path.join(ROOT, urlPath);

  function tryServe(fp, cb) {
    fs.stat(fp, (err, stat) => {
      if (err) return cb(false);
      if (stat.isDirectory()) {
        tryServe(path.join(fp, 'index.html'), cb);
      } else {
        const ext = path.extname(fp).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(fp).pipe(res);
        cb(true);
      }
    });
  }

  tryServe(filePath, (served) => {
    if (served) return;
    // Try appending .html
    tryServe(filePath + '.html', (served2) => {
      if (served2) return;
      // 404 — serve 404.html if it exists
      const notFound = path.join(ROOT, '404.html');
      fs.stat(notFound, (err) => {
        if (!err) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(notFound).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      });
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties running at http://0.0.0.0:${PORT}`);
});
