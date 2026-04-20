import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { FaSitemap, FaTrophy, FaLock, FaRandom, FaCheckCircle, FaTimes, FaUsers, FaCog, FaCalendarPlus, FaArchive, FaChevronDown, FaChevronUp, FaFutbol, FaArrowLeft} from 'react-icons/fa';
import {generateBracket,manualAdvanceWinner,clearTournament,fetchArchivedTournaments,getTournamentWinner,getRoundLabel,} from '../services/tournamentService';
import { scheduleMatch } from '../services/matchService';

const TournamentTab = ({ teams,onBack }) => {
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
    <div className="w-full min-h-screen bg-gradient-to-br from-black via-slate-900 to-emerald-950/30">
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group"
          >
            <FaArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
              <FaSitemap className="text-emerald-500" /> 
              Tournament Bracket
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Automated bracket generation & tamper-proof draw system
            </p>
          </div>
        </div>

        {/* Champion Banner */}
        {tournamentWinner && (
          <div className="mb-8 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 backdrop-blur-sm rounded-2xl border border-yellow-500/30 p-6 flex items-center justify-center gap-6 shadow-xl">
            <FaTrophy className="text-yellow-500 text-4xl animate-bounce" />
            <div className="text-center">
              <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Tournament Champion</p>
              <p className="text-white font-black text-3xl uppercase tracking-tighter">{tournamentWinner.name}</p>
            </div>
            <FaTrophy className="text-yellow-500 text-4xl animate-bounce" />
          </div>
        )}

        {/* Wizard Steps */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <WizardStep step={1} currentStep={wizardStep} label="Register Teams" />
            <div className="text-emerald-500/50 text-2xl font-black">❯</div>
            <WizardStep step={2} currentStep={wizardStep} label="Lock Registration" />
            <div className="text-emerald-500/50 text-2xl font-black">❯</div>
            <WizardStep step={3} currentStep={wizardStep} label="Run Automated Draw" />
            <div className="text-emerald-500/50 text-2xl font-black">❯</div>
            <WizardStep step={4} currentStep={wizardStep} label="Generate Bracket" />
          </div>
        </div>

        {/* Wizard Content */}
        <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-white/10 p-8 mb-8">
          {wizardStep === 1 && (
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border-2 border-emerald-500/20">
                <FaUsers className="text-3xl text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase mb-2">Team Registration</h3>
              <p className="text-slate-400 mb-6">
                There are currently{' '}
                <span className="text-emerald-400 text-2xl mx-1 font-black">{numTeams}</span>
                approved teams ready for the draw.
              </p>
              <button
                disabled={numTeams < 3}
                onClick={() => setWizardStep(2)}
                className={`px-8 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all ${
                  numTeams < 3
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:scale-105 shadow-lg shadow-emerald-900/30'
                }`}
              >
                {numTeams < 3 ? `Need at least 3 teams (${numTeams}/3)` : 'Proceed to Lock Registration'}
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 border-2 border-amber-500/20">
                <FaLock className="text-3xl text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase mb-2">Lock Data & Registration</h3>
              <p className="text-slate-400 mb-6 max-w-lg">
                Once locked, no further modifications can be made. Byes will be handled automatically.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunDraw}
                  className="px-8 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-white rounded-xl font-black uppercase tracking-wider text-sm hover:scale-105 shadow-lg shadow-amber-900/30 transition-all"
                >
                  Lock & Proceed
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin flex items-center justify-center mb-6 relative">
                <FaRandom className="text-3xl text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase animate-pulse">Running Random Draw...</h3>
              <p className="text-emerald-400 font-bold mt-3 tracking-wider uppercase text-xs">Assigning Seeds & Calculating Byes</p>
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

        {/* Schedule Modal */}
        {scheduleModal && (
          <ScheduleMatchModal
            prefill={scheduleModal}
            onClose={() => setScheduleModal(null)}
          />
        )}

        {/* Archive Section */}
        {archived.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowArchive(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 bg-slate-900/50 rounded-xl border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 text-slate-400">
                <FaArchive className="text-emerald-500" />
                <span className="font-black uppercase text-xs tracking-wider">
                  Past Tournaments — {archived.length} archived
                </span>
              </div>
              {showArchive ? <FaChevronUp className="text-slate-500" /> : <FaChevronDown className="text-slate-500" />}
            </button>

            {showArchive && (
              <div className="mt-4 space-y-3 animate-fade-in">
                {archived.map((t) => (
                  <ArchivedTournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-all">
          <FaTimes size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FaCalendarPlus className="text-emerald-400" size={24} />
          </div>
          <h3 className="text-white font-bold text-lg uppercase">Schedule Match</h3>
          <p className="text-slate-500 text-xs uppercase mt-1">From Bracket</p>
        </div>

        <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4 mb-6 border border-white/5">
          <div className="text-center flex-1">
            <p className="text-white font-bold text-sm">{prefill.team1Name}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase mt-1">Home</p>
          </div>
          <div className="text-slate-600 font-black text-base px-3">VS</div>
          <div className="text-center flex-1">
            <p className="text-white font-bold text-sm">{prefill.team2Name}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase mt-1">Away</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Time</label>
              <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Pitch</label>
            <select value={pitch} onChange={e => setPitch(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500">
              <option value="Main Pitch">Main Pitch</option>
              <option value="Pitch 2">Pitch 2</option>
              <option value="Pitch 3">Pitch 3</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
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
    <div className="bg-slate-900/40 rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/5 transition-all" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <FaTrophy className={`text-lg ${winner ? 'text-yellow-500' : 'text-slate-600'}`} />
          <div>
            <p className="text-white font-bold text-sm uppercase">{winner ? winner.name : 'Unfinished Tournament'}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase">{archivedDate} · {tournament.numTeams} teams · {totalRounds} rounds</p>
          </div>
        </div>
        {expanded ? <FaChevronUp className="text-slate-500" /> : <FaChevronDown className="text-slate-500" />}
      </div>

      {expanded && tournament.rounds && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4">
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-6 min-w-max">
              {Object.keys(tournament.rounds).sort((a, b) => parseInt(a) - parseInt(b)).map((rKey, rIdx) => (
                <div key={rKey} className="flex flex-col gap-3" style={{ width: '220px' }}>
                  <p className="text-emerald-500 font-bold uppercase text-[9px] tracking-[0.2em] text-center">
                    {getRoundLabel(parseInt(rKey), totalRounds)}
                  </p>
                  {tournament.rounds[rKey].map((match) => (
                    <div key={match.id} className="bg-slate-800/50 rounded-xl p-2 border border-white/5 space-y-1">
                      {[match.team1, match.team2].map((team, i) => {
                        if (!team && match.isBye && i === 1) {
                          return <div key="bye" className="px-2 py-1 rounded-lg bg-slate-900/40 border border-dashed border-slate-700 text-slate-600 text-[10px] font-bold uppercase text-center">BYE</div>;
                        }
                        const isWinner = match.winner?.id === team?.id;
                        return (
                          <div key={i} className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                            isWinner ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-slate-900/40 border border-white/5 text-slate-400'
                          }`}>
                            <span className="truncate">{team?.name ?? 'TBD'}</span>
                            {isWinner && <FaCheckCircle className="text-emerald-500 flex-shrink-0 ml-1" size={8} />}
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
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div>
          <h3 className="text-xl font-black text-white uppercase">Official Bracket</h3>
          <p className="text-slate-500 text-xs mt-1">
            Updates automatically when match results are entered
          </p>
        </div>
        <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase">
          {tournament.numTeams} Teams
        </span>
      </div>

      <div className="overflow-x-auto pb-6">
        <div className="flex gap-8 min-w-max">
          {Object.keys(tournament.rounds).sort((a, b) => parseInt(a) - parseInt(b)).map((roundKey, roundIndex) => (
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
  <div className="flex flex-col justify-around gap-6 relative" style={{ width: '280px' }}>
    <div className="text-center mb-2">
      <h3 className="text-emerald-500 font-bold uppercase text-[10px] tracking-[0.2em] bg-slate-800/50 inline-block px-4 py-1 rounded-full">
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
    <div className="bg-slate-800/50 border rounded-xl overflow-hidden transition-all hover:border-emerald-500/30 border-white/10">
      <div className="px-3 py-1.5 bg-slate-800 border-b border-white/5 text-center">
        <span className="text-[8px] font-bold text-slate-500 uppercase">Match</span>
      </div>
      <div className="p-3 space-y-2">
        <TeamSlot
          team={match.team1}
          isWinner={match.winner?.id && match.winner.id === match.team1?.id}
          onClick={() => canClick(match.team1) && onAdvanceWinner(match, match.team1)}
          clickable={!!canClick(match.team1)}
        />
        {match.isBye ? (
          <div className="flex items-center justify-center p-2 rounded-lg bg-slate-900/40 border border-dashed border-slate-700">
            <span className="font-bold uppercase text-slate-600 text-[10px]">BYE</span>
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
      {canSchedule && (
        <div className="px-3 pb-3">
          <button onClick={() => onScheduleMatch(match)} className="w-full py-1.5 rounded-lg font-bold text-[8px] uppercase tracking-wider transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white flex items-center justify-center gap-1">
            <FaCalendarPlus size={9} /> Schedule
          </button>
        </div>
      )}
    </div>
  );
};
// ─── Team Slot ────────────────────────────────────────────────
const TeamSlot = ({ team, isWinner, onClick, clickable }) => (
  <div onClick={onClick} className={`flex items-center justify-between p-2 rounded-lg border transition-all text-xs font-bold uppercase ${
    isWinner ? 'bg-emerald-500/20 border-emerald-500 text-white' : 'bg-slate-900/40 border-white/5 text-slate-300'
  } ${clickable ? 'cursor-pointer hover:bg-slate-700' : ''}`}>
    <span className="truncate">{team ? team.name : <span className="text-slate-600">TBD</span>}</span>
    {isWinner && <FaCheckCircle className="text-emerald-500 flex-shrink-0 ml-1" size={10} />}
  </div>
);

// ─── Wizard Step ──────────────────────────────────────────────
const WizardStep = ({ step, currentStep, label }) => {
  const isCompleted = step < currentStep;
  const isActive    = step === currentStep;
 return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
        isActive ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' :
        isCompleted ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-slate-700 bg-slate-800 text-slate-500'
      }`}>
        {isCompleted ? <FaCheckCircle size={14} /> : step}
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-wider text-center w-20 ${
        isActive ? 'text-white' : isCompleted ? 'text-emerald-500' : 'text-slate-500'
      }`}>{label}</span>
    </div>
  );
};

export default TournamentTab;
