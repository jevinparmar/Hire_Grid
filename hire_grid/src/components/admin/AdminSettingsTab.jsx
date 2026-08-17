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
    paymentNumber: "",
    qrCode: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "payment");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings((prev) => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "settings");
      }
    };
    fetchSettings();
  }, []);

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please select an image smaller than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({ ...prev, qrCode: reader.result }));
    };
    reader.readAsDataURL(file);
  };

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
          Manage payment details and QR code displayed to students for premium purchases.
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
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Payment Mobile Number (PhonePe/GooglePay/Paytm)
            </label>
            <input
              type="text"
              value={settings.paymentNumber || ""}
              onChange={(e) =>
                setSettings({ ...settings, paymentNumber: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="e.g. 9664532860"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Payment QR Code Image
            </label>
            <div className="flex items-center space-x-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="block w-full text-sm text-slate-500 dark:text-slate-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-emerald-50 file:text-emerald-700
                    dark:file:bg-emerald-900/30 dark:file:text-emerald-400
                    hover:file:bg-emerald-100 dark:hover:file:bg-emerald-900/50"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Upload your payment QR code image (PNG, JPG, max 2MB).
                </p>
              </div>
              {settings.qrCode && (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-white flex items-center justify-center">
                  <img
                    src={settings.qrCode}
                    alt="Payment QR Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, qrCode: "" }))}
                    className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-full text-xs transition-colors font-bold leading-none flex items-center justify-center w-5 h-5"
                    title="Remove QR Code"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Bank Account Details (Optional)
            </label>
            <textarea
              rows={3}
              value={settings.bankDetails || ""}
              onChange={(e) =>
                setSettings({ ...settings, bankDetails: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              placeholder="Bank Name:&#10;Account No:&#10;IFSC:"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Payment Instructions
            </label>
            <textarea
              rows={4}
              value={settings.instructions || ""}
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
