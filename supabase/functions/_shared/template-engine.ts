// Choice Properties — Shared: template-engine.ts
//
// Phase 01 — Liquid-subset templating engine for lease/addendum bodies.
//
// Replaces the flat `{{var}}` regex substitution that lived in pdf.ts.
// Designed to support every Phase 02-13 brief without further refactoring:
// state-conditional clauses, per-utility loops, addendum partials, and
// future i18n.
//
// Supported syntax:
//
//   {{ var }}                       output (also accepts {{var}} no-spaces)
//   {{ var | filter }}              one filter
//   {{ var | filter:"arg" }}        filter with literal arg
//   {{ var | f1 | f2 }}             chained filters
//
//   {% if expr %} ... {% endif %}
//   {% if expr %} ... {% elsif expr %} ... {% else %} ... {% endif %}
//   {% for x in items %} ... {% endfor %}      (provides forloop.{index,first,last,length})
//   {% include "slug" %}            DB-resolved partial; cycle-detected
//   {% comment %} ... {% endcomment %}
//   {# inline comment #}            also stripped
//
// Predicate language (inside {% if %}):
//   literals: numbers, strings (double or single quoted), true, false, null
//   operators: == != > >= < <= and or not
//   parens: ( )
//   variables: dot-paths (e.g. tenant.name, state.code)
//
// Filters (built-in):
//   money    → "$1,234.56" | "" for null
//   date     → "April 27, 2026"
//   datetime → "April 27, 2026 02:15 PM"
//   upper    → uppercase
//   lower    → lowercase
//   default:"X" → fallback if empty/null
//   escape_pdf  → strips/maps non-WinAnsi characters (mirror sanitizeForPDF)
//
// All public functions are pure — no side effects beyond what the caller
// passes in via opts.partials. This keeps the engine unit-testable without
// any database.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type RenderContext = Record<string, unknown>;
export type PartialResolver = (slug: string) => Promise<string | null>;

export interface RenderOptions {
  partials?: PartialResolver;
  /** Hard cap on nested includes to prevent runaway recursion. Default 8. */
  maxIncludeDepth?: number;
  /** When true, missing variables throw. When false, they render as ''. */
  strict?: boolean;
}

const DEFAULTS: Required<Omit<RenderOptions, 'partials'>> = {
  maxIncludeDepth: 8,
  strict: false,
};

// ─────────────────────────────────────────────────────────────────────
// AST node types
// ─────────────────────────────────────────────────────────────────────

interface NText { type: 'text'; value: string }
interface NOutput { type: 'output'; path: string; filters: FilterCall[] }
interface NIf { type: 'if'; branches: { cond: Expr; body: Node[] }[]; elseBody?: Node[] }
interface NFor { type: 'for'; varName: string; iterable: Expr; body: Node[] }
interface NInclude { type: 'include'; slug: string }
type Node = NText | NOutput | NIf | NFor | NInclude;

interface FilterCall { name: string; args: (string | number | boolean | null)[] }

// Predicate AST
type Expr =
  | { kind: 'lit'; value: string | number | boolean | null }
  | { kind: 'var'; path: string }
  | { kind: 'unary'; op: 'not'; arg: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr };

// ─────────────────────────────────────────────────────────────────────
// Tokenizer — produces a flat list of {kind, value} chunks
// ─────────────────────────────────────────────────────────────────────

type RawToken =
  | { kind: 'text'; value: string }
  | { kind: 'output'; value: string }
  | { kind: 'tag'; value: string };

