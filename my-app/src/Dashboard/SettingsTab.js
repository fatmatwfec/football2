import React, { useState } from 'react';
import { FaLock, FaUnlock, FaDatabase, FaUserShield, FaSitemap, FaSignOutAlt, FaKey, FaSave } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

const SettingsTab = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPassword, setNewPassword] = useState(""); 
  const [isUpdating, setIsUpdating] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await signOut(auth);
        navigate('/login'); 
      } catch (error) { console.error(error); }
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return alert("Password must be at least 6 characters!");
    setIsUpdating(true);
    try {
      const user = auth.currentUser;
      await updatePassword(user, newPassword);
      alert("Password updated successfully!");
      setNewPassword("");
    } catch (error) {
      console.error(error);
      alert("Error: Please logout and login again to update password (Security requirement).");
    }
    setIsUpdating(false);
  };

  const handleGenerateBrackets = async () => {
    setIsGenerating(true);
    try {
      const teamsSnap = await getDocs(collection(db, "teams"));
      const allTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status === "approved");

      if (allTeams.length < 2) {
        alert("Need at least 2 approved teams!");
        setIsGenerating(false);
        return;
      }

      const shuffled = allTeams.sort(() => 0.5 - Math.random());
      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          await addDoc(collection(db, "matches"), {
            team1: shuffled[i].teamName,
            team2: shuffled[i + 1].teamName,
            status: "upcoming",
            round: "Knockout Stage",
            createdAt: new Date()
          });
        }
      }
      alert("Tournament Brackets Generated!");
    } catch (error) { console.error(error); }
    setIsGenerating(false);
  };

  const handleResetSystem = async () => {
    if (!window.confirm("DANGER: This will delete ALL teams and matches. Students accounts will remain. Proceed?")) return;
    try {
      const teamsSnap = await getDocs(collection(db, "teams"));
      const matchesSnap = await getDocs(collection(db, "matches"));
      
      for (let d of teamsSnap.docs) { await deleteDoc(doc(db, "teams", d.id)); }
    
      for (let d of matchesSnap.docs) { await deleteDoc(doc(db, "matches", d.id)); }
      
      alert("System Reset Successfully! You can start a new tournament.");
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto pb-40 px-4">
      <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-white">
        <FaUserShield className="text-blue-500" /> Admin Control Room
      </h2>

      <div className="flex flex-col gap-4">
        
        <div className="glass p-6 rounded-[2rem] border border-white/5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <FaKey className="text-yellow-500" />
            <p className="text-white font-bold">Admin Security</p>
          </div>
          <div className="flex gap-2">
            <input 
              type="password" 
              placeholder="Enter New Password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleUpdatePassword}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all"
            >
              <FaSave /> {isUpdating ? "Saving..." : "Update"}
            </button>
          </div>
        </div>
        <button onClick={handleGenerateBrackets} disabled={isGenerating} className="glass p-6 rounded-[2rem] border border-blue-500/20 flex items-center justify-between group hover:bg-blue-600/10 transition-all text-left">
          <div>
            <p className="text-blue-400 font-bold">Generate Tournament Brackets</p>
            <p className="text-slate-500 text-[10px] uppercase font-black">Randomized match allocation</p>
          </div>
          <div className="bg-blue-600/20 p-4 rounded-2xl text-blue-500 group-hover:rotate-180 transition-all duration-500">
            <FaSitemap className={isGenerating ? "animate-spin" : ""} />
          </div>
        </button>

        <div className="glass p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-white font-bold">Registration Lock</p>
            <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">Freeze all entries</p>
          </div>
          <button onClick={() => setIsLocked(!isLocked)} className={`size-14 rounded-2xl flex items-center justify-center transition-all ${isLocked ? 'bg-red-500 shadow-red-500/20' : 'bg-green-500 shadow-green-500/20 shadow-lg'}`}>
            {isLocked ? <FaLock className="text-white" /> : <FaUnlock className="text-white" />}
          </button>
        </div>

        <div className="glass p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group">
          <div>
            <p className="text-white font-bold">Reset Tournament</p>
            <p className="text-red-500 text-[10px] uppercase font-black tracking-widest italic">Clear teams & matches only</p>
          </div>
          <button onClick={handleResetSystem} className="bg-red-500/10 text-red-500 p-4 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-inner">
            <FaDatabase />
          </button>
        </div>

        <button onClick={handleLogout} className="mt-8 glass p-6 rounded-[2rem] border border-red-500/20 flex items-center justify-between group hover:bg-red-500/10 transition-all">
          <div>
            <p className="text-red-500 font-bold uppercase tracking-tighter">Exit Admin Session</p>
          </div>
          <div className="bg-red-500/20 p-4 rounded-2xl text-red-500 group-hover:translate-x-1 transition-transform">
            <FaSignOutAlt />
          </div>
        </button>

      </div>
    </div>
  );
};

export default SettingsTab;