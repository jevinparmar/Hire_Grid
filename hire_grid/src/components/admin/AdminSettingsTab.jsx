import React, { useState, useEffect } from "react";
import { OperationType, db, doc, getDoc, handleFirestoreError, setDoc } from "../../firebase";

import { Save } from "lucide-react";

export function AdminSettingsTab() {
  const [settings, setSettings] = useState({
    contactNumber: "",
    whatsappNumber: "",
    upiId: "",
    bankDetails: "",
    instructions:
      "Step 1: Send payment using the provided payment details.\nStep 2: Submit transaction details.\nStep 3: Wait for admin approval.",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "payment");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "settings");
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await setDoc(doc(db, "settings", "payment"), settings);
      setMessage("Settings saved successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "settings");
      setMessage(`Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
          Contact & Payment Settings
        </h2>
        <p className="text-sm text-slate-500">
          Manage all contact information displayed to students for premium
          purchases.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
      >
        {message && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-500/50 text-sm text-emerald-600 dark:text-emerald-400">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Contact Number
            </label>
            <input
              type="text"
              value={settings.contactNumber}
              onChange={(e) =>
                setSettings({ ...settings, contactNumber: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="+91 9876543210"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              WhatsApp Number
            </label>
            <input
              type="text"
              value={settings.whatsappNumber}
              onChange={(e) =>
                setSettings({ ...settings, whatsappNumber: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="+91 9876543210"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              UPI ID
            </label>
            <input
              type="text"
              value={settings.upiId}
              onChange={(e) =>
                setSettings({ ...settings, upiId: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="example@upi"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Bank Account Details
            </label>
            <textarea
              rows={3}
              value={settings.bankDetails}
              onChange={(e) =>
                setSettings({ ...settings, bankDetails: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="Bank Name:&#10;Account No:&#10;IFSC:"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Leaderboard Mode
            </label>
            <select
              value={settings.leaderboardMode || "first_attempt"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  leaderboardMode: e.target.value,
                })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="first_attempt">
                First Attempt Only (Default)
              </option>
              <option value="best_attempt">Best Attempt</option>
            </select>
            <p className="text-xs text-slate-500">
              Determines whether the first attempt or the highest score affects
              the leaderboards and XP.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Payment Instructions
            </label>
            <textarea
              rows={4}
              value={settings.instructions}
              onChange={(e) =>
                setSettings({ ...settings, instructions: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 px-6 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving..." : "Save Settings"}</span>
        </button>
      </form>
    </div>
  );
}
