const fs = require("fs");
if (fs.existsSync("js/admin/property-detail.js")) {
  let c = fs.readFileSync("js/admin/property-detail.js", "utf8");
  c = c.replace(/\/\/ ── Virtual tour ──[\s\S]*?Open virtual tour ↗\s*<\/a>\s*<\/div>[\s\S]*?Smoking[^\n]*/g, "// smoking removed");
  fs.writeFileSync("js/admin/property-detail.js", c);
  console.log("Cleaned js/admin/property-detail.js");
}

