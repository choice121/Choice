-- ============================================================================
-- Phase 9: Concurrent Multi-AI Job Manager, Worker Isolation & Safe Cleanup
-- ============================================================================
-- 1. Creates pipeline.batch_job_workers & pipeline.batch_jobs with lease tokens,
--    heartbeats, stage tracking, resume_stage recovery, and idempotency keys.
-- 2. Enables strict RLS (service_role full access + verified admin SELECT).
-- 3. Adds least-privilege SECURITY DEFINER RPCs:
--      - public.job_register(...)
--      - public.job_claim(...) [uses FOR UPDATE SKIP LOCKED + lease isolation]
--      - public.job_heartbeat(...)
--      - public.job_report_stage(...)
--      - public.job_pause(...)
--      - public.job_resume(...)
--      - public.job_reap_stale_leases(...)
--      - public.job_cleanup_prepare(...)
--      - public.job_cleanup_disposable_folder(...)
--      - public.job_get(...) & public.job_list(...)
-- 4. Schedules pg_cron stale-lease reaper ('*/1 * * * *') cleanly.
-- ============================================================================

-- ── 1. Worker Registry & Batch Jobs Tables ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline.batch_job_workers (
  worker_id         TEXT PRIMARY KEY,
  worker_type       TEXT NOT NULL DEFAULT 'ai_worker',
  status            TEXT NOT NULL DEFAULT 'idle'
                      CHECK (status IN ('idle', 'active', 'paused', 'stale', 'offline')),
  active_batch_id   TEXT,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline.batch_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          TEXT NOT NULL UNIQUE REFERENCES public.publishing_batches(id) ON DELETE CASCADE,
  batch_uuid        UUID NOT NULL REFERENCES public.publishing_batches(batch_uuid) ON DELETE CASCADE,
  policy_set_id     UUID REFERENCES public.policy_sets(id) ON DELETE SET NULL,
  worker_id         TEXT,
  lease_token       UUID,
  lease_expires_at  TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  stage             TEXT NOT NULL DEFAULT 'queued'
                      CHECK (stage IN (
                        'queued',
                        'scraping',
                        'validating',
                        'enriching',
                        'pricing',
                        'publishing',
                        'verifying',
                        'cleaning',
                        'completed',
                        'partial',
                        'paused',
                        'failed'
                      )),
  resume_stage      TEXT
                      CHECK (resume_stage IS NULL OR resume_stage IN (
                        'queued',
                        'scraping',
                        'validating',
                        'enriching',
                        'pricing',
                        'publishing',
                        'verifying',
                        'cleaning'
                      )),
  progress_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  idempotency_key   TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_jobs_idempotency_key
  ON pipeline.batch_jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_jobs_stage_lease
  ON pipeline.batch_jobs (stage, lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_worker_id
  ON pipeline.batch_jobs (worker_id)
  WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batch_job_workers_status
  ON pipeline.batch_job_workers (status, last_heartbeat_at DESC);

-- ── 2. Row-Level Security & Least-Privilege Table Grants ────────────────────
ALTER TABLE pipeline.batch_job_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline.batch_jobs        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS batch_job_workers_service_all ON pipeline.batch_job_workers;
CREATE POLICY batch_job_workers_service_all
  ON pipeline.batch_job_workers FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS batch_job_workers_admin_select ON pipeline.batch_job_workers;
CREATE POLICY batch_job_workers_admin_select
  ON pipeline.batch_job_workers FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS batch_jobs_service_all ON pipeline.batch_jobs;
CREATE POLICY batch_jobs_service_all
  ON pipeline.batch_jobs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS batch_jobs_admin_select ON pipeline.batch_jobs;
CREATE POLICY batch_jobs_admin_select
  ON pipeline.batch_jobs FOR SELECT
  TO authenticated USING (public.is_admin());

REVOKE ALL ON TABLE pipeline.batch_job_workers FROM PUBLIC, anon;
REVOKE ALL ON TABLE pipeline.batch_jobs        FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pipeline.batch_job_workers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pipeline.batch_jobs        TO service_role;
GRANT SELECT                         ON TABLE pipeline.batch_job_workers TO authenticated;
GRANT SELECT                         ON TABLE pipeline.batch_jobs        TO authenticated;

-- ── 3. Internal Auth Helper Expression Convention ───────────────────────────
-- All RPCs enforce:
--   auth.role() = 'service_role' OR public.is_admin()
--   OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))

