const fs = require('fs');
let code = fs.readFileSync('js/matches.js', 'utf8');
code = code.replace(
  "console.error('Error loading matches:', err);",
  "console.error('Error loading matches:', err); if(grid){grid.innerHTML='<pre style=\"color:red;padding:20px\">'+String(err.stack || err)+'</pre>';}"
);
fs.writeFileSync('js/matches.js', code);
