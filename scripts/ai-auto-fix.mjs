#!/usr/bin/env node
// ============================================================
// AI fix-PR loop — Phase 3 monitoring.
//
// Picks (at most) one eligible row from public.agent_issues, asks
// GitHub Models for a proposed patch, validates it against an
// explicit allow/deny path list, opens a PR (never auto-merges),
// and increments auto_fix_attempts.
//
// Activated by the AUTO_FIX_ENABLED secret being set to 'true' in
// the calling workflow.
// ============================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  SUPABASE_PROJECT_REF,
  SUPABASE_ACCESS_TOKEN,
  MODEL = 'openai/gpt-4o-mini',
  ISSUE_ID_OVERRIDE,
} = process.env;

const REQUIRED = { GITHUB_TOKEN, GITHUB_REPOSITORY, SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN };
for (const [k, v] of Object.entries(REQUIRED)) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(0); } // exit 0 = soft fail
}

// --- Paths the AI is allowed to touch.
//     ANY proposed change outside this set is rejected.
const ALLOW_GLOBS = [
  /^js\/(?!cp-error-reporter\.js$|cp-api\.js$).+\.js$/, // js/** except two critical singletons
  /^css\/.+\.css$/,
  /^[^/]+\.html$/,                                       // root .html only
  /^supabase\/functions\/(?!_shared\/).+\.ts$/,          // edge functions, not _shared
];

// --- Hard deny list (overrides allow). NEVER let the model touch:
const DENY_REGEXES = [
  /^supabase\/migrations\//,
  /^supabase\/config\.toml$/,
  /\b_middleware\.js$/,
  /^\.github\//,
  /^apply\//,
  /^generate-config\.js$/,
  /^scripts\//,
  /\.env/,
  /package(-lock)?\.json$/,
  /^js\/(cp-error-reporter|cp-api)\.js$/,
];

const isAllowed = (p) =>
  ALLOW_GLOBS.some((rx) => rx.test(p)) && !DENY_REGEXES.some((rx) => rx.test(p));

// ============================================================
// Supabase Management API helpers
// ============================================================
async function sql(query) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!r.ok) {
    throw new Error(`SQL HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }
  return r.json();
}

// ============================================================
// GitHub helpers
// ============================================================
async function gh(method, p, body) {
  const r = await fetch(`https://api.github.com${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'choice-ai-auto-fix',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await r.json(); } catch { data = await r.text(); }
  return { status: r.status, body: data };
}

// ============================================================
// 1. Pick eligible issue
// ============================================================
async function pickIssue() {
  let q;
  if (ISSUE_ID_OVERRIDE) {
    q = `select id, severity, status, title, kind, evidence, fingerprint, auto_fix_attempts
         from public.agent_issues where id = ${parseInt(ISSUE_ID_OVERRIDE, 10)} limit 1;`;
  } else {
    q = `select id, severity, status, title, kind, evidence, fingerprint, auto_fix_attempts
         from public.agent_issues
         where status='open'
           and fingerprint is not null
           and coalesce(kind,'') not in ('security')
           and coalesce(auto_fix_attempts, 0) < 3
         order by case severity
                    when 'critical' then 0 when 'high' then 1
                    when 'medium' then 2 when 'low' then 3 else 4 end,
                  coalesce(auto_fix_attempts, 0) asc,
                  id asc
         limit 1;`;
  }
  const rows = await sql(q);
  return rows[0] || null;
}

// ============================================================
// 2. Build the prompt
// ============================================================
async function buildPrompt(issue, repoFiles) {
  const evJson = typeof issue.evidence === 'string' ? issue.evidence : JSON.stringify(issue.evidence || {});

  const allowedListing = repoFiles
    .filter(isAllowed)
    .slice(0, 200)
    .map((p) => `  ${p}`)
    .join('\n');

  return [
    {
      role: 'system',
      content:
`You are a careful code-fix assistant for the Choice Properties rental marketplace, a static HTML/JS site backed by Supabase.

Your job: given ONE bug report, propose a minimal patch that fixes it. You MUST output strict JSON only, no prose, matching this schema:

{
  "analysis": "string (1-3 sentences explaining root cause)",
  "confidence": 1 | 2 | 3 | 4 | 5,
  "files_to_read": ["path/relative/to/repo/root.js", ...],
  "files_to_change": [
    { "path": "string", "new_content": "string (entire new file contents)" }
  ],
  "pr_description": "string (markdown, will be the PR body)"
}

Rules:
- If you need to see file contents before patching, leave files_to_change empty and list paths in files_to_read. The orchestrator will re-prompt you with those contents.
- ALL paths in files_to_change MUST be from the ALLOWED PATHS list below; anything else will be rejected.
- Confidence < 3 will be rejected — do not guess.
- new_content must be the COMPLETE new file, not a diff.
- Do not introduce new external dependencies.
- Do not modify migrations, auth, middleware, RLS, .github/, apply/, generate-config.js, scripts/, or package.json.`,
    },
    {
      role: 'user',
      content:
`# Bug report (from public.agent_issues)

- id: ${issue.id}
- severity: ${issue.severity}
- kind: ${issue.kind || '(none)'}
- title: ${issue.title}
- attempts so far: ${issue.auto_fix_attempts || 0}

## Evidence
\`\`\`json
${evJson}
\`\`\`

## ALLOWED paths (you may only change files matching these)
\`\`\`
${allowedListing}
\`\`\`

Respond with strict JSON only.`,
    },
  ];
}

// ============================================================
// 3. Call GitHub Models
// ============================================================
async function callModel(messages) {
  const r = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) {
    throw new Error(`Model HTTP ${r.status}: ${(await r.text()).slice(0, 600)}`);
  }
  const data = await r.json();
  const txt = data.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(txt); }
  catch (e) { throw new Error(`Model returned non-JSON: ${txt.slice(0, 400)}`); }
  return parsed;
}

