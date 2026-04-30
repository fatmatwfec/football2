import React, { useState, useMemo } from 'react';
import { FaUsers, FaFutbol, FaTimes, FaArrowLeft, FaCalendarAlt, FaUserPlus, FaUserMinus, FaPlus } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';

const AddActionModal = ({ isOpen, onClose, currentTeamsCount, freeAgents = [] }) => {
  const [view, setView] = useState('options');
  const [loading, setLoading] = useState(false);
  const [teamData, setTeamData] = useState({ teamName: '', captainName: '', captainId: '', category: 'Under-19' });
  const [matchData, setMatchData] = useState({ team1: '', team2: '', date: '', time: '', pitch: 'Pitch 1' });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [selectedDropdownPlayer, setSelectedDropdownPlayer] = useState('');

  const selectedPlayers = useMemo(
    () => freeAgents.filter((p) => selectedPlayerIds.includes(p.id)),
    [freeAgents, selectedPlayerIds]
  );

  const availableFreeAgents = useMemo(
    () => freeAgents.filter((p) => !selectedPlayerIds.includes(p.id) && p.id !== teamData.captainId),
    [freeAgents, selectedPlayerIds, teamData.captainId]
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in"
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-gradient-to-br from-[#121821] to-[#0a0f16] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-slide-up">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10 bg-gradient-to-r from-[#00FF9C]/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {view !== 'options' && (
                <button 
                  onClick={() => setView('options')} 
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <FaArrowLeft className="text-lg" />
                </button>
              )}
              <div className="w-8 h-8 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-lg flex items-center justify-center">
                {view === 'options' && <span className="text-black font-black text-lg">+</span>}
                {view === 'teamForm' && <FaUsers className="text-black text-sm" />}
                {view === 'matchForm' && <FaFutbol className="text-black text-sm" />}
              </div>
              <h3 className="text-xl font-bold text-white">
                {view === 'options' && 'Quick Actions'}
                {view === 'teamForm' && 'New Team'}
                {view === 'matchForm' && 'New Match'}
              </h3>
            </div>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <FaTimes size={18} />
            </button>
          </div>
        </div>

        {/* Options View */}
        {view === 'options' && (
          <div className="p-6 space-y-4">
            <button 
              onClick={() => setView('teamForm')} 
              className="w-full flex items-center gap-4 p-5 bg-[#121821] border border-white/10 rounded-xl hover:border-[#00FF9C]/30 hover:bg-white/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9C]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FaUsers className="text-[#00FF9C] text-xl" />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-white">Add Team</p>
                <p className="text-xs text-gray-500">{currentTeamsCount}/32 Slots Used</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#00FF9C]/20 transition-all">
                <FaPlus className="text-[#00FF9C] text-xs" />
              </div>
            </button>
            
            <button 
              onClick={() => setView('matchForm')} 
              className="w-full flex items-center gap-4 p-5 bg-[#121821] border border-white/10 rounded-xl hover:border-[#00FF9C]/30 hover:bg-white/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#00FF9C]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FaFutbol className="text-[#00FF9C] text-xl" />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-white">Friendly Match</p>
                <p className="text-xs text-gray-500">Create game fixture</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#00FF9C]/20 transition-all">
                <FaPlus className="text-[#00FF9C] text-xs" />
              </div>
            </button>
          </div>
        )}

        {/* Team Form View */}
        {view === 'teamForm' && (
          <form onSubmit={handleSubmitTeam} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team Name <span className="text-[#00FF9C]">*</span>
              </label>
              <input 
                required 
                placeholder="e.g., FC Barcelona" 
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                onChange={(e) => setTeamData({...teamData, teamName: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Captain Name <span className="text-[#00FF9C]">*</span>
              </label>
              <select 
                required 
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                value={teamData.captainId}
                onChange={(e) => {
                  const player = freeAgents.find(p => p.id === e.target.value);
                  if (player) {
                    setTeamData({...teamData, captainId: player.id, captainName: player.name});
                    // Also add captain to selected players if not already there
                    if (!selectedPlayerIds.includes(player.id)) {
                      setSelectedPlayerIds(prev => [...prev, player.id]);
                    }
                  }
                }}
              >
                <option value="" className="bg-[#121821]">Select team captain</option>
                {freeAgents.map(p => (
                  <option value={p.id} key={p.id} className="bg-[#121821]">{p.name || p.email}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Add Players (Optional)
              </label>
              <div className="flex gap-3">
                <select 
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                  value={selectedDropdownPlayer} 
                  onChange={e => setSelectedDropdownPlayer(e.target.value)}
                >
                  <option value="" className="bg-[#121821]">Select a player</option>
                  {availableFreeAgents.map(p => (
                    <option value={p.id} key={p.id} className="bg-[#121821]">{p.name || p.email}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={handleAddPlayerToRoster} 
                  className="bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20 font-bold px-6 rounded-xl hover:bg-[#00FF9C]/20 hover:scale-105 transition-all"
                >
                  <FaPlus />
                </button>
              </div>
            </div>

            {selectedPlayers.length > 0 && (
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-3">Selected Players ({selectedPlayers.length}/7)</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPlayers.map(p => (
                    <div key={p.id} className="bg-white/5 text-xs px-3 py-2 text-white rounded-lg flex items-center gap-2 border border-white/10">
                      <span>{p.name || p.email}</span>
                      <FaTimes 
                        className="cursor-pointer text-red-400 hover:text-red-300 hover:scale-110 transition-all text-xs" 
                        onClick={() => handleRemovePlayerFromRoster(p.id)} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              disabled={loading} 
              className="w-full bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold py-3 rounded-xl hover:scale-105 transition-all duration-300 glow-on-hover disabled:opacity-50 disabled:hover:scale-100 mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  Creating...
                </div>
              ) : (
                'Create Team'
              )}
            </button>
          </form>
        )}

        {/* Match Form View */}
        {view === 'matchForm' && (
          <form onSubmit={handleSubmitMatch} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team 1 <span className="text-[#00FF9C]">*</span>
              </label>
              <input 
                required 
                placeholder="Team name" 
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                onChange={(e) => setMatchData({...matchData, team1: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team 2 <span className="text-[#00FF9C]">*</span>
              </label>
              <input 
                required 
                placeholder="Team name" 
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                onChange={(e) => setMatchData({...matchData, team2: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date <span className="text-[#00FF9C]">*</span>
                </label>
                <input 
                  required 
                  type="date" 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                  onChange={(e) => setMatchData({...matchData, date: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Time <span className="text-[#00FF9C]">*</span>
                </label>
                <input 
                  required 
                  type="time" 
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00FF9C] focus:ring-1 focus:ring-[#00FF9C] transition-all" 
                  onChange={(e) => setMatchData({...matchData, time: e.target.value})}
                />
              </div>
            </div>
            
            <button 
              disabled={loading} 
              className="w-full bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold py-3 rounded-xl hover:scale-105 transition-all duration-300 glow-on-hover flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              <FaCalendarAlt />
              {loading ? 'Scheduling...' : 'Confirm Match'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddActionModal;