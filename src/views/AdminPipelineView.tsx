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

export const AdminPipelineView: React.FC = () => {
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            <span>Choice Properties Orion v5.0</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Pipeline Hub & Folder Organizer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            High-speed mobile ingestion, Next.js cache extraction, and automatic ImageKit CDN upscaling.
          </p>
        </div>

        <a
          href="https://choice-properties-site.pages.dev/admin/pipeline.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 transition-colors"
        >
          <span>Open Legacy Admin</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      </div>

      {/* Hero Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">In-Memory Extraction</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Extracts listings directly from Next.js memory cache in under 60ms. Multi-select batch mode lets you ingest full pages in 1 tap.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Mobile Bottom Sheet & Folders</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Native iOS/Android bottom sheet drawer for creating folders with custom colors, icons, and instant serial # tagging.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Max-Res Photo Pipeline</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Automatic upscaling to 1536×1152 high-resolution uncropped assets with background ImageKit CDN synchronization.
          </p>
        </div>
      </div>

      {/* Folder Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Pipeline Target Folders</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                {folders.length} active
              </span>
            </div>
            <button
              onClick={fetchFolders}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh folders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Folder List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {folders.map((f) => (
              <div
                key={f.id || f.name}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg">{f.icon || '📁'}</span>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{f.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {f.property_count || 0} properties
                    </div>
                  </div>
                </div>
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: f.color || '#3b82f6' }} 
                />
              </div>
            ))}
          </div>

          {/* Create Folder Form */}
          <form onSubmit={handleCreateFolder} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Create New Folder
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Folder name (e.g. Columbus East 3BR)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Create</span>
              </button>
            </div>

            {/* Colors and Icons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1">Color:</span>
                {colors.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${newFolderColor === c ? 'scale-125 ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
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
                    className={`px-1.5 py-0.5 rounded text-xs transition-colors ${newFolderIcon === ic ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Mobile Setup Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Orion Mobile Setup</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Install the Choice Properties bookmarklet or userscript into your Orion mobile browser to ingest listings instantly.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">1-Tap Bookmarklet Code</div>
              <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto select-all p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                {orionSnippet}
              </div>
            </div>
          </div>

          <button
            onClick={copyToClipboard}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all"
          >
            {copiedScript ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Copied Bookmarklet Code!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Bookmarklet Code</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
