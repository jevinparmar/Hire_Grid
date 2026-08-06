/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StudentAuth from "./pages/student/StudentAuth";
import AdminAuth from "./pages/admin/AdminAuth";
import StudentDashboard from "./pages/student/StudentDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ContentManagerDashboard from "./pages/admin/ContentManagerDashboard";
import { ToastContainer } from "./components/common/Toast";
import { isAuthenticated, getStoredRole } from "./lib/authGuard";

// Wrapper components ensure guards re-evaluate on every navigation/render
function ProtectedStudent() {
  return isAuthenticated() ? <StudentDashboard /> : <Navigate to="/" replace />;
}

function ProtectedAdmin() {
  if (!isAuthenticated()) return <Navigate to="/admin" replace />;
  const role = getStoredRole();
  if (role === "admin") return <AdminDashboard />;
  return <Navigate to="/admin" replace />;
}

function ProtectedContentManager() {
  if (!isAuthenticated()) return <Navigate to="/admin" replace />;
  const role = getStoredRole();
  if (role === "content_manager") return <ContentManagerDashboard />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<StudentAuth />} />
        <Route path="/admin" element={<AdminAuth />} />
        <Route path="/student-dashboard" element={<ProtectedStudent />} />
        <Route path="/admin-dashboard" element={<ProtectedAdmin />} />
        <Route path="/content-manager-dashboard" element={<ProtectedContentManager />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
