import React, { useState } from "react";
import { auth, db } from "../firebase";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";

function ChangePassword() {
  const [yourPassword, setYourPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters!");
      return;
    }

    // التحقق من أن الباسوردين متطابقين
    if (password !== confirmPassword) {
      setMessage("Passwords do not match ");
      return;
    }

    setIsUpdating(true);
    setMessage("");

    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, yourPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, password);
      setMessage("Password updated successfully ");
      setYourPassword("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage("Not Strong Password");
      if (err.code === "auth/too-many-requests") {
        setMessage("too many trying");
      } else if (err.code === "auth/wrong-password") {
        setMessage("Your Current Password is Wrong ");
      } else {
        setMessage("Something is Wrong");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">

      {/* Navbar */}
      <nav className="w-full border-b border-white/10 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text">
            SCI-FOOTBALL
          </h1>
          <button
            onClick={() => navigate("/student")}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition"
          >
            Back
          </button>
        </div>
      </nav>

      {/* Page Content */}
      <div className="flex items-center justify-center p-6">

        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">

          <h2 className="text-2xl font-bold mb-6 text-center">
            Change Your Password
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-4">

            <div>
              <label className="text-gray-400 text-sm">Current Password</label>
              <input
                type="password"
                placeholder="Enter Your Password"
                value={yourPassword}
                onChange={(e) => setYourPassword(e.target.value)}
                required
                className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* New Password */}
            <div>
              <label className="text-gray-400 text-sm">New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-gray-400 text-sm">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full mt-2 p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:border-green-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl transition"
            >
              Update Password
            </button>

          </form>

          {message && (
            <p className="text-center text-sm text-gray-300 mt-4">
              {message}
            </p>
          )}

        </div>
      </div>
    </div>
  );
};

export default ChangePassword;