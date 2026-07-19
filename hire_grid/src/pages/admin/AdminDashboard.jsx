import React, { useState, useEffect } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  LogOut,
  Users,
  Settings,
  Server,
  IndianRupee,
  Menu,
  ChevronRight,
} from "lucide-react";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import { AdminUsersTab } from "../../components/admin/AdminUsersTab";
import { AdminSettingsTab } from "../../components/admin/AdminSettingsTab";
import { AdminPaymentRequestsTab } from "../../components/admin/AdminPaymentRequestsTab";
import { AdminDeviceRequestsTab } from "../../components/admin/AdminDeviceRequestsTab";

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = location.state?.role;
  const userName = location.state?.name || "Admin";

  const [activeWorkspace, setActiveWorkspace] = useState("premium");
  const [activeSubTab, setActiveSubTab] = useState("requests");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("adminSidebarOpen");
    return saved !== null ? JSON.parse(saved) : window.innerWidth >= 768;
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("adminSidebarOpen", JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  if (role !== "admin") {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = () => {
    navigate("/");
  };

  const setView = (workspace, subtab = "") => {
    setActiveWorkspace(workspace);
    setActiveSubTab(subtab);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-100 flex overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`bg-white dark:bg-slate-900 border-r border-emerald-500/20 flex flex-col transition-all duration-300 z-50 shrink-0
        fixed md:relative inset-y-0 left-0 h-full
        ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0 w-72 md:w-20"}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-500/20 shrink-0">
          <div
            className={`flex items-center ${!sidebarOpen ? "hidden md:flex md:w-0 md:opacity-0 md:overflow-hidden" : ""}`}
          >
            <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <span className="ml-3 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 whitespace-nowrap">
              Command Center
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${!sidebarOpen ? "mx-auto" : ""}`}
          >
            <Menu className="w-5 h-5 pointer-events-auto" />
          </button>
        </div>

        {/* Sidebar Nav */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar px-3 space-y-2">
          <SidebarItem
            icon={<IndianRupee />}
            label="Purchase Requests"
            active={
              activeWorkspace === "premium" && activeSubTab === "requests"
            }
            onClick={() => setView("premium", "requests")}
            isOpen={sidebarOpen}
          />
          <SidebarItem
            icon={<Server />}
            label="Device Change Requests"
            active={
              activeWorkspace === "premium" &&
              activeSubTab === "device_requests"
            }
            onClick={() => setView("premium", "device_requests")}
            isOpen={sidebarOpen}
          />
          <SidebarItem
            icon={<Users />}
            label="User Management"
            active={
              activeWorkspace === "users" && activeSubTab === "management"
            }
            onClick={() => setView("users", "management")}
            isOpen={sidebarOpen}
          />
          <SidebarItem
            icon={<Settings />}
            label="Settings"
            active={activeWorkspace === "system" && activeSubTab === "settings"}
            onClick={() => setView("system", "settings")}
            isOpen={sidebarOpen}
          />
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-emerald-500/20 shrink-0">
          <div
            className={`flex items-center ${!sidebarOpen && "justify-center"} mb-4`}
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={`ml-3 ${!sidebarOpen && "hidden"}`}>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
                {userName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Super Admin
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors border border-rose-200 dark:border-rose-800/50 ${!sidebarOpen && "px-0"}`}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden max-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-emerald-500/20 flex items-center justify-between px-8 shrink-0 relative z-20">
          <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 mr-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="hidden sm:inline">Command Center</span>
            <ChevronRight className="w-4 h-4 hidden sm:block" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
              {activeWorkspace === "overview"
                ? "Business Overview"
                : activeWorkspace === "users"
                  ? "User Management"
                  : activeWorkspace}
            </span>
            {activeSubTab && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {activeSubTab}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0B1120] custom-scrollbar p-8">
          <div className="max-w-7xl mx-auto">
            {/* Render Workspaces dynamically */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeWorkspace === "premium" && activeSubTab === "requests" && (
                <AdminPaymentRequestsTab userName={userName} />
              )}
              {activeWorkspace === "premium" &&
                activeSubTab === "device_requests" && (
                  <AdminDeviceRequestsTab />
                )}
              {activeWorkspace === "users" && activeSubTab === "management" && (
                <AdminUsersTab
                  isSuperAdmin={location.state?.id === "super_admin"}
                  adminName={userName}
                />
              )}
              {activeWorkspace === "system" && activeSubTab === "settings" && (
                <AdminSettingsTab />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all group ${active ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"} ${!isOpen ? "justify-center px-0" : "px-4"}`}
      title={!isOpen ? label : undefined}
    >
      <span
        className={`${active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"}`}
      >
        {React.cloneElement(icon, { className: "w-4 h-4" })}
      </span>
      <span className={`ml-3 ${!isOpen && "hidden"}`}>{label}</span>
    </button>
  );
}
