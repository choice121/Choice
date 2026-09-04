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

// Ensure config.js exists on startup
const configPath = path.join(ROOT, 'config.js');
if (!fs.existsSync(configPath)) {
  try {
    console.log('Generating config.js on startup...');
    require('child_process').execSync('node generate-config.js', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠️ Could not generate config.js on startup:', e.message);
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

  if (urlPath === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(JSON.stringify({ status: 'ok' }));
    }
    return;
  }

  if (urlPath === '/config.js') {
    const cfgFile = path.join(ROOT, 'config.js');
    if (!fs.existsSync(cfgFile)) {
      try {
        console.log('Generating config.js on-the-fly...');
        require('child_process').execSync('node generate-config.js', { cwd: ROOT, stdio: 'inherit' });
      } catch (err) {
        console.error('Error generating config.js on-the-fly:', err);
      }
    }
  }

  // Handle URL redirects matching _redirects
  if (urlPath === '/admin' || urlPath === '/admin/') {
    res.writeHead(302, { Location: '/admin/dashboard.html' });
    res.end();
    return;
  }
  if (urlPath === '/apply.html') {
    res.writeHead(302, { Location: '/apply/' });
    res.end();
    return;
  }
  if (urlPath === '/apply/login.html' || urlPath === '/apply/dashboard.html' || urlPath === '/apply/success.html') {
    res.writeHead(302, { Location: '/apply/?path=dashboard' });
    res.end();
    return;
  }
  if (urlPath === '/apply/lease.html') {
    res.writeHead(302, { Location: '/apply/' });
    res.end();
    return;
  }
  if (urlPath === '/landlord/properties.html' || urlPath === '/landlord/properties' || urlPath === '/landlord/listings.html' || urlPath === '/landlord/listings') {
    res.writeHead(302, { Location: '/landlord/dashboard.html' });
    res.end();
    return;
  }
  if (urlPath === '/landlord/messages.html' || urlPath === '/landlord/messages') {
    res.writeHead(302, { Location: '/landlord/inquiries.html' });
    res.end();
    return;
  }

  // Handle SPA rewrites matching _redirects
  if (urlPath.startsWith('/property/') && !urlPath.includes('.')) {
    urlPath = '/property.html';
  } else if ((urlPath === '/apply' || urlPath.startsWith('/apply/')) && !urlPath.includes('.')) {
    urlPath = '/apply/index.html';
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
