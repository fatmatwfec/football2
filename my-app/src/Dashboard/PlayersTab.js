import React, { useState } from 'react';
import { FaMagic, FaUserShield, FaRunning, FaCheckCircle, FaUserCheck } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

const PlayersTab = ({ players }) => {
  const [isBuilding, setIsBuilding] = useState(false);
  
  const freeAgents = players.filter(p => 
    (p.role === "student" || p.role === "player") && (p.hasTeam === false || p.hasTeam === undefined)
  );

  const handleManualVerify = async (playerId, playerName) => {
    if (window.confirm(`Activate account for ${playerName} manually?`)) {
      try {
        const userRef = doc(db, "users", playerId);
        await updateDoc(userRef, {
          isVerified: true,
          manualActivation: true
        });
        alert("Account activated successfully!");
      } catch (e) {
        console.error(e);
        alert("Error activating account.");
      }
    }
  };

  const handleAutoBuild = async () => {
    if (freeAgents.length < 5) {
      alert(`Need at least 5 free agents. Current available: ${freeAgents.length}`);
      return;
    }

    if (!window.confirm(`Are you sure you want to pull the first 5 players and create a new team?`)) return;

    setIsBuilding(true);
    try {
      const selectedPlayers = freeAgents.slice(0, 5);
      const teamIdNumber = Math.floor(1000 + Math.random() * 9000);
      const teamName = `Alpha-${teamIdNumber}`;
      const teamRef = await addDoc(collection(db, "teams"), {
        teamName: teamName,
        captainName: selectedPlayers[0].name, 
        status: "approved",
        createdAt: new Date(),
        members: selectedPlayers.map(p => p.name),
        category: "General League"
      });
      for (let player of selectedPlayers) {
        const userRef = doc(db, "users", player.id);
        await updateDoc(userRef, {
          hasTeam: true,
          teamId: teamRef.id,
          assignedTeam: teamName
        });
      }

      alert(`Success! ${teamName} has been formed with 5 players.`);
    } catch (error) {
      console.error("Error auto-building team:", error);
      alert("Something went wrong while building the team.");
    }
    setIsBuilding(false);
  };

  return (
    <div className="animate-in slide-in-from-right duration-500 w-full pb-40 px-2">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaRunning className="text-blue-500" /> Free Agents Pool
          </h2>
          <p className="text-slate-400 text-[10px] mt-1 font-black uppercase tracking-widest">
            Manage student verification & rosters
          </p>
        </div>
        <div className="bg-blue-600/20 px-4 py-2 rounded-2xl border border-blue-500/30 flex items-center gap-2 shadow-lg">
          <div className="size-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-blue-500 font-bold text-xs">{freeAgents.length} Available</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {freeAgents.length > 0 ? freeAgents.map((p) => (
          <div key={p.id} className="glass rounded-[2rem] p-5 flex flex-col items-center gap-4 border-2 border-transparent hover:border-blue-500/40 transition-all group relative overflow-hidden shadow-xl">

            <div className="absolute -right-4 -top-4 size-20 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/15 transition-all"></div>
            
            <div className="size-24 rounded-3xl bg-slate-900/50 border border-white/10 p-1 group-hover:scale-105 transition-transform duration-500">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name || p.id}`} 
                alt="player" 
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>

            <div className="text-center z-10 space-y-2">
              <p className="text-white font-bold text-sm truncate w-28 tracking-tight">{p.name || "Unknown"}</p>
              
              {!p.isVerified ? (
                <button 
                  onClick={() => handleManualVerify(p.id, p.name)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-orange-500/20 rounded-full border border-orange-500/40 hover:bg-orange-500 transition-colors text-orange-400 hover:text-white"
                >
                  <FaUserCheck className="text-[10px]" />
                  <span className="text-[9px] font-black uppercase">Activate</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <FaCheckCircle className="text-[10px] text-blue-500" />
                  <p className="text-blue-400 text-[9px] font-black uppercase">Verified</p>
                </div>
              )}
            </div>
          </div>
        )) : (
          <div className="col-span-full py-32 text-center">
            <p className="text-slate-500 italic">No free agents found.</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-28 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
        <button 
          onClick={handleAutoBuild}
          disabled={isBuilding || freeAgents.length < 5}
          className="pointer-events-auto w-full max-w-md bg-[#bef264] hover:bg-lime-400 text-slate-900 h-16 rounded-3xl flex items-center justify-center gap-4 font-black shadow-2xl shadow-lime-500/50 transition-all active:scale-95 disabled:opacity-50"
        >
          <FaMagic className={`${isBuilding ? "animate-spin" : "animate-bounce"}`} />
          <span className="tracking-tighter text-lg uppercase font-black">
             {isBuilding ? "Creating Team..." : "Auto-Build (5 Players)"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default PlayersTab;