import React from 'react';
import { Clock, Send, Zap, ShieldAlert, Cpu } from 'lucide-react';

export default function StatsBar({ stats }) {
  const db = stats?.database || { scheduled: 0, sent: 0, total: 0, failed: 0 };
  const queue = stats?.queue || { delayed: 0, active: 0, waiting: 0 };
  const config = stats?.config || { concurrency: 5, minDelayBetweenEmailsMs: 2000, defaultHourlyLimitPerSender: 200 };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Scheduled Emails */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Scheduled Queue</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{db.scheduled}</span>
            <span className="text-xs text-amber-600 font-medium">({queue.delayed} delayed in BullMQ)</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Persisted in DB & Redis</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      {/* Sent Emails */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dispatched Emails</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{db.sent}</span>
            <span className="text-xs text-emerald-600 font-medium">100% delivered</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Via Ethereal SMTP with preview</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
          <Send className="w-6 h-6" />
        </div>
      </div>

      {/* Worker Concurrency & Provider Delay */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Worker Concurrency</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{config.concurrency}</span>
            <span className="text-xs text-indigo-600 font-medium">threads</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Provider throttle: {config.minDelayBetweenEmailsMs / 1000}s/send</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
          <Cpu className="w-6 h-6" />
        </div>
      </div>

      {/* Hourly Sender Quota */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hourly Limit / Sender</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{config.defaultHourlyLimitPerSender}</span>
            <span className="text-xs text-slate-500 font-medium">emails / hr</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Over-quota: auto-reschedules + Slack</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
          <ShieldAlert className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
