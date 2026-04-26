# Phase E — Photo & Media Quality

**Status:** Not started
**Risk:** Medium (touches the upload pipeline; needs careful staging)
**Impact:** High (photos are the #1 conversion driver on a rentals site)
**Depends on:** Nothing (Phase A nice-to-have)
**Blocks:** Phase G (the "Verified by Choice" badge wants alt + watermark provenance)

---

## Goal

Raise the photographic quality bar:

1. Strip third-party watermarks baked into source photos before
   applying our own. (Visible on at least one card in the live
   screenshot — "Zen Hospitality" overlay still present.)
2. Refuse to publish a property with fewer than 3 photos. 137 active
   listings currently violate this and look thin in the gallery.
3. Auto-generate descriptive `alt` text for every photo (not the
   templated "<title> photo 3" we render today).
4. Run a periodic janitor that finds orphan storage objects (file in
   the bucket with no row in `property_photos`) and deletes them.

## Files touched

| Layer | File | Change |
|---|---|---|
| Edge fn | `supabase/functions/imagekit-upload/index.ts` | Before applying our watermark, run a small CV check that flags the image if it already contains text that looks like a third-party watermark. Flagged uploads land with `watermark_status='needs_review'` instead of `applied`. |
| Edge fn | `supabase/functions/_shared/photo-quality.ts` (new) | `detectThirdPartyWatermark(bytes)` — returns boolean + reason. Cheapest implementation: send to Cloudflare Workers AI vision binding (`@cf/llava-1.5-7b-hf`) with prompt "Does this image contain text overlay or watermark from a brand other than Choice Properties? Respond YES/NO and the brand if visible." |
| Edge fn | `supabase/functions/_shared/photo-quality.ts` (same) | `generateAltText(bytes, propertyContext)` — same vision binding, prompt "Describe this rental property photo in one sentence (max 120 chars). Do not include the address or any text overlays." |
| DB | `supabase/migrations/<DATE>_phaseE01_photo_quality.sql` (new) | Add `watermark_status` enum value `'needs_review'`; add `quality_flags jsonb` column to `property_photos` with `{ third_party_watermark?: string, low_resolution?: bool, blurry?: bool }` |
| DB | `supabase/migrations/<DATE>_phaseE02_publish_min_photos.sql` (new) | New CHECK or trigger: `BEFORE UPDATE ON properties` — if `NEW.status='active' AND (SELECT COUNT(*) FROM property_photos WHERE property_id=NEW.id) < 3` then `RAISE EXCEPTION` |
| Edge fn | `supabase/functions/storage-orphan-cleanup/index.ts` (new) | Cron job (Supabase scheduled function): list bucket objects, look up each prefix `properties/<id>/` against `property_photos`, delete files with no DB row. Logs to a new `storage_cleanup_log` table. |
| Admin | `admin/properties.html` + js | New "Quality" column / chip showing `needs_review` count. |

## Acceptance criteria

- [ ] Uploading a photo that contains a third-party watermark lands as `watermark_status='needs_review'` and is excluded from the public gallery (`property_photos_public_read` policy filter).
- [ ] An admin can manually approve a `needs_review` photo (flips to `applied`).
- [ ] No active property has fewer than 3 photos. The 137 currently in violation are either re-shot, supplemented, or moved to `draft` with a reason.
- [ ] Every new photo gets an LLM-generated `alt_text` populated within 30s of upload.
- [ ] Orphan-cleanup runs daily; first run reports any orphans (expected 0 today; track over time).

## Verification

```sql
-- New photos getting alt text auto-populated
SELECT COUNT(*) FROM property_photos
 WHERE created_at > NOW() - interval '1 day'
   AND (alt_text IS NULL OR alt_text = '');
-- expected: 0 after first cron tick

-- No active property under 3 photos
SELECT p.id, COUNT(pp.id) AS n
  FROM properties p
  LEFT JOIN property_photos pp ON pp.property_id = p.id
 WHERE p.status = 'active'
 GROUP BY p.id
HAVING COUNT(pp.id) < 3;
-- expected: 0 rows

-- Orphan storage objects (run as scheduled report)
SELECT * FROM storage_cleanup_log ORDER BY ran_at DESC LIMIT 5;
```

## Rollback

- Disable the publish trigger: `ALTER TABLE properties DISABLE TRIGGER trg_min_photos_to_publish;`
- Revert the upload Edge Function to skip the CV check by feature-flagging via a `PHOTO_QUALITY_ENABLED=false` Supabase secret.

## Estimated complexity

- 2 migrations
- 1 new shared TS module (~120 lines)
- 1 Edge Function update (~40 lines)
- 1 new scheduled Edge Function (~80 lines)
- ~1.5 days; the vision binding tuning is the unknown
