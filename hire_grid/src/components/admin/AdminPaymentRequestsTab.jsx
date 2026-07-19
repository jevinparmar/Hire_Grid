import React, { useState, useEffect } from "react";
import { OperationType, collection, db, deleteDoc, doc, handleFirestoreError, onSnapshot, orderBy, query, updateDoc } from "../../firebase";

import { Check, X, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { logAudit } from "../../auditLogger";

export function AdminPaymentRequestsTab({ userName = "Admin" }) {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [deleteRequestId, setDeleteRequestId] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "payment_requests"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setRequests(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, "payment_requests"),
    );
    return () => unsub();
  }, []);

  const handleAction = async (req, action) => {
    try {
      await updateDoc(doc(db, "payment_requests", req.id), { status: action });

      if (action === "approved") {
        const userRef = doc(db, "users", req.userId);

        let updateData = {};

        let expiry = null;
        if (req.duration !== null) {
          expiry = Date.now() + req.duration * 30 * 24 * 60 * 60 * 1000;
        }

        if (req.itemType === "full_premium") {
          updateData["fullPremiumExpiry"] = expiry;
          updateData["hasFullPremium"] = true; // Legacy support
        } else if (req.itemType === "company") {
          updateData[`grantedCompanyAccess.${req.itemId}`] = expiry;
        } else if (req.itemType === "subject") {
          updateData[`grantedSubjectAccess.${req.itemId}`] = expiry;
        } else if (req.itemType === "topic") {
          updateData[`grantedTopicAccess.${req.itemId}`] = expiry;
        } else if (req.itemType === "exam") {
          updateData[`grantedExamAccess.${req.itemId}`] = expiry;
        } else if (req.itemType === "module") {
          updateData[`grantedModuleAccess.${req.itemId}`] = expiry;
        }

        if (Object.keys(updateData).length > 0) {
          await updateDoc(userRef, updateData);
        }
      }

      await logAudit(
        userName,
        `${action === "approved" ? "Approved" : "Rejected"} payment request for ${req.itemName} from ${req.userEmail}`,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "payment_requests");
    }
  };

  const confirmDelete = async () => {
    if (!deleteRequestId) return;
    try {
      await deleteDoc(doc(db, "payment_requests", deleteRequestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "payment_requests");
    } finally {
      setDeleteRequestId(null);
    }
  };

  const filtered =
    statusFilter === "all"
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  const metrics = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-slate-500 mb-1">
            Total Requests
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.total}
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-amber-600 dark:text-amber-500 mb-1">
            Pending
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
            {metrics.pending}
          </div>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-500 mb-1">
            Approved
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {metrics.approved}
          </div>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/50 p-4 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-rose-600 dark:text-rose-500 mb-1">
            Rejected
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
            {metrics.rejected}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Payment Requests
          </h2>
          <p className="text-sm text-slate-500">
            Review student purchase requests and grant premium access.
          </p>
        </div>
        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${statusFilter === s ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl glass-panel shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Request Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((req) => (
              <tr
                key={req.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {new Date(req.createdAt).toLocaleDateString()}
                  <div className="text-xs text-slate-400">
                    {new Date(req.createdAt).toLocaleTimeString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                  {req.userName}
                  <div className="text-xs text-slate-500 font-normal">
                    {req.userEmail}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{req.itemName}</span>
                  <div className="text-xs mt-1">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 uppercase">
                      {(req.itemType || "full_premium").replace("_", " ")}
                    </span>
                    <span className="ml-2 text-slate-400">
                      Duration:{" "}
                      {req.duration ? `${req.duration} Months` : "Permanent"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600 dark:text-slate-400">
                  {req.transactionId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {req.status === "pending" ? (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleAction(req, "approved")}
                        className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-lg transition-colors"
                        title="Approve & Grant Access"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleAction(req, "rejected")}
                        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 rounded-lg transition-colors"
                        title="Reject Request"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${req.status === "approved" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"}`}
                      >
                        {req.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setDeleteRequestId(req.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-slate-500"
                >
                  No {statusFilter !== "all" ? statusFilter : ""} payment
                  requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={deleteRequestId !== null}
        title="Delete Request Record"
        message="Are you sure you want to delete this request record forever?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRequestId(null)}
      />
    </div>
  );
}
