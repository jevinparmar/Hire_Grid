import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// Global toast state — allows showToast() to be called from anywhere
let globalAddToast = null;

/**
 * Show a toast notification from anywhere in the app.
 * @param {string} message - The message to display
 * @param {"success"|"error"|"warning"|"info"} type - Toast variant
 * @param {number} duration - Auto-dismiss time in ms (default 4000)
 */
export function showToast(message, type = "info", duration = 4000) {
  if (globalAddToast) {
    globalAddToast({ message, type, duration });
  } else {
    // Fallback if ToastContainer isn't mounted yet
    console.warn("[Toast] ToastContainer not mounted. Message:", message);
  }
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-950/80",
    border: "border-emerald-400 dark:border-emerald-600",
    icon: "text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-900 dark:text-emerald-100",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/80",
    border: "border-red-400 dark:border-red-600",
    icon: "text-red-600 dark:text-red-400",
    text: "text-red-900 dark:text-red-100",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/80",
    border: "border-amber-400 dark:border-amber-600",
    icon: "text-amber-600 dark:text-amber-400",
    text: "text-amber-900 dark:text-amber-100",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/80",
    border: "border-blue-400 dark:border-blue-600",
    icon: "text-blue-600 dark:text-blue-400",
    text: "text-blue-900 dark:text-blue-100",
  },
};

function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const colors = COLORS[toast.type] || COLORS.info;
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm max-w-sm w-full
        ${colors.bg} ${colors.border}
        transition-all duration-300 ease-out
        ${isExiting ? "opacity-0 translate-x-8 scale-95" : "opacity-100 translate-x-0 scale-100"}`}
      role="alert"
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${colors.icon}`} />
      <p className={`text-sm font-medium flex-1 ${colors.text}`}>{toast.message}</p>
      <button
        onClick={handleDismiss}
        className={`shrink-0 p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${colors.icon}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Mount this once at the app root (e.g. in App.jsx or main.jsx).
 * It renders toasts in the top-right corner.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type, duration }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]); // max 5 visible
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => {
      globalAddToast = null;
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
}
