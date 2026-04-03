import React, { useState } from 'react';
import { FaLock, FaUnlock, FaDatabase, FaUserShield, FaSitemap, FaSignOutAlt, FaKey, FaSave, FaTools, FaExclamationTriangle } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';

const SettingsTab = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPassword, setNewPassword] = useState(""); 
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
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
      alert("Error: Please logout and login again (Security requirement).");
    }
    setIsUpdating(false);
  };
  const handleFixDatabase = async () => {
    setIsFixing(true);
    try {
      const batch = writeBatch(db);
      const teamsSnap = await getDocs(collection(db, "teams"));
      const usersSnap = await getDocs(collection(db, "users"));
      
      const existingTeamIds = teamsSnap.docs.map(d => d.id);
      let fixCount = 0;

      usersSnap.docs.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.hasTeam && !existingTeamIds.includes(userData.teamId)) {
          batch.update(doc(db, "users", userDoc.id), {
            hasTeam: false,
            teamId: "",
            assignedTeam: ""
          });
          fixCount++;
        }
      });

      if (fixCount > 0) {
        await batch.commit();
        alert(`Done! Fixed ${fixCount} "lost" players.`);
      } else {
        alert("Database is healthy! No ghost players found.");
      }
    } catch (error) { console.error(error); }
    setIsFixing(false);
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
      const batch = writeBatch(db);

      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          const matchRef = doc(collection(db, "matches"));
          batch.set(matchRef, {
            team1: shuffled[i].teamName,
            team2: shuffled[i + 1].teamName,
            status: "upcoming",
            round: "Knockout Stage",
            createdAt: new Date()
          });
        }
      }
      await batch.commit();
      alert("Tournament Brackets Generated!");
    } catch (error) { console.error(error); }
    setIsGenerating(false);
  };

  const handleResetSystem = async () => {
    if (!window.confirm("CRITICAL WARNING: This will wipe EVERYTHING (Teams, Matches, Player Stats). Continue?")) return;
    
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      
      const collections = ["teams", "matches"];
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        snap.docs.forEach(d => batch.delete(doc(db, colName, d.id)));
      }
      
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.docs.forEach(d => {
        batch.update(doc(db, "users", d.id), { 
          goals: 0, 
          yellowCards: 0, 
          redCards: 0, 
          hasTeam: false, 
          teamId: "", 
          assignedTeam: "" 
        });
      });

      await batch.commit();
      alert("System Reset Successfully!");
    } catch (error) { 
        console.error(error); 
        alert("Reset failed.");
    }
    setIsResetting(false);
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto pb-40 px-4">
      <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-white">
        <FaUserShield className="text-blue-500" /> Admin Control Room
      </h2>

      <div className="flex flex-col gap-4">
        
        {/* Security Section */}
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
            <button onClick={handleUpdatePassword} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all">
              <FaSave /> {isUpdating ? "Saving..." : "Update"}
            </button>
          </div>
        </div>
        
        {/* Maintenance Tools - NEW SECTION */}
        <div className="grid grid-cols-2 gap-4">
            <button onClick={handleFixDatabase} disabled={isFixing} className="glass p-5 rounded-[2rem] border border-emerald-500/20 flex flex-col items-center gap-2 hover:bg-emerald-500/10 transition-all">
                <FaTools className={`text-emerald-500 ${isFixing ? 'animate-spin' : ''}`} />
                <span className="text-[10px] text-white font-bold uppercase">Fix Ghost Players</span>
            </button>

            <button onClick={() => setIsLocked(!isLocked)} className={`glass p-5 rounded-[2rem] border border-white/5 flex flex-col items-center gap-2 transition-all ${isLocked ? 'bg-red-500/10 border-red-500/30' : 'hover:bg-white/5'}`}>
                {isLocked ? <FaLock className="text-red-500" /> : <FaUnlock className="text-blue-500" />}
                <span className="text-[10px] text-white font-bold uppercase">{isLocked ? "System Locked" : "System Open"}</span>
            </button>
        </div>

        {/* Generate Brackets */}
        <button onClick={handleGenerateBrackets} disabled={isGenerating} className="glass p-6 rounded-[2rem] border border-blue-500/20 flex items-center justify-between group hover:bg-blue-600/10 transition-all text-left">
          <div>
            <p className="text-blue-400 font-bold">Generate Tournament Brackets</p>
            <p className="text-slate-500 text-[10px] uppercase font-black">Randomized match allocation</p>
          </div>
          <div className="bg-blue-600/20 p-4 rounded-2xl text-blue-500 group-hover:rotate-180 transition-all duration-500">
            <FaSitemap className={isGenerating ? "animate-spin" : ""} />
          </div>
        </button>

        {/* Reset Section */}
        <div className="glass p-6 rounded-[2rem] border border-red-500/10 flex items-center justify-between group bg-red-500/[0.02]">
          <div>
            <p className="text-white font-bold flex items-center gap-2">Reset Tournament <FaExclamationTriangle className="text-red-500 text-xs" /></p>
            <p className="text-red-500 text-[10px] uppercase font-black tracking-widest italic opacity-60">Clear all data & reset stats</p>
          </div>
          <button onClick={handleResetSystem} disabled={isResetting} className="bg-red-500/10 text-red-500 p-4 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-inner">
            {isResetting ? "Wait..." : <FaDatabase />}
          </button>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="mt-8 glass p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:bg-red-500/10 transition-all">
          <p className="text-slate-400 group-hover:text-red-500 font-bold uppercase text-xs transition-colors">Exit Admin Session</p>
          <div className="bg-white/5 p-4 rounded-2xl text-slate-500 group-hover:text-red-500 transition-all">
            <FaSignOutAlt />
          </div>
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;