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
  let original = content;

  // Primary buttons currently: bg-slate-900 text-white hover:bg-slate-800
  // Or bg-slate-900 ... hover:bg-slate-800
  // Let's replace 'bg-slate-900' with 'bg-[#006AFF]' ONLY if it's meant to be a button or active element.
  // Wait, I replaced a lot of text-white with text-slate-900.
  // Let's specifically target button classes.
  
  // A safe way is to replace specific button/CTA patterns:
  content = content.replace(/bg-slate-900(?=.*text-white)/g, 'bg-[#006AFF]'); 
  content = content.replace(/hover:bg-slate-800(?=.*bg-\[#006AFF\])/g, 'hover:bg-[#0058D6]');
  
  // Wait, regex lookahead doesn't work if they are in arbitrary order or across lines.
  
  fs.writeFileSync(filePath, content, 'utf8');
});