// ============================================================
// 4. Walk repo to collect file paths
// ============================================================
async function listRepoFiles() {
  const out = execSync(
    `git ls-files | grep -vE "^(node_modules/|\\.git/|attached_assets/|backups/)"`,
    { encoding: 'utf8' },
  );
  return out.trim().split('\n').filter(Boolean);
}

// ============================================================
// 5. Apply changes locally
// ============================================================
async function applyChanges(files) {
  for (const f of files) {
    if (!isAllowed(f.path)) {
      throw new Error(`Refusing to write disallowed path: ${f.path}`);
    }
    await fs.mkdir(path.dirname(f.path), { recursive: true });
    await fs.writeFile(f.path, f.new_content, 'utf8');
  }
}

// ============================================================
// 6. Open a PR via git CLI
// ============================================================
function sh(cmd) {
  console.log('$', cmd);
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8' }).trim();
}

async function openPR(issue, plan, branchName) {
  sh(`git config user.name "ai-auto-fix[bot]"`);
  sh(`git config user.email "ai-auto-fix@users.noreply.github.com"`);
  sh(`git checkout -b "${branchName}"`);
  sh(`git add -A`);
  // Detect actual changes
  const diff = sh(`git status --porcelain`);
  if (!diff) {
    console.log('No changes after applying patch — aborting.');
    return null;
  }
  sh(`git commit -m "ai-auto-fix: attempt fix for agent_issue #${issue.id}\n\n${(plan.analysis || '').slice(0, 400)}"`);
  sh(`git push -u "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "${branchName}"`);

  const pr = await gh('POST', `/repos/${GITHUB_REPOSITORY}/pulls`, {
    title: `ai-auto-fix: ${issue.title.slice(0, 80)}`,
    head: branchName,
    base: 'main',
    body:
`> ⚠️ **AI-generated fix.** Please review carefully before merging. This branch was opened automatically by the AI fix-PR loop in response to a row in \`public.agent_issues\`.

## Source issue

- **id:** \`${issue.id}\`
- **severity:** \`${issue.severity}\`
- **kind:** \`${issue.kind || '(none)'}\`
- **title:** ${issue.title}
- **fingerprint:** \`${issue.fingerprint}\`
- **prior attempts:** ${issue.auto_fix_attempts || 0}

## Model

- \`${MODEL}\` via GitHub Models
- self-reported confidence: **${plan.confidence}/5**

## Analysis

${plan.analysis || '_(none provided)_'}

---

${plan.pr_description || ''}

---

<sub>Generated by \`.github/workflows/ai-auto-fix.yml\` → \`scripts/ai-auto-fix.mjs\`. Disable with \`AUTO_FIX_ENABLED=false\`.</sub>`,
  });
  if (pr.status >= 300) {
    throw new Error(`PR creation failed: ${pr.status} ${JSON.stringify(pr.body).slice(0, 300)}`);
  }
  return pr.body;
}

