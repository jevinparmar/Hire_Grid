import React, { useState, useEffect } from "react";
import { collection, db, getDocs } from "../../firebase";

import {
  Package,
  BookOpen,
  Layers,
  PlayCircle,
  ShieldCheck,
  ArrowLeft,
  Unlock,
  Star,
} from "lucide-react";
import { motion } from "motion/react";
import { PremiumPurchaseView } from "./PremiumPurchaseView";

export function PackagePreviewView({
  packageNode,
  packageType,
  onBack,
  currentUser,
}) {
  const [showPurchase, setShowPurchase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    subjects: 0,
    topics: 0,
    totalModules: 0,
    freeModules: 0,
    demoModules: 0,
    premiumModules: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (packageType === "module") {
        setStats({
          subjects: 0,
          topics: 0,
          totalModules: 1,
          freeModules: packageNode.accessType === "free" ? 1 : 0,
          demoModules: packageNode.accessType === "demo" ? 1 : 0,
          premiumModules: [
            "premium_only",
            "premium_purchasable",
            "purchasable_only",
          ].includes(packageNode.accessType)
            ? 1
            : 0,
        });
        setLoading(false);
        return;
      }

      try {
        const [nodesSnap, modulesSnap] = await Promise.all([
          getDocs(collection(db, "hierarchy_nodes")),
          getDocs(collection(db, "modules")),
        ]);

        const allNodes = nodesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const allModules = modulesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Build a map of children for fast traversal
        const childrenMap = {};
        allNodes.forEach((n) => {
          if (n.parentId) {
            if (!childrenMap[n.parentId]) childrenMap[n.parentId] = [];
            childrenMap[n.parentId].push(n.id);
          }
        });

        // Add modules to childrenMap
        allModules.forEach((m) => {
          if (m.parentId) {
            if (!childrenMap[m.parentId]) childrenMap[m.parentId] = [];
            childrenMap[m.parentId].push(m.id);
          }
        });

        const packageDescendants = new Set();
        const traverse = (id) => {
          packageDescendants.add(id);
          if (childrenMap[id]) {
            childrenMap[id].forEach((childId) => traverse(childId));
          }
        };

        traverse(packageNode.id);

        let subjects = 0;
        let topics = 0;
        let totalModules = 0;
        let freeModules = 0;
        let demoModules = 0;
        let premiumModules = 0;

        allNodes.forEach((n) => {
          if (packageDescendants.has(n.id)) {
            if (n.type?.includes("subject")) subjects++;
            if (n.type?.includes("topic")) topics++;
          }
        });

        allModules.forEach((m) => {
          if (packageDescendants.has(m.id)) {
            totalModules++;
            // We need to resolve inherit mode
            let accType = m.accessType;
            if (!m.accessMode || m.accessMode === "inherit") {
              // If inheriting, we can roughly estimate based on its immediate parent or the package itself.
              // For simplicity in statistics, if it's inheriting from this package, it's premium (as the package is premium).
              // But wait, the package is definitely premium. So any inherited module is premium by default.
              accType =
                packageNode.accessType ||
                (packageNode.isPremium ? "premium_only" : "free");
            }
            if (accType === "free") freeModules++;
            else if (accType === "demo") demoModules++;
            else premiumModules++;
          }
        });

        setStats({
          subjects,
          topics,
          totalModules,
          freeModules,
          demoModules,
          premiumModules,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [packageNode, packageType]);

  if (showPurchase) {
    return (
      <PremiumPurchaseView
        itemId={packageNode.id}
        itemName={packageNode.name || packageNode.title}
        itemType={packageType}
        price={packageNode.price || 0}
        onBack={() => setShowPurchase(false)}
        currentUser={currentUser}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <button
        onClick={onBack}
        className="inline-flex items-center px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 rounded-xl transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Content
      </button>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">
              {packageNode.name || packageNode.title} Complete Package
            </h2>
            <p className="text-lg text-slate-500 font-medium mt-1">
              Unlock full access to all included content
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center text-slate-500 dark:text-slate-400 mb-2">
                  <BookOpen className="w-4 h-4 mr-2" />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Total Subjects
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.subjects}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center text-slate-500 dark:text-slate-400 mb-2">
                  <Layers className="w-4 h-4 mr-2" />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Total Topics
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.topics}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center text-slate-500 dark:text-slate-400 mb-2">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Total Modules
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.totalModules}
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center text-emerald-600 dark:text-emerald-400 mb-2">
                  <Unlock className="w-4 h-4 mr-2" />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Free Modules
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {stats.freeModules}
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center text-indigo-600 dark:text-indigo-400 mb-2">
                  <Star className="w-4 h-4 mr-2" />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Demo Modules
                  </span>
                </div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                  {stats.demoModules}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/30">
                <div className="flex items-center text-amber-600 dark:text-amber-400 mb-2">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Premium Modules
                  </span>
                </div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                  {stats.premiumModules}
                </div>
              </div>
            </div>

            {(!packageNode.accessType ||
              ["purchasable_only", "premium_purchasable"].includes(
                packageNode.accessType,
              )) &&
              packageNode.price > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setShowPurchase(true)}
                    className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700 px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <span>Unlock Complete Package</span>
                    <span className="bg-white/20 px-2 py-1 rounded-md ml-4 font-black">
                      ₹{packageNode.price}
                    </span>
                  </button>
                </div>
              )}

            {(!packageNode.price || packageNode.price === 0) && (
              <div className="mt-4 text-center text-sm text-slate-500 font-medium">
                This content is exclusively available via{" "}
                <span className="font-bold text-amber-600">Premium Access</span>
                .
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
