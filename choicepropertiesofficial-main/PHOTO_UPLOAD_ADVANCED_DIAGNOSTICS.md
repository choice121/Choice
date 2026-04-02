# 🔬 ADVANCED PHOTO UPLOAD DIAGNOSTICS
**Deep Code Analysis + Hidden Issues Identification**  
**Status:** Advanced troubleshooting beyond standard checks

---

## 🚨 NEWLY IDENTIFIED POTENTIAL ISSUES

After analyzing your codebase, I found **3 additional failure points** that aren't shown by standard diagnostics:

---

## **ISSUE #1: Base64 Data URI Prefix Not Being Stripped**

**What It Is:**
The browser sends base64 as a **data URI** with a prefix:
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABA...
```

Your Edge Function should strip the `data:...;base64,` prefix before sending to ImageKit.

**Code Location:**
[supabase/functions/imagekit-upload/index.ts](supabase/functions/imagekit-upload/index.ts#L62)

**Current Fix (Lines 62-64):**
```typescript
const base64Raw = typeof fileData === 'string' && fileData.includes(',')
  ? fileData.split(',')[1]
  : fileData;
```

**How to Verify It's Working:**
1. Open browser DevTools → **Network** tab
2. Find the `/imagekit-upload` POST request
3. Click → **Request** tab
4. Look at the "Request Payload" (the JSON body being sent)
5. Check the `fileData` field

**What You'll See:**
```
❌ BROKEN:   "fileData": "data:image/jpeg;base64,/9j/4AAQ..."
✅ WORKING:  "fileData": "/9j/4AAQSkZJ..."
```

**If Broken:** ImageKit receives the data URI prefix and can't parse it → upload fails silently.

**How to Fix:**
- The code already has the fix — check if [js/imagekit.js](js/imagekit.js#L128) is sending the full data URI correctly
- Run in console:
```javascript
// Check what's being sent
const file = document.querySelector('input[type="file"]').files[0];
const reader = new FileReader();
reader.onload = (e) => {
  console.log('First 100 chars of base64:', e.target.result.substring(0, 100));
  console.log('Contains data URI prefix?', e.target.result.includes('data:image'));
};
reader.readAsDataURL(file);
```

---

## **ISSUE #2: Authorization Header Not Being Sent Correctly**

**What It Is:**
The Edge Function needs either:
1. A valid **JWT token** in the `Authorization: Bearer` header, OR
2. The **apikey** header with it

**Code Location:**
[js/imagekit.js](js/imagekit.js#L137-L139)

**Current Code (Lines 137-139):**
```javascript
xhr.setRequestHeader('apikey',        anonKey);
xhr.setRequestHeader('Authorization', `Bearer ${userToken}`);
xhr.setRequestHeader('Content-Type',  'application/json');
```

**How to Verify It's Working:**
1. Open browser DevTools → **Network** tab
2. Find the `/imagekit-upload` POST request
3. Click → **Headers** tab
4. Look for:
   - `Authorization: Bearer [long-token]`
   - `apikey: [public-key]`

**What You'll See:**
```
❌ BROKEN:   Authorization: Bearer null
             Authorization: Bearer undefined
❌ BROKEN:   apikey: (empty)
✅ WORKING:  Authorization: Bearer eyJhbGc...
             apikey: eyJhbGc...