-- ── 4. job_claim ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_claim(
  p_worker_id      TEXT,
  p_worker_type    TEXT DEFAULT 'ai_worker',
  p_batch_id       TEXT DEFAULT NULL,
  p_lease_seconds  INTEGER DEFAULT 300,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_worker_id   TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_worker_type TEXT := COALESCE(NULLIF(trim(COALESCE(p_worker_type, '')), ''), 'ai_worker');
  v_batch_id    TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_lease_secs  INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 15), 3600);
  v_job         pipeline.batch_jobs%ROWTYPE;
  v_lease_token UUID;
  v_next_stage  TEXT;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'worker_id_required');
  END IF;

  INSERT INTO pipeline.batch_job_workers (
    worker_id, worker_type, status, last_heartbeat_at, updated_at
  ) VALUES (
    v_worker_id, v_worker_type, 'idle', v_now, v_now
  )
  ON CONFLICT (worker_id) DO UPDATE
  SET worker_type       = COALESCE(NULLIF(EXCLUDED.worker_type, ''), pipeline.batch_job_workers.worker_type),
      last_heartbeat_at = v_now,
      updated_at        = v_now;

  IF v_batch_id IS NOT NULL THEN
    SELECT * INTO v_job
    FROM pipeline.batch_jobs
    WHERE batch_id = v_batch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'job_not_found',
        'batch_id', v_batch_id
      );
    END IF;

    IF v_job.stage IN ('completed', 'partial') AND NOT p_admin_override THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'job_already_terminal',
        'batch_id', v_job.batch_id,
        'stage', v_job.stage
      );
    END IF;

    IF v_job.stage = 'paused' AND NOT p_admin_override THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'job_is_paused',
        'batch_id', v_job.batch_id,
        'resume_stage', v_job.resume_stage,
        'message', 'Job is paused. Call resume_job before claiming.'
      );
    END IF;

    IF v_job.worker_id IS NOT NULL
       AND v_job.worker_id <> v_worker_id
       AND v_job.lease_expires_at IS NOT NULL
       AND v_job.lease_expires_at > v_now
       AND NOT p_admin_override THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'lease_held_by_other_worker',
        'batch_id', v_job.batch_id,
        'holder_worker_id', v_job.worker_id,
        'lease_expires_at', v_job.lease_expires_at
      );
    END IF;
  ELSE
    SELECT * INTO v_job
    FROM pipeline.batch_jobs
    WHERE (
      stage = 'queued'
      OR (
        stage IN ('scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning')
        AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= v_now)
      )
    )
    ORDER BY
      CASE WHEN stage = 'queued' THEN 0 ELSE 1 END,
      created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF NOT FOUND THEN
      UPDATE pipeline.batch_job_workers
      SET status          = 'idle',
          active_batch_id = NULL,
          updated_at      = v_now
      WHERE worker_id = v_worker_id;

      RETURN jsonb_build_object(
        'ok', true,
        'claimed', false,
        'reason', 'no_claimable_jobs',
        'worker_id', v_worker_id
      );
    END IF;
  END IF;

  v_lease_token := gen_random_uuid();
  v_next_stage := CASE
    WHEN v_job.stage IN ('queued', 'paused', 'failed') THEN COALESCE(v_job.resume_stage, 'scraping')
    WHEN v_job.stage IN ('completed', 'partial') AND p_admin_override THEN 'cleaning'
    ELSE v_job.stage
  END;

  UPDATE pipeline.batch_jobs
  SET worker_id         = v_worker_id,
      lease_token       = v_lease_token,
      lease_expires_at  = v_now + make_interval(secs => v_lease_secs),
      last_heartbeat_at = v_now,
      stage             = v_next_stage,
      resume_stage      = CASE
        WHEN v_next_stage IN ('scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning')
          THEN v_next_stage
        ELSE resume_stage
      END,
      attempt_count     = v_job.attempt_count + 1,
      started_at        = COALESCE(v_job.started_at, v_now),
      completed_at      = CASE WHEN v_next_stage IN ('completed', 'partial') THEN completed_at ELSE NULL END,
      error_message     = NULL,
      progress_json     = COALESCE(v_job.progress_json, '{}'::jsonb) || jsonb_build_object(
        'last_claimed_by', v_worker_id,
        'last_claimed_at', v_now,
        'lease_seconds', v_lease_secs
      ),
      updated_at        = v_now
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  UPDATE pipeline.batch_job_workers
  SET status            = 'active',
      active_batch_id   = v_job.batch_id,
      last_heartbeat_at = v_now,
      updated_at        = v_now
  WHERE worker_id = v_worker_id;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed', true,
    'batch_id', v_job.batch_id,
    'batch_uuid', v_job.batch_uuid,
    'worker_id', v_worker_id,
    'lease_token', v_lease_token,
    'lease_expires_at', v_job.lease_expires_at,
    'stage', v_job.stage,
    'resume_stage', v_job.resume_stage,
    'job', to_jsonb(v_job),
    'batch', public.batch_lookup(v_job.batch_id),
    'effective_policy', public.rules_get_effective_policy(v_job.batch_id)
  );
END;
$$;

-- ── 5. job_register ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_register(
  p_batch_id          TEXT,
  p_target_market     TEXT DEFAULT 'Unspecified',
  p_workflow_type     TEXT DEFAULT 'scrape_and_publish',
  p_visibility        TEXT DEFAULT 'private_placement',
  p_task_config       JSONB DEFAULT '{}'::jsonb,
  p_description       TEXT DEFAULT NULL,
  p_idempotency_key   TEXT DEFAULT NULL,
  p_worker_id         TEXT DEFAULT NULL,
  p_worker_type       TEXT DEFAULT 'ai_worker',
  p_claim_immediately BOOLEAN DEFAULT false,
  p_lease_seconds     INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_batch_id    TEXT := regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', '');
  v_idem        TEXT := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
  v_worker_id   TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_existing    pipeline.batch_jobs%ROWTYPE;
  v_batch_res   JSONB;
  v_batch_row   public.publishing_batches%ROWTYPE;
  v_job         pipeline.batch_jobs%ROWTYPE;
  v_claim_res   JSONB;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_idem IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM pipeline.batch_jobs
    WHERE idempotency_key = v_idem
    LIMIT 1;

    IF FOUND THEN
      IF v_batch_id <> '' AND v_existing.batch_id <> v_batch_id THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'idempotency_key_conflict',
          'existing_batch_id', v_existing.batch_id,
          'requested_batch_id', v_batch_id
        );
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'idempotent_replay', true,
        'registered', false,
        'batch_id', v_existing.batch_id,
        'batch_uuid', v_existing.batch_uuid,
        'policy_set_id', v_existing.policy_set_id,
        'job', to_jsonb(v_existing),
        'batch', public.batch_lookup(v_existing.batch_id),
        'effective_policy', public.rules_get_effective_policy(v_existing.batch_id)
      );
    END IF;
  END IF;

  -- Creates publishing_batches row (auto-pinning active policy_set_id) + 1:1 disposable folder
  v_batch_res := public.batch_create(
    v_batch_id,
    p_target_market,
    p_workflow_type,
    p_visibility,
    COALESCE(p_task_config, '{}'::jsonb),
    p_description,
    '#6366f1',
    '📦'
  );

  IF COALESCE((v_batch_res->>'ok')::boolean, false) = false THEN
    RETURN v_batch_res;
  END IF;

  SELECT * INTO v_batch_row
  FROM public.publishing_batches
  WHERE id = v_batch_id
  LIMIT 1;

  INSERT INTO pipeline.batch_jobs (
    batch_id,
    batch_uuid,
    policy_set_id,
    stage,
    resume_stage,
    progress_json,
    attempt_count,
    idempotency_key,
    created_at,
    updated_at
  ) VALUES (
    v_batch_row.id,
    v_batch_row.batch_uuid,
    v_batch_row.policy_set_id,
    'queued',
    'scraping',
    jsonb_build_object(
      'registered_at', v_now,
      'folder_id', v_batch_res->'folder_id',
      'target_market', v_batch_row.target_market
    ),
    0,
    v_idem,
    v_now,
    v_now
  )
  RETURNING * INTO v_job;

  IF p_claim_immediately AND v_worker_id IS NOT NULL THEN
    v_claim_res := public.job_claim(
      v_worker_id,
      p_worker_type,
      v_batch_row.id,
      p_lease_seconds,
      false
    );
    RETURN v_claim_res || jsonb_build_object(
      'registered', true,
      'folder_id', v_batch_res->'folder_id',
      'policy_set_id', v_batch_row.policy_set_id,
      'namespace_stats', v_batch_res->'namespace_stats'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'registered', true,
    'claimed', false,
    'batch_id', v_batch_row.id,
    'batch_uuid', v_batch_row.batch_uuid,
    'policy_set_id', v_batch_row.policy_set_id,
    'folder_id', v_batch_res->'folder_id',
    'job', to_jsonb(v_job),
    'batch', public.batch_lookup(v_batch_row.id),
    'effective_policy', public.rules_get_effective_policy(v_batch_row.id),
    'namespace_stats', v_batch_res->'namespace_stats'
  );
