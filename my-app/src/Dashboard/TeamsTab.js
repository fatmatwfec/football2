import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { FaUsers, FaUserPlus, FaShieldAlt, FaUserMinus, FaInfoCircle, FaTrashAlt, FaFutbol, FaSquare, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const TeamsTab = ({ teams, players }) => {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);

  const getTeamMembers = (team) => {
    return players.filter(p => 
      (p.teamId && String(p.teamId).trim() === String(team.id).trim()) || 
      (p.assignedTeam && String(p.assignedTeam).trim() === String(team.teamName).trim())
    );
  };

  const freeAgents = players.filter(p => 
    (p.role === "student" || p.role === "player") && !p.hasTeam
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
      alert("Error deleting team.");
    }
  };

  const handleAddPlayer = async (teamId, teamName) => {
    if (!selectedPlayer) return alert("Please select a player first!");
    const teamObj = teams.find(t => t.id === teamId);
    const teamMembers = getTeamMembers(teamObj);
    if (teamMembers.length >= 7) return alert("Team is full!");

    const player = freeAgents.find(p => p.id === selectedPlayer);
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
      alert("Player added!");
      setSelectedPlayer("");
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
      alert("Player removed.");
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-40 px-2">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaShieldAlt className="text-emerald-500" /> Tournament Teams
          </h2>
          <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-widest font-black italic">
            Manage Roles & Track Squad Status
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.length > 0 ? teams.map((team) => {
          const currentMembers = getTeamMembers(team);
          
          // --- Logic: Team Status Tracking ---
          const isFull = currentMembers.length === 7;
          const hasSuspended = currentMembers.some(m => Number(m.redCards || 0) > 0 || Number(m.yellowCards || 0) >= 2);
          
          return (
            <div key={team.id} className={`glass rounded-[2.5rem] p-6 border transition-all shadow-2xl relative group overflow-hidden ${isFull ? 'border-emerald-500/30' : 'border-white/5'}`}>
              
              {/* Status Badge */}
              <div className="absolute top-6 right-12 z-20">
                {isFull ? (
                  <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-tighter border border-emerald-500/20">
                    <FaCheckCircle size={8} /> Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[8px] font-black text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full uppercase tracking-tighter border border-yellow-500/20">
                    <FaExclamationTriangle size={8} /> Incomplete
                  </span>
                )}
              </div>

              <button onClick={() => handleDeleteTeam(team.id, team.teamName)} className="absolute top-6 right-6 text-slate-700 hover:text-red-500 z-20">
                <FaTrashAlt size={14} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="size-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-500 text-2xl font-black border border-emerald-500/20">
                  {team.teamName?.[0] || "T"}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">{team.teamName}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-emerald-500 text-[9px] font-black uppercase">Verified Squad</p>
                    {hasSuspended && <span className="size-1.5 bg-red-500 rounded-full animate-ping"></span>}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-8 relative z-10">
                <div className="flex justify-between items-center mb-3">
                   <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Squad Members</p>
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isFull ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white'}`}>
                     {currentMembers.length} / 7
                   </span>
                </div>
                
                {currentMembers.map((member) => {
                  const isSuspended = Number(member.redCards || 0) > 0 || Number(member.yellowCards || 0) >= 2;
                  return (
                    <div key={member.id} 
                      className={`flex items-center justify-between bg-slate-900/40 p-3 rounded-2xl border ${isSuspended ? 'border-red-500/50' : 'border-white/5'} group/member hover:bg-slate-900 transition-all cursor-pointer`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-1.5 ${isSuspended ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'} rounded-full`}></div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 text-xs font-semibold">{member.name}</span>
                            {/* Role Assignment Badge */}
                            <span className="text-[7px] px-1.5 py-0.5 bg-white/5 text-slate-500 rounded uppercase font-black tracking-tighter">
                              {member.role || "Player"}
                            </span>
                          </div>
                          {isSuspended && (
                            <span className="text-red-500 text-[7px] font-black uppercase flex items-center gap-1">
                              <FaSquare size={6} className={Number(member.redCards || 0) > 0 ? "text-red-500" : "text-yellow-400"} /> 
                              SUSPENDED
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <FaInfoCircle className="text-slate-600 group-hover/member:text-emerald-400 transition-colors" size={10} />
                         <button onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }} className="text-slate-600 hover:text-red-500 opacity-0 group-hover/member:opacity-100 transition-opacity">
                           <FaUserMinus size={12} />
                         </button>
                      </div>
                    </div>
                  );
                })}
                {currentMembers.length === 0 && <p className="text-[10px] text-slate-600 italic text-center">No members assigned.</p>}
              </div>

              <div className="pt-5 border-t border-white/5 relative z-10">
                <div className="flex gap-2">
                  <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none focus:border-emerald-500 transition-all">
                    <option value="">Choose Free Agent...</option>
                    {freeAgents.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role || "Player"}) {Number(p.redCards || 0) > 0 ? "🛑" : ""}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => handleAddPlayer(team.id, team.teamName)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl transition-all shadow-lg"><FaUserPlus /></button>
                </div>
              </div>
            </div>
          );
        }) : <div className="col-span-full py-20 text-center text-slate-600 italic">No approved teams yet.</div>}
      </div>

      {/* Profile Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-6 text-center border-b border-white/5 pb-4">Player Profile</h3>
            <div className="space-y-3 mb-8 px-2">
              <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] uppercase font-bold">Name</span><span className="text-white font-bold text-sm">{selectedMember.name}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] uppercase font-bold">Role</span><span className="text-emerald-500 font-bold text-[10px] uppercase">{selectedMember.role || "Player"}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] uppercase font-bold">Code</span><span className="text-white font-mono text-sm">{selectedMember.studentCode}</span></div>
            </div>
            <div className="bg-slate-950/50 rounded-3xl p-5 border border-white/5">
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <FaFutbol className="text-emerald-500 mb-1.5" size={14} />
                  <span className="text-white font-black text-lg">{selectedMember.goals || 0}</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <FaSquare className="text-yellow-400 mb-1.5" size={14} />
                  <span className="text-white font-black text-lg">{selectedMember.yellowCards || 0}</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <FaSquare className="text-red-500 mb-1.5" size={14} />
                  <span className="text-white font-black text-lg">{selectedMember.redCards || 0}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedMember(null)} className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase transition-all shadow-xl active:scale-95">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsTab;