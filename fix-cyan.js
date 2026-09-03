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

  // Replace cyan variations with Zillow Blue
  content = content.replace(/cyan-500\/30/g, '[#006AFF]/30');
  content = content.replace(/cyan-500\/10/g, '[#006AFF]/10');
  content = content.replace(/cyan-500\/50/g, '[#006AFF]/50');
  content = content.replace(/cyan-300/g, '[#006AFF]');
  content = content.replace(/cyan-400/g, '[#006AFF]');
  content = content.replace(/cyan-500/g, '[#006AFF]');
  content = content.replace(/cyan-950\/40/g, '[#006AFF]/5');
  
  // A few specific ones
  content = content.replace(/text-\[#006AFF\] hover:bg-slate-700/g, 'text-[#006AFF] hover:bg-slate-100');
  
  // Focus rings
  content = content.replace(/focus:border-\[#006AFF\] focus:ring-2 focus:ring-\[#006AFF\]\/20/g, 'focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20');
  
  // Gradients to Zillow blue
  content = content.replace(/bg-gradient-to-r from-\[#006AFF\] to-blue-400/g, 'text-[#006AFF]');
  
  // Make sure buttons with text-[#006AFF] aren't illegible on blue backgrounds if there are any
  content = content.replace(/bg-\[#006AFF\] text-slate-950/g, 'bg-[#006AFF] text-white');
  
  fs.writeFileSync(filePath, content, 'utf8');
});
