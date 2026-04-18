import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { FaTrophy, FaTrash, FaFutbol, FaTimes, FaCalendarAlt, FaClock, FaCheckCircle, FaBan, FaFire, FaFilter } from 'react-icons/fa';
import { scheduleMatch, prepareMatchForResult, finalizeMatch, deleteMatch, syncMatchStatuses } from '../services/matchService';
import { getRoundLabel, buildMatchCache, getMatchRoundFromCache } from '../services/tournamentService';

const MatchesTab = () => {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tournament, setTournament] = useState(null);

  const [activeClick, setActiveClick] = useState("live");

  const [showAddForm, setShowAddForm] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roundFilter, setRoundFilter] = useState(null);

  const [newMatch, setNewMatch] = useState({
    team1Id: '', team2Id: '', team1Name: '', team2Name: '',
    date: '', time: '', pitch: 'Main Pitch',
  });

  // ── Firestore listeners ──────────────────────────────────
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
    const interval = setInterval(() => syncMatchStatuses(matches), 60_000);
    return () => clearInterval(interval);
  }, [matches]);

  // ── Derived ──────────────────────────────────────────────
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
      teams.filter((t) => getPlayerCount(t.id) >= 7 && t.id !== excludeId),
    [teams, getPlayerCount],
  );

  const isMatchFinished = (date, time) => new Date() >= new Date(`${date} ${time}`);

  // ── Filter by round ──────────────────────────────────────
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

  const scheduledMatches = filterByRound(enrichedMatches.filter((m) => m.status === 'scheduled'));
 const now = Date.now();

