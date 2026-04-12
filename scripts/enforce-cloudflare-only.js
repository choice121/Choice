const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'check';
const root = process.cwd();

const forbiddenEnv = [
  'DATABASE_URL',
  'PGHOST',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'NEON_DATABASE_URL',
  'REPLIT_DB_URL'
];

const forbiddenPackages = [
  'pg',
  'postgres',
  'drizzle-orm',
  'drizzle-kit',
  'prisma',
  '@prisma/client',
  'knex',
  'sequelize',
  'typeorm',
  'express',
  'fastify'
];

const replitEnv = [
  'REPL_ID',
  'REPL_SLUG',
  'REPL_OWNER',
  'REPLIT_DEV_DOMAIN',
  'REPLIT_DOMAINS'
].some((key) => Boolean(process.env[key]));

const cloudflareEnv = Boolean(process.env.CF_PAGES || process.env.CLOUDFLARE_ACCOUNT_ID);
const localOverride = process.env.ALLOW_LOCAL_CLOUDFLARE_BUILD === '1';

function fail(message) {
  console.error(`\nCHOICE PROPERTIES PROTECTION WALL\n${message}\n\nThis repository is Cloudflare Pages + Supabase only. Replit is permitted for code editing only. Do not install packages, start servers, configure databases, or run migrations here.\n`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function assertNoForbiddenEnvironment() {
  const present = forbiddenEnv.filter((key) => Boolean(process.env[key]));
  if (present.length) {
    fail(`Forbidden database/runtime environment detected: ${present.join(', ')}`);
  }
  if (replitEnv) {
    fail('Replit runtime environment detected. Runtime, install, build, and migration commands are blocked here.');
  }
}

function assertNoForbiddenPackages() {
  const pkg = readJson('package.json');
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const found = [];
  for (const section of sections) {
    const deps = pkg[section] || {};
    for (const name of forbiddenPackages) {
      if (deps[name]) found.push(`${section}.${name}`);
    }
  }
  if (found.length) {
    fail(`Forbidden server/database package(s) found in package.json: ${found.join(', ')}`);
  }
}

function assertNoRuntimeFiles() {
  const forbiddenFiles = ['server.js', 'db/schema.sql', 'scripts/db-push.js'];
  const found = forbiddenFiles.filter((file) => fs.existsSync(path.join(root, file)));
  if (found.length) {
    fail(`Forbidden Replit/server migration file(s) found: ${found.join(', ')}`);
  }
}

function assertCloudflareBuildContext() {
  if (!cloudflareEnv && !localOverride) {
    fail('Builds are only allowed inside Cloudflare Pages. To test locally, set ALLOW_LOCAL_CLOUDFLARE_BUILD=1 intentionally.');
  }
}

assertNoForbiddenPackages();
assertNoRuntimeFiles();

if (mode === 'install') {
  assertNoForbiddenEnvironment();
  process.exit(0);
}

assertNoForbiddenEnvironment();

if (mode === 'build') {
  assertCloudflareBuildContext();
}

console.log('Choice Properties protection wall passed.');
