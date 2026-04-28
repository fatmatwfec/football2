import React, { useState, useMemo } from 'react';
import { FaMagic, FaRunning, FaCheckCircle, FaUserCheck, FaTrashAlt, FaTimes, FaUserMinus, FaSearch, FaFutbol, FaBan } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, doc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';

const PlayersTab = ({ players, matches = [], teams = [], readOnly = false }) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(null); // stores the player being matched
  const [customTeamName, setCustomTeamName] = useState("");
  const [playerCount, setPlayerCount] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");
  const [statsFilter, setStatsFilter] = useState("total"); // "total" or tournament name
  const [filterType, setFilterType] = useState("all"); // "all", "pending", "free", "solo"

  const [showTop10, setShowTop10] = useState(false);

  const allPlayers = players.filter(p => p.role === "student" || p.role === "player");

  // حساب عدد الماتشات اللي لعبها الفريق من الـ matches collection الفعلية
  const getMatchesPlayedByTeamId = (teamId) => {
    if (!teamId) return 0;
    return matches.filter(m =>
      (m.status || '').toLowerCase() === 'completed' &&
      (m.team1Id === teamId || m.team2Id === teamId)
    ).length;
  };

  const availableTournaments = useMemo(() => {
    const names = new Set();
    allPlayers.forEach(p => {
      if (p.tournamentStats) {
        Object.keys(p.tournamentStats).forEach(name => names.add(name));
      }
    });
    return Array.from(names).sort();
  }, [allPlayers]);

  const getStat = (player, statType) => {
    if (statsFilter === "total") {
      if (statType === 'goals') return Number(player.goals) || 0;
      if (statType === 'yellow') return Number(player.yellowCards) || 0;
      if (statType === 'red') return Number(player.redCards) || 0;
      return 0;
    }
    return Number(player.tournamentStats?.[statsFilter]?.[statType]) || 0;
  };

  const sortedByFilter = [...allPlayers].sort((a, b) => {
    const valA = getStat(a, 'goals');
    const valB = getStat(b, 'goals');
    return valB - valA;
  });

  const getPlayerRank = (playerId) => {
    const index = sortedByFilter.findIndex(p => p.id === playerId);
    return index !== -1 ? index + 1 : '--';
  };

  const displayedPlayers = allPlayers.filter(p => {
    // Apply status filter
    if (filterType === "pending" && p.isVerified) return false;
    if (filterType === "free" && p.hasTeam) return false;
    if (filterType === "solo" && (!p.searchingForTeam || p.hasTeam)) return false;

    if (searchTerm.trim() === "") return true;
    return p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.assignedTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.position?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const freeAgentsCount = allPlayers.filter(p => !p.hasTeam).length;

  const handleManualVerify = async (playerId, playerName) => {
    if (readOnly) return;
    if (window.confirm(`Activate account for ${playerName} manually?`)) {
      try {
        await updateDoc(doc(db, "users", playerId), { isVerified: true, manualActivation: true });
      } catch (e) { console.error(e); }
    }
  };

  const handleAction = async (player) => {
    if (readOnly) return;
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

  const handleAssignToTeam = async (player, team) => {
    if (readOnly) return;
    if (window.confirm(`Assign ${player.name} (${player.position}) to ${team.teamName}?`)) {
        try {
            const batch = writeBatch(db);
            const teamRef = doc(db, "teams", team.id);
            const userRef = doc(db, "users", player.id);

            batch.update(teamRef, {
                memberIds: arrayUnion(player.id),
                members: arrayUnion(player.name),
                needsPosition: null // Clear request if satisfied
            });

            batch.update(userRef, {
                hasTeam: true,
                teamId: team.id,
                assignedTeam: team.teamName,
                searchingForTeam: false,
                playSolo: false
            });

            await batch.commit();
            setShowMatchModal(null);
            alert("Player assigned successfully!");
        } catch (e) { console.error(e); }
    }
  };

  const handleAutoBuild = async () => {
    if (readOnly) return;
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
    if (position === 'Forward') return 'bg-green-500/20 text-green-400';
    if (position === 'Defender') return 'bg-blue-500/20 text-blue-400';
    if (position === 'Goalkeeper') return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-slate-500/20 text-slate-400';
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-slate-900 to-emerald-950/50">
      <div className="relative w-full px-4 py-6 max-w-7xl mx-auto">

        {/* Title Section */}
        <div className="mb-6">
          <h2 className="text-4xl font-black text-white flex items-center gap-2">
            <FaRunning className="text-emerald-500" size={32} />
            {searchTerm ? 'Search Results' : showTop10 ? 'Top 10 Legends' : 'All Players'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {searchTerm
              ? `Found ${displayedPlayers.length} player(s) matching "${searchTerm}"`
              : showTop10 
                ? `Showing the best 10 players of all time`
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

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Stats Period:</label>
              <select
                value={statsFilter}
                onChange={(e) => setStatsFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
              >
                <option value="total">All-Time (Total)</option>
                {availableTournaments.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setShowTop10(!showTop10)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 whitespace-nowrap ${
                showTop10 
                  ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                  : 'bg-black/40 text-slate-400 border-white/10 hover:border-emerald-500/50'
              }`}
            >
              <FaMagic className={showTop10 ? 'animate-pulse' : ''} />
              Top 10 Legends
            </button>
          </div>

          <div className="flex items-center gap-2 bg-black/40 p-1 border border-white/10 rounded-xl">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                filterType === "all" ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Players
            </button>
            <button
              onClick={() => setFilterType("pending")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all relative ${
                filterType === "pending" ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending Activation
              {allPlayers.filter(p => !p.isVerified).length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setFilterType("free")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                filterType === "free" ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Free Agents
            </button>
            <button
              onClick={() => setFilterType("solo")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all relative ${
                filterType === "solo" ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Solo Players
              {allPlayers.filter(p => p.searchingForTeam && !p.hasTeam).length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              )}
            </button>
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

        {/* Recruitment Requests Section (Only in Solo view) */}
        {filterType === 'solo' && (
            <div className="mb-6 animate-fade-slide-up">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                    Team Recruitment Requests
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.filter(t => t.needsPosition).length > 0 ? (
                        teams.filter(t => t.needsPosition).map(t => (
                            <div key={t.id} className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-white font-bold text-sm">{t.teamName}</p>
                                    <p className="text-purple-400 text-[10px] font-black uppercase tracking-wider">Needs a {t.needsPosition}</p>
                                </div>
                                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                    <FaFutbol className="text-purple-400" />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-4 text-center bg-white/5 border border-white/10 rounded-xl">
                            <p className="text-slate-500 text-xs italic">No active team requests at the moment</p>
                        </div>
                    )}
                </div>
            </div>
        )}

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
                  {showTop10 && (
                    <>
                      <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Goals</th>
                      <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Matches</th>
                    </>
                  )}
                  <th className="text-left py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Status</th>
                  <th className="text-center py-4 px-4 text-slate-400 font-bold text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(showTop10 ? sortedByFilter.slice(0, 10) : displayedPlayers).length > 0 ? (
                  [...(showTop10 ? sortedByFilter.slice(0, 10) : displayedPlayers)].sort((a, b) => {
                    const valA = getStat(a, 'goals');
                    const valB = getStat(b, 'goals');
                    return valB - valA;
                  }).map((player) => {
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
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${player.hasTeam
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

                        {showTop10 && (
                          <>
                            <td className="py-3 px-4">
                              <span className="text-white font-bold text-lg">{getStat(player, 'goals')}</span>
                            </td>

                            <td className="py-3 px-4 text-slate-400">{getMatchesPlayedByTeamId(player.teamId)}</td>
                          </>
                        )}

                        <td className="py-3 px-4">
                          {!player.isVerified ? (
                            !readOnly ? (
                              <button
                                onClick={() => handleManualVerify(player.id, player.name)}
                                className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap hover:bg-orange-500/30 transition-all"
                              >
                                <FaUserCheck className="inline mr-1" size={10} /> Activate
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap">
                                <FaBan size={10} /> Inactive
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap">
                              <FaCheckCircle size={10} /> Active
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {!readOnly && (
                            <div className="flex items-center justify-center gap-3">
                                {filterType === 'solo' && !player.hasTeam && (
                                    <button
                                        onClick={() => setShowMatchModal(player)}
                                        className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-lg shadow-purple-900/20"
                                    >
                                        Match
                                    </button>
                                )}
                                <button
                                    onClick={() => handleAction(player)}
                                    className="text-slate-600 hover:text-red-400 transition-colors"
                                    title={player.hasTeam ? "Remove from team" : "Delete player"}
                                >
                                    {player.hasTeam ? <FaUserMinus size={16} /> : <FaTrashAlt size={16} />}
                                </button>
                            </div>
                          )}
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
        {freeAgentsCount >= 2 && !readOnly && (
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
                        className={`h-10 rounded-lg text-sm font-bold transition-all ${playerCount === num
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

        {/* Matchmaking Modal */}
        {showMatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowMatchModal(null)}>
            <div className="bg-black/80 border border-white/10 w-full max-w-sm rounded-2xl p-6 relative animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowMatchModal(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <FaTimes size={18} />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <FaFutbol size={28} className="text-white" />
                </div>
                <h3 className="text-white text-xl font-bold">Match Player</h3>
                <p className="text-slate-500 text-sm mt-1">Assign <span className="text-white font-bold">{showMatchModal.name}</span> ({showMatchModal.position}) to a team</p>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Teams Needing {showMatchModal.position}:</p>
                {teams.filter(t => t.needsPosition === showMatchModal.position).length > 0 ? (
                    teams.filter(t => t.needsPosition === showMatchModal.position).map(t => (
                        <button
                            key={t.id}
                            onClick={() => handleAssignToTeam(showMatchModal, t)}
                            className="w-full bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500 hover:text-white transition-all p-3 rounded-xl flex items-center justify-between group"
                        >
                            <span className="font-bold text-sm">{t.teamName}</span>
                            <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded group-hover:bg-white/20">Request Active</span>
                        </button>
                    ))
                ) : (
                    <p className="text-xs text-slate-600 italic py-2">No teams specifically requested a {showMatchModal.position}.</p>
                )}

                <div className="border-t border-white/10 my-4 pt-4">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">All Other Teams:</p>
                    {teams.filter(t => t.needsPosition !== showMatchModal.position).map(t => (
                        <button
                            key={t.id}
                            onClick={() => handleAssignToTeam(showMatchModal, t)}
                            className="w-full bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-white/10 transition-all p-3 rounded-xl flex items-center justify-between mb-2"
                        >
                            <span className="text-white text-sm font-medium">{t.teamName}</span>
                            <span className="text-slate-500 text-[10px]">{t.memberIds?.length || 0}/7</span>
                        </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersTab;