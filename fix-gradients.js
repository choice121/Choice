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

  // Replace gradients with solid Zillow blue
  content = content.replace(/bg-gradient-to-r from-cyan-[0-9]+ to-blue-[0-9]+/g, 'bg-[#006AFF]');
  content = content.replace(/bg-gradient-to-r from-cyan-[0-9]+ via-teal-[0-9]+ to-blue-[0-9]+/g, 'bg-[#006AFF]');
  
  // Also clean up any lingering text-emerald-400 and text-emerald-300 to use Zillow green
  content = content.replace(/text-emerald-[0-9]+/g, 'text-[#00AD71]');
  content = content.replace(/bg-emerald-[0-9]+\/[0-9]+/g, 'bg-[#00AD71]/10');
  content = content.replace(/border-emerald-[0-9]+\/[0-9]+/g, 'border-[#00AD71]/30');
  
  // Clean up shadow-cyan overrides on buttons
  content = content.replace(/shadow-cyan-[0-9]+\/[0-9]+/g, '');
  content = content.replace(/hover:brightness-110/g, 'hover:bg-[#0058D6]');
  
  // Some gradients had text-slate-900 on them from a previous replacement
  content = content.replace(/bg-\[#006AFF\](.*?)text-slate-900/g, 'bg-[#006AFF]$1text-white');

  fs.writeFileSync(filePath, content, 'utf8');
});
