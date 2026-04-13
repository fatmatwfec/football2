import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { FaSitemap, FaTrophy, FaLock, FaRandom, FaCheckCircle, FaTimes, FaUsers, FaCog, FaCalendarPlus, FaArchive, FaChevronDown, FaChevronUp, FaFutbol,} from 'react-icons/fa';
import {generateBracket,manualAdvanceWinner,clearTournament,fetchArchivedTournaments,getTournamentWinner,getRoundLabel,} from '../services/tournamentService';
import { scheduleMatch } from '../services/matchService';

const TournamentTab = ({ teams }) => {
  const [tournament,    setTournament]    = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [wizardStep,    setWizardStep]    = useState(1);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [archived,      setArchived]      = useState([]);
  const [showArchive,   setShowArchive]   = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null); 

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournaments', 'main'), (snap) => {
      if (snap.exists() && snap.data().status === 'locked') {
        setTournament(snap.data());
        setWizardStep(4);
      } else {
        setTournament(null);
        setWizardStep((prev) => (prev === 4 ? 1 : prev));
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchArchivedTournaments().then(setArchived).catch(console.error);
  }, []);

  const numTeams         = teams?.length ?? 0;
  const tournamentWinner = useMemo(() => getTournamentWinner(tournament), [tournament]);

  const handleRunDraw = async () => {
    if (numTeams < 3) return;
    setWizardStep(3);
    setIsGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 2500));
      await generateBracket(teams);
    } catch (e) {
      console.error(e);
      alert('Error generating tournament: ' + (e.message ?? 'Unknown error'));
      setWizardStep(1);
    }
    setIsGenerating(false);
  };

  const handleManualAdvance = async (match, winnerTeam) => {
    if (!match.team1 || !match.team2 || match.winner) return;
    if (!window.confirm(`Manually advance ${winnerTeam.name}?`)) return;
    try {
      await manualAdvanceWinner(tournament, match, winnerTeam);
    } catch (e) {
      alert('Failed: ' + (e.message ?? 'Unknown error'));
    }
  };

  const handleClear = async () => {
    if (!window.confirm('DANGER: End this tournament? It will be saved to the archive.')) return;
    try {
      await clearTournament();
      const updated = await fetchArchivedTournaments();
      setArchived(updated);
      setWizardStep(1);
    } catch (e) {
      alert('Failed: ' + (e.message ?? 'Unknown error'));
    }
  };

  const handleScheduleFromBracket = (bracketMatch) => {
    setScheduleModal({
      team1Id:   bracketMatch.team1.id,
      team1Name: bracketMatch.team1.name,
      team2Id:   bracketMatch.team2.id,
      team2Name: bracketMatch.team2.name,
    });
  };

  if (loading) return (
    <div className="text-white text-center py-20 flex flex-col items-center">
      <FaCog className="animate-spin text-4xl mb-4 text-emerald-500" />
      Loading Tournament Module...
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 max-w-[95%] mx-auto pb-40 px-4">

      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl">
        <div>
          <h2 className="text-4xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
            <FaSitemap className="text-blue-500" /> Tournament Bracket
          </h2>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2 italic">
            Automated bracket generation & tamper-proof draw system
          </p>
        </div>
        {tournament && (
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <FaLock /> Bracket Locked
            </div>
            <button
              onClick={handleClear}
              title="End tournament & archive"
              className="bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white transition-all p-4 rounded-xl border border-red-500/20"
            >
              <FaTimes />
            </button>
          </div>
        )}
      </div>

      {/* Champion Banner */}
      {tournamentWinner && (
        <div className="mb-12 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-[3rem] p-8 flex items-center justify-center gap-6 shadow-2xl">
          <FaTrophy className="text-yellow-500 text-5xl animate-bounce" />
          <div className="text-center">
            <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Tournament Champion</p>
            <p className="text-white font-black text-4xl uppercase tracking-tighter">{tournamentWinner.name}</p>
          </div>
          <FaTrophy className="text-yellow-500 text-5xl animate-bounce" />
        </div>
      )}

      {/* Wizard Steps */}
      <div className="mb-16 flex justify-center items-center scale-90 md:scale-100">
        <div className="flex items-center gap-4">
          <WizardStep step={1} currentStep={wizardStep} label="Register Teams" />
          <div className="text-blue-500/50 text-2xl font-black">❯</div>
          <WizardStep step={2} currentStep={wizardStep} label="Lock Registration" />
          <div className="text-blue-500/50 text-2xl font-black">❯</div>
          <WizardStep step={3} currentStep={wizardStep} label="Run Automated Draw" />
          <div className="text-blue-500/50 text-2xl font-black">❯</div>
          <WizardStep step={4} currentStep={wizardStep} label="Generate Bracket" />
        </div>
      </div>

      {/* Wizard Content */}
      <div className="glass p-10 rounded-[3rem] border border-white/5 mb-10 flex flex-col items-center text-center relative overflow-hidden">

        {wizardStep === 1 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
            <div className="size-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 border-4 border-blue-500/20">
              <FaUsers className="text-4xl text-blue-500" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Team Registration</h3>
            <p className="text-slate-400 font-bold mb-8 max-w-lg">
              There are currently{' '}
              <span className="text-blue-400 text-xl mx-2 font-black">{numTeams}</span>
              approved teams ready for the draw.
            </p>
            <button
              disabled={numTeams < 3}
              onClick={() => setWizardStep(2)}
              className={`px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm transition-all shadow-xl ${
                numTeams < 3
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-blue-900/40'
              }`}
            >
              {numTeams < 3 ? `Need at least 3 teams (${numTeams}/3)` : 'Proceed to Lock Registration'}
            </button>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
            <div className="size-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border-4 border-amber-500/20">
              <FaLock className="text-4xl text-amber-500" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Lock Data & Registration</h3>
            <p className="text-slate-400 font-bold mb-8 max-w-lg">
              Once locked, no further modifications can be made. Byes will be handled automatically.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setWizardStep(1)}
                className="px-8 py-4 bg-slate-800 text-white rounded-[2rem] font-black uppercase text-xs hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRunDraw}
                className="px-10 py-5 bg-amber-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm transition-all hover:bg-amber-500 shadow-xl shadow-amber-900/40 hover:scale-105 active:scale-95"
              >
                Lock & Proceed
              </button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center py-10">
            <div className="size-32 rounded-full border-[6px] border-blue-500/20 border-t-blue-500 animate-spin flex items-center justify-center mb-8 relative">
              <FaRandom className="text-4xl text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight animate-pulse">Running Random Draw...</h3>
            <p className="text-emerald-400 font-bold mt-4 tracking-widest uppercase text-xs">Assigning Seeds & Calculating Byes</p>
          </div>
        )}

        {wizardStep === 4 && tournament && (
          <BracketView
            tournament={tournament}
            onAdvanceWinner={handleManualAdvance}
            onScheduleMatch={handleScheduleFromBracket}
          />
        )}
      </div>

      {/* ── Schedule Modal ── */}
      {scheduleModal && (
        <ScheduleMatchModal
          prefill={scheduleModal}
          onClose={() => setScheduleModal(null)}
        />
      )}

      {/* ── Archive Section ── */}
      {archived.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchive(v => !v)}
            className="w-full flex items-center justify-between px-8 py-5 bg-slate-900/50 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-3 text-slate-400">
              <FaArchive className="text-blue-500" />
              <span className="font-black uppercase text-xs tracking-widest">
                Past Tournaments — {archived.length} archived
              </span>
            </div>
            {showArchive ? <FaChevronUp className="text-slate-500" /> : <FaChevronDown className="text-slate-500" />}
          </button>

          {showArchive && (
            <div className="mt-4 space-y-4 animate-in fade-in duration-300">
              {archived.map((t) => (
                <ArchivedTournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Schedule Match Modal ─────────────────────────────────────
const ScheduleMatchModal = ({ prefill, onClose }) => {
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [pitch,       setPitch]       = useState('Main Pitch');
  const [isSubmitting, setIsSubmitting] = useState('');
  const [error,       setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await scheduleMatch({
        team1Id:   prefill.team1Id,
        team2Id:   prefill.team2Id,
        team1Name: prefill.team1Name,
        team2Name: prefill.team2Name,
        date, time, pitch,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-white/10 w-full max-w-md rounded-[3rem] p-10 relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-all">
          <FaTimes size={20} />
        </button>

        {/* Title */}
        <div className="text-center mb-8">
          <div className="size-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaCalendarPlus className="text-blue-400" size={28} />
          </div>
          <h3 className="text-white font-black text-xl uppercase tracking-tighter">Schedule Match</h3>
          <p className="text-slate-500 text-xs font-black uppercase mt-1">From Bracket</p>
        </div>

        {/* Teams display */}
        <div className="flex items-center justify-between bg-slate-950 rounded-2xl p-5 mb-8 border border-white/5">
          <div className="text-center flex-1">
            <p className="text-white font-black text-sm uppercase tracking-tight">{prefill.team1Name}</p>
            <p className="text-slate-500 text-[9px] font-black uppercase mt-1">Home</p>
          </div>
          <div className="text-slate-600 font-black text-lg px-4">VS</div>
          <div className="text-center flex-1">
            <p className="text-white font-black text-sm uppercase tracking-tight">{prefill.team2Name}</p>
            <p className="text-slate-500 text-[9px] font-black uppercase mt-1">Away</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Date</label>
              <input
                type="date" required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Time</label>
              <input
                type="time" required
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Pitch</label>
            <select
              value={pitch}
              onChange={e => setPitch(e.target.value)}
              className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500 transition-all"
            >
              <option value="Main Pitch">Main Pitch</option>
              <option value="Pitch 2">Pitch 2</option>
              <option value="Pitch 3">Pitch 3</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-60 mt-2"
          >
            {isSubmitting ? 'Scheduling...' : 'Confirm Fixture'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Archived Tournament Card ─────────────────────────────────
const ArchivedTournamentCard = ({ tournament }) => {
  const [expanded, setExpanded] = useState(false);
  const winner    = tournament.finalWinner;
  const totalRounds = Object.keys(tournament.rounds || {}).length;

  const archivedDate = tournament.archivedAt?.toDate
    ? tournament.archivedAt.toDate().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  return (
    <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden">
      <div
        className="flex items-center justify-between px-8 py-5 cursor-pointer hover:bg-white/5 transition-all"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-4">
          <FaTrophy className={`text-xl ${winner ? 'text-yellow-500' : 'text-slate-600'}`} />
          <div>
            <p className="text-white font-black text-sm uppercase tracking-tight">
              {winner ? winner.name : 'Unfinished Tournament'}
            </p>
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
              {archivedDate} · {tournament.numTeams} teams · {totalRounds} rounds
            </p>
          </div>
        </div>
        {expanded
          ? <FaChevronUp className="text-slate-500" />
          : <FaChevronDown className="text-slate-500" />
        }
      </div>

      {expanded && tournament.rounds && (
        <div className="px-8 pb-8 border-t border-white/5 pt-6">
          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div className="flex gap-10 min-w-max">
              {Object.keys(tournament.rounds)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map((rKey, rIdx) => (
                  <div key={rKey} className="flex flex-col gap-4" style={{ width: '240px' }}>
                    <p className="text-blue-500 font-black uppercase text-[10px] tracking-[0.3em] text-center">
                      {getRoundLabel(parseInt(rKey), totalRounds)}
                    </p>
                    {tournament.rounds[rKey].map((match) => (
                      <div key={match.id} className="bg-slate-950/60 rounded-2xl p-3 border border-white/5 space-y-2">
                        {[match.team1, match.team2].map((team, i) => {
                          if (!team && match.isBye && i === 1) {
                            return (
                              <div key="bye" className="px-3 py-2 rounded-xl bg-slate-900/40 border border-dashed border-slate-700 text-slate-600 text-xs font-black uppercase">
                                BYE
                              </div>
                            );
                          }
                          const isWinner = match.winner?.id === team?.id;
                          return (
                            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-black uppercase ${
                              isWinner
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-900/40 border-white/5 text-slate-400'
                            }`}>
                              <span className="truncate">{team?.name ?? 'TBD'}</span>
                              {isWinner && <FaCheckCircle className="text-emerald-500 flex-shrink-0 ml-2" size={10} />}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Bracket View ─────────────────────────────────────────────
const BracketView = ({ tournament, onAdvanceWinner, onScheduleMatch }) => {
  const totalRounds = Object.keys(tournament.rounds).length;

  return (
    <div className="w-full">
      <div className="text-left mb-8 flex items-center justify-between border-b border-white/5 pb-8">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Official Bracket</h3>
          <p className="text-slate-400 font-bold text-sm mt-1">
            Updates automatically when match results are entered in Fixtures.
            <span className="text-blue-400 ml-2">Click "Schedule" on any match to add it to fixtures.</span>
          </p>
        </div>
        <span className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
          {tournament.numTeams} Teams
        </span>
      </div>

      <div className="overflow-x-auto pb-10 custom-scrollbar mt-12 pl-12">
        <div className="flex gap-16 min-w-max">
          {Object.keys(tournament.rounds)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((roundKey, roundIndex) => (
              <RoundColumn
                key={roundKey}
                roundMatches={tournament.rounds[roundKey]}
                roundIndex={roundIndex}
                totalRounds={totalRounds}
                onAdvanceWinner={onAdvanceWinner}
                onScheduleMatch={onScheduleMatch}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

// ─── Round Column ─────────────────────────────────────────────
const RoundColumn = ({ roundMatches, roundIndex, totalRounds, onAdvanceWinner, onScheduleMatch }) => (
  <div className="flex flex-col justify-around gap-8 relative" style={{ width: '320px' }}>
    <div className="absolute -top-16 left-0 w-full text-center">
      <h3 className="text-blue-500 font-black uppercase text-sm tracking-[0.3em] bg-slate-900 inline-block px-6 py-2 rounded-full border border-blue-500/20">
        {getRoundLabel(roundIndex, totalRounds)}
      </h3>
    </div>
    {roundMatches.map((match) => (
      <MatchCard
        key={match.id}
        match={match}
        roundIndex={roundIndex}
        totalRounds={totalRounds}
        onAdvanceWinner={onAdvanceWinner}
        onScheduleMatch={onScheduleMatch}
      />
    ))}
  </div>
);

// ─── Match Card ───────────────────────────────────────────────
const MatchCard = ({ match, roundIndex, totalRounds, onAdvanceWinner, onScheduleMatch }) => {
  const canClick     = (team) => match.team1 && match.team2 && !match.winner && team;
  const canSchedule  = match.team1 && match.team2 && !match.isBye && !match.winner;

  return (
    <div className="relative flex items-center">
      {roundIndex < totalRounds - 1 && (
        <>
          <div className="absolute top-1/2 -right-8 w-8 h-[2px] bg-slate-700" />
          {match.matchIndex % 2 === 0
            ? <div className="absolute top-1/2 -right-8 w-[2px] h-[calc(50%+2rem)] bg-slate-700" />
            : <div className="absolute bottom-1/2 -right-8 w-[2px] h-[calc(50%+2rem)] bg-slate-700" />
          }
        </>
      )}
      {roundIndex > 0 && (
        <div className="absolute top-1/2 -left-8 w-8 h-[2px] bg-slate-700" />
      )}

      <div className={`w-full bg-slate-900 border-2 rounded-[2rem] shadow-2xl relative z-10 transition-all overflow-hidden ${
        match.winner
          ? match.lockedByMatch
            ? 'border-emerald-500/30'
            : 'border-amber-500/30'
          : 'border-slate-800 hover:border-blue-500/50'
      }`}>
        <div className="p-2 bg-slate-950 text-center border-b border-white/5">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Match {match.matchIndex + 1}
            {match.winner && (
              <span className={match.lockedByMatch ? 'text-emerald-500 ml-2' : 'text-amber-500 ml-2'}>
                {match.lockedByMatch ? '✓ Auto' : '✓ Manual'}
              </span>
            )}
          </span>
        </div>

        <div className="p-4 space-y-2">
          <TeamSlot
            team={match.team1}
            isWinner={match.winner?.id && match.winner.id === match.team1?.id}
            onClick={() => canClick(match.team1) && onAdvanceWinner(match, match.team1)}
            clickable={!!canClick(match.team1)}
          />
          {match.isBye ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/20 border border-slate-800 border-dashed">
              <span className="font-black uppercase text-slate-600 tracking-widest text-sm">BYE</span>
            </div>
          ) : (
            <TeamSlot
              team={match.team2}
              isWinner={match.winner?.id && match.winner.id === match.team2?.id}
              onClick={() => canClick(match.team2) && onAdvanceWinner(match, match.team2)}
              clickable={!!canClick(match.team2)}
            />
          )}
        </div>

        {/* ── Schedule Button ── */}
        {canSchedule && (
          <div className="px-4 pb-4">
            <button
              onClick={() => onScheduleMatch(match)}
              className="w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white flex items-center justify-center gap-2"
            >
              <FaCalendarPlus size={11} /> Schedule this match
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Team Slot ────────────────────────────────────────────────
const TeamSlot = ({ team, isWinner, onClick, clickable }) => (
  <div
    onClick={onClick}
    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
      isWinner
        ? 'bg-emerald-600/20 border-emerald-500 text-white'
        : 'bg-slate-950 border-white/5 text-slate-300'
    } ${clickable ? 'cursor-pointer hover:bg-slate-800' : ''}`}
  >
    <span className="font-black uppercase truncate text-sm">
      {team ? team.name : <span className="text-slate-600">TBD</span>}
    </span>
    {isWinner && <FaCheckCircle className="text-emerald-500 flex-shrink-0 ml-2" />}
  </div>
);

// ─── Wizard Step ──────────────────────────────────────────────
const WizardStep = ({ step, currentStep, label }) => {
  const isCompleted = step < currentStep;
  const isActive    = step === currentStep;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`size-20 rounded-full border-4 flex items-center justify-center text-xl font-black transition-all duration-500 shadow-xl ${
        isActive      ? 'border-blue-500 bg-blue-600 text-white scale-110 shadow-blue-600/30'
        : isCompleted ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500'
        :               'border-slate-800 bg-slate-900 text-slate-600'
      }`}>
        {isCompleted ? <FaCheckCircle /> : step}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest text-center w-24 ${
        isActive ? 'text-white' : isCompleted ? 'text-emerald-500' : 'text-slate-500'
      }`}>
        {label}
      </span>
    </div>
  );
};

export default TournamentTab;
