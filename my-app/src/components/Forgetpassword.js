import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { FaEnvelope, FaArrowLeft, FaKey, FaCheckCircle } from "react-icons/fa";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        setIsLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset link has been sent to your email! 📧");
            setEmail("");
        } catch (err) {
            console.error(err);
            if (err.code === "auth/user-not-found") {
                setError("No account found with this email address.");
            } else if (err.code === "auth/invalid-email") {
                setError("Please enter a valid email address.");
            } else {
                setError("Something went wrong. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-screen bg-gradient-to-br from-black via-slate-900 to-[#0a1927] font-['Lexend'] overflow-hidden">

            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-[#00FF9C]/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00FF9C]/5 rounded-full blur-[150px]"></div>
            </div>


            {/* Page Content */}
            <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-73px)] p-6">

                <div className="w-full max-w-md">
                    <div className="bg-gradient-to-br from-[#121821] to-[#0a0f16] rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-sm">

                        {/* Header */}
                        <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
                            <div className="w-16 h-16 bg-gradient-to-br from-[#00FF9C]/10 to-emerald-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#00FF9C]/20">
                                <FaKey className="text-[#00FF9C] text-2xl" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-1">Forgot Password?</h2>
                            <p className="text-gray-500 text-l ">Don't worry, we'll send you a reset link</p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleResetPassword} className="p-8 space-y-5">

                            {/* Email Field */}
                            <div>
                                <label className="block text-xl font-medium text-gray-300 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        placeholder="your.email@university.edu"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        dir="ltr"
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                                    />
                                    <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-l" />
                                </div>
                            </div>

                            {/* Success Message */}
                            {message && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <FaCheckCircle className="text-green-400 text-l" />
                                        <p className="text-green-400 text-l text-center">{message}</p>
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    <p className="text-red-400 text-l text-center">{error}</p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold py-3 rounded-xl hover:scale-105 transition-all duration-300 glow-on-hover disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        Sending...
                                    </div>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>

                            {/* Back to Login Link */}
                            <div className="text-center pt-2">
                                <Link
                                    to="/login"
                                    className="text-xl text-gray-400 hover:text-[#00FF9C] transition-colors inline-flex items-center gap-1"
                                >
                                    <FaArrowLeft className="text-l" />
                                    Back to Login
                                </Link>
                            </div>
                        </form>

                        {/* Footer Note */}
                        <div className="px-8 pb-8 text-center">
                            <p className="text-sm text-gray-500">
                                Check your spam folder if you don't see the email
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .glow-on-hover:hover {
                    box-shadow: 0 0 12px rgba(0, 255, 156, 0.3);
                }
            `}</style>
        </div>
    );
};

export default ForgotPassword;