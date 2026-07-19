import React, { useState, useEffect } from "react";
import { OperationType, collection, db, deleteDoc, doc, handleFirestoreError, onSnapshot, orderBy, query, setDoc } from "../../firebase";

import { Send, CheckCircle2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";

export function AdminNotificationsTab() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      setNotifications(notifs);
    });
    return () => unsub();
  }, []);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!title || !message) {
      setError("Please provide a title and a message.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const newId = crypto.randomUUID();
      await setDoc(doc(db, "notifications", newId), {
        title,
        message,
        targetRole: "student",
        createdAt: Date.now(),
      });

      setSuccess("Notification sent successfully!");
      setTitle("");
      setMessage("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "notifications");
      setError("Failed to send notification: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, "notifications", deleteId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "notifications");
      setError("Failed to delete notification: " + err.message);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Broadcast Notification
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Send an instant notification to all active students.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 p-4 rounded-lg text-sm border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-lg text-sm flex items-center border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        <form onSubmit={handleSendNotification} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Notification Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500 outline-none transition-colors dark:text-white"
              placeholder="e.g. Server Maintenance, New Mock Test"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Message Content
            </label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-500 outline-none transition-colors dark:text-white resize-none"
              placeholder="Describe what's happening..."
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5 mr-2" />
            {loading ? "Sending..." : "Broadcast Notification"}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Sent Notifications
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage previously sent notifications.
          </p>
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No notifications sent yet.
            </p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="mb-4 sm:mb-0">
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {notif.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    {notif.message}
                  </p>
                  <span className="text-xs text-slate-400 mt-2 block">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => setDeleteId(notif.id)}
                  className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors flex-shrink-0"
                  title="Delete Notification"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Notification"
        message="Are you sure you want to delete this notification? It will be removed for all users."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
