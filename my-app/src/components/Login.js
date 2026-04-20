import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { FaUser, FaLock, FaGraduationCap, FaShieldAlt } from "react-icons/fa";
import '../index.css';

function Login() {
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState("student");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const q = query(
        collection(db, "users"),
        where("studentCode", "==", studentCode.trim())
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("This Student ID is not registered.");
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      const userCredential = await signInWithEmailAndPassword(
        auth,
        userEmail,
        password
      );

      const user = userCredential.user;
      const isManuallyVerified = userData.isVerified === true;

      if (!user.emailVerified && !isManuallyVerified) {
        setError("Please verify your university email or contact admin.");
        await signOut(auth);
        setLoading(false);
        return;
      }

      localStorage.setItem("role", userData.role);
      localStorage.setItem("userId", user.uid);

      navigate(userData.role === "admin" ? "/admin" : "/student");

    } catch (err) {
      console.error(err.code);
      setError("Invalid Student ID or Password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-black via-slate-900 to-[#0a1927] font-['Lexend'] flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#00FF9C]/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00FF9C]/5 rounded-full blur-[150px]"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-gradient-to-br from-[#121821] to-[#0a0f16] rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-sm">
          
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-black font-black text-2xl">SFC</span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-1">Sign in to your account</h2>
          </div>

          {/* User Type Toggle */}
          <div className="px-8 pt-6 pb-2">
            <div className="bg-black/30 rounded-lg p-1 border border-white/10">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setUserType("student")}
                  className={`flex-1 py-2 rounded-md font-medium transition-all text-sm ${
                    userType === "student"
                      ? "bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("admin")}
                  className={`flex-1 py-2 rounded-md font-medium transition-all text-sm ${
                    userType === "admin"
                      ? "bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            {/* Student ID Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Student ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your student ID"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                />
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                />
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/20 bg-black/30 text-[#00FF9C] focus:ring-[#00FF9C] focus:ring-offset-0"
                />
                <span className="text-sm text-gray-400">Remember me</span>
              </label>
              <Link
                to="/Forgetpassword"
                className="text-sm text-gray-400 hover:text-[#00FF9C] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-semibold py-2.5 rounded-lg hover:scale-105 transition-all duration-300 glow-on-hover disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                `Sign In as ${userType === "student" ? "Student" : "Admin"}`
              )}
            </button>

            {/* Sign Up Link */}
            <div className="text-center pt-2">
              <p className="text-sm text-gray-400">
                Don't have an account?{" "}
                <Link to="/register" className="text-[#00FF9C] hover:text-[#00FF9C]/80 font-medium transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer Note */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Secure login powered by University Authentication System
        </p>
      </div>

      <style>{`
        .glow-on-hover:hover {
          box-shadow: 0 0 12px rgba(0, 255, 156, 0.3);
        }
      `}</style>
    </div>
  );
}

export default Login;