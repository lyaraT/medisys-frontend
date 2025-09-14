import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { BeakerIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/solid";

const Login: React.FC = () => {
  const { login } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setRedirecting(true);
    try {
      await login(); // Should redirect to Cognito Hosted UI
      // No code runs after a successful redirect.
    } catch (e: any) {
      setRedirecting(false);
      setError(e?.message ?? "Failed to start login. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
        <div className="flex items-center justify-center mb-8">
          <BeakerIcon className="h-12 w-12 text-primary" />
          <h1 className="ml-3 text-3xl font-bold text-gray-800">MediSys</h1>
        </div>

        <h2 className="text-center text-2xl font-semibold text-gray-600 mb-2">
          Diagnostic Portal
        </h2>
        <p className="text-center text-gray-500 mb-8">
          Sign in using our secure authentication provider.
        </p>

        <button
          onClick={handleLogin}
          disabled={redirecting}
          className="w-full flex items-center justify-center bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-transform transform hover:scale-105 disabled:opacity-70 disabled:hover:scale-100"
          aria-busy={redirecting}
          aria-disabled={redirecting}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
          {redirecting ? "Redirecting…" : "Proceed to Secure Login"}
        </button>

        {error && (
          <div className="mt-4 text-center text-sm text-red-600">{error}</div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>
            You will be redirected to the official MediSys login page to enter
            your credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
