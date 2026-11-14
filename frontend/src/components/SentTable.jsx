import React from 'react';
import { Send, ExternalLink, Search, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function SentTable({
  emails,
  loading,
  searchQuery,
  onSearchChange,
  onRefresh,
}) {
  const formatTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Send className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800 text-sm">Dispatched Outbox</span>
          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            {emails.length} delivered
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search via Elasticsearch..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Recipient Lead</th>
              <th className="py-3 px-4">Sender Account</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Dispatched At</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                    <p className="text-sm font-medium text-slate-600">Loading sent emails...</p>
                  </div>
                </td>
              </tr>
            ) : emails.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Send className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No sent emails yet</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      When scheduled emails are processed by the BullMQ worker, their dispatch confirmations and Ethereal preview URLs will appear here.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              emails.map((email) => {
                const isSent = email.status === 'SENT';
                return (
                  <tr key={email.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {email.recipient}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {email.sender}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate font-medium">
                      {email.subject}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatTime(email.sentAt || email.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      {isSent ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>SENT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {email.previewUrl ? (
                        <a
                          href={email.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                        >
                          <span>Open Preview</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No preview URL</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
