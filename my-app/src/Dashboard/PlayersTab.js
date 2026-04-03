import React, { useState } from 'react';
import { FaMagic, FaRunning, FaCheckCircle, FaUserCheck, FaKey, FaTrashAlt, FaTimes, FaUserMinus } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const PlayersTab = ({ players }) => {
  const [activeSubTab, setActiveSubTab] = useState("free");
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false); 
  const [customTeamName, setCustomTeamName] = useState("");
  const [playerCount, setPlayerCount] = useState(5); 

  const displayedPlayers = players.filter(p => {
    const isPlayer = (p.role === "student" || p.role === "player");
    const hasTeam = (p.hasTeam === true);
    return activeSubTab === "free" ? (isPlayer && !hasTeam) : (isPlayer && hasTeam);
  });

  const freeAgentsCount = players.filter(p => (p.role === "student" || p.role === "player") && !p.hasTeam).length;

  const handleManualVerify = async (playerId, playerName) => {
    if (window.confirm(`Activate account for ${playerName} manually?`)) {
      try {
        await updateDoc(doc(db, "users", playerId), { isVerified: true, manualActivation: true });
      } catch (e) { console.error(e); }
    }
  };

  const handleAction = async (player) => {
    if (player.hasTeam) {
      if (window.confirm(`Remove ${player.name} from their team? They will become a Free Agent.`)) {
        try {
          const batch = writeBatch(db);
          
          batch.update(doc(db, "users", player.id), { 
            hasTeam: false, 
            assignedTeam: null, 
            teamId: null 
          });

          if (player.teamId) {
            const teamRef = doc(db, "teams", player.teamId);
          }

          await batch.commit();
          alert(`${player.name} is now a Free Agent.`);
        } catch (e) { console.error(e); }
      }
    } else {
      if (window.confirm(`Are you sure you want to delete ${player.name} permanently?`)) {
        try {
          await deleteDoc(doc(db, "users", player.id));
        } catch (e) { console.error(e); }
      }
    }
  };

  const handleAutoBuild = async () => {
    const freeAgents = players.filter(p => (p.role === "student" || p.role === "player") && !p.hasTeam);
    if (freeAgents.length < playerCount) return alert("Not enough free agents.");

    setIsBuilding(true);
    const batch = writeBatch(db);

    try {
      const selectedPlayers = freeAgents.slice(0, playerCount);
      const teamIdNumber = Math.floor(1000 + Math.random() * 9000);
      const teamName = customTeamName.trim() || `Alpha-${teamIdNumber}`;
      
      const newTeamRef = doc(collection(db, "teams"));

      batch.set(newTeamRef, {
        teamName,
        captainName: selectedPlayers[0].name, 
        status: "approved",
        createdAt: new Date(),
        members: selectedPlayers.map(p => p.name),
        memberIds: selectedPlayers.map(p => p.id) 
      });

      selectedPlayers.forEach(player => {
        const userRef = doc(db, "users", player.id);
        batch.update(userRef, {
          hasTeam: true,
          teamId: newTeamRef.id,
          assignedTeam: teamName
        });
      });

      await batch.commit();
      
      setShowBuildModal(false);
      setCustomTeamName(""); 
      alert(`Team ${teamName} created successfully!`);
    } catch (error) { 
      console.error(error); 
      alert("Something went wrong during team building.");
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
          <div className="flex gap-2 mt-4">
            <button onClick={() => setActiveSubTab("free")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${activeSubTab === 'free' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
              Free Agents ({freeAgentsCount})
            </button>
            <button onClick={() => setActiveSubTab("team")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${activeSubTab === 'team' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
              In Teams ({players.filter(p => p.hasTeam).length})
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayedPlayers.length > 0 ? displayedPlayers.map((p) => (
          <div key={p.id} className="glass rounded-[2.5rem] p-6 border border-white/5 group relative transition-all hover:border-blue-500/30 shadow-2xl">
            
            <button onClick={() => handleAction(p)} className="absolute top-4 right-4 text-slate-700 hover:text-red-500 transition-colors">
              {p.hasTeam ? <FaUserMinus size={14} title="Kick from Team" /> : <FaTrashAlt size={12} title="Delete Permanent" />}
            </button>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-900 border border-white/10 p-0.5 shadow-lg overflow-hidden">
                <img 
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${p.name}&backgroundColor=1e293b,3b82f6,0ea5e9&fontSize=45&bold=true`} 
                  alt="avatar" 
                  className="w-full h-full rounded-xl"
                />
              </div>
              <div className="overflow-hidden">
                <p className="text-white font-bold text-sm truncate">{p.name || "Unknown"}</p>
                <p className="text-slate-500 text-[10px] font-mono">ID: {p.studentCode}</p>
                {p.assignedTeam && <p className="text-blue-500 text-[8px] font-bold uppercase truncate mt-0.5">Team: {p.assignedTeam}</p>}
              </div>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-3 border border-white/5 mb-4">
              <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1"><FaKey className="text-blue-500" /> Password</span>
              <p className="text-xs text-yellow-500 font-mono font-bold italic">{p.password || "No pass"}</p>
            </div>

            {!p.isVerified ? (
              <button onClick={() => handleManualVerify(p.id, p.name)} className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                <FaUserCheck /> Manual Activate
              </button>
            ) : (
              <div className="w-full py-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                <FaCheckCircle /> Account Verified
              </div>
            )}
          </div>
        )) : (
          <div className="col-span-full py-20 text-center opacity-30 italic text-sm text-white">No players in this section.</div>
        )}
      </div>

      {activeSubTab === "free" && (
        <div className="fixed bottom-28 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
            <button onClick={() => setShowBuildModal(true)} disabled={freeAgentsCount < 2} className="pointer-events-auto w-full max-w-sm bg-[#bef264] hover:bg-lime-400 text-slate-900 h-14 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl shadow-lime-500/20 transition-all active:scale-95 disabled:opacity-50">
            <FaMagic /> <span className="uppercase text-sm">Create Custom Squad</span>
            </button>
        </div>
      )}

      {showBuildModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 relative animate-in zoom-in duration-300">
            <button onClick={() => setShowBuildModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><FaTimes /></button>
            <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2"><FaMagic className="text-lime-400" /> Build New Team</h3>
            <div className="space-y-6">
              <input type="text" value={customTeamName} onChange={(e) => setCustomTeamName(e.target.value)} placeholder="Team Name (Optional)" className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-lime-400 transition-all"/>
              <div className="grid grid-cols-6 gap-2">
                {[2, 3, 4, 5, 6, 7].map(num => (
                  <button key={num} onClick={() => setPlayerCount(num)} className={`h-10 rounded-xl text-xs font-bold transition-all ${playerCount === num ? 'bg-lime-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>{num}</button>
                ))}
              </div>
              <button onClick={handleAutoBuild} disabled={isBuilding || freeAgentsCount < playerCount} className="w-full bg-lime-400 text-slate-900 py-4 rounded-2xl font-black uppercase text-sm shadow-lg shadow-lime-500/20 active:scale-95 transition-all">
                {isBuilding ? "Processing..." : `Form Team with ${playerCount} Players`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayersTab;