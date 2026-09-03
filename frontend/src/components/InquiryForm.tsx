import { useState } from 'react'

interface InquiryFormProps {
  propertyId: string
}

export function InquiryForm({ propertyId }: InquiryFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please fill in name, email, and message.')
      setStatus('error')
      return
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.')
      setStatus('error')
      return
    }

    setStatus('loading')
    
    try {
      // Throttle check
      const THROTTLE_KEY = 'cp_inquiry_last'
      const last = parseInt(localStorage.getItem(THROTTLE_KEY) || '0', 10)
      if (Date.now() - last < 60000) {
        throw new Error('Please wait a moment before sending another inquiry.')
      }

      const supabaseUrl = window.CONFIG?.SUPABASE_URL?.replace(/\/$/, '')
      const anonKey = window.CONFIG?.SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !anonKey) {
        throw new Error('System unavailable. Please email us directly.')
      }
      
      const payload = {
        type: 'new_inquiry',
        property_id: propertyId,
        tenant_name: name.trim(),
        tenant_email: email.trim(),
        tenant_phone: phone.trim() || null,
        tenant_language: 'en',
        message: message.trim()
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/send-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Failed to send inquiry. Please try again.')
      }

      localStorage.setItem(THROTTLE_KEY, Date.now().toString())
      setStatus('success')
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
      
      setTimeout(() => {
        setStatus('idle')
      }, 5000)
      
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send inquiry.')
      setStatus('error')
    }
  }

  return (
    <div className="border-t border-slate-800 pt-5 space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-300">Message Landlord</h4>
      {status === 'success' ? (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-400 text-sm text-center">
          ✓ Message sent! The landlord will be in touch soon.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {status === 'error' && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}
          <input
            type="text"
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            required
          />
          <input
            type="email"
            placeholder="Email Address *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            required
          />
          <input
            type="tel"
            placeholder="Phone Number (Optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <textarea
            placeholder="I'm interested in this property and have a few questions..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={status === 'loading'}
            rows={3}
            maxLength={1500}
            className="w-full rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            required
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  )
}
