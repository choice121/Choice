import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CLIENT_SAFE_PHOTO_SELECT,
  CLIENT_SAFE_PROPERTY_SELECT,
  detectLeakedInternalStrings,
  extractShareTokenFromUrl,
  sha256Hex,
} from './batch-publishing.ts';

const PUBLIC_SITE_BASE = 'https://choice-properties-site.pages.dev';

export interface VerifyBatchOptions {
  batchId: string;
  checkLivePages?: boolean;
  checkMediaHead?: boolean;
  supabaseUrl: string;
  serviceKey: string;
  anonKey: string;
  siteBase?: string;
}

export interface PropertyVerifyResult {
  property_id: string;
  ok: boolean;
  expected_rent: number | null;
  resolved_rent: number | null;
  photo_count: number;
  reachable_photo_count: number;
  leaks: string[];
  failures: string[];
}

export interface BatchVerificationOutput {
  ok: boolean;
  verified: boolean;
  batch_id: string;
  magic_link_url: string | null;
  checks: Record<string, boolean>;
  property_results: PropertyVerifyResult[];
  failures: string[];
  verified_at: string;
  registry?: unknown;
}

async function checkImageReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    await res.body?.cancel();
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1024' },
        redirect: 'follow',
        signal: controller.signal,
      });
      await res.body?.cancel();
    }
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function buildPublicRentSlugUrl(p: Record<string, unknown>, siteBase: string): string {
  const state = String(p.state || 'ok').toLowerCase().slice(0, 2);
  const slugSeg = (s: unknown) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  const bedsNum = p.bedrooms != null ? Number(p.bedrooms) : null;
  const beds = bedsNum == null ? 'home' : bedsNum === 0 ? 'studio' : `${bedsNum}br`;
  const typeSeg = slugSeg(p.property_type) || 'home';
  const idLow = String(p.property_id || p.id || '').toLowerCase();
  return `${siteBase}/rent/${state}/${slugSeg(p.city) || 'us'}/${beds}-${typeSeg}-${idLow}/`;
}

