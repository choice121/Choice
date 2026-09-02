const fs = require('fs');
let content = fs.readFileSync('/app/applet/frontend/src/pages/ApplyPage.tsx', 'utf8');

// Co-Applicant UI
const coApplicantUI = `
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                      Will you have a Co-Applicant?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasCoApplicant" value="yes" checked={form.hasCoApplicant === 'yes'} onChange={(e) => updateField('hasCoApplicant', e.target.value)} /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasCoApplicant" value="no" checked={form.hasCoApplicant === 'no'} onChange={(e) => updateField('hasCoApplicant', e.target.value)} /> No
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


// Vehicles UI
const vehiclesUI = `
                  <div className="pt-5 border-t border-slate-800">
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-2">
                      Do you have any vehicles?
                    </label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasVehicles" value="yes" checked={form.hasVehicles === 'yes'} onChange={(e) => updateField('hasVehicles', e.target.value)} /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="hasVehicles" value="no" checked={form.hasVehicles === 'no'} onChange={(e) => updateField('hasVehicles', e.target.value)} /> No
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

content = content.replace('                  {form.hasPets === \\'yes\\' && (', vehiclesUI + '\n                  {form.hasPets === \\'yes\\' && (');


// Documents UI
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
                          updateField('documents', Array.from(e.target.files));
                        }
                      }} 
                      className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-400 hover:file:bg-cyan-500/30"
                    />
                    {form.documents && form.documents.length > 0 && (
                      <ul className="mt-3 text-xs text-slate-300 list-disc pl-5">
                        {form.documents.map((f, i) => (
                          <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    )}
                  </div>
`;

content = content.replace('                    </div>\n                  </div>\n                </div>\n              )}\n\n              {/* STEP 5',
  '                    </div>\n                  </div>\n' + docsUI + '                </div>\n              )}\n\n              {/* STEP 5');

fs.writeFileSync('/app/applet/frontend/src/pages/ApplyPage.tsx', content);
