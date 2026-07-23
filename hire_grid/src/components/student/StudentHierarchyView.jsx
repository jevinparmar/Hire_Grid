import React, { useState, useEffect } from "react";
import { collection, db, doc, onSnapshot, query, setDoc, where } from "../../firebase";

import { Lock, ChevronRight, Play } from "lucide-react";
import { PackagePreviewView } from "./PackagePreviewView";
import { hasAccess as globalHasAccess } from "../../lib/accessControl";

export function StudentHierarchyView({ currentUser, onOpenModule }) {
  const [nodes, setNodes] = useState([]);
  const [modules, setModules] = useState([]);
  const [currentNodeInfo, setCurrentNodeInfo] = useState({
    id: null,
    type: "general_branch",
    title: "Branches",
    node: null,
  });
  const [path, setPath] = useState([
    {
      id: null,
      type: "general_branch",
      title: "Branches",
      node: null,
    },
  ]);
  const [previewPackageItem, setPreviewPackageItem] = useState(null);
  const [accessRequestSent, setAccessRequestSent] = useState({});

  const getClosestPackage = (mod) => {
    if (
      mod &&
      mod.accessMode === "custom" &&
      mod.accessType &&
      ["premium_only", "purchasable_only", "premium_purchasable"].includes(
        mod.accessType,
      )
    ) {
      return { node: mod, type: "module" };
    }
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i];
      if (
        p.node &&
        p.node.accessType &&
        ["premium_only", "purchasable_only", "premium_purchasable"].includes(
          p.node.accessType,
        )
      ) {
        let pType = "exam";
        if (p.type.includes("subject")) pType = "subject";
        else if (p.type.includes("topic")) pType = "topic";
        return { node: p.node, type: pType };
      }
    }
    if (
      currentNodeInfo.node &&
      currentNodeInfo.node.accessType &&
      ["premium_only", "purchasable_only", "premium_purchasable"].includes(
        currentNodeInfo.node.accessType,
      )
    ) {
      let pType = "exam";
      if (currentNodeInfo.type.includes("subject")) pType = "subject";
      else if (currentNodeInfo.type.includes("topic")) pType = "topic";
      return { node: currentNodeInfo.node, type: pType };
    }
    if (mod) return { node: mod, type: "module" };
    return null;
  };

  const submitAccessRequest = async (item, type) => {
    if (!currentUser) return;
    try {
      const reqId = crypto.randomUUID();
      await setDoc(doc(db, "access_requests", reqId), {
        id: reqId,
        userId: currentUser.id,
        userName: currentUser.name || currentUser.email,
        userEmail: currentUser.email,
        itemId: item.id,
        itemType: type,
        itemName: item.name || item.title || "Unknown Item",
        status: "pending",
        createdAt: Date.now(),
      });
      setAccessRequestSent((prev) => ({ ...prev, [item.id]: true }));
      alert("Access request submitted successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to submit request.");
    }
  };

  useEffect(() => {
    let unsubNodes = () => {};
    let unsubModules = () => {};

    if (currentNodeInfo.id) {
      // Always fetch modules for the current parent if we are in a branch, subject, or topic
      if (
        ["general_topic", "general_subject", "module"].includes(
          currentNodeInfo.type,
        )
      ) {
        const qMods = query(
          collection(db, "modules"),
          where("parentId", "==", currentNodeInfo.id),
          where("moduleType", "==", "general"),
        );
        unsubModules = onSnapshot(
          qMods,
          (snapshot) => {
            const fetchedMods = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            fetchedMods.sort((a, b) => a.createdAt - b.createdAt);
            setModules(fetchedMods);
          },
          (error) => console.error(error),
        );
      } else {
        setModules([]);
      }
    } else {
      setModules([]);
    }

    if (currentNodeInfo.type !== "module") {
      const qNodes = query(
        collection(db, "hierarchy_nodes"),
        where("parentId", "==", currentNodeInfo.id),
        where("type", "==", currentNodeInfo.type),
      );
      unsubNodes = onSnapshot(
        qNodes,
        (snapshot) => {
          const fetchedNodes = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              type: data.type,
              name: data.name || data.title,
            };
          });
          fetchedNodes.sort((a, b) => a.createdAt - b.createdAt);
          setNodes(fetchedNodes);
        },
        (error) => console.error(error),
      );
    } else {
      setNodes([]);
    }

    return () => {
      unsubNodes();
      unsubModules();
    };
  }, [currentNodeInfo]);

  const hasAccess = (item, isModule = false) => {
    let type = isModule ? "module" : item.type;
    return globalHasAccess(item, type, currentUser, path);
  };

  const handleNodeClick = (node) => {
    let nextType = "module";
    if (node.type === "general_branch") nextType = "general_subject";
    else if (node.type === "general_subject") nextType = "general_topic";
    else if (node.type === "general_topic") nextType = "module";

    const nextInfo = {
      id: node.id,
      type: nextType,
      title: node.name,
      node: node,
    };
    setPath([...path, nextInfo]);
    setCurrentNodeInfo(nextInfo);
  };

  const jumpToPath = (index) => {
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    setCurrentNodeInfo(newPath[newPath.length - 1]);
  };

  if (previewPackageItem) {
    return (
      <PackagePreviewView
        packageNode={previewPackageItem.node}
        packageType={previewPackageItem.type}
        onBack={() => setPreviewPackageItem(null)}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-slate-500 bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 tracking-wide overflow-x-auto whitespace-nowrap">
        {path.map((step, idx) => (
          <React.Fragment key={idx}>
            <button
              onClick={() => jumpToPath(idx)}
              className={`transition-colors font-semibold ${idx === path.length - 1 ? "text-slate-900 dark:text-slate-100 cursor-default" : "hover:text-amber-600 dark:hover:text-amber-400"}`}
              disabled={idx === path.length - 1}
            >
              {step.title}
            </button>
            {idx < path.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-1 opacity-50 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {currentNodeInfo.node && !hasAccess(currentNodeInfo.node) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm">
          <div className="flex items-center mb-4 sm:mb-0">
            <Lock className="w-6 h-6 text-amber-500 shrink-0 mr-3" />
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-400">
                Unlock {currentNodeInfo.title}
              </h4>
              <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                Purchase this category to unlock all premium contents inside.
              </p>
            </div>
          </div>
          {currentNodeInfo.node.accessType === "access_request_only" ? (
            <button
              onClick={() => {
                let pType = "exam";
                if (currentNodeInfo.type.includes("subject")) pType = "subject";
                else if (currentNodeInfo.type.includes("topic"))
                  pType = "topic";
                submitAccessRequest(currentNodeInfo.node, pType);
              }}
              disabled={accessRequestSent[currentNodeInfo.node.id]}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm whitespace-nowrap"
            >
              {accessRequestSent[currentNodeInfo.node.id]
                ? "Requested"
                : "Request Access"}
            </button>
          ) : (
            <button
              onClick={() => {
                const pkg = getClosestPackage();
                if (pkg) setPreviewPackageItem(pkg);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm whitespace-nowrap"
            >
              Unlock Package
            </button>
          )}
        </div>
      )}

      {currentNodeInfo.type !== "module" && nodes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          {nodes.map((node) => {
            const access = hasAccess(node);
            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col ${!access ? "hover:border-amber-400 hover:ring-2 hover:ring-amber-400/20" : "hover:border-indigo-400"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black uppercase text-xl shadow-inner ${access ? "bg-gradient-to-br from-indigo-500 to-indigo-600" : "bg-gradient-to-br from-amber-500 to-amber-600"}`}
                  >
                    {node.name.charAt(0)}
                  </div>
                  {node.isPremium && !access && (
                    <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 p-2 rounded-xl">
                      <Lock className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-xl line-clamp-2">
                  {node.name}
                </h3>
                {node.description && (
                  <p className="text-sm text-slate-500 line-clamp-2 mt-2">
                    {node.description}
                  </p>
                )}
                {node.isPremium && !access && (
                  <p
                    className="text-amber-600 font-bold mt-2 hover:underline z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      const pkg = getClosestPackage();
                      if (pkg) setPreviewPackageItem(pkg);
                    }}
                  >
                    Unlock Package
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(currentNodeInfo.type === "module" || modules.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => {
            const access = hasAccess(mod, true);
            return (
              <div
                key={mod.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full relative group"
              >
                {mod.accessMode === "custom" ? (
                  mod.accessType &&
                  mod.accessType !== "free" && (
                    <div
                      className={`absolute top-0 right-0 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-bl-lg z-10 flex items-center ${mod.accessType === "demo" ? "bg-indigo-500" : "bg-amber-500"}`}
                    >
                      {["premium_only", "premium_purchasable"].includes(
                        mod.accessType,
                      ) && <Lock className="w-3 h-3 mr-1" />}
                      {mod.accessType === "premium_only"
                        ? `Premium`
                        : mod.accessType === "purchasable_only"
                          ? `Purchasable (₹${mod.price || 0})`
                          : mod.accessType === "premium_purchasable"
                            ? `Prem/Purch (₹${mod.price || 0})`
                            : "Demo"}
                    </div>
                  )
                ) : (
                  <div className="absolute top-0 right-0 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-bl-lg z-10 flex items-center">
                    Inherit Parent
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mt-2">
                    {mod.title}
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">
                    {mod.description}
                  </p>
                </div>
                {access ? (
                  <button
                    onClick={() => onOpenModule(mod, path)}
                    className="w-full flex items-center justify-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:text-amber-600 dark:hover:text-amber-400 py-3 rounded-xl font-bold transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start Module</span>
                  </button>
                ) : (mod.accessMode === "custom" &&
                    mod.accessType === "access_request_only") ||
                  ((!mod.accessMode || mod.accessMode === "inherit") &&
                    currentNodeInfo.node?.accessType ===
                      "access_request_only") ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      submitAccessRequest(mod, "module");
                    }}
                    disabled={accessRequestSent[mod.id]}
                    className="w-full flex items-center justify-center space-x-2 disabled:opacity-50 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 py-3 rounded-xl font-bold transition-colors border border-amber-200 dark:border-amber-800/50"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {accessRequestSent[mod.id]
                        ? "Requested"
                        : "Request Access"}
                    </span>
                  </button>
                ) : (
                  <div className="flex flex-col space-y-2 mt-4">
                    {(() => {
                      const pkg = getClosestPackage(mod);
                      return (
                        <>
                          {(() => {
                            const nodeAny = pkg.node;
                            return nodeAny.name || nodeAny.title ? (
                              <p className="text-xs text-amber-600 dark:text-amber-500 font-medium leading-tight">
                                Included in the{" "}
                                <strong>{nodeAny.name || nodeAny.title}</strong>{" "}
                                Complete Package.
                              </p>
                            ) : null;
                          })()}
                          <button
                            onClick={() => {
                              if (pkg) setPreviewPackageItem(pkg);
                            }}
                            className="w-full flex items-center justify-center space-x-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 py-3 rounded-xl font-bold transition-colors border border-amber-200 dark:border-amber-800/50"
                          >
                            <Lock className="w-4 h-4" />
                            <span>Unlock Package</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
          {modules.length === 0 && currentNodeInfo.type === "module" && (
            <div className="col-span-full py-12 text-center text-slate-500 font-medium">
              No learning modules available here yet.
            </div>
          )}
        </div>
      )}

      {currentNodeInfo.type !== "module" &&
        nodes.length === 0 &&
        modules.length === 0 && (
          <div className="py-12 text-center text-slate-500 font-medium">
            No content found.
          </div>
        )}
    </div>
  );
}
