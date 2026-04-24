import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { FaSitemap, FaTrophy, FaLock, FaRandom, FaCheckCircle, FaTimes, FaUsers, FaCog, FaCalendarPlus, FaArchive, FaChevronDown, FaChevronUp, FaFutbol, FaArrowLeft, FaTrash, FaClock, FaCalendarAlt } from 'react-icons/fa';
import {generateBracket,manualAdvanceWinner,clearTournament,fetchArchivedTournaments,getTournamentWinner,getRoundLabel, buildMatchCache} from '../services/tournamentService';
import { scheduleMatch } from '../services/matchService';

const TournamentTab = ({ teams, onBack, readOnly = false }) => {
  const [tournament,    setTournament]    = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [wizardStep,    setWizardStep]    = useState(1);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [archived,      setArchived]      = useState([]);
  const [showArchive,   setShowArchive]   = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null); 
  const [tournamentDates, setTournamentDates] = useState([]);
  const [dateInput, setDateInput] = useState("");
  const [allMatches, setAllMatches] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournaments', 'main'), (snap) => {
      if (snap.exists()) {
        setTournament({ id: snap.id, ...snap.data() });
        setWizardStep(3);
      } else {
        setTournament(null);
        setWizardStep((prev) => (prev === 3 ? 1 : prev));
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchArchivedTournaments().then(setArchived).catch(console.error);
    const unsubMatches = onSnapshot(collection(db, 'matches'), (snap) => {
      setAllMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubMatches();
  }, []);

  const matchCache = useMemo(() => {
    const cache = {};
    allMatches.forEach(m => {
      if (m.team1Id && m.team2Id) {
        const key = [m.team1Id, m.team2Id].sort().join('__');
        cache[key] = m;
      }
    });
    return cache;
  }, [allMatches]);

  const numTeams         = teams?.length ?? 0;
  const tournamentWinner = useMemo(() => getTournamentWinner(tournament), [tournament]);

  const handleRunDraw = async () => {
    if (readOnly || numTeams < 3) return;
    if (tournamentDates.length === 0) {
      alert("Please add at least one date for the tournament.");
      return;
    }
    setWizardStep(2); 
    setIsGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 4500));
      await generateBracket(teams, tournamentDates);
      setWizardStep(3); 
    } catch (e) {
      console.error(e);
      alert('Error generating tournament: ' + (e.message ?? 'Unknown error'));
      setWizardStep(1);
    }
    setIsGenerating(false);
  };

  const addDate = () => {
    if (!dateInput) return;
    if (tournamentDates.includes(dateInput)) return;
    setTournamentDates([...tournamentDates, dateInput].sort());
    setDateInput("");
  };

  const removeDate = (date) => {
    setTournamentDates(tournamentDates.filter(d => d !== date));
  };

  const handleManualAdvance = async (match, winnerTeam) => {
    if (readOnly || !match.team1 || !match.team2 || match.winner) return;
    if (!window.confirm(`Manually advance ${winnerTeam.name}?`)) return;
    try {
      await manualAdvanceWinner(tournament, match, winnerTeam);
    } catch (e) {
      alert('Failed: ' + (e.message ?? 'Unknown error'));
    }
  };

  const handleClear = async () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
          {onBack && (
            <button
              onClick={onBack}
              className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group"
            >
              <FaArrowLeft className="text-lg group-hover:-translate-x-1 transition-transform" />
            </button>
          )}
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
              <FaSitemap className="text-emerald-500" /> 
              {tournament ? 'Tournament Live' : 'Tournament Setup'}
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              {tournament ? 'The brackets are locked and the competition is live!' : readOnly ? 'Tournament bracket is currently being prepared by officials.' : 'Register teams and initiate the automated random draw.'}
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
        {!tournament && !readOnly && (
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <WizardStep step={1} currentStep={wizardStep} label="Ready Teams" />
              <div className="text-emerald-500/50 text-2xl font-black">❯</div>
              <WizardStep step={2} currentStep={wizardStep} label="Perform Draw" />
              <div className="text-emerald-500/50 text-2xl font-black">❯</div>
              <WizardStep step={3} currentStep={wizardStep} label="Live Bracket" />
            </div>
          </div>
        )}

        {/* Wizard Content */}
        <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-white/10 p-8 mb-8">
           {wizardStep === 1 && !tournament && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border-2 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                <FaUsers className="text-3xl text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase mb-2">{readOnly ? 'Waiting for Officials' : 'Tournament Setup'}</h3>
              <p className="text-slate-400 mb-6 max-w-md text-sm">
                {readOnly 
                  ? 'Registration is currently closing. The official draw will appear here shortly.' 
                  : `We have ${numTeams} approved teams. Select the tournament dates below.`}
              </p>

              {!readOnly && (
                <div className="w-full max-w-md mb-8">
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="date" 
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      className="flex-1 bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500"
                    />
                    <button 
                      onClick={addDate}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-all text-xs uppercase"
                    >
                      Add Date
                    </button>
                  </div>
                  
                  {tournamentDates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6 justify-center">
                      {tournamentDates.map(date => (
                        <div key={date} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold">
                          {date}
                          <button onClick={() => removeDate(date)} className="hover:text-red-400 transition-colors">
                            <FaTrash size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    disabled={numTeams < 3 || tournamentDates.length === 0}
                    onClick={handleRunDraw}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 ${
                      numTeams < 3 || tournamentDates.length === 0
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:scale-102 shadow-xl shadow-emerald-900/40'
                    }`}
                  >
                    <FaRandom className={numTeams >= 3 ? "animate-spin-slow" : ""} />
                    {numTeams < 3 ? `Need ${3 - numTeams} More Teams` : tournamentDates.length === 0 ? 'Select Dates First' : 'Initiate Automated Draw'}
                  </button>
                </div>
              )}
            </div>
          )}

          {wizardStep === 2 && isGenerating && (
            <div className="flex flex-col items-center text-center py-16 animate-fade-slide-up">
              <div className="relative w-48 h-48 mb-12">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/5 border-t-emerald-500 animate-[spin_2s_cubic-bezier(0.4,0,0.2,1)_infinite]"></div>
                <div className="absolute inset-4 rounded-full border-4 border-emerald-400/5 border-b-emerald-400 animate-[spin_3s_linear_infinite_reverse]"></div>
                <div className="absolute inset-8 rounded-full border-4 border-emerald-300/5 border-r-emerald-300 animate-[spin_1.5s_ease-in-out_infinite]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FaRandom className="text-5xl text-emerald-400 animate-pulse" />
                </div>
              </div>
              
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-6 bg-gradient-to-r from-white to-slate-500 text-transparent bg-clip-text">
                Generating Final Bracket
              </h3>
              
              <div className="flex flex-col items-center gap-4 max-w-sm">
                <div className="flex items-center gap-3 px-6 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <p className="text-emerald-400 font-bold tracking-widest uppercase text-[10px]">
                    Randomizing Team Seeds
                  </p>
                </div>
                <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] animate-pulse">
                  Applying Tournament Algorithm
                </p>
              </div>
            </div>
          )}

          {(wizardStep === 3 || tournament) && !isGenerating && (
            <div className="relative animate-fade-in">
              <BracketView
                tournament={tournament}
                matches={matchCache}
                onAdvanceWinner={handleManualAdvance}
                onScheduleMatch={handleScheduleFromBracket}
                onClear={handleClear}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        {scheduleModal && !readOnly && (
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
                        const isWinner = match.winner?.id && match.winner.id === team?.id;
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
const BracketView = ({ tournament, matches, onAdvanceWinner, onScheduleMatch, onClear, readOnly }) => {
  const totalRounds = Object.keys(tournament.rounds).length;

   return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/10 pb-4 mb-6 gap-4">
        <div>
          <h3 className="text-xl font-black text-white uppercase flex items-center gap-2">
            <FaSitemap className="text-emerald-500 text-sm" /> Official Bracket
          </h3>
          <p className="text-slate-500 text-[10px] mt-1 font-bold uppercase tracking-wider">
            Live Tournament • {tournament.numTeams} Teams
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3">
            <button
              onClick={onClear}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              Reset Tournament
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-6">
        <div className="flex gap-8 min-w-max">
          {Object.keys(tournament.rounds).sort((a, b) => parseInt(a) - parseInt(b)).map((roundKey, roundIndex) => (
            <RoundColumn
              key={roundKey}
              roundMatches={tournament.rounds[roundKey]}
              roundIndex={roundIndex}
              totalRounds={totalRounds}
              roundDate={tournament.roundDateMap?.[roundKey]}
              matches={matches}
              onAdvanceWinner={onAdvanceWinner}
              onScheduleMatch={onScheduleMatch}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const RoundColumn = ({ roundMatches, roundIndex, totalRounds, roundDate, matches, onAdvanceWinner, onScheduleMatch, readOnly }) => (
  <div className="flex flex-col justify-around gap-6 relative" style={{ width: '220px' }}>
    <div className="text-center mb-2">
      <h3 className="text-emerald-500 font-bold uppercase text-[10px] tracking-[0.2em] bg-slate-800/50 inline-block px-4 py-1 rounded-full">
        {getRoundLabel(roundIndex, totalRounds)}
      </h3>
      {roundDate && (
        <p className="text-slate-500 text-[8px] font-bold mt-1 uppercase tracking-tighter">
          📅 {new Date(roundDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </p>
      )}
    </div>
    {roundMatches.map((match) => (
      <MatchCard
        key={match.id}
        match={match}
        roundIndex={roundIndex}
        totalRounds={totalRounds}
        roundDate={roundDate}
        matches={matches}
        onAdvanceWinner={onAdvanceWinner}
        onScheduleMatch={onScheduleMatch}
        readOnly={readOnly}
      />
    ))}
  </div>
);

// ─── Match Card ───────────────────────────────────────────────
const MatchCard = ({ match, roundIndex, totalRounds, roundDate, matches, onAdvanceWinner, onScheduleMatch, readOnly }) => {
  const canClick     = (team) => !readOnly && match.team1 && match.team2 && !match.winner && team;
  
  const mKey = (match.team1 && match.team2) ? [match.team1.id, match.team2.id].sort().join('__') : null;
  const scheduledMatch = mKey ? matches[mKey] : null;

  const displayDate = scheduledMatch?.date || roundDate;
  const displayTime = scheduledMatch?.time || match.projectedTime;

 return (
    <div className="bg-slate-800/50 border rounded-xl overflow-hidden transition-all hover:border-emerald-500/30 border-white/10">
      <div className="px-3 py-1.5 bg-slate-800 border-b border-white/5 text-center">
        <span className="text-[8px] font-bold text-slate-500 uppercase">Match Info</span>
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
      
      {displayDate && !match.winner && (
        <div className="px-3 pb-3 flex items-center justify-center gap-3 border-t border-white/5 pt-3">
           <div className="flex items-center gap-1 text-emerald-400 font-bold text-[9px] uppercase">
             <FaCalendarAlt size={10} /> {displayDate}
           </div>
           {displayTime && (
             <div className="flex items-center gap-1 text-emerald-400 font-bold text-[9px] uppercase">
               <FaClock size={10} /> {displayTime}
             </div>
           )}
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