END;
$$;

-- ── 6. job_heartbeat ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_heartbeat(
  p_batch_id      TEXT,
  p_worker_id     TEXT,
  p_lease_token   UUID,
  p_lease_seconds INTEGER DEFAULT 300,
  p_progress_json JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now        TIMESTAMPTZ := now();
  v_batch_id   TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id  TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_lease_secs INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 15), 3600);
  v_job        pipeline.batch_jobs%ROWTYPE;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'worker_id_required');
  END IF;
  IF p_lease_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lease_token_required');
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found', 'batch_id', v_batch_id);
  END IF;

  IF v_job.stage IN ('completed', 'partial', 'paused') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', CASE WHEN v_job.stage = 'paused' THEN 'job_is_paused' ELSE 'job_already_terminal' END,
      'batch_id', v_job.batch_id,
      'stage', v_job.stage
    );
  END IF;

  IF v_job.worker_id IS DISTINCT FROM v_worker_id OR v_job.lease_token IS DISTINCT FROM p_lease_token THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'lease_ownership_mismatch',
      'batch_id', v_job.batch_id,
      'holder_worker_id', v_job.worker_id
    );
  END IF;

  IF v_job.lease_expires_at IS NULL OR v_job.lease_expires_at <= v_now THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'lease_expired',
      'batch_id', v_job.batch_id,
      'lease_expires_at', v_job.lease_expires_at
    );
  END IF;

  UPDATE pipeline.batch_jobs
  SET lease_expires_at  = v_now + make_interval(secs => v_lease_secs),
      last_heartbeat_at = v_now,
      progress_json     = CASE
        WHEN p_progress_json IS NOT NULL AND jsonb_typeof(p_progress_json) = 'object'
          THEN COALESCE(progress_json, '{}'::jsonb) || p_progress_json
        ELSE progress_json
      END,
      updated_at        = v_now
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  UPDATE pipeline.batch_job_workers
  SET status            = 'active',
      active_batch_id   = v_job.batch_id,
      last_heartbeat_at = v_now,
      updated_at        = v_now
  WHERE worker_id = v_worker_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_job.batch_id,
    'worker_id', v_worker_id,
    'lease_token', v_job.lease_token,
    'lease_expires_at', v_job.lease_expires_at,
    'last_heartbeat_at', v_job.last_heartbeat_at,
    'stage', v_job.stage,
    'job', to_jsonb(v_job)
  );
END;
$$;

