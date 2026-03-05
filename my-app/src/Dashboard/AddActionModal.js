import React, { useState } from 'react';
import { FaUsers, FaFutbol, FaTimes, FaArrowLeft, FaSave, FaCalendarAlt } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const AddActionModal = ({ isOpen, onClose, currentTeamsCount }) => {
  const [view, setView] = useState('options'); 
  const [loading, setLoading] = useState(false);
  const [teamData, setTeamData] = useState({ teamName: '', captainName: '', category: 'Under-19' });
  const [matchData, setMatchData] = useState({ team1: '', team2: '', date: '', time: '', pitch: 'Pitch 1' });

  if (!isOpen) return null;

  const handleSubmitTeam = async (e) => {
    e.preventDefault();
    if (currentTeamsCount >= 32) {
      alert("Tournament Limit Reached! Cannot add more than 32 teams.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "teams"), { ...teamData, status: "approved", createdAt: new Date(), members: [] });
      alert("Team Successfully Registered!");
      onClose();
      setView('options');
    } catch (e) { console.error(e); }
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
            <button disabled={loading} className="w-full bg-blue-600 text-white h-14 rounded-2xl font-bold mt-4">{loading ? 'Saving...' : 'Create Team'}</button>
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