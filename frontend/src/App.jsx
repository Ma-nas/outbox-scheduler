import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { authAPI } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('reachinbox_token');
    if (!token) {
      setLoading(false);
      return;
    }

    authAPI
      .getMe()
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('reachinbox_token');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-medium tracking-wide">Loading ReachInbox Outbox...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