-- ── 7. job_report_stage ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_report_stage(
  p_batch_id       TEXT,
  p_worker_id      TEXT DEFAULT NULL,
  p_lease_token    UUID DEFAULT NULL,
  p_stage          TEXT DEFAULT NULL,
  p_progress_json  JSONB DEFAULT NULL,
  p_error_message  TEXT DEFAULT NULL,
  p_lease_seconds  INTEGER DEFAULT 300,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_batch_id    TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id   TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_stage       TEXT := NULLIF(trim(COALESCE(p_stage, '')), '');
  v_lease_secs  INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 15), 3600);
  v_job         pipeline.batch_jobs%ROWTYPE;
  v_is_terminal BOOLEAN := false;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  IF v_stage IS NULL OR v_stage NOT IN (
    'queued', 'scraping', 'validating', 'enriching', 'pricing',
    'publishing', 'verifying', 'cleaning', 'completed', 'partial', 'paused', 'failed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_stage', 'stage', v_stage);
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found', 'batch_id', v_batch_id);
  END IF;

  IF NOT p_admin_override THEN
    IF v_worker_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'worker_id_required');
    END IF;
    IF p_lease_token IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'lease_token_required');
    END IF;
    IF v_job.worker_id IS DISTINCT FROM v_worker_id OR v_job.lease_token IS DISTINCT FROM p_lease_token THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'lease_ownership_mismatch',
        'batch_id', v_job.batch_id,
        'holder_worker_id', v_job.worker_id
      );
    END IF;
    IF v_job.lease_expires_at IS NULL OR v_job.lease_expires_at <= v_now THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'lease_expired',
        'batch_id', v_job.batch_id,
        'lease_expires_at', v_job.lease_expires_at
      );
    END IF;
  END IF;

  v_is_terminal := v_stage IN ('completed', 'partial', 'failed', 'paused');

  UPDATE pipeline.batch_jobs
  SET stage             = v_stage,
      resume_stage      = CASE
        WHEN v_stage IN ('queued', 'scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning')
          THEN v_stage
        WHEN v_stage IN ('paused', 'failed') AND v_job.stage IN ('queued', 'scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning')
          THEN v_job.stage
        ELSE resume_stage
      END,
      progress_json     = CASE
        WHEN p_progress_json IS NOT NULL AND jsonb_typeof(p_progress_json) = 'object'
          THEN COALESCE(progress_json, '{}'::jsonb) || p_progress_json
        ELSE progress_json
      END,
      error_message     = CASE
        WHEN v_stage IN ('failed', 'paused') THEN COALESCE(NULLIF(trim(COALESCE(p_error_message, '')), ''), error_message)
        WHEN p_error_message IS NOT NULL THEN NULLIF(trim(p_error_message), '')
        ELSE NULL
      END,
      last_heartbeat_at = CASE WHEN v_is_terminal THEN last_heartbeat_at ELSE v_now END,
      lease_token       = CASE WHEN v_is_terminal THEN NULL ELSE lease_token END,
      lease_expires_at  = CASE WHEN v_is_terminal THEN NULL ELSE v_now + make_interval(secs => v_lease_secs) END,
      completed_at      = CASE WHEN v_stage IN ('completed', 'partial', 'failed') THEN v_now ELSE completed_at END,
      updated_at        = v_now
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  IF v_job.worker_id IS NOT NULL THEN
    UPDATE pipeline.batch_job_workers
    SET status            = CASE WHEN v_is_terminal THEN 'idle' ELSE 'active' END,
        active_batch_id   = CASE WHEN v_is_terminal THEN NULL ELSE v_job.batch_id END,
        last_heartbeat_at = v_now,
        updated_at        = v_now
    WHERE worker_id = v_job.worker_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_job.batch_id,
    'stage', v_job.stage,
    'resume_stage', v_job.resume_stage,
    'lease_expires_at', v_job.lease_expires_at,
    'job', to_jsonb(v_job)
  );
END;
$$;

-- ── 8. job_pause & job_resume ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_pause(
  p_batch_id       TEXT,
  p_reason         TEXT DEFAULT 'Paused by operator',
  p_worker_id      TEXT DEFAULT NULL,
  p_lease_token    UUID DEFAULT NULL,
  p_admin_override BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now       TIMESTAMPTZ := now();
  v_batch_id  TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_job       pipeline.batch_jobs%ROWTYPE;
  v_prev_wkr  TEXT;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found', 'batch_id', v_batch_id);
  END IF;

  IF v_job.stage IN ('completed', 'partial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_already_terminal', 'batch_id', v_job.batch_id, 'stage', v_job.stage);
  END IF;

  IF NOT p_admin_override THEN
    IF v_worker_id IS NULL OR p_lease_token IS NULL
       OR v_job.worker_id IS DISTINCT FROM v_worker_id
       OR v_job.lease_token IS DISTINCT FROM p_lease_token THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'lease_ownership_mismatch',
        'batch_id', v_job.batch_id,
        'holder_worker_id', v_job.worker_id
      );
    END IF;
  END IF;

  v_prev_wkr := v_job.worker_id;

  UPDATE pipeline.batch_jobs
  SET resume_stage     = CASE
        WHEN stage IN ('queued', 'scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning')
          THEN stage
        ELSE COALESCE(resume_stage, 'scraping')
      END,
      stage            = 'paused',
      lease_token      = NULL,
      lease_expires_at = NULL,
      error_message    = COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Paused by operator'),
      progress_json    = COALESCE(progress_json, '{}'::jsonb) || jsonb_build_object(
        'paused_at', v_now,
        'paused_from_stage', stage
      ),
      updated_at       = v_now
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  IF v_prev_wkr IS NOT NULL THEN
    UPDATE pipeline.batch_job_workers
    SET status          = 'idle',
        active_batch_id = NULL,
        updated_at      = v_now
    WHERE worker_id = v_prev_wkr
      AND active_batch_id = v_job.batch_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'paused', true,
    'batch_id', v_job.batch_id,
    'stage', v_job.stage,
    'resume_stage', v_job.resume_stage,
    'job', to_jsonb(v_job)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.job_resume(
  p_batch_id      TEXT,
  p_worker_id     TEXT DEFAULT NULL,
  p_worker_type   TEXT DEFAULT 'ai_worker',
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_batch_id    TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id   TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_worker_type TEXT := COALESCE(NULLIF(trim(COALESCE(p_worker_type, '')), ''), 'ai_worker');
  v_lease_secs  INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 15), 3600);
  v_job         pipeline.batch_jobs%ROWTYPE;
  v_target      TEXT;
  v_lease_token UUID;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found', 'batch_id', v_batch_id);
  END IF;

  IF v_job.stage IN ('completed', 'partial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_already_terminal', 'batch_id', v_job.batch_id, 'stage', v_job.stage);
  END IF;

  IF v_job.worker_id IS NOT NULL
     AND (v_worker_id IS NULL OR v_job.worker_id <> v_worker_id)
     AND v_job.lease_expires_at IS NOT NULL
     AND v_job.lease_expires_at > v_now THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'lease_held_by_other_worker',
      'batch_id', v_job.batch_id,
      'holder_worker_id', v_job.worker_id,
      'lease_expires_at', v_job.lease_expires_at
    );
  END IF;

  v_target := COALESCE(v_job.resume_stage, 'scraping');
  IF v_target = 'queued' THEN
    v_target := 'scraping';
  END IF;

  IF v_worker_id IS NOT NULL THEN
    INSERT INTO pipeline.batch_job_workers (
      worker_id, worker_type, status, active_batch_id, last_heartbeat_at, updated_at
    ) VALUES (
      v_worker_id, v_worker_type, 'active', v_job.batch_id, v_now, v_now
    )
    ON CONFLICT (worker_id) DO UPDATE
    SET worker_type       = COALESCE(NULLIF(EXCLUDED.worker_type, ''), pipeline.batch_job_workers.worker_type),
        status            = 'active',
        active_batch_id   = v_job.batch_id,
        last_heartbeat_at = v_now,
        updated_at        = v_now;

    v_lease_token := gen_random_uuid();

    UPDATE pipeline.batch_jobs
    SET worker_id         = v_worker_id,
        lease_token       = v_lease_token,
        lease_expires_at  = v_now + make_interval(secs => v_lease_secs),
        last_heartbeat_at = v_now,
        stage             = v_target,
        resume_stage      = v_target,
        attempt_count     = v_job.attempt_count + 1,
        started_at        = COALESCE(v_job.started_at, v_now),
        completed_at      = NULL,
        error_message     = NULL,
        progress_json     = COALESCE(progress_json, '{}'::jsonb) || jsonb_build_object(
          'resumed_at', v_now,
          'resumed_by', v_worker_id,
          'resumed_to_stage', v_target
        ),
        updated_at        = v_now
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    RETURN jsonb_build_object(
      'ok', true,
      'resumed', true,
      'claimed', true,
      'batch_id', v_job.batch_id,
      'worker_id', v_worker_id,
      'lease_token', v_lease_token,
      'lease_expires_at', v_job.lease_expires_at,
      'stage', v_job.stage,
      'resume_stage', v_job.resume_stage,
      'job', to_jsonb(v_job),
      'batch', public.batch_lookup(v_job.batch_id),
      'effective_policy', public.rules_get_effective_policy(v_job.batch_id)
    );
  END IF;

  -- Queue-only resume (no immediate worker attached)
  UPDATE pipeline.batch_jobs
  SET worker_id         = NULL,
      lease_token       = NULL,
      lease_expires_at  = NULL,
      stage             = 'queued',
      resume_stage      = v_target,
      completed_at      = NULL,
      error_message     = NULL,
      progress_json     = COALESCE(progress_json, '{}'::jsonb) || jsonb_build_object(
        'resumed_at', v_now,
        'queued_resume_stage', v_target
      ),
      updated_at        = v_now
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object(
    'ok', true,
    'resumed', true,
    'claimed', false,
    'batch_id', v_job.batch_id,
    'stage', v_job.stage,
    'resume_stage', v_job.resume_stage,
    'job', to_jsonb(v_job)
  );
