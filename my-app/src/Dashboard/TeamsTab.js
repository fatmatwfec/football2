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
    <div className="animate-in fade-in duration-500 pb-40 px-4">
    
      <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6 px-4 py-8 bg-slate-900/60 rounded-[2.5rem] border border-white/5">
        <div>
          <h2 className="text-4xl font-black text-white flex items-center gap-4">
            <FaShieldAlt className="text-emerald-500" /> SQUAD HUB
          </h2>
          <p className="text-slate-400 text-sm mt-2 font-bold tracking-widest uppercase italic">Manage Your Tournament Teams</p>
        </div>

        <div className="relative w-full md:w-96">
          <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
          <input 
            type="text" 
            placeholder="Search teams..." 
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="w-full bg-slate-950/80 border-2 border-white/10 rounded-3xl py-5 pl-14 pr-12 text-white text-lg font-bold outline-none focus:border-emerald-500 transition-all shadow-inner"
          />
          {teamSearch && (
            <button onClick={() => setTeamSearch("")} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <FaTimes size={18} />
            </button>
          )}
        </div>
      </div>

    
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {filteredTeams.length > 0 ? filteredTeams.map((team) => {
          const currentMembers = getTeamMembers(team);
          const isFull = currentMembers.length === 7;

          return (
            <div key={team.id} className={`glass rounded-[4rem] p-10 border-2 transition-all shadow-2xl relative bg-slate-900/40 min-h-[600px] flex flex-col ${isFull ? 'border-emerald-500/40' : 'border-white/5'}`}>
              
              {/* Status Banner */}
              <div className="absolute -top-4 left-12">
                {isFull ? (
                  <span className="flex items-center gap-2 text-xs font-black bg-emerald-500 text-slate-900 px-6 py-2 rounded-full uppercase tracking-tighter shadow-lg">
                    <FaCheckCircle /> COMPLETE SQUAD
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-xs font-black bg-yellow-500 text-slate-900 px-6 py-2 rounded-full uppercase tracking-tighter shadow-lg">
                    <FaExclamationTriangle /> INCOMPLETE ({7 - currentMembers.length} LEFT)
                  </span>
                )}
              </div>

              <button onClick={() => handleDeleteTeam(team.id, team.teamName)} className="absolute top-10 right-10 text-slate-600 hover:text-red-500 transition-all scale-150">
                <FaTrashAlt size={16} />
              </button>

              <div className="flex items-center gap-8 mb-10">
                <div className="size-24 rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center text-white text-4xl font-black shadow-2xl border border-white/10">
                  {team.teamName?.[0] || "T"}
                </div>
                <div>
                  <h3 className="text-white font-black text-3xl tracking-tight uppercase leading-none mb-2">{team.teamName}</h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-3 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-widest">Official Squad</span>
                  </div>
                </div>
              </div>

          
              <div className="space-y-4 mb-10 flex-grow">
                <div className="flex justify-between items-end px-2 mb-4">
                  <h4 className="text-slate-500 text-sm font-black uppercase tracking-widest">Squad Roster</h4>
                  <p className="text-white font-mono text-xl">{currentMembers.length}<span className="text-slate-600">/7</span></p>
                </div>

                {currentMembers.map((member) => {
                  const isSuspended = Number(member.redCards || 0) > 0 || Number(member.yellowCards || 0) >= 2;
                  return (
                    <div key={member.id}
                      className={`flex items-center justify-between bg-slate-950/60 p-5 rounded-[2rem] border-2 ${isSuspended ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'} group/member hover:border-emerald-500/40 transition-all cursor-pointer`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center gap-5">
                        <div className={`size-3 rounded-full ${isSuspended ? 'bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'}`}></div>
                        <div className="flex flex-col">
                          <span className="text-white text-lg font-bold tracking-tight">{member.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{member.position || "Player"}</span>
                            {isSuspended && <span className="text-red-500 text-[9px] font-black uppercase flex items-center gap-1"><FaBan size={8}/> BANNED</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }} className="text-slate-700 hover:text-red-500 transition-all transform hover:scale-125">
                        <FaUserMinus size={22} />
                      </button>
                    </div>
                  );
                })}
                
                {currentMembers.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                    <p className="text-sm text-slate-600 font-bold uppercase tracking-widest italic">Waiting for recruitment...</p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t-2 border-white/5 flex flex-col sm:flex-row gap-4 mt-auto">
                <select 
                  value={selectedPlayers[team.id] || ""} 
                  onChange={(e) => setSelectedPlayers(prev => ({ ...prev, [team.id]: e.target.value }))} 
                  className="flex-1 bg-slate-950 border-2 border-white/10 rounded-[1.5rem] px-6 py-5 text-white font-bold outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">+ Add Free Agent</option>
                  {freeAgents.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.name} {Number(p.redCards || 0) > 0 ? "(Banned)" : ""}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={() => handleAddPlayer(team.id, team.teamName)} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-[1.5rem] transition-all shadow-xl active:scale-95"
                >
                  <FaUserPlus size={24} />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-40 text-center opacity-20 italic text-4xl text-white font-black uppercase tracking-[0.5em]">
            No results found
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl" onClick={() => setSelectedMember(null)}>
          <div className="bg-slate-900 border-2 border-white/10 p-12 rounded-[4.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMember(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white"><FaTimes size={28} /></button>
            
            <div className="text-center mb-10">
                <div className="size-32 bg-emerald-500/10 rounded-[3rem] flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/20 shadow-2xl">
                    <FaShieldAlt className="text-emerald-500" size={60} />
                </div>
                <h3 className="text-white font-black text-4xl uppercase tracking-tighter">{selectedMember.name}</h3>
                <p className="text-emerald-500 font-black uppercase tracking-[0.3em] mt-2 text-sm italic">Squad Personnel</p>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 text-center">
                    <FaFutbol className="text-emerald-500 mx-auto mb-3" size={24} />
                    <p className="text-white text-3xl font-black">{selectedMember.goals || 0}</p>
                    <p className="text-slate-500 text-[10px] font-black uppercase">Goals</p>
                </div>
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 text-center">
                    <FaSquare className="text-yellow-400 mx-auto mb-3" size={24} />
                    <p className="text-white text-3xl font-black">{selectedMember.yellowCards || 0}</p>
                    <p className="text-slate-500 text-[10px] font-black uppercase">Yellow</p>
                </div>
                <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 text-center">
                    <FaSquare className="text-red-500 mx-auto mb-3" size={24} />
                    <p className="text-white text-3xl font-black">{selectedMember.redCards || 0}</p>
                    <p className="text-slate-500 text-[10px] font-black uppercase">Red</p>
                </div>
            </div>

            <button onClick={() => setSelectedMember(null)} className="mt-12 w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2.5rem] text-lg font-black uppercase transition-all shadow-2xl">
                Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsTab;