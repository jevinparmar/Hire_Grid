import React, { useState, useEffect } from "react";
import { OperationType, collection, db, deleteDoc, doc, getDoc, getDocs, handleFirestoreError, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from "../../firebase";
import { api } from "../../lib/api";

import { Trash2, UserPlus, ShieldCheck, Pencil } from "lucide-react";
import { ConfirmDialog } from "../common/ConfirmDialog";

import { logAudit } from "../../auditLogger";

export function AdminUsersTab({ isSuperAdmin, adminName }) {
  const [adminUsers, setAdminUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    password: "",
    role: "content_manager",
  });
  const [error, setError] = useState("");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [deleteAdminId, setDeleteAdminId] = useState(null);

  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [deleteError, setDeleteError] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("permanent");

  // Edit admin state
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "content_manager" });
  const [editError, setEditError] = useState("");

  const fetchAdmins = async () => {
    try {
      const res = await api.get("/admin_users");
      if (res.success) {
        setAdminUsers(res.admin_users);
      }
    } catch (err) {
      console.error("Failed to load staff accounts:", err);
    }
  };

  useEffect(() => {
    fetchAdmins();

    const unsubStudents = onSnapshot(
      query(collection(db, "users")),
      (snapshot) => {
        setStudents(
          snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.role === "student"),
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "users"),
    );

    const unsubCompanies = onSnapshot(
      query(collection(db, "companies")),
      (snapshot) => {
        setCompanies(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "companies"),
    );

    return () => {
      unsubStudents();
      unsubCompanies();
    };
  }, []);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      setError("All fields are required.");
      return;
    }
    try {
      await api.post("/admin_users", newAdmin);
      setIsCreatingAdmin(false);
      setNewAdmin({
        name: "",
        email: "",
        password: "",
        role: "content_manager",
      });
      setError("");
      fetchAdmins();
    } catch (err) {
      setError(err.message || "Failed to create account.");
    }
  };

  const openEditAdmin = (user) => {
    setEditingAdmin(user);
    setEditForm({ name: user.name, email: user.email, password: "", role: user.role });
    setEditError("");
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) {
      setEditError("Name and Email are required.");
      return;
    }
    try {
      const updateData = {
        name: editForm.name,
        email: editForm.email.trim(),
        role: editForm.role,
      };
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      await api.put(`/admin_users/${editingAdmin.id}`, updateData);
      setEditingAdmin(null);
      setEditError("");
      fetchAdmins();
    } catch (err) {
      setEditError(err.message || "Failed to update account.");
    }
  };

  const confirmDeleteAdmin = async () => {
    if (!deleteAdminId) return;
    try {
      await api.delete(`/admin_users/${deleteAdminId}`);
      fetchAdmins();
    } catch (err) {
      console.error("Failed to delete admin:", err);
    } finally {
      setDeleteAdminId(null);
    }
  };

  const [grantType, setGrantType] = useState("full_premium");
  const [selectedItemId, setSelectedItemId] = useState("");

  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    const unsubNodes = onSnapshot(
      collection(db, "hierarchy_nodes"),
      (snapshot) => {
        setNodes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error(error),
    );
    return () => {
      unsubNodes();
    };
  }, []);

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    if (
      !selectedStudentId ||
      (grantType !== "full_premium" && !selectedItemId)
    ) {
      setError("Please select both a student and an item.");
      return;
    }

    try {
      let expiresAt = null;
      if (selectedDuration !== "permanent") {
        const months = parseInt(selectedDuration, 10);
        expiresAt = Date.now() + months * 30 * 24 * 60 * 60 * 1000;
      }

      let updateField = "";
      if (grantType === "full_premium") {
        updateField = "fullPremiumExpiry";
      } else if (grantType === "company") {
        updateField = `grantedCompanyAccess.${selectedItemId}`;
      } else if (grantType === "subject") {
        updateField = `grantedSubjectAccess.${selectedItemId}`;
      } else if (grantType === "topic") {
        updateField = `grantedTopicAccess.${selectedItemId}`;
      } else if (grantType === "exam") {
        updateField = `grantedExamAccess.${selectedItemId}`;
      } else if (grantType === "module") {
        updateField = `grantedModuleAccess.${selectedItemId}`;
      }

      await updateDoc(doc(db, "users", selectedStudentId), {
        [updateField]: expiresAt,
        ...(grantType === "full_premium" ? { hasFullPremium: true } : {}), // legacy support
      });

      setSelectedItemId("");
      setSelectedDuration("permanent");
      setError("");
      alert("Access granted successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
      setError(err.message);
    }
  };

  const handleRevokeAccess = async (studentId, type, itemId) => {
    try {
      const { deleteField } = await import("../../firebase");
      let updateField = "";
      if (type === "full_premium") {
        await updateDoc(doc(db, "users", studentId), {
          fullPremiumExpiry: deleteField(),
          hasFullPremium: false,
        });
        return;
      } else if (type === "company") {
        updateField = `grantedCompanyAccess.${itemId}`;
      } else if (type === "subject") {
        updateField = `grantedSubjectAccess.${itemId}`;
      } else if (type === "topic") {
        updateField = `grantedTopicAccess.${itemId}`;
      } else if (type === "exam") {
        updateField = `grantedExamAccess.${itemId}`;
      } else if (type === "module") {
        updateField = `grantedModuleAccess.${itemId}`;
      }

      await updateDoc(doc(db, "users", studentId), {
        [updateField]: deleteField(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  };

  const initiateDeleteStudent = (studentId, name) => {
    if (!isSuperAdmin) {
      alert(
        "Permission Denied: Only Super Admins can permanently delete users.",
      );
      return;
    }
    setUserToDelete({ id: studentId, name });
    setDeleteStatus("idle");
    setDeleteError("");
  };

  const executeDeleteStudent = async () => {
    if (!userToDelete) return;

    setDeleteStatus("deleting");
    setDeleteError("");

    try {
      let operations = [];
      const studentId = userToDelete.id;

      try {
        const scoresQuery = query(
          collection(db, "scores"),
          where("studentId", "==", studentId),
        );
        const sDocs = await getDocs(scoresQuery);
        sDocs.forEach((d) => operations.push({ ref: d.ref }));
      } catch (e) {
        throw new Error(`[Scores] ${e.message}`);
      }

      try {
        const gateScoresQuery = query(
          collection(db, "gateScores"),
          where("studentId", "==", studentId),
        );
        const gsDocs = await getDocs(gateScoresQuery);
        gsDocs.forEach((d) => operations.push({ ref: d.ref }));
      } catch (e) {
        throw new Error(`[GateScores] ${e.message}`);
      }

      try {
        const purchasesQuery = query(
          collection(db, "purchases"),
          where("userId", "==", studentId),
        );
        const pDocs = await getDocs(purchasesQuery);
        pDocs.forEach((d) => operations.push({ ref: d.ref }));
      } catch (e) {
        throw new Error(`[Purchases] ${e.message}`);
      }

      try {
        const paymentReqQuery = query(
          collection(db, "payment_requests"),
          where("userId", "==", studentId),
        );
        const prDocs = await getDocs(paymentReqQuery);
        prDocs.forEach((d) => operations.push({ ref: d.ref }));
      } catch (e) {
        throw new Error(`[PaymentReqs] ${e.message}`);
      }

      try {
        const qNotifs = query(
          collection(db, "notifications"),
          where("userId", "==", studentId),
        );
        const notifs = await getDocs(qNotifs);
        notifs.forEach((d) => operations.push({ ref: d.ref }));
      } catch (e) {} // Optional if notifications don't map to userId

      operations.push({ ref: doc(db, "users", studentId) });

      try {
        const BATCH_SIZE = 500;
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = operations.slice(i, i + BATCH_SIZE);
          chunk.forEach((op) => batch.delete(op.ref));
          await batch.commit();
        }
      } catch (e) {
        throw new Error(`[Batch Delete] ${e.message}`);
      }

      // Perform verification exactly as requested
      try {
        const verifyUser = await getDoc(doc(db, "users", studentId));
        const verifyScores = await getDocs(
          query(collection(db, "scores"), where("studentId", "==", studentId)),
        );
        const verifyGateScores = await getDocs(
          query(
            collection(db, "gateScores"),
            where("studentId", "==", studentId),
          ),
        );
        const verifyPurchases = await getDocs(
          query(collection(db, "purchases"), where("userId", "==", studentId)),
        );
        const verifyPaymentReq = await getDocs(
          query(
            collection(db, "payment_requests"),
            where("userId", "==", studentId),
          ),
        );

        let failedTypes = [];
        if (verifyUser.exists()) failedTypes.push("Profile");
        if (!verifyScores.empty || !verifyGateScores.empty)
          failedTypes.push("Progress & Leaderboard");
        if (!verifyPurchases.empty || !verifyPaymentReq.empty)
          failedTypes.push("Purchases & Analytics");

        if (failedTypes.length > 0) {
          throw new Error(`Verification failed: ${failedTypes.join(", ")}`);
        }
      } catch (e) {
        throw new Error(`[Verify] ${e.message}`);
      }

      // Log Audit Information
      if (adminName) {
        try {
          await logAudit(
            adminName,
            `Permanently Deleted User: ID=${studentId}, Email=${userToDelete.name}`,
          );
        } catch (e) {
          console.warn("Audit failed log: ", e);
        }
      }

      setDeleteStatus("success");
    } catch (err) {
      console.error(err);
      setDeleteError(err.message || err.toString());
      setDeleteStatus("error");
    }
  };

  const getItemName = (type, id) => {
    if (type === "company")
      return companies.find((c) => c.id === id)?.name || id;
    if (type === "exam")
      return (
        nodes.find((n) => n.id === id && n.type === "general_branch")?.name ||
        id
      );
    if (["subject", "topic"].includes(type))
      return nodes.find((n) => n.id === id)?.name || id;
    return id;
  };

  return (
    <div className="space-y-8">
      {/* Create Admin / Content Manager Accounts */}
      <div className="glass-panel border-emerald-500/20 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              Staff Accounts
            </h2>
            <p className="text-sm text-slate-500">
              Manage Sub-Admins and Content Managers
            </p>
          </div>
          {!isCreatingAdmin && (
            <button
              onClick={() => setIsCreatingAdmin(true)}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          )}
        </div>

        {isCreatingAdmin && (
          <form
            onSubmit={handleCreateAdmin}
            className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-emerald-500" />
              New Staff Account
            </h3>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={newAdmin.name}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email (User.ID)
                </label>
                <input
                  type="text"
                  required
                  value={newAdmin.email}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, email: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newAdmin.password}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, password: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={newAdmin.role}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, role: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="content_manager">Content Manager</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingAdmin(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
              {adminUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                    {user.role.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button
                      onClick={() => openEditAdmin(user)}
                      className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4 inline-block" />
                    </button>
                    <button
                      onClick={() => setDeleteAdminId(user.id)}
                      className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
              {adminUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-4 text-center text-sm text-slate-500"
                  >
                    No staff accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              Edit Account — {editingAdmin.name}
            </h3>
            {editError && (
              <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {editError}
              </div>
            )}
            <form onSubmit={handleUpdateAdmin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email (User ID)</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="content_manager">Content Manager</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Accounts */}
      <div className="glass-panel border-indigo-500/20 rounded-xl p-6 shadow-sm">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              Student Accounts
            </h2>
            <p className="text-sm text-slate-500">
              Manage registered students and their data.
            </p>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider text-rose-500">
                  Danger Zone
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {student.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        student.id &&
                        initiateDeleteStudent(
                          student.id,
                          student.name || student.email,
                        )
                      }
                      className="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded border border-rose-200 dark:border-rose-800 transition-colors inline-flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete User
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-sm text-slate-500"
                  >
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Premium Access */}
      <div className="glass-panel border-emerald-500/20 rounded-xl p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Premium Access Manager
          </h2>
          <p className="text-sm text-slate-500">
            Manually grant students access to premium content.
          </p>
        </div>

        <form
          onSubmit={handleGrantAccess}
          className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Select Student
              </label>
              <select
                required
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="">Select a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Grant Type
              </label>
              <select
                value={grantType}
                onChange={(e) => {
                  setGrantType(e.target.value);
                  setSelectedItemId("");
                }}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="full_premium">Full Premium (All Access)</option>
                <option value="company">Individual Company</option>
                <option value="subject">Individual Subject</option>
                <option value="topic">Individual Topic</option>
                <option value="exam">Individual Branch</option>
              </select>
            </div>

            {grantType !== "full_premium" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Item
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">Select an item...</option>
                  {grantType === "company" &&
                    companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isPremium ? "(Premium)" : ""}
                      </option>
                    ))}
                  {grantType !== "company" &&
                    nodes
                      .filter(
                        (n) =>
                          n.type ===
                          (grantType === "exam"
                            ? "general_branch"
                            : `general_${grantType}`),
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} {n.isPremium ? "(Premium)" : ""}
                        </option>
                      ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Duration
              </label>
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="permanent">Permanent</option>
                <option value="1">1 Month</option>
                <option value="3">3 Months</option>
                <option value="12">1 Year</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Grant Access
          </button>
        </form>

        <div className="mt-8 space-y-4">
          <h3 className="text-md font-semibold text-slate-900 dark:text-slate-100">
            Granted Accesess
          </h3>
          <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Granted Access
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
                {students
                  .filter(
                    (s) =>
                      s.hasFullPremium ||
                      (s.grantedCompanyAccess &&
                        Object.keys(s.grantedCompanyAccess).length > 0) ||
                      (s.grantedSubjectAccess &&
                        Object.keys(s.grantedSubjectAccess).length > 0) ||
                      (s.grantedTopicAccess &&
                        Object.keys(s.grantedTopicAccess).length > 0) ||
                      (s.grantedExamAccess &&
                        Object.keys(s.grantedExamAccess).length > 0) ||
                      (s.grantedModuleAccess &&
                        Object.keys(s.grantedModuleAccess).length > 0),
                  )
                  .map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                        <div>{student.name}</div>
                        <div className="text-xs text-slate-500">
                          {student.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <div className="flex pl-1 flex-wrap gap-2">
                          {student.hasFullPremium && (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              <span>
                                Full Premium{" "}
                                {student.fullPremiumExpiry
                                  ? `(Expires: ${new Date(student.fullPremiumExpiry).toLocaleDateString()})`
                                  : "(Permanent)"}
                              </span>
                              <button
                                onClick={() =>
                                  handleRevokeAccess(
                                    student.id,
                                    "full_premium",
                                    null,
                                  )
                                }
                                className="ml-1 opacity-60 hover:opacity-100 hover:text-amber-900"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {[
                            "company",
                            "subject",
                            "topic",
                            "exam",
                            "module",
                          ].map((type) => {
                            const accessMap =
                              student[
                                type === "company"
                                  ? "grantedCompanyAccess"
                                  : type === "subject"
                                    ? "grantedSubjectAccess"
                                    : type === "topic"
                                      ? "grantedTopicAccess"
                                      : type === "exam"
                                        ? "grantedExamAccess"
                                        : "grantedModuleAccess"
                              ];
                            if (!accessMap) return null;
                            return Object.entries(accessMap).map(
                              ([itemId, expiry]) => {
                                const isExpired =
                                  expiry !== null && Date.now() > expiry;
                                return (
                                  <div
                                    key={`${type}-${itemId}`}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isExpired ? "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"}`}
                                  >
                                    <span>
                                      {getItemName(type, itemId)}{" "}
                                      <span className="opacity-70 text-[10px] ml-1 uppercase">
                                        ({type === "exam" ? "branch" : type})
                                      </span>{" "}
                                      {expiry
                                        ? `(Expires: ${new Date(expiry).toLocaleDateString()})`
                                        : "(Permanent)"}
                                    </span>
                                    <button
                                      onClick={() =>
                                        handleRevokeAccess(
                                          student.id,
                                          type,
                                          itemId,
                                        )
                                      }
                                      className="ml-1 opacity-60 hover:opacity-100"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              },
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                {students.filter(
                  (s) =>
                    s.hasFullPremium ||
                    (s.grantedCompanyAccess &&
                      Object.keys(s.grantedCompanyAccess).length > 0) ||
                    (s.grantedSubjectAccess &&
                      Object.keys(s.grantedSubjectAccess).length > 0) ||
                    (s.grantedTopicAccess &&
                      Object.keys(s.grantedTopicAccess).length > 0) ||
                    (s.grantedExamAccess &&
                      Object.keys(s.grantedExamAccess).length > 0) ||
                    (s.grantedModuleAccess &&
                      Object.keys(s.grantedModuleAccess).length > 0),
                ).length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-4 text-center text-sm text-slate-500"
                    >
                      No manual grants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-500/30">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400 mb-6">
              <Trash2 className="w-8 h-8" />
              <h3 className="text-xl font-bold">WARNING</h3>
            </div>

            <div className="space-y-4 mb-8 text-slate-700 dark:text-slate-300">
              <p>This action will permanently delete:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm font-medium">
                <li>User Account ({userToDelete.name})</li>
                <li>Profile Data & Login Data</li>
                <li>Exam Attempts & Module Progress</li>
                <li>Leaderboard Records</li>
                <li>Premium Access & Purchases</li>
                <li>Access Permissions & Analytics Records</li>
                <li>Notifications & User Related Logs</li>
              </ul>
              <p className="font-bold text-rose-600 dark:text-rose-400 mt-4">
                This action cannot be undone. Are you absolutely sure?
              </p>
            </div>

            {deleteStatus === "error" && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                <p className="text-sm font-bold text-rose-700 dark:text-rose-400 mb-1">
                  Deletion Failed:
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-300 break-all">
                  {deleteError}
                </p>
              </div>
            )}

            {deleteStatus === "success" ? (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
                <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                  Deletion Successful
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-300 mb-4">
                  User and all related records have been permanently removed.
                </p>
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 w-full"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setUserToDelete(null)}
                  disabled={deleteStatus === "deleting"}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeleteStudent}
                  disabled={deleteStatus === "deleting"}
                  className="px-6 py-2 bg-rose-600 text-white rounded-lg font-medium shadow-sm hover:focus:ring-rose-500 hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center"
                >
                  {deleteStatus === "deleting"
                    ? "Deleting..."
                    : "Delete Permanently"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteAdminId !== null}
        title="Delete Admin"
        message="Are you sure you want to delete this admin account?"
        onConfirm={confirmDeleteAdmin}
        onCancel={() => setDeleteAdminId(null)}
      />
    </div>
  );
}
