import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Check, X } from "lucide-react";

export function AdminDeviceRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/device-requests");
      if (res.success && res.requests) {
        setRequests(res.requests);
      }
    } catch (err) {
      console.error("Fetch device requests error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (request, status) => {
    try {
      await api.put(`/device-requests/${request.id}`, { status });
      fetchRequests();
    } catch (err) {
      console.error("Device Request Process Failed", err);
      alert("Unable to process request: " + (err.message || "Failed"));
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Device Change Requests
        </h2>
      </div>

      <div className="grid gap-4">
        {requests.map((req) => (
          <div
            key={req.id}
            className="bg-white dark:bg-slate-900 p-4 rounded-xl border flex justify-between items-center border-slate-200 dark:border-slate-800"
          >
            <div>
              <p className="font-bold text-lg dark:text-white">
                {req.userName}{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({req.userEmail})
                </span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Requested device change.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(req.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {req.status === "pending" ? (
                <>
                  <button
                    onClick={() => handleAction(req, "approved")}
                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg flex items-center hover:bg-emerald-200"
                  >
                    <Check className="w-4 h-4 mr-1" /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(req, "rejected")}
                    className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg flex items-center hover:bg-rose-200"
                  >
                    <X className="w-4 h-4 mr-1" /> Reject
                  </button>
                </>
              ) : (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${req.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                >
                  {req.status}
                </span>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <p className="text-slate-500">No requests found.</p>
        )}
      </div>
    </div>
  );
}
