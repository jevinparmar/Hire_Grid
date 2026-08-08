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
  AlertTriangle,
} from "lucide-react";
import { OperationType, collection, db, deleteDoc, doc, getDocs, handleFirestoreError, limit, onSnapshot, query, setDoc, where } from "../../firebase";
import { api } from "../../lib/api";

import { MathText } from "../common/MathText";
import { SvgDiagram } from "../common/SvgDiagram";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SortableList } from "../common/SortableList";

import { logAudit } from "../../auditLogger";
import { showToast } from "../common/Toast";

const getSafeUUID = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2);

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
  const [branchId, setBranchId] = useState("");
  const [availableBranches, setAvailableBranches] = useState([]);

  useEffect(() => {
    if (moduleType === "company") {
      api.get("/hierarchy-nodes?where_type==:general_branch")
        .then((res) => {
          if (res.success && res.nodes) {
            setAvailableBranches(res.nodes);
          }
        })
        .catch((err) => console.error("Fetch branches error:", err));
    }
  }, [moduleType]);

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
  const [pendingImportQuestions, setPendingImportQuestions] = useState([]);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
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

  // Question Editing State & Auto-Sync
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [editingQuestionForm, setEditingQuestionForm] = useState({
    id: "",
    question: "",
    options: ["", "", "", ""],
    correct_answer: "A",
    correct_option_index: 0,
    difficulty: "Easy",
    topic: "",
    subTopic: "",
    type: "Technical",
    explanation: "",
  });

  // Question Pagination State for Performance Optimization
  const [questionsPage, setQuestionsPage] = useState(1);
  const QUESTIONS_PER_PAGE = 20;

  const handleStartEditQuestion = (idx) => {
    const q = parsedQuestions[idx];
    if (!q) return;
    const letterMap = { 0: "A", 1: "B", 2: "C", 3: "D" };
    const ansIdx = typeof q.correctAnswerIndex === "number" ? q.correctAnswerIndex : 0;
    const ansLetter = q.correct_answer || letterMap[ansIdx] || "A";

    setEditingQuestionForm({
      id: q.id || `q_${idx}`,
      question: q.question || "",
      options: Array.isArray(q.options) && q.options.length === 4 ? [...q.options] : ["", "", "", ""],
      correct_answer: ansLetter,
      correct_option_index: ansIdx,
      difficulty: q.difficulty || "Easy",
      topic: q.topic || "",
      subTopic: q.subTopic || q.sub_topic || "",
      type: q.subject || q.type || "Technical",
      explanation: q.explanation || "",
    });
    setEditingQuestionIndex(idx);
  };

  const handleEditQuestionAnswerChange = (ansLetter) => {
    const letterToIdx = { A: 0, B: 1, C: 2, D: 3 };
    const newIdx = letterToIdx[ansLetter] !== undefined ? letterToIdx[ansLetter] : 0;
    setEditingQuestionForm((prev) => ({
      ...prev,
      correct_answer: ansLetter,
      correct_option_index: newIdx,
    }));
  };

  const handleEditQuestionIndexChange = (idxNum) => {
    const idxToLetter = { 0: "A", 1: "B", 2: "C", 3: "D" };
    const newLetter = idxToLetter[idxNum] || "A";
    setEditingQuestionForm((prev) => ({
      ...prev,
      correct_option_index: idxNum,
      correct_answer: newLetter,
    }));
  };

  const handleSaveEditedQuestion = () => {
    if (editingQuestionIndex === null) return;
    if (!editingQuestionForm.question.trim()) {
      showToast("Question text cannot be empty.", "warning");
      return;
    }
    for (let i = 0; i < 4; i++) {
      if (!editingQuestionForm.options[i] || !editingQuestionForm.options[i].trim()) {
        showToast(`Option ${String.fromCharCode(65 + i)} cannot be empty.`, "warning");
        return;
      }
    }
    const updated = [...parsedQuestions];
    updated[editingQuestionIndex] = {
      ...updated[editingQuestionIndex],
      question: editingQuestionForm.question.trim(),
      options: editingQuestionForm.options.map((opt) => opt.trim()),
      correctAnswerIndex: editingQuestionForm.correct_option_index,
      correct_answer: editingQuestionForm.correct_answer,
      correct_option_index: editingQuestionForm.correct_option_index,
      difficulty: editingQuestionForm.difficulty || "Easy",
      topic: editingQuestionForm.topic || "",
      subTopic: editingQuestionForm.subTopic || "",
      subject: editingQuestionForm.type || "Technical",
      type: editingQuestionForm.type || "Technical",
      explanation: editingQuestionForm.explanation || "",
    };
    setParsedQuestions(updated);
    setEditingQuestionIndex(null);
  };

  const fetchModules = async () => {
    try {
      let queryPath = `/modules?where_moduleType==:${moduleType}`;
      if (parentId) {
        queryPath += `&where_parentId==:${parentId}`;
      }
      const res = await api.get(queryPath);
      if (res.success && res.modules) {
        let mods = res.modules.filter(
          (m) =>
            (m.moduleType || "general") === moduleType &&
            (m.parentId || null) === (parentId || null)
        );
        mods.sort((a, b) => {
          const orderA = a.displayOrder ?? 999999;
          const orderB = b.displayOrder ?? 999999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });
        setModules(mods);
      }
    } catch (err) {
      console.error("Fetch modules error:", err);
    }
  };

  useEffect(() => {
    fetchModules();
    const unsub = onSnapshot(
      query(collection(db, "modules")),
      (snapshot) => {
        let mods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Filter manually since we didn't index this field
        mods = mods.filter(
          (m) =>
            (m.moduleType || "general") === moduleType &&
            (m.parentId || null) === (parentId || null),
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
        let correctIdx = 0;

        if (
          q.options &&
          typeof q.options === "object" &&
          !Array.isArray(q.options)
        ) {
          const keys = Object.keys(q.options).sort();
          parsedOptions = keys.map((k) => q.options[k]);
          const correctKey = q.correct_answer || q.correctAnswer || "A";
          correctIdx =
            keys.indexOf(correctKey) >= 0 ? keys.indexOf(correctKey) : 0;
        } else if (Array.isArray(q.options)) {
          parsedOptions = q.options;
          if (typeof q.correctAnswerIndex === "number") {
            correctIdx = q.correctAnswerIndex;
          } else if (typeof q.correct_answer_index === "number") {
            correctIdx = q.correct_answer_index;
          } else if (typeof q.answer === "number") {
            correctIdx = q.answer;
          } else if (q.correct_answer !== undefined || q.correctAnswer !== undefined) {
            const ansVal = String(q.correct_answer !== undefined ? q.correct_answer : q.correctAnswer).trim();
            if (/^\d+$/.test(ansVal)) {
              correctIdx = parseInt(ansVal, 10);
            } else {
              const letter = ansVal.toUpperCase();
              if (letter === "A" || letter.startsWith("A")) correctIdx = 0;
              else if (letter === "B" || letter.startsWith("B")) correctIdx = 1;
              else if (letter === "C" || letter.startsWith("C")) correctIdx = 2;
              else if (letter === "D" || letter.startsWith("D")) correctIdx = 3;
              else {
                const optIdx = parsedOptions.findIndex(opt => String(opt).includes(ansVal) || ansVal.includes(String(opt)));
                correctIdx = optIdx >= 0 ? optIdx : 0;
              }
            }
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
          const correctKey = q.correct_answer || q.correctAnswer || "A";
          correctIdx =
            keys.indexOf(correctKey) >= 0
              ? keys.indexOf(correctKey)
              : typeof q.correctAnswerIndex === "number"
                ? q.correctAnswerIndex
                : 0;
        }

        return {
          id: getSafeUUID(),
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
      id: getSafeUUID(),
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
    setError("");
    try {
      if (!rawText || !rawText.trim()) {
        throw new Error("JSON text is empty. Please paste a valid JSON array of questions.");
      }

      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
      } catch (err) {
        let sanitizedText = rawText;
        const mathCommands = [
          "frac", "cdot", "times", "int", "partial", "infty", "begin", "end",
          "omega", "pi", "Delta", "nabla", "alpha", "beta", "gamma", "theta",
          "lambda", "mu", "sigma", "phi", "psi", "tau", "rho", "sum", "prod",
          "lim", "log", "sin", "cos", "tan", "sec", "csc", "cot", "sqrt",
          "text", "textbf", "emph", "nu", "xi", "zeta", "eta", "iota",
          "kappa", "chi", "upsilon", "Leftarrow", "Rightarrow", "leftrightarrow",
          "updownarrow", "Leftrightarrow", "Updownarrow", "rightarrow", "leftarrow",
          "geq", "leq", "neq", "approx", "equiv", "propto", "pm", "mp",
          "div", "circ", "bullet", "oplus", "otimes", "vee", "wedge",
          "cap", "cup", "subset", "supset", "subseteq", "supseteq", "in"
        ];
        mathCommands.forEach((cmd) => {
          const regex = new RegExp(`(?<!\\\\)\\\\${cmd}\\b`, "g");
          sanitizedText = sanitizedText.replace(regex, `\\\\${cmd}`);
        });

        try {
          parsed = JSON.parse(sanitizedText);
        } catch (e2) {
          try {
            parsed = eval(`(${rawText})`);
          } catch (e3) {
            throw new Error(`JSON Syntax Error: Invalid JSON text.\nReason: ${err.message}\nMake sure your text is a valid JSON array starting with '[' and ending with ']'.`);
          }
        }
      }

      if (!Array.isArray(parsed)) {
        throw new Error(
          "Validation Error: Bulk upload only accepts a top-level JSON array [ ... ]. Received a single object or non-array format."
        );
      }

      if (parsed.length === 0) {
        throw new Error("Validation Error: Uploaded question array is empty. At least 1 question is required.");
      }

      const requiredFields = [
        "id",
        "type",
        "difficulty",
        "topic",
        "sub_topic",
        "question",
        "options",
        "correct_answer",
        "correct_option_index",
      ];
      const allowedFields = [
        "id",
        "type",
        "difficulty",
        "topic",
        "sub_topic",
        "question",
        "options",
        "correct_answer",
        "correct_option_index",
        "explanation",
        "image",
        "svg_code",
      ];

      const formattedQs = parsed.map((q, idx) => {
        const rowNum = idx + 1;
        const qIdLabel = q && typeof q === "object" && q.id ? ` (${q.id})` : "";

        if (!q || typeof q !== "object" || Array.isArray(q)) {
          throw new Error(`Row ${rowNum}${qIdLabel}: Item must be a valid JSON object.`);
        }

        const keys = Object.keys(q);

        // 1. Missing required fields check
        for (const field of requiredFields) {
          if (!(field in q)) {
            throw new Error(
              `Row ${rowNum}${qIdLabel}:\nMissing required field "${field}".\nExpected standard fields: ${requiredFields.join(", ")}.`
            );
          }
          if (typeof q[field] === "string" && q[field].trim() === "") {
            throw new Error(
              `Row ${rowNum}${qIdLabel}:\nRequired field "${field}" cannot be an empty string.`
            );
          }
        }

        // 2. Extra/unrecognized fields check
        const extraKeys = keys.filter((k) => !allowedFields.includes(k));
        if (extraKeys.length > 0) {
          throw new Error(
            `Row ${rowNum}${qIdLabel}:\nExtra/unrecognized field(s) found: "${extraKeys.join('", "')}". Only standard fields are allowed.`
          );
        }

        // 3. Options validation (Must be array of EXACTLY 4 non-empty strings)
        if (!Array.isArray(q.options)) {
          throw new Error(
            `Row ${rowNum}${qIdLabel}:\nInvalid "options" data type. Expected an array of 4 option strings.`
          );
        }
        if (q.options.length !== 4) {
          throw new Error(
            `Row ${rowNum}${qIdLabel}:\nInvalid "options" count. Expected exactly 4 options, but received ${q.options.length}.`
          );
        }
        for (let oIdx = 0; oIdx < 4; oIdx++) {
          const optVal = q.options[oIdx];
          if (typeof optVal !== "string" || optVal.trim() === "") {
            throw new Error(
              `Row ${rowNum}${qIdLabel}:\nOption ${String.fromCharCode(65 + oIdx)} (index ${oIdx}) must be a non-empty string.`
            );
          }
        }

        // 4. correct_answer validation (Must be EXACTLY "A", "B", "C", or "D")
        const validAnswers = ["A", "B", "C", "D"];
        if (typeof q.correct_answer !== "string" || !validAnswers.includes(q.correct_answer)) {
          throw new Error(
            `Row ${rowNum}${qIdLabel}:\nInvalid correct_answer.\nExpected one of: A, B, C, D.\nReceived: ${JSON.stringify(q.correct_answer)}`
          );
        }

        // 5. correct_option_index validation (Must be integer 0, 1, 2, or 3)
        const validIndexes = [0, 1, 2, 3];
        if (
          typeof q.correct_option_index !== "number" ||
          !Number.isInteger(q.correct_option_index) ||
          !validIndexes.includes(q.correct_option_index)
        ) {
          throw new Error(
            `Row ${rowNum}${qIdLabel}:\nInvalid correct_option_index.\nExpected one of: 0, 1, 2, 3.\nReceived: ${JSON.stringify(q.correct_option_index)}`
          );
        }

        // 6. Synchronization check
        const letterToIdxMap = { A: 0, B: 1, C: 2, D: 3 };
        const idxToLetterMap = { 0: "A", 1: "B", 2: "C", 3: "D" };
        const expectedIndex = letterToIdxMap[q.correct_answer];
        if (q.correct_option_index !== expectedIndex) {
          throw new Error(
            `Row ${rowNum}${qIdLabel}:\nMismatched correct_answer and correct_option_index!\n"correct_answer": "${q.correct_answer}" corresponds to index ${expectedIndex}, but "correct_option_index" was set to ${q.correct_option_index} (which corresponds to "${idxToLetterMap[q.correct_option_index]}").`
          );
        }

        return {
          id: String(q.id).trim(),
          question: String(q.question).trim(),
          options: q.options.map((opt) => String(opt).trim()),
          correctAnswerIndex: q.correct_option_index,
          correct_answer: q.correct_answer,
          correct_option_index: q.correct_option_index,
          subject: String(q.type).trim(),
          type: String(q.type).trim(),
          topic: String(q.topic).trim(),
          subTopic: String(q.sub_topic).trim(),
          difficulty: String(q.difficulty).trim(),
          explanation: q.explanation ? String(q.explanation).trim() : undefined,
          image: q.image || (q.svg_code ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(q.svg_code)))}` : undefined),
        };
      });

      setPendingImportQuestions(formattedQs);
      setIsImportPreviewOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePendingQuestion = (index) => {
    const updated = pendingImportQuestions.filter((_, idx) => idx !== index);
    setPendingImportQuestions(updated);
    if (updated.length === 0) {
      setIsImportPreviewOpen(false);
    }
  };

  const handleConfirmImport = () => {
    setParsedQuestions((prev) => [...prev, ...pendingImportQuestions]);
    setPendingImportQuestions([]);
    setIsImportPreviewOpen(false);
    setRawText("");
    setError("");
  };

  const handleCancelImport = () => {
    setPendingImportQuestions([]);
    setIsImportPreviewOpen(false);
  };

  const handleSaveModule = async () => {
    if (!title) {
      setError("Title is required.");
      return;
    }

    const moduleId = editingModuleId || getSafeUUID();
    const existing = editingModuleId
      ? modules.find((x) => x.id === editingModuleId)
      : null;

    const newModule = JSON.parse(
      JSON.stringify({
        id: moduleId,
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
        branchId: moduleType === "company" ? branchId : undefined,
      }),
    );

    try {
      await api.post("/modules", newModule);
      await setDoc(doc(db, "modules", moduleId), newModule).catch(() => {});



      if (isContentManager) {
        await logAudit(
          userName,
          `${editingModuleId ? "Updated" : "Created"} Module: ${title}`,
        );
      }

      showToast(editingModuleId ? "Module updated successfully!" : "Module published successfully!", "success");

      setIsCreating(false);
      setEditingModuleId(null);
      setTitle("");
      setDescription("");
      setCategory("Technical");
      setBranchId("");
      setRawText("");
      setParsedQuestions([]);
      setAccessMode("inherit");
      setAccessType("free");
      setPrice(0);
      await fetchModules();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "modules");
      const errMsg = err.message || "Failed to save module to database.";
      setError(errMsg);
      showToast("Error: " + errMsg, "error");
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

    const moduleId = editingModuleId || getSafeUUID();
    const existing = editingModuleId
      ? modules.find((x) => x.id === editingModuleId)
      : null;

    const newModule = JSON.parse(
      JSON.stringify({
        id: moduleId,
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
        branchId: moduleType === "company" ? branchId : undefined,
      }),
    );

    try {
      await api.post("/modules", newModule);
      await setDoc(doc(db, "modules", moduleId), newModule).catch(() => {});



      if (isContentManager) {
        await logAudit(
          userName,
          `${editingModuleId ? "Updated" : "Created"} Master Module: ${title}`,
        );
      }

      showToast(editingModuleId ? "Master Module updated successfully!" : "Master Module published successfully!", "success");

      setIsCreatingMaster(false);
      setEditingModuleId(null);
      setTitle("");
      setDescription("");
      setBranchId("");
      setSelectedSubModules([]);
      setAccessMode("inherit");
      setAccessType("free");
      setPrice(0);
      await fetchModules();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "modules");
      const errMsg = err.message || "Failed to save master module to database.";
      setError(errMsg);
      showToast("Error: " + errMsg, "error");
    }
  };

  const confirmDeleteModule = async () => {
    if (!deleteModuleInfo) return;
    const { id, title: moduleTitle } = deleteModuleInfo;

    try {
      await api.delete(`/modules/${id}`).catch((e) => console.error("API module delete error:", e));
      await deleteDoc(doc(db, "modules", id)).catch(() => {});

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
      showToast(`Failed to delete module: ${err.message}`, "error");
    } finally {
      setDeleteModuleInfo(null);
    }
  };

  const initiateDeleteModule = (id, moduleTitle) => {
    const mod = modules.find((m) => m.id === id);
    if (isContentManager && mod && mod.createdBy !== userName) {
      showToast(
        "You are not authorized to delete this module. Only the creator or a Super Admin can delete it.",
        "warning"
      );
      return;
    }
    setDeleteModuleInfo({ id, title: moduleTitle });
  };

  const handleEditModule = async (m) => {
    if (isContentManager && m.createdBy && m.createdBy !== userName) {
      showToast("You are not authorized to edit this module. Only the creator or a Super Admin can edit it.", "warning");
      return;
    }

    let fetchedQuestions = m.questions || [];
    // If the questions are empty/placeholder, lazy load them
    if (!fetchedQuestions || fetchedQuestions.length === 0 || Object.keys(fetchedQuestions[0]).length === 0) {
      try {
        const res = await api.get(`/modules/${m.id}/questions`);
        fetchedQuestions = res.questions || [];
      } catch (err) {
        showToast("Failed to load questions for editing: " + err.message, "error");
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
    setBranchId(m.branchId || m.branch_id || "");
  };

  const cancelEdit = () => {
    setIsCreating(false);
    setIsCreatingMaster(false);
    setEditingModuleId(null);
    setTitle("");
    setDescription("");
    setCategory("Technical");
    setBranchId("");
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
            {moduleType === "company" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Branch
                </label>
                <select
                  required
                  value={branchId || ""}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Choose Branch --</option>
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                      showToast(
                        "Prompt copied to clipboard! Paste it into any AI to generate questions.",
                        "success"
                      );
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Copy Prompt for External AI</span>
                  </button>
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  Supported Formats Example:
                  <pre className="mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] overflow-x-auto">
                    {`[
  {
    "id": "REF_Q01",
    "type": "Technical",
    "difficulty": "Easy",
    "topic": "Fundamentals",
    "sub_topic": "Ohm's Law",
    "question": "What is the equivalent resistance of two 10 Ω resistors connected in series?",
    "options": ["5 Ω", "20 Ω", "100 Ω", "10 Ω"],
    "correct_answer": "B",
    "correct_option_index": 1
  }
]`}
                  </pre>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl space-y-1.5 my-3 text-rose-800 dark:text-rose-200 animate-in fade-in duration-150 shadow-sm">
                    <div className="flex items-center space-x-2 font-bold text-sm text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>Format Error Detected</span>
                    </div>
                    <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap pl-7">
                      {error}
                    </p>
                    <div className="pl-7 pt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      💡 Tip: Please check the highlighted question number or JSON formatting above and fix the issue before importing.
                    </div>
                  </div>
                )}

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
                  onClick={() => {
                    setParsedQuestions([]);
                    setQuestionsPage(1);
                  }}
                  className="text-sm text-rose-600 hover:text-rose-500 font-bold"
                >
                  Clear All
                </button>
              </div>

              {/* Paginated Question List */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {parsedQuestions
                  .slice(
                    (questionsPage - 1) * QUESTIONS_PER_PAGE,
                    questionsPage * QUESTIONS_PER_PAGE
                  )
                  .map((q, pIdx) => {
                    const globalIdx = (questionsPage - 1) * QUESTIONS_PER_PAGE + pIdx;
                    return (
                      <div
                        key={q.id || globalIdx}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-slate-900 dark:text-white flex-1 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                                {q.subject || q.type || "Technical"}
                              </span>
                              {q.difficulty && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                                  {q.difficulty}
                                </span>
                              )}
                              {q.topic && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                  {q.topic}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-500 mr-2">{globalIdx + 1}.</span>
                            <MathText content={q.question} />
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleStartEditQuestion(globalIdx)}
                              className="p-1 px-2 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold border border-indigo-200 dark:border-indigo-800/50"
                              title="Edit Question & Answer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() =>
                                setParsedQuestions(
                                  parsedQuestions.filter((_, idx) => idx !== globalIdx)
                                )
                              }
                              className="p-1 px-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold border border-rose-200 dark:border-rose-800/50"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {q.image && (
                          <SvgDiagram
                            svgCode={q.image}
                            className="max-h-40"
                            containerClassName="mb-3"
                          />
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`px-3 py-2 rounded-lg text-sm flex items-start ${
                                q.correctAnswerIndex === oIdx
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold"
                                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <span className="mr-2 shrink-0 font-bold">
                                {String.fromCharCode(65 + oIdx)}.
                              </span>
                              <div className="flex-1">
                                {opt.startsWith("data:image/") || opt.trim().startsWith("<svg") ? (
                                  <SvgDiagram
                                    svgCode={opt}
                                    className="max-h-24 w-auto object-contain"
                                    containerClassName=""
                                  />
                                ) : (
                                  <MathText content={opt} />
                                )}
                              </div>
                              {q.correctAnswerIndex === oIdx && (
                                <span className="ml-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                  ✓ (Correct)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center justify-between pt-1 text-xs text-slate-500">
                          <label className="cursor-pointer inline-flex items-center px-2.5 py-1 border border-slate-300 dark:border-slate-600 shadow-sm text-xs font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                            <span>{q.image ? "Replace Image" : "Attach Diagram"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(globalIdx, e)}
                            />
                          </label>
                          <span className="font-semibold text-slate-400">
                            ID: {q.id || `Q_${globalIdx + 1}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Question Pagination Controls */}
              {parsedQuestions.length > QUESTIONS_PER_PAGE && (
                <div className="flex items-center justify-between px-2 py-2 border-t border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span>
                    Showing { (questionsPage - 1) * QUESTIONS_PER_PAGE + 1 } - { Math.min(questionsPage * QUESTIONS_PER_PAGE, parsedQuestions.length) } of { parsedQuestions.length } questions
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={questionsPage === 1}
                      onClick={() => setQuestionsPage((prev) => Math.max(1, prev - 1))}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Page {questionsPage} of {Math.ceil(parsedQuestions.length / QUESTIONS_PER_PAGE)}
                    </span>
                    <button
                      disabled={questionsPage >= Math.ceil(parsedQuestions.length / QUESTIONS_PER_PAGE)}
                      onClick={() => setQuestionsPage((prev) => Math.min(Math.ceil(parsedQuestions.length / QUESTIONS_PER_PAGE), prev + 1))}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveModule}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition-colors mt-4"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {editingModuleId ? "Update Module" : "Publish Module"}
              </button>
            </div>
          )}

          {/* Edit Question Modal with Auto-Sync */}
          {editingQuestionIndex !== null && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Edit className="w-5 h-5 text-indigo-500" />
                    Edit Question #{editingQuestionIndex + 1}
                  </h3>
                  <button
                    onClick={() => setEditingQuestionIndex(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {/* Question Text */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Question Text
                    </label>
                    <textarea
                      rows={3}
                      value={editingQuestionForm.question}
                      onChange={(e) =>
                        setEditingQuestionForm({ ...editingQuestionForm, question: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* 4 Options */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Options (Exactly 4)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {["A", "B", "C", "D"].map((letter, oIdx) => (
                        <div key={letter} className="flex items-center space-x-2">
                          <span className="w-6 text-xs font-extrabold text-slate-500 text-center">
                            {letter}.
                          </span>
                          <input
                            type="text"
                            value={editingQuestionForm.options[oIdx]}
                            onChange={(e) => {
                              const opts = [...editingQuestionForm.options];
                              opts[oIdx] = e.target.value;
                              setEditingQuestionForm({ ...editingQuestionForm, options: opts });
                            }}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Synced Correct Answer & Option Index */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        Correct Answer (A, B, C, D)
                      </label>
                      <select
                        value={editingQuestionForm.correct_answer}
                        onChange={(e) => handleEditQuestionAnswerChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        Correct Option Index (0, 1, 2, 3)
                      </label>
                      <select
                        value={editingQuestionForm.correct_option_index}
                        onChange={(e) => handleEditQuestionIndexChange(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                      >
                        <option value={0}>Index 0 (Option A)</option>
                        <option value={1}>Index 1 (Option B)</option>
                        <option value={2}>Index 2 (Option C)</option>
                        <option value={3}>Index 3 (Option D)</option>
                      </select>
                    </div>
                  </div>

                  {/* Metadata Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Difficulty
                      </label>
                      <select
                        value={editingQuestionForm.difficulty}
                        onChange={(e) =>
                          setEditingQuestionForm({ ...editingQuestionForm, difficulty: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Topic
                      </label>
                      <input
                        type="text"
                        value={editingQuestionForm.topic}
                        onChange={(e) =>
                          setEditingQuestionForm({ ...editingQuestionForm, topic: e.target.value })
                        }
                        placeholder="e.g. Fundamentals"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Sub Topic
                      </label>
                      <input
                        type="text"
                        value={editingQuestionForm.subTopic}
                        onChange={(e) =>
                          setEditingQuestionForm({ ...editingQuestionForm, subTopic: e.target.value })
                        }
                        placeholder="e.g. Ohm's Law"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Type / Subject
                    </label>
                    <input
                      type="text"
                      value={editingQuestionForm.type}
                      onChange={(e) =>
                        setEditingQuestionForm({ ...editingQuestionForm, type: e.target.value })
                      }
                      placeholder="e.g. Technical"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setEditingQuestionIndex(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedQuestion}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-md flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Question Changes</span>
                  </button>
                </div>
              </div>
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
              disabled={false}
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
                            showToast("Failed to load questions for preview: " + err.message, "error");
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
                    {(q.image || q.svgCode || q.svg_code) && (
                      <SvgDiagram
                        svgCode={q.image || q.svgCode || q.svg_code}
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

      {/* Import Confirmation Preview Modal */}
      {isImportPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-500" />
                  Question Import Preview ({pendingImportQuestions.length} Questions)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Please review the questions, options, and correct answers before adding them to your module.
                </p>
              </div>
              <button
                onClick={handleCancelImport}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Cancel Import"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable Question List */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-50/50 dark:bg-slate-950/50">
              {pendingImportQuestions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                        Question {qIdx + 1} of {pendingImportQuestions.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {q.difficulty && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            q.difficulty.toLowerCase() === "easy"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : q.difficulty.toLowerCase() === "medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      )}
                      {q.topic && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {q.topic}
                        </span>
                      )}
                      {q.subTopic && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {q.subTopic}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeletePendingQuestion(qIdx)}
                        className="p-1 px-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 dark:text-rose-300 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold border border-rose-200 dark:border-rose-800/50 ml-2"
                        title="Delete this question from import"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    <MathText content={q.question} />
                  </div>

                  {(q.image || q.svgCode || q.svg_code) && (
                    <SvgDiagram
                      svgCode={q.image || q.svgCode || q.svg_code}
                      className="max-h-48"
                      containerClassName="my-3"
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = q.correctAnswerIndex === oIdx;
                      return (
                        <div
                          key={oIdx}
                          className={`px-4 py-3 rounded-xl border flex items-center transition-colors ${
                            isCorrect
                              ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700"
                              : "bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold mr-3 shrink-0 ${
                              isCorrect
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {String.fromCharCode(65 + oIdx)}
                          </div>
                          <div
                            className={`flex-1 text-sm ${
                              isCorrect
                                ? "text-emerald-950 dark:text-emerald-100 font-semibold"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {opt.startsWith("data:image/") || opt.trim().startsWith("<svg") ? (
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
                            <span className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-2">
                              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" />
                              (Correct)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
                        Explanation
                      </p>
                      <div className="text-xs text-indigo-900 dark:text-indigo-200">
                        <MathText content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Found any errors? Click <strong>Cancel & Edit Code</strong> to modify your JSON.
              </span>
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  onClick={handleCancelImport}
                  className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel & Edit Code
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Add ({pendingImportQuestions.length} Questions)</span>
                </button>
              </div>
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
