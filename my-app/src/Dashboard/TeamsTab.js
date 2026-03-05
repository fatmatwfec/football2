import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { FaUsers, FaUserPlus, FaShieldAlt, FaTrash } from 'react-icons/fa';

const TeamsTab = ({ teams, players }) => {
  const [selectedPlayer, setSelectedPlayer] = useState("");

  // فلترة اللاعبين الأحرار فقط عشان يظهروا في القائمة
  const freeAgents = players.filter(p => 
    (p.role === "student" || p.role === "player") && (p.hasTeam === false || p.hasTeam === undefined)
  );

  const handleAddPlayer = async (teamId, teamName) => {
    if (!selectedPlayer) return alert("Please select a player first!");
    
    const player = freeAgents.find(p => p.id === selectedPlayer);
    if (!player) return;

    if (!window.confirm(`Add ${player.name} to ${teamName}?`)) return;

    try {
      // 1. إضافة اسم اللاعب لمصفوفة أعضاء الفريق
      const teamRef = doc(db, "teams", teamId);
      await updateDoc(teamRef, {
        members: arrayUnion(player.name)
      });

      // 2. تحديث حالة اللاعب في كوليكشن اليوزرز
      const userRef = doc(db, "users", player.id);
      await updateDoc(userRef, {
        hasTeam: true,
        teamId: teamId,
        assignedTeam: teamName
      });

      alert("Player added successfully!");
      setSelectedPlayer(""); // تصفير الاختيار
    } catch (error) {
      console.error(error);
      alert("Error adding player");
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-40">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <FaShieldAlt className="text-emerald-500" /> Managed Teams
        </h2>
        <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-bold">Monitor and complete team rosters</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.length > 0 ? teams.map((team) => (
          <div key={team.id} className="glass rounded-[2.5rem] p-6 border border-white/5 hover:border-emerald-500/30 transition-all shadow-2xl relative group">
            
            {/* رأس الكارت */}
            <div className="flex items-center gap-4 mb-6">
              <div className="size-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-500 text-2xl font-black border border-emerald-500/20">
                {team.teamName?.[0]}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight">{team.teamName}</h3>
                <p className="text-emerald-500 text-[10px] font-black uppercase tracking-tighter">Status: {team.status}</p>
              </div>
            </div>

            {/* قائمة الأعضاء */}
            <div className="space-y-2 mb-6">
              <p className="text-slate-500 text-[10px] font-bold uppercase mb-2">Team Members ({team.members?.length || 0})</p>
              {team.members?.map((member, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-white/5">
                  <div className="size-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-slate-300 text-xs font-medium">{member}</span>
                </div>
              ))}
            </div>

            {/* جزء إضافة لاعب يدوي */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-slate-500 text-[10px] font-bold uppercase mb-3 text-center">Add Missing Member</p>
              <div className="flex gap-2">
                <select 
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Select Player</option>
                  {freeAgents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button 
                  onClick={() => handleAddPlayer(team.id, team.teamName)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white size-10 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-900/20"
                >
                  <FaUserPlus />
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center opacity-30 italic">No approved teams found.</div>
        )}
      </div>
    </div>
  );
};

export default TeamsTab;