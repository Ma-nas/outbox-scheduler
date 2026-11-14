import React, { useState } from 'react';
import { X, Zap, ShieldAlert, Cpu, CheckCircle2, Clock } from 'lucide-react';
import { emailAPI } from '../services/api';

export default function LoadTestModal({ isOpen, onClose, onSuccess }) {
  const [count, setCount] = useState(6);
  const [hourlyLimit, setHourlyLimit] = useState(3);
  const [sender, setSender] = useState('loadtest-agent@reachinbox.ai');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleRunLoadTest = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const data = await emailAPI.testLoad({
        count: Number(count),
        hourlyLimit: Number(hourlyLimit),
        sender,
      });
      setResult(data);
      onSuccess(`Enqueued burst of ${count} emails! Watch the Scheduled table and Worker logs.`);
    } catch (err) {
      alert('Load test failed: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Rate Limiting & Concurrency Demo</h2>
              <p className="text-xs text-slate-500">Evaluator tool for verifying behavior under load</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200 text-purple-950 space-y-1.5">
            <p className="font-bold text-xs flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              <span>How this demonstrates Assignment Requirements:</span>
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
              <li><strong>Concurrency:</strong> BullMQ worker picks up jobs in parallel up to configured threads.</li>
              <li><strong>Provider Throttle:</strong> Applies minimum 2-second delay between individual sends.</li>
              <li><strong>Hourly Quota Throttling:</strong> Once the hourly limit ({hourlyLimit}) is hit for sender, remaining emails are <strong>rescheduled to the next hour</strong> rather than dropped.</li>
              <li><strong>Slack Alert:</strong> Live alert is dispatched when the limit is reached.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Burst Emails Count</label>
              <input
                type="number"
                min="2"
                max="50"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[11px] text-slate-400">Total emails scheduled at once</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hourly Limit for Sender</label>
              <input
                type="number"
                min="1"
                max="50"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[11px] text-slate-400">Low threshold triggers rate limit</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sender Email</label>
            <input
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {result && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-1">
              <p className="font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Burst enqueued successfully!</span>
              </p>
              <p className="text-[11px] text-emerald-800">
                Enqueued {result.count} emails. Check the Scheduled Outbox table and backend logs to observe throttling and rescheduling.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRunLoadTest}
              disabled={isRunning}
              className="px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-100 disabled:opacity-50 flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>{isRunning ? 'Firing Burst...' : `Burst ${count} Emails (Throttle Test)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
