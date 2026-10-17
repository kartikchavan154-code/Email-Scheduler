import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { ComposePage } from './pages/ComposePage';
import { SendersPage } from './pages/SendersPage';
import { SlackSettingsPage } from './pages/SlackSettingsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#00A854] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-500 font-medium">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/scheduled" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="scheduled" element={<ScheduledPage />} />
            <Route path="sent" element={<SentPage />} />
            <Route path="email/:id" element={<EmailDetailPage />} />
            <Route path="compose" element={<ComposePage />} />
            <Route path="senders" element={<SendersPage />} />
            <Route path="settings" element={<SlackSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/scheduled" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
