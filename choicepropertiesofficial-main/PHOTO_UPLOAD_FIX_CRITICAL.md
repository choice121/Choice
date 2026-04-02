# 🚨 CRITICAL ISSUE DIAGNOSIS: Photo Upload Failure
**Date:** April 1, 2026  
**Status:** Root cause identified + Fix provided

---

## 🔍 **Diagnosis: Why Photo Upload Fails**

### **Error Message User Sees:**
```
"Photos could not be uploaded. The photo upload service is not fully configured. 
Check that your Supabase secrets are set and the imagekit-upload Edge Function is deployed."
```

### **Root Cause: Missing Edge Function Secrets**

The error happens because:

1. **Frontend sends request** → `/functions/v1/imagekit-upload`
2. **Edge Function receives it** → Checks for Supabase secrets
3. **Secrets missing** → Returns HTTP 500: `{ error: 'ImageKit not configured' }`
4. **Frontend receives error** → Matches regex `/not configured/i` → Shows config error

**Location:** [supabase/functions/imagekit-upload/index.ts](supabase/functions/imagekit-upload/index.ts#L33-L37)

```typescript
const IMAGEKIT_PRIVATE_KEY  = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
const IMAGEKIT_URL_ENDPOINT = Deno.env.get('IMAGEKIT_URL_ENDPOINT');

if (!IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
  return jsonResponse({ success: false, error: 'ImageKit not configured' }, 500);
}
```

---

## ✅ **THE FIX: Set Supabase Edge Function Secrets**

### **Step 1: Go to Supabase Dashboard**
https://app.supabase.com/project/cfsdhylbwzyuvcvbnrel

### **Step 2: Navigate to Edge Functions → Secrets**
Left sidebar → **Edge Functions** → Look for **"Manage Secrets"** or settings icon

### **Step 3: Add These 2 Secrets**

| Secret Name | Value | Where to find |
|---|---|---|
| `IMAGEKIT_PRIVATE_KEY` | Your ImageKit private key | ImageKit Dashboard → Developer Options → Private Key |
| `IMAGEKIT_URL_ENDPOINT` | Your ImageKit URL endpoint | ImageKit Dashboard → Developer Options → URL Endpoint (e.g., `https://ik.imagekit.io/abc123xyz`) |

### **Step 4: Redeploy Edge Function**

After adding secrets, redeploy:
- Option A: Go to **Edge Functions** → **imagekit-upload** → Click **Deploy**
- Option B: Run in terminal:
  ```bash
  npx supabase functions deploy imagekit-upload --project-ref cfsdhylbwzyuvcvbnrel
  ```

### **Step 5: Test**
1. Go to `/apply.html` → Try uploading application document
2. Go to `/landlord/settings.html` → Upload profile picture
3. Go to `/landlord/new-listing.html` → Create listing with 3 photos → Should work ✅

---

## 📋 **Checklist: Required Environment Variables**

### **Cloudflare Pages (Public)**
```
✅ SUPABASE_URL              (in environment variables)
✅ SUPABASE_ANON_KEY         (in environment variables)
✅ IMAGEKIT_URL              (in environment variables)
✅ IMAGEKIT_PUBLIC_KEY       (in environment variables)
✅ SITE_URL                  (in environment variables)
```

### **Supabase Edge Functions (Private Secrets) — 🔴 MISSING!**
```
❌ IMAGEKIT_PRIVATE_KEY      (NOT SET — THIS IS THE PROBLEM!)
❌ IMAGEKIT_URL_ENDPOINT     (NOT SET — THIS IS THE PROBLEM!)
✅ GAS_EMAIL_URL             (should be set if emails work)
✅ GAS_RELAY_SECRET          (should be set if emails work)
```

---

## 🎯 **Why This Happened**

1. **Cloudflare Pages deployment succeeded** because it only needs PUBLIC keys (IMAGEKIT_PUBLIC_KEY, etc.)
2. **Photo uploads fail** because the Edge Function needs PRIVATE keys for server-side authentication
3. **You re-deployed the Edge Function** (from Phase 1) but forgot to add the PRIVATE secrets

**Timeline:**
- Phase 1: We deployed code changes ✅
- Phase 1: We ran database migration ✅
- Phase 1: NO ONE set IMAGEKIT_PRIVATE_KEY or IMAGEKIT_URL_ENDPOINT ❌

---

## 🔐 **ImageKit Setup (If You Haven't Done This)**

If you don't have ImageKit credentials:

1. Go to **https://imagekit.io** → Sign up free
2. Go to **Dashboard** → **Developer Options**
3. Copy these 3 values:
   - **URL Endpoint** — `https://ik.imagekit.io/abc123xyz`
   - **Public Key** — `public_Xxx...`
   - **Private Key** — `private_Yyy...` ← This is secret!

4. Set in Supabase Edge Functions Secrets:
   - `IMAGEKIT_PRIVATE_KEY` = `private_Yyy...`
   - `IMAGEKIT_URL_ENDPOINT` = `https://ik.imagekit.io/abc123xyz`

5. Set in Cloudflare Pages environment variables:
   - `IMAGEKIT_PUBLIC_KEY` = `public_Xxx...`
   - `IMAGEKIT_URL` = `https://ik.imagekit.io/abc123xyz`

---

## 🧪 **Test After Fixing**

### **Test 1: Landlord Profile Picture** (Settings Page)
1. Go to `/landlord/settings.html` (assuming logged in)
2. Scroll to "Profile Picture" section
3. Click "Choose Photo" → Upload any JPG/PNG < 5MB
4. ✅ Should upload and appear as avatar
5. ❌ Before fix → Silent failure or "service not configured" error

### **Test 2: New Listing with Photos**
1. Go to `/landlord/new-listing.html`
2. Fill form → Step 4: Add photos
3. Upload 3+ photos
4. Click "Submit Listing"
5. ✅ Bar should show progress, all upload successfully
6. ❌ Before fix → All photos fail with config error

### **Test 3: Application Document Upload**
1. Go to `/apply.html` → Fill form
2. Upload ID / Income documents
3. ✅ Should upload to Supabase Storage
4. ❌ Before fix → Upload fails

---

## 📊 **Quick Verification Checklist**

```bash
# After you set the secrets, check this in Supabase:

# 1. Go to SQL Editor and run:
SELECT COUNT(*) FROM properties WHERE array_length(photo_urls, 1) > 0;
# (Should show existing listings with photos)

# 2. Create test listing with photo → Check if it saves
# 3. Try signup with avatar → Should work now
```

---

## 🆘 **If Still Doesn't Work**

After setting secrets and redeploying, if uploads still fail:

1. **Check Supabase Edge Function Logs:**
   - Supabase Dashboard → Edge Functions → imagekit-upload → Logs
   - Look for error messages from last few minutes

2. **Common errors & fixes:**
   - `"ImageKit not configured"` → Secrets not set (see above)
   - `"Unauthorized"` → Wrong private key
   - `"Invalid endpoint"` → Wrong URL endpoint format
   - `"413 Payload Too Large"` → File > 15 MB (compress first)

3. **Check if imagekit-upload Edge Function is deployed:**
   - Supabase Dashboard → Edge Functions → imagekit-upload
   - Should have green "✅ Deployed" badge
   - If not, click Deploy button

---

## ⏱️ **Time to Fix**

- Setting secrets: **2 minutes**
- Redeploying function: **1 minute**
- Total: **~3 minutes**

---

## 📝 **Summary**

| Item | Status |
|---|---|
| **Root cause identified** | ✅ Missing IMAGEKIT_PRIVATE_KEY & IMAGEKIT_URL_ENDPOINT |
| **Fix provided** | ✅ Add secrets to Supabase Edge Functions |
| **Testing steps** | ✅ 3 test scenarios |
| **Documentation** | ✅ Complete setup guide |

**Next step:** Add the 2 missing Supabase secrets and redeploy. Photo uploads will work immediately after! 🚀