```

**If Broken:** Edge Function rejects request with 401 Unauthorized.

**How to Fix:**
Check if user is authenticated:
```javascript
// In browser console:
const session = await window.cp.sb?.auth?.getSession?.();
console.log('Session:', session?.data?.user);
console.log('Access Token:', session?.data?.session?.access_token?.substring(0, 20) + '...');
```

If token is null/undefined:
- ❌ User NOT authenticated
- ✅ Fix: Log out → Log back in

---

## **ISSUE #3: Supabase Edge Function Cold Start Timeout**

**What It Is:**
First request to an Edge Function can take **10-60+ seconds** due to "cold start" delay.

**Why It Happens:**
- Function wasn't called in last 15 minutes
- Supabase spins up a new server instance
- Browser times out waiting for response

**Code Location:**
[js/imagekit.js](js/imagekit.js#L148-L149)

**Current Timeout (Lines 148-149):**
```javascript
xhr.timeout   = 55_000; // 55 seconds — must be under Supabase 60s limit
```

**Symptoms:**
- Upload shows progress (0% → 40% → 85%)
- Then hangs at 85% for 10+ seconds
- Then fails with **"Upload timed out"** message

**How to Verify:**
1. Check Supabase Dashboard → **Edge Functions** → **imagekit-upload** 
2. Look for execution duration in logs
3. First upload: ~30-60 seconds (cold start)
4. Subsequent uploads: ~2-5 seconds

**If This Is the Issue:**
- First photo upload on the site always fails
- Retry immediately and it works

**How to Fix:**
- No code fix needed — this is expected behavior
- Just **retry the upload** after it times out
- Or increase timeout from 55s to 70s (but might not help if Supabase cuts it at 60s)

---

## 🔍 ADVANCED DIAGNOSTIC TESTS

### **Test 1: Verify Edge Function is Reachable**
Run in browser console:
```javascript
const url = `${CONFIG.SUPABASE_URL}/functions/v1/imagekit-upload`;
const session = await window.cp.sb.auth.getSession();

console.log('Edge Function URL:', url);
console.log('Has Session?', !!session?.data?.user);

// Try a simple ping
const testRes = await fetch(url, {
  method: 'OPTIONS',
});
console.log('CORS Ping Status:', testRes.status);
console.log('CORS Headers:', {
  'access-control-allow-origin': testRes.headers.get('access-control-allow-origin'),
  'access-control-allow-methods': testRes.headers.get('access-control-allow-methods'),
});
```

**Expected Results:**
```
Edge Function URL: https://[YOUR-SUPABASE-URL]/functions/v1/imagekit-upload
Has Session? true
CORS Ping Status: 200
CORS Headers: {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS'
}
```

**If CORS Ping Fails:**
- ❌ Function completely unreachable
- ✅ Check Supabase status page
- ✅ Check browser firewall/proxy

---

### **Test 2: Verify ImageKit Credentials Format**

Go to Supabase Dashboard → **Edge Functions** → **Manage Secrets**

Check the format of your secrets:

| Secret | Should Look Like | Example |
|--------|------------------|---------|
| `IMAGEKIT_PRIVATE_KEY` | `sk_private_...` or base64 | `sk_private_abc123xyz789...` |
| `IMAGEKIT_URL_ENDPOINT` | `https://ik.imagekit.io/...` | `https://ik.imagekit.io/myaccount` |

**Red Flags:**
- ❌ `IMAGEKIT_PRIVATE_KEY` is empty `""`
- ❌ `IMAGEKIT_URL_ENDPOINT` is empty `""`
- ❌ `IMAGEKIT_PRIVATE_KEY` has wrong format (should be `sk_private_...` not regular key)
- ❌ `IMAGEKIT_URL_ENDPOINT` is missing `https://` protocol

---

### **Test 3: Manual ImageKit Upload Test**

Simulate what the Edge Function does. Run in browser console:

```javascript
const PRIVATE_KEY = "sk_private_YOUR_KEY_HERE"; // Replace with your actual key
const URL_ENDPOINT = "https://ik.imagekit.io/YOUR_ID"; // Replace with your URL

// Create a test image
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 100;
canvas.getContext('2d').fillStyle = 'red';
canvas.getContext('2d').fillRect(0, 0, 100, 100);

// Convert to base64
canvas.toBlob(async (blob) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1]; // Strip prefix
    const credentials = btoa(`${PRIVATE_KEY}:`);
    const formData = new FormData();
    formData.append('file', base64);
    formData.append('fileName', 'test.jpg');

    try {
      const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}` },
        body: formData,
      });
      const data = await res.json();
      console.log('ImageKit Response:', data);
      if (res.ok) {
        console.log('✅ ImageKit credentials are VALID');
      } else {
        console.log('❌ ImageKit error:', data);
      }
    } catch (err) {
      console.log('❌ Network error:', err.message);
    }
  };
  reader.readAsDataURL(blob);
}, 'image/jpeg');
```

**Expected Output:**
```
✅ ImageKit Response: { "url": "https://ik.imagekit.io/...", "fileId": "..." }
```

**If Error:**
```
❌ ImageKit error: { "error": { "message": "Invalid API signature" } }
→ Private key is wrong