END;
$$;

-- ── 9. job_reap_stale_leases ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_reap_stale_leases(
  p_worker_stale_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now          TIMESTAMPTZ := now();
  v_job          pipeline.batch_jobs%ROWTYPE;
  v_reaped_cnt   INTEGER := 0;
  v_reaped_ids   TEXT[] := '{}'::text[];
  v_stale_wkrs   INTEGER := 0;
  v_stale_mins   INTEGER := LEAST(GREATEST(COALESCE(p_worker_stale_minutes, 10), 1), 1440);
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  FOR v_job IN
    SELECT *
    FROM pipeline.batch_jobs
    WHERE stage IN ('scraping', 'validating', 'enriching', 'pricing', 'publishing', 'verifying', 'cleaning')
      AND (lease_expires_at IS NULL OR lease_expires_at <= v_now)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE pipeline.batch_jobs
    SET resume_stage     = v_job.stage,
        stage            = 'queued',
        worker_id        = NULL,
        lease_token      = NULL,
        lease_expires_at = NULL,
        error_message    = 'lease_expired_reaped',
        progress_json    = COALESCE(v_job.progress_json, '{}'::jsonb) || jsonb_build_object(
          'last_reaped_at', v_now,
          'reaped_from_stage', v_job.stage,
          'reaped_from_worker', v_job.worker_id
        ),
        updated_at       = v_now
    WHERE id = v_job.id;

    v_reaped_cnt := v_reaped_cnt + 1;
    v_reaped_ids := array_append(v_reaped_ids, v_job.batch_id);
  END LOOP;

  UPDATE pipeline.batch_job_workers
  SET status          = 'stale',
      active_batch_id = NULL,
      updated_at      = v_now
  WHERE status = 'active'
    AND (
      active_batch_id = ANY(v_reaped_ids)
      OR last_heartbeat_at <= v_now - make_interval(mins => v_stale_mins)
    );
  GET DIAGNOSTICS v_stale_wkrs = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'reaped_jobs_count', v_reaped_cnt,
    'reaped_batches', to_jsonb(v_reaped_ids),
    'stale_workers_count', v_stale_wkrs,
    'checked_at', v_now
  );
END;
$$;

