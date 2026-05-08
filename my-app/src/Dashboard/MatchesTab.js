import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { FaTrophy, FaTrash, FaFutbol, FaTimes, FaCalendarAlt, FaClock, FaCheckCircle, FaBan, FaFire, FaFilter, FaMapMarkerAlt, FaTv, FaCalendarPlus } from 'react-icons/fa';
import { scheduleMatch, prepareMatchForResult, finalizeMatch, deleteMatch, syncMatchStatuses } from '../services/matchService';
import { getRoundLabel, buildMatchCache, getMatchRoundFromCache } from '../services/tournamentService';

const MatchesTab = ({ readOnly = false }) => {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roundFilter, setRoundFilter] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [newMatch, setNewMatch] = useState({
    team1Id: '', team2Id: '', team1Name: '', team2Name: '',
    date: '', time: '', pitch: 'Main Pitch',
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'matches'), (snap) => {
        const sorted = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
        setMatches(sorted);
      }),
      onSnapshot(collection(db, 'teams'), (snap) => {
        setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
      onSnapshot(collection(db, 'users'), (snap) => {
        setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }),
      onSnapshot(doc(db, 'tournaments', 'main'), (snap) => {
        setTournament(snap.exists() ? snap.data() : null);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!matches.length) return;
    syncMatchStatuses(matches);
    const interval = setInterval(() => {
      setNow(Date.now());
      syncMatchStatuses(matches);
    }, 60000);
    return () => clearInterval(interval);
  }, [matches]);

  const matchCache = useMemo(() => buildMatchCache(tournament), [tournament]);

  const availableRounds = useMemo(() => {
    if (!tournament?.rounds) return [];
    return Object.keys(tournament.rounds)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((rKey) => ({
        key: parseInt(rKey),
        label: getRoundLabel(parseInt(rKey), Object.keys(tournament.rounds).length),
      }));
  }, [tournament]);

  const getPlayerCount = useCallback(
    (teamId) => players.filter((p) => p.teamId === teamId).length,
    [players],
  );

  const availableTeams = useCallback(
    (excludeId = null) =>
      teams.filter((t) => t.id !== excludeId),
    [teams, getPlayerCount],
  );

  const resolveTeamName = useCallback(
    (teamId, fallback) => {
      const found = teams.find(t => t.id === teamId);
      return found?.teamName || fallback;
    },
    [teams],
  );

  const enrichedMatches = useMemo(() =>
    matches.map(m => ({
      ...m,
      team1Name: resolveTeamName(m.team1Id, m.team1Name),
      team2Name: resolveTeamName(m.team2Id, m.team2Name),
    })),
    [matches, resolveTeamName],
  );



  const filterByRound = useCallback(
    (list) => {
      if (roundFilter === null || !tournament) return list;
      return list.filter((m) => {
        const info = getMatchRoundFromCache(matchCache, m.team1Id, m.team2Id);
        return info?.roundIndex === roundFilter;
      });
    },
    [roundFilter, tournament, matchCache],
  );

  const DURATION = 20 * 60 * 1000;

  const upcomingMatches = filterByRound(
    enrichedMatches.filter((m) => {
      if (m.status === 'completed') return false;
      if (!m.date || !m.time) return true;

      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(y, mm - 1, d, h, min).getTime();

      return matchTime > now;
    })
  );

  const liveMatches = filterByRound(
    enrichedMatches.filter((m) => {
      if (m.status === 'completed') return false;
      if (!m.date || !m.time) return false;

      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(y, mm - 1, d, h, min).getTime();

      return matchTime <= now && now < (matchTime + DURATION);
    })
  );

  const pendingMatches = filterByRound(
    enrichedMatches.filter((m) => {
      if (m.status === 'completed') return false;
      if (!m.date || !m.time) return false;

      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(y, mm - 1, d, h, min).getTime();

      return now >= (matchTime + DURATION);
    })
  );

  const completedMatches = filterByRound(
    enrichedMatches.filter((m) => m.status === 'completed')
  );

  const getMatchRoundLabel = (match) => {
    if (!tournament?.rounds) return null;
    const info = getMatchRoundFromCache(matchCache, match.team1Id, match.team2Id);
    if (!info) return null;
    return getRoundLabel(info.roundIndex, Object.keys(tournament.rounds).length);
  };

  const handleSchedule = async (e) => {
    if (readOnly) return;
    e.preventDefault();
    try {
      await scheduleMatch({
        ...newMatch,
        tournamentName: "Friendly"
      });
      setShowAddForm(false);
      setNewMatch({ team1Id: '', team2Id: '', team1Name: '', team2Name: '', date: '', time: '', pitch: 'Main Pitch' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenResult = async (matchId) => {
    if (readOnly) return;
    const rawMatch = matches.find(m => m.id === matchId);
    if (!rawMatch) return alert('Match not found');
    try {
      await prepareMatchForResult(rawMatch, players);
      const enrichedMatch = enrichedMatches.find(m => m.id === matchId);
      setShowResultModal(enrichedMatch || rawMatch);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFinalize = async (e) => {
    if (readOnly) return;
    e.preventDefault();
    setIsSubmitting(true);

    const fd = new FormData(e.target);
    const raw = Object.fromEntries(fd.entries());
    const rawMatch = matches.find(m => m.id === showResultModal.id);

    const activePlayers = players.filter(
      (p) =>
        (p.teamId === showResultModal.team1Id || p.teamId === showResultModal.team2Id) &&
        !p.suspendedForNextMatch,
    );

    try {
      const result = await finalizeMatch(rawMatch || showResultModal, raw, activePlayers);
      if (!result.ok) {
        alert(result.error);
      } else {
        alert('Match result saved!');
        setShowResultModal(null);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (matchId) => {
    if (readOnly) return;
    if (!window.confirm('Are you sure? Stats will be rolled back.')) return;
    const rawMatch = matches.find(m => m.id === matchId);
    if (!rawMatch) return alert('Match not found in database.');
    try {
      await deleteMatch(rawMatch);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const getTabCount = (tab) => {
    switch (tab) {
      case 'upcoming': return upcomingMatches.length;
      case 'live': return liveMatches.length;
      case 'pending': return pendingMatches.length;
      case 'completed': return completedMatches.length;
      default: return 0;
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-slate-900 to-[#0a1927]">
      <div className="relative max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-black text-white flex items-center gap-3">
              <FaTrophy className="text-[#00FF9C]" />
              Match Schedule
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Stay updated with all tournament matches
            </p>
          </div>

          {!readOnly && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`px-6 py-3 rounded-xl font-bold text-sm uppercase transition-all shadow-lg ${showAddForm
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black hover:scale-105'
                }`}
            >
              {showAddForm ? 'Cancel' : '+ Friendly Match'}
            </button>
          )}
        </div>

        {/* Add Match Form */}
        {showAddForm && !readOnly && (
          <div className="bg-[#121821]/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 mb-10 shadow-2xl animate-fade-slide-up">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[#00FF9C]/10 rounded-xl flex items-center justify-center border border-[#00FF9C]/20">
                <FaCalendarPlus className="text-[#00FF9C] text-xl" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg uppercase tracking-tight">Create Friendly Match</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Schedule a new fixture outside the tournament</p>
              </div>
            </div>

            <form onSubmit={handleSchedule} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Home Team */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Home Team</label>
                  <select
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#00FF9C] transition-all hover:bg-black/60"
                    onChange={(e) => {
                      const t = teams.find((x) => x.id === e.target.value);
                      if (t) setNewMatch({ ...newMatch, team1Id: t.id, team1Name: t.teamName });
                    }}
                  >
                    <option value="">Select Home Team</option>
                    {availableTeams(newMatch.team2Id).map((t) => (
                      <option key={t.id} value={t.id}>{t.teamName} ({getPlayerCount(t.id)} players)</option>
                    ))}
                  </select>
                </div>

                {/* Away Team */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Away Team</label>
                  <select
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-[#00FF9C] transition-all hover:bg-black/60"
                    onChange={(e) => {
                      const t = teams.find((x) => x.id === e.target.value);
                      if (t) setNewMatch({ ...newMatch, team2Id: t.id, team2Name: t.teamName });
                    }}
                  >
                    <option value="">Select Away Team</option>
                    {availableTeams(newMatch.team1Id).map((t) => (
                      <option key={t.id} value={t.id}>{t.teamName} ({getPlayerCount(t.id)} players)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block tracking-widest">Match Date</label>
                  <input 
                    type="date" 
                    required 
                    onKeyDown={(e) => e.preventDefault()}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 font-bold cursor-pointer" 
                    onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })} 
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block tracking-widest">Time</label>
                  <input 
                    type="time" 
                    required 
                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 font-bold" 
                    onChange={(e) => setNewMatch({ ...newMatch, time: e.target.value })} 
                  />
                </div>
              </div>

              {/* Pitch */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <FaMapMarkerAlt className="text-emerald-500/50" /> Pitch / Venue
                </label>
                <select 
                  className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 font-bold" 
                  value={newMatch.pitch} 
                  onChange={(e) => setNewMatch({ ...newMatch, pitch: e.target.value })}
                >
                  <option value="Main Pitch">Main Pitch</option>
                  <option value="Stadium A">Stadium A</option>
                  <option value="Stadium B">Stadium B</option>
                </select>
              </div>
              </div>

              <button type="submit" className="w-full py-4 bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-black rounded-2xl uppercase text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#00FF9C]/10 flex items-center justify-center gap-3">
                <FaCheckCircle />
                Confirm & Schedule Match
              </button>
            </form>
          </div>
        )}

        {/* Round Filter */}
        {availableRounds.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap items-center">
            <FaFilter className="text-gray-500 text-xs" />
            <button
              onClick={() => setRoundFilter(null)}
              className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${roundFilter === null
                  ? 'bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
            >
              All
            </button>
            {availableRounds.map((r) => (
              <button
                key={r.key}
                onClick={() => setRoundFilter(r.key)}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${roundFilter === r.key
                    ? 'bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto scrollbar-hide">
          {[
            { id: 'upcoming', label: 'Upcoming', icon: '📅', color: '#00FF9C' },
            { id: 'live', label: 'Live', icon: '🔴', color: '#f87171' },
            { id: 'pending', label: 'Pending Result', icon: '⏳', color: '#fbbf24' },
            { id: 'completed', label: 'Completed', icon: '✅', color: '#00FF9C' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-bold uppercase transition-all relative whitespace-nowrap ${activeTab === tab.id
                  ? `text-[${tab.color}] border-b-2`
                  : 'text-gray-500 hover:text-gray-300'
                }`}
              style={activeTab === tab.id ? { color: tab.color, borderColor: tab.color } : {}}
            >
              <span className="flex items-center gap-2">
                {tab.icon} {tab.label}
                {tab.id === 'live' && liveMatches.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </span>
              <span className={`ml-2 text-xs opacity-60`}>
                ({getTabCount(tab.id)})
              </span>
            </button>
          ))}
        </div>

        {/* Matches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'upcoming' && upcomingMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              type="upcoming"
              roundLabel={getMatchRoundLabel(match)}
              onEnterResult={() => handleOpenResult(match.id)}
              onDelete={() => handleDelete(match.id)}
              readOnly={readOnly}
            />
          ))}

          {activeTab === 'live' && liveMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              type="live"
              roundLabel={getMatchRoundLabel(match)}
              onEnterResult={() => handleOpenResult(match.id)}
              onDelete={() => handleDelete(match.id)}
              readOnly={readOnly}
            />
          ))}

          {activeTab === 'pending' && pendingMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              type="pending"
              roundLabel={getMatchRoundLabel(match)}
              onEnterResult={() => handleOpenResult(match.id)}
              onDelete={() => handleDelete(match.id)}
              readOnly={readOnly}
            />
          ))}

          {activeTab === 'completed' && completedMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              type="completed"
              roundLabel={getMatchRoundLabel(match)}
              onDelete={() => handleDelete(match.id)}
              readOnly={readOnly}
            />
          ))}
        </div>

        {/* Empty State */}
        {((activeTab === 'upcoming' && upcomingMatches.length === 0) ||
          (activeTab === 'live' && liveMatches.length === 0) ||
          (activeTab === 'pending' && pendingMatches.length === 0) ||
          (activeTab === 'completed' && completedMatches.length === 0)) && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <FaFutbol className="text-gray-600 text-3xl" />
              </div>
              <p className="text-gray-500 font-medium">No {activeTab} matches</p>
              <p className="text-gray-600 text-sm mt-1">Check back later for updates</p>
            </div>
          )}

        {/* Stats Footer */}
        <div className="mt-12 pt-6 border-t border-white/10 flex justify-center gap-8 text-center">
          <div>
            <p className="text-2xl font-black text-[#00FF9C]">{upcomingMatches.length + liveMatches.length + completedMatches.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Matches</p>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            <p className="text-2xl font-black text-[#00FF9C]">{upcomingMatches.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Upcoming</p>
          </div>
          <div className="w-px bg-white/10"></div>
          <div>
            <p className="text-2xl font-black text-red-400">{liveMatches.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Live Now</p>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && !readOnly && (
        <ResultModal
          match={showResultModal}
          players={players}
          isSubmitting={isSubmitting}
          onClose={() => setShowResultModal(null)}
          onSubmit={handleFinalize}
        />
      )}
    </div>
  );
};

// Match Card Component 
const MatchCard = ({ match, type, roundLabel, onEnterResult, onDelete, readOnly }) => {
  const isLive = type === 'live';
  const isPending = type === 'pending';
  const isCompleted = type === 'completed';

  return (
    <div className={`bg-[#121821] backdrop-blur-sm rounded-2xl border overflow-hidden transition-all hover:border-[#00FF9C]/30 ${isLive ? 'border-red-500/50 shadow-lg shadow-red-500/10' :
        isPending ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' :
          'border-white/10'
      }`}>
      {/* Status Bar */}
      <div className={`px-4 py-2 border-b flex justify-between items-center ${isLive ? 'bg-red-500/20 border-red-500/30' :
          isPending ? 'bg-amber-500/20 border-amber-500/30' :
            'bg-white/5 border-white/10'
        }`}>
        <div className="flex items-center gap-2">
          {roundLabel && (
            <span className="text-[9px] font-bold text-[#00FF9C] uppercase bg-[#00FF9C]/10 px-2 py-0.5 rounded-full">
              {roundLabel}
            </span>
          )}
          <span className="text-[14px] font-black text-amber-400 uppercase bg-amber-500/10 px-3 py-1.5 rounded-xl border-2 border-amber-500/30 shadow-lg shadow-amber-500/5">
            {match.tournamentName || "Friendly"}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? 'text-red-400 animate-pulse' :
              isPending ? 'text-amber-400' :
                isCompleted ? 'text-[#00FF9C]' : 'text-gray-400'
            }`}>
            {isLive ? '🔴 LIVE' : isPending ? '⏳ PENDING RESULT' : isCompleted ? '✅ FINISHED' : '📅 UPCOMING'}
          </span>
        </div>
        {!readOnly && (
          <button onClick={onDelete} className="text-gray-500 hover:text-red-400 transition-colors">
            <FaTrash size={12} />
          </button>
        )}
      </div>

      {/* Teams */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          {/* Team 1 */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
              <FaFutbol className="text-black text-2xl" />
            </div>
            <p className="text-white font-bold text-sm truncate">{match.team1Name}</p>
            {isCompleted && match.score && (
              <p className="text-2xl font-black text-white mt-1">{match.score.split('-')[0]}</p>
            )}
          </div>

          {/* VS */}
          <div className="text-center">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-[10px] font-black">VS</span>
            </div>
          </div>

          {/* Team 2 */}
          <div className="flex-1 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
              <FaFutbol className="text-black text-2xl" />
            </div>
            <p className="text-white font-bold text-sm truncate">{match.team2Name}</p>
            {isCompleted && match.score && (
              <p className="text-2xl font-black text-white mt-1">{match.score.split('-')[1]}</p>
            )}
          </div>
        </div>

        {/* Match Info */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-4 text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <FaCalendarAlt size={8} />
            <span>{match.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <FaClock size={8} />
            <span>{match.time}</span>
          </div>
          <div className="flex items-center gap-1">
            <FaMapMarkerAlt size={8} />
            <span>{match.pitch || 'Main Field'}</span>
          </div>
        </div>

        {/* Action Button - Only show for Pending matches (matches that have passed) */}
        {isPending && !readOnly && (
          <button
            onClick={onEnterResult}
            className="w-full mt-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/10"
          >
            Submit Match Score
          </button>
        )}

        {isCompleted && match.penalties && (
          <div className="mt-3 text-center">
            <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded-full">
              Penalties: {match.penalties}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ResultModal = ({ match, players, isSubmitting, onClose, onSubmit }) => {
  const [isDraw, setIsDraw] = useState(false);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');

  const team1Players = players.filter(
    (p) => p.teamId === match.team1Id && !p.suspendedForNextMatch,
  );

  const team2Players = players.filter(
    (p) => p.teamId === match.team2Id && !p.suspendedForNextMatch,
  );

  const handleScoreChange = (e) => {
    const s1 = parseInt(e.target.form?.score1?.value) || 0;
    const s2 = parseInt(e.target.form?.score2?.value) || 0;
    setScore1(s1);
    setScore2(s2);
    setIsDraw(s1 === s2);
  };

  const handleSubmitWithValidation = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const score1Val = parseInt(formData.get('score1')) || 0;
    const score2Val = parseInt(formData.get('score2')) || 0;

    // Calculate total goals assigned to players for each team
    let playerGoalsT1 = 0;
    team1Players.forEach(p => {
      playerGoalsT1 += parseInt(formData.get(`goals-${p.id}`)) || 0;
    });

    let playerGoalsT2 = 0;
    team2Players.forEach(p => {
      playerGoalsT2 += parseInt(formData.get(`goals-${p.id}`)) || 0;
    });

    // Validate Team 1
    if (playerGoalsT1 !== score1Val) {
      alert(`خطأ في أهداف ${match.team1Name}: مجموع أهداف اللاعبين (${playerGoalsT1}) لا يساوي نتيجة الفريق (${score1Val})`);
      return;
    }

    // Validate Team 2
    if (playerGoalsT2 !== score2Val) {
      alert(`خطأ في أهداف ${match.team2Name}: مجموع أهداف اللاعبين (${playerGoalsT2}) لا يساوي نتيجة الفريق (${score2Val})`);
      return;
    }

    if (score1Val === score2Val) {
      const pen1 = formData.get('pen1');
      const pen2 = formData.get('pen2');
      if (!pen1 || !pen2 || pen1 === '' || pen2 === '') {
        alert('Please enter penalty shootout scores for both teams');
        return;
      }
    }
    await onSubmit(e);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#121821] to-[#0a0f16] border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10 p-2 rounded-lg hover:bg-white/5 transition-all">
          <FaTimes size={20} />
        </button>

        {/* Header */}
        <div className="p-8 border-b border-white/10 text-center sticky top-0 bg-[#121821] z-20 shadow-2xl">
          <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Post-Match Report</h3>
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-[#00FF9C]/20">
                <FaFutbol className="text-black text-2xl" />
              </div>
              <span className="text-white font-black text-sm uppercase tracking-wider">{match.team1Name}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-slate-600 font-black text-xl italic mt-[-20px]">VS</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-[#00FF9C]/20">
                <FaFutbol className="text-black text-2xl" />
              </div>
              <span className="text-white font-black text-sm uppercase tracking-wider">{match.team2Name}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmitWithValidation} className="p-6 space-y-6">
          {/* Score Inputs - Larger */}
          <div className="bg-black/30 rounded-2xl p-6 border border-white/10">
            <label className="block text-[#00FF9C] text-xs font-bold mb-4 uppercase tracking-wider">Match Score</label>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{match.team1Name}</span>
                  <input
                    name="score1"
                    type="number"
                    min="0"
                    required
                    value={score1}
                    onChange={handleScoreChange}
                    className="w-32 h-32 text-center text-5xl font-black text-white bg-slate-800/50 rounded-3xl border-2 border-white/10 focus:border-[#00FF9C] focus:ring-4 focus:ring-[#00FF9C]/20 focus:outline-none transition-all shadow-2xl"
                  />
                </div>

                <div className="flex flex-col items-center pt-8">
                  <span className="text-slate-600 font-black text-2xl italic">VS</span>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{match.team2Name}</span>
                  <input
                    name="score2"
                    type="number"
                    min="0"
                    required
                    value={score2}
                    onChange={handleScoreChange}
                    className="w-32 h-32 text-center text-5xl font-black text-white bg-slate-800/50 rounded-3xl border-2 border-white/10 focus:border-[#00FF9C] focus:ring-4 focus:ring-[#00FF9C]/20 focus:outline-none transition-all shadow-2xl"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Penalties if draw */}
          {isDraw && (
            <div className="bg-amber-500/10 rounded-2xl p-6 border-2 border-amber-500/20">
              <label className="block text-amber-400 text-xs font-bold mb-4 uppercase tracking-wider">Penalty Shootout</label>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-2">{match.team1Name}</p>
                  <input
                    name="pen1"
                    type="number"
                    min="0"
                    required={isDraw}
                    placeholder="0"
                    className="w-24 h-24 text-center text-3xl font-bold text-white bg-slate-800 rounded-2xl border-2 border-amber-500/30 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <span className="text-gray-500 text-2xl font-bold">-</span>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-2">{match.team2Name}</p>
                  <input
                    name="pen2"
                    type="number"
                    min="0"
                    required={isDraw}
                    placeholder="0"
                    className="w-24 h-24 text-center text-3xl font-bold text-white bg-slate-800 rounded-2xl border-2 border-amber-500/30 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Player Statistics - With Team Names */}
          <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[#00FF9C]/10 rounded-xl flex items-center justify-center border border-[#00FF9C]/20">
                <FaFutbol className="text-[#00FF9C] text-xl" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg uppercase tracking-tight">Match Statistics</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Player performance & Cards</p>
              </div>
            </div>

            {/* Team 1 Players */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4 px-2">
                <h4 className="text-[#00FF9C] font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00FF9C] animate-pulse" />
                  {match.team1Name}
                </h4>
                <span className="text-slate-500 text-[10px] font-bold uppercase">{team1Players.length} Active Players</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {team1Players.map(player => (
                  <div key={player.id} className="bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10 text-slate-400 font-bold text-xs uppercase group-hover:border-[#00FF9C]/50 transition-colors">
                        {player.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-bold text-base leading-tight">{player.name}</p>
                        <p className="text-slate-500 text-[10px] font-medium mt-0.5">{player.position || 'Player'}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <input
                          name={`goals-${player.id}`}
                          type="number"
                          min="0"
                          defaultValue="0"
                          className="w-20 h-20 text-center text-2xl font-black bg-slate-900 border-2 border-white/10 text-white rounded-2xl focus:border-[#00FF9C] focus:outline-none transition-all shadow-lg"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Goals</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <input
                          name={`yellow-${player.id}`}
                          type="number"
                          min="0"
                          max="2"
                          defaultValue="0"
                          className="w-20 h-20 text-center text-2xl font-black bg-slate-900 border-2 border-white/10 text-yellow-400 rounded-2xl focus:border-yellow-400 focus:outline-none transition-all shadow-lg"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Yellow</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <input
                          name={`red-${player.id}`}
                          type="number"
                          min="0"
                          max="1"
                          defaultValue="0"
                          className="w-20 h-20 text-center text-2xl font-black bg-slate-900 border-2 border-white/10 text-red-500 rounded-2xl focus:border-red-400 focus:outline-none transition-all shadow-lg"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Red</span>
                      </div>
                    </div>
                  </div>
                ))}
                {team1Players.length === 0 && (
                  <div className="text-center py-4 bg-slate-800/30 rounded-xl">
                    <p className="text-gray-500 text-sm">No players available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Team 2 Players */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4 px-2">
                <h4 className="text-[#00FF9C] font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00FF9C] animate-pulse" />
                  {match.team2Name}
                </h4>
                <span className="text-slate-500 text-[10px] font-bold uppercase">{team2Players.length} Active Players</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {team2Players.map(player => (
                  <div key={player.id} className="bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/10 text-slate-400 font-bold text-xs uppercase group-hover:border-[#00FF9C]/50 transition-colors">
                        {player.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-bold text-base leading-tight">{player.name}</p>
                        <p className="text-slate-500 text-[10px] font-medium mt-0.5">{player.position || 'Player'}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <input
                          name={`goals-${player.id}`}
                          type="number"
                          min="0"
                          defaultValue="0"
                          className="w-20 h-20 text-center text-2xl font-black bg-slate-900 border-2 border-white/10 text-white rounded-2xl focus:border-[#00FF9C] focus:outline-none transition-all shadow-lg"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Goals</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <input
                          name={`yellow-${player.id}`}
                          type="number"
                          min="0"
                          max="2"
                          defaultValue="0"
                          className="w-20 h-20 text-center text-2xl font-black bg-slate-900 border-2 border-white/10 text-yellow-400 rounded-2xl focus:border-yellow-400 focus:outline-none transition-all shadow-lg"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Yellow</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <input
                          name={`red-${player.id}`}
                          type="number"
                          min="0"
                          max="1"
                          defaultValue="0"
                          className="w-20 h-20 text-center text-2xl font-black bg-slate-900 border-2 border-white/10 text-red-500 rounded-2xl focus:border-red-400 focus:outline-none transition-all shadow-lg"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Red</span>
                      </div>
                    </div>
                  </div>
                ))}
                {team2Players.length === 0 && (
                  <div className="text-center py-8 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <p className="text-slate-600 text-sm italic">No players available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black py-4 rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Processing Report...' : 'Finalize & Archive Match'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MatchesTab;