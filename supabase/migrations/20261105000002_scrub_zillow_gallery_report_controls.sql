UPDATE public.zillow_gallery_reference_reports AS reports
SET report = jsonb_set(
  reports.report,
  '{controls}',
  (
    SELECT COALESCE(jsonb_agg(control), '[]'::jsonb)
    FROM jsonb_array_elements(reports.report->'controls') AS control
    WHERE control->>'tag' = 'button'
       OR control->>'role' IN ('button', 'tab')
  ),
  true
)
WHERE jsonb_typeof(reports.report->'controls') = 'array';
