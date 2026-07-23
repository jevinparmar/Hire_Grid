import React, { useState, useEffect } from "react";
import { OperationType, collection, db, deleteDoc, doc, handleFirestoreError, onSnapshot, query, setDoc, where } from "../../firebase";

import { AdminModulesTab } from "./AdminModulesTab";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SortableList } from "../common/SortableList";
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Folder,
  ShieldCheck,
} from "lucide-react";
import { logAudit } from "../../auditLogger";

export function HierarchyBuilder({
  isContentManager = false,
  userName = "Admin",
  initialNode,
}) {
  const [nodes, setNodes] = useState([]);
  const defaultInitial = {
    id: null,
    type: "general_branch",
    title: "Branches",
  };
  const startNode = initialNode || defaultInitial;

  const [currentNodeInfo, setCurrentNodeInfo] = useState(startNode);

  const [path, setPath] = useState([startNode]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [isPurchasable, setIsPurchasable] = useState(false);
  const [price, setPrice] = useState(0);
  const [sellType, setSellType] = useState("pack");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [deleteNodeInfo, setDeleteNodeInfo] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "hierarchy_nodes"),
      where("parentId", "==", currentNodeInfo.id),
      where("type", "==", currentNodeInfo.type),
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNodes = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // map legacy isPremium to accessType
        fetchedNodes.forEach((n) => {
          if (!n.accessType)
            n.accessType = n.isPremium ? "premium_only" : "free";
          if (!n.sellType) n.sellType = "pack";
        });
        // sort on client since we might not have composite index
        fetchedNodes.sort((a, b) => {
          const orderA = a.displayOrder ?? 999999;
          const orderB = b.displayOrder ?? 999999;
          if (orderA !== orderB) return orderA - orderB;
          return a.createdAt - b.createdAt;
        });
        setNodes(fetchedNodes);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, "hierarchy_nodes"),
    );

    return () => unsub();
  }, [currentNodeInfo]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const id = editingId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
      let finalAccessType = "free";
      if (isPremium && isPurchasable) finalAccessType = "premium_purchasable";
      else if (isPremium) finalAccessType = "premium_only";
      else if (isPurchasable) finalAccessType = "purchasable_only";

      const payload = {
        id,
        name,
        description,
        type: currentNodeInfo.type,
        parentId: currentNodeInfo.id,
        accessType: finalAccessType,
        isPremium,
        sellType,
        displayOrder,
        createdAt: editingId
          ? nodes.find((n) => n.id === editingId)?.createdAt || Date.now()
          : Date.now(),
        createdBy: editingId
          ? (nodes.find((n) => n.id === editingId)?.createdBy || null)
          : userName,
      };
      if (isPurchasable) payload.price = price;
      else payload.price = 0;

      await setDoc(doc(db, "hierarchy_nodes", id), payload);

      if (isContentManager) {
        await logAudit(
          userName,
          `${editingId ? "Updated" : "Created"} ${currentNodeInfo.type.replace("_", " ")}: ${name}`,
        );
      }

      setIsCreating(false);
      setEditingId(null);
      setName("");
      setDescription("");
      setIsPremium(false);
      setIsPurchasable(false);
      setSellType("pack");
      setPrice(0);
      alert("Success: Saved successfully!");
    } catch (err) {
      alert("Error: " + err.message);
      handleFirestoreError(err, OperationType.WRITE, "hierarchy_nodes");
    }
  };

  const confirmDelete = async () => {
    if (!deleteNodeInfo) return;
    const node = nodes.find((n) => n.id === deleteNodeInfo.id);
    if (isContentManager && node && node.createdBy && node.createdBy !== userName) {
      alert("You are not authorized to delete this node. Only the creator or a Super Admin can delete it.");
      setDeleteNodeInfo(null);
      return;
    }
    try {
      await deleteDoc(doc(db, "hierarchy_nodes", deleteNodeInfo.id));
      if (isContentManager) {
        await logAudit(
          userName,
          `Deleted ${currentNodeInfo.type.replace("_", " ")}: ${deleteNodeInfo.name}`,
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "hierarchy_nodes");
    } finally {
      setDeleteNodeInfo(null);
    }
  };

  const navigateToChild = (node) => {
    let nextType = "module";
    if (node.type === "general_branch") nextType = "general_subject";
    else if (node.type === "general_subject") nextType = "general_topic";
    else if (node.type === "general_topic") nextType = "module";

    const nextInfo = { id: node.id, type: nextType, title: node.name };
    setPath([...path, nextInfo]);
    setCurrentNodeInfo(nextInfo);
  };

  const jumpToPath = (index) => {
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    setCurrentNodeInfo(newPath[newPath.length - 1]);
  };

  if (currentNodeInfo.type === "module") {
    return (
      <div>
        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-6 bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          {path.map((step, idx) => (
            <React.Fragment key={idx}>
              <button
                onClick={() => jumpToPath(idx)}
                className="hover:text-amber-600 dark:hover:text-amber-400 font-medium transition-colors"
              >
                {step.title}
              </button>
              {idx < path.length - 1 && <ChevronRight className="w-4 h-4" />}
            </React.Fragment>
          ))}
        </div>
        <AdminModulesTab
          moduleType="general"
          parentId={currentNodeInfo.id}
          isContentManager={isContentManager}
          userName={userName}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-slate-500 mb-6 bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        {path.map((step, idx) => (
          <React.Fragment key={idx}>
            <button
              onClick={() => jumpToPath(idx)}
              className={`transition-colors font-medium ${idx === path.length - 1 ? "text-slate-900 dark:text-slate-100 cursor-default" : "hover:text-amber-600 dark:hover:text-amber-400"}`}
              disabled={idx === path.length - 1}
            >
              {step.title}
            </button>
            {idx < path.length - 1 && <ChevronRight className="w-4 h-4" />}
          </React.Fragment>
        ))}
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
          {currentNodeInfo.type.replace("_", " ")} Management
        </h3>
        {!isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingId(null);
              setName("");
              setDescription("");
              setIsPremium(false);
              setIsPurchasable(false);
              setPrice(0);
              setSellType("pack");
              setDisplayOrder(
                nodes.length > 0
                  ? Math.max(...nodes.map((n) => n.displayOrder || 0)) + 100
                  : 100,
              );
            }}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-600 dark:hover:bg-amber-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="capitalize">
              Add {currentNodeInfo.type.replace("_", " ").split(" ").pop()}
            </span>
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>
              <input
                autoFocus
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                placeholder="Enter name..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                placeholder="Enter description..."
                rows={2}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Display Order
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                placeholder="e.g. 100"
              />
            </div>

            {!isContentManager && (
              <div className="space-y-4 md:col-span-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center mb-2">
                  Access Settings
                </h4>
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isPremiumGeneral"
                        checked={isPremium}
                        onChange={(e) => setIsPremium(e.target.checked)}
                        className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                      />

                      <label
                        htmlFor="isPremiumGeneral"
                        className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Included In Premium
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isPurchasableGeneral"
                        checked={isPurchasable}
                        onChange={(e) => setIsPurchasable(e.target.checked)}
                        className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                      />

                      <label
                        htmlFor="isPurchasableGeneral"
                        className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Available For Purchase
                      </label>
                    </div>
                  </div>

                  {isPurchasable && (
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                          Sales Type
                        </label>
                        <div className="flex space-x-4">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              value="pack"
                              checked={sellType === "pack"}
                              onChange={() => setSellType("pack")}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />

                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              Sell Complete Pack
                            </span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              value="individual"
                              checked={sellType === "individual"}
                              onChange={() => setSellType("individual")}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />

                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              Sell Individual Modules
                            </span>
                          </label>
                        </div>
                      </div>
                      {sellType === "pack" && (
                        <div className="space-y-1 mt-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Purchase Price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                setName("");
                setDescription("");
                setIsPremium(false);
                setIsPurchasable(false);
                setSellType("pack");
                setPrice(0);
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <SortableList
          items={nodes}
          collectionName="hierarchy_nodes"
          onOrderChange={setNodes}
          grid={true}
          disabled={!isContentManager}
          renderItem={(node) => (
            <div className="relative group bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-colors flex flex-col h-full z-10">
              {node.accessType && node.accessType !== "free" && (
                <div
                  className={`absolute top-0 right-0 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-bl-lg z-10 flex items-center ${node.accessType === "demo" ? "bg-indigo-500" : "bg-amber-500"}`}
                >
                  {["premium_only", "premium_purchasable"].includes(
                    node.accessType,
                  ) && <ShieldCheck className="w-3 h-3 mr-1" />}
                  {node.accessType === "premium_only"
                    ? `Premium`
                    : node.accessType === "purchasable_only"
                      ? `Purchasable (₹${node.price || 0})`
                      : node.accessType === "premium_purchasable"
                        ? `Prem/Purch (₹${node.price || 0})`
                        : "Demo"}
                </div>
              )}

              <div
                onClick={() => navigateToChild(node)}
                className="p-5 flex-grow cursor-pointer"
              >
                <div className="w-12 h-12 flex-shrink-0 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4">
                  <Folder className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1 line-clamp-2">
                    {node.name}
                  </h4>
                  {node.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                      {node.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between relative z-20">
                <button
                  onClick={() => {
                    if (isContentManager && node.createdBy && node.createdBy !== userName) {
                      alert("You are not authorized to edit this node. Only the creator or a Super Admin can edit it.");
                      return;
                    }
                    setIsCreating(true);
                    setEditingId(node.id);
                    setName(node.name);
                    setDescription(node.description || "");
                    const accType =
                      node.accessType ||
                      (node.isPremium ? "premium_only" : "free");
                    setIsPremium(
                      ["premium_only", "premium_purchasable"].includes(accType),
                    );
                    setIsPurchasable(
                      ["purchasable_only", "premium_purchasable"].includes(
                        accType,
                      ),
                    );
                    setPrice(node.price || 0);
                    setSellType(node.sellType || "pack");
                    setDisplayOrder(node.displayOrder || 0);
                  }}
                  className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (isContentManager && node.createdBy && node.createdBy !== userName) {
                      alert("You are not authorized to delete this node. Only the creator or a Super Admin can delete it.");
                      return;
                    }
                    setDeleteNodeInfo({ id: node.id, name: node.name })
                  }}
                  className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          )}
        />

        {nodes.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 border-dashed dark:border-slate-800">
            No items found. Click add to create.
          </div>
        )}
      </div>

      {(currentNodeInfo.type === "general_topic" ||
        currentNodeInfo.type === "general_subject") &&
        currentNodeInfo.id && (
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
            <AdminModulesTab
              moduleType="general"
              parentId={currentNodeInfo.id}
              isContentManager={isContentManager}
              userName={userName}
            />
          </div>
        )}

      <ConfirmDialog
        isOpen={deleteNodeInfo !== null}
        title={`Delete ${currentNodeInfo.type.replace("_", " ")}`}
        message={`Are you sure you want to delete ${deleteNodeInfo?.name}? This will delete the item but not its children automatically.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteNodeInfo(null)}
      />
    </div>
  );
}
