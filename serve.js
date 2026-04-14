const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
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
  '.eot':  'application/vnd.ms-fontobject',
  '.webmanifest': 'application/manifest+json',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(function(req, res) {
  let urlPath = req.url.split('?')[0];

  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  }

  let filePath = path.join(ROOT, urlPath);

  fs.stat(filePath, function(err, stat) {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      serveFile(res, filePath);
    } else if (!err && stat.isFile()) {
      serveFile(res, filePath);
    } else {
      const withHtml = filePath + '.html';
      fs.stat(withHtml, function(err2, stat2) {
        if (!err2 && stat2.isFile()) {
          serveFile(res, withHtml);
        } else {
          serveFile(res, path.join(ROOT, '404.html'));
        }
      });
    }
  });
});

server.listen(PORT, HOST, function() {
  console.log('Choice Properties static server running at http://' + HOST + ':' + PORT);
});
