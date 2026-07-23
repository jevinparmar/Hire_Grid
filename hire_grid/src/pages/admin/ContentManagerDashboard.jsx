import React, { useState } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, BookOpen, Server, MessageSquare } from "lucide-react";
import { AdminCompaniesTab } from "../../components/admin/AdminCompaniesTab";
import { HierarchyBuilder } from "../../components/admin/HierarchyBuilder";
import { AdminFeedbacksTab } from "../../components/admin/AdminFeedbacksTab";

export default function ContentManagerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = location.state?.role;
  const userName = location.state?.name || "Content Manager";

  const [activeTab, setActiveTab] = useState("company-modules");

  if (role !== "content_manager") {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-300 transition-colors">
      <nav className="glass-panel border-b border-emerald-500/20 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ShieldCheck className="h-8 w-8 text-indigo-500" />
              <span className="ml-2 text-xl font-bold text-slate-800 dark:text-white">
                Content Manager Portal
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
                {userName}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-slate-200 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 glass-panel hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-b border-emerald-500/20 mb-6 flex space-x-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("company-modules")}
          className={`flex items-center space-x-2 pb-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === "company-modules" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Company Modules</span>
        </button>
        <button
          onClick={() => setActiveTab("general-modules")}
          className={`flex items-center space-x-2 pb-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === "general-modules" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
        >
          <Server className="w-4 h-4" />
          <span>Learning</span>
        </button>
        <button
          onClick={() => setActiveTab("feedbacks")}
          className={`flex items-center space-x-2 pb-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === "feedbacks" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Feedbacks</span>
        </button>
      </div>

      <main className="max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
        {activeTab === "company-modules" ? (
          <AdminCompaniesTab isContentManager={true} userName={userName} />
        ) : activeTab === "general-modules" ? (
          <HierarchyBuilder isContentManager={true} userName={userName} />
        ) : (
          <AdminFeedbacksTab isContentManager={true} />
        )}
      </main>
    </div>
  );
}
