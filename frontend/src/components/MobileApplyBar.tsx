import { Link } from 'react-router-dom'

interface MobileApplyBarProps {
  rent: number
  applyUrl: string
  onMessageClick: () => void
}

export function MobileApplyBar({ rent, applyUrl, onMessageClick }: MobileApplyBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Monthly Rent</span>
          <strong className="text-lg font-extrabold text-slate-900">${rent.toLocaleString()}</strong>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onMessageClick}
            aria-label="Message landlord"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </button>
          <Link
            to={applyUrl}
            className="flex h-11 items-center justify-center rounded-xl bg-[#006AFF] px-6 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#0058D6]"
          >
            Apply Now
          </Link>
        </div>
      </div>
    </div>
  )
}
