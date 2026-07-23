import React, { useState, useEffect } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import {
  Menu,
  LogOut,
  BookOpen,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  ArrowLeft,
  XCircle,
  FileText,
  Timer,
  Flag,
  Flame,
  Zap,
  Award,
  Bell,
  Building2,
  Info,
  ShieldCheck,
  Lock,
  MessageSquare,
} from "lucide-react";
import { ThemeToggle } from "../../components/common/ThemeToggle";
import { PremiumPurchaseView } from "../../components/student/PremiumPurchaseView";
import { SvgDiagram } from "../../components/common/SvgDiagram";
import { StudentHierarchyView } from "../../components/student/StudentHierarchyView";
import { hasAccess } from "../../lib/accessControl";
import { api } from "../../lib/api";
import { OperationType, auth, collection, db, doc, getDocs, handleFirestoreError, limit, logOut, onSnapshot, orderBy, query, setDoc, where, writeBatch } from "../../firebase";

import { MathText } from "../../components/common/MathText";

export default function StudentDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = location.state?.user || {
    email: auth.currentUser?.email || "",
    name: auth.currentUser?.displayName || "",
    role: "student",
  };

  if (!auth.currentUser) {
    return <Navigate to="/" replace />;
  }

  const [modules, setModules] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [exams, setExams] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeModule, setActiveModule] = useState(null);
  const [activeMasterModule, setActiveMasterModule] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [moduleScores, setModuleScores] = useState({});

  const [stats, setStats] = useState({
    xp: 0,
    streak: 3,
    categoryXP: {},
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [earnedXP, setEarnedXP] = useState(0);
  const [currentUserDoc, setCurrentUserDoc] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Layout Tabs
  const [activeTab, setActiveTab] = useState("general");
  const [activeCompany, setActiveCompany] = useState(null);
  const [activeExam, setActiveExam] = useState(null);
  const [purchaseItem, setPurchaseItem] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("studentSidebarOpen");
    return saved !== null ? JSON.parse(saved) : window.innerWidth >= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  useEffect(() => {
    if (currentUserDoc) {
      if (currentUserDoc.hasFullPremium) {
        const currentDeviceId = localStorage.getItem("eng_device_id");
        if (
          currentUserDoc.deviceId &&
          currentUserDoc.deviceId !== currentDeviceId
        ) {
          setDeviceBlocked(true);
        } else {
          setDeviceBlocked(false);
        }
      }
    }
  }, [currentUserDoc]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem("studentSidebarOpen", JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setActiveModule(null);
    setActiveMasterModule(null);
    setActiveCompany(null);
    setActiveExam(null);
    setPurchaseItem(null);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const hasItemAccess = (item, type, hierarchyPath) => {
    let path = hierarchyPath || [];
    if (path.length === 0) {
      if (
        type === "module" &&
        activeCompany &&
        item.parentId === activeCompany.id
      ) {
        path = [{ node: activeCompany, type: "company" }];
      } else if (
        type === "module" &&
        activeExam &&
        item.parentId === activeExam.id
      ) {
        path = [{ node: activeExam, type: "exam" }];
      }
    }
    return hasAccess(item, type, currentUserDoc, path);
  };

  const hasAccessToCompany = (company) => hasItemAccess(company, "company");

  const [accessRequestSent, setAccessRequestSent] = useState({});

  const submitAccessRequest = async (item, type) => {
    if (!currentUserDoc) return;
    try {
      const reqId = crypto.randomUUID();
      await setDoc(doc(db, "access_requests", reqId), {
        id: reqId,
        userId: currentUserDoc.id,
        userName: currentUserDoc.name || currentUserDoc.email,
        userEmail: currentUserDoc.email,
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

  const handleCompanyClick = (c) => {
    setActiveCompany(c);
    setPurchaseItem(null);
  };

  // Removes handlePurchase

  // Profile Modal
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Leaderboard Category
  const [lbCategory, setLbCategory] = useState("general");
  const [lbContextId, setLbContextId] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: user.name || "",
    branch: user.branch || "",
    semester: user.semester || "",
    collegeName: user.collegeName || "",
    universityName: user.universityName || "",
    graduationYear: user.graduationYear || "",
  });

  const getMedalTier = (xp) => {
    const tiers = [
      {
        name: "Bronze",
        min: 0,
        max: 1000,
        color: "text-orange-700 dark:text-orange-500",
        barFrom: "from-orange-600",
        barTo: "to-amber-500",
      },
      {
        name: "Silver",
        min: 1000,
        max: 2500,
        color: "text-slate-400",
        barFrom: "from-slate-400",
        barTo: "to-slate-300",
      },
      {
        name: "Gold",
        min: 2500,
        max: 4500,
        color: "text-amber-400",
        barFrom: "from-amber-500",
        barTo: "to-yellow-300",
      },
      {
        name: "Platinum",
        min: 4500,
        max: 7500,
        color: "text-teal-400",
        barFrom: "from-teal-500",
        barTo: "to-emerald-400",
      },
      {
        name: "Diamond",
        min: 7500,
        max: 12000,
        color: "text-cyan-400",
        barFrom: "from-emerald-500",
        barTo: "to-cyan-400",
      },
      {
        name: "Crown",
        min: 12000,
        max: 18000,
        color: "text-amber-200",
        barFrom: "from-amber-200",
        barTo: "to-orange-300",
      },
      {
        name: "Ace",
        min: 18000,
        max: 25000,
        color: "text-red-500",
        barFrom: "from-red-600",
        barTo: "to-rose-400",
      },
      {
        name: "Conqueror",
        min: 25000,
        max: Infinity,
        color: "text-rose-500",
        barFrom: "from-fuchsia-600",
        barTo: "to-rose-500",
      },
    ];
    const tier =
      tiers
        .slice()
        .reverse()
        .find((t) => xp >= t.min) || tiers[0];

    let subTier = "";
    let tierRange = tier.max - tier.min;

    if (
      ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Crown"].includes(
        tier.name,
      )
    ) {
      const subdiv = tierRange / 5;
      const progress = xp - tier.min;
      const step = 4 - Math.floor(Math.min(progress, tierRange - 1) / subdiv); // V down to I
      const roman = ["I", "II", "III", "IV", "V"];
      subTier = " " + roman[step];
    }

    const maxVal = tier.max === Infinity ? xp : tier.max;
    const percentage =
      tier.max === Infinity ? 100 : ((xp - tier.min) / tierRange) * 100;

    return { ...tier, fullName: tier.name + subTier, maxVal, percentage };
  };

  const getEliteFlair = (rank) => {
    switch (rank) {
      case 1:
        return {
          text: "S1 Grandmaster",
          style:
            "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm border-none",
        };
      case 2:
        return {
          text: "S1 Master",
          style:
            "bg-gradient-to-r from-purple-500 to-emerald-500 text-white shadow-sm border-none",
        };
      case 3:
        return {
          text: "S1 Diamond",
          style:
            "bg-gradient-to-r from-emerald-400 to-cyan-500 text-white shadow-sm border-none",
        };
      case 4:
        return {
          text: "S1 Platinum",
          style:
            "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-300 dark:border-teal-700",
        };
      case 5:
        return {
          text: "S1 Gold",
          style:
            "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
        };
      default:
        return null;
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    // Subscribe to notifications
    const notifQuery = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const unsubNotif = onSnapshot(notifQuery, (snapshot) => {
      const notifs = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      setNotifications(notifs);
    });

    return () => unsubNotif();
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Subscribe to leaderboard
    const lbQuery = query(
      collection(db, "users"),
      orderBy("xp", "desc"),
      limit(200),
    );
    const unsubLb = onSnapshot(
      lbQuery,
      (snapshot) => {
        const lb = [];
        let foundUser = false;
        snapshot.docs.forEach((docSnap, idx) => {
          const u = docSnap.data();
          const isUser = docSnap.id === auth.currentUser?.uid;
          if (isUser) foundUser = true;
          const pseudoScore = Math.min(
            100,
            Math.floor(80 + ((u.xp || 0) % 20)),
          );
          const pseudoAccuracy = Math.min(
            100,
            Math.floor(75 + ((u.xp || 0) % 25)),
          );
          const pseudoMovement = ((idx + (u.xp || 0)) % 5) - 2; // -2 to 2
          lb.push({
            id: docSnap.id,
            name: u.name || (u.email ? u.email.split("@")[0] : "Student"),
            photoURL: u.photoURL,
            branch: u.branch || "",
            rank: idx + 1,
            xp: u.xp || 0,
            categoryXP: u.categoryXP || {},
            streak: u.streak || Math.floor(Math.random() * 5 + 1),
            score: pseudoScore,
            accuracy: pseudoAccuracy,
            movement: pseudoMovement,
            isUser,
          });
        });
        if (!foundUser && auth.currentUser) {
          lb.push({
            id: auth.currentUser.uid,
            name: user.name || "You",
            photoURL: "",
            branch: profileForm.branch,
            rank: lb.length + 1,
            xp: stats.xp,
            categoryXP: stats.categoryXP,
            streak: stats.streak,
            score: 85,
            accuracy: 90,
            movement: 0,
            isUser: true,
          });
        }
        setLeaderboard(lb);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "users"),
    );

    // Subscribe to modules
    const unsubMods = onSnapshot(
      query(collection(db, "modules"), orderBy("createdAt", "asc")),
      (snapshot) => {
        const mods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setModules(mods);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "modules"),
    );

    // Subscribe to companies
    const unsubCompanies = onSnapshot(
      collection(db, "companies"),
      (snapshot) => {
        setCompanies(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "companies"),
    );

    // Subscribe to exams
    const unsubExams = onSnapshot(
      collection(db, "exams"),
      (snapshot) => {
        setExams(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "exams"),
    );

    // Subscribe to user stats
    const unsubUser = onSnapshot(
      doc(db, "users", auth.currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setCurrentUserDoc({ id: docSnap.id, ...d });
          setStats({
            xp: d.xp || 0,
            streak: d.streak || 3,
            categoryXP: d.categoryXP || {},
          });
          setProfileForm((prev) => ({
            ...prev,
            name: d.name || prev.name,
            branch: d.branch || prev.branch,
            semester: d.semester || prev.semester,
            collegeName: d.collegeName || prev.collegeName,
            universityName: d.universityName || prev.universityName,
            graduationYear: d.graduationYear || prev.graduationYear,
          }));
          if (d.role !== "student" && d.role !== "admin") {
            // just in case
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, "users"),
    );

    return () => {
      unsubLb();
      unsubMods();
      unsubCompanies();
      unsubExams();
      unsubUser();
    };
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    // We fetch user's scores
    if (!auth.currentUser) return;
    const fetchScores = async () => {
      const q = query(collection(db, "scores"));
      try {
        const snapshot = await getDocs(q);
        const scoresObj = {};
        snapshot.docs.forEach((docSnap) => {
          const s = docSnap.data();
          if (s.studentId === auth.currentUser?.uid) {
            if (!scoresObj[s.moduleId] || scoresObj[s.moduleId] < s.score) {
              scoresObj[s.moduleId] = s.score;
            }
          }
        });
        setModuleScores(scoresObj);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "scores");
      }
    };
    fetchScores();
  }, [activeModule]);

  useEffect(() => {
    if (
      !activeModule ||
      isFinished ||
      isReviewing ||
      timeLeft === null ||
      currentQuestionIndex === -1
    )
      return;
    if (timeLeft <= 0) {
      handleFinishTest();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, activeModule, isFinished, isReviewing, currentQuestionIndex]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!user || user.role !== "student") {
    return <Navigate to="/" replace />;
  }

  const handleStartModule = async (mod, path) => {
    if (!hasItemAccess(mod, "module", path)) {
      alert("Access Denied. You do not have permission to view this content.");
      return;
    }

    if (mod.isMaster) {
      setActiveMasterModule(mod);
    } else {
      try {
        const res = await api.get(`/modules/${mod.id}/questions`);
        const fetchedQuestions = res.questions || [];
        const fullModuleObj = { ...mod, questions: fetchedQuestions };
        setActiveModule(fullModuleObj);
        setCurrentQuestionIndex(-1);
        setAnswers({});
        setMarkedForReview({});
        setIsFinished(false);
        setIsReviewing(false);
        setTimeLeft((mod.timeLimit || 30) * 60);
      } catch (err) {
        alert("Failed to load questions: " + err.message);
      }
    }
  };

  const handleStartActualTest = () => {
    setCurrentQuestionIndex(0);
  };

  const handleSelectOption = (index) => {
    if (!activeModule) return;
    const currentQ = activeModule.questions[currentQuestionIndex];
    setAnswers((prev) => ({ ...prev, [currentQ.id]: index }));
  };

  const handleFinishTest = async () => {
    if (!activeModule || !auth.currentUser) return;
    setIsFinished(true);
    let finalScore = 0;
    let correctCount = 0;
    // Default module marking
    const modPositive =
      activeModule.marksPerQuestion !== undefined
        ? Number(activeModule.marksPerQuestion)
        : 1;
    const modNegative =
      activeModule.negativeMarks !== undefined
        ? Number(activeModule.negativeMarks)
        : 0.5;
    // Calculate max possible score if not explicitly set
    let maxPossibleScore = Number(activeModule.totalMarks) || 0;
    if (!maxPossibleScore) {
      activeModule.questions.forEach((q) => {
        maxPossibleScore +=
          q.positiveMarksOverride !== undefined
            ? Number(q.positiveMarksOverride)
            : modPositive;
      });
    }

    activeModule.questions.forEach((q) => {
      const qPos =
        q.positiveMarksOverride !== undefined
          ? Number(q.positiveMarksOverride)
          : modPositive;
      const qNeg =
        q.negativeMarksOverride !== undefined
          ? Number(q.negativeMarksOverride)
          : modNegative;

      if (answers[q.id] === q.correctAnswerIndex) {
        finalScore += qPos;
        correctCount += 1;
      } else if (answers[q.id] !== undefined) {
        finalScore -= qNeg;
      }
    });

    finalScore = Math.max(0, finalScore); // Avoid negative total score globally? Requirements say: Score = (Correct * Pos) - (Wrong * Neg). Typically can be negative, but let's clamp at 0 for generic.
    // Wait, the new requirement says Percentage is stored. We store percentage separately.
    const rawPercentage =
      maxPossibleScore > 0 ? (finalScore / maxPossibleScore) * 100 : 0;
    const percentage = Math.round(rawPercentage);
    const accuracy = Math.round(
      (correctCount / activeModule.questions.length) * 100,
    );

    const newScores = {
      ...moduleScores,
      [activeModule.id]: Math.max(
        percentage,
        moduleScores[activeModule.id] || 0,
      ),
    };

    // XP Calculation
    const isPassed = percentage >= (activeModule.passPercentage || 60);
    let gainedXP = 0;
    const isFirstTime = moduleScores[activeModule.id] === undefined;

    try {
      const batch = writeBatch(db);

      const scoreId = `${auth.currentUser.uid}_${activeModule.id}_${Date.now()}`;
      batch.set(doc(db, "scores", scoreId), {
        moduleId: activeModule.id,
        studentId: auth.currentUser.uid,
        score: finalScore,
        percentage: percentage,
        accuracy: accuracy,
        createdAt: Date.now(),
        isRetake: !isFirstTime,
      });

      // Earn XP strictly on the first attempt
      if (isFirstTime) {
        // Leaderboard must use Final Calculated Score.
        gainedXP = finalScore; // Replace magic XP formula with actual score
        const newXP = stats.xp + finalScore;

        // Calculate Category XP (Score)
        const newCategoryXP = { ...stats.categoryXP };
        const type = activeModule.moduleType || "general";

        if (type === "general") {
          newCategoryXP.general = (newCategoryXP.general || 0) + finalScore;
        } else if (type === "company" && activeModule.parentId) {
          if (!newCategoryXP.companies) newCategoryXP.companies = {};
          newCategoryXP.companies[activeModule.parentId] =
            (newCategoryXP.companies[activeModule.parentId] || 0) + finalScore;
        } else if (type === "exam" && activeModule.parentId) {
          if (!newCategoryXP.exams) newCategoryXP.exams = {};
          newCategoryXP.exams[activeModule.parentId] =
            (newCategoryXP.exams[activeModule.parentId] || 0) + finalScore;
        }

        const currentUserSnap = await getDocs(
          query(
            collection(db, "users"),
            where("__name__", "==", auth.currentUser.uid),
          ),
        );
        let userData = {};
        if (!currentUserSnap.empty) {
          userData = currentUserSnap.docs[0].data();
        }

        const testsTaken = (userData.firstAttemptTestsTaken || 0) + 1;
        const totalPercentage =
          (userData.firstAttemptTotalPercentage || 0) + percentage;
        const totalAccuracy =
          (userData.firstAttemptTotalAccuracy || 0) + accuracy;

        batch.update(doc(db, "users", auth.currentUser.uid), {
          xp: newXP, // using xp field to store total score for easy sorting
          categoryXP: newCategoryXP,
          firstAttemptTotalScore: newXP,
          firstAttemptTestsTaken: testsTaken,
          firstAttemptTotalPercentage: totalPercentage,
          firstAttemptTotalAccuracy: totalAccuracy,
          updatedAt: Date.now(),
        });
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "scores/users");
    }

    setEarnedXP(gainedXP);
    setModuleScores(newScores);
  };

  const handleNextQuestion = () => {
    if (!activeModule) return;
    if (currentQuestionIndex < activeModule.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (!activeModule) return;
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const toggleReview = () => {
    if (!activeModule) return;
    const qId = activeModule.questions[currentQuestionIndex].id;
    setMarkedForReview((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleClearSelection = () => {
    if (!activeModule) return;
    const qId = activeModule.questions[currentQuestionIndex].id;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const calculateScore = () => {
    if (!activeModule) return 0;
    let score = 0;
    const modPositive =
      activeModule.marksPerQuestion !== undefined
        ? Number(activeModule.marksPerQuestion)
        : 1;
    const modNegative =
      activeModule.negativeMarks !== undefined
        ? Number(activeModule.negativeMarks)
        : 0.5;

    activeModule.questions.forEach((q) => {
      const qPos =
        q.positiveMarksOverride !== undefined
          ? Number(q.positiveMarksOverride)
          : modPositive;
      const qNeg =
        q.negativeMarksOverride !== undefined
          ? Number(q.negativeMarksOverride)
          : modNegative;

      if (answers[q.id] === q.correctAnswerIndex) {
        score += qPos;
      } else if (answers[q.id] !== undefined) {
        score -= qNeg;
      }
    });
    return Math.max(0, score);
  };

  const handleLogout = async () => {
    await logOut();
    navigate("/");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          name: profileForm.name,
          branch: profileForm.branch,
          semester: profileForm.semester,
          collegeName: profileForm.collegeName,
          universityName: profileForm.universityName,
          graduationYear: profileForm.graduationYear,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      setIsProfileOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    }
  };

  const branches = [
    "Computer Science",
    "Information Technology",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Civil Engineering",
    "Electronics & Communication",
    "Chemical Engineering",
    "Aerospace Engineering",
    "Automobile Engineering",
    "Biotechnology",
    "Other",
  ];

  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.xp - a.xp);
  const userRank = sortedLeaderboard.findIndex((u) => u.isUser) + 1;
  const userFlair =
    userRank > 0 && userRank <= 5 ? getEliteFlair(userRank) : null;

  if (deviceBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans p-6 text-center z-50 relative">
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
          <Lock className="w-16 h-16 text-amber-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Device Blocked
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium mb-8">
            Your premium account is currently registered to another device. For
            security reasons, premium accounts are limited to one active device.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => {
                logOut();
                navigate("/");
              }}
              className="w-full py-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl uppercase tracking-widest transition-colors"
            >
              Sign Out
            </button>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 font-bold uppercase tracking-wider">
              Please sign in again to request a device change.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans transition-colors text-slate-700 dark:text-slate-300 relative overflow-hidden flex">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-circuit-pattern opacity-10 animate-circuit" />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border-r border-emerald-500/20 flex flex-col transition-all duration-300 z-50 shrink-0
        fixed md:relative inset-y-0 left-0 h-full
        ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0 w-72 md:w-20"}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b border-emerald-500/20 shrink-0">
          <div
            className={`flex items-center flex-1 ${!sidebarOpen ? "hidden md:flex md:w-0 md:opacity-0 md:overflow-hidden" : ""}`}
          >
            <div className="shrink-0 w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-[0_0_10px_rgba(4,120,87,0.8)] border border-emerald-400">
              <Zap className="w-5 h-5 text-lime-300" />
            </div>
            <span className="ml-3 text-[15px] font-black uppercase tracking-widest eng-gradient-text transition-colors drop-shadow-md whitespace-nowrap">
              Command
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${!sidebarOpen ? "mx-auto" : ""}`}
          >
            <Menu className="w-5 h-5 pointer-events-auto" />
          </button>
        </div>

        {/* Sidebar Nav */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
          <SidebarItem
            icon={<BookOpen />}
            label="Learning"
            active={
              activeTab === "general" && !activeModule && !activeMasterModule
            }
            onClick={() => handleNavClick("general")}
            isOpen={sidebarOpen}
          />

          <SidebarItem
            icon={<Building2 />}
            label="Company-Specific Exams"
            active={
              activeTab === "companies" && !activeModule && !activeMasterModule
            }
            onClick={() => handleNavClick("companies")}
            isOpen={sidebarOpen}
          />

          <SidebarItem
            icon={<MessageSquare />}
            label="Send Feedback"
            active={
              activeTab === "feedback" && !activeModule && !activeMasterModule
            }
            onClick={() => handleNavClick("feedback")}
            isOpen={sidebarOpen}
          />
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-emerald-500/20 shrink-0">
          <button
            onClick={() => handleNavClick("profile")}
            className={`w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all group ${activeTab === "profile" ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-500/30" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent"} ${!sidebarOpen ? "justify-center px-0" : "px-4"}`}
            title={!sidebarOpen ? "Operator Profile" : undefined}
          >
            <span
              className={`${activeTab === "profile" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"}`}
            >
              <User className="w-5 h-5" />
            </span>
            <span
              className={`ml-3 font-semibold whitespace-nowrap ${!sidebarOpen && "hidden"}`}
            >
              Operator Profile
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-20 overflow-hidden max-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-emerald-500/20 flex items-center justify-between px-4 sm:px-8 shrink-0 relative z-20">
          <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 mr-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 capitalize hidden sm:inline">
              {activeTab === "general" ? "Current Mission" : activeTab}
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-full transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl shadow-xl border border-emerald-500/20 overflow-hidden z-50">
                  <div className="p-4 border-b border-emerald-500/20 bg-slate-100 dark:bg-slate-900/40">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">
                      Notifications
                    </h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className="p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-default"
                        >
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            {notif.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-2 block">
                            {new Date(notif.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-1.5 border border-emerald-500/20 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 glass-panel hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              title="Logout"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#0B1120]/50 p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            {activeMasterModule && !activeModule ? (
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
                <button
                  onClick={() => setActiveMasterModule(null)}
                  className="flex items-center text-sm font-bold text-slate-500 hover:text-emerald-800 dark:text-lime-400 transition-colors mb-6"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Back to Modules
                </button>
                <div className="glass-panel rounded-2xl p-8 border border-emerald-500/20 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-10"></div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-2 tracking-tight">
                    {activeMasterModule.title}
                  </h2>
                  <p className="text-emerald-400/80 font-medium text-lg leading-relaxed mb-8 whitespace-pre-wrap">
                    {activeMasterModule.description ||
                      "Complete all the sub-modules below."}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeMasterModule.subTests?.map((subTest) => {
                      const prevScore = moduleScores[subTest.id];
                      const hasCompleted = prevScore !== undefined;

                      return (
                        <div
                          key={subTest.id}
                          className="p-5 border-2 border-emerald-500/20 rounded-xl hover:border-emerald-400 transition-all bg-slate-100 dark:bg-slate-900/40 flex flex-col items-start group"
                        >
                          <h4 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-2 group-hover:text-emerald-800 dark:text-lime-400 transition-colors">
                            {subTest.title}
                          </h4>
                          <div className="text-sm font-medium text-slate-500 mb-6 flex items-center">
                            <BookOpen className="w-4 h-4 mr-1.5 opacity-70" />{" "}
                            {subTest.questions?.length || 0} Questions
                          </div>

                          <div className="w-full flex items-center justify-between mt-auto">
                            {hasCompleted ? (
                              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md">
                                Score: {prevScore}%
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 px-3 py-1 bg-slate-200 dark:bg-slate-700/50 rounded-md">
                                Not Started
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setActiveModule({
                                  ...subTest,
                                  timeLimit: 30, // Default or fetch from original module if we stored it
                                  passPercentage:
                                    activeMasterModule.passPercentage || 60,
                                  questions: subTest.questions || [],
                                  moduleType:
                                    activeMasterModule.moduleType || "general",
                                  parentId: activeMasterModule.parentId,
                                });
                                setCurrentQuestionIndex(0);
                                setAnswers({});
                                setMarkedForReview({});
                                setIsFinished(false);
                                setIsReviewing(false);
                                setTimeLeft(30 * 60);
                              }}
                              className="text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                            >
                              {hasCompleted ? "Retake" : "Start"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : !activeModule ? (
              <div className="w-full">
                {activeTab === "profile" && (
                  <div className="max-w-2xl mx-auto">
                    <div className="glass-panel rounded-2xl shadow-sm border border-emerald-500/20 overflow-hidden transition-colors relative">
                      {/* Visual Flair */}
                      <div className="absolute top-[-40px] right-[-40px] w-32 h-32 bg-emerald-500 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20"></div>
                      <div className="absolute bottom-[-40px] left-[-40px] w-32 h-32 bg-rose-500 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20"></div>

                      <div className="p-8 relative z-10">
                        <div className="flex flex-col items-center">
                          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 via-purple-500 to-rose-500 p-1 shadow-lg">
                            <div className="w-full h-full rounded-full glass-panel flex items-center justify-center text-slate-800 dark:text-white">
                              <User className="h-10 w-10 text-emerald-500" />
                            </div>
                          </div>
                          <h3 className="mt-4 text-center text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center justify-center space-x-2">
                            <span>{profileForm.name || "Unnamed Student"}</span>
                            {userFlair && (
                              <span
                                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${userFlair.style} relative bottom-1`}
                              >
                                {userFlair.text}
                              </span>
                            )}
                          </h3>
                          {(profileForm.branch || profileForm.semester) && (
                            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider text-center">
                              {profileForm.branch}{" "}
                              {profileForm.branch &&
                                profileForm.semester &&
                                "•"}{" "}
                              {profileForm.semester &&
                                `Sem ${profileForm.semester}`}
                            </p>
                          )}
                          <p
                            className={`inline-block mt-4 px-4 py-1.5 bg-gradient-to-r ${getMedalTier(stats.xp).barFrom} ${getMedalTier(stats.xp).barTo} text-white font-black rounded-full uppercase tracking-widest shadow-sm drop-shadow-md text-sm`}
                          >
                            {getMedalTier(stats.xp).fullName}
                          </p>
                        </div>

                        <div className="mt-10 space-y-6">
                          <div>
                            <div className="flex justify-between text-sm font-bold mb-2">
                              <span className="text-emerald-400/80">
                                Medal Progress
                              </span>
                              <span className="text-emerald-800 dark:text-lime-400">
                                {stats.xp} / {getMedalTier(stats.xp).maxVal} XP
                              </span>
                            </div>
                            <div className="h-4 w-full bg-emerald-100 dark:bg-emerald-900/40 rounded-full overflow-hidden border border-emerald-500/20">
                              <div
                                className={`h-full bg-gradient-to-r ${getMedalTier(stats.xp).barFrom} ${getMedalTier(stats.xp).barTo} rounded-full transition-all duration-1000`}
                                style={{
                                  width: `${getMedalTier(stats.xp).percentage}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex justify-center pt-6 border-t border-emerald-500/20">
                            <div className="bg-slate-100 dark:bg-slate-900/40 p-4 rounded-xl border border-emerald-500/20 flex flex-col items-center shadow-inner w-full max-w-[200px]">
                              <Flame className="w-8 h-8 text-orange-500 mb-2" />
                              <span className="text-2xl font-black text-slate-800 dark:text-white">
                                {stats.streak}
                              </span>
                              <span className="text-xs uppercase font-bold tracking-wider text-slate-500 text-center mt-1">
                                Day Streak
                              </span>
                            </div>
                          </div>

                          {/* Achievements Mockup */}
                          <div className="pt-6 border-t border-emerald-500/20">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">
                              Achievements Unlocked
                            </h4>
                            <div className="flex gap-4 flex-wrap justify-center">
                              <div className="group relative">
                                <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center border-2 border-amber-300 dark:border-amber-700 cursor-pointer transition-transform hover:scale-110 shadow-sm">
                                  <Zap className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="absolute top-16 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                  Fast Solver
                                </div>
                              </div>
                              {stats.streak > 5 && (
                                <div className="group relative">
                                  <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center border-2 border-rose-300 dark:border-rose-700 cursor-pointer transition-transform hover:scale-110 shadow-sm">
                                    <Flame className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                                  </div>
                                  <div className="absolute top-16 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    Streak Master
                                  </div>
                                </div>
                              )}
                              <div className="group relative">
                                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center border-2 border-emerald-300 dark:border-emerald-700 cursor-pointer transition-transform hover:scale-110 shadow-sm">
                                  <CheckCircle2 className="w-7 h-7 text-emerald-800 dark:text-lime-400" />
                                </div>
                                <div className="absolute top-16 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                  Accuracy King
                                </div>
                              </div>
                              {profileForm.branch && (
                                <div className="group relative">
                                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center border-2 border-emerald-300 dark:border-emerald-700 cursor-pointer transition-transform hover:scale-110 shadow-sm">
                                    <Award className="w-7 h-7 text-emerald-800 dark:text-lime-400" />
                                  </div>
                                  <div className="absolute top-16 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                    {profileForm.branch} Expert
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Purchased Companies */}
                          {((currentUserDoc?.purchasedCompanies &&
                            currentUserDoc.purchasedCompanies.length > 0) ||
                            currentUserDoc?.hasFullPremium) && (
                            <div className="pt-6 border-t border-emerald-500/20">
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">
                                My Purchased Companies
                              </h4>
                              {currentUserDoc?.hasFullPremium ? (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl text-center border border-emerald-100 dark:border-emerald-800 flex flex-col items-center">
                                  <ShieldCheck className="w-8 h-8 mb-2" />
                                  <h5 className="font-bold">
                                    Full Premium Subscription Active
                                  </h5>
                                  <p className="text-sm opacity-80 max-w-sm">
                                    You have complete access to all premium
                                    company packages and features.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex gap-4 flex-wrap justify-center">
                                  {companies
                                    .filter((c) =>
                                      currentUserDoc?.purchasedCompanies?.includes(
                                        c.id,
                                      ),
                                    )
                                    .map((c) => (
                                      <div
                                        key={c.id}
                                        className="flex flex-col items-center w-24"
                                      >
                                        <div className="w-14 h-14 rounded-xl glass-panel shadow-sm border border-emerald-500/20 flex items-center justify-center p-2 mb-2 relative">
                                          {c.logoUrl ? (
                                            <img
                                              src={c.logoUrl}
                                              alt={c.name}
                                              className="w-full h-full object-contain"
                                            />
                                          ) : (
                                            <Building2 className="w-6 h-6 text-emerald-800 dark:text-lime-400" />
                                          )}
                                          <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm border border-white dark:border-slate-800">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                          </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300 text-center truncate w-full">
                                          {c.name}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-6 text-center">
                            <button
                              onClick={() => setIsProfileOpen(true)}
                              className="px-6 py-2 bg-emerald-100 dark:bg-emerald-900/40 text-slate-800 dark:text-white text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm"
                            >
                              Edit Profile Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "feedback" && (
                  <div className="max-w-6xl mx-auto space-y-6">
                    <StudentFeedbackForm currentUser={currentUserDoc} />
                  </div>
                )}

                {activeTab === "general" && (
                  <div className="max-w-6xl mx-auto space-y-6">
                    <StudentHierarchyView
                      currentUser={currentUserDoc}
                      onOpenModule={handleStartModule}
                    />
                  </div>
                )}

                {activeTab === "companies" && (
                  <div className="max-w-6xl mx-auto space-y-6">
                    {purchaseItem?.type === "company" ? (
                      <PremiumPurchaseView
                        itemId={purchaseItem.item.id}
                        itemName={purchaseItem.item.name}
                        itemType="company"
                        price={purchaseItem.item.price || 99}
                        onBack={() => setPurchaseItem(null)}
                        currentUser={currentUserDoc}
                      />
                    ) : !activeCompany ? (
                      <div className="glass-panel rounded-2xl shadow-sm border border-emerald-500/20 p-6 sm:p-8 transition-colors">
                        <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center transition-colors">
                          <Building2 className="h-7 w-7 mr-3 text-emerald-800 dark:text-lime-400" />
                          Company-Wise Directory
                        </h4>
                        {companies.length === 0 ? (
                          <div className="text-center py-16 text-slate-500">
                            No companies available.
                          </div>
                        ) : (
                          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {companies.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => handleCompanyClick(c)}
                                className="bg-slate-100 dark:bg-slate-900/40 rounded-2xl p-6 shadow-sm border border-emerald-500/20 flex flex-col items-center justify-center text-center cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-emerald-500 transition-all group relative"
                              >
                                {!hasAccessToCompany(c) && (
                                  <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center shadow-sm">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Premium
                                  </div>
                                )}
                                {c.logoUrl ? (
                                  <img
                                    src={c.logoUrl}
                                    alt={c.name}
                                    className="w-20 h-20 object-contain mb-4"
                                  />
                                ) : (
                                  <div className="w-20 h-20 rounded-2xl glass-panel flex items-center justify-center shadow-sm text-emerald-800 dark:text-lime-400 mb-4 border border-emerald-500/20">
                                    <Building2 className="w-10 h-10" />
                                  </div>
                                )}
                                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-emerald-800 dark:text-lime-400 transition-colors">
                                  {c.name}
                                </h3>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="glass-panel rounded-2xl shadow-sm border border-emerald-500/20 p-6 sm:p-8 transition-colors">
                        <button
                          onClick={() => setActiveCompany(null)}
                          className="flex items-center text-sm font-bold text-slate-500 hover:text-emerald-800 dark:text-lime-400 transition-colors mb-6"
                        >
                          <ArrowLeft className="w-5 h-5 mr-1" />
                          Back to Directory
                        </button>
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 border-b border-slate-100 dark:border-slate-800 pb-8 mb-8">
                          {activeCompany.logoUrl ? (
                            <img
                              src={activeCompany.logoUrl}
                              alt={activeCompany.name}
                              className="w-32 h-32 object-contain rounded-2xl bg-slate-50 dark:bg-slate-900 border border-emerald-500/20 p-4 shrink-0 transition-transform hover:scale-105"
                            />
                          ) : (
                            <div className="w-32 h-32 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 dark:text-lime-400 shrink-0">
                              <Building2 className="w-16 h-16" />
                            </div>
                          )}
                          <div className="text-center md:text-left flex-1 w-full">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-4">
                              {activeCompany.name} Preparation
                            </h2>
                            {activeCompany.description && (
                              <div className="bg-slate-100 dark:bg-slate-900/40 p-6 rounded-2xl border border-emerald-500/20 text-left">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center text-lg">
                                  <Info className="w-5 h-5 mr-2 text-emerald-500" />
                                  About {activeCompany.name}
                                </h3>
                                <div className="text-emerald-400/80 whitespace-pre-wrap leading-relaxed text-sm font-medium">
                                  {activeCompany.description}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-6 flex items-center justify-between">
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xl flex items-center">
                            <BookOpen className="w-6 h-6 mr-2 text-emerald-500" />
                            Assessment Modules
                          </h3>
                        </div>

                        {!hasAccessToCompany(activeCompany) && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between shadow-sm mb-6">
                            <div className="flex items-center mb-4 sm:mb-0">
                              <Lock className="w-6 h-6 text-amber-500 shrink-0 mr-3" />
                              <div>
                                <h4 className="font-bold text-amber-800 dark:text-amber-400">
                                  Unlock {activeCompany.name}
                                </h4>
                                <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                                  Purchase this company to unlock all premium
                                  preparation modules inside.
                                </p>
                              </div>
                            </div>
                            {activeCompany.accessType ===
                            "access_request_only" ? (
                              <button
                                onClick={() =>
                                  submitAccessRequest(activeCompany, "company")
                                }
                                disabled={accessRequestSent[activeCompany.id]}
                                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm whitespace-nowrap"
                              >
                                {accessRequestSent[activeCompany.id]
                                  ? "Requested"
                                  : "Request Access"}
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  setPurchaseItem({
                                    item: activeCompany,
                                    type: "company",
                                  })
                                }
                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm whitespace-nowrap"
                              >
                                Unlock for ₹{activeCompany.price || 0}
                              </button>
                            )}
                          </div>
                        )}

                        <div className="grid gap-6 sm:grid-cols-2">
                          {modules
                            .filter(
                              (m) =>
                                m.moduleType === "company" &&
                                m.parentId === activeCompany.id,
                            )
                            .map((mod) => {
                              const prevScore = moduleScores[mod.id];
                              const hasCompleted = prevScore !== undefined;
                              const isPassed =
                                hasCompleted &&
                                prevScore >= (mod.passPercentage || 0);
                              const access = hasItemAccess(mod, "module");

                              return (
                                <div
                                  key={mod.id}
                                  className="group p-6 border border-emerald-500/20 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-md transition-all glass-panel flex flex-col relative overflow-hidden"
                                >
                                  {mod.accessMode === "custom" ? (
                                    mod.accessType &&
                                    mod.accessType !== "free" && (
                                      <div
                                        className={`absolute top-0 right-0 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-bl-lg z-10 flex items-center ${mod.accessType === "demo" ? "bg-indigo-500" : "bg-amber-500"}`}
                                      >
                                        {[
                                          "premium_only",
                                          "premium_purchasable",
                                        ].includes(mod.accessType) && (
                                          <Lock className="w-3 h-3 mr-1" />
                                        )}
                                        {mod.accessType === "premium_only"
                                          ? `Premium`
                                          : mod.accessType ===
                                              "purchasable_only"
                                            ? `Purchasable (₹${mod.price || 0})`
                                            : mod.accessType ===
                                                "premium_purchasable"
                                              ? `Prem/Purch (₹${mod.price || 0})`
                                              : "Demo"}
                                      </div>
                                    )
                                  ) : (
                                    <div className="absolute top-0 right-0 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-bl-lg z-10 flex items-center">
                                      Inherit Parent
                                    </div>
                                  )}
                                  <div className="flex justify-between items-start mb-2 gap-2 mt-2">
                                    <div className="flex flex-col">
                                      <h5 className="font-bold text-lg text-slate-900 dark:text-slate-100 transition-colors">
                                        {mod.title}
                                      </h5>
                                      <span className="text-xs font-bold text-emerald-500 dark:text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mt-1">
                                        {mod.category}
                                      </span>
                                    </div>
                                    {hasCompleted && (
                                      <span
                                        className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${isPassed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-700 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"}`}
                                      >
                                        {isPassed ? "Passed" : "Failed"} (
                                        {prevScore}%)
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-emerald-400/80 mb-6 flex-1 mt-2 leading-relaxed whitespace-pre-wrap">
                                    {mod.description}
                                  </p>
                                  <div className="flex flex-wrap gap-2 mb-6">
                                    <span className="text-xs font-medium px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-slate-700 dark:text-slate-300 rounded-lg flex items-center transition-colors">
                                      <FileText className="w-3.5 h-3.5 mr-1.5" />{" "}
                                      {mod.questions.length} Qs
                                    </span>
                                    <span className="text-xs font-medium px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center transition-colors">
                                      <Timer className="w-3.5 h-3.5 mr-1.5" />{" "}
                                      {mod.timeLimit || 30}m
                                    </span>
                                    <span className="text-xs font-medium px-2.5 py-1.5 bg-slate-50 dark:bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-700 dark:text-slate-300 rounded-lg flex items-center transition-colors">
                                      Pass: {mod.passPercentage || 60}%
                                    </span>
                                  </div>
                                  <div className="mt-auto border-t border-emerald-500/20 pt-4 flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-400">
                                      {hasCompleted
                                        ? "Retake assessment"
                                        : "Begin assessment"}
                                    </span>
                                    {access ? (
                                      <button
                                        onClick={() => handleStartModule(mod)}
                                        className="text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
                                      >
                                        {hasCompleted ? "Retake" : "Start Now"}{" "}
                                        <ChevronRight className="w-4 h-4 ml-1.5" />
                                      </button>
                                    ) : (mod.accessMode === "custom" &&
                                        mod.accessType ===
                                          "access_request_only") ||
                                      ((!mod.accessMode ||
                                        mod.accessMode === "inherit") &&
                                        activeCompany?.accessType ===
                                          "access_request_only") ? (
                                      <button
                                        onClick={() =>
                                          submitAccessRequest(mod, "module")
                                        }
                                        disabled={accessRequestSent[mod.id]}
                                        className="text-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
                                      >
                                        <Lock className="w-4 h-4 mr-1.5" />{" "}
                                        {accessRequestSent[mod.id]
                                          ? "Requested"
                                          : "Request Access"}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          if (
                                            !mod.accessMode ||
                                            mod.accessMode === "inherit"
                                          ) {
                                            setPurchaseItem({
                                              item: activeCompany,
                                              type: "company",
                                            });
                                          } else {
                                            setPurchaseItem({
                                              item: mod,
                                              type: "module",
                                            });
                                          }
                                        }}
                                        className="text-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
                                      >
                                        <Lock className="w-4 h-4 mr-1.5" />{" "}
                                        Unlock
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          {modules.filter(
                            (m) =>
                              m.moduleType === "company" &&
                              m.parentId === activeCompany.id,
                          ).length === 0 && (
                            <div className="col-span-full text-center py-12 text-slate-500 bg-slate-100 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                              Check back later. New preparation modules for{" "}
                              {activeCompany.name} are coming soon.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <button
                  onClick={() => setActiveModule(null)}
                  className="flex items-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors font-medium"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back to Modules
                </button>
                <div className="glass-panel rounded-2xl shadow-lg border border-emerald-500/20 p-6 md:p-10 transition-colors">
                  {isFinished ? (
                    isReviewing ? (
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                          Review Answers
                        </h2>
                        <div className="space-y-8">
                          {activeModule.questions.map((q, qIdx) => {
                            const userAnswer = answers[q.id];
                            const isCorrect =
                              userAnswer === q.correctAnswerIndex;
                            return (
                              <div
                                key={q.id}
                                className="p-6 rounded-xl border border-emerald-500/20 bg-slate-100 dark:bg-slate-900/40"
                              >
                                <div className="flex items-start">
                                  <div className="mt-1 mr-3 shrink-0">
                                    {isCorrect ? (
                                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    ) : (
                                      <XCircle className="w-6 h-6 text-rose-500" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-4">
                                      {qIdx + 1}.{" "}
                                      <MathText content={q.question} />
                                    </div>
                                    {q.image && (
                                      <SvgDiagram
                                        svgCode={q.image}
                                        className="max-h-48"
                                        containerClassName="mb-4"
                                      />
                                    )}
                                    <div className="space-y-2">
                                      {q.options.map((opt, optIdx) => {
                                        const isUserPick =
                                          userAnswer === optIdx;
                                        const isTrueCorrect =
                                          q.correctAnswerIndex === optIdx;
                                        let ring =
                                          "border-emerald-500/20 glass-panel text-emerald-400/80";
                                        if (isTrueCorrect)
                                          ring =
                                            "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 font-bold";
                                        else if (isUserPick)
                                          ring =
                                            "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300";

                                        return (
                                          <div
                                            key={optIdx}
                                            className={`px-4 py-3 rounded-lg border flex items-start ${ring}`}
                                          >
                                            <span className="mr-2 opacity-70 mt-1">
                                              {String.fromCharCode(65 + optIdx)}
                                              .
                                            </span>
                                            <div className="flex-1">
                                              {opt.startsWith("data:image/") ||
                                              opt.trim().startsWith("<svg") ? (
                                                <SvgDiagram
                                                  svgCode={opt}
                                                  className="max-h-24 w-auto object-contain"
                                                  containerClassName=""
                                                />
                                              ) : (
                                                <MathText content={opt} />
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {q.explanation && (
                                      <div className="mt-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                                          Explanation
                                        </p>
                                        <div className="text-sm text-indigo-900 dark:text-indigo-200">
                                          <MathText content={q.explanation} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-8 flex justify-center">
                          <button
                            onClick={() => setIsReviewing(false)}
                            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors"
                          >
                            Back to Result
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        {(() => {
                          const score = calculateScore();
                          const total = activeModule.questions.length;
                          const percentage = Math.round((score / total) * 100);
                          const isPassed =
                            percentage >= (activeModule.passPercentage || 60);

                          return (
                            <>
                              <div
                                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isPassed ? "bg-emerald-100 dark:bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-lime-400" : "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"}`}
                              >
                                {isPassed ? (
                                  <CheckCircle2 className="w-10 h-10" />
                                ) : (
                                  <XCircle className="w-10 h-10" />
                                )}
                              </div>
                              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                                Module Completed!
                              </h2>
                              <p className="text-emerald-400/80 mb-6 font-medium">
                                You scored {percentage}% (Requiring{" "}
                                {activeModule.passPercentage || 60}% to pass).
                              </p>

                              <div className="flex justify-center flex-wrap gap-4 mb-10">
                                <div className="bg-slate-50 dark:bg-slate-900 px-8 py-6 rounded-xl border border-emerald-500/20">
                                  <p className="text-sm text-emerald-400/80 uppercase tracking-widest font-bold mb-1">
                                    Your Score
                                  </p>
                                  <p
                                    className={`text-5xl font-black ${isPassed ? "text-emerald-800 dark:text-lime-400" : "text-rose-600 dark:text-rose-400"}`}
                                  >
                                    {score}{" "}
                                    <span className="text-2xl text-slate-400 border-l border-slate-300 dark:border-slate-600 pl-2 ml-1">
                                      / {total}
                                    </span>
                                  </p>
                                </div>

                                {isPassed && earnedXP > 0 && (
                                  <div className="bg-gradient-to-br from-emerald-500 via-purple-500 to-rose-500 px-8 py-6 rounded-xl border border-emerald-400 shadow-lg shadow-emerald-500/30 flex flex-col items-center justify-center text-white min-w-[160px]">
                                    <p className="text-sm uppercase tracking-widest font-bold mb-1 text-emerald-100">
                                      Earned XP
                                    </p>
                                    <div className="flex items-center text-5xl font-black">
                                      <Zap className="w-10 h-10 mr-2 text-amber-300 fill-current" />
                                      +{earnedXP}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-center space-x-4">
                                <button
                                  onClick={() => setIsReviewing(true)}
                                  className="px-6 py-3 glass-panel border-2 border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 font-bold rounded-xl transition-colors shadow-sm"
                                >
                                  Review Answers
                                </button>
                                <button
                                  onClick={() => setActiveModule(null)}
                                  className="px-6 py-3 btn-eng-primary font-bold rounded-xl shadow-md transition-colors"
                                >
                                  Return to Dashboard
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  ) : currentQuestionIndex === -1 ? (
                    <div className="text-center py-8">
                      <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-6">
                        {activeModule.title}
                      </h2>
                      {activeModule.description && (
                        <p className="text-emerald-500 font-medium mb-8 max-w-2xl mx-auto">
                          {activeModule.description}
                        </p>
                      )}
                      <div className="bg-slate-50 dark:bg-slate-900 border border-emerald-500/20 rounded-2xl p-6 mb-8 max-w-xl mx-auto grid grid-cols-2 gap-6">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Total Questions
                          </span>
                          <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
                            {activeModule.questions.length}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Total Marks
                          </span>
                          <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
                            {activeModule.totalMarks ||
                              activeModule.questions.reduce(
                                (sum, q) =>
                                  sum +
                                  (q.positiveMarksOverride !== undefined
                                    ? q.positiveMarksOverride
                                    : activeModule.marksPerQuestion || 1),
                                0,
                              )}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Marking Scheme
                          </span>
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            +{activeModule.marksPerQuestion || 1} / -
                            {activeModule.negativeMarks !== undefined
                              ? activeModule.negativeMarks
                              : 0.5}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Passing Mark
                          </span>
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            {activeModule.passPercentage || 60}%
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider mb-8">
                        * Some questions may have individual marking overrides.
                      </div>
                      <button
                        onClick={handleStartActualTest}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                      >
                        Accept & Start Mission
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-8 border-b border-emerald-500/20 pb-4">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {activeModule.title}
                          </h2>
                          <p className="text-sm text-emerald-400/80 font-medium mt-1">
                            Question {currentQuestionIndex + 1} of{" "}
                            {activeModule.questions.length}
                          </p>
                        </div>
                        {timeLeft !== null && (
                          <div
                            className={`px-4 py-2 rounded-lg font-mono font-bold text-lg flex items-center ${timeLeft < 60 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 animate-pulse" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-700 dark:text-slate-300"}`}
                          >
                            <Timer className="w-5 h-5 mr-2" />
                            {formatTime(timeLeft)}
                          </div>
                        )}
                      </div>

                      <div className="mb-8">
                        {/* Grid Navigation */}
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">
                          {activeModule.questions.map((q, idx) => {
                            const isAnswered = answers[q.id] !== undefined;
                            const isReview = markedForReview[q.id];
                            const isCurrent = currentQuestionIndex === idx;

                            let bgClass =
                              "glass-panel border-emerald-500/20 text-emerald-400/80";
                            if (isCurrent) {
                              bgClass =
                                "border-emerald-600 bg-emerald-50 dark:bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-200 dark:ring-emerald-800";
                            } else if (isReview) {
                              bgClass =
                                "border-amber-500 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
                            } else if (isAnswered) {
                              bgClass =
                                "border-emerald-500 bg-emerald-50 dark:bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";
                            }

                            return (
                              <button
                                key={q.id}
                                onClick={() => setCurrentQuestionIndex(idx)}
                                className={`h-10 rounded text-sm font-bold border-2 transition-colors ${bgClass}`}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-start justify-between mb-6">
                          <div className="text-lg text-slate-800 dark:text-slate-200 font-medium leading-relaxed flex-1">
                            {activeModule.questions[currentQuestionIndex]
                              .subject && (
                              <span className="inline-block mb-3 px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider rounded">
                                {
                                  activeModule.questions[currentQuestionIndex]
                                    .subject
                                }
                              </span>
                            )}
                            <br />
                            <MathText
                              content={
                                activeModule.questions[currentQuestionIndex]
                                  .question
                              }
                            />
                          </div>
                          <button
                            onClick={toggleReview}
                            className={`ml-4 shrink-0 px-3 py-1.5 rounded-lg flex items-center text-sm font-bold transition-colors border-2 ${markedForReview[activeModule.questions[currentQuestionIndex].id] ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-750"}`}
                          >
                            <Flag className="w-4 h-4 mr-1.5" />
                            Review
                          </button>
                        </div>

                        {activeModule.questions[currentQuestionIndex].image && (
                          <div className="mb-8">
                            <SvgDiagram
                              svgCode={
                                activeModule.questions[currentQuestionIndex]
                                  .image
                              }
                              className="max-h-64 rounded-lg shadow-sm border border-emerald-500/20"
                              containerClassName=""
                            />
                          </div>
                        )}

                        <div className="space-y-3">
                          {activeModule.questions[
                            currentQuestionIndex
                          ].options.map((option, idx) => {
                            const isSelected =
                              answers[
                                activeModule.questions[currentQuestionIndex].id
                              ] === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleSelectOption(idx)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium flex items-start ${
                                  isSelected
                                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100"
                                    : "border-emerald-500/20 glass-panel text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-600"
                                }`}
                              >
                                <span className="shrink-0 w-6 text-slate-400 font-bold mr-2 mt-1">
                                  {String.fromCharCode(65 + idx)}.
                                </span>
                                <div className="flex-1">
                                  {option.startsWith("data:image/") ||
                                  option.trim().startsWith("<svg") ? (
                                    <SvgDiagram
                                      svgCode={option}
                                      className="max-h-24 w-auto object-contain"
                                      containerClassName=""
                                    />
                                  ) : (
                                    <MathText content={option} />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-6 border-t border-emerald-500/20 flex-wrap gap-4">
                        <div className="flex space-x-3">
                          <button
                            onClick={handlePrevQuestion}
                            disabled={currentQuestionIndex === 0}
                            className="flex items-center px-6 py-3 glass-panel border-[1.5px] border-emerald-500/20 text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:hidden font-bold rounded-xl shadow-sm transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            Prev
                          </button>

                          {answers[
                            activeModule.questions[currentQuestionIndex].id
                          ] !== undefined && (
                            <button
                              onClick={handleClearSelection}
                              className="flex items-center px-6 py-3 glass-panel border-[1.5px] border-emerald-500/20 text-slate-700 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold rounded-xl shadow-sm transition-colors"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            onClick={() => {
                              handleClearSelection();
                              handleNextQuestion();
                            }}
                            disabled={
                              currentQuestionIndex ===
                              activeModule.questions.length - 1
                            }
                            className="flex items-center px-6 py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:hidden"
                          >
                            Skip
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </button>
                        </div>
                        <div className="flex space-x-3 ml-auto">
                          <button
                            onClick={handleFinishTest}
                            className="flex items-center px-6 py-3 btn-eng-primary font-bold rounded-xl shadow-md transition-colors"
                          >
                            Submit Test
                          </button>
                          <button
                            onClick={handleNextQuestion}
                            disabled={
                              currentQuestionIndex ===
                              activeModule.questions.length - 1
                            }
                            className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hidden text-white font-bold rounded-xl shadow-md transition-colors"
                          >
                            Next
                            <ChevronRight className="w-5 h-5 ml-1" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Profile Settings Modal */}
        {isProfileOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl border border-emerald-500/20 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center p-6 border-b border-emerald-500/20">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center">
                  <User className="w-5 h-5 mr-2 text-emerald-500" />
                  Profile Settings
                </h2>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-700 dark:text-slate-300"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, name: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="Your Name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300">
                    Branch / Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="Type your branch..."
                    value={profileForm.branch}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, branch: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300">
                    Semester
                  </label>
                  <select
                    value={profileForm.semester}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        semester: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="" disabled>
                      Select semester
                    </option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s.toString()}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300">
                    College Name
                  </label>
                  <input
                    type="text"
                    placeholder="Type your college name..."
                    value={profileForm.collegeName}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        collegeName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300">
                    University Name
                  </label>
                  <input
                    type="text"
                    placeholder="Type your university name..."
                    value={profileForm.universityName}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        universityName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:text-slate-300">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2026"
                    value={profileForm.graduationYear}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        graduationYear: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-4 border-t border-emerald-500/20 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 btn-eng-primary font-bold rounded-xl shadow-md transition-all hover:scale-[1.02]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SidebarItem({ icon, label, active, onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all group ${active ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-500/30" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent"} ${!isOpen ? "justify-center px-0" : "px-4"}`}
      title={!isOpen ? label : undefined}
    >
      <span
        className={`${active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"}`}
      >
        {React.cloneElement(icon, { className: "w-4 h-4" })}
      </span>
      <span className={`ml-3 whitespace-nowrap ${!isOpen && "hidden"}`}>
        {label}
      </span>
    </button>
  );
}

function StudentFeedbackForm({ currentUser }) {
  const [feedbackType, setFeedbackType] = useState("general");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      const fbId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      await setDoc(doc(db, "feedbacks", fbId), {
        id: fbId,
        userId: currentUser?.id || "anonymous",
        userName: currentUser?.name || "Anonymous",
        userEmail: currentUser?.email || "",
        feedbackType,
        message,
        createdAt: Date.now(),
      });
      setSuccess(true);
      setMessage("");
    } catch (err) {
      alert("Failed to send feedback: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl shadow-sm border border-emerald-500/20 max-w-lg mx-auto">
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Send Feedback</h3>
      <p className="text-sm text-slate-500 mb-6">
        Let us know what you think, report a problem, or suggest improvements. We read all feedback!
      </p>

      {success ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-center">
          <p className="text-emerald-700 dark:text-emerald-400 font-bold mb-2">Thank you!</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Your feedback has been submitted successfully.</p>
          <button
            onClick={() => setSuccess(false)}
            className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Feedback Type
            </label>
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="general">General Feedback</option>
              <option value="bug">Report a Bug / Problem</option>
              <option value="improvement">Need Improvement</option>
              <option value="feature">Feature Request</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Your Message
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us details..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="w-full py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Sending..." : "Submit Feedback"}
          </button>
        </form>
      )}
    </div>
  );
}
