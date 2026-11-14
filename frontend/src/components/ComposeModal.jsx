import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, Clock, Calendar, Users, AlertCircle, Sparkles } from 'lucide-react';
import { emailAPI } from '../services/api';

export default function ComposeModal({ isOpen, onClose, onSuccess }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('outbox-agent-1@reachinbox.ai');
  const [recipients, setRecipients] = useState([]);
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [startTimeMode, setStartTimeMode] = useState('now'); // 'now', 'preset2', 'custom'
  const [customStartTime, setCustomStartTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2); // seconds
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage('');
    try {
      const data = await emailAPI.uploadLeads(file);
      if (data.emails && data.emails.length > 0) {
        setRecipients((prev) => Array.from(new Set([...prev, ...data.emails])));
        setUploadMessage(`✅ Parsed ${data.count} valid lead email(s) from "${file.name}"`);
      } else {
        setUploadMessage('⚠️ No valid email addresses detected in this file.');
      }
    } catch (err) {
      setUploadMessage('❌ Failed to parse file: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualAddRecipients = () => {
    if (!rawTextRecipients.trim()) return;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = rawTextRecipients.match(emailRegex) || [];
    if (matches.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...matches.map((m) => m.toLowerCase())])));
      setRawTextRecipients('');
    }
  };

  const removeRecipient = (index) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (recipients.length === 0) {
      alert('Please add at least one recipient lead by uploading a file or entering an email address.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      alert('Please fill out Subject and Body.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalStartTime = new Date();
      if (startTimeMode === 'preset2') {
        finalStartTime = new Date(Date.now() + 2 * 60 * 1000); // +2 minutes
      } else if (startTimeMode === 'custom' && customStartTime) {
        finalStartTime = new Date(customStartTime);
      }

      await emailAPI.batch({
        recipients,
        sender,
        subject,
        body,
        startTime: finalStartTime.toISOString(),
        delayBetweenEmails: Number(delayBetweenEmails),
        hourlyLimit: Number(hourlyLimit),
      });

      onSuccess(`Successfully scheduled ${recipients.length} email(s) into BullMQ outbox!`);
      onClose();
    } catch (err) {
      alert('Failed to schedule emails: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Compose & Schedule Outreach</h2>
              <p className="text-xs text-slate-500">ReachInbox persistent BullMQ dispatch queue</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Sender Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Sender Account (Multi-Sender Support)
            </label>
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="outbox-agent-1@reachinbox.ai">outbox-agent-1@reachinbox.ai (Primary Outreach)</option>
              <option value="outbox-agent-2@reachinbox.ai">outbox-agent-2@reachinbox.ai (Inbound SDR)</option>
              <option value="partnerships@reachinbox.ai">partnerships@reachinbox.ai (Enterprise Deals)</option>
            </select>
          </div>

          {/* Lead List Upload & Detection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Recipients / Leads ({recipients.length} detected)
              </label>
              {recipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecipients([])}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* CSV / File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <Upload className="w-6 h-6 text-indigo-500 mb-1" />
                <span className="text-sm font-medium text-slate-700">
                  {isUploading ? 'Parsing leads...' : 'Click to upload CSV or text file of leads'}
                </span>
                <span className="text-xs text-slate-400 mt-0.5">Automatically extracts and deduplicates email addresses</span>
              </div>
            </div>

            {uploadMessage && (
              <p className="text-xs mt-2 text-slate-600 font-medium">{uploadMessage}</p>
            )}

            {/* Manual entry / quick paste */}
            <div className="mt-2.5 flex space-x-2">
              <input
                type="text"
                placeholder="Or paste email addresses (comma or space separated)..."
                value={rawTextRecipients}
                onChange={(e) => setRawTextRecipients(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualAddRecipients();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleManualAddRecipients}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Add
              </button>
            </div>

            {/* Recipients preview pills */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                {recipients.map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(idx)}
                      className="hover:text-rose-600 ml-1 text-slate-400"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Scaling outbound revenue with ReachInbox AI"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Body (HTML supported)
            </label>
            <textarea
              required
              rows={4}
              placeholder="Hi {{firstName}}, noticing your growth on LinkedIn and wanted to connect..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
            />
          </div>

          {/* Schedule Timing & Rate Limiting Controls */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Start Time (When scheduling begins)
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStartTimeMode('now')}
                  className={`px-3 py-1.5 rounded-lg border font-medium ${
                    startTimeMode === 'now'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Send Immediately
                </button>
                <button
                  type="button"
                  onClick={() => setStartTimeMode('preset2')}
                  className={`px-3 py-1.5 rounded-lg border font-medium ${
                    startTimeMode === 'preset2'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Schedule in +2 Mins
                </button>
                <button
                  type="button"
                  onClick={() => setStartTimeMode('custom')}
                  className={`px-3 py-1.5 rounded-lg border font-medium ${
                    startTimeMode === 'custom'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Custom Timestamp
                </button>
              </div>

              {startTimeMode === 'custom' && (
                <input
                  type="datetime-local"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="mt-2.5 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              )}
            </div>

            {/* Throttling & Hourly Limit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delay Between Sends (Provider Throttle)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={delayBetweenEmails}
                    onChange={(e) => setDelayBetweenEmails(e.target.value)}
                    className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-500">seconds (mimics provider throttling)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Hourly Limit / Sender
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(e.target.value)}
                    className="w-24 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-500">emails/hr quota</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || recipients.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md shadow-indigo-100 disabled:opacity-50 transition-all flex items-center space-x-2"
            >
              <Clock className="w-4 h-4" />
              <span>{isSubmitting ? 'Enqueuing into BullMQ...' : `Schedule ${recipients.length} Email(s)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
