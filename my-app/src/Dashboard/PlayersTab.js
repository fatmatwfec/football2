import React, { useState } from 'react';
import { FaMagic, FaUserShield, FaRunning, FaCheckCircle, FaUserCheck, FaKey, FaTrashAlt } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';

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

  const handleDeleteUser = async (playerId, playerName) => {
    if (window.confirm(`Are you sure you want to delete ${playerName}? They will need to register again.`)) {
      try {
        await deleteDoc(doc(db, "users", playerId));
        alert("User deleted from database.");
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleAutoBuild = async () => {
    if (freeAgents.length < 5) {
      alert(`Need at least 5 free agents. Current available: ${freeAgents.length}`);
      return;
    }

    if (!window.confirm(`Build a team with the first 5 available players?`)) return;

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

      alert(`Success! ${teamName} has been formed.`);
    } catch (error) {
      console.error(error);
      alert("Error building team.");
    }
    setIsBuilding(false);
  };

  return (
    <div className="animate-in slide-in-from-right duration-500 w-full pb-40 px-2">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaRunning className="text-blue-500" /> Players Management
          </h2>
          <p className="text-slate-400 text-[10px] mt-1 font-black uppercase tracking-widest italic">
            Admin Power: Verify, Reset, and Build
          </p>
        </div>
        <div className="bg-blue-600/20 px-4 py-2 rounded-2xl border border-blue-500/30 flex items-center gap-2">
          <span className="text-blue-500 font-bold text-xs">{freeAgents.length} Free Agents</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {freeAgents.length > 0 ? freeAgents.map((p) => (
          <div key={p.id} className="glass rounded-[2.5rem] p-6 border border-white/5 group relative transition-all hover:border-blue-500/30 shadow-2xl">
            
          
            <button onClick={() => handleDeleteUser(p.id, p.name)} className="absolute top-4 right-4 text-slate-700 hover:text-red-500 transition-colors">
              <FaTrashAlt size={12} />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="size-16 rounded-2xl bg-slate-900 border border-white/10 p-1">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name || p.id}`} 
                  alt="avatar" 
                  className="w-full h-full rounded-xl"
                />
              </div>
              <div className="overflow-hidden">
                <p className="text-white font-bold text-sm truncate">{p.name || "Unknown"}</p>
                <p className="text-slate-500 text-[10px] font-mono">ID: {p.studentCode}</p>
              </div>
            </div>

          
            <div className="bg-slate-950/50 rounded-2xl p-3 border border-white/5 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                  <FaKey className="text-blue-500" /> Password
                </span>
              </div>
              <p className="text-xs text-yellow-500 font-mono font-bold tracking-wider italic">
                {p.password || "No pass stored"}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              
              {!p.isVerified ? (
                <button 
                  onClick={() => handleManualVerify(p.id, p.name)}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                >
                  <FaUserCheck /> Manual Activate
                </button>
              ) : (
                <div className="w-full py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                  <FaCheckCircle /> Account Verified
                </div>
              )}
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center opacity-30 italic text-sm">
            All registered students are currently assigned to teams.
          </div>
        )}
      </div>

    
      <div className="fixed bottom-28 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
        <button 
          onClick={handleAutoBuild}
          disabled={isBuilding || freeAgents.length < 5}
          className="pointer-events-auto w-full max-w-sm bg-[#bef264] hover:bg-lime-400 text-slate-900 h-14 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl shadow-lime-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <FaMagic className={isBuilding ? "animate-spin" : ""} />
          <span className="uppercase text-sm">Auto-Build Squad</span>
        </button>
      </div>
    </div>
  );
};

export default PlayersTab;