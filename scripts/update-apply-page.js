const fs = require('fs');
let content = fs.readFileSync('/app/applet/frontend/src/pages/ApplyPage.tsx', 'utf8');

content = content.replace('// Step 1: Applicant Identity', 
  "// Step 1: Applicant Identity\n  hasCoApplicant: 'yes' | 'no'\n  coApplicantName: string\n  coApplicantEmail: string");

content = content.replace('// Step 2: Residency & Occupancy', 
  "// Step 2: Residency & Occupancy\n  hasVehicles: 'yes' | 'no'\n  vehicleDetails: string");

content = content.replace('// Step 4: References & Emergency', 
  "// Step 4: References & Emergency\n  documents: File[]");

content = content.replace("firstName: '',", 
  "hasCoApplicant: 'no',\n    coApplicantName: '',\n    coApplicantEmail: '',\n    firstName: '',");

content = content.replace("currentAddress: '',", 
  "hasVehicles: 'no',\n    vehicleDetails: '',\n    documents: [],\n    currentAddress: '',");

const submitStart = content.indexOf('const payload = {');
const submitEnd = content.indexOf('localStorage.setItem(\\'cp_last_application_id\\', generatedId)');

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
        const encodeFile = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        if (form.documents && form.documents.length > 0) {
          const encoded = await Promise.all(form.documents.map(encodeFile))
          encoded.forEach((b64, i) => {
            formData.append(\`_docFile_\${i}_name\`, form.documents[i].name)
            formData.append(\`_docFile_\${i}_type\`, form.documents[i].type || 'application/octet-stream')
            formData.append(\`_docFile_\${i}_data\`, b64)
          })
        }

        const res = await fetch((window.CONFIG?.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co') + '/functions/v1/receive-application', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        })
        if (!res.ok) throw new Error('Submission failed')
`;
  content = content.substring(0, submitStart) + newSubmit + content.substring(submitEnd + "localStorage.setItem('cp_last_application_id', generatedId)".length);
}

fs.writeFileSync('/app/applet/frontend/src/pages/ApplyPage.tsx', content);
