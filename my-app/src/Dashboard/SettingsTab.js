import React, { useState } from 'react';
import { FaLock, FaUnlock, FaDatabase, FaUserShield, FaSitemap, FaSignOutAlt } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc } from 'firebase/firestore';

const SettingsTab = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await signOut(auth);
        navigate('/login'); 
      } catch (error) {
        console.error("Logout Error:", error);
      }
    }
  };

  const handleGenerateBrackets = async () => {
    setIsGenerating(true);
    try {
      const teamsSnap = await getDocs(collection(db, "teams"));
      const allTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status === "approved");

      if (allTeams.length < 2) {
        alert("Need at least 2 approved teams to generate brackets!");
        setIsGenerating(false);
        return;
      }

      const shuffled = allTeams.sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          await addDoc(collection(db, "matches"), {
            team1: shuffled[i].teamName,
            team2: shuffled[i + 1].teamName,
            date: "TBD",
            time: "TBD",
            status: "upcoming",
            round: "Round of " + (allTeams.length <= 16 ? "16" : "32")
          });
        } else {
          alert(`Team ${shuffled[i].teamName} assigned a BYE for the first round.`);
        }
      }
      alert("Tournament Brackets Generated Successfully!");
    } catch (error) {
      console.error(error);
    }
    setIsGenerating(false);
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto pb-40 px-4">
      <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-white">
        <FaUserShield className="text-blue-500" /> Admin Control Room
      </h2>

      <div className="flex flex-col gap-4">
        <button 
          onClick={handleGenerateBrackets}
          disabled={isGenerating}
          className="glass p-6 rounded-[2rem] border border-blue-500/20 flex items-center justify-between group hover:bg-blue-600/10 transition-all text-left"
        >
          <div>
            <p className="text-blue-400 font-bold">Generate Tournament Brackets</p>
            <p className="text-slate-500 text-[10px] uppercase">Automated draw mechanism & matches</p>
          </div>
          <div className="bg-blue-600/20 p-4 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
            <FaSitemap className={isGenerating ? "animate-pulse" : ""} />
          </div>
        </button>
        <div className="glass p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-white font-bold">Registration Lock</p>
            <p className="text-slate-500 text-[10px] uppercase">No edits after tournament locking</p>
          </div>
          <button onClick={() => setIsLocked(!isLocked)} className={`size-14 rounded-2xl flex items-center justify-center transition-all ${isLocked ? 'bg-red-500 shadow-red-500/20 shadow-lg' : 'bg-green-500 shadow-green-500/20 shadow-lg'}`}>
            {isLocked ? <FaLock className="text-white" /> : <FaUnlock className="text-white" />}
          </button>
        </div>

        <div className="glass p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group">
          <div>
            <p className="text-white font-bold">Reset Database</p>
            <p className="text-red-500/60 text-[10px] uppercase font-bold tracking-widest text-xs">Clear all test records</p>
          </div>
          <button className="bg-red-500/10 text-red-500 p-4 rounded-xl hover:bg-red-500 hover:text-white transition-all">
            <FaDatabase />
          </button>
        </div>
        <button 
          onClick={handleLogout}
          className="mt-8 glass p-6 rounded-[2rem] border border-red-500/20 flex items-center justify-between group hover:bg-red-500/10 transition-all"
        >
          <div>
            <p className="text-red-500 font-bold">Sign Out</p>
            <p className="text-slate-500 text-[10px] uppercase">Exit admin session securely</p>
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