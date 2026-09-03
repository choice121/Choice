const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk(path.join(__dirname, 'frontend/src'), function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix hover states for primary buttons
  content = content.replace(/bg-\[#006AFF\](.*?)hover:bg-slate-800/g, 'bg-[#006AFF]$1hover:bg-[#0058D6]');
  content = content.replace(/hover:bg-slate-800(.*?)bg-\[#006AFF\]/g, 'hover:bg-[#0058D6]$1bg-[#006AFF]');

  // Swap emerald green accents to Zillow Green #00AD71
  content = content.replace(/text-emerald-600/g, 'text-[#00AD71]');
  content = content.replace(/text-emerald-500/g, 'text-[#00AD71]');
  content = content.replace(/bg-emerald-500/g, 'bg-[#00AD71]');
  content = content.replace(/border-emerald-500/g, 'border-[#00AD71]');
  content = content.replace(/ring-emerald-500/g, 'ring-[#00AD71]');

  fs.writeFileSync(filePath, content, 'utf8');
});