// ============================================================
// Main
// ============================================================
(async () => {
  const issue = await pickIssue();
  if (!issue) {
    console.log('No eligible issues. Nothing to do.');
    return;
  }
  console.log(`Selected issue #${issue.id} [${issue.severity}/${issue.kind}] ${issue.title}`);

  const repoFiles = await listRepoFiles();
  let messages = await buildPrompt(issue, repoFiles);

  // Two-pass: first ask, optionally provide requested file contents, then ask again.
  let plan = await callModel(messages);
  console.log('Pass 1 plan:', JSON.stringify({
    files_to_read: plan.files_to_read,
    files_to_change: (plan.files_to_change || []).map((f) => f.path),
    confidence: plan.confidence,
  }));

  if ((!plan.files_to_change || plan.files_to_change.length === 0)
      && Array.isArray(plan.files_to_read) && plan.files_to_read.length > 0) {
    const safeReads = plan.files_to_read.filter((p) => isAllowed(p) && repoFiles.includes(p)).slice(0, 6);
    const fileBlobs = [];
    for (const p of safeReads) {
      try {
        const content = await fs.readFile(p, 'utf8');
        fileBlobs.push(`### ${p}\n\`\`\`\n${content.slice(0, 12000)}\n\`\`\``);
      } catch {}
    }
    messages.push({ role: 'assistant', content: JSON.stringify(plan) });
    messages.push({
      role: 'user',
      content: `Here are the file contents you requested:\n\n${fileBlobs.join('\n\n')}\n\nNow respond with the FINAL JSON including files_to_change. Same schema. Strict JSON only.`,
    });
    plan = await callModel(messages);
    console.log('Pass 2 plan:', JSON.stringify({
      files_to_change: (plan.files_to_change || []).map((f) => f.path),
      confidence: plan.confidence,
    }));
  }

  // Validation
  const conf = Number(plan.confidence) || 0;
  if (conf < 3) {
    console.log(`Confidence ${conf} < 3 — refusing to act.`);
    await bumpAttempts(issue.id, `Skipped: model confidence ${conf} < 3.`);
    return;
  }
  if (!Array.isArray(plan.files_to_change) || plan.files_to_change.length === 0) {
    console.log('No files_to_change in final plan — refusing.');
    await bumpAttempts(issue.id, 'Skipped: no files_to_change.');
    return;
  }
  for (const f of plan.files_to_change) {
    if (!isAllowed(f.path)) {
      console.log(`Disallowed path: ${f.path} — refusing.`);
      await bumpAttempts(issue.id, `Skipped: model proposed disallowed path ${f.path}.`);
      return;
    }
  }

  // Apply + PR
  await applyChanges(plan.files_to_change);
  const branch = `ai-fix/issue-${issue.id}-${Date.now()}`;
  let pr;
  try {
    pr = await openPR(issue, plan, branch);
  } catch (e) {
    console.error('openPR failed:', e.message);
    await bumpAttempts(issue.id, `Failed: ${e.message.slice(0, 300)}`);
    return;
  }
  if (!pr) {
    await bumpAttempts(issue.id, 'No diff after applying patch (no-op).');
    return;
  }
  console.log(`Opened PR #${pr.number} -> ${pr.html_url}`);
  await bumpAttempts(issue.id, `Opened PR #${pr.number} (${pr.html_url}).`);
})().catch(async (e) => {
  console.error('Fatal:', e.message);
  process.exit(0); // soft fail; the next cron tick can try again
});

async function bumpAttempts(issueId, note) {
  const escNote = note.replace(/'/g, "''");
  await sql(
    `UPDATE public.agent_issues
       SET auto_fix_attempts = COALESCE(auto_fix_attempts, 0) + 1,
           resolution_note = COALESCE(resolution_note,'')
                             || E'\n[ai-auto-fix ${new Date().toISOString()}] '
                             || '${escNote}'
     WHERE id = ${issueId};`
  );
}
