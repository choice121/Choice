UPDATE public.zillow_gallery_reference_reports AS reports
SET report = jsonb_set(
  reports.report,
  '{controls}',
  (
    SELECT COALESCE(jsonb_agg(control), '[]'::jsonb)
    FROM jsonb_array_elements(reports.report->'controls') AS control
    WHERE control->>'tag' = 'button'
      AND (
        concat_ws(
          ' ',
          control->>'label',
          control->>'ariaLabel',
          control->>'title'
        ) ~* '(photo|image|gallery|picture|carousel)'
        OR lower(btrim(coalesce(control->>'label', ''))) ~ '^(close|next|previous|prev)( photo)?$'
        OR lower(btrim(coalesce(control->>'groupLabel', ''))) = 'photo scenes'
      )
  ),
  true
)
WHERE jsonb_typeof(reports.report->'controls') = 'array';
