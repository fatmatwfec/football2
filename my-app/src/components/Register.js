import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaPhoneAlt, FaLock, FaEnvelope, FaIdCard, FaArrowLeft } from "react-icons/fa";
import '../index.css';

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email.endsWith("edu.eg")) {
      setError("Please use your university email (@edu.eg)");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters!");
      setLoading(false);
      return;
    }

    if (phone.length !== 11) {
      setError("Please enter a valid 11-digit phone number.");
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode.trim()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setError("This Student ID is already registered!");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        studentCode: studentCode.trim(),
        phone: phone,
        email: email,
        password: password,
        role: "student",
        uid: userCredential.user.uid,
        hasTeam: false,
        isVerified: false,
        createdAt: new Date()
      });

      alert(
        `Registration Successful!\n\n` +
        `A verification link has been sent to: ${email}\n` +
        `Please check your inbox and verify your email before logging in.`
      );
      navigate("/Login");

    } catch (err) {
      console.error(err.code);
      if (err.code === "auth/email-already-in-use") {
        setError("Email is already in use.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-slate-900 to-[#0a1927] font-['Lexend']">

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#00FF9C]/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00FF9C]/5 rounded-full blur-[150px]"></div>
      </div>

      {/* Page Content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-73px)] p-6 overflow-y-auto">

        <div className="w-full max-w-lg">
          <div className="bg-gradient-to-br from-[#121821] to-[#0a0f16] rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-sm">

            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
              <div className="w-16 h-16 bg-gradient-to-br from-[#00FF9C]/10 to-emerald-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#00FF9C]/20">
                <FaUser className="text-[#00FF9C] text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
              <p className="text-gray-400 text-l">Join the Science FC Championship</p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="p-8 space-y-4">

              {/* Full Name */}
              <div>
                <label className="block text-l font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                  />
                  <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-l font-medium text-gray-300 mb-2">
                  University Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="your.name@edu.eg"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                  />
                  <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                </div>
              </div>

              {/* Student ID */}
              <div>
                <label className="block text-l font-medium text-gray-300 mb-2">
                  Student ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter your student ID"
                    required
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                  />
                  <FaIdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-l font-medium text-gray-300 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                  />
                  <FaPhoneAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-l font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Create a password (min. 6 characters)"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                  />
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-l font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Confirm your password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all"
                  />
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-l text-center">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold py-3 rounded-xl hover:scale-105 transition-all duration-300 glow-on-hover disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    Creating Account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>

              {/* Login Link */}
              <div className="text-center pt-2">
                <p className="text-sm text-gray-400">
                  Already have an account?{" "}
                  <span
                    onClick={() => navigate('/Login')}
                    className="text-[#00FF9C] hover:text-[#00FF9C]/80 font-medium cursor-pointer transition-colors"
                  >
                    Sign In
                  </span>
                </p>
              </div>
            </form>

            {/* Footer Note */}
            <div className="px-8 pb-8 text-center">
              <p className="text-sm text-gray-500">
                By registering, you agree to our terms and conditions
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
}

export default Register;