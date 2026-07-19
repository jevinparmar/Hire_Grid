import React, { useState, useEffect } from "react";
import { OperationType, collection, db, handleFirestoreError, limit, onSnapshot, orderBy, query } from "../../firebase";


export function AdminAuditLogTab() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "audit_logs"), orderBy("date", "desc"), limit(100)),
      (snapshot) => {
        setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "audit_logs"),
    );

    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
          Content Manager Activity
        </h2>
        <p className="text-sm text-slate-500">
          Audit logs of all content manager actions.
        </p>
      </div>

      <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl glass-panel shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {new Date(log.date).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                  {log.userName}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {log.action}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-8 text-center text-sm text-slate-500"
                >
                  No activity logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
