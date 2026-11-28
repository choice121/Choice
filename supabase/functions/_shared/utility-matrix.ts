// Choice Properties — Shared: utility-matrix.ts
//
// Phase 07 — Normalizes and renders the per-utility responsibility matrix
// stored on `applications.utility_responsibilities` (JSONB).
//
// Storage shape (canonical):
//   {
//     "electric": { "responsibility": "tenant", "notes": "" },
//     "water":    { "responsibility": "landlord", "notes": "Included in rent." },
//     ...
//   }
//
// Permissive read shape — older drafts may have stored the bare string value
// (e.g. { "electric": "tenant" }), so the normalizer accepts both and emits
// the canonical object form.

export type UtilityResponsibility = 'tenant' | 'landlord' | 'shared' | 'n/a';

export interface UtilityEntry {
  responsibility: UtilityResponsibility;
  notes: string;
}

export type UtilityMatrix = Record<string, UtilityEntry>;

/** The standard 13 utilities the admin UI surfaces by default, in display order. */
export const STANDARD_UTILITY_KEYS = [
  'electric',
  'gas',
  'water',
  'sewer',
  'trash',
  'recycling',
  'internet',
  'cable',
  'hoa',
  'lawn_care',
  'snow_removal',
  'pest_control',
  'pool_maintenance',
] as const;

export type StandardUtilityKey = typeof STANDARD_UTILITY_KEYS[number];

/** Pretty labels for PDF rendering / admin UI. */
export const UTILITY_LABELS: Record<string, string> = {
  electric:         'Electric',
  gas:              'Gas',
  water:            'Water',
  sewer:            'Sewer',
  trash:            'Trash / Garbage',
  recycling:        'Recycling',
  internet:         'Internet',
  cable:            'Cable / Satellite TV',
  hoa:              'HOA Dues',
  lawn_care:        'Lawn Care',
  snow_removal:     'Snow Removal',
  pest_control:     'Pest Control',
  pool_maintenance: 'Pool Maintenance',
};

const VALID_RESPONSIBILITIES: ReadonlySet<string> = new Set([
  'tenant', 'landlord', 'shared', 'n/a',
]);

function coerceResponsibility(v: unknown): UtilityResponsibility {
  if (typeof v !== 'string') return 'n/a';
  const lower = v.toLowerCase().trim();
  if (lower === 'na' || lower === 'none' || lower === '') return 'n/a';
  if (VALID_RESPONSIBILITIES.has(lower)) return lower as UtilityResponsibility;
  return 'n/a';
}

/**
 * Normalize a raw value (from JSONB or admin form) into the canonical matrix
 * shape. Always returns an entry for every standard key, defaulting missing
 * entries to `{ responsibility: 'n/a', notes: '' }`. Custom (non-standard)
 * keys present in the input are preserved verbatim.
 */
export function normalizeUtilityMatrix(raw: unknown): UtilityMatrix {
  const out: UtilityMatrix = {};
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? raw as Record<string, unknown>
    : {};

  // Pre-populate standards.
  for (const k of STANDARD_UTILITY_KEYS) {
    out[k] = { responsibility: 'n/a', notes: '' };
  }

  for (const [key, val] of Object.entries(src)) {
    if (val == null) continue;
    if (typeof val === 'string') {
      out[key] = { responsibility: coerceResponsibility(val), notes: '' };
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      out[key] = {
        responsibility: coerceResponsibility(obj.responsibility),
        notes: typeof obj.notes === 'string' ? obj.notes.slice(0, 500) : '',
      };
    }
  }

  return out;
}

/** True if at least one utility is set to something other than 'n/a'. */
export function hasAnyAssignedUtility(matrix: UtilityMatrix): boolean {
  for (const v of Object.values(matrix)) {
    if (v.responsibility !== 'n/a') return true;
  }
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function labelFor(key: string): string {
  return UTILITY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const RESP_LABEL: Record<UtilityResponsibility, string> = {
  tenant:   'Tenant',
  landlord: 'Landlord',
  shared:   'Shared',
  'n/a':    'Not applicable',
};

/**
 * Render the matrix as an HTML table fragment for inclusion in the lease PDF
 * body. Only emits rows where the responsibility is not 'n/a' OR where notes
 * are present (so the PDF stays compact when most utilities are not assigned).
 *
 * If the matrix is entirely empty/unassigned, returns a neutral fallback
 * paragraph rather than an empty table.
 */
export function renderUtilityMatrixHtml(matrix: UtilityMatrix): string {
  const rows: string[] = [];
  // Render standard keys first (in canonical order), then any custom keys.
  const customKeys = Object.keys(matrix).filter(k => !(STANDARD_UTILITY_KEYS as readonly string[]).includes(k));
  const orderedKeys = [...STANDARD_UTILITY_KEYS, ...customKeys];

  for (const key of orderedKeys) {
    const e = matrix[key];
    if (!e) continue;
    if (e.responsibility === 'n/a' && !e.notes) continue;
    rows.push(
      `<tr>` +
        `<td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(labelFor(key))}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(RESP_LABEL[e.responsibility])}</td>` +
        `<td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(e.notes || '')}</td>` +
      `</tr>`
    );
  }

  if (rows.length === 0) {
    return `<p style="margin:6px 0;font-style:italic;">No utility responsibilities specified — refer to the Utilities clause above.</p>`;
  }

  return (
    `<table style="border-collapse:collapse;width:100%;font-size:12px;margin:8px 0 12px;">` +
      `<thead><tr style="background:#f4f4f4;">` +
        `<th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Utility / Service</th>` +
        `<th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Paid By</th>` +
        `<th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Notes</th>` +
      `</tr></thead><tbody>` +
      rows.join('') +
    `</tbody></table>`
  );
}

/** Plain-text rendering (for emails or text-mode PDFs). */
export function renderUtilityMatrixText(matrix: UtilityMatrix): string {
  const lines: string[] = [];
  const customKeys = Object.keys(matrix).filter(k => !(STANDARD_UTILITY_KEYS as readonly string[]).includes(k));
  const orderedKeys = [...STANDARD_UTILITY_KEYS, ...customKeys];

  for (const key of orderedKeys) {
    const e = matrix[key];
    if (!e) continue;
    if (e.responsibility === 'n/a' && !e.notes) continue;
    const noteSuffix = e.notes ? ` — ${e.notes}` : '';
    lines.push(`  • ${labelFor(key)}: ${RESP_LABEL[e.responsibility]}${noteSuffix}`);
  }
  return lines.length ? lines.join('\n') : '  • (none specified)';
}

/** Single-line summary (e.g. for email subject lines or compact UI). */
export function getUtilityResponsibilitySummary(matrix: UtilityMatrix): string {
  const tenant: string[] = [];
  const landlord: string[] = [];
  for (const key of STANDARD_UTILITY_KEYS) {
    const r = matrix[key]?.responsibility;
    if (r === 'tenant')   tenant.push(labelFor(key));
    if (r === 'landlord') landlord.push(labelFor(key));
  }
  const parts: string[] = [];
  if (tenant.length)   parts.push(`Tenant pays: ${tenant.join(', ')}`);
  if (landlord.length) parts.push(`Landlord pays: ${landlord.join(', ')}`);
  return parts.join(' · ') || 'Utility responsibilities not specified';
}
