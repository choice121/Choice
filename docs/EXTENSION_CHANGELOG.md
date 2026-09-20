# Chrome Extension Changelog & Version History

All modifications, extractor enhancements, and UI upgrades to the Choice Properties Chrome Extension are recorded here.

---

## [v12.0.0] - 2026-09-20
### Added
- **Pipeline Source Badges**: Added distinct high-contrast color badges and filter tabs for all 7 supported portals (`Zillow`, `Realtor`, `Opendoor`, `Progress Residential`, `CJ Real Estate`, `Apartments.com`, `Redfin`) in `admin/pipeline.html`.
- **Smart Duplicate Toast**: Re-assigning an already existing pipeline property to a new folder now displays a positive green status toast (`Updated Folder (<folder_name>)`) instead of an ambiguous warning.

---

## [v11.0.0] - 2026-09-20
### Added
- **Target Folder Selection**: Added dynamic folder selection dropdown inside the in-page widget.
- **Dynamic API Sync**: Fetches active pipeline folders from `receive-pipeline-import?action=list_folders` on widget mount.
- **Payload Binding**: Injects `folder_id` into the JSON payload for instant automated staging folder assignment.

---

## [v10.0.0] - 2026-09-20
### Added
- **Expanded Portal Coverage (7 Portals Total)**: Added dedicated extractor modules for:
  - `Opendoor` (Hydrated state & gallery extraction).
  - `Progress Residential` (Corporate single-family rental feed normalization).
  - `CJ Real Estate` (AppFolio/Propertyware syndication engine).
- **Rule 6A Zero Truncation**: Enforced strict fractional bathroom decimal retention (`1.5`, `2.5`, `3.5`) across all extractors.
- **Rule 6B Smart Architectural Classifier**: Auto-classifies attached duplexes/side-by-side units as `DUPLEX`.
- **High-Res Hydration**: Scrapes full-scale 1536px uncropped photography directly from application cache states.

---

## [v9.0.0] - Earlier Build
### Added
- Core 4-portal support (`Zillow`, `Realtor`, `Apartments.com`, `Redfin`).
- In-page injection widget with draggable coordinates and Supabase edge function proxy.
