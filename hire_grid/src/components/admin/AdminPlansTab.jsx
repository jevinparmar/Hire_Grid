import React, { useState, useEffect } from "react";
import {
  collection,
  db,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  OperationType,
  handleFirestoreError,
} from "../../firebase";
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Building2,
  Check,
  Shield,
  X,
  PlayCircle,
} from "lucide-react";
import { logAudit } from "../../auditLogger";

export function AdminPlansTab({ userName }) {
  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [duration, setDuration] = useState("1_month");
  const [durationDays, setDurationDays] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [isFreemium, setIsFreemium] = useState(false);
  
  // Selection State
  const [learningContent, setLearningContent] = useState([]); // Selected Branch/Subject/Topic/Module IDs
  const [companyModules, setCompanyModules] = useState([]); // Selected Company IDs
  const [freeDemoModules, setFreeDemoModules] = useState([]); // Selected Module IDs marked as free demo

  // Tree Expansion & Loading State
  const [expandedNodes, setExpandedNodes] = useState({});
  const [childrenMap, setChildrenMap] = useState({});
  const [loadingNodes, setLoadingNodes] = useState({});

  // Subscriptions
  useEffect(() => {
    const q = query(collection(db, "plans"));
    const unsubPlans = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setPlans(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "plans")
    );

    const compQuery = query(collection(db, "companies"));
    const unsubComp = onSnapshot(
      compQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCompanies(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "companies")
    );

    return () => {
      unsubPlans();
      unsubComp();
    };
  }, []);

  // Fetch children of a node dynamically on expansion
  const loadNodeChildren = async (nodeId, nodeType) => {
    if (childrenMap[nodeId]) return; // Already loaded
    setLoadingNodes((prev) => ({ ...prev, [nodeId]: true }));
    try {
      let fetched = [];
      if (nodeType === "root") {
        const q = query(
          collection(db, "hierarchy_nodes"),
          where("parentId", "==", null),
          where("type", "==", "general_branch")
        );
        const snap = await getDocs(q);
        fetched = snap.docs.map((d) => ({ id: d.id, name: d.data().name, type: "general_branch" }));
      } else if (nodeType === "general_branch") {
        const q = query(
          collection(db, "hierarchy_nodes"),
          where("parentId", "==", nodeId),
          where("type", "==", "general_subject")
        );
        const snap = await getDocs(q);
        fetched = snap.docs.map((d) => ({ id: d.id, name: d.data().name, type: "general_subject" }));
      } else if (nodeType === "general_subject") {
        const q = query(
          collection(db, "hierarchy_nodes"),
          where("parentId", "==", nodeId),
          where("type", "==", "general_topic")
        );
        const snap = await getDocs(q);
        fetched = snap.docs.map((d) => ({ id: d.id, name: d.data().name, type: "general_topic" }));
      } else if (nodeType === "general_topic") {
        const q = query(
          collection(db, "modules"),
          where("parentId", "==", nodeId)
        );
        const snap = await getDocs(q);
        fetched = snap.docs.map((d) => ({ id: d.id, name: d.data().name, type: "module" }));
      }

      setChildrenMap((prev) => ({ ...prev, [nodeId]: fetched }));
    } catch (err) {
      console.error("Failed to load node children:", err);
    } finally {
      setLoadingNodes((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  const handleToggleExpand = async (nodeId, nodeType) => {
    const nextState = !expandedNodes[nodeId];
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: nextState }));
    if (nextState) {
      await loadNodeChildren(nodeId, nodeType);
    }
  };

  // Helper: check if a node is selected (either explicitly or via parent inheritance)
  const isSelected = (nodeId, parentIds = []) => {
    if (learningContent.includes(nodeId)) return true;
    return parentIds.some((pId) => learningContent.includes(pId));
  };

  const handleToggleNode = (nodeId, parentIds = []) => {
    const isNodeSelected = learningContent.includes(nodeId);
    let updated = [...learningContent];

    if (isNodeSelected) {
      // Remove selection
      updated = updated.filter((id) => id !== nodeId);
    } else {
      // If parent is already checked, this child is implicitly selected, but checking it explicitly
      updated.push(nodeId);
    }
    setLearningContent(updated);
  };

  const handleToggleDemo = (moduleId) => {
    if (freeDemoModules.includes(moduleId)) {
      setFreeDemoModules(freeDemoModules.filter((id) => id !== moduleId));
    } else {
      setFreeDemoModules([...freeDemoModules, moduleId]);
    }
  };

  const handleToggleCompany = (companyId) => {
    if (companyModules.includes(companyId)) {
      setCompanyModules(companyModules.filter((id) => id !== companyId));
    } else {
      setCompanyModules([...companyModules, companyId]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const planId = editingId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
      const payload = {
        id: planId,
        name,
        price: Number(price),
        duration,
        durationDays: duration === "custom_days" ? Number(durationDays) : null,
        isActive,
        isFreemium,
        learningContent,
        companyModules,
        freeDemoModules,
      };

      await setDoc(doc(db, "plans", planId), payload);

      await logAudit(
        userName,
        `${editingId ? "Updated" : "Created"} subscription plan: ${name}`
      );

      // Reset
      setIsFormOpen(false);
      setEditingId(null);
      setName("");
      setPrice(0);
      setDuration("1_month");
      setDurationDays(30);
      setIsActive(true);
      setIsFreemium(false);
      setLearningContent([]);
      setCompanyModules([]);
      setFreeDemoModules([]);
      alert("Plan saved successfully!");
    } catch (err) {
      alert("Error saving plan: " + err.message);
    }
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setName(plan.name);
    setPrice(plan.price);
    setDuration(plan.duration);
    setDurationDays(plan.durationDays || 30);
    setIsActive(plan.isActive);
    setIsFreemium(plan.isFreemium);
    setLearningContent(plan.learningContent || []);
    setCompanyModules(plan.companyModules || []);
    setFreeDemoModules(plan.freeDemoModules || []);
    setIsFormOpen(true);
  };

  const handleDelete = async (planId, planName) => {
    if (!confirm(`Are you sure you want to delete the plan "${planName}"?`)) return;
    try {
      await deleteDoc(doc(db, "plans", planId));
      await logAudit(userName, `Deleted subscription plan: ${planName}`);
      alert("Plan deleted successfully!");
    } catch (err) {
      alert("Error deleting plan: " + err.message);
    }
  };

  // Load root level nodes on mount if form is open
  useEffect(() => {
    if (isFormOpen) {
      loadNodeChildren("root", "root");
    }
  }, [isFormOpen]);

  // Tree Renderer
  const renderTree = (nodeId, nodeType, parentIds = []) => {
    const children = childrenMap[nodeId] || [];
    const isLoading = loadingNodes[nodeId];
    
    return (
      <div className="pl-4 space-y-2">
        {isLoading && <span className="text-xs text-slate-400">Loading...</span>}
        {children.map((child) => {
          const isExpanded = expandedNodes[child.id];
          const hasChildren = child.type !== "module";
          const currentParentIds = [...parentIds, nodeId];
          const checked = isSelected(child.id, currentParentIds);
          const explicitlyChecked = learningContent.includes(child.id);

          return (
            <div key={child.id} className="space-y-1">
              <div className="flex items-center space-x-2 py-1 hover:bg-slate-100/5 dark:hover:bg-slate-800/40 rounded-lg px-2 group">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(child.id, child.type)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                ) : (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                )}

                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleNode(child.id, currentParentIds)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-700 rounded focus:ring-emerald-500 bg-transparent"
                />

                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {child.name}
                </span>

                {child.type === "module" && checked && (
                  <label className="flex items-center space-x-1.5 ml-auto cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={freeDemoModules.includes(child.id)}
                      onChange={() => handleToggleDemo(child.id)}
                      className="w-3.5 h-3.5 text-lime-500 border-slate-300 rounded bg-transparent"
                    />
                    <span className="text-xs font-semibold text-lime-400 uppercase tracking-wide">
                      Free Demo
                    </span>
                  </label>
                )}
              </div>

              {hasChildren && isExpanded && (
                <div className="border-l border-slate-200 dark:border-slate-800 ml-3">
                  {renderTree(child.id, child.type, currentParentIds)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-[#0B1528] border border-slate-800/80 p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Subscription Plans</h2>
          <p className="text-xs text-slate-400 mt-1">Configure packages and content entitlements</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={() => {
              setEditingId(null);
              setName("");
              setPrice(0);
              setDuration("1_month");
              setDurationDays(30);
              setIsActive(true);
              setIsFreemium(false);
              setLearningContent([]);
              setCompanyModules([]);
              setFreeDemoModules([]);
              setIsFormOpen(true);
            }}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Create Plan</span>
          </button>
        )}
      </div>

      {/* Plan Form Modal/Slideover */}
      {isFormOpen && (
        <form
          onSubmit={handleSave}
          className="bg-[#0B1528] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6"
        >
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white">
              {editingId ? "Edit Subscription Plan" : "New Subscription Plan"}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Plan Name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-[#070D19] text-slate-100 focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. Master GATE Pack"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Price (INR)</label>
              <input
                required
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-[#070D19] text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-[#070D19] text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="free">Free (Freemium)</option>
                <option value="1_month">1 Month</option>
                <option value="3_months">3 Months</option>
                <option value="6_months">6 Months</option>
                <option value="9_months">9 Months</option>
                <option value="12_months">12 Months</option>
                <option value="lifetime">Lifetime</option>
                <option value="custom_days">Custom Days</option>
              </select>
            </div>

            {duration === "custom_days" && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Custom Days</label>
                <input
                  required
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-[#070D19] text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center space-x-6 py-4">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded border-slate-800 bg-[#070D19]"
                />
                <span className="text-sm font-medium text-slate-300">Active Status</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFreemium}
                  onChange={(e) => setIsFreemium(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded border-slate-800 bg-[#070D19]"
                />
                <span className="text-sm font-medium text-slate-300">Freemium Toggle</span>
              </label>
            </div>
          </div>

          {/* Dual Columns Content Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-800 pt-6">
            {/* Left: Learning Hierarchy Tree */}
            <div className="space-y-4 bg-[#070D19] border border-slate-800/80 p-5 rounded-2xl">
              <h4 className="font-bold text-white flex items-center text-sm uppercase tracking-wider text-slate-400">
                1. Learning Content Hierarchy
              </h4>
              <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
                {renderTree("root", "root")}
              </div>
            </div>

            {/* Right: Company List Selection */}
            <div className="space-y-4 bg-[#070D19] border border-slate-800/80 p-5 rounded-2xl flex flex-col">
              <h4 className="font-bold text-white flex items-center text-sm uppercase tracking-wider text-slate-400">
                2. Company-Specific Modules
              </h4>
              <div className="max-h-96 overflow-y-auto space-y-2.5 flex-grow custom-scrollbar">
                {companies.length === 0 ? (
                  <span className="text-xs text-slate-500">No companies available.</span>
                ) : (
                  companies.map((comp) => {
                    const checked = companyModules.includes(comp.id);
                    return (
                      <label
                        key={comp.id}
                        className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-[#091121] border-slate-800 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleCompany(comp.id)}
                          className="w-4 h-4 text-emerald-600 rounded bg-transparent"
                        />
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium">{comp.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/10"
            >
              Save Plan
            </button>
          </div>
        </form>
      )}

      {/* Plans List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.length === 0 ? (
          <div className="md:col-span-3 text-center py-12 bg-[#0B1528] border border-slate-850 rounded-2xl text-slate-500">
            No plans created yet. Click "Create Plan" to get started.
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#0B1528] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                plan.isActive
                  ? "border-slate-800/80 hover:border-emerald-500/30"
                  : "border-slate-850 opacity-60"
              }`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-base tracking-wide line-clamp-1">
                      {plan.name}
                    </h3>
                    <span className="text-xs font-semibold text-slate-400 capitalize inline-block mt-1">
                      {plan.duration.replace("_", " ")}
                      {plan.duration === "custom_days" && ` (${plan.durationDays} Days)`}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      plan.isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-baseline space-x-1.5 py-2">
                  <span className="text-2xl font-black text-white">
                    ₹{Number(plan.price || 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">INR</span>
                  {plan.isFreemium && (
                    <span className="text-[10px] font-bold text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full ml-auto">
                      Freemium
                    </span>
                  )}
                </div>

                {/* Content Entitlements Summary */}
                <div className="border-t border-slate-850 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Learning Entitlements:</span>
                    <span className="font-semibold text-white">
                      {(plan.learningContent || []).length} Items
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Company Modules:</span>
                    <span className="font-semibold text-white">
                      {(plan.companyModules || []).length} Companies
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Free Demos:</span>
                    <span className="font-semibold text-lime-400">
                      {(plan.freeDemoModules || []).length} Modules
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-850 mt-4 pt-3">
                <button
                  onClick={() => handleEdit(plan)}
                  className="flex items-center text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(plan.id, plan.name)}
                  className="flex items-center text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