-- ── 10. Safe Cleanup Pre-Check & Execution RPCs ─────────────────────────────
CREATE OR REPLACE FUNCTION public.job_cleanup_prepare(
  p_batch_id       TEXT,
  p_worker_id      TEXT DEFAULT NULL,
  p_lease_token    UUID DEFAULT NULL,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now             TIMESTAMPTZ := now();
  v_batch_id        TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id       TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_batch           public.publishing_batches%ROWTYPE;
  v_job             pipeline.batch_jobs%ROWTYPE;
  v_folder_id       UUID;
  v_folder_exists   BOOLEAN := false;
  v_share_valid     BOOLEAN := true;
  v_verified_snaps  INTEGER := 0;
  v_eligible_rows   JSONB := '[]'::jsonb;
  v_held_rows       JSONB := '[]'::jsonb;
  v_eligible_cnt    INTEGER := 0;
  v_held_cnt        INTEGER := 0;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found', 'batch_id', v_batch_id);
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch.id
  LIMIT 1;

  IF FOUND AND NOT p_admin_override THEN
    IF v_job.worker_id IS NOT NULL
       AND v_job.lease_expires_at IS NOT NULL
       AND v_job.lease_expires_at > v_now THEN
      IF v_worker_id IS NULL OR v_job.worker_id <> v_worker_id OR p_lease_token IS DISTINCT FROM v_job.lease_token THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'lease_held_by_other_worker',
          'batch_id', v_batch.id,
          'holder_worker_id', v_job.worker_id,
          'lease_expires_at', v_job.lease_expires_at
        );
      END IF;
    END IF;
  END IF;

  -- Enforce strict post-publish & permanent registry verification gate
  IF v_batch.visibility = 'private_placement' THEN
    v_share_valid := (
      v_batch.share_id IS NOT NULL
      AND v_batch.magic_link_url IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.property_shares ps WHERE ps.id = v_batch.share_id AND ps.revoked_at IS NULL)
    );
  END IF;

  SELECT COUNT(*)::int INTO v_verified_snaps
  FROM public.publishing_batch_properties bp
  WHERE bp.batch_id = v_batch.id
    AND bp.published_status = 'published'
    AND bp.verification_status = 'verified';

  IF v_batch.link_verified_at IS NULL OR NOT v_batch.share_verified OR NOT v_share_valid OR v_verified_snaps = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'cleanup_blocked_unverified_batch',
      'batch_id', v_batch.id,
      'link_verified_at', v_batch.link_verified_at,
      'share_verified', v_batch.share_verified,
      'share_valid', v_share_valid,
      'verified_snapshot_count', v_verified_snaps,
      'message', 'Cleanup blocked: batch must pass post-publish link verification and permanent registry persistence first.'
    );
  END IF;

  SELECT pf.id INTO v_folder_id
  FROM pipeline.pipeline_folders pf
  WHERE pf.id = v_batch.disposable_folder_id
     OR (pf.batch_id = v_batch.id AND pf.is_disposable_batch = true)
  LIMIT 1;
  v_folder_exists := (v_folder_id IS NOT NULL);

  WITH scoped AS (
    SELECT
      pp.id,
      pp.status,
      pp.validation_status,
      pp.review_reason,
      pp.choice_property_id,
      pp.source,
      pp.source_listing_id,
      pp.field_provenance ->> 'raw_payload_storage_path' AS raw_payload_storage_path,
      (
        pp.status = 'published'
        AND pp.choice_property_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.publishing_batch_properties bp
          WHERE bp.batch_id = v_batch.id
            AND (bp.pipeline_id = pp.id OR bp.property_id = pp.choice_property_id)
            AND bp.published_status = 'published'
            AND bp.verification_status = 'verified'
        )
      ) AS is_eligible
    FROM pipeline.pipeline_properties pp
    WHERE pp.batch_id = v_batch.id
       OR (v_folder_id IS NOT NULL AND pp.folder_id = v_folder_id)
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'pipeline_id', s.id,
      'choice_property_id', s.choice_property_id,
      'source', s.source,
      'source_listing_id', s.source_listing_id,
      'raw_payload_storage_path', s.raw_payload_storage_path
    )) FILTER (WHERE s.is_eligible), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object(
      'pipeline_id', s.id,
      'status', s.status,
      'validation_status', s.validation_status,
      'review_reason', s.review_reason
    )) FILTER (WHERE NOT s.is_eligible), '[]'::jsonb),
    COUNT(*) FILTER (WHERE s.is_eligible)::int,
    COUNT(*) FILTER (WHERE NOT s.is_eligible)::int
  INTO v_eligible_rows, v_held_rows, v_eligible_cnt, v_held_cnt
  FROM scoped s;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'target_market', v_batch.target_market,
    'disposable_folder_id', v_folder_id,
    'folder_exists', v_folder_exists,
    'verified_snapshot_count', v_verified_snaps,
    'eligible_count', v_eligible_cnt,
    'held_count', v_held_cnt,
    'eligible_rows', v_eligible_rows,
    'held_rows', v_held_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.job_cleanup_disposable_folder(
  p_batch_id       TEXT,
  p_raw_paths      JSONB DEFAULT '{}'::jsonb,
  p_worker_id      TEXT DEFAULT NULL,
  p_lease_token    UUID DEFAULT NULL,
  p_admin_override BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_now             TIMESTAMPTZ := now();
  v_expires         TIMESTAMPTZ := v_now + interval '24 hours';
  v_batch_id        TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_worker_id       TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_batch           public.publishing_batches%ROWTYPE;
  v_job             pipeline.batch_jobs%ROWTYPE;
  v_has_job         BOOLEAN := false;
  v_folder_id       UUID;
  v_share_valid     BOOLEAN := true;
  v_verified_snaps  INTEGER := 0;
  v_eligible_ids    TEXT[] := '{}'::text[];
  v_rec             pipeline.pipeline_properties%ROWTYPE;
  v_paths           JSONB;
  v_archived_cnt    INTEGER := 0;
  v_deleted_cnt     INTEGER := 0;
  v_remaining_cnt   INTEGER := 0;
  v_folder_deleted  BOOLEAN := false;
  v_final_stage     TEXT;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_batch
  FROM public.publishing_batches
  WHERE id = v_batch_id OR UPPER(id) = UPPER(v_batch_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found', 'batch_id', v_batch_id);
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch.id
  FOR UPDATE;
  v_has_job := FOUND;

  IF v_has_job AND NOT p_admin_override THEN
    IF v_job.worker_id IS NOT NULL
       AND v_job.lease_expires_at IS NOT NULL
       AND v_job.lease_expires_at > v_now THEN
      IF v_worker_id IS NULL OR v_job.worker_id <> v_worker_id OR p_lease_token IS DISTINCT FROM v_job.lease_token THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'lease_held_by_other_worker',
          'batch_id', v_batch.id,
          'holder_worker_id', v_job.worker_id,
          'lease_expires_at', v_job.lease_expires_at
        );
      END IF;
    END IF;
  END IF;

  IF v_batch.visibility = 'private_placement' THEN
    v_share_valid := (
      v_batch.share_id IS NOT NULL
      AND v_batch.magic_link_url IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.property_shares ps WHERE ps.id = v_batch.share_id AND ps.revoked_at IS NULL)
    );
  END IF;

  SELECT COUNT(*)::int INTO v_verified_snaps
  FROM public.publishing_batch_properties bp
  WHERE bp.batch_id = v_batch.id
    AND bp.published_status = 'published'
    AND bp.verification_status = 'verified';

  IF v_batch.link_verified_at IS NULL OR NOT v_batch.share_verified OR NOT v_share_valid OR v_verified_snaps = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'cleanup_blocked_unverified_batch',
      'batch_id', v_batch.id,
      'link_verified_at', v_batch.link_verified_at,
      'share_verified', v_batch.share_verified,
      'share_valid', v_share_valid,
      'verified_snapshot_count', v_verified_snaps
    );
  END IF;

  SELECT pf.id INTO v_folder_id
  FROM pipeline.pipeline_folders pf
  WHERE pf.id = v_batch.disposable_folder_id
     OR (pf.batch_id = v_batch.id AND pf.is_disposable_batch = true)
  LIMIT 1
  FOR UPDATE;

  IF v_folder_id IS NOT NULL THEN
    UPDATE pipeline.pipeline_folders
    SET cleanup_state = 'cleaning',
        updated_at    = v_now
    WHERE id = v_folder_id;
  END IF;

  -- Lock & archive ONLY verified-published staging rows (hold failed/needs_review safely)
  FOR v_rec IN
    SELECT pp.*
    FROM pipeline.pipeline_properties pp
    WHERE (pp.batch_id = v_batch.id OR (v_folder_id IS NOT NULL AND pp.folder_id = v_folder_id))
      AND pp.status = 'published'
      AND pp.choice_property_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.publishing_batch_properties bp
        WHERE bp.batch_id = v_batch.id
          AND (bp.pipeline_id = pp.id OR bp.property_id = pp.choice_property_id)
          AND bp.published_status = 'published'
          AND bp.verification_status = 'verified'
      )
    FOR UPDATE
  LOOP
    v_paths := COALESCE(p_raw_paths -> v_rec.id, '[]'::jsonb);

    INSERT INTO pipeline.pipeline_recovery_archive (
      batch_id,
      pipeline_id,
      source,
      source_listing_id,
      target_market,
      address,
      city,
      state,
      zip,
      published_property_id,
      original_status,
      pipeline_row_snapshot,
      raw_storage_paths,
      recovery_status,
      deleted_at,
      recovery_expires_at
    ) VALUES (
      v_batch.id,
      v_rec.id,
      v_rec.source,
      v_rec.source_listing_id,
      COALESCE(v_batch.target_market, 'Unknown'),
      COALESCE(v_rec.address, v_rec.title, v_rec.id),
      v_rec.city,
      v_rec.state,
      v_rec.zip,
      v_rec.choice_property_id,
      v_rec.status,
      to_jsonb(v_rec),
      v_paths,
      'recoverable',
      v_now,
      v_expires
    )
    ON CONFLICT (batch_id, pipeline_id) DO UPDATE
    SET pipeline_row_snapshot = EXCLUDED.pipeline_row_snapshot,
        raw_storage_paths     = EXCLUDED.raw_storage_paths,
        recovery_status       = 'recoverable',
        deleted_at            = v_now,
        recovery_expires_at   = v_expires;

    v_eligible_ids := array_append(v_eligible_ids, v_rec.id);
    v_archived_cnt := v_archived_cnt + 1;
  END LOOP;

  IF v_archived_cnt > 0 THEN
    DELETE FROM pipeline.pipeline_properties
    WHERE id = ANY(v_eligible_ids);
    GET DIAGNOSTICS v_deleted_cnt = ROW_COUNT;

    UPDATE public.publishing_batch_properties
    SET recovery_status          = 'recoverable',
        deleted_from_pipeline_at = v_now,
        recovery_expires_at      = v_expires
    WHERE batch_id = v_batch.id
      AND pipeline_id = ANY(v_eligible_ids);
  END IF;

  SELECT COUNT(*)::int INTO v_remaining_cnt
  FROM pipeline.pipeline_properties pp
  WHERE pp.batch_id = v_batch.id
     OR (v_folder_id IS NOT NULL AND pp.folder_id = v_folder_id);

  IF v_remaining_cnt = 0 AND v_folder_id IS NOT NULL THEN
    DELETE FROM pipeline.pipeline_folders
    WHERE id = v_folder_id
      AND is_disposable_batch = true;
    IF FOUND THEN
      v_folder_deleted := true;
    END IF;
  END IF;

  UPDATE public.publishing_batches
  SET pipeline_deleted_at = CASE WHEN v_archived_cnt > 0 THEN v_now ELSE pipeline_deleted_at END,
      recovery_expires_at = CASE WHEN v_archived_cnt > 0 THEN v_expires ELSE recovery_expires_at END,
      recovery_status     = CASE WHEN v_archived_cnt > 0 THEN 'recoverable' ELSE recovery_status END,
      cleanup_completed   = (v_remaining_cnt = 0 AND (v_folder_deleted OR v_folder_id IS NULL)),
      cleanup_details     = COALESCE(cleanup_details, '{}'::jsonb) || jsonb_build_object(
        'archived_count', COALESCE((cleanup_details->>'archived_count')::int, 0) + v_archived_cnt,
        'pipeline_deleted_count', COALESCE((cleanup_details->>'pipeline_deleted_count')::int, 0) + v_deleted_cnt,
        'held_unresolved_count', v_remaining_cnt,
        'folder_deleted', v_folder_deleted,
        'last_folder_id', v_folder_id,
        'recovery_expires_at', CASE WHEN v_archived_cnt > 0 THEN v_expires ELSE recovery_expires_at END,
        'cleaned_at', v_now
      )
  WHERE id = v_batch.id;

  IF v_has_job THEN
    v_final_stage := CASE WHEN v_remaining_cnt > 0 THEN 'partial' ELSE 'completed' END;

    UPDATE pipeline.batch_jobs
    SET stage            = v_final_stage,
        lease_token      = NULL,
        lease_expires_at = NULL,
        completed_at     = COALESCE(completed_at, v_now),
        progress_json    = COALESCE(progress_json, '{}'::jsonb) || jsonb_build_object(
          'cleanup', jsonb_build_object(
            'archived_count', v_archived_cnt,
            'pipeline_deleted_count', v_deleted_cnt,
            'held_unresolved_count', v_remaining_cnt,
            'folder_deleted', v_folder_deleted,
            'recovery_expires_at', CASE WHEN v_archived_cnt > 0 THEN v_expires ELSE NULL END,
            'cleaned_at', v_now
          )
        ),
        updated_at       = v_now
    WHERE id = v_job.id;

    IF v_job.worker_id IS NOT NULL THEN
      UPDATE pipeline.batch_job_workers
      SET status          = 'idle',
          active_batch_id = NULL,
          updated_at      = v_now
      WHERE worker_id = v_job.worker_id
        AND active_batch_id = v_batch.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', v_batch.id,
    'archived_count', v_archived_cnt,
    'pipeline_deleted_count', v_deleted_cnt,
    'held_unresolved_count', v_remaining_cnt,
    'folder_deleted', v_folder_deleted,
    'cleanup_completed', (v_remaining_cnt = 0 AND (v_folder_deleted OR v_folder_id IS NULL)),
    'recovery_expires_at', CASE WHEN v_archived_cnt > 0 THEN v_expires ELSE v_batch.recovery_expires_at END,
    'registry', public.registry_get_batch(v_batch.id)
  );
