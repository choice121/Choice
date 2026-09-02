const fs = require('fs');
let content = fs.readFileSync('/app/applet/frontend/src/pages/ApplyPage.tsx', 'utf8');

// UI Fields
const coApplicantUI = `
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                      Will you have a Co-Applicant?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasCoApplicant" value="yes" checked={form.hasCoApplicant === 'yes'} onChange={(e) => updateField('hasCoApplicant', 'yes')} /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasCoApplicant" value="no" checked={form.hasCoApplicant === 'no'} onChange={(e) => updateField('hasCoApplicant', 'no')} /> No
                      </label>
                    </div>
                    {form.hasCoApplicant === 'yes' && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Co-Applicant Name</label>
                          <input type="text" value={form.coApplicantName} onChange={(e) => updateField('coApplicantName', e.target.value)} className="w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 border-slate-700 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Co-Applicant Email</label>
                          <input type="email" value={form.coApplicantEmail} onChange={(e) => updateField('coApplicantEmail', e.target.value)} className="w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 border-slate-700 outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
`;

content = content.replace('                    </div>\n                  </div>\n                </div>\n              )}\n\n              {/* STEP 2', 
  '                    </div>\n                  </div>\n' + coApplicantUI + '                </div>\n              )}\n\n              {/* STEP 2');


const vehiclesUI = `
                  <div className="pt-5 border-t border-slate-800">
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                      Do you have any vehicles?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasVehicles" value="yes" checked={form.hasVehicles === 'yes'} onChange={(e) => updateField('hasVehicles', 'yes')} /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasVehicles" value="no" checked={form.hasVehicles === 'no'} onChange={(e) => updateField('hasVehicles', 'no')} /> No
                      </label>
                    </div>
                    {form.hasVehicles === 'yes' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Vehicle Details (Make, Model, Year, Plate)</label>
                        <input type="text" value={form.vehicleDetails} onChange={(e) => updateField('vehicleDetails', e.target.value)} className="w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 border-slate-700 outline-none" placeholder="e.g. 2020 Toyota Camry (XYZ123)" />
                      </div>
                    )}
                  </div>
`;

content = content.replace("                  {form.hasPets === 'yes' && (", vehiclesUI + "\n                  {form.hasPets === 'yes' && (");


const docsUI = `
                  <div className="pt-5 border-t border-slate-800">
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                      Upload Documents (ID, Pay Stubs, etc.)
                    </label>
                    <p className="text-xs text-slate-400 mb-3">Please upload PDF, JPG, or PNG files. Up to 4 files, max 3MB total.</p>
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        if (e.target.files) {
                          updateField('documents', Array.from(e.target.files) as any);
                        }
                      }} 
                      className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-400 hover:file:bg-cyan-500/30"
                    />
                    {form.documents && form.documents.length > 0 && (
                      <ul className="mt-3 text-xs text-slate-300 list-disc pl-5">
                        {form.documents.map((f: any, i: number) => (
                          <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    )}
                  </div>
`;

content = content.replace('                    </div>\n                  </div>\n                </div>\n              )}\n\n              {/* STEP 5',
  '                    </div>\n                  </div>\n' + docsUI + '                </div>\n              )}\n\n              {/* STEP 5');


// State definitions (be careful to replace only ONCE)
content = content.replace('  // Step 1: Applicant Identity\n  firstName: string', 
  "  // Step 1: Applicant Identity\n  hasCoApplicant: 'yes' | 'no'\n  coApplicantName: string\n  coApplicantEmail: string\n  firstName: string");

content = content.replace('  // Step 2: Residency & Occupancy\n  currentAddress: string', 
  "  // Step 2: Residency & Occupancy\n  hasVehicles: 'yes' | 'no'\n  vehicleDetails: string\n  documents: any[]\n  currentAddress: string");

content = content.replace("    firstName: '',", 
  "    hasCoApplicant: 'no',\n    coApplicantName: '',\n    coApplicantEmail: '',\n    firstName: '',");

content = content.replace("    currentAddress: '',", 
  "    hasVehicles: 'no',\n    vehicleDetails: '',\n    documents: [],\n    currentAddress: '',");


// HandleSubmit modifications
const submitStart = content.indexOf('const payload = {');
const submitEndStr = "localStorage.setItem('cp_last_application_id', generatedId)";
const submitEnd = content.indexOf(submitEndStr);

if (submitStart !== -1 && submitEnd !== -1) {
const newSubmit = `
        const formData = new FormData()
        formData.append('Property ID', form.propertyId)
        formData.append('First Name', form.firstName)
        formData.append('Last Name', form.lastName)
        formData.append('Email', form.email)
        formData.append('Phone', form.phone)
        formData.append('DOB', form.dob)
        formData.append('SSN', form.ssnLast4)
        formData.append('Has Co-Applicant', form.hasCoApplicant)
        if (form.hasCoApplicant === 'yes') {
          formData.append('Co-Applicant Name', form.coApplicantName)
          formData.append('Co-Applicant Email', form.coApplicantEmail)
        }
        formData.append('Current Address', form.currentAddress)
        formData.append('Residency Duration', form.residencyDuration)
        formData.append('Current Rent Amount', form.currentRent)
        formData.append('Current Landlord Name', form.currentLandlordName)
        formData.append('Landlord Phone', form.currentLandlordPhone)
        formData.append('Total Occupants', form.totalOccupants)
        formData.append('Has Pets', form.hasPets)
        if (form.hasPets === 'yes') formData.append('Pet Details', form.petDetails)
        formData.append('Has Vehicle', form.hasVehicles)
        if (form.hasVehicles === 'yes') formData.append('Vehicle Make', form.vehicleDetails)
        
        formData.append('Employment Status', form.employmentStatus)
        formData.append('Employer', form.employerName)
        formData.append('Job Title', form.jobTitle)
        formData.append('Monthly Income', form.monthlyIncome)
        formData.append('Other Income', form.incomeSource)
        
        formData.append('Reference 1 Name', form.referenceName)
        formData.append('Reference 1 Phone', form.referencePhone)
        formData.append('Reference 1 Relationship', form.referenceRelationship)
        formData.append('Emergency Contact Name', form.emergencyContactName)
        formData.append('Emergency Contact Phone', form.emergencyContactPhone)
        
        formData.append('Terms Consent', 'yes')
        formData.append('smsConsent', form.smsConsent ? 'on' : '')

        // Base64 encode documents
        const encodeFile = (file: any) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
             const res = reader.result as string;
             resolve(res.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        if (form.documents && form.documents.length > 0) {
          const encoded = await Promise.all((form.documents as any[]).map(encodeFile))
          encoded.forEach((b64, i) => {
            formData.append(\`_docFile_\${i}_name\`, form.documents[i].name)
            formData.append(\`_docFile_\${i}_type\`, form.documents[i].type || 'application/octet-stream')
            formData.append(\`_docFile_\${i}_data\`, b64)
          })
        }

        const res = await fetch(((window.CONFIG && window.CONFIG.SUPABASE_URL) || 'https://tlfmwetmhthpyrytrcfo.supabase.co') + '/functions/v1/receive-application', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        })
        if (!res.ok) throw new Error('Submission failed')
`;
  content = content.substring(0, submitStart) + newSubmit + content.substring(submitEnd + submitEndStr.length);
} else {
  console.log("Could not find submit block");
}

fs.writeFileSync('/app/applet/frontend/src/pages/ApplyPage.tsx', content);
