import React, { useState } from 'react';
import { FaLock, FaUnlock, FaDatabase, FaUserShield, FaSitemap, FaSignOutAlt, FaKey, FaSave, FaTools, FaExclamationTriangle, FaArrowLeft } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';

const SettingsTab = ({ onBack }) => {
  const [isLocked, setIsLocked] = useState(false);
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

      const teamsData = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const existingTeamIds = teamsData.map(t => t.id);
      
      let fixCount = 0;

      // 1. Fix Users (Source of truth for their own status)
      usersSnap.docs.forEach(userDoc => {
        const userData = userDoc.data();
        // If user thinks they are in a team but team is gone
        if (userData.hasTeam && !existingTeamIds.includes(userData.teamId)) {
          batch.update(userDoc.ref, { hasTeam: false, teamId: "", assignedTeam: "" });
          fixCount++;
        }
      });

      // 2. Fix Teams (Sync member lists with actual users who have this teamId)
      teamsSnap.docs.forEach(teamDoc => {
        const teamData = teamDoc.data();
        const actualMembers = usersData.filter(u => u.teamId === teamDoc.id);
        const actualMemberIds = actualMembers.map(m => m.id);
        const actualMemberNames = actualMembers.map(m => m.name || "Unknown");

        // Check if member lists are out of sync
        const currentIds = teamData.memberIds || [];
        const currentNames = teamData.members || [];
        
        const isIdsSync = JSON.stringify([...currentIds].sort()) === JSON.stringify([...actualMemberIds].sort());
        const isNamesSync = JSON.stringify([...currentNames].sort()) === JSON.stringify([...actualMemberNames].sort());
        
        if (!isIdsSync || !isNamesSync) {
          const updateData = {
            memberIds: actualMemberIds,
            members: actualMemberNames
          };

          // Also check if captain is still in the team
          if (teamData.captainId && !actualMemberIds.includes(teamData.captainId)) {
             if (actualMembers.length > 0) {
                updateData.captainId = actualMembers[0].id;
                updateData.captainName = actualMembers[0].name || "Unknown";
             }
          }

          batch.update(teamDoc.ref, updateData);
          fixCount++;
        }
      });

      if (fixCount > 0) {
        await batch.commit();
        alert(`Deep Repair Complete! Fixed ${fixCount} data inconsistencies.`);
      } else {
        alert("Database is perfectly synced! No issues found.");
      }
    } catch (error) { 
      console.error(error); 
      alert("Repair failed: " + error.message);
    }
    setIsFixing(false);
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
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-slate-900 to-emerald-950/30">
      <div className="relative max-w-4xl mx-auto px-4 py-8">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group"
          >
            <FaArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
              <FaUserShield className="text-emerald-500" /> 
              Admin Control Room
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Manage security, database, and tournament settings
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Security Section */}
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-emerald-500/30 transition-all">
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FaKey className="text-emerald-500 text-lg" />
                <h3 className="text-white font-bold text-lg">Admin Security</h3>
              </div>
              <p className="text-slate-500 text-xs mt-1">Change your account password</p>
            </div>
            <div className="p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  placeholder="Enter New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500 transition-all"
                />
                <button 
                  onClick={handleUpdatePassword} 
                  disabled={isUpdating} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all disabled:opacity-50"
                >
                  <FaSave size={14} /> {isUpdating ? "Saving..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>

          {/* Maintenance Tools */}
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-emerald-500/30 transition-all">
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FaTools className="text-emerald-500 text-lg" />
                <h3 className="text-white font-bold text-lg">Maintenance Tools</h3>
              </div>
              <p className="text-slate-500 text-xs mt-1">Database cleanup and system utilities</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={handleFixDatabase} 
                  disabled={isFixing} 
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all disabled:opacity-50"
                >
                  <FaTools className={isFixing ? "animate-spin" : ""} size={14} />
                  {isFixing ? "Fixing..." : "Fix Ghost Players"}
                </button>

                <button 
                  onClick={() => setIsLocked(!isLocked)} 
                  className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                    isLocked 
                      ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30' 
                      : 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                  }`}
                >
                  {isLocked ? <FaLock size={14} /> : <FaUnlock size={14} />}
                  {isLocked ? "System Locked" : "System Open"}
                </button>
              </div>
            </div>
          </div>



          {/* Danger Zone */}
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-red-500/20 overflow-hidden hover:border-red-500/40 transition-all">
            <div className="p-5 border-b border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-2">
                <FaExclamationTriangle className="text-red-500 text-lg" />
                <h3 className="text-red-500 font-bold text-lg">Danger Zone</h3>
              </div>
              <p className="text-red-500/60 text-xs mt-1">Irreversible actions - proceed with caution</p>
            </div>
            <div className="p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={handleResetSystem} 
                  disabled={isResetting} 
                  className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all disabled:opacity-50"
                >
                  <FaDatabase size={14} />
                  {isResetting ? "Resetting..." : "Full System Reset"}
                </button>
                
                <button 
                  onClick={handleLogout} 
                  className="flex-1 bg-slate-800 border border-white/10 text-gray-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
                >
                  <FaSignOutAlt size={14} />
                  Sign Out
                </button>
              </div>
              <p className="text-slate-600 text-[10px] text-center mt-3 uppercase tracking-wider">
                ⚠️ Reset will clear all teams, matches, and player stats
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;