import { useState } from 'react';
import { loadData, saveData } from '../store';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [data, setData] = useState(loadData);
  const [notifTime, setNotifTime] = useState(data.notificationTime);
  const [apiKey, setApiKey] = useState(data.apiKey);
  const [notifStatus, setNotifStatus] = useState<string>('');

  const handleSave = () => {
    const updated = { ...data, notificationTime: notifTime, apiKey };
    saveData(updated);
    setData(updated);
    onClose();
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotifStatus('Notifications not supported in this browser');
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      // Schedule notification using service worker
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        // Store notification time preference
        const updated = { ...data, notificationTime: notifTime };
        saveData(updated);
        setData(updated);
        setNotifStatus('Notifications enabled! You\'ll be reminded at ' + notifTime);

        // Show a test notification
        reg.showNotification('Brain Check 🧠', {
          body: 'Notifications are set up! You\'ll be reminded daily.',
          icon: '/brain-icon-192.png',
          badge: '/brain-icon-192.png',
        });
      }
    } else {
      setNotifStatus('Permission denied. Enable in browser settings.');
    }
  };

  const resetData = () => {
    if (confirm('Are you sure? This will delete ALL your data.')) {
      localStorage.removeItem('brain-check-data');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-[#faf7f2] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-[#2d2a26]">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#e8e4de] flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Notification Time */}
          <div>
            <label className="text-sm font-bold text-[#2d2a26] block mb-2">
              📱 Reminder Time
            </label>
            <input
              type="time"
              value={notifTime}
              onChange={(e) => setNotifTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#e8e4de] bg-white text-sm focus:outline-none focus:border-[#5ecc8b]"
            />
            <button
              onClick={enableNotifications}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#5ecc8b] text-white font-bold text-sm"
            >
              Enable Push Notifications
            </button>
            {notifStatus && (
              <p className="mt-2 text-xs text-[#8a8680]">{notifStatus}</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm font-bold text-[#2d2a26] block mb-2">
              🔑 Anthropic API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 rounded-xl border border-[#e8e4de] bg-white text-sm focus:outline-none focus:border-[#5ecc8b]"
            />
            <p className="mt-1 text-xs text-[#8a8680]">
              Stored locally only. Used for AI coaching messages.
            </p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-[#2d2a26] text-white font-bold text-sm"
          >
            Save Settings
          </button>

          {/* Reset */}
          <button
            onClick={resetData}
            className="w-full py-3 rounded-2xl border-2 border-[#e06060] text-[#e06060] font-bold text-sm"
          >
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}