❌ ImageKit error: { "error": { "message": "Not authenticated" } }
→ Private key missing or malformed

❌ Network error: CORS blocked
→ ImageKit firewall issue (unlikely)
```

---

### **Test 4: Check Supabase Database Auth RLS**

Photos are stored in two places:
1. **ImageKit CDN** (handled by imagekit-upload function)
2. **Supabase Database** (listings table with photo URLs)

**Verify database permissions:**
```javascript
// Check if user can insert into listings table
const { error } = await window.cp.sb()
  .from('properties')
  .select('id')
  .limit(1);

if (error) {
  console.log('❌ Database read failed:', error);
} else {
  console.log('✅ Database read OK');
}
```

---

### **Test 5: Check Browser Storage & Cache**

Old cached data might be preventing new uploads.

**Steps:**
1. DevTools → **Application** tab
2. Click **Storage** → **Local Storage** → Select your domain
3. Look for `cp_config` or `cp_auth`
4. Delete all storage for this domain
5. Hard refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
6. Try upload again

---

## 📋 SYSTEMATIC TROUBLESHOOTING FLOWCHART

```
Photo Upload Fails
    ↓
[Step 1] Browser Console
    ├─ See error? → Share exact error message
    └─ No error? → Go to Step 2
    ↓
[Step 2] Network Tab
    ├─ Request not sent? → Auth issue (#2)
    ├─ 401 response? → Auth issue (#2)
    ├─ 500 response? → Secrets missing/wrong (#1)
    ├─ 504/timeout? → Cold start issue (#3)
    └─ 502 response? → ImageKit unreachable
    ↓
[Step 3] Supabase Logs
    ├─ No logs? → Function not deployed
    ├─ Logs show error? → Share error message
    └─ Logs empty? → Function hung/killed
    ↓
[Step 4] Secrets Check
    ├─ Empty? → Add secrets
    ├─ Wrong format? → Fix format
    └─ Present? → Verify value matches ImageKit
    ↓
[Step 5] Redeploy
    └─ Redeploy imagekit-upload function
    ↓
[Step 6] Retry Upload
    └─ Success? ✅ Done
    └─ Still fails? → Share all evidence
```

---

## 📞 EVIDENCE TO SHARE (Advanced)

If photo upload **still doesn't work after checking everything above**, share:

### **1. Browser Console Output**
```
Screenshot showing:
- Any errors/warnings
- Auth session info
- Network request details
```

### **2. Network Request Full Details**
```
POST /functions/v1/imagekit-upload
Headers:
  - Authorization: Bearer [first 50 chars]..[rest hidden]
  - apikey: [first 50 chars]..[rest hidden]

Response (copy-paste ENTIRE JSON):
{
  success: false,
  error: "..."
}
```

### **3. Supabase Edge Function Logs**
```
Screenshot showing:
- Function name: imagekit-upload
- Execution time
- Status (success/error)
- Full error message (if any)
```

### **4. Secrets Verification**
```
Checklist:
[ ] IMAGEKIT_PRIVATE_KEY — Present? Format: _______
[ ] IMAGEKIT_URL_ENDPOINT — Present? Value: _______
[ ] When was it last redeployed? _______
```

### **5. File Type & Size**
```
- File name: _______
- File size: _______ MB
- File type: _______ (JPEG/PNG/WebP)
- Dimensions: _______ x _______
```

---

## 🎯 NEXT: Run These Tests Now

1. ✅ **Verify Base64** — Check if `fileData` prefix is being stripped (Test 1)
2. ✅ **Verify Auth Headers** — Check if `Authorization` header has a token (Test 2)
3. ✅ **Check Logs** — Share Supabase Edge Function logs from last 5 minutes
4. ✅ **Verify Secrets** — Screenshot of Supabase → Edge Functions → Manage Secrets
5. ✅ **Test ImageKit Directly** — Run the manual test (Test 3) and share result

**Then return with findings and I'll provide a specific fix!** 🚀
