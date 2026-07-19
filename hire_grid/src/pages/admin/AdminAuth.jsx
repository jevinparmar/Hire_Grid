import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Terminal, User } from "lucide-react";
import { api } from "../../lib/api";

export default function AdminAuth() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", {
        email: email || "",
        password,
        isAdminLogin: true,
      });

      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));

      if (res.user.role === "content_manager") {
        navigate("/content-manager-dashboard", {
          state: {
            role: "content_manager",
            name: res.user.name,
            id: res.user.id,
          },
        });
      } else {
        navigate("/admin-dashboard", {
          state: {
            role: "admin",
            name: res.user.name,
            id: !email || email.trim() === "" ? "super_admin" : res.user.id,
          },
        });
      }
    } catch (err) {
      console.error(err);
      setError("ACCESS DENIED. INVALID CREDENTIALS.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-500 overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none bg-circuit-pattern opacity-10 animate-circuit" />
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 pointer-events-none z-0" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-medium text-emerald-500 hover:text-emerald-300 transition-colors mb-6 uppercase tracking-widest font-mono"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          ABORT SEQUENCE
        </Link>
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <ShieldAlert
              className="h-8 w-8 text-red-500 animate-pulse"
              strokeWidth={2}
            />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black tracking-widest uppercase text-slate-900 dark:text-white drop-shadow-lg">
          System Access
        </h2>
        <p className="mt-2 text-center text-sm font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          STAFF CLEARANCE REQUIRED
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="glass-panel py-8 px-4 sm:rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800 shadow-[0_0_40px_rgba(0,0,0,0.05)] dark:shadow-[0_0_40px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <form className="space-y-6" onSubmit={handleEmailSignIn}>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-500/50 text-sm font-mono text-red-400 text-center uppercase tracking-wider">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">
                Identification
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-emerald-500" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-colors sm:text-sm bg-white dark:bg-slate-900/60 text-slate-900 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-600 font-mono tracking-widest"
                  placeholder="USER.ID OR BLANK"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">
                Authorization Cipher
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Terminal className="h-4 w-4 text-emerald-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-colors sm:text-sm bg-white dark:bg-slate-900/60 text-slate-900 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-600 font-mono tracking-widest"
                  placeholder="AWAITING cipher..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 dark:text-slate-900 dark:bg-slate-100 dark:hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? "AUTHENTICATING..." : "AUTHORIZE"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
            <p className="text-[10px] text-center font-mono uppercase tracking-widest text-slate-500">
              Unlawful access will be logged to system telemetry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
