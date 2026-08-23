const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

let visionAuditor = null;
try {
  visionAuditor = require('./scripts/vision-audit.js');
} catch (e) {
  console.warn('⚠️ Could not load vision auditor module:', e.message);
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
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  let [urlPath] = req.url.split('?');

  // Handle Vision Audit API endpoints
  if (urlPath === '/api/vision-audit/report' && req.method === 'GET') {
    const reportPath = path.join(ROOT, 'vision_audit_report.json');
    if (fs.existsSync(reportPath)) {
      try {
        const data = fs.readFileSync(reportPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
        return;
      } catch (err) {
        // Fall through
      }
    }
    if (visionAuditor && visionAuditor.auditProperties) {
      try {
        const report = await visionAuditor.auditProperties(6);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(report));
        return;
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  if (urlPath === '/api/vision-audit/run' && (req.method === 'POST' || req.method === 'GET')) {
    if (visionAuditor && visionAuditor.auditProperties) {
      try {
        const report = await visionAuditor.auditProperties(8);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(report));
        return;
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  if (urlPath === '/') urlPath = '/index.html';

  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Try appending .html if direct file doesn't exist
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFound = path.join(ROOT, '404.html');
      if (fs.existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(notFound));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    };

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties dev server running at http://0.0.0.0:${PORT}`);
});