function tokenize(src: string): RawToken[] {
  // Strip {# ... #} inline comments first (they leave no node)
  src = src.replace(/\{#[\s\S]*?#\}/g, '');

  const tokens: RawToken[] = [];
  const re = /\{\{-?([\s\S]+?)-?\}\}|\{%-?([\s\S]+?)-?%\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', value: src.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ kind: 'output', value: m[1].trim() });
    else                    tokens.push({ kind: 'tag',    value: m[2].trim() });
    last = re.lastIndex;
  }
  if (last < src.length) tokens.push({ kind: 'text', value: src.slice(last) });
  return tokens;
}

// ─────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────

function parse(tokens: RawToken[]): Node[] {
  let i = 0;

  function parseBlock(stopOn: (tagWord: string) => boolean): Node[] {
    const out: Node[] = [];
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.kind === 'tag') {
        const word = t.value.split(/\s+/)[0];
        if (stopOn(word)) return out;
      }
      out.push(parseOne());
    }
    return out;
  }

  function parseOne(): Node {
    const t = tokens[i++];
    if (t.kind === 'text')   return { type: 'text', value: t.value };
    if (t.kind === 'output') return parseOutput(t.value);
    return parseTag(t.value);
  }

  function parseOutput(raw: string): NOutput {
    const segs = splitFilters(raw);
    const path = segs.shift()!;
    const filters: FilterCall[] = segs.map((seg) => parseFilterCall(seg));
    return { type: 'output', path, filters };
  }

  function parseTag(raw: string): Node {
    const word = raw.split(/\s+/)[0];
    const rest = raw.slice(word.length).trim();

    if (word === 'if') {
      const branches: NIf['branches'] = [{ cond: parseExpr(rest), body: [] }];
      let elseBody: Node[] | undefined;
      branches[0].body = parseBlock((w) => w === 'elsif' || w === 'else' || w === 'endif');
      while (i < tokens.length) {
        const t = tokens[i];
        if (t.kind !== 'tag') break;
        const w = t.value.split(/\s+/)[0];
        if (w === 'elsif') {
          const eRest = t.value.slice('elsif'.length).trim();
          i++;
          const body = parseBlock((w2) => w2 === 'elsif' || w2 === 'else' || w2 === 'endif');
          branches.push({ cond: parseExpr(eRest), body });
        } else if (w === 'else') {
          i++;
          elseBody = parseBlock((w2) => w2 === 'endif');
        } else if (w === 'endif') {
          i++;
          return { type: 'if', branches, elseBody };
        } else {
          break;
        }
      }
      throw new TemplateError('Unterminated {% if %}');
    }

    if (word === 'for') {
      const m = rest.match(/^(\w+)\s+in\s+(.+)$/);
      if (!m) throw new TemplateError(`Bad {% for %} syntax: ${rest}`);
      const body = parseBlock((w2) => w2 === 'endfor');
      if (i >= tokens.length || tokens[i].kind !== 'tag' || tokens[i].value.split(/\s+/)[0] !== 'endfor') {
        throw new TemplateError('Unterminated {% for %}');
      }
      i++;
      return { type: 'for', varName: m[1], iterable: parseExpr(m[2]), body };
    }

    if (word === 'include') {
      const m = rest.match(/^["']([^"']+)["']$/);
      if (!m) throw new TemplateError(`Bad {% include %} syntax: ${rest}`);
      return { type: 'include', slug: m[1] };
    }

    if (word === 'comment') {
      while (i < tokens.length) {
        const t = tokens[i++];
        if (t.kind === 'tag' && t.value.split(/\s+/)[0] === 'endcomment') {
          return { type: 'text', value: '' };
        }
      }
      throw new TemplateError('Unterminated {% comment %}');
    }

    throw new TemplateError(`Unknown tag: ${word}`);
  }

  function splitFilters(s: string): string[] {
    // Split on '|' but not inside quoted strings.
    const out: string[] = [];
    let buf = '';
    let q: string | null = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { buf += c; if (c === q && s[k - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; buf += c; continue; }
      if (c === '|') { out.push(buf.trim()); buf = ''; continue; }
      buf += c;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function parseFilterCall(seg: string): FilterCall {
    const colon = seg.indexOf(':');
    if (colon === -1) return { name: seg.trim(), args: [] };
    const name = seg.slice(0, colon).trim();
    const argStr = seg.slice(colon + 1).trim();
    const args = splitFilterArgs(argStr).map(parseLiteral);
    return { name, args };
  }

  function splitFilterArgs(s: string): string[] {
    const out: string[] = [];
    let buf = '';
    let q: string | null = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) { buf += c; if (c === q && s[k - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; buf += c; continue; }
      if (c === ',') { out.push(buf.trim()); buf = ''; continue; }
      buf += c;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  return parseBlock(() => false);
}

function parseLiteral(raw: string): string | number | boolean | null {
  raw = raw.trim();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === 'nil') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  // Bare identifier as literal — treated as a string for filter args.
  return raw;
}

// ─────────────────────────────────────────────────────────────────────
// Predicate parser (recursive descent)
// ─────────────────────────────────────────────────────────────────────

function parseExpr(src: string): Expr {
  const tokens = tokenizeExpr(src);
  let i = 0;

  function peek(): string | undefined { return tokens[i]; }
  function eat(t?: string): string { const x = tokens[i++]; if (t && x !== t) throw new TemplateError(`Expected ${t} got ${x}`); return x; }

  function parseOr(): Expr {
    let left = parseAnd();
    while (peek() === 'or') { eat(); left = { kind: 'binary', op: 'or', left, right: parseAnd() }; }
    return left;
  }
  function parseAnd(): Expr {
    let left = parseNot();
    while (peek() === 'and') { eat(); left = { kind: 'binary', op: 'and', left, right: parseNot() }; }
    return left;
  }
  function parseNot(): Expr {
    if (peek() === 'not') { eat(); return { kind: 'unary', op: 'not', arg: parseNot() }; }
    return parseCmp();
  }
  function parseCmp(): Expr {
    const left = parsePrimary();
    const op = peek();
    if (op && ['==', '!=', '>', '>=', '<', '<='].includes(op)) {
      eat();
      return { kind: 'binary', op, left, right: parsePrimary() };
    }
    return left;
  }
  function parsePrimary(): Expr {
    const t = eat();
    if (t === '(') { const e = parseOr(); eat(')'); return e; }
    if (t === 'true' || t === 'false') return { kind: 'lit', value: t === 'true' };
    if (t === 'null' || t === 'nil')   return { kind: 'lit', value: null };
    if (/^-?\d+(\.\d+)?$/.test(t))     return { kind: 'lit', value: Number(t) };
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return { kind: 'lit', value: t.slice(1, -1) };
    }
    return { kind: 'var', path: t };
  }
  const out = parseOr();
  if (i !== tokens.length) throw new TemplateError(`Trailing tokens in expr: ${tokens.slice(i).join(' ')}`);
  return out;
}

function tokenizeExpr(src: string): string[] {
  const out: string[] = [];
  const re = /\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|==|!=|>=|<=|>|<|\(|\)|\b(?:and|or|not|true|false|null|nil)\b|-?\d+(?:\.\d+)?|[A-Za-z_][\w.]*)/g;
  let m: RegExpExecArray | null;
  let pos = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index !== pos && src.slice(pos, m.index).trim() !== '') {
      throw new TemplateError(`Bad token at: ${src.slice(pos)}`);
    }
    out.push(m[1]);
    pos = re.lastIndex;
  }
  if (pos < src.length && src.slice(pos).trim() !== '') {
    throw new TemplateError(`Trailing chars in expr: ${src.slice(pos)}`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────

export class TemplateError extends Error { constructor(m: string) { super('[template] ' + m); } }

// Block prototype-chain access so a malicious template path like
// `__proto__.polluted` or `constructor.prototype` cannot read or be used
// as a vector to mutate Object.prototype downstream. Templates are
// server-controlled today, but this is cheap defense in depth.
const FORBIDDEN_LOOKUP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function lookup(ctx: RenderContext, path: string): unknown {
  if (path === '.') return ctx;
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (FORBIDDEN_LOOKUP_KEYS.has(p)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function evalExpr(e: Expr, ctx: RenderContext): unknown {
  switch (e.kind) {
    case 'lit': return e.value;
    case 'var': return lookup(ctx, e.path);
    case 'unary': return !truthy(evalExpr(e.arg, ctx));
    case 'binary': {
      if (e.op === 'and') return truthy(evalExpr(e.left, ctx)) && truthy(evalExpr(e.right, ctx));
      if (e.op === 'or')  return truthy(evalExpr(e.left, ctx)) || truthy(evalExpr(e.right, ctx));
      const l = evalExpr(e.left, ctx);
      const r = evalExpr(e.right, ctx);
      switch (e.op) {
        case '==': return looseEq(l, r);
        case '!=': return !looseEq(l, r);
        case '>':  return numeric(l) >  numeric(r);
        case '>=': return numeric(l) >= numeric(r);
        case '<':  return numeric(l) <  numeric(r);
        case '<=': return numeric(l) <= numeric(r);
      }
      throw new TemplateError(`Unsupported operator ${e.op}`);
    }
  }
}

function truthy(v: unknown): boolean {
  if (v == null || v === false || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
function looseEq(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
function numeric(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  return Number(v);
}

// Built-in filters

const FILTERS: Record<string, (v: unknown, ...args: unknown[]) => string> = {
  money: (v) => {
    if (v == null || v === '') return '';
    const n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return '';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  date: (v) => {
    if (v == null || v === '') return '';
    try { return new Date(String(v)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return String(v); }
  },
  datetime: (v) => {
    if (v == null || v === '') return '';
    try { return new Date(String(v)).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return String(v); }
  },
  upper: (v) => v == null ? '' : String(v).toUpperCase(),
  lower: (v) => v == null ? '' : String(v).toLowerCase(),
  default: (v, fallback) => {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return String(fallback ?? '');
    return String(v);
  },
  escape_pdf: (v) => sanitizeForPDF(v == null ? '' : String(v)),
};

/** Mirrors the WinAnsi sanitizer in pdf.ts so escape_pdf produces identical output. */
function sanitizeForPDF(text: string): string {
  return text
    .replace(/[\u2500-\u257F]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?');
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export async function renderTemplate(
  body: string,
  ctx: RenderContext,
  opts?: RenderOptions,
): Promise<string> {
  const cfg = { ...DEFAULTS, ...(opts ?? {}) };
  const ast = parse(tokenize(body));
  return await renderNodes(ast, ctx, cfg, opts?.partials, new Set(), 0);
}

/**
 * Synchronous render — only safe when the template contains no
 * {% include %} tags. Used for a thin backward-compat path in pdf.ts
 * (substituteVars wrapper). Throws on include nodes.
 */
export function renderTemplateSync(
  body: string,
  ctx: RenderContext,
  opts?: { strict?: boolean },
): string {
  const cfg = { ...DEFAULTS, ...(opts ?? {}) };
  const ast = parse(tokenize(body));
  return renderNodesSync(ast, ctx, cfg);
}

async function renderNodes(
  nodes: Node[],
  ctx: RenderContext,
  cfg: Required<Omit<RenderOptions, 'partials'>>,
  partials: PartialResolver | undefined,
  stack: Set<string>,
  depth: number,
): Promise<string> {
  let out = '';
  for (const n of nodes) out += await renderNode(n, ctx, cfg, partials, stack, depth);
  return out;
}

function renderNodesSync(
  nodes: Node[],
  ctx: RenderContext,
  cfg: Required<Omit<RenderOptions, 'partials'>>,
): string {
  let out = '';
  for (const n of nodes) out += renderNodeSync(n, ctx, cfg);
  return out;
}

async function renderNode(
  n: Node,
  ctx: RenderContext,
  cfg: Required<Omit<RenderOptions, 'partials'>>,
  partials: PartialResolver | undefined,
  stack: Set<string>,
  depth: number,
): Promise<string> {
  switch (n.type) {
    case 'text':   return n.value;
    case 'output': return renderOutput(n, ctx, cfg);
    case 'if': {
      for (const br of n.branches) if (truthy(evalExpr(br.cond, ctx))) return await renderNodes(br.body, ctx, cfg, partials, stack, depth);
      return n.elseBody ? await renderNodes(n.elseBody, ctx, cfg, partials, stack, depth) : '';
    }
    case 'for': {
      const arr = evalExpr(n.iterable, ctx);
      if (!Array.isArray(arr)) return '';
      let out = '';
      for (let k = 0; k < arr.length; k++) {
        const childCtx: RenderContext = {
          ...ctx,
          [n.varName]: arr[k],
          forloop: { index: k + 1, index0: k, first: k === 0, last: k === arr.length - 1, length: arr.length },
        };
        out += await renderNodes(n.body, childCtx, cfg, partials, stack, depth);
      }
      return out;
    }
    case 'include': {
      if (!partials) throw new TemplateError(`No partial resolver supplied for {% include "${n.slug}" %}`);
      if (depth >= cfg.maxIncludeDepth) throw new TemplateError(`Include depth exceeded (${cfg.maxIncludeDepth}) at "${n.slug}"`);
      if (stack.has(n.slug)) throw new TemplateError(`Cyclic include detected: ${[...stack, n.slug].join(' -> ')}`);
      const body = await partials(n.slug);
      if (body == null) throw new TemplateError(`Partial not found: "${n.slug}"`);
      const newStack = new Set(stack); newStack.add(n.slug);
      const sub = parse(tokenize(body));
      return await renderNodes(sub, ctx, cfg, partials, newStack, depth + 1);
    }
  }
}

function renderNodeSync(
  n: Node,
  ctx: RenderContext,
  cfg: Required<Omit<RenderOptions, 'partials'>>,
): string {
  switch (n.type) {
    case 'text':   return n.value;
    case 'output': return renderOutput(n, ctx, cfg);
    case 'if': {
      for (const br of n.branches) if (truthy(evalExpr(br.cond, ctx))) return renderNodesSync(br.body, ctx, cfg);
      return n.elseBody ? renderNodesSync(n.elseBody, ctx, cfg) : '';
    }
    case 'for': {
      const arr = evalExpr(n.iterable, ctx);
      if (!Array.isArray(arr)) return '';
      let out = '';
      for (let k = 0; k < arr.length; k++) {
        const childCtx: RenderContext = {
          ...ctx,
          [n.varName]: arr[k],
          forloop: { index: k + 1, index0: k, first: k === 0, last: k === arr.length - 1, length: arr.length },
        };
        out += renderNodesSync(n.body, childCtx, cfg);
      }
      return out;
    }
    case 'include':
      throw new TemplateError(`Sync render cannot resolve {% include "${n.slug}" %}; use async renderTemplate`);
  }
}

function renderOutput(n: NOutput, ctx: RenderContext, cfg: { strict: boolean }): string {
  let v: unknown = lookup(ctx, n.path);
  if (v === undefined) {
    if (cfg.strict && n.filters.every((f) => f.name !== 'default')) {
      throw new TemplateError(`Undefined variable in output: ${n.path}`);
    }
    v = '';
  }
  for (const f of n.filters) {
    const fn = FILTERS[f.name];
    if (!fn) throw new TemplateError(`Unknown filter: ${f.name}`);
    v = fn(v, ...f.args);
  }
  return v == null ? '' : String(v);
}

// ─────────────────────────────────────────────────────────────────────
// Supabase-backed partial resolver — used by edge functions
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns a PartialResolver that pulls partials from the
 * lease_template_partials table. Caches per-call to avoid duplicate
 * roundtrips when the same partial is included multiple times.
 *
 * Edge functions construct one resolver per request:
 *   const resolver = createSupabasePartialResolver(supabase);
 *   const html = await renderTemplate(body, ctx, { partials: resolver });
 */
export function createSupabasePartialResolver(client: SupabaseClient): PartialResolver {
  const cache = new Map<string, string | null>();
  return async (slug: string) => {
    if (cache.has(slug)) return cache.get(slug)!;
    const { data, error } = await client
      .from('lease_template_partials')
      .select('body')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      console.warn(`[template-engine] partial fetch error for "${slug}":`, error.message);
      cache.set(slug, null);
      return null;
    }
    const body = data?.body ?? null;
    cache.set(slug, body);
    return body;
  };
}
