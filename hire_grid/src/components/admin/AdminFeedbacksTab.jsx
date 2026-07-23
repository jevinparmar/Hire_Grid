import React, { useState, useEffect } from "react";
import { OperationType, collection, db, deleteDoc, doc, handleFirestoreError, onSnapshot, query } from "../../firebase";
import { Trash2, MessageSquare, AlertCircle, Sparkles, AlertTriangle } from "lucide-react";

export function AdminFeedbacksTab({ isContentManager = false }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "feedbacks")),
      (snapshot) => {
        setFeedbacks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "feedbacks"),
    );

    return () => unsub();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this feedback?")) {
      try {
        await deleteDoc(doc(db, "feedbacks", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, "feedbacks");
      }
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case "bug":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/50";
      case "improvement":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50";
      case "feature":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700/50";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "bug":
        return <AlertCircle className="w-4 h-4 mr-1 inline" />;
      case "improvement":
        return <AlertTriangle className="w-4 h-4 mr-1 inline" />;
      case "feature":
        return <Sparkles className="w-4 h-4 mr-1 inline" />;
      default:
        return <MessageSquare className="w-4 h-4 mr-1 inline" />;
    }
  };

  const filtered = feedbacks
    .filter((f) => {
      if (filterType === "all") return true;
      return f.feedbackType === filterType;
    })
    .filter((f) => {
      const matchText = (f.message || "").toLowerCase() + (f.userName || "").toLowerCase() + (f.userEmail || "").toLowerCase();
      return matchText.includes(searchTerm.toLowerCase());
    });

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Student Feedbacks
          </h2>
          <p className="text-sm text-slate-500">
            Review suggestions, reported bugs, and thoughts sent by students.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search feedbacks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">All Types</option>
            <option value="general">General</option>
            <option value="bug">Bugs</option>
            <option value="improvement">Improvements</option>
            <option value="feature">Features</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((fb) => (
          <div
            key={fb.id}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getBadgeStyle(fb.feedbackType)}`}>
                  {getTypeIcon(fb.feedbackType)}
                  <span className="capitalize">{fb.feedbackType || "General"}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : ""}
                </span>
              </div>

              <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap mb-4">
                {fb.message}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {fb.userName || "Anonymous Student"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {fb.userEmail || "No Email"}
                </p>
              </div>

              {!isContentManager && (
                <button
                  onClick={() => handleDelete(fb.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                  title="Delete Feedback"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            No feedbacks matching the filters found.
          </div>
        )}
      </div>
    </div>
  );
}
