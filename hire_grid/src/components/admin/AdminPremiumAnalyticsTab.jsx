import React, { useState, useEffect } from "react";
import { OperationType, collection, db, handleFirestoreError, onSnapshot, orderBy, query } from "../../firebase";

import {
  BarChart,
  IndianRupee,
  Users,
  TrendingUp,
  Briefcase,
} from "lucide-react";

export function AdminPremiumAnalyticsTab() {
  const [purchases, setPurchases] = useState([]);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    const unsubPurchases = onSnapshot(
      query(collection(db, "purchases"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setPurchases(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "purchases"),
    );

    const unsubCompanies = onSnapshot(
      query(collection(db, "companies")),
      (snapshot) => {
        setCompanies(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "companies"),
    );

    return () => {
      unsubPurchases();
      unsubCompanies();
    };
  }, []);

  const premiumCompanies = companies.filter((c) => c.isPremium);

  const totalSales = purchases.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalPurchases = purchases.length;

  const companyStats = premiumCompanies
    .map((c) => {
      const companyPurchases = purchases.filter((p) => p.companyId === c.id);
      const revenue = companyPurchases.reduce(
        (sum, p) => sum + (p.price || 0),
        0,
      );
      return {
        ...c,
        salesCount: companyPurchases.length,
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const mostPopular = companyStats.length > 0 ? companyStats[0] : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
          <BarChart className="w-6 h-6 mr-2 text-emerald-500" />
          Premium Analytics
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Track revenue and purchase statistics for premium company packages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
            ₹{totalSales.toLocaleString()}
          </h3>
          <p className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Total Company Revenue
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
            {totalPurchases}
          </h3>
          <p className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Total Purchases
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1 truncate">
            {mostPopular ? mostPopular.name : "-"}
          </h3>
          <p className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Most Popular Package
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
            {premiumCompanies.length}
          </h3>
          <p className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Active Premium Packages
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">
            Individual Company Performance
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                  Company
                </th>
                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                  Price
                </th>
                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                  Subscribers
                </th>
                <th className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {companyStats.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No premium companies found. Create a premium company to
                    track sales.
                  </td>
                </tr>
              ) : (
                companyStats.map((cs) => (
                  <tr
                    key={cs.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {cs.logoUrl ? (
                          <img
                            src={cs.logoUrl}
                            alt={cs.name}
                            className="w-8 h-8 rounded object-contain bg-white border border-slate-200 p-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-500">
                            <Briefcase className="w-4 h-4" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {cs.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                      ₹{cs.price}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                      {cs.salesCount}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{cs.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
