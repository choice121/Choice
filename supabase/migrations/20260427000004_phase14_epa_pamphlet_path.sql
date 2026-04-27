-- 20260427000004_phase14_epa_pamphlet_path.sql
  -- Phase 14: point federal/lead-paint addendum at the 2026 EPA pamphlet
  -- edition that was just committed to the repo. The 2020 edition the row
  -- previously referenced was never actually present in assets/legal/, so
  -- every pre-1978 lease was rendering the graceful-fallback footer
  -- instead of embedding the pamphlet PDF. EPA refreshed the pamphlet in
  -- Feb 2026; this aligns the DB with the file now sitting on disk.
  -- Idempotent: only updates if the row exists and still points at 2020.

  UPDATE public.lease_addenda_library
     SET attached_pdf_path = 'assets/legal/epa-lead-pamphlet-2026.pdf',
         source_url        = 'https://www.epa.gov/lead/protect-your-family-lead-your-home-english',
         updated_at        = now()
   WHERE slug = 'federal/lead-paint'
     AND attached_pdf_path = 'assets/legal/epa-lead-pamphlet-2020.pdf';
  