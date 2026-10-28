import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

const ignoredDirectories = new Set([
  '.agents',
  '.aistudio',
  '.cache',
  '.git',
  '.local',
  'attached_assets',
  'coverage',
  'dist',
  'generated-artifacts',
  'node_modules',
  'test-results',
]);
const checkedExtensions = new Set(['.cjs', '.js', '.mjs']);
const files = [];

function collectJavaScriptFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collectJavaScriptFiles(filePath);
      continue;
    }

    if (entry.isFile() && checkedExtensions.has(filePath.slice(filePath.lastIndexOf('.')))) {
      files.push(filePath);
    }
  }
}

collectJavaScriptFiles('.');

const failures = [];
for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${relative('.', filePath)}\n${result.stderr || result.stdout}`);
  }
}

if (failures.length > 0) {
  console.error(`JavaScript syntax check failed in ${failures.length} of ${files.length} files:\n`);
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`JavaScript syntax check passed (${files.length} files).`);
}
