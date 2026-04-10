import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { FaUsers, FaUserPlus, FaShieldAlt, FaUserMinus, FaInfoCircle, FaTrashAlt, FaFutbol, FaSquare, FaCheckCircle, FaExclamationTriangle, FaSearch, FaTimes, FaBan } from 'react-icons/fa';

const TeamsTab = ({ teams, players }) => {

  const [selectedPlayers, setSelectedPlayers] = useState({}); 
  const [selectedMember, setSelectedMember] = useState(null);
  const [teamSearch, setTeamSearch] = useState("");

  const getTeamMembers = (team) => {
    return players.filter(p =>
      (p.teamId && String(p.teamId).trim() === String(team.id).trim()) ||
      (p.assignedTeam && String(p.assignedTeam).trim() === String(team.teamName).trim())
    );
  };

  const freeAgents = players.filter(p => (p.role === "student" || p.role === "player") && !p.hasTeam);

  const filteredTeams = teams.filter(t => 
    t.teamName?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete ${teamName}? All members will become Free Agents.`)) return;
    try {
      const batch = writeBatch(db);
      const teamObj = teams.find(t => t.id === teamId);
      const membersToReset = getTeamMembers(teamObj);

      membersToReset.forEach((member) => {
        batch.update(doc(db, "users", member.id), {
          hasTeam: false,
          teamId: "",
          assignedTeam: ""
        });
      });
      batch.delete(doc(db, "teams", teamId));
      await batch.commit();
      alert("Team deleted successfully.");
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddPlayer = async (teamId, teamName) => {
    const currentPlayerId = selectedPlayers[teamId];
    if (!currentPlayerId) return alert("Please select a player first!");
    
    const teamObj = teams.find(t => t.id === teamId);
    const teamMembers = getTeamMembers(teamObj);
    if (teamMembers.length >= 7) return alert("Team is full!");

    const player = freeAgents.find(p => p.id === currentPlayerId);
    if (!player || !window.confirm(`Add ${player.name} to ${teamName}?`)) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "teams", teamId), {
        memberIds: arrayUnion(player.id),
        members: arrayUnion(player.name)
      });
      batch.update(doc(db, "users", player.id), {
        hasTeam: true,
        teamId: teamId,
        assignedTeam: teamName
      });
      await batch.commit();
      
      setSelectedPlayers(prev => ({ ...prev, [teamId]: "" }));
    } catch (error) { console.error(error); }
  };

  const handleRemovePlayer = async (teamId, teamName, player) => {
    if (!window.confirm(`Remove ${player.name} from ${teamName}?`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "teams", teamId), {
        memberIds: arrayRemove(player.id),
        members: arrayRemove(player.name)
      });
      batch.update(doc(db, "users", player.id), {
        hasTeam: false,
        teamId: "",
        assignedTeam: ""
      });
      await batch.commit();
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20 px-4 max-w-7xl mx-auto">
      
      {/* Header - Scaled Down */}
      <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-5 bg-slate-900/60 rounded-3xl border border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <FaShieldAlt className="text-emerald-500" /> SQUAD HUB
          </h2>
          <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase italic">Tournament Management</p>
        </div>

        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-sm" />
          <input 
            type="text" 
            placeholder="Search teams..." 
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-white/10 rounded-2xl py-3 pl-11 pr-10 text-white text-sm font-bold outline-none focus:border-emerald-500 transition-all"
          />
          {teamSearch && (
            <button onClick={() => setTeamSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <FaTimes size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Grid - More Compact Gap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTeams.length > 0 ? filteredTeams.map((team) => {
          const currentMembers = getTeamMembers(team);
          const isFull = currentMembers.length === 7;

          return (
            <div key={team.id} className={`glass rounded-3xl p-6 border-2 transition-all shadow-xl relative bg-slate-900/40 min-h-[500px] flex flex-col ${isFull ? 'border-emerald-500/30' : 'border-white/5'}`}>
              
              {/* Status Banner - Smaller */}
              <div className="absolute -top-3 left-8">
                {isFull ? (
                  <span className="flex items-center gap-1.5 text-[9px] font-black bg-emerald-500 text-slate-900 px-4 py-1.5 rounded-full uppercase shadow-md">
                    <FaCheckCircle /> COMPLETE
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[9px] font-black bg-yellow-500 text-slate-900 px-4 py-1.5 rounded-full uppercase shadow-md">
                    <FaExclamationTriangle /> INCOMPLETE ({7 - currentMembers.length})
                  </span>
                )}
              </div>

              <button onClick={() => handleDeleteTeam(team.id, team.teamName)} className="absolute top-6 right-6 text-slate-600 hover:text-red-500 transition-all">
                <FaTrashAlt size={14} />
              </button>

              <div className="flex items-center gap-5 mb-6">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center text-white text-2xl font-black border border-white/10 shadow-lg">
                  {team.teamName?.[0] || "T"}
                </div>
                <div>
                  <h3 className="text-white font-black text-xl uppercase leading-none mb-1">{team.teamName}</h3>
                  <span className="text-emerald-500/70 text-[9px] font-black uppercase tracking-wider">Official Squad</span>
                </div>
              </div>

              {/* Squad Roster - Compact Rows */}
              <div className="space-y-2 mb-6 flex-grow">
                <div className="flex justify-between items-end px-1 mb-2">
                  <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Roster</h4>
                  <p className="text-white font-mono text-lg">{currentMembers.length}<span className="text-slate-600">/7</span></p>
                </div>

                {currentMembers.map((member) => {
                  const isSuspended = Number(member.redCards || 0) > 0 || Number(member.yellowCards || 0) >= 2;
                  return (
                    <div key={member.id}
                      className={`flex items-center justify-between bg-slate-950/40 p-3 rounded-2xl border ${isSuspended ? 'border-red-500/20 bg-red-500/5' : 'border-white/5'} group/member hover:border-emerald-500/30 transition-all cursor-pointer`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-2 rounded-full ${isSuspended ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'}`}></div>
                        <div className="flex flex-col">
                          <span className="text-white text-sm font-bold truncate max-w-[150px]">{member.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">{member.position || "Player"}</span>
                            {isSuspended && <span className="text-red-500 text-[7px] font-black uppercase flex items-center gap-1"><FaBan size={7}/> BANNED</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }} className="text-slate-700 hover:text-red-500 transition-all">
                        <FaUserMinus size={16} />
                      </button>
                    </div>
                  );
                })}
                
                {currentMembers.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">Waiting for recruitment...</p>
                  </div>
                )}
              </div>

              {/* Bottom Controls - Smaller inputs */}
              <div className="pt-4 border-t border-white/5 flex gap-2 mt-auto">
                <select 
                  value={selectedPlayers[team.id] || ""} 
                  onChange={(e) => setSelectedPlayers(prev => ({ ...prev, [team.id]: e.target.value }))} 
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-emerald-500"
                >
                  <option value="">+ Add Free Agent</option>
                  {freeAgents.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.name} {Number(p.redCards || 0) > 0 ? "(B)" : ""}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={() => handleAddPlayer(team.id, team.teamName)} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 rounded-xl transition-all shadow-lg active:scale-95"
                >
                  <FaUserPlus size={18} />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center opacity-20 italic text-2xl text-white font-black uppercase tracking-[0.3em]">
            No results
          </div>
        )}
      </div>

      {/* Profile Modal - More Compact */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setSelectedMember(null)}>
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMember(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><FaTimes size={20} /></button>
            
            <div className="text-center mb-6">
                <div className="size-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-xl">
                    <FaShieldAlt className="text-emerald-500" size={36} />
                </div>
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter">{selectedMember.name}</h3>
                <p className="text-emerald-500 font-black uppercase tracking-widest mt-1 text-[10px] italic">Squad Member</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <FaFutbol className="text-emerald-500 mx-auto mb-2" size={16} />
                    <p className="text-white text-xl font-black">{selectedMember.goals || 0}</p>
                    <p className="text-slate-500 text-[8px] font-black uppercase">Goals</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <FaSquare className="text-yellow-400 mx-auto mb-2" size={16} />
                    <p className="text-white text-xl font-black">{selectedMember.yellowCards || 0}</p>
                    <p className="text-slate-500 text-[8px] font-black uppercase">Yellow</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <FaSquare className="text-red-500 mx-auto mb-2" size={16} />
                    <p className="text-white text-xl font-black">{selectedMember.redCards || 0}</p>
                    <p className="text-slate-500 text-[8px] font-black uppercase">Red</p>
                </div>
            </div>

            <button onClick={() => setSelectedMember(null)} className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-black uppercase transition-all shadow-lg">
                Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsTab;