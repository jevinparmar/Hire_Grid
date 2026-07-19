import React, { useState, useEffect } from "react";

import { collection, db, doc, getDocs, orderBy, query, setDoc } from "../../firebase";
import { Check, X } from "lucide-react";

export function AdminAccessRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "access_requests"), orderBy("createdAt", "desc")),
      );
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (request, status) => {
    try {
      await setDoc(
        doc(db, "access_requests", request.id),
        { ...request, status },
        { merge: true },
      );
      if (status === "approved") {
        // Grant access to the user
        const fieldName = `granted${request.itemType.charAt(0).toUpperCase() + request.itemType.slice(1)}Access`;
        await setDoc(
          doc(db, "users", request.userId),
          {
            [fieldName]: {
              [request.itemId]: null, // null means permanent access
            },
          },
          { merge: true },
        );
      }
      fetchRequests();
    } catch (err) {
      console.error("Access Request Process Failed", err.code, err.message);
      alert(
        "Unable to process request: Permission denied. Please contact administrator.",
      );
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Access Requests
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
                Requested access to {req.itemType}:{" "}
                <span className="font-semibold">{req.itemName}</span>
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
