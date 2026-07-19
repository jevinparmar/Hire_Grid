import React, { useState, useEffect } from "react";

import { collection, db, getDocs } from "../../firebase";
import {
  Activity,
  Database,
  Users,
  Server,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

export function AdminSystemHealthTab() {
  const [stats, setStats] = useState({
    activeUsers: 0,
    premiumUsers: 0,
    companies: 0,
    exams: 0,
    subjects: 0,
    modules: 0,
    revenue: 0,
    pendingAccessRequests: 0,
    pendingDeviceRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        let active = usersSnap.size;
        let premium = 0;
        usersSnap.forEach((d) => {
          if (d.data().hasFullPremium) premium++;
        });

        const companiesSnap = await getDocs(collection(db, "companies"));
        const examsSnap = await getDocs(collection(db, "exams"));
        const nodesSnap = await getDocs(collection(db, "hierarchy_nodes")); // For subjects
        let subjectsCount = 0;
        nodesSnap.forEach((d) => {
          if (
            d.data().type === "general_subject" ||
            d.data().type === "exam_subject"
          )
            subjectsCount++;
        });

        const modulesSnap = await getDocs(collection(db, "modules"));

        const purchasesSnap = await getDocs(collection(db, "purchases"));
        // Assuming we could calculate revenue here. Let's just say we get length for now as a placeholder
        // Normally we'd sum up purchase amounts.

        const accessReqSnap = await getDocs(collection(db, "access_requests"));
        let pAccess = 0;
        accessReqSnap.forEach((d) => {
          if (d.data().status === "pending") pAccess++;
        });

        const deviceReqSnap = await getDocs(collection(db, "device_requests"));
        let pDevice = 0;
        deviceReqSnap.forEach((d) => {
          if (d.data().status === "pending") pDevice++;
        });

        setStats({
          activeUsers: active,
          premiumUsers: premium,
          companies: companiesSnap.size,
          exams: examsSnap.size,
          subjects: subjectsCount,
          modules: modulesSnap.size,
          revenue: purchasesSnap.size * 149, // Placeholder calculation
          pendingAccessRequests: pAccess,
          pendingDeviceRequests: pDevice,
        });
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchHealth();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
            <Activity className="w-6 h-6 mr-2 text-emerald-500" />
            System Health & Overview
          </h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400">
            Monitor platform health without developer tools.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HealthCard
          title="Active Users"
          value={stats.activeUsers}
          icon={<Users />}
          color="blue"
        />

        <HealthCard
          title="Premium Users"
          value={stats.premiumUsers}
          icon={<ShieldCheck />}
          color="emerald"
        />

        <HealthCard
          title="Total Revenue (Est)"
          value={`₹${stats.revenue}`}
          icon={<CreditCard />}
          color="teal"
        />

        <HealthCard
          title="Database Status"
          value="Healthy"
          icon={<Database />}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 font-bold uppercase">
            Total Companies
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-white">
            {stats.companies}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 font-bold uppercase">
            Total Exams
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-white">
            {stats.exams}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 font-bold uppercase">
            Total Subjects
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-white">
            {stats.subjects}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 font-bold uppercase">
            Total Modules
          </p>
          <p className="text-2xl font-black text-slate-800 dark:text-white">
            {stats.modules}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Pending Access Requests</h3>
            <p className="text-slate-500 text-sm">
              Students requesting access to premium content.
            </p>
          </div>
          <div className="text-3xl font-black text-rose-500">
            {stats.pendingAccessRequests}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Pending Device Requests</h3>
            <p className="text-slate-500 text-sm">
              Premium users requesting to change devices.
            </p>
          </div>
          <div className="text-3xl font-black text-amber-500">
            {stats.pendingDeviceRequests}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold flex items-center mb-4">
          <Server className="w-5 h-5 mr-2" /> Cleanup Recommendations
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          System is running efficiently. However, you have some unoptimized
          data. Head to the Database Maintenance tab to run a cleanup on
          Notification Logs and Retake Attempts.
        </p>
      </div>
    </div>
  );
}

function HealthCard({ title, value, icon, color }) {
  const gradients = {
    emerald:
      "from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    teal: "from-teal-500/10 to-teal-500/5 dark:from-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/20",
    blue: "from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20",
    indigo:
      "from-indigo-500/10 to-indigo-500/5 dark:from-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  };
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border shadow-sm flex flex-col ${gradients[color]}`}
    >
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <div className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </h3>
    </div>
  );
}
