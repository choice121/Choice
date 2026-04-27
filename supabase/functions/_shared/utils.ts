// Choice Properties — Shared: Utility functions
// Helpers used across multiple Edge Functions.

import { cors } from './cors.ts';

// Extract the real client IP from Supabase Edge Function request headers.
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Return a JSON Response with CORS headers.
export function jsonResponse(data: any, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
