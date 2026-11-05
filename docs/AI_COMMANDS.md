# Pipeline AI Commands

This document defines natural-language commands that any AI assistant (or human) can use to manage the Choice Properties pipeline.

---

## Getting Started (For Any Fork / AI)

Any AI or user that forks this repo can work **end-to-end without restrictions**:

```bash
# Load all credentials instantly (publicly-readable Supabase table)
npm run load-credentials
```

This creates `.env.local` with all API keys (no manual entry).

To **update** shared credentials (one-time, requires write secret from `credentials-config.js`):

```bash
npm run setup-credentials
```

Then work on the pipeline, build, deploy, push — see `CONTRIBUTING.md` for the full workflow.

## Folder System Overview

Properties in the pipeline can be grouped into **folders** (also called "rooms" or "houses"). Each folder has a **name** and properties inside it get **auto-assigned serial numbers** (#1, #2, #3...) based on arrival order.

Example: You create a folder called "Wisdom" and add 12 properties. The first property added becomes **#1**, the second becomes **#2**, and so on.

---

## Available Commands

## Publishing visibility — required default

- Adding/importing a listing to the pipeline only stages it; it does not publish it.
- Publishing one or more pipeline listings defaults to `private_placement`, including bulk and folder workflows. The listing stays off public search and direct public property pages.
- To make a listing public, the user must explicitly request public visibility. Then call `pipeline_publish` with `p_status: 'active'`. Never treat “publish,” “approve,” “live,” or “make a magic link” by itself as approval for public release.
- To share private placements, publish them privately first, then create a magic link. A share link grants access only to the included properties; it does not change their public/private status.
- Do not call legacy `pipeline_folder_publish` for new AI workflows. Resolve each unpublished property in the folder, validate it, and call `pipeline_publish` with `p_status: 'private_placement'` unless the user specifically requested public release.
- If an AI tool or RPC cannot pass visibility explicitly, stop and ask for confirmation rather than relying on an unknown/default status.

### Create a Folder
> "Create a folder called Wisdom"
> "Make me a room called Columbus Q3"

**Maps to:** `pipeline_folder_create(p_name: 'Wisdom')`

### List All Folders
> "Show me all my folders"
> "What folders do I have?"

**Maps to:** `pipeline_folder_list()`

Returns: folder name, description, property count, published count, archived count.

### Show Properties in a Folder
> "Show me properties in folder Wisdom"
> "What's in the Columbus folder?"

**Maps to:** `pipeline_folder_properties(p_folder_id: '<resolved from name>')`

Returns: each property with its serial number, address, rent, status, quality score.

### Add a Property to a Folder
> "Add property PP-ABC123 to folder Wisdom"
> "Put this listing in my Columbus folder"

**Maps to:** `pipeline_folder_add_property(p_property_id: 'PP-ABC123', p_folder_name: 'Wisdom')`

The system auto-assigns the next serial number.

### Remove a Property from a Folder
> "Remove property 3 from folder Wisdom"
> "Take property PP-ABC123 out of its folder"

**Maps to:** `pipeline_folder_remove_property(p_property_id: '<resolved from serial>')`

### Publish All Properties in a Folder
> "Publish everything in folder Wisdom"
> "Publish all properties in Columbus"

**Default behavior:** Publish each eligible property using `pipeline_publish(p_id: '<property id>', p_status: 'private_placement')`, then report the private-placement result. Do not use the legacy folder publish RPC.

**Public release only when explicitly requested:** Use `p_status: 'active'` for each record.

### Publish a Specific Property in a Folder
> "Publish property 3 in folder Wisdom"
> "Publish #5 in the Columbus folder"

**Maps to:**
1. Look up property by serial: `SELECT id FROM pipeline_properties WHERE folder_id = '<folder>' AND folder_serial = 3`
2. Call `pipeline_publish(p_id: '<property id>', p_status: 'private_placement')` by default

By default this creates a private placement. Pass `p_status: 'active'` only when the user explicitly requested public release.

### Delete a Folder
> "Delete folder Wisdom"
> "Remove the Columbus folder"

**Maps to:** `pipeline_folder_delete(p_folder_id: '<resolved>')`

**What happens:** All unpublished properties in the folder are **archived** (kept in the pipeline but hidden). Published properties are unassigned from the folder. The folder itself is deleted.

### Get Folder Stats
> "How many properties in folder Wisdom?"
> "Show me stats for Wisdom"

**Maps to:** `pipeline_folder_stats(p_folder_name: 'Wisdom')`

Returns: total, published, scraped, edited, archived counts, plus full property list with serials.

### Rename a Folder
> "Rename folder Wisdom to Wisdom2"
> "Call the Columbus folder Columbus Q4"

**Maps to:** `pipeline_folder_rename(p_folder_id: '<resolved>', p_new_name: 'Wisdom2')`

---

## How an AI Should Resolve References

When given a command like "publish property 3 in folder Wisdom":

1. **Resolve folder name → ID:**
   ```sql
   SELECT id FROM pipeline.pipeline_folders WHERE name ILIKE '%wisdom%'
   ```

2. **Resolve serial → property ID:**
   ```sql
   SELECT id FROM pipeline.pipeline_properties
   WHERE folder_id = '<folder_id>' AND folder_serial = 3
   ```

3. **Execute the action:**
   ```sql
   SELECT * FROM public.pipeline_publish('<property_id>', NULL, 'private_placement')
   ```

   For an explicitly requested public release, use `'active'` instead of `'private_placement'`.

---

## Resolving Properties Without Serials

If a property doesn't have a folder_serial, you can find it by:
- **ID** (e.g., `PP-ABC12345`)
- **Address** (e.g., "the one on 123 Main St")
- **City + rent** (e.g., "the $1500 one in Austin")

---

## ImageKit Cleanup Strategy

To keep ImageKit storage lean:

1. **When archiving a property:** Call `imagekit-delete` edge function to delete photos from ImageKit after archiving.
2. **When deleting a folder:** Properties are archived (photos preserved for potential re-publish). To purge, use the "Purge archived photos" admin action.
3. **Regular hygiene:** Run `pipeline_cleanup_orphans()` RPC to find pipeline records with no photos and clean them up.

---

## Notes for AI Assistants

- Always confirm destructive actions (delete folder, archive) with the user first
- Serial numbers are per-folder, starting at 1
- A property can only be in one folder at a time
- Properties don't need to be in a folder — folders are optional organizational tools
- The `pipeline_folder_add_property` RPC auto-creates the folder if it doesn't exist (in future versions)