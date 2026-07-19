import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  ArrowLeft,
  Building2,
  ImageIcon,
} from "lucide-react";
import { OperationType, collection, db, deleteDoc, doc, handleFirestoreError, onSnapshot, query, setDoc } from "../../firebase";

import { AdminModulesTab } from "./AdminModulesTab";
import { logAudit } from "../../auditLogger";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SortableList } from "../common/SortableList";

export function AdminCompaniesTab({
  isContentManager = false,
  userName = "Admin",
}) {
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [isPurchasable, setIsPurchasable] = useState(false);
  const [price, setPrice] = useState(99);
  const [sellType, setSellType] = useState("pack");
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "companies")),
      (snapshot) => {
        let fetchedCompanies = snapshot.docs.map((d) => {
          const data = d.data();
          let mappedAccess = data.accessType || "free";
          if (data.isPremium && !data.accessType) mappedAccess = "premium_only";
          return {
            id: d.id,
            ...data,
            accessType: mappedAccess,
            sellType: data.sellType || "pack",
          };
        });

        fetchedCompanies.sort((a, b) => {
          const orderA = a.displayOrder ?? 999999;
          const orderB = b.displayOrder ?? 999999;
          if (orderA !== orderB) return orderA - orderB;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });

        setCompanies(fetchedCompanies);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "companies"),
    );
    return () => unsub();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const MAX_SIZE = 400;
        if (width > height && width > MAX_SIZE) {
          height = Math.floor(height * (MAX_SIZE / width));
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = Math.floor(width * (MAX_SIZE / height));
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        setLogoUrl(canvas.toDataURL("image/jpeg", 0.8));
      };
      if (ev.target?.result) img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name) return;
    const companyId = editingCompanyId || crypto.randomUUID();
    const existing = companies.find((c) => c.id === editingCompanyId);

    try {
      let finalAccessType = "free";
      if (isPremium && isPurchasable) finalAccessType = "premium_purchasable";
      else if (isPremium) finalAccessType = "premium_only";
      else if (isPurchasable) finalAccessType = "purchasable_only";

      await setDoc(
        doc(db, "companies", companyId),
        JSON.parse(
          JSON.stringify({
            name,
            description,
            logoUrl,
            accessType: finalAccessType,
            isPremium,
            price: isPurchasable ? price : 0,
            sellType,
            displayOrder,
            createdAt: existing ? existing.createdAt : Date.now(),
          }),
        ),
      );

      if (isContentManager) {
        await logAudit(
          userName,
          `${editingCompanyId ? "Updated" : "Created"} Company: ${name}`,
        );
      }

      setIsCreating(false);
      setEditingCompanyId(null);
      setName("");
      setDescription("");
      setLogoUrl("");
      setIsPremium(false);
      setIsPurchasable(false);
      setPrice(99);
      setSellType("pack");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "companies");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const company = companies.find((c) => c.id === deleteId);
    try {
      await deleteDoc(doc(db, "companies", deleteId));
      if (isContentManager && company) {
        await logAudit(userName, `Deleted Company: ${company.name}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "companies");
    } finally {
      setDeleteId(null);
    }
  };

  const handleEdit = (c, e) => {
    e.stopPropagation();
    setIsCreating(true);
    setEditingCompanyId(c.id);
    setName(c.name);
    setDescription(c.description || "");
    setLogoUrl(c.logoUrl || "");
    const accType = c.accessType || (c.isPremium ? "premium_only" : "free");
    setIsPremium(["premium_only", "premium_purchasable"].includes(accType));
    setIsPurchasable(
      ["purchasable_only", "premium_purchasable"].includes(accType),
    );
    setPrice(c.price || 99);
    setSellType(c.sellType || "pack");
    setDisplayOrder(c.displayOrder || 0);
  };

  if (activeCompany) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setActiveCompany(null)}
          className="flex items-center text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Back to Companies
        </button>
        <div className="flex items-center space-x-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          {activeCompany.logoUrl ? (
            <img
              src={activeCompany.logoUrl}
              alt={activeCompany.name}
              className="w-16 h-16 object-contain rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building2 className="w-8 h-8" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {activeCompany.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="whitespace-pre-wrap">
                {activeCompany.description}
              </span>
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <AdminModulesTab
            moduleType="company"
            parentId={activeCompany.id}
            isContentManager={isContentManager}
            userName={userName}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Company-Wise Modules
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create company directories to organize specialized training modules.
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingCompanyId(null);
              setName("");
              setDescription("");
              setLogoUrl("");
              setIsPremium(false);
              setIsPurchasable(false);
              setPrice(99);
              setSellType("pack");
              setDisplayOrder(
                companies.length > 0
                  ? Math.max(...companies.map((c) => c.displayOrder || 0)) + 100
                  : 100,
              );
            }}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Add Company</span>
          </button>
        )}
      </div>
      {isCreating && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingCompanyId ? "Edit Company" : "New Company"}
            </h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Company Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Hitachi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Logo Upload
              </label>
              <div className="flex items-center space-x-4">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    className="w-10 h-10 object-contain bg-white rounded border border-slate-200"
                    alt="preview"
                  />
                )}
                <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 shadow-sm text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  <span>{logoUrl ? "Change Logo" : "Upload Logo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                placeholder="Description of the company... Provide formatted registration info here."
              />
            </div>

            <div className="space-y-4 md:col-span-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center mb-2">
                Access Settings
              </h4>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPremium"
                      checked={isPremium}
                      onChange={(e) => setIsPremium(e.target.checked)}
                      className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                    />

                    <label
                      htmlFor="isPremium"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Included In Premium
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPurchasable"
                      checked={isPurchasable}
                      onChange={(e) => setIsPurchasable(e.target.checked)}
                      className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                    />

                    <label
                      htmlFor="isPurchasable"
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
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                          min="0"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Display Order
            </label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="e.g. 100"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!name}
            className="w-full mt-4 flex justify-center items-center py-2.5 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            {editingCompanyId ? "Update Company" : "Save Company"}
          </button>
        </div>
      )}{" "}
      {!isCreating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <SortableList
            items={companies}
            collectionName="companies"
            onOrderChange={setCompanies}
            grid={true}
            disabled={!isContentManager}
            renderItem={(c) => (
              <div
                onClick={() => setActiveCompany(c)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center cursor-pointer hover:shadow-md hover:border-emerald-500 transition-all group h-full"
              >
                <div className="w-full flex justify-between mb-2">
                  <div>
                    {c.accessType === "demo" ? (
                      <span className="text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-1 rounded">
                        Demo
                      </span>
                    ) : c.accessType === "premium_only" ? (
                      <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded">
                        Premium
                      </span>
                    ) : c.accessType === "purchasable_only" ? (
                      <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded">
                        Purchasable - ₹{c.price}
                      </span>
                    ) : c.accessType === "premium_purchasable" ? (
                      <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-1 rounded">
                        Prem / Purch - ₹{c.price}
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                        Free
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1 z-10">
                    <button
                      onClick={(e) => handleEdit(c, e)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(c.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {c.logoUrl ? (
                  <img
                    src={c.logoUrl}
                    alt={c.name}
                    className="w-20 h-20 object-contain mb-4"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-100 dark:border-emerald-800/50">
                    <Building2 className="w-10 h-10" />
                  </div>
                )}
                <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                  {c.name}
                </h3>
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                  <span className="whitespace-pre-wrap">{c.description}</span>
                </p>

                <div className="mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage Modules{" "}
                  <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                </div>
              </div>
            )}
          />

          {companies.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              No companies added yet. Click "Add Company" to get started.
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Company"
        message="Delete this company? This will not automatically delete its nested modules."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
