import React, { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/admin/AdminRoute";
import AdminLayout from "./components/admin/AdminLayout";
import { ToastProvider } from "./context/ToastContext";
import { DarkModeProvider } from "./context/DarkModeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { LanguageProvider } from "./context/LanguageContext";
import { TranslationProvider } from "./context/TranslationContext";
import { CallProvider } from "./context/CallContext";
import { CallNotificationProvider } from "./context/CallNotificationContext";

// Lazy-loaded route components — only downloaded when navigated to
const Auth = React.lazy(() => import("./pages/Auth"));
const Home = React.lazy(() => import("./pages/Home"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminReports = React.lazy(() => import("./pages/admin/AdminReports"));

// Lazy-loaded call overlays — rarely needed on initial load
const IncomingCallModal = React.lazy(() => import("./components/call/IncomingCallModal"));
const CallScreen = React.lazy(() => import("./components/call/CallScreen"));

/* Full-screen loading spinner shown while lazy chunks download */
const PageLoader = () => (
  <div className="h-[100dvh] w-full flex items-center justify-center bg-gray-50 dark:bg-neutral-900">
    <div className="flex flex-col items-center gap-3">
      <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span className="text-sm text-gray-500 dark:text-neutral-400 font-medium">Loading…</span>
    </div>
  </div>
);

function App() {
  return (
    <div className="transition-colors duration-300">
      <ToastProvider>
        <DarkModeProvider>
          <LanguageProvider>
            <TranslationProvider>
              <CallProvider>
                <CallNotificationProvider>
                <NotificationProvider>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Auth />} />

              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/*"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="reports" element={<AdminReports />} />
              </Route>
            </Routes>
            </Suspense>
                </NotificationProvider>
                </CallNotificationProvider>
                <Suspense fallback={null}>
                  <IncomingCallModal />
                  <CallScreen />
                </Suspense>
              </CallProvider>
            </TranslationProvider>
          </LanguageProvider>
        </DarkModeProvider>
      </ToastProvider>
    </div>
  );
}

export default App;