const liveMatches = filterByRound(
  enrichedMatches.filter((m) => {
    if (!m.date || !m.time) return false;

    const start = new Date(`${m.date} ${m.time}`).getTime();
    const end = start + 20 * 60 * 1000; 

    return now >= start && now <= end;
  })
);
  const completedMatches = filterByRound(enrichedMatches.filter((m) => m.status === 'completed'));

  // ── Handlers ─────────────────────────────────────────────
  const handleSchedule = async (e) => {
    e.preventDefault();
    try {
      await scheduleMatch(newMatch);
      setShowAddForm(false);
      setNewMatch({ team1Id: '', team2Id: '', team1Name: '', team2Name: '', date: '', time: '', pitch: 'Main Pitch' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenResult = async (match) => {
    try {
      await prepareMatchForResult(match, players);
      setShowResultModal(match);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFinalize = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const fd = new FormData(e.target);
    const raw = Object.fromEntries(fd.entries());

    const activePlayers = players.filter(
      (p) =>
        (p.teamId === showResultModal.team1Id || p.teamId === showResultModal.team2Id) &&
        !p.suspendedForNextMatch,
    );

    try {
      const result = await finalizeMatch(showResultModal, raw, activePlayers);
      if (!result.ok) {
        alert(result.error);
      } else {
        alert('تم حفظ النتيجة وتحديث الـ Bracket!');
        setShowResultModal(null);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (match) => {
    if (!window.confirm('Are you sure? Stats will be rolled back.')) return;
    try {
      await deleteMatch(match);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const getMatchRoundLabel = (match) => {
    if (!tournament) return null;
    const info = getMatchRoundFromCache(matchCache, match.team1Id, match.team2Id);
    if (!info) return null;
    return getRoundLabel(info.roundIndex, Object.keys(tournament.rounds).length);
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-40 px-4">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-white/5">
        <div>
          <h2 className="text-4xl font-black text-white flex items-center gap-4">
            <FaTrophy className="text-yellow-500" /> FIXTURES
          </h2>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2 italic">
            Official League Match Center
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-2xl ${showAddForm
            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
            : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
        >
          {showAddForm ? 'Cancel Schedule' : 'Schedule New Match'}
        </button>
      </div>

      {/* ── Round Filter ── */}
      {availableRounds.length > 0 && (
        <div className="flex gap-3 mb-8 flex-wrap items-center">
          <FaFilter className="text-slate-500 text-sm" />
          <button
            onClick={() => setRoundFilter(null)}
            className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-all border ${roundFilter === null
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-transparent text-slate-500 border-white/10 hover:border-white/20'
              }`}
          >
            All Rounds
          </button>
          {availableRounds.map((r) => (
            <button
              key={r.key}
              onClick={() => setRoundFilter(r.key)}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-all border ${roundFilter === r.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-transparent text-slate-500 border-white/10 hover:border-white/20'
                }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Add match form ── */}
      {showAddForm && (
        <div className="glass p-10 rounded-[3rem] border-2 border-blue-500/20 mb-12 bg-slate-900/40">
          <form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Home Team</label>
              <select
                required
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                onChange={(e) => {
                  const t = teams.find((x) => x.id === e.target.value);
                  if (t) setNewMatch({ ...newMatch, team1Id: t.id, team1Name: t.teamName });
                }}
              >
                <option value="">Select Home</option>
                {availableTeams(newMatch.team2Id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamName} ({getPlayerCount(t.id)} Players)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Away Team</label>
              <select
                required
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                onChange={(e) => {
                  const t = teams.find((x) => x.id === e.target.value);
                  if (t) setNewMatch({ ...newMatch, team2Id: t.id, team2Name: t.teamName });
                }}
              >
                <option value="">Select Away</option>
                {availableTeams(newMatch.team1Id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.teamName} ({getPlayerCount(t.id)} Players)
                  </option>
                ))}
              </select>
            </div>

            <input
              type="date" required
              className="bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500"
              onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })}
            />
            <input
              type="time" required
              className="bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500"
              onChange={(e) => setNewMatch({ ...newMatch, time: e.target.value })}
            />

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Pitch</label>
              <select
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={newMatch.pitch}
                onChange={(e) => setNewMatch({ ...newMatch, pitch: e.target.value })}
              >
                <option value="Main Pitch">Main Pitch</option>
                <option value="Pitch 2">Pitch 2</option>
                <option value="Pitch 3">Pitch 3</option>
              </select>
            </div>

            <button
              type="submit"
              className="self-end bg-blue-600 text-white font-black h-16 rounded-[2rem] uppercase text-sm shadow-xl hover:bg-blue-500 transition-all active:scale-95"
            >
              Confirm Fixture
            </button>
          </form>
        </div>
      )}

      <div className="flex gap-10 border-b pb-2 mb-3 mt-3">
        <button
          onClick={() => setActiveClick("live")}
          className={`font-bold text-3xl tracking-wide ${activeClick === "live"
            ? "text-red-500 border-b-4 border-red-500 pb-1"
            : "text-gray-300"
            }`}
        >
          Live
        </button>

        <button
          onClick={() => setActiveClick("upcoming")}
          className={`font-bold text-3xl tracking-wide ${activeClick === "upcoming"
            ? "text-green-500 border-b-4 border-green-500 pb-1"
            : "text-gray-300"
            }`}
        >
          Upcoming Matches
        </button>

        <button
          onClick={() => setActiveClick("history")}
          className={`font-bold text-3xl tracking-wide ${activeClick === "history"
            ? "text-orange-700 border-b-4 border-orange-500 pb-1"
            : "text-gray-300"
            }`}
        >
          Match History
        </button>
      </div>

      {/* ── Live Matches ── */}

      {activeClick === "live" && liveMatches.length > 0 && (
        <Section
          label="🔴 Live Now"
          labelColor="text-red-500"
          matches={liveMatches}
          renderMatch={(m) => (
            <UpcomingMatchCard
              key={m.id}
              match={m}
              roundLabel={getMatchRoundLabel(m)}
              canFinalize
              isLive
              onEnterResult={() => handleOpenResult(m)}
              onDelete={() => handleDelete(m)}
            />
          )}
        />
      )}


      {/* ── Scheduled Matches ── */}
      {activeClick === "upcoming" && (
        <Section
          label="Upcoming Fixtures"
          labelColor="text-emerald-500"
          matches={scheduledMatches}
          emptyText="No upcoming matches scheduled."
          renderMatch={(m) => {
            const canFinalize = isMatchFinished(m.date, m.time);
            return (
              <UpcomingMatchCard
                key={m.id}
                match={m}
                roundLabel={getMatchRoundLabel(m)}
                canFinalize={canFinalize}
                isLive={false}
                onEnterResult={() => handleOpenResult(m)}
                onDelete={() => handleDelete(m)}
              />
            );
          }}
        />
      )}
      {/* ── Match History ── */}
      {activeClick === "history" && completedMatches.length > 0 && (
        <Section
          label="Match History — Completed Fixtures"
          labelColor="text-orange-500"
          matches={completedMatches}
          renderMatch={(m) => (
            <CompletedMatchCard
              key={m.id}
              match={m}
              roundLabel={getMatchRoundLabel(m)}
              onDelete={() => handleDelete(m)}
            />
          )}
        />
      )}

      {/* ── Result Modal ── */}
      {showResultModal && (
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

// ─── Section wrapper ──────────────────────────────────────────
const Section = ({ label, labelColor, matches, emptyText, renderMatch }) => (
  <div className="mb-12">
    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ml-2 mb-6 ${labelColor}`}>
      {label}
    </p>
    <div className="grid grid-cols-1 gap-6">
      {matches.length === 0 && emptyText && (
        <p className="text-slate-600 text-center py-10 font-bold">{emptyText}</p>
      )}
      {matches.map(renderMatch)}
    </div>
  </div>
);

// ─── Upcoming / Live Match Card ───────────────────────────────
const UpcomingMatchCard = ({ match, roundLabel, canFinalize, isLive, onEnterResult, onDelete }) => (
  <div className={`glass rounded-[3rem] p-8 border-2 transition-all shadow-2xl bg-slate-900/40 ${isLive ? 'border-red-500/30' : 'border-white/5'
    }`}>
    <div className="flex items-center gap-3 mb-4">
      {roundLabel && (
        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
          {roundLabel}
        </span>
      )}
      {isLive && (
        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 flex items-center gap-1">
          <FaFire /> Live
        </span>
      )}
      {match.pitch && (
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          📍 {match.pitch}
        </span>
      )}
    </div>

    <MatchTeamsRow match={match} scoreColor="blue" completed={false} />

    <div className="flex gap-4 mt-8 pt-8 border-t border-white/5">
      <button
        onClick={onEnterResult}
        disabled={!canFinalize}
        className={`flex-[4] py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${!canFinalize
          ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
          : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl shadow-emerald-900/20'
          }`}
      >
        {!canFinalize ? 'Waiting for kick-off' : 'Enter Results'}
      </button>
      <DeleteBtn onClick={onDelete} />
    </div>
  </div>
);

// ─── Completed Match Card ─────────────────────────────────────
const CompletedMatchCard = ({ match, roundLabel, onDelete }) => (
  <div className="glass rounded-[3rem] p-8 border-2 border-emerald-500/20 transition-all shadow-2xl bg-slate-900/40">
    {(roundLabel || match.pitch) && (
      <div className="flex items-center gap-3 mb-4">
        {roundLabel && (
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            {roundLabel}
          </span>
        )}
        {match.pitch && (
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            📍 {match.pitch}
          </span>
        )}
      </div>
    )}

    <MatchTeamsRow match={match} scoreColor="emerald" completed />

    {match.penalties && (
      <div className="text-center mt-2">
        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-4 py-1 rounded-full border border-amber-500/20">
          Penalties: {match.penalties}
        </span>
      </div>
    )}

    {match.statsSnapshot && Object.keys(match.statsSnapshot).length > 0 && (
      <div className="mt-6 pt-6 border-t border-white/5">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Player Stats</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(match.statsSnapshot).map(([pId, stats]) => (
            <div key={pId} className="bg-slate-950/60 rounded-2xl p-3 border border-white/5 flex items-center justify-between">
              <span className="text-white text-xs font-bold truncate">{stats.name}</span>
              <div className="flex gap-2 text-[10px] font-black ml-2 flex-shrink-0">
                {stats.goals > 0 && <span className="text-emerald-400">⚽ {stats.goals}</span>}
                {stats.yellow > 0 && <span className="text-yellow-400">🟨 {stats.yellow}</span>}
                {stats.red > 0 && <span className="text-red-400">🟥 {stats.red}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="flex gap-4 mt-6 pt-6 border-t border-white/5">
      <button disabled className="flex-[4] py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center gap-2">
        <FaCheckCircle /> Finalized
      </button>
      <DeleteBtn onClick={onDelete} />
    </div>
  </div>
);

// ─── Shared sub-components ────────────────────────────────────
const MatchTeamsRow = ({ match, scoreColor, completed }) => (
  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
    <div className="flex-1 text-center md:text-right">
      <p className="text-black font-black text-2xl uppercase tracking-tighter">{match.team1Name}</p>
      <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Home Team</p>
    </div>
    <div className="flex flex-col items-center gap-2">
      <div className={`text-4xl font-black px-10 py-4 rounded-[2rem] shadow-inner ${completed
        ? `text-${scoreColor}-500 bg-${scoreColor}-500/10`
        : `text-${scoreColor}-500 bg-slate-950 border border-white/5`
        }`}>
        {completed ? match.score : 'VS'}
      </div>
      <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px] uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-full border border-white/5">
        <FaCalendarAlt className={`text-${scoreColor}-500`} /> {match.date}
        <FaClock className={`text-${scoreColor}-500 ml-2`} /> {match.time}
      </div>
      {completed && (
        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
          <FaCheckCircle /> Finalized
        </span>
      )}
    </div>
    <div className="flex-1 text-center md:text-left">
      <p className="text-black font-black text-2xl uppercase tracking-tighter">{match.team2Name}</p>
      <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Away Team</p>
    </div>
  </div>
);

const DeleteBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex-1 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/10 flex items-center justify-center"
  >
    <FaTrash size={18} />
  </button>
);

// ─── Result Modal ─────────────────────────────────────────────
const ResultModal = ({ match, players, isSubmitting, onClose, onSubmit }) => {
  const [isDraw, setIsDraw] = useState(false);

  const activePlayers = players.filter(
    (p) =>
      (p.teamId === match.team1Id || p.teamId === match.team2Id) &&
      !p.suspendedForNextMatch,
  );
  const suspendedPlayers = players.filter(
    (p) =>
      (p.teamId === match.team1Id || p.teamId === match.team2Id) &&
      p.suspendedForNextMatch === true,
  );

  const handleScoreChange = (e) => {
    const form = e.target.closest('form');
    if (!form) return;
    const s1 = parseInt(form.score1?.value);
    const s2 = parseInt(form.score2?.value);
    if (!isNaN(s1) && !isNaN(s2)) setIsDraw(s1 === s2);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="bg-slate-900 border-2 border-white/10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[4rem] p-12 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all scale-150">
          <FaTimes />
        </button>

        <div className="text-center mb-10">
          <h3 className="text-white font-black uppercase text-2xl tracking-tighter flex items-center justify-center gap-3">
            <FaFutbol className="text-emerald-500" /> Post-Match Report
          </h3>
          <p className="text-slate-500 text-xl font-black uppercase mt-2">
            {match.team1Name} VS {match.team2Name}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-10">
          <div
            className="flex items-center justify-center gap-8 bg-slate-950 p-10 rounded-[3rem] border border-white/5 shadow-inner"
            onChange={handleScoreChange}
          >
            {[
              { name: 'score1', label: match.team1Name },
              { name: 'score2', label: match.team2Name },
            ].map((s, i) => (
              <React.Fragment key={s.name}>
                {i === 1 && <div className="text-3xl font-black text-slate-700 mt-6">-</div>}
                <div className="text-center space-y-3">
                  <label className="text-[10px] text-slate-500 font-black uppercase">{s.label}</label>
                  <input
                    name={s.name}
                    type="number" min="0" placeholder="0" required
                    className="bg-slate-900 text-center text-5xl font-black text-white w-24 h-24 rounded-3xl outline-none focus:border-emerald-500 border-2 border-transparent transition-all"
                  />
                </div>
              </React.Fragment>
            ))}
          </div>

          {isDraw && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[2rem] p-8">
              <p className="text-amber-400 font-black text-xs uppercase tracking-widest mb-6 text-center">
                ⚽ تعادل — أدخل نتيجة ضربات الجزاء
              </p>
              <div className="flex items-center justify-center gap-8">
                {[
                  { name: 'pen1', label: match.team1Name },
                  { name: 'pen2', label: match.team2Name },
                ].map((s, i) => (
                  <React.Fragment key={s.name}>
                    {i === 1 && <div className="text-2xl font-black text-slate-700">-</div>}
                    <div className="text-center space-y-2">
                      <label className="text-[10px] text-amber-400 font-black uppercase">{s.label}</label>
                      <input
                        name={s.name}
                        type="number" min="0" placeholder="0"
                        className="bg-slate-900 text-center text-3xl font-black text-white w-20 h-20 rounded-3xl outline-none focus:border-amber-500 border-2 border-amber-500/30 transition-all"
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {suspendedPlayers.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-red-500 font-black uppercase ml-4 tracking-[0.2em] flex items-center gap-2">
                <FaBan /> Suspended Players — Cannot Play
              </p>
              <div className="grid grid-cols-1 gap-2">
                {suspendedPlayers.map((player) => (
                  <div key={player.id} className="bg-red-500/5 p-4 rounded-[1.5rem] flex items-center justify-between border border-red-500/20">
                    <div>
                      <p className="text-red-400 text-sm font-bold">{player.name}</p>
                      <p className="text-[9px] text-red-500/60 font-black uppercase tracking-widest">
                        {player.assignedTeam} — Suspended this match
                      </p>
                    </div>
                    <FaBan className="text-red-500/50 text-xl" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-xs text-emerald-500 font-black uppercase ml-4 tracking-[0.2em]">
              Individual Player Statistics
            </p>
            <div className="grid grid-cols-1 gap-3">
              {activePlayers.map((player) => (
                <PlayerStatRow key={player.id} player={player} />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-2xl shadow-emerald-900/40 transition-all active:scale-95 disabled:opacity-60"
          >
            {isSubmitting ? 'Syncing with Database...' : 'Publish Match Results'}
          </button>
        </form>
      </div>
    </div>
  );
};

const PlayerStatRow = ({ player }) => (
  <div className="bg-slate-950/60 p-6 rounded-[2rem] flex items-center justify-between border border-white/5 hover:border-emerald-500/30 transition-all">
    <div className="min-w-0 flex-1">
      <p className="text-white text-lg font-bold truncate tracking-tight">{player.name}</p>
      <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest flex items-center gap-2">
        {player.assignedTeam}
        {(player.yellowCards || 0) === 1 && (
          <span className="text-yellow-500">🟨 1 yellow — caution</span>
        )}
      </p>
    </div>
    <div className="flex gap-4">
      {[
        { name: `goals-${player.id}`, label: 'GOALS', color: 'slate', max: undefined },
        { name: `yellow-${player.id}`, label: 'YEL', color: 'yellow', max: 2 },
        { name: `red-${player.id}`, label: 'RED', color: 'red', max: 1 },
      ].map((field) => (
        <div key={field.name} className="text-center">
          <span className={`text-[8px] text-${field.color}-500 font-black block mb-1`}>{field.label}</span>
          <input
            name={field.name}
            type="number" min="0" max={field.max} defaultValue="0"
            className="w-12 bg-slate-900 rounded-xl p-3 text-center text-sm font-black text-white border border-white/5"
          />
        </div>
      ))}
    </div>
  </div>
);

export default MatchesTab;