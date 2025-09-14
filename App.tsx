import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import UploadReport from './pages/UploadReport'; // ✅ new page
import Layout from './components/Layout';
import { UserRole } from './types';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  );
};

const Main: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary">
        <p className="text-xl text-gray-700">Authenticating...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Login route */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          user ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Reports (all roles see their version) */}
                <Route path="/reports" element={<Reports />} />

                {/* ✅ Only Clinic Staff can access Upload */}
                {user.role === UserRole.CLINIC && (
                  <Route path="/upload" element={<UploadReport />} />
                )}

                {/* ✅ Only Admins can access User Management */}
                {user.role === UserRole.ADMIN && (
                  <Route path="/users" element={<UserManagement />} />
                )}

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
};

export default App;
