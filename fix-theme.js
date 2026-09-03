const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  if (file === 'ListingsPage.tsx' || file === 'PropertyDetailPage.tsx') continue;
  
  const fullPath = path.join(dir, file);
  let content = fs.readFileSync(fullPath, 'utf8');

  content = content.replace(/bg-slate-950/g, 'bg-slate-50');
  content = content.replace(/bg-slate-900/g, 'bg-white');
  content = content.replace(/bg-slate-800/g, 'bg-slate-100');
  content = content.replace(/border-slate-800/g, 'border-slate-200');
  content = content.replace(/border-slate-700/g, 'border-slate-300');
  content = content.replace(/text-slate-100/g, 'text-slate-900');
  content = content.replace(/text-white/g, 'text-slate-900');
  content = content.replace(/text-slate-200/g, 'text-slate-700');
  content = content.replace(/text-slate-300/g, 'text-slate-600');
  content = content.replace(/text-slate-400/g, 'text-slate-500');
  
  content = content.replace(/from-slate-900/g, 'from-slate-100');
  content = content.replace(/via-slate-900/g, 'via-white');
  content = content.replace(/to-slate-950\/80/g, 'to-slate-50\/80');
  content = content.replace(/to-slate-900\/0/g, 'to-white\/0');
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Fixed', file);
}
