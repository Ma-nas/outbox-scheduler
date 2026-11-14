import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Send, Link, Trash2 } from 'lucide-react';
import { slackAPI } from '../services/api';

function SlackIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export default function SlackModal({ isOpen, onClose, connected, onStatusChange }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#reachinbox-alerts');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    setIsLoading(true);
    setMessage('');
    try {
      const res = await slackAPI.connect(webhookUrl.trim(), channel.trim());
      setIsSuccess(true);
      setMessage(res.message || 'Connected to Slack successfully! Verification alert dispatched.');
      onStatusChange(true);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.response?.data?.error || err.message || 'Failed to connect Slack.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const res = await slackAPI.test(webhookUrl || undefined);
      setIsSuccess(true);
      setMessage(res.message || 'Test alert dispatched to Slack channel!');
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.response?.data?.error || err.message || 'Failed to send test alert.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await slackAPI.disconnect();
      setIsSuccess(true);
      setMessage('Slack disconnected.');
      setWebhookUrl('');
      onStatusChange(false);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <SlackIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Slack Alerts Integration</h2>
              <p className="text-xs text-slate-500">Live notifications when hourly sender limit is hit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-900">
            <p className="font-semibold text-xs mb-1">📢 Requirement Check: Live Slack Alerts</p>
            <p className="text-slate-600">
              When a sender account hits its hourly email limit, ReachInbox immediately delays remaining jobs and fires a rich Slack webhook alert.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                required
                placeholder="https://api.slack.com/webhook/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                From Slack App Directory &gt; Incoming Webhooks (or OAuth token).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Notification Channel
              </label>
              <input
                type="text"
                placeholder="#reachinbox-alerts"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 font-semibold rounded-xl border border-rose-200 flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              ) : (
                <span className="text-slate-400 italic">Status: Not connected</span>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={isLoading}
                  className="px-3 py-2 font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Alert</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !webhookUrl}
                  className="px-4 py-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center space-x-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Connecting...' : 'Connect Slack'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
