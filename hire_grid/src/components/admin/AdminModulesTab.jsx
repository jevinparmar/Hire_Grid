import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  Plus,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Eye,
  X,
  BookOpen,
  Clock,
  Target,
  Edit,
} from "lucide-react";
import { OperationType, collection, db, deleteDoc, doc, getDocs, handleFirestoreError, limit, onSnapshot, query, setDoc, where } from "../../firebase";
import { api } from "../../lib/api";

import { MathText } from "../common/MathText";
import { SvgDiagram } from "../common/SvgDiagram";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SortableList } from "../common/SortableList";

import { logAudit } from "../../auditLogger";

export function AdminModulesTab({
  moduleType = "general",
  parentId = undefined,
  isContentManager = false,
  userName = "Admin",
}) {
  const [modules, setModules] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);
  const [selectedSubModules, setSelectedSubModules] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Technical");
  const [timeLimit, setTimeLimit] = useState(30);
  const [passPercentage, setPassPercentage] = useState(60);
  const [accessMode, setAccessMode] = useState("inherit");
  const [accessType, setAccessType] = useState("free");
  const [price, setPrice] = useState(0);
  const [displayOrder, setDisplayOrder] = useState(0);

  // Universal Marking System Default Params
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0.5);
  const [totalMarks, setTotalMarks] = useState(0);

  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [error, setError] = useState("");

  // New state for Question Adding Modes
  const [addMode, setAddMode] = useState("auto");
  const [currentSubject, setCurrentSubject] = useState("Technical");
  const [previewModule, setPreviewModule] = useState(null);
  const [editingModuleId, setEditingModuleId] = useState(null);

  const [manualQuestion, setManualQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswerIndex: 0,
    image: "",
  });

  const [deleteModuleInfo, setDeleteModuleInfo] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "modules")),
      (snapshot) => {
        let mods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Filter manually since we didn't index this field
        mods = mods.filter(
          (m) =>
            (m.moduleType || "general") === moduleType &&
            m.parentId === parentId,
        );

        // Sort by displayOrder
        mods.sort((a, b) => {
          const orderA = a.displayOrder ?? 999999;
          const orderB = b.displayOrder ?? 999999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

        setModules(mods);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "modules"),
    );
    return () => unsub();
  }, [moduleType, parentId]);

  const handleParseText = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setError("");

    try {
      const res = await fetch("/api/parse-mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error(
          "API endpoint not found. If you opened this on Firebase Hosting or a static host, the AI generation backend is not running. Please use the AI Studio provided URL to generate modules.",
        );
      }

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(
          `Server returned status ${res.status}: Failed to parse response from server.`,
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse");
      }

      let svgMap = new Map();
      if (data.svg_diagrams && Array.isArray(data.svg_diagrams)) {
        data.svg_diagrams.forEach((svgItem) => {
          if (svgItem.svg_id && svgItem.svg_code) {
            svgMap.set(svgItem.svg_id, svgItem.svg_code);
          }
        });
      }

      const qs = data.questions.map((q) => {
        let imageString = undefined;
        if (q.svg_id && svgMap.has(q.svg_id)) {
          const svgMarkup = svgMap.get(q.svg_id) || "";
          imageString = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
        } else if (q.svg_code) {
          imageString = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(q.svg_code)))}`;
        }

        let parsedOptions = q.options || [];
        let correctIdx =
          typeof q.correctAnswerIndex === "number" ? q.correctAnswerIndex : 0;

        if (
          q.options &&
          typeof q.options === "object" &&
          !Array.isArray(q.options)
        ) {
          const keys = Object.keys(q.options).sort();
          parsedOptions = keys.map((k) => q.options[k]);
          const correctKey = q.correct_answer || "A";
          correctIdx =
            keys.indexOf(correctKey) >= 0 ? keys.indexOf(correctKey) : 0;
        }

        if (q.option_svg_ids) {
          const keys = Object.keys(q.option_svg_ids).sort();
          parsedOptions = keys.map((k) => {
            const svgId = q.option_svg_ids[k];
            if (svgMap.has(svgId)) {
              const svgMarkup = svgMap.get(svgId) || "";
              return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
            }
            return q.options && q.options[k]
              ? q.options[k]
              : `[Missing SVG: ${svgId}]`;
          });
          const correctKey = q.correct_answer || "A";
          correctIdx =
            keys.indexOf(correctKey) >= 0
              ? keys.indexOf(correctKey)
              : typeof q.correctAnswerIndex === "number"
                ? q.correctAnswerIndex
                : 0;
        }

        return {
          id: crypto.randomUUID(),
          question: q.question,
          options: parsedOptions,
          correctAnswerIndex: correctIdx,
          subject: currentSubject,
          image: imageString,
          explanation: q.explanation || undefined,
        };
      });

      setParsedQuestions([...parsedQuestions, ...qs]);
      setRawText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const MAX_SIZE = 800; // Resize to ensure no huge payloads

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
          // Fill background white in case of transparent png
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }

        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        const updated = [...parsedQuestions];
        updated[index] = { ...updated[index], image: dataUrl };
        setParsedQuestions(updated);
      };
      if (ev.target?.result) {
        img.src = ev.target.result;
      }
    };
    reader.readAsDataURL(file);
    // Reset input to allow selecting same file again
    e.target.value = "";
  };

  const handleAddManualQuestion = () => {
    if (
      !manualQuestion.question.trim() ||
      manualQuestion.options.some((o) => !o.trim())
    ) {
      setError("Please fill in the question and all 4 options.");
      return;
    }
    const newQ = {
      id: crypto.randomUUID(),
      question: manualQuestion.question,
      options: manualQuestion.options,
      correctAnswerIndex: manualQuestion.correctAnswerIndex,
      image: manualQuestion.image,
      subject: currentSubject,
    };
    setParsedQuestions([...parsedQuestions, newQ]);
    setManualQuestion({
      question: "",
      options: ["", "", "", ""],
      correctAnswerIndex: 0,
      image: "",
    });
    setError("");
  };

  const handleManualImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const MAX_SIZE = 800;
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
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        setManualQuestion({ ...manualQuestion, image: dataUrl });
      };
      if (ev.target?.result) img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleParseJSON = () => {
    try {
      let parsed = null;

      // Sanitize JSON string to fix common unescaped LaTeX backslashes from AI
      let sanitizedText = rawText;
      const mathCommands = [
        "frac",
        "cdot",
        "times",
        "int",
        "partial",
        "infty",
        "begin",
        "end",
        "omega",
        "pi",
        "Delta",
        "nabla",
        "alpha",
        "beta",
        "gamma",
        "theta",
        "lambda",
        "mu",
        "sigma",
        "phi",
        "psi",
        "tau",
        "rho",
        "sum",
        "prod",
        "lim",
        "log",
        "sin",
        "cos",
        "tan",
        "sec",
        "csc",
        "cot",
        "sqrt",
        "text",
        "textbf",
        "emph",
        "nu",
        "xi",
        "zeta",
        "eta",
        "iota",
        "kappa",
        "chi",
        "upsilon",
        "Leftarrow",
        "Rightarrow",
        "leftrightarrow",
        "updownarrow",
        "Leftrightarrow",
        "Updownarrow",
        "rightarrow",
        "leftarrow",
        "geq",
        "leq",
        "neq",
        "approx",
        "equiv",
        "propto",
        "pm",
        "mp",
        "div",
        "circ",
        "bullet",
        "oplus",
        "otimes",
        "vee",
        "wedge",
        "cap",
        "cup",
        "subset",
        "supset",
        "subseteq",
        "supseteq",
        "in",
        "notin",
        "exists",
        "nexists",
        "forall",
        "neg",
        "implies",
        "iff",
        "mapsto",
        "to",
        "gets",
        "lvert",
        "rvert",
        "lVert",
        "rVert",
        "langle",
        "rangle",
        "lceil",
        "rceil",
        "lfloor",
        "rfloor",
        "lbrace",
        "rbrace",
        "left",
        "right",
        "overline",
        "underline",
        "widehat",
        "widetilde",
        "vec",
        "dot",
        "ddot",
        "hat",
        "tilde",
        "bar",
        "breve",
        "check",
        "acute",
        "grave",
      ];
      sanitizedText = sanitizedText.replace(
        /\\\\?([a-zA-Z]+)/g,
        (match, p1) => {
          if (mathCommands.includes(p1)) {
            return "\\\\" + p1;
          }
          return match;
        },
      );
      sanitizedText = sanitizedText.replace(/\\\\?([{}])/g, "\\\\$1");

      try {
        // Try to parse as strict JSON
        const startIdx = sanitizedText.indexOf("[");
        const startObjIdx = sanitizedText.indexOf("{");
        const actualStart =
          startIdx !== -1 && startObjIdx !== -1
            ? Math.min(startIdx, startObjIdx)
            : Math.max(startIdx, startObjIdx);

        const endIdx = sanitizedText.lastIndexOf("]");
        const endObjIdx = sanitizedText.lastIndexOf("}");
        const actualEnd = Math.max(endIdx, endObjIdx);

        if (actualStart === -1 || actualEnd === -1) {
          throw new Error(
            "Could not find a valid JSON object or array in the text.",
          );
        }

        const jsonStr = sanitizedText.substring(actualStart, actualEnd + 1);
        parsed = JSON.parse(jsonStr);
      } catch (err) {
        // Fallback: evaluate as JS object if it contains unquoted keys or comments
        try {
          let jsStr = sanitizedText;
          const questionsMatch = sanitizedText.match(
            /const\s+QUESTIONS\s*=\s*(\[[\s\S]*?\]);/,
          );
          if (questionsMatch && questionsMatch[1]) {
            jsStr = questionsMatch[1];
          } else {
            const startIdx = sanitizedText.indexOf("[");
            const startObjIdx = sanitizedText.indexOf("{");
            const actualStart =
              startIdx !== -1 && startObjIdx !== -1
                ? Math.min(startIdx, startObjIdx)
                : Math.max(startIdx, startObjIdx);

            const endIdx = sanitizedText.lastIndexOf("]");
            const endObjIdx = sanitizedText.lastIndexOf("}");
            const actualEnd = Math.max(endIdx, endObjIdx);

            if (actualStart !== -1 && actualEnd !== -1) {
              jsStr = sanitizedText.substring(actualStart, actualEnd + 1);
            }
          }
          // Safely evaluate the JS string
          parsed = new Function(`return ${jsStr}`)();
        } catch (evalErr) {
          throw new Error(
            "Failed to parse JSON and JS object literal: " + evalErr.message,
          );
        }
      }

      let qs = [];
      let svgMap = new Map();

      // Look for svg_diagrams in the root
      if (parsed.svg_diagrams && Array.isArray(parsed.svg_diagrams)) {
        parsed.svg_diagrams.forEach((svgItem) => {
          if (svgItem.svg_id && svgItem.svg_code) {
            svgMap.set(svgItem.svg_id, svgItem.svg_code);
          }
        });
      }

      // Check if it's the new nested module format
      if (
        parsed.module &&
        parsed.module.questions &&
        Array.isArray(parsed.module.questions)
      ) {
        if (parsed.module.company) {
          let titleStr = parsed.module.company;
          if (parsed.module.module_number)
            titleStr += ` Module ${parsed.module.module_number}`;
          setTitle(titleStr.trim());
        }
        qs = parsed.module.questions;
      }
      // If it's the old full module object
      else if (parsed.questions && Array.isArray(parsed.questions)) {
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        qs = parsed.questions;
      }
      // Array of questions
      else if (Array.isArray(parsed)) {
        qs = parsed;
      } else if (
        typeof parsed === "object" &&
        parsed !== null &&
        (parsed.question || parsed.option_svg_ids || parsed.text)
      ) {
        qs = [parsed];
      } else {
        throw new Error("Invalid format. Cannot find 'questions' array.");
      }

      const formattedQs = qs.map((q) => {
        // Handle options obj (e.g. {"A": "...", "B": "..."}) or array
        let parsedOptions = ["Option A", "Option B", "Option C", "Option D"];
        let correctIdx = 0;

        if (q.options) {
          if (Array.isArray(q.options)) {
            parsedOptions = q.options;
            correctIdx =
              typeof q.correctAnswerIndex === "number"
                ? q.correctAnswerIndex
                : typeof q.answer === "number"
                  ? q.answer
                  : 0;
          } else if (typeof q.options === "object") {
            const keys = Object.keys(q.options).sort(); // usually A, B, C, D
            parsedOptions = keys.map((k) => q.options[k]);
            const correctKey = q.correct_answer || "A";
            correctIdx =
              keys.indexOf(correctKey) >= 0 ? keys.indexOf(correctKey) : 0;
          }
        }

        if (q.option_svg_ids) {
          const keys = Object.keys(q.option_svg_ids).sort();
          parsedOptions = keys.map((k) => {
            const svgId = q.option_svg_ids[k];
            if (svgMap.has(svgId)) {
              const svgMarkup = svgMap.get(svgId) || "";
              return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
            }
            return q.options && q.options[k]
              ? q.options[k]
              : `[Missing SVG: ${svgId}]`;
          });
          const correctKey = q.correct_answer || "A";
          correctIdx =
            keys.indexOf(correctKey) >= 0
              ? keys.indexOf(correctKey)
              : typeof q.correctAnswerIndex === "number"
                ? q.correctAnswerIndex
                : 0;
        }

        // Check if there is an svg_id mapping, inline svg_code, or HTML snippet 'diagram'
        let imageString = q.image;
        if (q.diagram_type && q.diagram_code) {
          imageString = JSON.stringify({
            diagram_type: q.diagram_type,
            diagram_code: q.diagram_code,
          });
        } else if (q.svg_id && svgMap.has(q.svg_id)) {
          // svg_id mapped
          const svgMarkup = svgMap.get(q.svg_id) || "";
          imageString = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
        } else if (q.diagram) {
          // From the HTML file example
          imageString = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(q.diagram)))}`;
        } else if (q.svg_code) {
          // Inline svg_code on the question
          imageString = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(q.svg_code)))}`;
        }

        let questionText = q.question || q.text || "Untitled Question";
        if (q.subtext) {
          questionText += `\n\n${q.subtext}`;
        }

        return {
          id: crypto.randomUUID(),
          question: questionText,
          options: parsedOptions,
          correctAnswerIndex: correctIdx,
          subject:
            q.category || q.topic || q.type || q.subject || currentSubject,
          image: imageString,
          explanation: q.explanation || undefined,
        };
      });

      setParsedQuestions([...parsedQuestions, ...formattedQs]);
      setRawText("");
      setError("");
    } catch (err) {
      setError("Failed to parse JSON: " + err.message);
    }
  };

  const handleSaveModule = async () => {
    if (!title || parsedQuestions.length === 0) {
      setError("Title and at least one question are required.");
      return;
    }

    const moduleId = editingModuleId || crypto.randomUUID();
    const existing = editingModuleId
      ? modules.find((x) => x.id === editingModuleId)
      : null;

    const newModule = JSON.parse(
      JSON.stringify({
        title,
        description,
        category,
        timeLimit,
        passPercentage,
        marksPerQuestion,
        negativeMarks,
        totalMarks,
        accessMode,
        accessType: accessMode === "custom" ? accessType : undefined,
        isPremium:
          accessMode === "custom"
            ? ["premium_only", "premium_purchasable"].includes(accessType)
            : undefined,
        price:
          accessMode === "custom" &&
          ["purchasable_only", "premium_purchasable"].includes(accessType)
            ? price
            : 0,
        displayOrder,
        questions: parsedQuestions,
        createdAt: existing ? existing.createdAt : Date.now(),
        createdBy: existing?.createdBy || userName,
        isMaster: false,
        moduleType,
        parentId,
      }),
    );

    try {
      await setDoc(doc(db, "modules", moduleId), newModule);

      await setDoc(doc(db, "notifications", crypto.randomUUID()), {
        title: editingModuleId ? "Module Updated" : "New Module Available",
        message: `The module "${title}" has been ${editingModuleId ? "updated" : "published"}.`,
        createdAt: Date.now(),
        targetRole: "student",
      });

      if (isContentManager) {
        await logAudit(
          userName,
          `${editingModuleId ? "Updated" : "Created"} Module: ${title}`,
        );
      }

      alert(editingModuleId ? "Success: Module updated successfully!" : "Success: Module published successfully!");

      setIsCreating(false);
      setEditingModuleId(null);
      setTitle("");
      setDescription("");
      setCategory("Technical");
      setRawText("");
      setParsedQuestions([]);
      setAccessMode("inherit");
      setAccessType("free");
      setPrice(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "modules");
      const errMsg = err.message || "Failed to save module to database.";
      setError(errMsg);
      alert("Error: " + errMsg);
    }
  };

  const handleSaveMasterModule = async () => {
    if (!title) {
      setError("Title is required.");
      return;
    }
    if (selectedSubModules.length === 0) {
      setError("Please select at least one sub-module.");
      return;
    }

    const subtestsToSave = modules
      .filter((m) => selectedSubModules.includes(m.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        questions: m.questions,
      }));

    const moduleId = editingModuleId || crypto.randomUUID();
    const existing = editingModuleId
      ? modules.find((x) => x.id === editingModuleId)
      : null;

    const newModule = JSON.parse(
      JSON.stringify({
        title,
        description,
        category,
        timeLimit: 0, // master module might not have a global time limit, or it sum of subtests
        passPercentage,
        accessMode,
        accessType: accessMode === "custom" ? accessType : undefined,
        isPremium:
          accessMode === "custom"
            ? ["premium_only", "premium_purchasable"].includes(accessType)
            : undefined,
        price:
          accessMode === "custom" &&
          ["purchasable_only", "premium_purchasable"].includes(accessType)
            ? price
            : 0,
        displayOrder,
        questions: [],
        isMaster: true,
        subTests: subtestsToSave,
        createdAt: existing ? existing.createdAt : Date.now(),
        createdBy: existing?.createdBy || userName,
        moduleType,
        parentId,
      }),
    );

    try {
      await setDoc(doc(db, "modules", moduleId), newModule);

      await setDoc(doc(db, "notifications", crypto.randomUUID()), {
        title: editingModuleId
          ? "Master Module Updated"
          : "New Master Module Available",
        message: `The master module "${title}" has been ${editingModuleId ? "updated" : "published"}.`,
        createdAt: Date.now(),
        targetRole: "student",
      });

      if (isContentManager) {
        await logAudit(
          userName,
          `${editingModuleId ? "Updated" : "Created"} Master Module: ${title}`,
        );
      }

      alert(editingModuleId ? "Success: Master Module updated successfully!" : "Success: Master Module published successfully!");

      setIsCreatingMaster(false);
      setEditingModuleId(null);
      setTitle("");
      setDescription("");
      setSelectedSubModules([]);
      setAccessMode("inherit");
      setAccessType("free");
      setPrice(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "modules");
      const errMsg = err.message || "Failed to save master module to database.";
      setError(errMsg);
      alert("Error: " + errMsg);
    }
  };

  const confirmDeleteModule = async () => {
    if (!deleteModuleInfo) return;
    const { id, title: moduleTitle } = deleteModuleInfo;

    try {
      await deleteDoc(doc(db, "modules", id));

      const scoresQuery = query(
        collection(db, "scores"),
        where("moduleId", "==", id),
      );
      const scoreDocs = await getDocs(scoresQuery);
      const batchList = [];
      scoreDocs.forEach((d) => batchList.push(deleteDoc(d.ref)));
      await Promise.all(batchList);

      const usersSnap = await getDocs(collection(db, "users"));
      const userUpdates = [];
      usersSnap.forEach((userDoc) => {
        const uData = userDoc.data();
        if (uData.moduleScores && uData.moduleScores[id] !== undefined) {
          const newScores = { ...uData.moduleScores };
          delete newScores[id];
          userUpdates.push(
            setDoc(userDoc.ref, { moduleScores: newScores }, { merge: true }),
          );
        }
      });
      await Promise.all(userUpdates);

      if (isContentManager && moduleTitle) {
        await logAudit(userName, `Deleted Module: ${moduleTitle}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "modules");
      alert(`Failed to delete module: ${err.message}`);
    } finally {
      setDeleteModuleInfo(null);
    }
  };

  const initiateDeleteModule = (id, moduleTitle) => {
    const mod = modules.find((m) => m.id === id);
    if (isContentManager && mod && mod.createdBy !== userName) {
      alert(
        "You are not authorized to delete this module. Only the creator or a Super Admin can delete it.",
      );
      return;
    }
    setDeleteModuleInfo({ id, title: moduleTitle });
  };

  const handleEditModule = async (m) => {
    if (isContentManager && m.createdBy && m.createdBy !== userName) {
      alert("You are not authorized to edit this module. Only the creator or a Super Admin can edit it.");
      return;
    }

    let fetchedQuestions = m.questions || [];
    // If the questions are empty/placeholder, lazy load them
    if (!fetchedQuestions || fetchedQuestions.length === 0 || Object.keys(fetchedQuestions[0]).length === 0) {
      try {
        const res = await api.get(`/modules/${m.id}/questions`);
        fetchedQuestions = res.questions || [];
      } catch (err) {
        alert("Failed to load questions for editing: " + err.message);
      }
    }

    if (m.isMaster) {
      setIsCreatingMaster(true);
      setIsCreating(false);
      setSelectedSubModules(m.subTests ? m.subTests.map((sub) => sub.id) : []);
    } else {
      setIsCreating(true);
      setIsCreatingMaster(false);
      setParsedQuestions(fetchedQuestions);
    }
    setEditingModuleId(m.id);
    setTitle(m.title);
    setDescription(m.description || "");
    setCategory(m.category || "Technical");
    setTimeLimit(m.timeLimit || 30);
    setPassPercentage(m.passPercentage || 60);
    setMarksPerQuestion(
      m.marksPerQuestion !== undefined ? m.marksPerQuestion : 1,
    );
    setNegativeMarks(m.negativeMarks !== undefined ? m.negativeMarks : 0.5);
    setTotalMarks(m.totalMarks || 0);

    setAccessMode(m.accessMode || "inherit");
    const accType = m.accessType || (m.isPremium ? "premium_only" : "free");
    setAccessType(accType);
    setPrice(m.price || 0);
    setDisplayOrder(m.displayOrder || 0);
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setIsCreatingMaster(false);
    setEditingModuleId(null);
    setTitle("");
    setDescription("");
    setCategory("Technical");
    setTimeLimit(30);
    setPassPercentage(60);
    setMarksPerQuestion(1);
    setNegativeMarks(0.5);
    setTotalMarks(0);
    setRawText("");
    setParsedQuestions([]);
    setSelectedSubModules([]);
    setAccessMode("inherit");
    setAccessType("free");
    setPrice(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-slate-800 dark:text-slate-200">
        <h2 className="text-xl font-bold">Manage Modules</h2>
        {!isCreating && !isCreatingMaster && (
          <div className="flex space-x-3">
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Create Module</span>
            </button>
            <button
              onClick={() => setIsCreatingMaster(true)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Create Master Module</span>
            </button>
          </div>
        )}
      </div>

      {isCreatingMaster ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingModuleId ? "Edit Master Module" : "New Master Module"}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Master Module Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Final Semester Exam"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Technical">Technical</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Reasoning">Reasoning</option>
                <option value="Aptitude">Aptitude</option>
                <option value="English">English</option>
                <option value="General Knowledge">General Knowledge</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Display Order
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                placeholder="Brief description... (Formatting supported)"
              />
            </div>
            <div className="space-y-2 md:col-span-2 mt-4">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                Select Sub-Modules
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                {modules
                  .filter((m) => !m.isMaster)
                  .map((m) => (
                    <label
                      key={m.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 flex-shrink-0 w-4 h-4 text-emerald-600 rounded"
                        checked={selectedSubModules.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedSubModules([
                              ...selectedSubModules,
                              m.id,
                            ]);
                          else
                            setSelectedSubModules(
                              selectedSubModules.filter((id) => id !== m.id),
                            );
                        }}
                      />

                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {m.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {m.questions.length} questions
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
            </div>

            <div className="space-y-4 md:col-span-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4">
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center mb-2">
                Access Settings
              </h4>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="inherit"
                      checked={accessMode === "inherit"}
                      onChange={() => setAccessMode("inherit")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />

                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Inherit Parent Settings (Default)
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="custom"
                      checked={accessMode === "custom"}
                      onChange={() => setAccessMode("custom")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />

                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Custom Module Settings
                    </span>
                  </label>
                </div>

                {accessMode === "custom" && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 gap-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Access Type
                    </label>
                    <select
                      value={accessType}
                      onChange={(e) => setAccessType(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="free">Free</option>
                      <option value="demo">Demo</option>
                      <option value="premium_only">Premium Eligible</option>
                      <option value="purchasable_only">Purchasable</option>
                      <option value="premium_purchasable">
                        Premium + Purchasable
                      </option>
                      <option value="access_request_only">
                        Access Request
                      </option>
                    </select>

                    {["purchasable_only", "premium_purchasable"].includes(
                      accessType,
                    ) && (
                      <div className="space-y-1 mt-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
                          Module Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="px-4 py-2 w-full md:w-48 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveMasterModule}
            className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition-colors"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {editingModuleId ? "Update Master Module" : "Publish Master Module"}
          </button>
        </div>
      ) : isCreating ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingModuleId
                ? "Edit Assessment Module"
                : "New Assessment Module"}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Module Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Mathematics Midterm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Technical">Technical</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Reasoning">Reasoning</option>
                <option value="Aptitude">Aptitude</option>
                <option value="English">English</option>
                <option value="General Knowledge">General Knowledge</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Time Limit (mins)
              </label>
              <input
                type="number"
                min="1"
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Passing Score (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={passPercentage}
                onChange={(e) =>
                  setPassPercentage(parseInt(e.target.value) || 60)
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Display Order
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-4 md:col-span-full bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4">
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center mb-2">
                Access Settings
              </h4>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="inherit"
                      checked={accessMode === "inherit"}
                      onChange={() => setAccessMode("inherit")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />

                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Inherit Parent Settings (Default)
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="custom"
                      checked={accessMode === "custom"}
                      onChange={() => setAccessMode("custom")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />

                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Custom Module Settings
                    </span>
                  </label>
                </div>

                {accessMode === "custom" && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 gap-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Access Type
                    </label>
                    <select
                      value={accessType}
                      onChange={(e) => setAccessType(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="free">Free</option>
                      <option value="demo">Demo</option>
                      <option value="premium_only">Premium Eligible</option>
                      <option value="purchasable_only">Purchasable</option>
                      <option value="premium_purchasable">
                        Premium + Purchasable
                      </option>
                      <option value="access_request_only">
                        Access Request
                      </option>
                    </select>

                    {["purchasable_only", "premium_purchasable"].includes(
                      accessType,
                    ) && (
                      <div className="space-y-1 mt-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">
                          Module Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={price}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="px-4 py-2 w-full md:w-48 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Marks Per Question
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={marksPerQuestion}
                onChange={(e) =>
                  setMarksPerQuestion(parseFloat(e.target.value) || 0)
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Negative Marks
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={negativeMarks}
                onChange={(e) =>
                  setNegativeMarks(parseFloat(e.target.value) || 0)
                }
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Total Marks Override</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  0 = Auto
                </span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-2 lg:col-span-full">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Marking Presets
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setMarksPerQuestion(1);
                    setNegativeMarks(0);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Placement Test (+1 / 0)
                </button>
                <button
                  onClick={() => {
                    setMarksPerQuestion(1);
                    setNegativeMarks(0.25);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Placement Adv (+1 / -0.25)
                </button>
                <button
                  onClick={() => {
                    setMarksPerQuestion(1);
                    setNegativeMarks(0.33);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  GATE Style (+1 / -0.33)
                </button>
                <button
                  onClick={() => {
                    setMarksPerQuestion(2);
                    setNegativeMarks(0.66);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  GATE Advanced (+2 / -0.66)
                </button>
              </div>
            </div>
            <div className="space-y-2 lg:col-span-full">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-y"
                placeholder="Brief description... (Formatting supported)"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Add Questions
            </h3>

            <div className="flex flex-wrap gap-4 mb-4 items-center">
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                <button
                  onClick={() => setAddMode("auto")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${addMode === "auto" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Auto-Generate
                </button>
                <button
                  onClick={() => setAddMode("manual")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${addMode === "manual" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => setAddMode("bulk-code")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${addMode === "bulk-code" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Code Import
                </button>
              </div>

              <div className="flex items-center ml-auto space-x-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Subject:
                </label>
                <select
                  value={currentSubject}
                  onChange={(e) => setCurrentSubject(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Technical">Technical</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Reasoning">Reasoning</option>
                  <option value="Aptitude">Aptitude</option>
                  <option value="English">English</option>
                  <option value="General Knowledge">General Knowledge</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {addMode === "auto" ? (
              <div className="space-y-4">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full h-40 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono text-sm leading-relaxed"
                  placeholder="Paste questions text here to generate MCQs for the selected subject..."
                />

                <button
                  onClick={handleParseText}
                  disabled={isParsing || !rawText.trim()}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {isParsing
                    ? "Processing..."
                    : `Generate ${currentSubject} Questions`}
                </button>
              </div>
            ) : addMode === "bulk-code" ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs text-slate-500">
                    Paste a JSON array of questions.
                  </div>
                  <button
                    onClick={() => {
                      const externalAIPrompt = `You are an expert curriculum designer and SVG master for a premium placement portal.
I need a JSON array of premium multiple-choice questions.
Target Company/Exam: [Insert Company/Exam Name]
Number of Questions: [Insert Number]
Subject: [Insert Subject - e.g., Reasoning, Aptitude, Technical, Math]
Difficulty Level: [Fundamental / Medium / Hard / Advanced / Company Ready]

Context: I am generating multiple modules. DO NOT repeat any questions or concepts from previous prompts in this session. Ensure the questions precisely match the requested difficulty tier.

CRITICAL JSON STRING ESCAPING RULE FOR MATH:
My website has a backslash parsing bug. To fix this, you must DOUBLE-ESCAPE every single LaTeX backslash command inside the JSON strings. A single backslash will corrupt the data. You must use two backslashes ("\\\\") for every command.

Strict Symbol Formatting Guidelines:
1. Fractions: Use "\\\\frac{numerator}{denominator}" -> Example: "$\\\\frac{a}{b}$"
2. Calculus & Integration: Use "\\\\int", "\\\\partial", "\\\\infty" -> Example: "$\\\\int_{0}^{\\\\infty} e^{-x} dx$"
3. Multiplication & Dots: Use "\\\\cdot" or "\\\\times" -> Written as "\\\\cdot" or "\\\\times"
4. Matrices & Brackets: Use "\\\\begin{matrix}" -> Written as "\\\\begin{matrix}" and "\\\\end{matrix}"
5. Exponents & Subscripts: Use structural brackets -> Example: "$x^{2n}$" or "$A_{i,j}$"
6. Greek Letters & Engineering Symbols: Double escape all terms like "\\\\omega", "\\\\pi", "\\\\Delta", "\\\\nabla" -> Written as "\\\\omega", "\\\\pi", "\\\\Delta", "\\\\nabla"

Ensure all math expressions in questions and options are cleanly enclosed inside $...$ delimiters. Double check that every single backslash character in your output is doubled.

Return ONLY valid JSON in this exact format (Do NOT output markdown blocks or conversation, just the raw JSON array):

[
  {
    "question": "Question text here. Use strictly single dollar signs for inline math: $x^2 + y^2$.",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Detailed explanation of the solution.",
    "diagram_type": "mermaid", 
    "diagram_code": "graph LR; A-->B;"
  }
]

Note: You can use "diagram_type": "svg" (and provide "svg_code") OR "diagram_type": "mermaid" OR "diagram_type": "circuitikz". 

ADVANCED DIAGRAM ENGINE UPGRADE (OPTIONAL):
- Use Mermaid diagrams ("diagram_type": "mermaid") for: Blood Relations, Direction Sense, Seating Arrangements, Flowcharts, Hierarchies, Pattern-Based Reasoning.
- Use CircuitikZ diagrams ("diagram_type": "circuitikz") for: Network Theory, Thevenin, Norton, Logic Gates, CMOS, MOSFET, Power Systems, Transformers, Electronics.

CRITICAL RULES FOR PREMIUM SVG GENERATION (MANDATORY IF USING SVG):
1. USE SINGLE QUOTES FOR SVG ATTRIBUTES: To keep the JSON valid without complex escaping, ALWAYS use single quotes inside the SVG string (e.g. fill='#EFF6FF' not fill="...").
2. CANVAS & STRUCTURE: Always use viewBox='0 0 800 600'. 
   - Top area (y=0 to 300) is for the problem figure.
   - Bottom area (y=300 to 600) is for the 4 options.
3. SVG QUALITY & STYLING:
   - Apply highly polished aesthetics: stroke='#334155', stroke-width='3', fill='none' (or clean solid fills like '#EFF6FF').
   - Use semantic <g> tags for logical parts.
   - Use standard typography: <text font-family='sans-serif' font-size='20' fill='#475569'>
4. AVOID SLOP: All rotations, shapes, sequence patterns, or circuits MUST be mathematically precise. Use explicit coordinates. No placeholders!
5. 4 OPTION LAYOUT: Do not generate 4 separate SVGs. Generate ONE single SVG with the 4 options placed elegantly at the bottom. Use this EXACT SVG grouping structure for choices:
<g transform='translate(50, 400)'>
   <text x='0' y='-20' font-family='sans-serif' font-weight='bold' font-size='24' fill='#1E293B'>A</text>
   <rect x='0' y='0' width='140' height='140' fill='#F8FAFC' stroke='#E2E8F0' stroke-width='2' rx='12'/>
   <!-- Draw Choice A visual here inside the rect -->
</g>
(Do the same for B at transform='translate(230, 400)', C at transform='translate(410, 400)', D at transform='translate(590, 400)').
6. ANTI-SPOILER: The 4 option rectangles MUST visually look identical. DO NOT highlight the correct one. The ONLY record of the correct answer is "correctAnswerIndex" in JSON.
7. DIAGRAM VALIDATION: Every diagram must have exactly ONE logical and unambiguous correct answer.

Please generate the requested JSON now.`;
                      navigator.clipboard.writeText(externalAIPrompt);
                      alert(
                        "Prompt copied to clipboard! Paste it into any AI to generate questions.",
                      );
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Copy Prompt for External AI</span>
                  </button>
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  Example:
                  <pre className="mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                    {`[
  {
    "question": "Which of these is the correct mirror image?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 1,
    "explanation": "Because option B correctly mirrors the left side.",
    "svg_code": "<svg>...</svg>"
  }
]`}
                  </pre>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full h-64 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono text-sm leading-relaxed"
                  placeholder="Paste JSON array here..."
                />

                <button
                  onClick={handleParseJSON}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  Import JSON Code
                </button>
              </div>
            ) : (
              <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Question Text
                  </label>
                  <textarea
                    value={manualQuestion.question}
                    onChange={(e) =>
                      setManualQuestion({
                        ...manualQuestion,
                        question: e.target.value,
                      })
                    }
                    className="w-full h-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((optIdx) => (
                    <div key={optIdx} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={manualQuestion.correctAnswerIndex === optIdx}
                        onChange={() =>
                          setManualQuestion({
                            ...manualQuestion,
                            correctAnswerIndex: optIdx,
                          })
                        }
                        className="w-4 h-4 text-emerald-600"
                      />

                      <input
                        type="text"
                        value={manualQuestion.options[optIdx]}
                        onChange={(e) => {
                          const newOpts = [...manualQuestion.options];
                          newOpts[optIdx] = e.target.value;
                          setManualQuestion({
                            ...manualQuestion,
                            options: newOpts,
                          });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-slate-600 shadow-sm text-xs font-medium rounded text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                    <span>
                      {manualQuestion.image
                        ? "Image Attached (Click to Replace)"
                        : "Attach Image"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleManualImageUpload}
                    />
                  </label>

                  <button
                    onClick={handleAddManualQuestion}
                    className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors shadow-sm"
                  >
                    Add Question
                  </button>
                </div>
              </div>
            )}
          </div>

          {parsedQuestions.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-lg">
                  Module Questions ({parsedQuestions.length})
                </h4>
                <button
                  onClick={() => setParsedQuestions([])}
                  className="text-sm text-rose-600 hover:text-rose-500"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-medium text-slate-900 dark:text-white flex-1">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mr-2">
                          {q.subject || "General"}
                        </span>
                        <br />
                        {idx + 1}. <MathText content={q.question} />
                      </div>
                      <button
                        onClick={() =>
                          setParsedQuestions(
                            parsedQuestions.filter((pq) => pq.id !== q.id),
                          )
                        }
                        className="text-slate-400 hover:text-red-500 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {q.image && (
                      <SvgDiagram
                        svgCode={q.image}
                        className="max-h-40"
                        containerClassName="mb-3"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`px-3 py-2 rounded-md text-sm flex items-start ${q.correctAnswerIndex === oIdx ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}
                        >
                          <span className="mr-1 shrink-0 mt-0.5">
                            {String.fromCharCode(65 + oIdx)}.
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
                      ))}
                    </div>

                    <div className="mt-2 flex">
                      <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-slate-300 dark:border-slate-600 shadow-sm text-xs font-medium rounded text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                        <span>
                          {q.image ? "Replace Image" : "Attach Image Diagram"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(idx, e)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveModule}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {editingModuleId ? "Update Module" : "Publish Module"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.length === 0 ? (
            <div className="col-span-full py-20 px-6 text-center border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-3xl relative overflow-hidden group">
              <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-emerald-500/5 dark:from-emerald-400/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

              <div className="relative z-10 flex flex-col items-center max-w-md mx-auto">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-emerald-200 dark:bg-emerald-900 blur-2xl rounded-full opacity-50 scale-150 animate-pulse-slow"></div>
                  <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center relative rotate-3 group-hover:rotate-6 transition-transform duration-500 border border-slate-100 dark:border-slate-700">
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center border-2 border-white dark:border-slate-800 -rotate-12">
                      <Clock className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center border-2 border-white dark:border-slate-800 rotate-12">
                      <Target className="w-5 h-5 text-emerald-500" />
                    </div>
                    <BookOpen className="w-10 h-10 text-emerald-500" />
                  </div>
                </div>

                <h3 className="text-2xl font-black mb-2 tracking-tight text-slate-900 dark:text-white">
                  Workspace is Empty
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-medium">
                  Build your first assessment module to start challenging
                  students. You can auto-generate questions or add them
                  manually.
                </p>

                <button
                  onClick={() => setIsCreating(true)}
                  className="px-6 py-3 bg-slate-900 dark:bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95 flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create First Module
                </button>
              </div>
            </div>
          ) : (
            <SortableList
              items={modules}
              collectionName="modules"
              onOrderChange={setModules}
              grid={true}
              disabled={!isContentManager}
              renderItem={(module) => (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col relative overflow-hidden group hover:shadow-md hover:border-emerald-500/50 transition-all h-full z-10">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
                  <div className="flex-1 z-10">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mr-2">
                        {module.title}
                      </h3>
                      <div className="flex flex-col space-y-1 items-end">
                        {module.category && (
                          <span className="inline-flex py-1 px-2.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
                            {module.category}
                          </span>
                        )}
                        {module.accessMode === "custom" ? (
                          module.accessType &&
                          module.accessType !== "free" && (
                            <span
                              className={`inline-flex py-1 px-2.5 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm whitespace-nowrap ${module.accessType === "demo" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}
                            >
                              {module.accessType === "demo"
                                ? "Demo"
                                : module.accessType === "premium_only"
                                  ? "Premium"
                                  : module.accessType === "purchasable_only"
                                    ? `Purchasable (₹${module.price || 0})`
                                    : module.accessType ===
                                        "premium_purchasable"
                                      ? `Premium / Purchasable (₹${module.price || 0})`
                                      : module.accessType}
                            </span>
                          )
                        ) : (
                          <span className="inline-flex py-1 px-2.5 rounded-md text-xs font-bold uppercase tracking-wider shadow-sm whitespace-nowrap bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Inherit Parent
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      <span className="whitespace-pre-wrap">
                        {module.description}
                      </span>
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <div className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300">
                        <BookOpen className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        {module.questions.length} Questions
                      </div>
                      <div className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        {module.timeLimit || 30} mins
                      </div>
                      <div className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        <Target className="w-3.5 h-3.5 mr-1.5" />
                        Pass: {module.passPercentage || 60}%
                      </div>
                    </div>

                    <div className="mt-4 flex items-center text-xs text-slate-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mr-2"></span>
                      Added{" "}
                      {new Date(module.createdAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center z-20 relative">
                    <div className="flex space-x-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await api.get(`/modules/${module.id}/questions`);
                            setPreviewModule({ ...module, questions: res.questions || [] });
                          } catch (err) {
                            alert("Failed to load questions for preview: " + err.message);
                          }
                        }}
                        className="flex items-center px-3 py-1.5 rounded-lg text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Preview
                      </button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEditModule(module)}
                        className="text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 p-2 rounded-lg transition-colors"
                        title="Edit Module"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() =>
                          initiateDeleteModule(module.id, module.title)
                        }
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 p-2 rounded-lg transition-colors"
                        title="Delete Module"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      )}

      {previewModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    {previewModule.title}
                  </h3>
                  <div className="flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                    {previewModule.category}{" "}
                    <span className="mx-2 overflow-hidden w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>{" "}
                    {previewModule.questions.length} Questions
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreviewModule(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="space-y-6">
                {previewModule.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div className="flex flex-col mb-4">
                      <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded max-w-max mb-3 uppercase tracking-wider">
                        {q.subject || previewModule.category || "General"}
                      </span>
                      <div className="text-base font-semibold text-slate-900 dark:text-white flex items-start leading-relaxed">
                        <span className="text-emerald-500 mr-2 mt-0.5">
                          {idx + 1}.
                        </span>
                        <div className="flex-1">
                          <MathText content={q.question} />
                        </div>
                      </div>
                    </div>
                    {q.image && (
                      <SvgDiagram
                        svgCode={q.image}
                        className="max-h-48"
                        containerClassName="mb-4 ml-6"
                      />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = q.correctAnswerIndex === oIdx;
                        return (
                          <div
                            key={oIdx}
                            className={`px-4 py-3 rounded-xl border flex items-center transition-colors ${isCorrect ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/50" : "bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700"}`}
                          >
                            <div
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold mr-3 shrink-0 ${isCorrect ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}
                            >
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <div
                              className={`flex-1 text-sm ${isCorrect ? "text-emerald-900 dark:text-emerald-100 font-medium" : "text-slate-700 dark:text-slate-300"}`}
                            >
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
                            {isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-2" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="mt-4 ml-6 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                          Explanation
                        </p>
                        <div className="text-sm text-indigo-900 dark:text-indigo-200">
                          <MathText content={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
              <button
                onClick={() => setPreviewModule(null)}
                className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteModuleInfo !== null}
        title="Delete Module"
        message={`Are you sure you want to delete "${deleteModuleInfo?.title || "this module"}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={confirmDeleteModule}
        onCancel={() => setDeleteModuleInfo(null)}
      />
    </div>
  );
}