END;
$$;

-- ── 11. Inspection RPCs (job_get & job_list) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_get(p_batch_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_batch_id TEXT := NULLIF(regexp_replace(trim(COALESCE(p_batch_id, '')), '^#', ''), '');
  v_job      pipeline.batch_jobs%ROWTYPE;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'found', false, 'error', 'batch_id_required');
  END IF;

  SELECT * INTO v_job
  FROM pipeline.batch_jobs
  WHERE batch_id = v_batch_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'found', false, 'batch_id', v_batch_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'found', true,
    'batch_id', v_job.batch_id,
    'job', to_jsonb(v_job),
    'batch', public.batch_lookup(v_job.batch_id),
    'effective_policy', public.rules_get_effective_policy(v_job.batch_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.job_list(
  p_stage     TEXT DEFAULT NULL,
  p_worker_id TEXT DEFAULT NULL,
  p_limit     INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pipeline'
AS $$
DECLARE
  v_stage     TEXT := NULLIF(trim(COALESCE(p_stage, '')), '');
  v_worker_id TEXT := NULLIF(trim(COALESCE(p_worker_id, '')), '');
  v_limit     INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_jobs      JSONB := '[]'::jsonb;
  v_workers   JSONB := '[]'::jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin'))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_or_service_required');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT
      j.*,
      pb.target_market,
      pb.visibility,
      pb.status AS batch_status,
      pb.published_count,
      pb.failed_count,
      pb.link_verified_at,
      pb.cleanup_completed,
      pb.disposable_folder_id,
      pf.cleanup_state AS folder_cleanup_state
    FROM pipeline.batch_jobs j
    JOIN public.publishing_batches pb ON pb.id = j.batch_id
    LEFT JOIN pipeline.pipeline_folders pf ON pf.id = pb.disposable_folder_id
    WHERE (v_stage IS NULL OR j.stage = v_stage)
      AND (v_worker_id IS NULL OR j.worker_id = v_worker_id)
    ORDER BY j.created_at DESC
    LIMIT v_limit
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.last_heartbeat_at DESC), '[]'::jsonb)
  INTO v_workers
  FROM pipeline.batch_job_workers w
  WHERE v_worker_id IS NULL OR w.worker_id = v_worker_id;

  RETURN jsonb_build_object(
    'ok', true,
    'count', jsonb_array_length(v_jobs),
    'jobs', v_jobs,
    'workers', v_workers,
    'namespace_stats', public.batch_namespace_stats()
  );
