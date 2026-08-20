import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Layers, 
  Zap, 
  Smartphone, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Image as ImageIcon,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  property_count?: number;
  color?: string;
  icon?: string;
  description?: string;
}

const EDGE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
const IMPORT_SECRET = 'cp_import_7Kx3m9P2w5';

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];
  const icons = ['📁', '🏠', '⭐', '💼', '🔑', '🎯', '💎', '🏢'];

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=list_folders&secret=${IMPORT_SECRET}`);
      const data = await res.json();
      if (data && (data.ok || Array.isArray(data.folders))) {
        setFolders(data.folders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(`${EDGE_URL}?action=create_folder&secret=${IMPORT_SECRET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          folder_name: newFolderName.trim(),
          color: newFolderColor,
          icon: newFolderIcon,
          description: null
        })
      });
      const data = await res.json();
      if (data && (data.ok || data.id || data.name)) {
        setStatusMsg({ type: 'success', text: `Created folder "${newFolderName.trim()}" successfully` });
        setNewFolderName('');
        fetchFolders();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to create folder' });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Network error creating folder' });
    }
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const orionSnippet = `javascript:(function(){var s=document.createElement('script');s.src='https://choice-properties-site.pages.dev/live-content.js?v='+Date.now();document.head.appendChild(s);})();`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(orionSnippet);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Choice Properties
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Orion v5.0
                </span>
              </h1>
              <p className="text-xs text-slate-400">High-Speed Mobile Ingestion & Pipeline Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://choice-properties-site.pages.dev/admin/pipeline.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors"
            >
              <span>Admin Pipeline</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 shadow-xl">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">In-Memory Batch Extraction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extracts listings directly from Next.js memory cache in under 60ms. Multi-select batch mode lets you ingest full pages in 1 tap.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 shadow-xl">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Mobile Bottom Sheet & Folders</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Native iOS/Android bottom sheet drawer for creating folders with custom colors, icons, and instant serial # tagging.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 shadow-xl">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Max-Res Photo Pipeline</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automatic upscaling to 1536×1152 high-resolution uncropped assets with background ImageKit CDN synchronization.
            </p>
          </div>
        </div>

        {/* Section: Live Folders & Creation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Folder Manager */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Pipeline Target Folders</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                  {folders.length} active
                </span>
              </div>
              <button
                onClick={fetchFolders}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Refresh folders"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {statusMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* Folder List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {folders.map((f) => (
                <div
                  key={f.id || f.name}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">{f.icon || '📁'}</span>
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-200 truncate">{f.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {f.property_count || 0} properties
                      </div>
                    </div>
                  </div>
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: f.color || '#6366f1' }} 
                  />
                </div>
              ))}
              {folders.length === 0 && !loading && (
                <div className="col-span-2 py-8 text-center text-xs text-slate-500">
                  No custom folders yet. Create one below or in the Orion browser bottom sheet!
                </div>
              )}
            </div>

            {/* Inline Quick Folder Creator */}
            <form onSubmit={handleCreateFolder} className="pt-4 border-t border-slate-800/80 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Create New Folder
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Folder name (e.g. Austin Downtown 3BR)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/30"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>
              </div>

              {/* Color & Icon Picker */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 mr-1">Color:</span>
                  {colors.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${newFolderColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400 mr-1">Icon:</span>
                  {icons.map((ic) => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => setNewFolderIcon(ic)}
                      className={`px-1.5 py-0.5 rounded text-xs transition-colors ${newFolderIcon === ic ? 'bg-indigo-600/40 border border-indigo-500 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Right Col: Orion Installation & Live Script */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Orion Mobile Setup</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Run Choice Properties v5.0 on Orion (iOS/macOS). Injects the floating dock, batch mode, and folder creator across Zillow, Realtor, and Redfin.
              </p>

              <div className="space-y-2">
                <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/30 space-y-1.5">
                  <div className="text-[11px] font-bold text-indigo-300 flex items-center justify-between">
                    <span>Option 1: Orion Userscript (Auto-Runs Everywhere)</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] text-indigo-300">Recommended</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    In Orion, open: <a href="https://choice-properties-site.pages.dev/choice-importer.user.js" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-mono break-all">https://choice-properties-site.pages.dev/choice-importer.user.js</a> and tap <strong>Install</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-300">
                    Option 2: 1-Tap Bookmarklet (Run On Any Page)
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 overflow-x-auto select-all bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    javascript:(function()&#123;var s=document.createElement('script');s.src='https://choice-properties-site.pages.dev/live-content.js?v='+Date.now();document.head.appendChild(s);&#125;)();
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={copyToClipboard}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-xs font-bold text-white flex items-center justify-center gap-2 border border-indigo-500 transition-all shadow-lg shadow-indigo-600/30"
              >
                {copiedScript ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Copied Bookmarklet Code!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy 1-Tap Bookmarklet Code</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Zero-auth Edge Ingestion with Instant Haptics</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Status Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/40 border border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Edge Endpoint active at <code className="text-indigo-300 font-mono">tlfmwetmhthpyrytrcfo.supabase.co</code> with PostgreSQL RPC folder auto-increment.
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
            System Operational
          </span>
        </div>
      </main>
    </div>
  );
}
