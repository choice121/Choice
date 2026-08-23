// ============================================================
// agent-helper — admin-only API for AI agents working on this project
// ============================================================
// Endpoint:  POST /api/agent-helper
// Auth:      Authorization: Bearer <AGENT_HELPER_SECRET>
//
// All tokens live in Cloudflare Pages env vars. The repo never sees them.
// Required env vars (set in Cloudflare Pages > Settings > Environment variables):
//   AGENT_HELPER_SECRET           shared secret the AI uses to call this API
//   SUPABASE_URL                  already present on this project
//   SUPABASE_SERVICE_ROLE_KEY     server-only key, NOT the anon key
// Optional env vars (each unlocks one extra action):
//   GH_TOKEN                      enables `repo_status`
//   CLOUDFLARE_API_TOKEN          enables `deployment_status`
//   CLOUDFLARE_ACCOUNT_ID         enables `deployment_status`
//   CLOUDFLARE_PAGES_PROJECT      enables `deployment_status`
// ============================================================

const REPO = 'choice121/Choice';

function json(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function constantTimeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(request, env) {
  if (!env.AGENT_HELPER_SECRET) return false;
  const auth = request.headers.get('authorization') || '';
  return constantTimeEq(auth, `Bearer ${env.AGENT_HELPER_SECRET}`);
}

function envReady(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

async function sb(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: (init.headers && init.headers.Prefer) || 'return=representation',
    },
  });
}

async function readJson(r) {
  try { return await r.json(); } catch { return null; }
}

// ── actions ─────────────────────────────────────────────────────────────────

async function listIssues(env) {
  const r = await sb(env, 'open_issues?select=*');
  return json(r.status, await readJson(r));
}

async function createIssue(env, body) {
  if (!body || typeof body.title !== 'string' || body.title.trim().length < 3) {
    return json(400, { error: 'title (>=3 chars) required' });
  }
  const allowedSeverity = new Set(['critical', 'high', 'medium', 'low', 'info']);
  const row = {
    title: body.title.trim().slice(0, 200),
    description: typeof body.description === 'string' ? body.description.slice(0, 8000) : '',
    severity: allowedSeverity.has(body.severity) ? body.severity : 'medium',
    component: typeof body.component === 'string' && body.component.trim()
      ? body.component.trim().slice(0, 80)
      : 'general',
    created_by: typeof body.created_by === 'string' ? body.created_by.slice(0, 80) : 'agent',
    metadata: (body.metadata && typeof body.metadata === 'object') ? body.metadata : {},
  };
  const r = await sb(env, 'agent_issues', { method: 'POST', body: JSON.stringify(row) });
  return json(r.status, await readJson(r));
}

async function resolveIssue(env, body) {
  const id = Number(body && body.id);
  if (!Number.isFinite(id) || id <= 0) return json(400, { error: 'numeric id required' });
  const patch = {
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: typeof body.resolved_by === 'string' ? body.resolved_by.slice(0, 80) : 'agent',
    resolution_note: typeof body.note === 'string' ? body.note.slice(0, 2000) : null,
  };
  const r = await sb(env, `agent_issues?id=eq.${id}&status=eq.open`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await readJson(r);
  if (r.status === 200 && Array.isArray(data) && data.length === 0) {
    return json(404, { error: 'no open issue with that id' });
  }
  return json(r.status, data);
}

async function purgeResolved(env) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/purge_resolved_agent_issues`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  return json(r.status, await readJson(r));
}

async function repoStatus(env) {
  if (!env.GH_TOKEN) return json(501, { error: 'GH_TOKEN not configured' });
  const headers = {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agent-helper',
  };
  const [commitsRes, runsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=5`, { headers }),
    fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=5`, { headers }),
  ]);
  const commits = await readJson(commitsRes);
  const runs = await readJson(runsRes);
  return json(200, {
    repo: REPO,
    commits: (commits || []).map(c => ({
      sha: c.sha ? c.sha.slice(0, 7) : null,
      date: c.commit && c.commit.author ? c.commit.author.date : null,
      message: c.commit && c.commit.message ? c.commit.message.split('\n')[0] : '',
    })),
    actions: ((runs && runs.workflow_runs) || []).map(w => ({
      name: w.name,
      status: w.status,
      conclusion: w.conclusion,
      branch: w.head_branch,
      created_at: w.created_at,
    })),
  });
}

async function deploymentStatus(env) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_PAGES_PROJECT) {
    return json(501, { error: 'Cloudflare API env vars not configured' });
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${env.CLOUDFLARE_PAGES_PROJECT}/deployments?per_page=5`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  const j = await readJson(r);
  return json(r.status, {
    project: env.CLOUDFLARE_PAGES_PROJECT,
    deployments: ((j && j.result) || []).map(d => ({
      id: d.id,
      created_on: d.created_on,
      environment: d.environment,
      stage: d.latest_stage && d.latest_stage.name,
      stage_status: d.latest_stage && d.latest_stage.status,
      url: d.url,
    })),
  });
}

// ── HTTP entry points ───────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAuthorized(request, env)) return json(401, { error: 'unauthorized' });
  if (!envReady(env))              return json(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' });

  let body = {};
  try { body = await request.json(); } catch { /* allow empty */ }
  const action = body && body.action;

  switch (action) {
    case 'list_issues':       return listIssues(env);
    case 'create_issue':      return createIssue(env, body);
    case 'resolve_issue':     return resolveIssue(env, body);
    case 'purge_resolved':    return purgeResolved(env);
    case 'repo_status':       return repoStatus(env);
    case 'deployment_status': return deploymentStatus(env);
    default:
      return json(400, { error: `unknown action: ${action || '(none)'}` });
  }
}

// Unauthenticated GET returns the action manifest only — no data, no secrets.
export async function onRequestGet() {
  return json(200, {
    name: 'agent-helper',
    actions: [
      'list_issues',
      'create_issue',
      'resolve_issue',
      'purge_resolved',
      'repo_status',
      'deployment_status',
    ],
    auth: 'POST with header `Authorization: Bearer <AGENT_HELPER_SECRET>`',
    docs: '/.agents/AI_RULES.md',
  });
}
