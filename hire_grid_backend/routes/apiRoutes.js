const express = require("express");
const router = express.Router();
const dataController = require("../controllers/dataController");
const parseController = require("../controllers/parseController");
const authMiddleware = require("../middlewares/authMiddleware");

// Parse MCQ (Gemini)
router.post("/parse-mcq", parseController.parseMcq);

// Modules
router.get("/modules", dataController.getModules);
router.post("/modules", dataController.saveModules);
router.delete("/modules/:id", dataController.deleteModule);

// Scores
router.post("/scores", dataController.submitScore);

// Leaderboard
router.get("/leaderboard", dataController.getLeaderboard);

// Stats
router.get("/stats", dataController.getStats);

// Companies
router.get("/companies", dataController.getCompanies);
router.post("/companies", dataController.saveCompany);
router.delete("/companies/:id", dataController.deleteCompany);

// Exams
router.get("/exams", dataController.getExams);
router.post("/exams", dataController.saveExam);
router.delete("/exams/:id", dataController.deleteExam);

// Settings
router.get("/settings/:id", dataController.getSettings);
router.post("/settings/:id", dataController.saveSettings);

// Payment Requests
router.get("/payment-requests", dataController.getPaymentRequests);
router.post("/payment-requests", dataController.createPaymentRequest);
router.put("/payment-requests/:id", dataController.updatePaymentRequest);

// Hierarchy Nodes
router.get("/hierarchy-nodes", dataController.getHierarchyNodes);
router.post("/hierarchy-nodes", dataController.saveHierarchyNode);
router.delete("/hierarchy-nodes/:id", dataController.deleteHierarchyNode);

// Notifications
router.get("/notifications", dataController.getNotifications);
router.post("/notifications", dataController.saveNotification);
router.delete("/notifications/:id", dataController.deleteNotification);

// GATE
router.get("/gate/branches", dataController.getGateBranches);
router.post("/gate/branches", dataController.saveGateBranch);
router.get("/gate/papers", dataController.getGatePapers);
router.post("/gate/papers", dataController.saveGatePaper);

// User Management (Admin)
router.get("/users", dataController.getUsers);
router.get("/users/:id", dataController.getUserById);
router.put("/users/:id", dataController.updateUser);
router.delete("/users/:id", dataController.deleteUser);

// Admin User Management
router.get("/admin_users", dataController.getAdminUsers);
router.post("/admin_users", dataController.saveAdminUser);
router.put("/admin_users/:id", dataController.updateAdminUser);
router.delete("/admin_users/:id", dataController.deleteAdminUser);

// Audit Logs
router.get("/audit-logs", dataController.getAuditLogs);
router.post("/audit-logs", dataController.createAuditLog);

// Access & Device Requests
router.get("/access-requests", dataController.getAccessRequests);
router.post("/access-requests", dataController.createAccessRequest);
router.get("/device-requests", dataController.getDeviceRequests);
router.post("/device-requests", dataController.createDeviceRequest);

// Plans
router.get("/plans", dataController.getPlans);

// Feedbacks
router.get("/feedbacks", dataController.getFeedbacks);
router.post("/feedbacks", dataController.createFeedback);
router.delete("/feedbacks/:id", dataController.deleteFeedback);

module.exports = router;
