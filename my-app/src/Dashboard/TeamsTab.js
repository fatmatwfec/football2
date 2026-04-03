import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { FaUsers, FaUserPlus, FaShieldAlt, FaUserMinus, FaInfoCircle, FaTrashAlt, FaFutbol, FaSquare } from 'react-icons/fa';

const TeamsTab = ({ teams, players }) => {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);

  const getTeamMembers = (teamId) => {
    return players.filter(p => p.teamId === teamId);
  };

  const freeAgents = players.filter(p => 
    (p.role === "student" || p.role === "player") && !p.hasTeam
  );

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete ${teamName}? All members will become Free Agents.`)) return;

    try {
      const batch = writeBatch(db);
      const membersToReset = getTeamMembers(teamId);

      membersToReset.forEach((member) => {
        batch.update(doc(db, "users", member.id), {
          hasTeam: false,
          teamId: "",
          assignedTeam: ""
        });
      });

      batch.delete(doc(db, "teams", teamId));

      await batch.commit();
      alert("Team deleted successfully and all members are now Free Agents.");
    } catch (error) {
      console.error(error);
      alert("Error deleting team.");
    }
  };

  const handleAddPlayer = async (teamId, teamName) => {
    if (!selectedPlayer) return alert("Please select a player first!");

    const teamMembers = getTeamMembers(teamId);
    if (teamMembers.length >= 7) {
      return alert("Team is already full (Max 7 players)!");
    }

    const player = freeAgents.find(p => p.id === selectedPlayer);
    if (!player) return;
    if (!window.confirm(`Add ${player.name} to ${teamName}?`)) return;

    try {
      const batch = writeBatch(db);
      const teamRef = doc(db, "teams", teamId);
      const userRef = doc(db, "users", player.id);

      batch.update(teamRef, {
        memberIds: arrayUnion(player.id),
        members: arrayUnion(player.name)
      });
      batch.update(userRef, { 
        hasTeam: true, 
        teamId: teamId, 
        assignedTeam: teamName 
      });

      await batch.commit();
      alert("Player added successfully!");
      setSelectedPlayer("");
    } catch (error) { 
      console.error(error); 
      alert("Error adding player.");
    }
  };

  const handleRemovePlayer = async (teamId, teamName, player) => {
    if (!window.confirm(`Remove ${player.name} from ${teamName}?`)) return;

    try {
      const batch = writeBatch(db);
      const teamRef = doc(db, "teams", teamId);
      const userRef = doc(db, "users", player.id);


      batch.update(teamRef, {
        memberIds: arrayRemove(player.id),
        members: arrayRemove(player.name)
      });

    
      batch.update(userRef, { 
        hasTeam: false, 
        teamId: "", 
        assignedTeam: "" 
      });

      await batch.commit();
      alert("Player removed.");
    } catch (error) { 
      console.error(error); 
      alert("Error removing player.");
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-40 px-2">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaShieldAlt className="text-emerald-500" /> Tournament Teams
          </h2>
          <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-widest font-black italic">
            Finalize rosters and manage team members
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.length > 0 ? teams.map((team) => {
          const currentMembers = getTeamMembers(team.id);
          
          return (
            <div key={team.id} className="glass rounded-[2.5rem] p-6 border border-white/5 hover:border-emerald-500/30 transition-all shadow-2xl relative group overflow-hidden">
              
              <button 
                onClick={() => handleDeleteTeam(team.id, team.teamName)}
                className="absolute top-6 right-6 text-slate-700 hover:text-red-500 transition-colors z-20"
              >
                <FaTrashAlt size={14} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="size-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-500 text-2xl font-black border border-emerald-500/20">
                  {team.teamName?.[0] || "T"}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight">{team.teamName}</h3>
                  <p className="text-emerald-500 text-[9px] font-black uppercase">Verified Squad</p>
                </div>
              </div>

              <div className="space-y-2 mb-8 relative z-10">
                <div className="flex justify-between items-center mb-3">
                   <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Squad Members</p>
                   <span className="text-white text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md">{currentMembers.length} / 7</span>
                </div>
                
                {currentMembers.map((member) => (
                  <div key={member.id} 
                    className="flex items-center justify-between bg-slate-900/40 p-3 rounded-2xl border border-white/5 group/member hover:bg-slate-900 transition-all cursor-pointer"
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-1.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-slate-200 text-xs font-semibold">{member.name}</span>
                      <FaInfoCircle className="text-slate-600 group-hover/member:text-emerald-400 transition-colors" size={10} />
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }}
                      className="text-slate-600 hover:text-red-500 opacity-0 group-hover/member:opacity-100 transition-opacity"
                    >
                      <FaUserMinus size={12} />
                    </button>
                  </div>
                ))}
                {currentMembers.length === 0 && <p className="text-[10px] text-slate-600 italic text-center">No members assigned.</p>}
              </div>

              <div className="pt-5 border-t border-white/5 relative z-10">
                <div className="flex gap-2">
                  <select 
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="">Choose Free Agent...</option>
                    {freeAgents.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => handleAddPlayer(team.id, team.teamName)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl transition-all active:scale-90 shadow-lg"
                  >
                    <FaUserPlus />
                  </button>
                </div>
              </div>
            </div>
          );
        }) : <div className="col-span-full py-20 text-center text-slate-600 italic">No approved teams yet.</div>}
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-6 text-center border-b border-white/5 pb-4">Player Profile</h3>
            
            <div className="space-y-3 mb-8 px-2">
              <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] uppercase font-bold">Name</span><span className="text-white font-bold text-sm">{selectedMember.name}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] uppercase font-bold">Code</span><span className="text-white font-mono text-sm">{selectedMember.studentCode}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500 text-[10px] uppercase font-bold">Phone</span><span className="text-white text-sm">{selectedMember.phone || "N/A"}</span></div>
            </div>
            
            <div className="bg-slate-950/50 rounded-3xl p-5 border border-white/5">
              <p className="text-[9px] text-slate-500 font-black uppercase mb-4 tracking-widest text-center italic">Tournament History</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <FaFutbol className="text-emerald-500 mb-1.5" size={14} />
                  <span className="text-white font-black text-lg leading-none">{selectedMember.goals || 0}</span>
                  <span className="text-[7px] text-slate-500 uppercase mt-1 font-bold">Goals</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <FaSquare className="text-yellow-400 mb-1.5" size={14} />
                  <span className="text-white font-black text-lg leading-none">{selectedMember.yellowCards || 0}</span>
                  <span className="text-[7px] text-slate-500 uppercase mt-1 font-bold">Yellow</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                  <FaSquare className="text-red-500 mb-1.5" size={14} />
                  <span className="text-white font-black text-lg leading-none">{selectedMember.redCards || 0}</span>
                  <span className="text-[7px] text-slate-500 uppercase mt-1 font-bold">Red</span>
                </div>
              </div>
            </div>

            <button onClick={() => setSelectedMember(null)} className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20 active:scale-95">
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsTab;