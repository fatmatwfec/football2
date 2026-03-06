import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { FaUsers, FaUserPlus, FaShieldAlt, FaUserMinus, FaInfoCircle } from 'react-icons/fa';

const TeamsTab = ({ teams, players }) => {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);

  const freeAgents = players.filter(p => 
    (p.role === "student" || p.role === "player") && (p.hasTeam === false || p.hasTeam === undefined)
  );

  const handleAddPlayer = async (teamId, teamName) => {
    if (!selectedPlayer) return alert("Please select a player first!");
    
    const player = freeAgents.find(p => p.id === selectedPlayer);
    if (!player) return;

    if (!window.confirm(`Add ${player.name} to ${teamName}?`)) return;

    try {
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        members: arrayUnion(player.name)
      });

      const userRef = doc(db, "users", player.id);
      await updateDoc(userRef, {
        hasTeam: true,
        teamId: teamId,
        assignedTeam: teamName
      });

      alert("Player added successfully!");
      setSelectedPlayer(""); 
    } catch (error) {
      console.error(error);
      alert("Error adding player");
    }
  };

  const handleRemovePlayer = async (teamId, teamName, playerName) => {
    if (!window.confirm(`Remove ${playerName} from ${teamName}?`)) return;

    try {
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        members: arrayRemove(playerName)
      });

      const userObj = players.find(u => u.name === playerName);
      if (userObj) {
        const userRef = doc(db, "users", userObj.id);
        await updateDoc(userRef, {
          hasTeam: false,
          teamId: "",
          assignedTeam: ""
        });
      }

      alert("Player removed and is now a Free Agent again.");
    } catch (error) {
      console.error(error);
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
        {teams.length > 0 ? teams.map((team) => (
          <div key={team.id} className="glass rounded-[2.5rem] p-6 border border-white/5 hover:border-emerald-500/30 transition-all shadow-2xl relative group overflow-hidden">
            
            <div className="absolute -right-10 -bottom-10 size-40 bg-emerald-600/5 rounded-full blur-3xl group-hover:bg-emerald-600/10 transition-all"></div>

            <div className="flex items-center gap-4 mb-6">
              <div className="size-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-500 text-2xl font-black border border-emerald-500/20 shadow-inner">
                {team.teamName?.[0] || "T"}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight">{team.teamName}</h3>
                <div className="flex items-center gap-2 mt-1">
                   <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
                   <p className="text-emerald-500 text-[9px] font-black uppercase tracking-tighter">Verified Squad</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-8 relative z-10">
              <div className="flex justify-between items-center mb-3">
                 <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Squad Members</p>
                 <span className="text-white text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md">{team.members?.length || 0} / 7</span>
              </div>
              
              {team.members?.map((member, index) => {
                const memberData = players.find(p => p.name === member);
                return (
                  <div key={index} 
                    className="flex items-center justify-between bg-slate-900/40 p-3 rounded-2xl border border-white/5 group/member hover:bg-slate-900 transition-all cursor-pointer"
                    onClick={() => memberData && setSelectedMember(memberData)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-1.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-slate-200 text-xs font-semibold">{member}</span>
                      <FaInfoCircle className="text-slate-600 group-hover/member:text-emerald-400 transition-colors" size={10} />
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }}
                      className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover/member:opacity-100"
                      title="Remove Player"
                    >
                      <FaUserMinus size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-5 border-t border-white/5 relative z-10">
              <p className="text-slate-500 text-[9px] font-black uppercase mb-4 text-center tracking-widest">Quick Add Member</p>
              <div className="flex gap-2">
                <select 
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none focus:border-emerald-500 transition-all shadow-inner"
                >
                  <option value="">Choose Free Agent...</option>
                  {freeAgents.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.studentCode})</option>
                  ))}
                </select>
                <button 
                  onClick={() => handleAddPlayer(team.id, team.teamName)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-900/20 active:scale-90"
                >
                  <FaUserPlus />
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center">
            <div className="size-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
               <FaShieldAlt size={40} />
            </div>
            <p className="text-slate-600 italic font-medium">No approved teams yet. Go to Dashboard to approve requests.</p>
          </div>
        )}
      </div>
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-6 text-center">Student Details</h3>
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">Name: <span className="text-white font-bold block">{selectedMember.name}</span></p>
              <p className="text-slate-400 text-xs">ID: <span className="text-white font-bold block">{selectedMember.studentCode}</span></p>
              <p className="text-slate-400 text-xs">Phone: <span className="text-white font-bold block">{selectedMember.phone}</span></p>
              <p className="text-slate-400 text-xs">Email: <span className="text-white font-bold block">{selectedMember.email}</span></p>
            </div>
            <button onClick={() => setSelectedMember(null)} className="mt-8 w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-xs font-bold transition-all">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsTab;