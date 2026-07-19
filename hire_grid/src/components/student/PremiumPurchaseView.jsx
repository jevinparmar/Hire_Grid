import React, { useState, useEffect } from "react";
import { OperationType, db, doc, getDoc, handleFirestoreError, setDoc } from "../../firebase";

import {
  ShieldAlert,
  ArrowLeft,
  Send,
  IndianRupee,
  MessageCircle,
  Building2,
  Smartphone,
} from "lucide-react";
import { motion } from "motion/react";

export function PremiumPurchaseView({
  itemId,
  itemName,
  itemType,
  price,
  durationMonths,
  onBack,
  currentUser,
}) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const [transactionId, setTransactionId] = useState("");
  const [requestName, setRequestName] = useState(currentUser?.name || "");
  const [requestEmail, setRequestEmail] = useState(currentUser?.email || "");
  const [duration, setDuration] = useState("permanent");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (currentUser) {
      if (!requestName) setRequestName(currentUser.name || "");
      if (!requestEmail) setRequestEmail(currentUser.email || "");
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "payment");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.id) return;

    setSubmitting(true);
    setStatus("idle");

    try {
      const id = crypto.randomUUID();
      const numDuration =
        itemType === "plan"
          ? durationMonths || 1
          : (durationMonths ?? (itemType === "full_premium" ? 1 : null));

      await setDoc(doc(db, "payment_requests", id), {
        id,
        userId: currentUser.id,
        userName: requestName || "Student",
        userEmail: requestEmail,
        transactionId,
        itemName,
        itemId,
        itemType,
        amount: price || 0,
        status: "pending",
        duration: numDuration,
        createdAt: Date.now(),
      });

      setStatus("success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "payment_requests");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-emerald-500 animate-spin"></div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto text-center py-12"
      >
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <Send className="w-10 h-10 text-emerald-600 dark:text-emerald-400 ml-1" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">
          Request Submitted
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          Your payment request for{" "}
          <strong className="text-slate-900 dark:text-white">{itemName}</strong>{" "}
          has been received. Our team will verify your transaction and grant
          access shortly.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center px-6 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <button
        onClick={onBack}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 rounded-lg transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-4">
          Unlock Premium Access
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Get complete access to{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {itemName}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment Instructions Side */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-indigo-500/5 rounded-3xl -mx-4 -my-4 sm:mx-0 sm:my-0 lg:-mx-8 lg:-my-8 -z-10 blur-2xl"></div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm h-full">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
              <ShieldAlert className="w-6 h-6 mr-2 text-emerald-500" />
              Payment Instructions
            </h3>

            <div className="mb-8">
              <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                ₹{price}
              </div>
              <p className="text-sm text-slate-500 uppercase tracking-widest font-mono">
                One-time payment
              </p>
            </div>

            {settings ? (
              <div className="space-y-6">
                <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  {settings.instructions}
                </div>

                <div className="space-y-4">
                  {settings.upiId && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mr-4">
                        <IndianRupee className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                          UPI ID
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {settings.upiId}
                        </p>
                      </div>
                    </div>
                  )}

                  {settings.contactNumber && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mr-4">
                        <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                          Contact Number
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {settings.contactNumber}
                        </p>
                      </div>
                    </div>
                  )}

                  {settings.whatsappNumber && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0 mr-4">
                        <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                          WhatsApp
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {settings.whatsappNumber}
                        </p>
                      </div>
                    </div>
                  )}

                  {settings.bankDetails && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mr-4">
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                          Bank Details
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                          {settings.bankDetails}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Payment details not configured. Please contact the
                administrator.
              </p>
            )}
          </div>
        </div>

        {/* Form Side */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Submit Request
              </h3>
              <p className="text-sm text-slate-500">
                Enter your transaction details after completing the payment.
              </p>
            </div>

            <div className="mb-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                />
              </div>
            </div>

            {itemType === "full_premium" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Target Duration
                </label>
                <input
                  type="text"
                  disabled
                  value="1 Month Access (Fixed)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
            ) : itemType === "plan" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Target Duration
                </label>
                <input
                  type="text"
                  disabled
                  value={`${durationMonths || 1} Month${(durationMonths || 1) > 1 ? "s" : ""} Access`}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Target Duration
                </label>
                <input
                  type="text"
                  disabled
                  value="Permanent Lifetime Access"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed outline-none"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Transaction ID
              </label>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. UPI Ref No. or UTR"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-mono"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || !transactionId}
                className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
              >
                {submitting ? (
                  <div className="w-5 h-5 rounded-full border-t-2 border-white animate-spin"></div>
                ) : (
                  <>
                    <span>Submit Payment Request</span>
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
              {status === "error" && (
                <p className="mt-3 text-sm text-red-500 text-center">
                  There was an error submitting your request. Please try again.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
