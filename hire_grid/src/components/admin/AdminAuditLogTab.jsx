import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { showToast } from "../common/Toast";
import { ShieldAlert, RefreshCw } from "lucide-react";

export function AdminAuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get("/security-logs");
      if (res.success) {
        setLogs(res.logs || []);
      } else {
        showToast(res.error || "Failed to load security logs.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error connecting to security logs API.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getEventBadge = (type) => {
    switch (type) {
      case "screenshot_attempt":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-350 dark:border-rose-800";
      case "print_attempt":
        return "bg-orange-100 text-orange-850 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-350 dark:border-orange-800";
      case "copy_attempt":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-350 dark:border-amber-800";
      case "tab_switch":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-350 dark:border-yellow-800";
      case "window_blur":
        return "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300 border border-slate-300 dark:border-slate-800";
      default:
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-350 dark:border-emerald-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2 text-rose-500" />
            Security & Anti-Cheating Logs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time security logs showing student screenshot, print, and copy/paste violations during exams.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-center"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-500" : ""}`} />
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl glass-panel shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Violation Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Details & Context
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {log.userName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {log.userEmail}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${getEventBadge(log.eventType)}`}>
                    {log.eventType.replace("_", " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                  {log.details}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400 font-semibold"
                >
                  No security incidents or anti-cheating violations logged.
                </td>
              </tr>
            )}
            {loading && logs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-sm text-slate-400 dark:text-slate-500 animate-pulse font-semibold"
                >
                  Retrieving security event log stream...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
