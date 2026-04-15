import React, { useState } from 'react';
import { db } from '../firebase';
import {
  doc, writeBatch, arrayUnion, arrayRemove,
  collection, getDocs, query, where,
} from 'firebase/firestore';
import {
  FaUserPlus, FaShieldAlt, FaUserMinus, FaTrashAlt, FaFutbol, FaSquare,
  FaCheckCircle, FaExclamationTriangle, FaSearch, FaTimes, FaBan, FaPen, FaCheck,
} from 'react-icons/fa';

const getSuspensionType = (player) => {
  if (!player.suspendedForNextMatch) return null;
  if (player.suspendReason === 'red')         return 'red';
  if (player.suspendReason === 'yellow')      return 'yellow';
  if (player.suspendReason === 'accumulated') return 'yellow';
  if (Number(player.redCards || 0) > 0)       return 'red';
  return 'yellow';
};

const isSuspended = (player) => !!player.suspendedForNextMatch;

// ─────────────────────────────────────────────────────────────
const TeamsTab = ({ teams, players }) => {

  const [selectedPlayers, setSelectedPlayers] = useState({});
  const [selectedMember,  setSelectedMember]  = useState(null);
  const [teamSearch,      setTeamSearch]      = useState('');
  const [renamingTeamId,  setRenamingTeamId]  = useState(null);
  const [renameValue,     setRenameValue]     = useState('');

  const getTeamMembers = (team) =>
    players.filter(p =>
      p.teamId && String(p.teamId).trim() === String(team.id).trim()
    );

  const freeAgents = players.filter(p =>
    (p.role === 'student' || p.role === 'player') && !p.hasTeam
  );

  const filteredTeams = teams.filter(t =>
    t.teamName?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // ── Delete Team ───────────────────────────────────────────
  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete ${teamName}? All members will become Free Agents.`)) return;
    try {
      const batch   = writeBatch(db);
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

  // ── Add Player ────────────────────────────────────────────
  const handleAddPlayer = async (teamId, teamName) => {
    const currentPlayerId = selectedPlayers[teamId];
    if (!currentPlayerId) return alert('Please select a player first!');

    const teamObj     = teams.find(t => t.id === teamId);
    const teamMembers = getTeamMembers(teamObj);
    if (teamMembers.length >= 7) return alert('Team is full!');

    const player = freeAgents.find(p => p.id === currentPlayerId);
    if (!player || !window.confirm(`Add ${player.name} to ${teamName}?`)) return;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), {
        memberIds: arrayUnion(player.id),
        members:   arrayUnion(player.name),
      });
      batch.update(doc(db, 'users', player.id), {
        hasTeam: true, teamId, assignedTeam: teamName,
      });
      await batch.commit();
      setSelectedPlayers(prev => ({ ...prev, [teamId]: '' }));
    } catch (error) { console.error(error); }
  };

  // ── Remove Player ─────────────────────────────────────────
  const handleRemovePlayer = async (teamId, teamName, player) => {
    if (!window.confirm(`Remove ${player.name} from ${teamName}?`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), {
        memberIds: arrayRemove(player.id),
        members:   arrayRemove(player.name),
      });
      batch.update(doc(db, 'users', player.id), {
        hasTeam: false, teamId: '', assignedTeam: '',
      });
      await batch.commit();
    } catch (error) { console.error(error); }
  };
  const handleRenameTeam = async (teamId, e) => {
    e?.stopPropagation();
    const newName = renameValue.trim();
    if (!newName) return alert('Team name cannot be empty!');

    const teamObj = teams.find(t => t.id === teamId);
    const oldName = teamObj.teamName;
    if (newName === oldName) { cancelRename(); return; }

    if (!window.confirm(`Rename "${oldName}" to "${newName}"?\nسيتم تحديث الاسم في الفرق والمباريات والطلاب.`)) return;

    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'teams', teamId), { teamName: newName });

      getTeamMembers(teamObj).forEach(member => {
        batch.update(doc(db, 'users', member.id), { assignedTeam: newName });
      });

      const snap1 = await getDocs(
        query(collection(db, 'matches'), where('team1Name', '==', oldName))
      );
      snap1.forEach(d => batch.update(d.ref, { team1Name: newName }));

      const snap2 = await getDocs(
        query(collection(db, 'matches'), where('team2Name', '==', oldName))
      );
      snap2.forEach(d => batch.update(d.ref, { team2Name: newName }));

      await batch.commit();
      cancelRename();
    } catch (error) {
      console.error(error);
      alert('Failed to rename team. Please try again.');
    }
  };

  const startRename = (team, e) => {
    e.stopPropagation();
    setRenamingTeamId(team.id);
    setRenameValue(team.teamName);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setRenamingTeamId(null);
    setRenameValue('');
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 pb-20 px-4 max-w-7xl mx-auto">

      {/* Header */}
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
            <button onClick={() => setTeamSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <FaTimes size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTeams.length > 0 ? filteredTeams.map((team) => {
          const currentMembers = getTeamMembers(team);
          const isFull         = currentMembers.length === 7;
          const isRenaming     = renamingTeamId === team.id;

          return (
            <div
              key={team.id}
              className={`glass rounded-3xl p-6 border-2 transition-all shadow-xl relative bg-slate-900/40 min-h-[500px] flex flex-col ${
                isFull ? 'border-emerald-500/30' : 'border-white/5'
              }`}
            >
              {/* Status Badge */}
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

              <button
                onClick={() => handleDeleteTeam(team.id, team.teamName)}
                className="absolute top-6 right-6 text-slate-600 hover:text-red-500 transition-all"
              >
                <FaTrashAlt size={14} />
              </button>

              {/* Team Header */}
              <div className="flex items-center gap-5 mb-6">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center text-white text-2xl font-black border border-white/10 shadow-lg flex-shrink-0">
                  {(isRenaming ? renameValue : team.teamName)?.[0]?.toUpperCase() || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  handleRenameTeam(team.id, e);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                        className="flex-1 bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-white text-sm font-black uppercase outline-none focus:border-emerald-400 transition-all"
                      />
                      <button
                        onClick={(e) => handleRenameTeam(team.id, e)}
                        className="text-emerald-500 hover:text-emerald-400 transition-all p-1"
                        title="Confirm rename"
                      >
                        <FaCheck size={14} />
                      </button>
                      <button
                        onClick={cancelRename}
                        className="text-slate-500 hover:text-white transition-all p-1"
                        title="Cancel"
                      >
                        <FaTimes size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/rename">
                      <h3 className="text-white font-black text-xl uppercase leading-none truncate">
                        {team.teamName}
                      </h3>
                      <button
                        onClick={(e) => startRename(team, e)}
                        className="text-slate-600 hover:text-emerald-400 transition-all opacity-0 group-hover/rename:opacity-100 flex-shrink-0"
                        title="Rename team"
                      >
                        <FaPen size={11} />
                      </button>
                    </div>
                  )}
                  <span className="text-emerald-500/70 text-[9px] font-black uppercase tracking-wider">Official Squad</span>
                </div>
              </div>

              {/* Roster */}
              <div className="space-y-2 mb-6 flex-grow">
                <div className="flex justify-between items-end px-1 mb-2">
                  <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Roster</h4>
                  <p className="text-white font-mono text-lg">
                    {currentMembers.length}<span className="text-slate-600">/7</span>
                  </p>
                </div>

                {currentMembers.map((member) => {
                  const suspended    = isSuspended(member);
                  const suspType     = getSuspensionType(member);
                  const isRedSusp    = suspended && suspType === 'red';
                  const isYellowSusp = suspended && suspType === 'yellow';

                  return (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`flex items-center justify-between p-3 rounded-2xl border group/member transition-all cursor-pointer ${
                        isRedSusp
                          ? 'border-red-500/40 bg-red-500/10 hover:border-red-400/60'
                          : isYellowSusp
                          ? 'border-yellow-500/40 bg-yellow-500/10 hover:border-yellow-400/60'
                          : 'border-white/5 bg-slate-950/40 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-2 rounded-full flex-shrink-0 ${
                          isRedSusp    ? 'bg-red-500 animate-pulse'
                          : isYellowSusp ? 'bg-yellow-500 animate-pulse'
                          : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        }`} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-white text-sm font-bold truncate max-w-[150px]">{member.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">
                              {member.position || 'Player'}
                            </span>
                            {isRedSusp && (
                              <span className="flex items-center gap-1 text-red-400 text-[8px] font-black uppercase bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                                🟥 RED CARD — BANNED
                              </span>
                            )}
                            {isYellowSusp && (
                              <span className="flex items-center gap-1 text-yellow-400 text-[8px] font-black uppercase bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                                🟨 YELLOW — SUSPENDED
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemovePlayer(team.id, team.teamName, member); }}
                        className="text-slate-700 hover:text-red-500 transition-all flex-shrink-0"
                      >
                        <FaUserMinus size={16} />
                      </button>
                    </div>
                  );
                })}

                {currentMembers.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl">
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">
                      Waiting for recruitment...
                    </p>
                  </div>
                )}
              </div>

              {/* Add Player */}
              <div className="pt-4 border-t border-white/5 flex gap-2 mt-auto">
                <select
                  value={selectedPlayers[team.id] || ''}
                  onChange={(e) => setSelectedPlayers(prev => ({ ...prev, [team.id]: e.target.value }))}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-emerald-500"
                >
                  <option value="">+ Add Free Agent</option>
                  {freeAgents.map(p => {
                    const susp = getSuspensionType(p);
                    const tag  = susp === 'red' ? ' 🟥' : susp === 'yellow' ? ' 🟨' : '';
                    return <option key={p.id} value={p.id}>{p.name}{tag}</option>;
                  })}
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

      {/* Player Profile Modal */}
      {selectedMember && (
        <PlayerModal player={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
};

// ─── Player Profile Modal ─────────────────────────────────────
const PlayerModal = ({ player, onClose }) => {
  const suspended = isSuspended(player);
  const suspType  = getSuspensionType(player);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl animate-in zoom-in duration-300 relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white">
          <FaTimes size={20} />
        </button>
        <div className="text-center mb-6">
          <div className={`size-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-xl ${
            suspended
              ? suspType === 'red' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            {suspended
              ? <FaBan className={suspType === 'red' ? 'text-red-500' : 'text-yellow-500'} size={36} />
              : <FaShieldAlt className="text-emerald-500" size={36} />
            }
          </div>
          <h3 className="text-white font-black text-2xl uppercase tracking-tighter">{player.name}</h3>
          <p className="text-emerald-500 font-black uppercase tracking-widest mt-1 text-[10px] italic">Squad Member</p>
          {suspended && (
            <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${
              suspType === 'red'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
            }`}>
              <FaBan size={10} />
              {suspType === 'red' ? '🟥 Red Card — Banned next match' : '🟨 Yellow Cards — Suspended next match'}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatBox icon={<FaFutbol className="text-emerald-500" size={16} />} value={player.goals || 0} label="Goals" />
          <StatBox
            icon={<FaSquare className="text-yellow-400" size={16} />}
            value={player.yellowCards || 0} label="Yellow"
            highlight={Number(player.yellowCards || 0) >= 2} highlightColor="yellow"
          />
          <StatBox
            icon={<FaSquare className="text-red-500" size={16} />}
            value={player.redCards || 0} label="Red"
            highlight={Number(player.redCards || 0) > 0} highlightColor="red"
          />
        </div>
        <button
          onClick={onClose}
          className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-black uppercase transition-all shadow-lg"
        >
          Done
        </button>
      </div>
    </div>
  );
};

// ─── Stat Box ─────────────────────────────────────────────────
const StatBox = ({ icon, value, label, highlight = false, highlightColor = 'emerald' }) => {
  const borderClass = highlight
    ? highlightColor === 'red'    ? 'border-red-500/40 bg-red-500/10'
    : highlightColor === 'yellow' ? 'border-yellow-500/40 bg-yellow-500/10'
    : 'border-white/5 bg-white/5'
    : 'border-white/5 bg-white/5';

  return (
    <div className={`p-4 rounded-2xl border text-center transition-all ${borderClass}`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-white text-xl font-black">{value}</p>
      <p className="text-slate-500 text-[8px] font-black uppercase">{label}</p>
    </div>
  );
};

export default TeamsTab;