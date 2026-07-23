import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Mail, Lock, User, ArrowLeft, Timer, CheckCircle, RefreshCw } from "lucide-react";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import { api } from "../../lib/api";

export default function StudentAuth() {
  const navigate = useNavigate();

  // Views: "auth" (login/signup), "verify-otp"
  const [view, setView] = useState("auth");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    branch: "",
    semester: "1",
  });

  // Verification states
  const [verificationEmail, setVerificationEmail] = useState("");
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const otpInputsRef = useRef([]);

  // Resend Cooldown Timer
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.role === "student") {
          navigate("/student-dashboard", { replace: true });
        }
      } catch (e) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  }, [navigate]);

  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const startVerificationFlow = (email) => {
    setVerificationEmail(email);
    setOtpValues(["", "", "", "", "", ""]);
    setResendCooldown(60);
    setView("verify-otp");
    alert("A verification OTP has been successfully sent to your email ID: " + email);
    setTimeout(() => {
      if (otpInputsRef.current[0]) otpInputsRef.current[0].focus();
    }, 100);
  };

  // OTP Digits Handling
  const handleOtpChange = (index, value) => {
    if (value !== "" && !/^[0-9]$/.test(value)) return;

    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);

    if (value !== "" && index < 5) {
      otpInputsRef.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && otpValues[index] === "" && index > 0) {
      otpInputsRef.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pasteData)) return;

    const digits = pasteData.split("");
    setOtpValues(digits);
    otpInputsRef.current[5].focus();
  };

  // Submit Login/Signup Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (isSignUp) {
        if (!formData.name || !formData.email || !formData.password || !formData.branch) {
          setError("All fields are required for sign up.");
          setLoading(false);
          return;
        }

        const res = await api.post("/auth/signup", {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          branch: formData.branch,
          semester: formData.semester,
          role: "student",
        });

        if (res.requiresVerification) {
          startVerificationFlow(res.email);
          setSuccessMessage(res.message);
        } else {
          localStorage.setItem("token", res.token);
          localStorage.setItem("user", JSON.stringify(res.user));
          navigate("/student-dashboard", { state: { user: res.user } });
        }
      } else {
        if (!formData.email || !formData.password) {
          setError("Email and password are required.");
          setLoading(false);
          return;
        }

        try {
          const res = await api.post("/auth/login", {
            email: formData.email,
            password: formData.password,
            isAdminLogin: false,
          });

          localStorage.setItem("token", res.token);
          localStorage.setItem("user", JSON.stringify(res.user));
          navigate("/student-dashboard", { state: { user: res.user } });
        } catch (err) {
          if (err.message.includes("verify your email")) {
            startVerificationFlow(formData.email);
            setSuccessMessage("Please verify your email address to continue.");
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP Code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otpValues.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit OTP code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/verify-otp", {
        email: verificationEmail,
        otp: otpCode,
      });

      setSuccessMessage("Email verified successfully! You can now log in.");
      setTimeout(() => {
        setView("auth");
        setIsSignUp(false);
        setError("");
        setSuccessMessage("");
        setFormData((prev) => ({ ...prev, email: verificationEmail, password: "" }));
      }, 2000);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await api.post("/auth/resend-otp", {
        email: verificationEmail,
      });

      alert("A new verification OTP has been successfully sent to your email ID: " + verificationEmail);
      setSuccessMessage(res.message || "A new OTP code has been sent.");
      setResendCooldown(60);
      setOtpValues(["", "", "", "", "", ""]);
      if (otpInputsRef.current[0]) otpInputsRef.current[0].focus();
    } catch (err) {
      setError(err.message || "Failed to resend OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-circuit-pattern animate-circuit flex flex-col font-sans overflow-hidden transition-colors text-slate-700 dark:text-slate-300 relative">
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 pointer-events-none z-0" />

      {/* Header Navigation */}
      <nav className="glass-panel px-4 md:px-8 py-4 flex justify-between items-center shadow-lg z-10 shrink-0 border-b border-emerald-500/20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-lime-300 font-bold text-xl shadow-[0_0_15px_rgba(4,120,87,0.8)] border border-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-xl md:text-2xl font-black eng-gradient-text tracking-widest uppercase hidden sm:block">
            ENGINEERING HUB
          </span>
        </div>
        <div className="flex items-center space-x-6">
          <span className="text-slate-600 dark:text-slate-400 font-medium hidden lg:block uppercase tracking-widest text-xs">
            Auth Protocol v2.7
          </span>
          <ThemeToggle />
          <Link
            to="/admin"
            className="text-slate-500/50 dark:text-slate-400/50 hover:text-emerald-500 dark:hover:text-emerald-400 font-medium text-sm tracking-wider transition-colors px-2"
          >
            श्री हरिवंश 💚
          </Link>
        </div>
      </nav>

      {/* Main Content Split */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-8 gap-8 overflow-y-auto relative z-10 items-center">
        {/* Left Column: Welcome */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-6 shrink-0 order-2 lg:order-1 pt-8 lg:pt-0 pl-0 lg:pl-12">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-slate-100 leading-tight uppercase tracking-widest drop-shadow-lg">
            Engineering
            <br />
            <span className="eng-gradient-text drop-shadow-[0_0_20px_rgba(4,120,87,0.8)]">
              Command Center
            </span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl font-medium tracking-wide max-w-lg">
            System initialization required. Authenticate to access simulation
            protocols, placement readiness modules, and your career data grid.
          </p>
        </div>

        {/* Right Column: Cards */}
        <div className="flex-1 flex items-center justify-center order-1 lg:order-2 w-full">
          <div className="glass-panel w-full max-w-[480px] rounded-2xl p-6 md:p-10 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl text-sm font-medium border border-rose-200 dark:border-rose-800 animate-pulse">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* VIEW 1: LOGIN / SIGNUP */}
            {view === "auth" && (
              <>
                <div className="mb-8 relative z-10 transition-colors">
                  <h2 className="text-2xl font-bold eng-gradient-text uppercase tracking-widest">
                    {isSignUp ? "Create Account" : "Operator Sign In"}
                  </h2>
                  <p className="text-emerald-400/80 mt-2 text-sm font-mono tracking-wider">
                    {isSignUp ? "Register system credentials..." : "Awaiting operator credentials..."}
                  </p>
                </div>

                <form className="space-y-4 md:space-y-5" onSubmit={handleSubmit}>
                  {isSignUp && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Full Name
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <User className="h-5 w-5 text-slate-400" />
                          </span>
                          <input
                            type="text"
                            name="name"
                            required
                            placeholder="Enter Your Name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-all dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Branch / Specialization
                        </label>
                        <input
                          type="text"
                          name="branch"
                          required
                          placeholder="e.g. Computer Science"
                          value={formData.branch}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-all dark:text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Semester
                        </label>
                        <select
                          name="semester"
                          value={formData.semester}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-all dark:text-white"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                            <option key={s} value={s.toString()}>
                              Semester {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <Mail className="h-5 w-5 text-slate-400" />
                      </span>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="abc@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-all dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Security Passphrase
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <Lock className="h-5 w-5 text-slate-400" />
                      </span>
                      <input
                        type="password"
                        name="password"
                        required
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-all dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-eng-primary w-full py-4 mt-4 text-lg uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        PROCESSING...
                      </>
                    ) : isSignUp ? (
                      "INITIALIZE ACCOUNT"
                    ) : (
                      "AUTHENTICATE"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError("");
                      setSuccessMessage("");
                    }}
                    className="w-full text-center mt-4 text-emerald-500 dark:text-emerald-400 font-mono text-sm hover:underline"
                  >
                    {isSignUp ? "Already have an operator profile? Sign In" : "Need an operator account? Sign Up"}
                  </button>
                </form>
              </>
            )}

            {/* VIEW 2: OTP VERIFICATION */}
            {view === "verify-otp" && (
              <>
                <div className="mb-8 relative z-10">
                  <button
                    onClick={() => {
                      setView("auth");
                      setError("");
                      setSuccessMessage("");
                    }}
                    className="flex items-center text-xs font-mono text-emerald-500 hover:text-emerald-400 uppercase tracking-widest mb-4"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </button>
                  <h2 className="text-2xl font-bold eng-gradient-text uppercase tracking-widest">
                    Enter Verification Code
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                    We sent a secure 6-digit verification OTP to:
                    <br />
                    <strong className="text-slate-900 dark:text-white font-mono break-all">{verificationEmail}</strong>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* OTP Digit Boxes */}
                  <div className="flex justify-between gap-2 md:gap-3" onPaste={handleOtpPaste}>
                    {otpValues.map((value, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength={1}
                        value={value}
                        ref={(el) => (otpInputsRef.current[idx] = el)}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-12 h-14 text-center text-xl font-bold font-mono bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-400 rounded-xl outline-none transition-colors dark:text-white"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-eng-primary w-full py-4 uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        VERIFYING...
                      </>
                    ) : (
                      "VERIFY & REGISTER"
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      disabled={loading || resendCooldown > 0}
                      onClick={handleResendOtp}
                      className="text-sm font-mono text-emerald-500 dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:hover:no-underline flex items-center justify-center mx-auto gap-2"
                    >
                      {resendCooldown > 0 ? (
                        <span>Resend OTP in ({resendCooldown}s)</span>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Resend OTP Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            <p className="mt-8 text-center text-slate-500 font-mono text-xs md:text-sm relative z-10 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2"></span>
              System active. Connection secure.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="glass-panel px-4 md:px-8 py-3 flex justify-between text-xs font-mono font-medium shrink-0 relative z-10 border-t border-emerald-500/20 text-emerald-400">
        <span>[SYS.VER 2.7.0] © ENGINEERING HUB</span>
        <span className="flex items-center">
          <span className="w-2 h-2 bg-lime-400 rounded-full mr-2"></span> ONLINE
        </span>
      </footer>
    </div>
  );
}
