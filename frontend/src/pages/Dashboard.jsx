import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import StatsBar from '../components/StatsBar';
import ScheduledTable from '../components/ScheduledTable';
import SentTable from '../components/SentTable';
import ComposeModal from '../components/ComposeModal';
import SlackModal from '../components/SlackModal';
import LoadTestModal from '../components/LoadTestModal';
import { emailAPI, statsAPI, slackAPI } from '../services/api';
import { Plus, Zap, Clock, Send, CheckCircle2 } from 'lucide-react';

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('scheduled'); // 'scheduled' or 'sent'
  const [stats, setStats] = useState(null);
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scheduledSearch, setScheduledSearch] = useState('');
  const [sentSearch, setSentSearch] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isLoadTestOpen, setIsLoadTestOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const fetchStats = useCallback(async () => {
    try {
      const data = await statsAPI.get();
      setStats(data);
    } catch (e) {
      // Ignore poll error
    }
  }, []);

  const fetchSlackStatus = useCallback(async () => {
    try {
      const data = await slackAPI.getStatus();
      setSlackConnected(data.connected);
    } catch (e) {
      // Ignore
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    try {
      if (activeTab === 'scheduled') {
        let data;
        if (scheduledSearch.trim()) {
          data = await emailAPI.search(scheduledSearch.trim(), 'SCHEDULED');
          setScheduledEmails(data.results || []);
        } else {
          data = await emailAPI.list({ status: 'SCHEDULED', limit: 100 });
          setScheduledEmails(data.emails || []);
        }
      } else {
        let data;
        if (sentSearch.trim()) {
          data = await emailAPI.search(sentSearch.trim(), 'SENT');
          setSentEmails(data.results || []);
        } else {
          data = await emailAPI.list({ status: 'SENT', limit: 100 });
          setSentEmails(data.emails || []);
        }
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
    }
  }, [activeTab, scheduledSearch, sentSearch]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchEmails(), fetchSlackStatus()]).finally(() => {
      setLoading(false);
    });
  }, [fetchStats, fetchEmails, fetchSlackStatus]);

  // Auto-polling interval (every 3 seconds) for real-time queue visibility
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchEmails();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchEmails]);

  const handleCancelEmail = async (id) => {
    if (!window.confirm('Cancel this scheduled email dispatch?')) return;
    try {
      await emailAPI.cancel(id);
      showToast('Scheduled email cancelled successfully.');
      fetchEmails();
      fetchStats();
    } catch (err) {
      alert('Failed to cancel: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans">
      {/* Navbar */}
      <Navbar
        user={user}
        onLogout={onLogout}
        onOpenSlack={() => setIsSlackOpen(true)}
        slackConnected={slackConnected}
        queueActive={stats?.queue?.active || 0}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="mb-4 p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage('')} className="text-indigo-400 hover:text-indigo-700">
              &times;
            </button>
          </div>
        )}

        {/* Top Header & Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Email Outreach Dispatcher
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled cold email sequences powered by BullMQ, Redis, and Ethereal SMTP
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Load Test Demo Button */}
            <button
              onClick={() => setIsLoadTestOpen(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>Rate Limit Test</span>
            </button>

            {/* Primary Compose Button */}
            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Summary Stats Overview */}
        <StatsBar stats={stats} />

        {/* Tabs Bar */}
        <div className="flex items-center space-x-2 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex items-center space-x-2 pb-3 px-3 font-semibold text-xs border-b-2 transition-all ${
              activeTab === 'scheduled'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled Emails</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'scheduled' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {stats?.database?.scheduled ?? scheduledEmails.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center space-x-2 pb-3 px-3 font-semibold text-xs border-b-2 transition-all ${
              activeTab === 'sent'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Sent Emails</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'sent' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {stats?.database?.sent ?? sentEmails.length}
            </span>
          </button>
        </div>

        {/* Active Tab Table Content */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loading}
            searchQuery={scheduledSearch}
            onSearchChange={setScheduledSearch}
            onCancelEmail={handleCancelEmail}
            onRefresh={fetchEmails}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            loading={loading}
            searchQuery={sentSearch}
            onSearchChange={setSentSearch}
            onRefresh={fetchEmails}
          />
        )}
      </main>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          fetchEmails();
          fetchStats();
        }}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        connected={slackConnected}
        onStatusChange={(status) => {
          setSlackConnected(status);
          fetchStats();
        }}
      />

      <LoadTestModal
        isOpen={isLoadTestOpen}
        onClose={() => setIsLoadTestOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          fetchEmails();
          fetchStats();
        }}
      />
    </div>
  );
}
