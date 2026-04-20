import React, { useState } from 'react';
import { FaMagic, FaRunning, FaCheckCircle, FaUserCheck, FaKey, FaTrashAlt, FaTimes, FaUserMinus, FaSearch, FaFutbol, FaStar } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const PlayersTab = ({ players }) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [customTeamName, setCustomTeamName] = useState("");
  const [playerCount, setPlayerCount] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");

  const allPlayers = players.filter(p => p.role === "student" || p.role === "player");
  
  const sortedAllPlayers = [...allPlayers].sort((a, b) => {
    const goalsA = Number(a.goals) || 0;
    const goalsB = Number(b.goals) || 0;
    return goalsB - goalsA;
  });

  const getPlayerRank = (playerId) => {
    const index = sortedAllPlayers.findIndex(p => p.id === playerId);
    return index !== -1 ? index + 1 : '--';
  };

  const displayedPlayers = allPlayers.filter(p => {
    if (searchTerm.trim() === "") return true;
    return p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.assignedTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.position?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const freeAgentsCount = allPlayers.filter(p => !p.hasTeam).length;

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
    const freeAgents = allPlayers.filter(p => !p.hasTeam);
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

  const getPositionBadge = (position) => {
    const positionLower = (position || '').toLowerCase();
    if (positionLower.includes('forward') || positionLower.includes('striker')) {
      return 'bg-green-500/20 text-green-400';
    } else if (positionLower.includes('midfielder') || positionLower.includes('mid')) {
      return 'bg-emerald-500/20 text-emerald-400';
    } else if (positionLower.includes('defender') || positionLower.includes('def')) {
      return 'bg-teal-500/20 text-teal-400';
    } else if (positionLower.includes('goalkeeper') || positionLower.includes('gk')) {
      return 'bg-lime-500/20 text-lime-400';
    }
    return 'bg-slate-500/20 text-slate-400';
  };

 return (
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-slate-900 to-emerald-950/50">
      <div className="relative w-full px-4 py-6 max-w-7xl mx-auto">
    
        {/* Title Section */}
        <div className="mb-6">
          <h2 className="text-4xl font-black text-white flex items-center gap-2">
            <FaRunning className="text-emerald-500" size={32} /> 
            {searchTerm ? 'Search Results' : 'All Players'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {searchTerm 
              ? `Found ${displayedPlayers.length} player(s) matching "${searchTerm}"` 
              : `Total ${allPlayers.length} players • ${freeAgentsCount} free agents`
            }
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm" />
            <input
              type="text"
              placeholder="Search by name, team, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")} 
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Players Table */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black/50 border-b border-white/5">
                <tr>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Rank</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Player</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Team</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Position</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Goals</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Assists</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Matches</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Rating</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Status</th>
                  <th className="text-center py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedPlayers.length > 0 ? (
                  [...displayedPlayers].sort((a, b) => {
                    const goalsA = Number(a.goals) || 0;
                    const goalsB = Number(b.goals) || 0;
                    return goalsB - goalsA;
                  }).map((player) => {
                    const playerGoals = Number(player.goals) || 0;
                    const playerRank = getPlayerRank(player.id);
                    
                    return (
                      <tr 
                        key={player.id} 
                        className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <span className={`font-bold ${playerRank <= 3 && playerRank !== '--' ? 'text-yellow-400' : 'text-white'}`}>
                            #{playerRank}
                          </span>
                        </td>
                        
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-green-700 flex items-center justify-center shadow-md">
                              <span className="text-white text-xs font-bold">
                                {player.name?.charAt(0) || "?"}
                              </span>
                            </div>
                            <div>
                              <span className="text-white font-medium">{player.name || "Unknown"}</span>
                              <p className="text-slate-600 text-[10px] font-mono">{player.studentCode || "No ID"}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${
                            player.hasTeam 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-slate-800/60 text-slate-500 border border-white/5'
                          }`}>
                            {player.hasTeam ? (player.assignedTeam || 'Team') : 'Free Agent'}
                          </span>
                        </td>
                        
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${getPositionBadge(player.position)}`}>
                            {player.position || 'N/A'}
                          </span>
                        </td>
                        
                        <td className="py-3 px-4">
                          <span className="text-white font-bold text-lg">{playerGoals}</span>
                        </td>
                        
                        <td className="py-3 px-4 text-white font-medium">{player.assists || 0}</td>
                        
                        <td className="py-3 px-4 text-slate-400">{player.matches || 0}</td>
                        
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <FaStar className="text-yellow-400 text-xs" />
                            <span className="text-white font-bold">{player.rating || 'N/A'}</span>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4">
                          {!player.isVerified ? (
                            <button 
                              onClick={() => handleManualVerify(player.id, player.name)} 
                              className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap hover:bg-orange-500/30 transition-all"
                            >
                              <FaUserCheck className="inline mr-1" size={10} /> Activate
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap">
                              <FaCheckCircle size={10} /> Active
                            </span>
                          )}
                        </td>
                        
                        <td className="py-3 px-4 text-center">
                          <button 
                            onClick={() => handleAction(player)} 
                            className="text-slate-600 hover:text-red-400 transition-colors"
                            title={player.hasTeam ? "Remove from team" : "Delete player"}
                          >
                            {player.hasTeam ? <FaUserMinus size={16} /> : <FaTrashAlt size={16} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="text-slate-600 italic">
                        <FaFutbol className="mx-auto text-4xl mb-3 opacity-20" />
                        No players found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auto-Build Button */}
        {freeAgentsCount >= 2 && (
          <div className="fixed bottom-8 right-8 z-40">
            <button 
              onClick={() => setShowBuildModal(true)} 
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-900/50 transition-all hover:scale-105 active:scale-95 group"
            >
              <FaMagic size={22} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        )}

        {/* Build Modal */}
        {showBuildModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowBuildModal(false)}>
            <div className="bg-black/80 border border-white/10 w-full max-w-sm rounded-2xl p-6 relative animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setShowBuildModal(false)} 
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <FaTimes size={18} />
              </button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <FaMagic size={28} className="text-white" />
                </div>
                <h3 className="text-white text-xl font-bold">Create New Team</h3>
                <p className="text-slate-500 text-sm mt-1">Build a squad from free agents</p>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="text-slate-500 text-xs font-medium mb-1 block">Team Name</label>
                  <input 
                    type="text" 
                    value={customTeamName} 
                    onChange={(e) => setCustomTeamName(e.target.value)} 
                    placeholder="e.g., Thunder FC" 
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500 transition-all"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="text-slate-500 text-xs font-medium mb-2 block">Team Size</label>
                  <div className="grid grid-cols-6 gap-2">
                    {[2, 3, 4, 5, 6, 7].map(num => (
                      <button 
                        key={num} 
                        onClick={() => setPlayerCount(num)} 
                        className={`h-10 rounded-lg text-sm font-bold transition-all ${
                          playerCount === num 
                            ? 'bg-emerald-600 text-white shadow-md' 
                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={handleAutoBuild} 
                  disabled={isBuilding || freeAgentsCount < playerCount} 
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBuilding ? "Processing..." : `Confirm Build (${playerCount} Players)`}
                </button>
                
                <p className="text-center text-slate-600 text-[11px]">
                  {freeAgentsCount} free agents available
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersTab;