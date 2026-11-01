// ============================================================
// Choice Properties — Continuous Migration Supervisor
// Runs the keyset migration engine in controlled 50-property waves,
// ensuring clean checkpointing and handling any container restarts.
// ============================================================

import { spawn } from 'node:child_process';
import path from 'node:path';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'migrate_hotlinks_to_imagekit.mjs');
const BATCH_SIZE = 50;

async function runBatch(batchNum) {
  return new Promise((resolve) => {
    console.log(`\n========================================================`);
    console.log(` Starting Wave #${batchNum} (Up to ${BATCH_SIZE} properties)`);
    console.log(`========================================================`);

    const child = spawn('node', [SCRIPT_PATH, `--properties=${BATCH_SIZE}`], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', (code) => {
      console.log(`Wave #${batchNum} completed with exit code ${code}`);
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`Wave #${batchNum} encountered error:`, err.message);
      resolve(false);
    });
  });
}

async function startSupervisor() {
  console.log('>>> Choice Properties: Migration Supervisor Started <<<');
  let wave = 1;

  while (true) {
    const success = await runBatch(wave);
    wave++;

    // Small 2-second cooldown between waves to avoid connection exhaustion
    await new Promise(r => setTimeout(r, 2000));
  }
}

startSupervisor().catch(console.error);
