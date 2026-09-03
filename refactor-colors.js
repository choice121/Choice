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

  // Replace Hex Brackets with Theme Variables
  // Blue Variations
  content = content.replace(/\[#006AFF\]/g, 'zillow-blue');
  content = content.replace(/\[#0058D6\]/g, 'zillow-blue-dark');
  
  // Green Variations
  // Fix text colors first for accessibility
  content = content.replace(/text-\[#00AD71\]/g, 'text-zillow-green-dark');
  content = content.replace(/\[#00AD71\]/g, 'zillow-green');

  fs.writeFileSync(filePath, content, 'utf8');
});
