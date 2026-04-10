import React, { useState } from 'react';
import { FaMagic, FaRunning, FaCheckCircle, FaUserCheck, FaKey, FaTrashAlt, FaTimes, FaUserMinus, FaSearch } from 'react-icons/fa';
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
    <div className="animate-in slide-in-from-right duration-500 w-full pb-32 px-4 max-w-7xl mx-auto">
      
      {/* Header - Compact */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 px-2 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <FaRunning className="text-blue-500" size={20} /> PLAYERS
          </h2>
          {!searchTerm && (
            <div className="flex gap-1.5 mt-3">
                <button onClick={() => setActiveSubTab("free")} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase border ${activeSubTab === 'free' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-white/5 text-slate-500'}`}>
                   Free Agents ({freeAgentsCount})
                </button>
                <button onClick={() => setActiveSubTab("team")} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase border ${activeSubTab === 'team' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-white/5 text-slate-500'}`}>
                   In Teams ({players.filter(p => p.hasTeam).length})
                </button>
            </div>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
          <input 
            type="text" 
            placeholder="Find player..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-xs outline-none focus:border-blue-500 transition-all shadow-xl"
          />
        </div>
      </div>

      {/* Grid - 4 columns on large screens for more density */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayedPlayers.length > 0 ? displayedPlayers.map((p) => {
          const playerGoals = Number(p.goals) || 0;
          const playerRank = playerGoals > 0 ? sortedAllPlayers.findIndex(s => s.id === p.id) + 1 : "--";

          return (
            <div key={p.id} className="glass rounded-2xl p-5 border border-white/5 group relative transition-all hover:border-blue-500/30 bg-slate-900/40">
              
              <button onClick={() => handleAction(p)} className="absolute top-4 right-4 text-slate-700 hover:text-red-500 transition-colors">
                {p.hasTeam ? <FaUserMinus size={14} /> : <FaTrashAlt size={14} />}
              </button>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="size-16 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-900 border border-white/10 p-0.5 shadow-lg overflow-hidden shrink-0">
                  <img 
                    src={p.profilePic || p.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`} 
                    alt="avatar" 
                    className="w-full h-full rounded-[10px] object-cover"
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="text-white font-black text-sm truncate uppercase tracking-tight">{p.name || "Unknown"}</p>
                  <p className="text-slate-500 text-[9px] font-mono mb-1 tracking-tighter">ID: {p.studentCode}</p>
                  <div className={`inline-block px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${p.hasTeam ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                     {p.hasTeam ? p.assignedTeam : 'Free Agent'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-blue-600/10 rounded-xl py-2 border border-blue-500/10 text-center">
                      <p className="text-[8px] text-blue-400 uppercase font-black">Goals</p>
                      <p className="text-lg text-white font-black">{playerGoals}</p>
                  </div>
                  <div className="bg-slate-950/50 rounded-xl py-2 border border-white/5 text-center">
                      <p className="text-[8px] text-slate-500 uppercase font-black">Rank</p>
                      <p className="text-lg text-yellow-500 font-black italic">#{playerRank}</p>
                  </div>
              </div>

              <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5 mb-4">
                <span className="text-[8px] text-slate-500 font-black uppercase flex items-center gap-1.5 mb-0.5"><FaKey className="text-blue-500" size={10} /> Access Key</span>
                <p className="text-sm text-yellow-500 font-mono font-black italic tracking-wider">{p.password || "********"}</p>
              </div>

              {!p.isVerified ? (
                <button onClick={() => handleManualVerify(p.id, p.name)} className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                  <FaUserCheck size={14} /> Manual Activate
                </button>
              ) : (
                <div className="w-full py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2">
                  <FaCheckCircle size={14} /> Active
                </div>
              )}
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center opacity-20 italic text-sm text-white font-black uppercase tracking-widest">No players found</div>
        )}
      </div>

      {/* Auto-Build Button - More Discreet */}
      {activeSubTab === "free" && !searchTerm && (
        <div className="fixed bottom-24 left-0 right-0 px-6 flex justify-center z-40 pointer-events-none">
            <button onClick={() => setShowBuildModal(true)} disabled={freeAgentsCount < 2} className="pointer-events-auto w-full max-w-xs bg-[#bef264] hover:bg-lime-400 text-slate-900 h-12 rounded-2xl flex items-center justify-center gap-3 font-black shadow-xl shadow-lime-500/20 transition-all active:scale-95 disabled:opacity-50">
            <FaMagic size={16} /> <span className="uppercase text-xs tracking-tight">Auto-Build Squad</span>
            </button>
        </div>
      )}

      {/* Build Modal - Compact */}
      {showBuildModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-3xl p-8 relative animate-in zoom-in duration-200">
            <button onClick={() => setShowBuildModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><FaTimes size={18}/></button>
            <h3 className="text-white text-xl font-black mb-6 flex items-center gap-2 tracking-tighter uppercase"><FaMagic className="text-lime-400" /> New Team</h3>
            <div className="space-y-6">
              <input type="text" value={customTeamName} onChange={(e) => setCustomTeamName(e.target.value)} placeholder="Team Name" className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-lime-400"/>
              <div className="grid grid-cols-6 gap-2">
                {[2, 3, 4, 5, 6, 7].map(num => (
                  <button key={num} onClick={() => setPlayerCount(num)} className={`h-10 rounded-lg text-[10px] font-black transition-all ${playerCount === num ? 'bg-lime-400 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>{num}</button>
                ))}
              </div>
              <button onClick={handleAutoBuild} disabled={isBuilding || freeAgentsCount < playerCount} className="w-full bg-lime-400 text-slate-900 py-4 rounded-xl font-black uppercase text-xs shadow-lg active:scale-95">
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