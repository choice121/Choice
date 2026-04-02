// ============================================================
// REPLIT GUARD — Choice Properties
// ============================================================
// This script runs when the Run button is pressed in Replit.
// Its job: detect Postgres ghost environment variables that
// Replit injects automatically, and refuse to start if found.
//
// This project is a STATIC SITE deployed via Cloudflare Pages.
// There is no local server. There is no database connection.
// Backend = Supabase cloud. Secrets live in Supabase + GAS only.
// ============================================================

const POISON_VARS = ['DATABASE_URL', 'PGHOST', 'PGPASSWORD', 'PGUSER', 'PGDATABASE', 'PGPORT'];
const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

const found = POISON_VARS.filter(v => process.env[v]);
if (found.length > 0) {
  console.error('\n❌ REPLIT GUARD: Postgres ghost variables detected — refusing to start.');
  console.error('   Found:', found.join(', '));
  console.error('');
  console.error('   This project uses Supabase (cloud), not a local Postgres database.');
  console.error('   These variables were injected by Replit automatically and must be ignored.');
  console.error('');
  console.error('   DO NOT:');
  console.error('     - Use DATABASE_URL to connect to any database');
  console.error('     - Install pg, Drizzle, Prisma, or any ORM');
  console.error('     - Run db:push, db:migrate, or any database command');
  console.error('');
  console.error('   DO:');
  console.error('     - Edit static HTML, CSS, and JS files only');
  console.error('     - Push to GitHub — Cloudflare Pages auto-deploys');
  console.error('     - See .agents/instructions.md for the full rule set');
  process.exit(1);
}

const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.warn('\n⚠  Supabase keys not found in environment:', missing.join(', '));
  console.warn('   Add them in Replit Secrets (not .env files) if you need live data.');
  console.warn('   Local preview will still work — config.js is loaded from the browser.\n');
}

console.log('✅ Replit guard passed. This is a static site — no server to start.');
console.log('   To preview: open the Webview panel or visit your Cloudflare Pages URL.');
console.log('   To deploy: push to GitHub — Cloudflare Pages auto-deploys on push.\n');
process.exit(0);
