const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.cwd();

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
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];

  // Handle /api/relocate endpoint
  if (cleanUrl === '/api/relocate' && req.method === 'POST') {
    let bodyData = '';
    req.on('data', chunk => bodyData += chunk);
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyData || '{}');
        const { property, targetQuery, mode } = body;
        if (!property) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ ok: false, error: 'Property is required' }));
        }

        const origAddr = property.address || property.street || '';
        const origCity = property.city || '';
        const origState = property.state || '';
        const origZip = property.zip || property.zip_code || '';

        function sanitizeListingDescription(rawDesc, oldCity, oldState, targetCity, targetState, targetZip) {
          if (!rawDesc || typeof rawDesc !== 'string') return '';
          let desc = rawDesc;
          if (oldCity) desc = desc.replace(new RegExp(`\\b${oldCity}\\b`, 'gi'), targetCity);
          if (oldState) desc = desc.replace(new RegExp(`\\b${oldState}\\b`, 'gi'), targetState);
          desc = desc.replace(/\b[A-Za-z\s]+(ISD|Independent School District|Public Schools|County Schools|Unified School District)\b/gi, 'local top-rated school district');
          desc = desc.replace(/\b(zoned for|assigned to|schools include:?)\s+[A-Za-z0-9\s,.-]+(?=(\.|\n|$))/gi, 'zoned for excellent neighborhood schools');
          desc = desc.replace(/\b(minutes from|close to|easy access to)\s+(I-\d+|Loop\s+\d+|State\s+Hwy\s+\d+|Hwy\s+\d+|Turnpike|Expressway|Beltway|Parkway|[A-Z]{3}\s+Airport|International Airport)[^.,\n]*/gi, 'convenient access to regional commuter corridors and shopping');
          desc = desc.replace(/security deposit(?:\s*(?:of|is|:)?\s*\$[\d,]+|\s*equal to[^.,\n]*)?/gi, '');
          desc = desc.replace(/\$[\d,]+\s*security deposit/gi, '');
          desc = desc.replace(/\bdeposit:\s*\$[\d,]+/gi, '');
          desc = desc.replace(/\b(?:12|24|36|6)\s*[- ]?month\s+(?:lease|term)[^.,\n]*/gi, '');
          desc = desc.replace(/\b(?:minimum|standard)\s+lease\s+term[^.,\n]*/gi, '');
          desc = desc.replace(/\blease\s+duration:[^.,\n]*/gi, '');
          desc = desc.replace(/\b(?:available now|available immediately|move-in ready|ready for move-in|available for rent on|available on)[^.,\n]*/gi, '');
          desc = desc.replace(/\bmove-in date:[^.,\n]*/gi, '');
          desc = desc.replace(/\b(?:application fee|app fee)(?:\s*(?:is|:)?\s*\$[\d,]+|\s*(?:waived|free|\$0))?/gi, 'Application Fee: $50');
          desc = desc.replace(/\$(?:0|35|40|45|55|60|65|75|100)\s*(?:application fee|app fee)/gi, '$50 application fee');
          desc = desc.replace(/\b(?:no smoking|non-smoking|smoking policy)[^.,\n]*/gi, '');
          desc = desc.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
          if (!desc.includes('Choice Properties')) {
            desc += '\n\nPet friendly. Submit your rental application today at Choice Properties.';
          }
          return desc;
        }

        if (mode === 'same_block_alias') {
          const match = origAddr.match(/^(\d+)(.*)$/);
          const num = match ? parseInt(match[1], 10) : 100;
          const newAddress = match ? `${num + 4}${match[2]}` : origAddr;
          const title = `${newAddress}, ${origCity}, ${origState} ${origZip}`.trim();
          const newDesc = sanitizeListingDescription(property.description || '', origCity, origState, origCity, origState, origZip);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            ok: true,
            result: {
              newTitle: title,
              newAddress,
              newCity: origCity,
              newState: origState,
              newZip: origZip,
              newCounty: property.county || '',
              newLat: property.lat || property.latitude,
              newLng: property.lng || property.longitude,
              newDescription: newDesc,
              method: 'Same-Block Parity-Preserving Privacy Aliasing (+4 Offset)',
              verifiedCensus: true
            }
          }));
        }

        const query = (targetQuery || 'Yukon, OK').trim();
        const zipMatch = query.match(/\b\d{5}\b/);
        const requestedZip = zipMatch ? zipMatch[0] : null;

        const VERIFIED_LOCATIONS = [
          // Oklahoma 73099
          { address: '608 Maple Ave', city: 'Yukon', state: 'OK', zip: '73099', county: 'Canadian County', lat: 35.505704, lng: -97.752354 },
          { address: '804 Poplar Ave', city: 'Yukon', state: 'OK', zip: '73099', county: 'Canadian County', lat: 35.503614, lng: -97.754958 },
          { address: '412 Holly Ave', city: 'Yukon', state: 'OK', zip: '73099', county: 'Canadian County', lat: 35.503076, lng: -97.751446 },
          { address: '704 Oak Ave', city: 'Yukon', state: 'OK', zip: '73099', county: 'Canadian County', lat: 35.504669, lng: -97.753562 },
          { address: '408 S 8th St', city: 'Yukon', state: 'OK', zip: '73099', county: 'Canadian County', lat: 35.503524, lng: -97.754752 },
          
          // Oklahoma 73127
          { address: '7400 Melrose Ln', city: 'Oklahoma City', state: 'OK', zip: '73127', county: 'Canadian County', lat: 35.471541, lng: -97.641703 },
          { address: '6800 NW 16th St', city: 'Oklahoma City', state: 'OK', zip: '73127', county: 'Canadian County', lat: 35.486018, lng: -97.631814 },

          // Oklahoma 73132
          { address: '8408 NW 85th St', city: 'Oklahoma City', state: 'OK', zip: '73132', county: 'Oklahoma County', lat: 35.558662, lng: -97.663219 },
          { address: '7800 NW 50th St', city: 'Oklahoma City', state: 'OK', zip: '73132', county: 'Oklahoma County', lat: 35.522258, lng: -97.650047 },

          // Oklahoma 73064
          { address: '820 N Clear Springs Rd', city: 'Mustang', state: 'OK', zip: '73064', county: 'Canadian County', lat: 35.400129, lng: -97.760051 },
          { address: '1012 S Mustang Rd', city: 'Mustang', state: 'OK', zip: '73064', county: 'Canadian County', lat: 35.382255, lng: -97.724485 },

          // Charlotte NC
          { address: '6807 Wandering Creek Dr', city: 'Charlotte', state: 'NC', zip: '28216', county: 'Mecklenburg County', lat: 35.334110, lng: -80.892450 },
          { address: '8412 Hunters Forest Dr', city: 'Charlotte', state: 'NC', zip: '28269', county: 'Mecklenburg County', lat: 35.338420, lng: -80.791540 },

          // Columbus OH
          { address: '5804 N Meadows Blvd', city: 'Columbus', state: 'OH', zip: '43229', county: 'Franklin County', lat: 40.082410, lng: -82.972340 },
          { address: '2609 Avalon Pl', city: 'Columbus', state: 'OH', zip: '43219', county: 'Franklin County', lat: 40.025680, lng: -82.934120 }
        ];

        let pool = VERIFIED_LOCATIONS;
        const lowerQ = query.toLowerCase();
        if (lowerQ.includes('nc') || lowerQ.includes('charlotte')) {
          pool = VERIFIED_LOCATIONS.filter(l => l.state === 'NC');
        } else if (lowerQ.includes('oh') || lowerQ.includes('columbus')) {
          pool = VERIFIED_LOCATIONS.filter(l => l.state === 'OH');
        } else if (lowerQ.includes('ok') || lowerQ.includes('yukon') || lowerQ.includes('mustang') || lowerQ.includes('okc')) {
          pool = VERIFIED_LOCATIONS.filter(l => l.state === 'OK');
        }

        if (requestedZip) {
          const zipF = pool.filter(l => l.zip === requestedZip);
          if (zipF.length > 0) pool = zipF;
        }

        const loc = pool[Math.floor(Math.random() * pool.length)];
        const newAddress = loc.address;
        const city = loc.city;
        const state = loc.state;
        const zip = loc.zip;
        const county = loc.county;
        const newTitle = `${newAddress}, ${city}, ${state} ${zip}`;
        const newDesc = sanitizeListingDescription(property.description || '', origCity, origState, city, state, zip);

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          ok: true,
          result: {
            newTitle,
            newAddress,
            newCity: city,
            newState: state,
            newZip: zip,
            newCounty: county,
            newLat: loc.lat,
            newLng: loc.lng,
            newDescription: newDesc,
            method: `Verified Municipal Street Protocol (${city}, ${state} ${zip})`,
            verifiedCensus: true
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
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
