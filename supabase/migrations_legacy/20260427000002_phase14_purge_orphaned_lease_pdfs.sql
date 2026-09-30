-- Phase 14 — purge_orphaned_lease_pdfs()
--
-- Storage in the lease-pdfs bucket can drift out of sync with
-- lease_pdf_versions when:
--   • An old generate-lease run failed mid-write
--   • A lease was hard-deleted before its PDFs (Phase 10 introduced
--     ON DELETE CASCADE for the back-ref but old objects remain)
--   • A pre-Phase-06 PDF was uploaded without an integrity row
--
-- This function returns a list of orphan paths and (optionally) deletes them.
-- It is SECURITY DEFINER because it must read storage.objects and call
-- storage.delete_object_by_id, but it explicitly REVOKE EXECUTEs from
-- anon and authenticated; only service-role and admin RPCs may invoke it.
--
-- Usage (always start with dry_run=true):
--   select * from public.purge_orphaned_lease_pdfs(true);   -- preview
--   select * from public.purge_orphaned_lease_pdfs(false);  -- delete

create or replace function public.purge_orphaned_lease_pdfs(p_dry_run boolean default true)
returns table(
  storage_path text,
  bytes        bigint,
  created_at   timestamptz,
  action       text
)
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_orphan record;
begin
  for v_orphan in
    select
      o.id,
      o.name as storage_path,
      coalesce((o.metadata->>'size')::bigint, 0) as bytes,
      o.created_at
    from storage.objects o
    where o.bucket_id = 'lease-pdfs'
      and not exists (
        select 1
        from public.lease_pdf_versions v
        where v.storage_path = o.name
      )
    order by o.created_at asc
  loop
    storage_path := v_orphan.storage_path;
    bytes        := v_orphan.bytes;
    created_at   := v_orphan.created_at;

    if p_dry_run then
      action := 'would_delete';
    else
      delete from storage.objects where id = v_orphan.id;
      action := 'deleted';
    end if;

    return next;
  end loop;

  return;
end;
$$;

comment on function public.purge_orphaned_lease_pdfs(boolean) is
  'Phase 14: list (dry-run) or delete lease-pdfs storage objects with no matching lease_pdf_versions row. Service-role / admin only.';

-- Lock down: only service role + postgres may call this.
revoke all on function public.purge_orphaned_lease_pdfs(boolean) from public;
revoke all on function public.purge_orphaned_lease_pdfs(boolean) from anon;
revoke all on function public.purge_orphaned_lease_pdfs(boolean) from authenticated;
grant  execute on function public.purge_orphaned_lease_pdfs(boolean) to service_role;
