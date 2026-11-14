import React from 'react';
import { Mail, Bell, LogOut, ExternalLink, Activity } from 'lucide-react';

function SlackIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export default function Navbar({ user, onLogout, onOpenSlack, slackConnected, queueActive }) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-100 text-white font-bold text-xl">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">ReachInbox</span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Outbox Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400">Production-grade BullMQ + Redis email dispatch</p>
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Live BullMQ Queue Monitor Link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-xs"
            title="Open Live BullMQ Queue Monitor Dashboard"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>BullMQ Live</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Slack Integration Button */}
          <button
            onClick={onOpenSlack}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              slackConnected
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
            }`}
          >
            <SlackIcon className={`w-3.5 h-3.5 ${slackConnected ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>{slackConnected ? 'Slack Alert Live' : 'Connect Slack'}</span>
          </button>

          {/* User Profile */}
          {user && (
            <div className="flex items-center pl-3 border-l border-slate-200 space-x-3">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-200 object-cover shadow-xs"
              />
              <div className="hidden md:block text-left text-xs">
                <div className="font-semibold text-slate-800 leading-tight">{user.name}</div>
                <div className="text-slate-400 truncate max-w-[140px]">{user.email}</div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
