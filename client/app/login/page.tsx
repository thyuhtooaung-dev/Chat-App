"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      router.push("/chat");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter both username and password.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const endpoint = isRegister ? "/auth/register" : "/auth/login";

    try {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (!data.user || !data.agoraToken) {
        throw new Error("Invalid response from server");
      }

      localStorage.setItem("currentUser", JSON.stringify(data.user));
      localStorage.setItem("agoraToken", data.agoraToken);

      router.push("/chat");
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "An error occurred during authentication";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-tr from-blue-600 to-purple-600 mb-4 shadow-lg shadow-blue-500/20">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? "Create an Account" : "Welcome Back"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister
              ? "Sign up to start chatting with your friends in real-time"
              : "Sign in to access your direct messages and group chats"}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-2 font-bold hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-3 rounded-xl text-sm transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                {isRegister ? "Creating Account..." : "Signing In..."}
              </>
            ) : isRegister ? (
              "Sign Up"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account yet?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMessage(null);
            }}
            className="text-blue-400 hover:text-blue-300 font-semibold underline ml-1"
          >
            {isRegister ? "Sign In" : "Create One"}
          </button>
        </div>
      </div>
    </div>
  );
}
