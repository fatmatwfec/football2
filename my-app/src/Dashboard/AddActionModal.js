import React, { useState, useMemo } from 'react';
import { FaUsers, FaFutbol, FaTimes, FaArrowLeft, FaCalendarAlt, FaUserPlus, FaUserMinus, FaPlus } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';

const AddActionModal = ({ isOpen, onClose, currentTeamsCount, freeAgents = [] }) => {
  const [view, setView] = useState('options');
  const [loading, setLoading] = useState(false);
  const [teamData, setTeamData] = useState({ teamName: '', captainName: '', category: 'Under-19' });
  const [matchData, setMatchData] = useState({ team1: '', team2: '', date: '', time: '', pitch: 'Pitch 1' });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [selectedDropdownPlayer, setSelectedDropdownPlayer] = useState('');

  const selectedPlayers = useMemo(
    () => freeAgents.filter((p) => selectedPlayerIds.includes(p.id)),
    [freeAgents, selectedPlayerIds]
  );

  const availableFreeAgents = useMemo(
    () => freeAgents.filter((p) => !selectedPlayerIds.includes(p.id)),
    [freeAgents, selectedPlayerIds]
  );

  if (!isOpen) return null;

  const handleAddPlayerToRoster = () => {
    if (!selectedDropdownPlayer) return;
    if (selectedPlayerIds.length >= 7) {
      alert('A team can have a maximum of 7 players.');
      return;
    }
    setSelectedPlayerIds((prev) => [...prev, selectedDropdownPlayer]);
    setSelectedDropdownPlayer('');
  };

  const handleRemovePlayerFromRoster = (id) => {
    setSelectedPlayerIds((prev) => prev.filter((pid) => pid !== id));
  };

  const handleSubmitTeam = async (e) => {
    e.preventDefault();
    if (currentTeamsCount >= 32) {
      alert('Tournament Limit Reached! Cannot add more than 32 teams.');
      return;
    }

    if (!teamData.teamName.trim() || !teamData.captainName.trim()) {
      alert('Please provide a team name and captain name.');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const teamRef = doc(collection(db, 'teams'));
      const members = selectedPlayers.map((p) => p.name);
      const memberIds = selectedPlayers.map((p) => p.id);

      batch.set(teamRef, {
        ...teamData,
        status: 'approved',
        createdAt: new Date(),
        members,
        memberIds,
      });

      selectedPlayers.forEach((player) => {
        const userRef = doc(db, 'users', player.id);
        batch.update(userRef, {
          hasTeam: true,
          teamId: teamRef.id,
          assignedTeam: teamData.teamName,
        });
      });

      await batch.commit();
      alert('Team Successfully Registered!');
      onClose();
      setView('options');
      setSelectedPlayerIds([]);
      setSelectedDropdownPlayer('');
    } catch (e) {
      console.error(e);
      alert('Failed to create team. Please try again.');
    }
    setLoading(false);
  };

  const handleSubmitMatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "matches"), { ...matchData, score: null, topScorer: null, yellowCards: 0, redCards: 0, status: "upcoming" });
      alert("Match Scheduled!");
      onClose();
      setView('options');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="glass w-full max-w-md rounded-[2.5rem] p-8 relative border-white/20 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          {view !== 'options' && <button onClick={() => setView('options')} className="text-slate-400 hover:text-white"><FaArrowLeft /></button>}
          <h3 className="text-xl font-bold flex-1 text-center">{view === 'options' ? 'Quick Actions' : view === 'teamForm' ? 'New Team' : 'New Match'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><FaTimes size={20} /></button>
        </div>

        {view === 'options' && (
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => setView('teamForm')} className="flex items-center gap-4 p-5 glass hover:bg-blue-600/20 rounded-3xl transition-all">
              <div className="size-12 rounded-2xl bg-blue-600/20 flex items-center justify-center"><FaUsers className="text-blue-500"/></div>
              <div className="text-left"><p className="font-bold">Add Team</p><p className="text-[10px] text-slate-400">{currentTeamsCount}/32 Slots Used</p></div>
            </button>
            <button onClick={() => setView('matchForm')} className="flex items-center gap-4 p-5 glass hover:bg-accent-lime/10 rounded-3xl transition-all">
              <div className="size-12 rounded-2xl bg-accent-lime/20 flex items-center justify-center"><FaFutbol className="text-accent-lime"/></div>
              <div className="text-left"><p className="font-bold">Schedule Match</p><p className="text-[10px] text-slate-400">Create game fixture</p></div>
            </button>
          </div>
        )}

        {view === 'teamForm' && (
          <form onSubmit={handleSubmitTeam} className="flex flex-col gap-4 animate-in slide-in-from-right-4">
            <input required placeholder="Team Name" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none" onChange={(e) => setTeamData({...teamData, teamName: e.target.value})}/>
            <input required placeholder="Captain Name" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none" onChange={(e) => setTeamData({...teamData, captainName: e.target.value})}/>
            
            <div className="flex gap-3">
               <select className="flex-1 bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none" value={selectedDropdownPlayer} onChange={e => setSelectedDropdownPlayer(e.target.value)}>
                   <option value="">Select Players (Optional)</option>
                   {availableFreeAgents.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
               </select>
               <button type="button" onClick={handleAddPlayerToRoster} className="bg-blue-600/20 text-blue-500 border border-blue-500/30 font-black px-6 rounded-2xl hover:bg-blue-500 hover:text-white transition-all text-xl"><FaPlus /></button>
            </div>

            {selectedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-2 bg-black/20 p-4 rounded-2xl border border-white/5">
                    {selectedPlayers.map(p => (
                        <div key={p.id} className="bg-slate-800 text-xs px-4 py-2 text-white font-bold rounded-xl flex items-center gap-3">
                            {p.name} <FaTimes className="cursor-pointer text-red-500 hover:scale-125 transition-all" onClick={() => handleRemovePlayerFromRoster(p.id)} />
                        </div>
                    ))}
                </div>
            )}

            <button disabled={loading} className="w-full bg-blue-600 text-white h-14 rounded-2xl font-bold mt-4 shadow-xl hover:bg-blue-500 active:scale-95 transition-all">{loading ? 'Saving...' : 'Create Team'}</button>
          </form>
        )}

        {view === 'matchForm' && (
          <form onSubmit={handleSubmitMatch} className="flex flex-col gap-4 animate-in slide-in-from-right-4">
            <input required placeholder="Team 1" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none" onChange={(e) => setMatchData({...matchData, team1: e.target.value})}/>
            <input required placeholder="Team 2" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none" onChange={(e) => setMatchData({...matchData, team2: e.target.value})}/>
            <div className="grid grid-cols-2 gap-3">
              <input required type="date" className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setMatchData({...matchData, date: e.target.value})}/>
              <input required type="time" className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setMatchData({...matchData, time: e.target.value})}/>
            </div>
            <button disabled={loading} className="w-full bg-accent-lime text-slate-900 h-14 rounded-2xl font-bold mt-4"><FaCalendarAlt /> Confirm Match</button>
          </form>
        )}
      </div>
    </div>
  );
};
export default AddActionModal;