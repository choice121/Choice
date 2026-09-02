const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const distPath = path.join(ROOT, 'dist');

function getStaticRoot() {
  return fs.existsSync(distPath) ? distPath : ROOT;
}

let visionAuditor = null;
try {
  visionAuditor = require('./scripts/vision-audit.js');
} catch (e) {
  console.warn('⚠️ Could not load vision auditor module:', e.message);
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

async function handleVisionAudit(req, res) {
  const reportPath = path.join(ROOT, 'vision_audit_report.json');
  if (fs.existsSync(reportPath)) {
    try {
      const data = fs.readFileSync(reportPath, 'utf8');
      return sendJson(res, 200, JSON.parse(data));
    } catch (err) {
      console.warn('⚠️ Could not read the vision audit report:', err.message);
    }
  }
  if (visionAuditor && visionAuditor.auditProperties) {
    try {
      const report = await visionAuditor.auditProperties(req.url.endsWith('/run') ? 8 : 6);
      return sendJson(res, 200, report);
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }
  return sendJson(res, 404, { error: 'Not found' });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  };
  return types[extension] || 'application/octet-stream';
}

function safePath(requestPath) {
  const root = getStaticRoot();
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^[/\\]+/, '');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep) && resolved !== path.resolve(root)) {
    return null;
  }

  // If path is a directory (e.g. /apply or /admin), look for index.html inside it
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const indexPath = path.join(resolved, 'index.html');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  // Also check if .html was omitted (e.g. /how-to-apply or /faq)
  if (!fs.existsSync(resolved)) {
    const htmlCandidate = resolved + '.html';
    if (fs.existsSync(htmlCandidate)) {
      return htmlCandidate;
    }
  }

  return resolved;
}

const server = http.createServer(async (req, res) => {
  const requestPath = req.url || '/';
  if (requestPath.startsWith('/api/vision-audit/')) {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    return handleVisionAudit(req, res);
  }

  const root = getStaticRoot();
  let filePath;
  try {
    filePath = safePath(requestPath);
  } catch (error) {
    return sendJson(res, 400, { error: 'Invalid path' });
  }
  if (!filePath) return sendJson(res, 400, { error: 'Invalid path' });

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // Never serve the SPA HTML as a missing asset. Browsers then try to parse
    // the fallback document as JavaScript and report the misleading
    // "Unexpected token '<'" error, which also hides missing build config.
    const requestedExtension = path.extname(filePath).toLowerCase();
    if (requestedExtension && requestedExtension !== '.html') {
      res.writeHead(404, { 'Content-Type': contentType(filePath) });
      res.end(`/* Missing asset: ${path.basename(filePath)} */`);
      return;
    }
    filePath = path.join(root, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties dev server running at http://0.0.0.0:${PORT}`);
});
