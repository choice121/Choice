// Choice Properties — Shared: Utility functions
// Helpers used across multiple Edge Functions.

import { buildCorsHeaders, cors } from './cors.ts';

// Extract the real client IP from Supabase Edge Function request headers.
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Return a JSON Response with CORS headers.
// Pass `req` to resolve the correct Allow-Origin for preview-deploy origins;
// omit to fall back to the static production origin (backwards-compatible).
export function jsonResponse(
  data: any,
  status = 200,
  extraHeaders: Record<string, string> = {},
  req?: Request | null,
): Response {
  const corsHdrs = req
    ? buildCorsHeaders(req.headers.get('origin'))
    : { ...cors };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHdrs, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