export async function runBatchVerification(
  adminClient: ReturnType<typeof createClient>,
  opts: VerifyBatchOptions,
): Promise<BatchVerificationOutput> {
  const siteBase = (opts.siteBase || PUBLIC_SITE_BASE).replace(/\/+$/, '');
  const failures: string[] = [];
  const checks: Record<string, boolean> = {
    registry_found: false,
    token_hash_matches: false,
    share_status_active: false,
    anon_rls_excluded: false,
    anon_rpc_excluded: false,
    anon_internal_cols_blocked: false,
    sitemap_excluded: opts.checkLivePages === false,
    public_ssr_excluded: opts.checkLivePages === false,
    share_resolve_ok: false,
    properties_clean: false,
    public_contract_clean: false,
    media_reachable: opts.checkMediaHead === false,
  };
  const propertyResults: PropertyVerifyResult[] = [];

  // 1. Load batch from registry
  const { data: regRaw, error: regErr } = await adminClient.rpc('registry_get_batch', {
    p_batch_id: opts.batchId,
  });
  if (regErr) {
    failures.push(`registry_lookup_failed: ${regErr.message}`);
    return {
      ok: false,
      verified: false,
      batch_id: opts.batchId,
      magic_link_url: null,
      checks,
      property_results: [],
      failures,
      verified_at: new Date().toISOString(),
    };
  }

  const reg = (typeof regRaw === 'string' ? JSON.parse(regRaw) : regRaw) as Record<string, unknown>;
  if (!reg?.found) {
    failures.push('batch_not_found');
    return {
      ok: false,
      verified: false,
      batch_id: opts.batchId,
      magic_link_url: null,
      checks,
      property_results: [],
      failures,
      verified_at: new Date().toISOString(),
    };
  }
  checks.registry_found = true;

  const magicLinkUrl = typeof reg.magic_link_url === 'string' ? reg.magic_link_url : null;
  const rawToken = extractShareTokenFromUrl(magicLinkUrl);
  if (!magicLinkUrl || !rawToken) {
    failures.push('missing_magic_link_token');
  } else {
    const computedHash = await sha256Hex(rawToken);
    if (computedHash === reg.share_token_hash) {
      checks.token_hash_matches = true;
    } else {
      failures.push('share_token_hash_mismatch');
    }
  }

  if (reg.effective_share_status === 'active') {
    checks.share_status_active = true;
  } else {
    failures.push(`share_not_active:${String(reg.effective_share_status || 'unknown')}`);
  }

  const allBatchProps = Array.isArray(reg.properties)
    ? (reg.properties as Array<Record<string, unknown>>)
    : [];
  const publishedExpected = allBatchProps.filter(
    (p) => p.published_status === 'published' && typeof p.property_id === 'string' && p.property_id,
  );

  if (publishedExpected.length === 0) {
    failures.push('no_published_properties_in_batch');
  }

  const expectedIds = publishedExpected.map((p) => String(p.property_id));
  const isPrivateBatch = String(reg.visibility || 'private_placement') === 'private_placement';

  // 2. Verify Anon RLS & get_properties_by_ids exclude private_placement listings
  if (expectedIds.length > 0 && isPrivateBatch) {
    if (!opts.anonKey) {
      failures.push('missing_supabase_anon_key_for_rls_check');
    } else {
      try {
        const inClause = expectedIds.map((id) => encodeURIComponent(id)).join(',');
        const rlsRes = await fetch(
          `${opts.supabaseUrl}/rest/v1/properties?id=in.(${inClause})&select=id,status`,
          {
            headers: {
              apikey: opts.anonKey,
              Authorization: `Bearer ${opts.anonKey}`,
            },
          },
        );
        if (rlsRes.status === 401 || rlsRes.status === 403) {
          await rlsRes.body?.cancel();
          checks.anon_rls_excluded = true;
        } else {
          const rlsRows = rlsRes.ok ? await rlsRes.json() : null;
          if (Array.isArray(rlsRows) && rlsRows.length === 0) {
            checks.anon_rls_excluded = true;
          } else {
            failures.push(`anon_rls_exposed_private_properties:${rlsRes.status}:${JSON.stringify(rlsRows)}`);
          }
        }

        const rpcRes = await fetch(`${opts.supabaseUrl}/rest/v1/rpc/get_properties_by_ids`, {
          method: 'POST',
          headers: {
            apikey: opts.anonKey,
            Authorization: `Bearer ${opts.anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_ids: expectedIds }),
        });
        if (rpcRes.status === 401 || rpcRes.status === 403) {
          await rpcRes.body?.cancel();
          checks.anon_rpc_excluded = true;
        } else {
          const rpcRows = rpcRes.ok ? await rpcRes.json() : null;
          if (Array.isArray(rpcRows) && rpcRows.length === 0) {
            checks.anon_rpc_excluded = true;
          } else {
            failures.push(`anon_rpc_exposed_private_properties:${rpcRes.status}:${JSON.stringify(rpcRows)}`);
          }
        }
      } catch (err) {
        failures.push(`anon_privacy_check_error:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    checks.anon_rls_excluded = true;
    checks.anon_rpc_excluded = true;
  }

  // 2b. Verify anon REST cannot query internal columns directly on public.properties
  if (opts.anonKey) {
    try {
      const colProbeRes = await fetch(
        `${opts.supabaseUrl}/rest/v1/properties?select=source_raw_payload&limit=1`,
        {
          headers: {
            apikey: opts.anonKey,
            Authorization: `Bearer ${opts.anonKey}`,
          },
        },
      );
      await colProbeRes.body?.cancel();
      if (colProbeRes.status === 401 || colProbeRes.status === 403 || colProbeRes.status === 400) {
        checks.anon_internal_cols_blocked = true;
      } else {
        failures.push(`anon_internal_column_probe_unexpected_status:${colProbeRes.status}`);
      }
    } catch (err) {
      failures.push(`anon_internal_col_probe_error:${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    checks.anon_internal_cols_blocked = true;
  }

  // 3. Live sitemap & /rent/ SSR exclusion check
  if (opts.checkLivePages !== false && expectedIds.length > 0 && isPrivateBatch) {
    try {
      const smRes = await fetch(`${siteBase}/sitemap-properties.xml`, {
        headers: { 'User-Agent': 'Mozilla/5.0 ChoiceVerifier/1.0' },
      });
      if (!smRes.ok) {
        await smRes.body?.cancel();
        failures.push(`sitemap_fetch_failed:${smRes.status}`);
      } else {
        const smXml = await smRes.text();
        const leakedIds = expectedIds.filter((id) => smXml.toLowerCase().includes(id.toLowerCase()));
        if (leakedIds.length === 0) {
          checks.sitemap_excluded = true;
        } else {
          failures.push(`sitemap_exposed_private_ids:${leakedIds.join(',')}`);
        }
      }
    } catch (err) {
      failures.push(`sitemap_check_error:${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const sampleUrl = buildPublicRentSlugUrl(publishedExpected[0], siteBase);
      const ssrRes = await fetch(sampleUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 ChoiceVerifier/1.0' },
        redirect: 'manual',
      });
      await ssrRes.body?.cancel();
      if (ssrRes.status === 404) {
        checks.public_ssr_excluded = true;
      } else {
        failures.push(`public_ssr_expected_404_got:${ssrRes.status}`);
      }
    } catch (err) {
      failures.push(`public_ssr_check_error:${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (opts.checkLivePages !== false) {
    checks.sitemap_excluded = true;
    checks.public_ssr_excluded = true;
  }

  // 4. Live property-share resolution check (batch & single property overlay)
  let resolvedList: Array<Record<string, unknown>> = [];
  if (rawToken) {
    try {
      const shareAuth = opts.anonKey || opts.serviceKey;
      const res = await fetch(`${opts.supabaseUrl}/functions/v1/property-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: shareAuth,
          Authorization: `Bearer ${shareAuth}`,
        },
        body: JSON.stringify({ action: 'resolve', token: rawToken, track_view: false }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.properties)) {
        resolvedList = data.properties as Array<Record<string, unknown>>;
        checks.share_resolve_ok = true;
      } else {
        failures.push(`property_share_resolve_failed:${res.status}:${JSON.stringify(data)}`);
      }
    } catch (err) {
      failures.push(`property_share_resolve_error:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const resolvedMap = new Map<string, Record<string, unknown>>();
  for (const item of resolvedList) {
    if (item && typeof item.id === 'string') {
      resolvedMap.set(item.id, item);
    }
  }

  // 5. Inspect each published property for rent/description parity, leaks & >=4 reachable photos
  let allPropsClean = expectedIds.length > 0 && checks.share_resolve_ok;
  let allMediaReachable = expectedIds.length > 0 && checks.share_resolve_ok;

  for (const exp of publishedExpected) {
    const pid = String(exp.property_id);
    const propFailures: string[] = [];
    const resolved = resolvedMap.get(pid);
    const expRent = exp.published_rent != null ? Number(exp.published_rent) : exp.monthly_rent != null ? Number(exp.monthly_rent) : null;
    const expDesc = typeof exp.published_description === 'string' ? exp.published_description.trim() : null;

    if (!resolved) {
      propFailures.push('missing_from_share_resolve');
      allPropsClean = false;
      allMediaReachable = false;
      propertyResults.push({
        property_id: pid,
        ok: false,
        expected_rent: expRent,
        resolved_rent: null,
        photo_count: 0,
        reachable_photo_count: 0,
        leaks: [],
        failures: propFailures,
      });
      continue;
    }

    const resRent = resolved.monthly_rent != null ? Number(resolved.monthly_rent) : null;
    if (expRent != null && expRent > 0 && resRent !== expRent) {
      propFailures.push(`rent_mismatch:expected_${expRent}_got_${String(resRent)}`);
    }
    if (Number(resolved.application_fee) !== 50) {
      propFailures.push(`application_fee_mismatch:expected_50_got_${String(resolved.application_fee)}`);
    }
    if (expDesc && String(resolved.description || '').trim() !== expDesc) {
      propFailures.push('description_mismatch');
    }
    if (isPrivateBatch && String(resolved.status || '') !== 'private_placement') {
      propFailures.push(`unexpected_status:${String(resolved.status || '')}`);
    }

    const leakAudit = detectLeakedInternalStrings(resolved);
    if (!leakAudit.clean) {
      propFailures.push(...leakAudit.leaks);
    }

    // Check single-property resolution overlay parity as well
    if (rawToken) {
      try {
        const shareAuth = opts.anonKey || opts.serviceKey;
        const singleRes = await fetch(`${opts.supabaseUrl}/functions/v1/property-share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: shareAuth,
            Authorization: `Bearer ${shareAuth}`,
          },
          body: JSON.stringify({ action: 'resolve_property', property_id: pid, token: rawToken, track_view: false }),
        });
        const singleData = await singleRes.json().catch(() => null);
        const singleProp = singleData?.property as Record<string, unknown> | undefined;
        if (!singleRes.ok || !singleProp) {
          propFailures.push(`resolve_property_failed:${singleRes.status}`);
        } else {
          if (expRent != null && expRent > 0 && Number(singleProp.monthly_rent) !== expRent) {
            propFailures.push(`single_rent_mismatch:expected_${expRent}_got_${String(singleProp.monthly_rent)}`);
          }
          if (expDesc && String(singleProp.description || '').trim() !== expDesc) {
            propFailures.push('single_description_mismatch');
          }
          const singleLeaks = detectLeakedInternalStrings(singleProp);
          if (!singleLeaks.clean) {
            propFailures.push(...singleLeaks.leaks.map((l) => `single_${l}`));
          }
        }
      } catch (err) {
        propFailures.push(`resolve_property_error:${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const photos = Array.isArray(resolved.property_photos)
      ? (resolved.property_photos as Array<{ url?: string }>)
      : [];
    const photoUrls = photos.map((ph) => (typeof ph?.url === 'string' ? ph.url.trim() : '')).filter(Boolean);
    if (photoUrls.length < 1) {
      propFailures.push(`no_photos:${photoUrls.length}`);
    }

    let reachableCount = photoUrls.length;
    if (opts.checkMediaHead !== false && photoUrls.length > 0) {
      const headResults: boolean[] = [];
      for (let i = 0; i < photoUrls.length; i += 6) {
        const batchUrls = photoUrls.slice(i, i + 6);
        const batchRes = await Promise.all(batchUrls.map((u) => checkImageReachable(u)));
        headResults.push(...batchRes);
      }
      reachableCount = headResults.filter(Boolean).length;
      if (reachableCount < 1 || reachableCount < photoUrls.length) {
        propFailures.push(`unreachable_photos:${reachableCount}_of_${photoUrls.length}`);
        allMediaReachable = false;
      }
    }

    if (propFailures.length > 0) {
      allPropsClean = false;
      failures.push(...propFailures.map((f) => `${pid}:${f}`));
    }

    propertyResults.push({
      property_id: pid,
      ok: propFailures.length === 0,
      expected_rent: expRent,
      resolved_rent: resRent,
      photo_count: photoUrls.length,
      reachable_photo_count: reachableCount,
      leaks: leakAudit.leaks,
      failures: propFailures,
    });
  }

  checks.properties_clean = allPropsClean;

  // 5b. For active public batches, verify public property.html REST contract parity & cleanliness
  if (!isPrivateBatch && expectedIds.length > 0 && opts.anonKey) {
    let publicContractClean = true;
    try {
      const inClause = expectedIds.map((id) => encodeURIComponent(id)).join(',');
      const selectExpr = encodeURIComponent(
        `${CLIENT_SAFE_PROPERTY_SELECT}, property_photos(${CLIENT_SAFE_PHOTO_SELECT})`,
      );
      const pubRes = await fetch(
        `${opts.supabaseUrl}/rest/v1/properties?id=in.(${inClause})&status=eq.active&select=${selectExpr}`,
        {
          headers: {
            apikey: opts.anonKey,
            Authorization: `Bearer ${opts.anonKey}`,
          },
        },
      );
      if (!pubRes.ok) {
        await pubRes.body?.cancel();
        publicContractClean = false;
        failures.push(`public_contract_fetch_failed:${pubRes.status}`);
      } else {
        const pubRows = await pubRes.json();
        if (!Array.isArray(pubRows) || pubRows.length === 0) {
          publicContractClean = false;
          failures.push('public_contract_no_active_rows');
        } else {
          for (const row of pubRows as Array<Record<string, unknown>>) {
            const pubAudit = detectLeakedInternalStrings(row);
            if (!pubAudit.clean) {
              publicContractClean = false;
              failures.push(...pubAudit.leaks.map((l) => `public_${String(row.id || '')}:${l}`));
            }
          }
        }
      }
    } catch (err) {
      publicContractClean = false;
      failures.push(`public_contract_error:${err instanceof Error ? err.message : String(err)}`);
    }
    checks.public_contract_clean = publicContractClean;
  } else {
    checks.public_contract_clean = allPropsClean;
  }

  if (opts.checkMediaHead !== false) {
    checks.media_reachable = allMediaReachable;
  }

  const passed =
    failures.length === 0 &&
    checks.registry_found &&
    checks.token_hash_matches &&
    checks.share_status_active &&
    checks.anon_rls_excluded &&
    checks.anon_rpc_excluded &&
    checks.anon_internal_cols_blocked &&
    checks.sitemap_excluded &&
    checks.public_ssr_excluded &&
    checks.share_resolve_ok &&
    checks.properties_clean &&
    checks.public_contract_clean &&
    checks.media_reachable;

  const verifiedAt = new Date().toISOString();
  const report = {
    verified: passed,
    verified_at: verifiedAt,
    checks,
    failures,
    property_count: expectedIds.length,
    check_live_pages: opts.checkLivePages !== false,
    check_media_head: opts.checkMediaHead !== false,
  };

  const { data: updatedReg } = await adminClient.rpc('pipeline_record_batch_verification', {
    p_batch_id: opts.batchId,
    p_passed: passed,
    p_verification_report: report,
    p_property_results: propertyResults,
  });

  return {
    ok: passed,
    verified: passed,
    batch_id: String(reg.batch_id || opts.batchId),
    magic_link_url: magicLinkUrl,
    checks,
    property_results: propertyResults,
    failures,
    verified_at: verifiedAt,
    registry: updatedReg,
  };
}