END;
$$;

-- ── 12. Strict Least-Privilege RPC Grants ───────────────────────────────────
REVOKE ALL ON FUNCTION public.job_claim(TEXT, TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_claim(TEXT, TEXT, TEXT, INTEGER, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_register(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_register(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_heartbeat(TEXT, TEXT, UUID, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_heartbeat(TEXT, TEXT, UUID, INTEGER, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_report_stage(TEXT, TEXT, UUID, TEXT, JSONB, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_report_stage(TEXT, TEXT, UUID, TEXT, JSONB, TEXT, INTEGER, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_pause(TEXT, TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_pause(TEXT, TEXT, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_resume(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_resume(TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_reap_stale_leases(INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_reap_stale_leases(INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_cleanup_prepare(TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_cleanup_prepare(TEXT, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_cleanup_disposable_folder(TEXT, JSONB, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_cleanup_disposable_folder(TEXT, JSONB, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_get(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_get(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.job_list(TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.job_list(TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- ── 13. Schedule pg_cron Stale-Lease Reaper (Idempotent) ────────────────────
DO $$
DECLARE
  v_existing_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_existing_id
    FROM cron.job
    WHERE jobname = 'reap-stale-batch-job-leases'
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_existing_id);
    END IF;

    PERFORM cron.schedule(
      'reap-stale-batch-job-leases',
      '*/1 * * * *',
      'SELECT public.job_reap_stale_leases(10);'
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
