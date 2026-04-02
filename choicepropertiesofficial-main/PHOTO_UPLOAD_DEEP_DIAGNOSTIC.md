# 🔬 PHOTO UPLOAD DEEP DIAGNOSTIC PROTOCOL
**Systematic Investigation of Photo Upload Failures**  
**Status:** Complete diagnostic methodology + evidence collection

---

## 📊 LAYER-BY-LAYER INVESTIGATION

We'll trace the upload through **5 critical layers** and collect evidence from each:

```
1. BROWSER (Client-side JavaScript)
   ↓ (Does JS code execute? Any errors?)
2. SUPABASE AUTHENTICATION
   ↓ (Is user authenticated? Valid session token?)
3. EDGE FUNCTION (imagekit-upload)
   ↓ (Does function receive request? Can it access secrets?)
4. IMAGEKIT API
   ↓ (Does ImageKit respond? Auth credentials valid?)
5. RESPONSE HANDLING
   ↓ (Does browser receive response? Correct CDN URL?)
```

---

## 🔍 DIAGNOSTIC CHECKLIST

### **LAYER 1: Browser Console — Client-Side Execution**

**Action:** Open photo upload page and try uploading. Capture ALL browser console output.

**Steps:**
1. Go to [Landlord Settings → Profile Picture](https://choiceproperties.com/landlord/profile.html) OR [Create Listing](https://choiceproperties.com/landlord/new-listing.html)
2. Open DevTools → **Console** tab
3. Try uploading a small JPG photo
4. Capture EVERYTHING in console (errors, warnings, logs)

**Evidence to Collect:**
```
❓ Question                              | Evidence to Share
---------                               | ---------
Do you see ANY JavaScript errors?       | Screenshot of console
What's the exact error message?          | Full error text
What's the error stack trace?           | Full stack (if available)
Does upload show progress at all?       | Yes/No + screenshot
What do you see in Network tab?         | POST request details
```

**Check These Files Loading:**
- [ ] `js/imagekit.js` loaded successfully (Network tab, green 200)
- [ ] `js/cp-api.js` loaded successfully (Network tab, green 200)
- [ ] Any 404 errors on JS files?

---

### **LAYER 2: Supabase Authentication — Session Validation**

**Action:** Check if you're properly authenticated in Supabase.

**Steps:**
1. Still on Settings/New Listing page
2. In DevTools Console, run:
```javascript
// Check current auth session
const session = await cp.sb.auth.getSession();
console.log('Auth Session:', session);

// Check if user ID exists
const user = session?.data?.user;
console.log('Current User ID:', user?.id);
console.log('User Email:', user?.email);

// Check if token is valid
const token = session?.data?.session?.access_token;
console.log('Has Access Token:', !!token);
console.log('Token Length:', token?.length);
```

**Evidence to Collect:**
```
❓ Question                              | Evidence to Share
---------                               | ---------
Do you see a valid user ID?             | User ID (hash like abc12345...)
Do you see a valid email?               | Email shown in console
Is there an access_token?               | Yes/No + token length
Is token 300+ characters long?          | Yes/No
Any errors in auth check?               | Full error message
```

**If anything is NULL or undefined:**
- ❌ You're NOT authenticated — this would cause hidden upload failure
- ✅ Fix: Log out and log back in

---

### **LAYER 3: Edge Function Invocation — Request to Supabase**

**Action:** Capture the actual HTTP request to Supabase Edge Function.

**Steps:**
1. In DevTools → **Network** tab
2. Filter by `XHR` requests
3. Try uploading 1 small photo
4. Find the request to `/functions/v1/imagekit-upload`
5. Click it to view details

**Evidence to Collect — Request Tab:**
```
Method:         POST
URL:            https://[YOUR-SUPABASE-URL]/functions/v1/imagekit-upload?filename=...
Headers:        (Check Authorization header present?)
Send Body:      (Should contain file blob)
```

**Evidence to Collect — Response Tab:**
```
Status Code:    ??? (200 = success, 500 = error, 401 = auth fail)
Response Body:  Full JSON response (full text, not just summary)
Response Headers: Any error headers?
```

**Share Exact Response:**
```json
// Example of WHAT TO SHARE:
{
  "success": false,
  "error": "...",
  "details": "..."
}
```

---

### **LAYER 4: Supabase Edge Function Logs — Server-Side Execution**

**Action:** Check Supabase logs to see if function even received the request.

**Steps:**
1. Go to Supabase Dashboard
2. Navigate to: **Edge Functions** → **imagekit-upload** → **Recent Logs** or **Logs** tab
3. Look for requests in last 5 minutes
4. Find the one matching your upload attempt (check timestamps)
5. Click to see full log output

**Evidence to Collect:**
```
❓ Question                                      | Evidence to Share
---------                                       | ---------
Do you see ANY logs for imagekit-upload?       | Screenshot
Are there request logs from last 5 min?        | Yes/No
What's the function execution status?          | Success/Error/Timeout
What's the full error message (if any)?        | Exact error text
How long did function take? (ms)               | Duration
Did function log any data before error?        | Any console.log output?
```

**Critical Checks in Logs:**
- ❌ `"error": "ImageKit not configured"` → Secrets still missing
- ❌ `"error": "Unauthorized"` → Auth token rejected
- ❌ `"error": "IMAGEKIT_PRIVATE_KEY is undefined"` → Secret not set
- ❌ `"error": "IMAGEKIT_URL_ENDPOINT is undefined"` → Secret not set
- ❌ `504 Timeout` → Function takes >600s
- ✅ Any other error → Share full message

---

### **LAYER 5: Supabase Secrets Verification — Configuration Check**

**Action:** Confirm secrets are REALLY set in Supabase.

**Steps:**
1. Go to Supabase Dashboard
2. Navigate to: **Edge Functions** → **Manage Secrets** (top right button)
3. Look for these secrets:
   - `IMAGEKIT_PRIVATE_KEY`
   - `IMAGEKIT_URL_ENDPOINT`
   - `GAS_EMAIL_URL`
   - `GAS_RELAY_SECRET`

**Evidence to Collect:**
```
IMAGEKIT_PRIVATE_KEY      [ ] ✅ Present   [ ] ❌ Missing
IMAGEKIT_URL_ENDPOINT     [ ] ✅ Present   [ ] ❌ Missing
GAS_EMAIL_URL             [ ] ✅ Present   [ ] ❌ Missing
GAS_RELAY_SECRET          [ ] ✅ Present   [ ] ❌ Missing
```

**If Secrets Are Set:**
- Check if they have **REAL VALUES** (not empty strings, not just "undefined")
- Check **exact spelling** (case-sensitive!)
- Share format (not the actual value, but format):
  - `IMAGEKIT_PRIVATE_KEY` should look like: `base64string...` or `sk_private_...`
  - `IMAGEKIT_URL_ENDPOINT` should look like: `https://ik.imagekit.io/abc123`

---

### **LAYER 6: Redeploy Status — Function Version Check**

**Action:** Verify imagekit-upload function is on latest version.

**Steps:**
1. Supabase Dashboard → **Edge Functions** → **imagekit-upload**
2. Look for "Last deployed" timestamp
3. Note the timestamp

**Evidence to Collect:**
```
Deployment Timestamp:  [When was it last deployed?]
Is this AFTER you added secrets?  [ ] Yes [ ] No
Did you redeploy AFTER adding secrets?  [ ] Yes [ ] No
```

**CRITICAL:** If you added secrets but didn't redeploy or restarted the function, that's the issue!

---

### **LAYER 7: ImageKit Account Verification — API Credential Check**

**Action:** Verify ImageKit credentials are valid and quota not exceeded.

**Steps:**
1. Go to ImageKit Dashboard
2. Check: **Settings** → **API Keys**
3. Verify the **Private Key** matches `IMAGEKIT_PRIVATE_KEY` in Supabase
4. Verify the **URL Endpoint** matches `IMAGEKIT_URL_ENDPOINT` in Supabase
5. Go to: **Usage & Billing** to check upload quota

**Evidence to Collect:**
```
❓ Question                                          | Evidence to Share
---------                                           | ---------
Do credentials in ImageKit match Supabase?         | Match / Mismatch
Is there any character difference?                 | Yes / No
What's your upload quota remaining (GB)?           | Number
Have you uploaded files successfully before?       | Yes / No (when?)
Any rate limit errors recently?                    | Yes / No
```

---

## 🚀 DIAGNOSTIC EXECUTION PLAN

### **Step 1: Browser Console Diagnostics (5 min)**
- Try upload and capture console errors
- **→ Share screenshots with me**

### **Step 2: Network Tab Capture (5 min)**
- Look at `/imagekit-upload` HTTP request
- Capture request headers and FULL response body
- **→ Share exact response JSON**

### **Step 3: Supabase Edge Function Logs (5 min)**
- Check if function received request
- Check if any error shows in logs
- **→ Share full log output**

### **Step 4: Secrets Verification (3 min)**
- Confirm all 4 secrets are present and have values
- Check for typos in secret names
- **→ Share verification screenshot**

### **Step 5: Redeploy Check (2 min)**
- When was imagekit-upload last deployed?
- Was it AFTER adding secrets?
- If not: Manually redeploy function
- **→ Share new deployment timestamp**

### **Step 6: ImageKit Credentials Audit (3 min)**
- Verify Private Key matches Supabase
- Check upload quota
- **→ Share comparison**

---

## 📝 EVIDENCE COLLECTION TEMPLATE

Use this template to organize findings. Copy & paste into your message:

```
## DIAGNOSTIC EVIDENCE

### Browser Console (Layer 1)
[ ] JavaScript errors found: YES / NO
Error message: _______________________
Stack trace: _______________________
Network tab shows imagekit-upload request: YES / NO

### Authentication (Layer 2)
[ ] User authenticated: YES / NO
[ ] User ID present: YES / NO / ID: _______
[ ] Access token present: YES / NO

### Edge Function Request (Layer 3)
[ ] Request reaches Supabase: YES / NO
[ ] HTTP Status Code: _______
[ ] Full Response JSON:
```json
{response here}
```

### Edge Function Logs (Layer 4)
[ ] Logs visible in Supabase: YES / NO
[ ] Last execution: _______ (timestamp)
[ ] Error message in logs: _______

### Secrets Verification (Layer 5)
[ ] IMAGEKIT_PRIVATE_KEY: Present / Missing
[ ] IMAGEKIT_URL_ENDPOINT: Present / Missing
[ ] GAS_EMAIL_URL: Present / Missing
[ ] GAS_RELAY_SECRET: Present / Missing

### Redeploy Status (Layer 6)
[ ] Last deployed: _______ (date & time)
[ ] Deployed AFTER secrets added: YES / NO

### ImageKit Credentials (Layer 7)
[ ] Credentials match Supabase: YES / NO
[ ] Upload quota remaining: _______ (GB)
```

---

## 🎯 POSSIBLE ROOT CAUSES (Ranked by Likelihood)

| Rank | Issue | Symptoms | Fix |
|------|-------|----------|-----|
| 1️⃣ | Secrets set but not redeployed | Same error after adding secrets | Manually redeploy imagekit-upload function |
| 2️⃣ | Secrets have wrong values | Edge logs show "Unauthorized" | Copy/paste exact values from ImageKit |
| 3️⃣ | User not authenticated | Auth session returns null | Log out → Clear cookies → Log back in |
| 4️⃣ | ImageKit quota exceeded | 403 error from imagekit-upload | Check ImageKit usage % |
| 5️⃣ | Browser cache stale | Old JS still running | Clear browser cache + hard refresh (Ctrl+Shift+R) |
| 6️⃣ | Cloudflare cache stale | Old config.js being served | Purge Cloudflare cache |
| 7️⃣ | Network/Firewall blocking | Request never reaches Supabase | Check if Replit IP whitelisted in ImageKit |

---

## 📞 NEXT: Share Diagnostic Evidence

Once you've collected evidence from Steps 1-6 above, share:

1. **Browser console screenshot** (with any errors)
2. **Network tab response JSON** (exact response from `/imagekit-upload`)
3. **Supabase logs screenshot** (last 5 uploads)
4. **Secrets verification screenshot** (all 4 secrets present?)
5. **Redeploy timestamp** (when was function last deployed?)
6. **ImageKit credentials comparison** (do they match Supabase?)

Then I'll pinpoint the EXACT issue and provide focused fix. 🎯

---

**Ready?** Let's trace this step-by-step. Start with **Layer 1 (Browser Console)** and come back with evidence! 💪
