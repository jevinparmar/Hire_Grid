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

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<StudentAuth />} />
        <Route path="/admin" element={<AdminAuth />} />
        <Route
          path="/student-dashboard"
          element={
            isAuthenticated() ? <StudentDashboard /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            isAuthenticated() && getStoredRole() === "admin"
              ? <AdminDashboard />
              : <Navigate to="/admin" replace />
          }
        />
        <Route
          path="/content-manager-dashboard"
          element={
            isAuthenticated() && getStoredRole() === "content_manager"
              ? <ContentManagerDashboard />
              : <Navigate to="/admin" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
