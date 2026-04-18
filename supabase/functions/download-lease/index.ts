import { createClient } from 'npm:@supabase/supabase-js@2';
  import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  async function verifyAdmin(req: Request) {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return { ok: false };
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { ok: false };
    const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).single();
    return { ok: !!role };
  }

  Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    const auth = await verifyAdmin(req);
    if (!auth.ok) return jsonErr(401, 'Unauthorized');

    let app_id: string | null = null;
    if (req.method === 'POST') {
      try { const b = await req.json(); app_id = b.app_id; } catch { return jsonErr(400, 'Invalid JSON'); }
    } else {
      app_id = new URL(req.url).searchParams.get('app_id');
    }
    if (!app_id) return jsonErr(400, 'Missing app_id');

    const { data: app } = await supabase
      .from('applications').select('lease_pdf_url').eq('app_id', app_id).single();
    if (!app?.lease_pdf_url) return jsonErr(404, 'Lease PDF not found for this application');

    const { data: signed, error: signErr } = await supabase.storage
      .from('lease-pdfs').createSignedUrl(app.lease_pdf_url, 3600);
    if (signErr) return jsonErr(500, 'Could not generate download link: ' + signErr.message);

    return jsonOk({ signed_url: signed.signedUrl });
  });
  