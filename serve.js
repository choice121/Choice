const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const ROOT = __dirname;

let visionAuditor = null;
try {
  visionAuditor = require('./scripts/vision-audit.js');
} catch (e) {
  console.warn('⚠️ Could not load vision auditor module:', e.message);
}

// Handle Vision Audit API endpoints
app.get('/api/vision-audit/report', async (req, res) => {
  const reportPath = path.join(ROOT, 'vision_audit_report.json');
  if (fs.existsSync(reportPath)) {
    try {
      const data = fs.readFileSync(reportPath, 'utf8');
      return res.status(200).set('Access-Control-Allow-Origin', '*').json(JSON.parse(data));
    } catch (err) {
      // Fall through
    }
  }
  if (visionAuditor && visionAuditor.auditProperties) {
    try {
      const report = await visionAuditor.auditProperties(6);
      return res.status(200).set('Access-Control-Allow-Origin', '*').json(report);
    } catch (e) {
      return res.status(500).set('Access-Control-Allow-Origin', '*').json({ error: e.message });
    }
  }
  res.status(404).json({ error: 'Not found' });
});

app.all('/api/vision-audit/run', async (req, res) => {
  if (req.method === 'POST' || req.method === 'GET') {
    if (visionAuditor && visionAuditor.auditProperties) {
      try {
        const report = await visionAuditor.auditProperties(8);
        return res.status(200).set('Access-Control-Allow-Origin', '*').json(report);
      } catch (e) {
        return res.status(500).set('Access-Control-Allow-Origin', '*').json({ error: e.message });
      }
    }
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
});

// For all other requests, serve the static files.
// Use 'dist' if it exists, otherwise serve ROOT.
const distPath = path.join(ROOT, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.use(express.static(ROOT));
  app.get('*', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties dev server running at http://0.0.0.0:${PORT}`);
});
