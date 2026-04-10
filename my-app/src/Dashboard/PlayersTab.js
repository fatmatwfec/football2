import React, { useState } from 'react';
import { FaMagic, FaRunning, FaCheckCircle, FaUserCheck, FaKey, FaTrashAlt, FaTimes, FaUserMinus, FaSearch, FaStar } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const PlayersTab = ({ players }) => {
  const [activeSubTab, setActiveSubTab] = useState("free");
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false); 
  const [customTeamName, setCustomTeamName] = useState("");
  const [playerCount, setPlayerCount] = useState(5);
  const [searchTerm, setSearchTerm] = useState(""); 


  const sortedAllPlayers = [...players]
    .filter(p => p.role === "student" || p.role === "player")
    .sort((a, b) => (Number(b.goals) || 0) - (Number(a.goals) || 0));

  const displayedPlayers = players.filter(p => {
    const isPlayer = (p.role === "student" || p.role === "player");
    if (searchTerm.trim() !== "") {
      return isPlayer && p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    }
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
      if (window.confirm(`Remove ${player.name} from their team?`)) {
        try {
          const batch = writeBatch(db);
          batch.update(doc(db, "users", player.id), { hasTeam: false, assignedTeam: null, teamId: null });
          await batch.commit();
        } catch (e) { console.error(e); }
      }
    } else {
      if (window.confirm(`Delete ${player.name} permanently?`)) {
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
        batch.update(doc(db, "users", player.id), { hasTeam: true, teamId: newTeamRef.id, assignedTeam: teamName });
      });
      await batch.commit();
      setShowBuildModal(false);
      setCustomTeamName(""); 
    } catch (error) { console.error(error); }
    setIsBuilding(false);
  };

  return (
    <div className="animate-in slide-in-from-right duration-500 w-full pb-40 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 px-2 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <FaRunning className="text-blue-500" /> PLAYERS
          </h2>
          {!searchTerm && (
            <div className="flex gap-2 mt-4">
                <button onClick={() => setActiveSubTab("free")} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${activeSubTab === 'free' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                   Free Agents ({freeAgentsCount})
                </button>
                <button onClick={() => setActiveSubTab("team")} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${activeSubTab === 'team' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                   In Teams ({players.filter(p => p.hasTeam).length})
                </button>
            </div>
          )}
        </div>

        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Find player..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-blue-500 transition-all shadow-2xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {displayedPlayers.length > 0 ? displayedPlayers.map((p) => {
          const playerGoals = Number(p.goals) || 0;
          const playerRank = playerGoals > 0 ? sortedAllPlayers.findIndex(s => s.id === p.id) + 1 : "--";

          return (
            <div key={p.id} className="glass rounded-[3rem] p-8 border border-white/5 group relative transition-all hover:border-blue-500/30 shadow-2xl bg-slate-900/40">
              
              <button onClick={() => handleAction(p)} className="absolute top-6 right-6 text-slate-700 hover:text-red-500 transition-colors scale-110">
                {p.hasTeam ? <FaUserMinus size={18} /> : <FaTrashAlt size={16} />}
              </button>
              
              <div className="flex items-center gap-6 mb-6">
                <div className="size-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-900 border border-white/10 p-1 shadow-xl overflow-hidden shrink-0">
                  <img 
                    src={p.profilePic || p.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`} 
                    alt="avatar" 
                    className="w-full h-full rounded-2xl object-cover"
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="text-white font-black text-xl truncate tracking-tight uppercase">{p.name || "Unknown"}</p>
                  <p className="text-slate-500 text-xs font-mono mb-2 tracking-widest">ID: {p.studentCode}</p>
                  <div className={`inline-block px-4 py-1 rounded-full text-[10px] font-black uppercase ${p.hasTeam ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                     {p.hasTeam ? `Team: ${p.assignedTeam}` : 'Free Agent'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-600/10 rounded-[2rem] p-5 border border-blue-500/20 text-center">
                      <p className="text-[10px] text-blue-400 uppercase font-black mb-1">Goals</p>
                      <p className="text-3xl text-white font-black tracking-tighter">{playerGoals}</p>
                  </div>
                  <div className="bg-slate-950/50 rounded-[2rem] p-5 border border-white/5 text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Rank</p>
                      <p className="text-3xl text-yellow-500 font-black italic"># {playerRank}</p>
                  </div>
              </div>

              <div className="bg-slate-950/50 rounded-2xl p-5 border border-white/5 mb-6">
                <span className="text-[10px] text-slate-500 font-black uppercase flex items-center gap-2 mb-1"><FaKey className="text-blue-500" /> Access Key</span>
                <p className="text-xl text-yellow-500 font-mono font-black italic tracking-wider">{p.password || "********"}</p>
              </div>

              {!p.isVerified ? (
                <button onClick={() => handleManualVerify(p.id, p.name)} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-900/20">
                  <FaUserCheck size={18} /> Manual Activate
                </button>
              ) : (
                <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-3">
                  <FaCheckCircle size={18} /> Active Player
                </div>
              )}
            </div>
          );
        }) : (
          <div className="col-span-full py-32 text-center opacity-20 italic text-xl text-white font-black uppercase tracking-widest">No players found</div>
        )}
      </div>

      {activeSubTab === "free" && !searchTerm && (
        <div className="fixed bottom-28 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
            <button onClick={() => setShowBuildModal(true)} disabled={freeAgentsCount < 2} className="pointer-events-auto w-full max-w-md bg-[#bef264] hover:bg-lime-400 text-slate-900 h-16 rounded-[2rem] flex items-center justify-center gap-4 font-black shadow-2xl shadow-lime-500/30 transition-all active:scale-95 disabled:opacity-50">
            <FaMagic size={20} /> <span className="uppercase text-base tracking-tighter">Auto-Build Squad</span>
            </button>
        </div>
      )}

      {showBuildModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[3rem] p-10 relative animate-in zoom-in duration-300">
            <button onClick={() => setShowBuildModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white scale-125"><FaTimes /></button>
            <h3 className="text-white text-2xl font-black mb-8 flex items-center gap-3 tracking-tighter uppercase"><FaMagic className="text-lime-400" /> New Team</h3>
            <div className="space-y-8">
              <input type="text" value={customTeamName} onChange={(e) => setCustomTeamName(e.target.value)} placeholder="Team Name" className="w-full bg-slate-950 border border-white/10 rounded-2xl p-5 text-white text-base outline-none focus:border-lime-400 transition-all shadow-inner"/>
              <div className="grid grid-cols-6 gap-3">
                {[2, 3, 4, 5, 6, 7].map(num => (
                  <button key={num} onClick={() => setPlayerCount(num)} className={`h-12 rounded-xl text-sm font-black transition-all ${playerCount === num ? 'bg-lime-400 text-slate-900 shadow-lg shadow-lime-500/20' : 'bg-slate-800 text-slate-500'}`}>{num}</button>
                ))}
              </div>
              <button onClick={handleAutoBuild} disabled={isBuilding || freeAgentsCount < playerCount} className="w-full bg-lime-400 text-slate-900 py-5 rounded-2xl font-black uppercase text-base shadow-xl shadow-lime-500/20 active:scale-95 transition-all">
                {isBuilding ? "Processing..." : `Confirm Build (${playerCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayersTab;