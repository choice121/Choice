-- 20260513000001_admin_actions_insert_policy.sql
  -- Allow admin users to write audit-log rows.
  -- Required for the admin "delete property" flow which records each delete
  -- (property snapshot, cascade counts, deleting user) before the row is removed.
  -- Idempotent: drops the policy first so re-running is safe.

  DROP POLICY IF EXISTS admin_actions_insert ON public.admin_actions;

  CREATE POLICY admin_actions_insert
  ON public.admin_actions
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );
  