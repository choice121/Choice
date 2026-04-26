# PHASE 08 — Move-In / Move-Out Condition Reports

**Status:** `TODO`
**Depends on:** Phase 01 (`DONE`), Phase 03 (`DONE`)
**Blocks:** Phase 09

---

## 1. Goal

Build a guided, photo-based room-by-room condition report for move-in (mandatory in CA, GA, KY, MD, MA, NH, NJ, VA, WA — required to deduct from security deposit at move-out) and move-out, signed by both parties, rendered into the lease packet.

## 2. Why

Without a documented baseline, security-deposit disputes are the #1 source of tenant complaints and small-claims filings. A signed move-in condition report eliminates 80% of those disputes and is *legally required* to withhold deposit in most states.

## 3. Scope — IN

- New table `lease_inspections` with columns:
  ```
  id UUID PK, app_id, inspection_type ('move_in'|'mid_term'|'move_out'),
  scheduled_for, completed_at, completed_by_role ('tenant'|'landlord'|'joint'),
  tenant_signed_at, landlord_signed_at, tenant_sig_image, landlord_sig_image,
  rooms JSONB, notes TEXT, photos_count INT,
  pdf_storage_path, pdf_sha256
  ```
- `rooms` JSONB structure per room:
  ```json
  {
    "kitchen": {
      "items": [
        { "name": "stove", "condition": "good|fair|poor|damaged", "notes": "…", "photo_paths": ["…"] },
        { "name": "refrigerator", "condition": "...", ... }
      ]
    },
    "living_room": { ... },
    "bedroom_1": { ... },
    ...
  }
  ```
- New table `lease_inspection_photos` (one row per uploaded photo: `path`, `room_key`, `item_key`, `caption`, `taken_at_exif`, `uploaded_by`).
- Photo storage: Supabase storage bucket `lease-inspection-photos` (private, RLS by app_id ownership). Compress on upload to <500KB max.
- New tenant-facing page `/tenant/inspection.html`:
  - Mobile-first guided wizard.
  - Standard rooms pre-selected: living room, kitchen, all bedrooms, bathrooms, laundry, exterior.
  - Per-item: condition dropdown + notes + add photo button (uses device camera).
  - "I confirm this report accurately reflects the condition of the property as of [date]" + signature pad.
- New landlord-facing page `/landlord/inspection-review.html` to review tenant report and counter-sign or note disagreements.
- New edge function `record-inspection` to persist + render PDF.
- Inspection PDF rendered into versioned `lease_pdf_versions` with event = `'inspection_movein'` / `'inspection_moveout'`.
- After move-in inspection completion, attach inspection summary to next renewal/amendment PDF generation.

## 4. Scope — OUT

- AI-assisted condition tagging from photos. Future phase.
- Walk-through scheduling integration (Calendly etc.). Future.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260504_phase08_inspections.sql
CREATE: supabase/functions/record-inspection/index.ts
CREATE: supabase/functions/_shared/inspection-pdf.ts
CREATE: tenant/inspection.html
CREATE: js/tenant/inspection.js
CREATE: landlord/inspection-review.html
CREATE: js/landlord/inspection-review.js
CREATE: admin/inspections.html
CREATE: js/admin/inspections.js
```

## 6. Storage bucket policies

- `lease-inspection-photos`: anonymous read denied. Tenant of the matching `app_id` can write (path scoped to `${app_id}/...`). Landlord of matching listing can read. Admin all access. Service role read/write.
- Use existing `lease-pdfs`-style policy patterns from `MIGRATION_SCHEMA.sql` lines around 649-680.

## 7. Image handling rules

- Free, no third-party image processing.
- Use browser-native `canvas` to resize to max 1600px on long edge before upload.
- Strip EXIF GPS but PRESERVE `DateTimeOriginal` (for the inspection record).
- Upload as JPEG quality 0.85.
- HEIC inputs converted with `heic2any` (already in repo per REPLIT.md commit notes).

## 8. Acceptance criteria

- [ ] Tenant can complete move-in inspection on a phone in <15 min, with photos.
- [ ] Inspection PDF renders with one room per page, photos inline.
- [ ] Landlord can counter-sign within their portal.
- [ ] States that require move-in checklist (CA, GA, KY, MD, MA, NH, NJ, VA, WA) show a warning in admin if the lease is fully executed but no `move_in` inspection exists 7 days post move-in.
- [ ] All photos stored under `lease-inspection-photos/${app_id}/...` with private RLS verified.
- [ ] Inspection PDF SHA-256 stored on `lease_inspections`.

## 9. Push & Stop

- [ ] Master row 08 = `DONE`. Commit: `Lease Phase 08 — condition reports`. STOP.
