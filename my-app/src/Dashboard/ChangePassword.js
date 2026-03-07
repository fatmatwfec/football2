import React, { useState } from "react";
import { auth } from "../firebase";
import { updatePassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const ChangePassword = () => {

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // التحقق من أن الباسوردين متطابقين
    if (password !== confirmPassword) {
      setMessage("Passwords do not match ");
      return;
    }

    try {
      const user = auth.currentUser;
      await updatePassword(user, password);
      setMessage("Password updated successfully ");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage("Not Strong Password");
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