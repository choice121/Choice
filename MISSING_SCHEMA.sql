-- ============================================================
  -- CHOICE PROPERTIES — Missing Schema
  -- Run this in Supabase SQL Editor for any NEW Supabase project
  -- All statements are idempotent (safe to re-run)
  -- Generated and applied by AI agent on 2025-04-18
  -- ============================================================

  -- ENUM TYPES
  DO $$ BEGIN CREATE TYPE application_status AS ENUM ('pending','under_review','approved','denied','withdrawn','waitlisted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE lease_status AS ENUM ('none','sent','signed','awaiting_co_sign','co_signed','voided','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE movein_status AS ENUM ('pending','scheduled','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('unpaid','paid','waived','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;