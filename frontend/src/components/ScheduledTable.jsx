import React from 'react';
import { Clock, Trash2, Search, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export default function ScheduledTable({
  emails,
  loading,
  searchQuery,
  onSearchChange,
  onCancelEmail,
  onRefresh,
}) {
  const formatScheduledTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);

    let relative = '';
    if (diffSec <= 0) {
      relative = 'Due now';
    } else if (diffSec < 60) {
      relative = `in ${diffSec}s`;
    } else if (diffSec < 3600) {
      relative = `in ${Math.round(diffSec / 60)}m`;
    } else {
      relative = `in ${Math.round(diffSec / 3600)}h`;
    }

    return {
      formatted: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString(),
      relative,
      isImminent: diffSec > 0 && diffSec < 120,
    };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Search & Header toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800 text-sm">Scheduled Outbox</span>
          <span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            {emails.length} queued
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
              <th className="py-3 px-4">Scheduled Time</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                    <p className="text-sm font-medium text-slate-600">Loading scheduled emails...</p>
                  </div>
                </td>
              </tr>
            ) : emails.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Layers className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No scheduled emails in queue</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Click the "Compose New Email" button to upload leads and schedule your first outreach batch.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              emails.map((email) => {
                const timeInfo = formatScheduledTime(email.scheduledAt);
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
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div>{timeInfo.formatted}</div>
                      <div className={`text-[11px] font-semibold ${timeInfo.isImminent ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`}>
                        {timeInfo.relative}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                        <span>SCHEDULED</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onCancelEmail(email.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Cancel scheduled email"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
