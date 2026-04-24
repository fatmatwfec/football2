import React, { useState } from 'react';
import { db } from '../firebase';
import {
  doc, writeBatch, arrayUnion, arrayRemove,
  collection, getDocs, query, where,
} from 'firebase/firestore';
import {
  FaUserPlus, FaShieldAlt, FaUserMinus, FaTrashAlt, FaFutbol, 
  FaSearch, FaTimes, FaBan, FaPen, FaCheck,
  FaTrophy, FaUsers, FaGamepad
} from 'react-icons/fa';
import { updateTeamNameInTournament } from '../services/tournamentService';

const getSuspensionType = (player) => {
  if (!player.suspendedForNextMatch) return null;
  if (player.suspendReason === 'red') return 'red';
  if (player.suspendReason === 'yellow') return 'yellow';
  if (player.suspendReason === 'accumulated') return 'yellow';
  if (Number(player.redCards || 0) > 0) return 'red';
  return 'yellow';
};

const isSuspended = (player) => !!player.suspendedForNextMatch;

const TeamsTab = ({ teams, players, matches = [], readOnly = false }) => {
  const [selectedPlayers, setSelectedPlayers] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [renamingTeamId, setRenamingTeamId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const getTeamMembers = (team) =>
    players.filter(p => p.teamId && String(p.teamId).trim() === String(team.id).trim());

  const freeAgents = players.filter(p =>
    (p.role === 'student' || p.role === 'player') && !p.hasTeam
  );

  const filteredTeams = teams.filter(t =>
    t.teamName?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const handleDeleteTeam = async (teamId, teamName) => {
    if (readOnly) return;
    if (!window.confirm(`Are you sure you want to delete ${teamName}? All members will become Free Agents.`)) return;
    try {
      const batch = writeBatch(db);
      const teamObj = teams.find(t => t.id === teamId);
      getTeamMembers(teamObj).forEach(member => {
        batch.update(doc(db, 'users', member.id), {
          hasTeam: false, teamId: '', assignedTeam: '',
        });
      });
      batch.delete(doc(db, 'teams', teamId));
      await batch.commit();
    } catch (error) { console.error(error); }
  };

  const handleAddPlayer = async (teamId, teamName) => {
    if (readOnly) return;
    const currentPlayerId = selectedPlayers[teamId];
    if (!currentPlayerId) return alert('Please select a player first!');

    const teamObj = teams.find(t => t.id === teamId);
    const teamMembers = getTeamMembers(teamObj);
    if (teamMembers.length >= 7) return alert('Team is full!');

    const player = freeAgents.find(p => p.id === currentPlayerId);
    if (!player || !window.confirm(`Add ${player.name} to ${teamName}?`)) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), {
        memberIds: arrayUnion(player.id),
        members: arrayUnion(player.name),
      });
      batch.update(doc(db, 'users', player.id), {
        hasTeam: true, teamId, assignedTeam: teamName,
      });
      await batch.commit();
      setSelectedPlayers(prev => ({ ...prev, [teamId]: '' }));
    } catch (error) { console.error(error); }
  };

  const handleRemovePlayer = async (teamId, teamName, player) => {
    if (readOnly) return;
    if (!window.confirm(`Remove ${player.name} from ${teamName}?`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), {
        memberIds: arrayRemove(player.id),
        members: arrayRemove(player.name),
      });
      batch.update(doc(db, 'users', player.id), {
        hasTeam: false, teamId: '', assignedTeam: '',
      });
      await batch.commit();
    } catch (error) { console.error(error); }
  };

  const handleRenameTeam = async (teamId, e) => {
    if (readOnly) return;
    e?.stopPropagation();
    const newName = renameValue.trim();
    if (!newName) return alert('Team name cannot be empty!');

    const teamObj = teams.find(t => t.id === teamId);
    const oldName = teamObj.teamName;
    if (newName === oldName) { cancelRename(); return; }

    if (!window.confirm(`Rename "${oldName}" to "${newName}"?`)) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), { teamName: newName });
      getTeamMembers(teamObj).forEach(member => {
        batch.update(doc(db, 'users', member.id), { assignedTeam: newName });
      });
      const snap1 = await getDocs(query(collection(db, 'matches'), where('team1Name', '==', oldName)));
      snap1.forEach(d => batch.update(d.ref, { team1Name: newName }));
      const snap2 = await getDocs(query(collection(db, 'matches'), where('team2Name', '==', oldName)));
      snap2.forEach(d => batch.update(d.ref, { team2Name: newName }));
      await batch.commit();
      await updateTeamNameInTournament(teamId, newName);
      cancelRename();
    } catch (error) {
      console.error(error);
      alert('Failed to rename team.');
    }
  };

  const startRename = (team, e) => {
    if (readOnly) return;
    e.stopPropagation();
    setRenamingTeamId(team.id);
    setRenameValue(team.teamName);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setRenamingTeamId(null);
    setRenameValue('');
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-slate-900 to-emerald-950/30">
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-black text-white flex items-center gap-3">
              <FaTrophy className="text-emerald-500" />
              Tournament Teams
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Meet the competing teams and their statistics
            </p>
          </div>
          
          <div className="flex gap-3">
            <div className="relative w-64">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Search teams..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl py-2 pl-9 pr-8 text-white text-sm outline-none focus:border-emerald-500 transition-all"
              />
              {teamSearch && (
                <button onClick={() => setTeamSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <FaTimes size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cards View */}
        {(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.length > 0 ? filteredTeams.map((team) => {
              const currentMembers = getTeamMembers(team);
              const isRenaming = renamingTeamId === team.id;

              return (
                <div
                  key={team.id}
                  className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:border-emerald-500/30 transition-all"
                >
                  {/* Header */}
                  <div className="p-5 pb-3 border-b border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isRenaming ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameTeam(team.id, e);
                                if (e.key === 'Escape') cancelRename(e);
                              }}
                              className="bg-slate-800 border border-emerald-500 rounded-lg px-2 py-1 text-white text-2xl font-bold outline-none"
                            />
                            <button onClick={(e) => handleRenameTeam(team.id, e)} className="text-emerald-500 hover:text-emerald-400 p-1">
                              <FaCheck size={14} />
                            </button>
                            <button onClick={cancelRename} className="text-red-500 hover:text-red-400 p-1">
                              <FaTimes size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-white font-black text-2xl">{team.teamName}</h3>
                            {!readOnly && (
                              <button onClick={(e) => startRename(team, e)} className="text-slate-500 hover:text-emerald-400">
                                <FaPen size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {!readOnly && (
                        <button
                          onClick={() => handleDeleteTeam(team.id, team.teamName)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <FaTrashAlt size={14} />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FaGamepad size={18} className="text-emerald-500" />
                      <span className="text-slate-300 font-medium text-base">{currentMembers.length} Players</span>
                    </div>
                  </div>

                  {/* Roster */}
                  <div className="px-5 pb-3">
                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer text-slate-400 text-xs font-bold uppercase py-2 border-t border-white/10 pt-3">
                        <span>📋 Roster ({currentMembers.length})</span>
                        <span className="transform group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {currentMembers.map((member) => {
                          const suspended = isSuspended(member);
                          const suspType = getSuspensionType(member);
                          return (
                            <div
                              key={member.id}
                              onClick={() => setSelectedMember(member)}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                                suspended 
                                  ? suspType === 'red' ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-yellow-500/10 hover:bg-yellow-500/20'
                                  : 'bg-slate-800/30 hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${suspended ? (suspType === 'red' ? 'bg-red-500' : 'bg-yellow-500') : 'bg-emerald-500'}`} />
                                <span className="text-white text-sm">{member.name}</span>
                                {suspended && suspType === 'red' && (
                                  <span className="text-red-400 text-[8px] font-bold">🟥 Banned</span>
                                )}
                                {suspended && suspType === 'yellow' && (
                                  <span className="text-yellow-400 text-[8px] font-bold">🟨 Suspended</span>
                                )}
                              </div>
                              {!readOnly && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }}
                                  className="text-slate-600 hover:text-red-400"
                                >
                                  <FaUserMinus size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {currentMembers.length === 0 && (
                          <div className="text-center py-3 text-slate-600 text-xs">No players yet</div>
                        )}
                      </div>
                    </details>
                  </div>

                  {/* Add Player */}
                  {!readOnly && (
                    <div className="p-5 pt-2 border-t border-white/10 mt-2">
                      <div className="flex gap-2">
                        <select
                          value={selectedPlayers[team.id] || ''}
                          onChange={(e) => setSelectedPlayers(prev => ({ ...prev, [team.id]: e.target.value }))}
                          className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-emerald-500"
                        >
                          <option value="">+ Add Free Agent</option>
                          {freeAgents.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddPlayer(team.id, team.teamName)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl transition-all"
                        >
                          <FaUserPlus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <FaUsers className="text-slate-600 text-3xl" />
                </div>
                <p className="text-slate-500 font-medium">No teams found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Player Modal */}
      {selectedMember && (
        <PlayerModal player={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
};

const PlayerModal = ({ player, onClose }) => {
  const suspended = isSuspended(player);
  const suspType = getSuspensionType(player);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <FaTimes size={16} />
        </button>
        
        <div className="text-center mb-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
            suspended ? (suspType === 'red' ? 'bg-red-500/20 border border-red-500/30' : 'bg-yellow-500/20 border border-yellow-500/30') : 'bg-emerald-500/20 border border-emerald-500/30'
          }`}>
            {suspended ? <FaBan className={suspType === 'red' ? 'text-red-500 text-2xl' : 'text-yellow-500 text-2xl'} /> : <FaShieldAlt className="text-emerald-500 text-2xl" />}
          </div>
          <h3 className="text-white font-bold text-xl">{player.name}</h3>
          <p className="text-emerald-500 text-[10px] font-bold uppercase mt-1">{player.position || 'Player'}</p>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-800 rounded-xl p-2 text-center">
            <FaFutbol className="text-emerald-500 mx-auto mb-1 text-sm" />
            <p className="text-white font-bold text-lg">{player.goals || 0}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase">Goals</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-2 text-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-sm mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{player.yellowCards || 0}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase">Yellow</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-2 text-center">
            <div className="w-3 h-3 bg-red-500 rounded-sm mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{player.redCards || 0}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase">Red</p>
          </div>
        </div>
        
        <button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-sm font-bold transition-all">
          Close
        </button>
      </div>
    </div>
  );
};

export default TeamsTab;