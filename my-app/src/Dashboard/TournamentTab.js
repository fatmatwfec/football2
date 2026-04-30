import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, deleteDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
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
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentStartTime, setTournamentStartTime] = useState("09:00");
  const [tournamentStartDate, setTournamentStartDate] = useState("");
  const [tournamentEndDate, setTournamentEndDate] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const getRemainingTime = () => {
    if (!tournament?.createdAt) return null;
    const createdAt = tournament.createdAt.toDate ? tournament.createdAt.toDate().getTime() : (typeof tournament.createdAt === 'number' ? tournament.createdAt : new Date(tournament.createdAt).getTime());
    const deadline = createdAt + (48 * 60 * 60 * 1000);
    const diff = deadline - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getDeadlineString = () => {
    if (!tournament?.createdAt) return null;
    const createdAt = tournament.createdAt.toDate ? tournament.createdAt.toDate().getTime() : (typeof tournament.createdAt === 'number' ? tournament.createdAt : new Date(tournament.createdAt).getTime());
    const deadline = createdAt + (48 * 60 * 60 * 1000);
    return new Date(deadline).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournaments', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTournament({ id: snap.id, ...data });
        
        // Auto-populate name from registration title if available
        if (data.registrationTitle && !tournamentName) {
          setTournamentName(data.registrationTitle);
        }

        if (data.rounds) {
          setWizardStep(3);
        } else {
          setWizardStep(1);
        }
      } else {
        setTournament(null);
        setWizardStep(1);
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
    if (readOnly) return;
    
    // تصفية الفرق لتشمل فقط المسجلين
    const registeredTeams = teams.filter(t => 
      tournament?.registeredTeamIds?.includes(t.id)
    );

    const targetTeams = registeredTeams.length > 0 ? registeredTeams : teams;

    if (targetTeams.length < 3) {
      alert(`Need at least 3 teams. Currently registered: ${registeredTeams.length}`);
      return;
    }

    const finalTournamentName = tournamentName.trim() || tournament?.registrationTitle;
    if (!finalTournamentName) {
      alert("Please enter a tournament name.");
      return;
    }
    
    // التحقق من توافق التواريخ مع نطاق البطولة
    const startRange = tournament.startDate;
    const endRange = tournament.endDate;
    
    for (const d of tournamentDates) {
      if (!d.date) return alert("Please select a date for all match slots");
      if (d.date < startRange || d.date > endRange) {
        return alert(`Date ${d.date} is outside the tournament range (${startRange} to ${endRange})`);
      }
    }

    if (tournamentDates.length === 0) {
      alert("Please add at least one date.");
      return;
    }

    // التحقق من الوقت لو أول يوم هو النهاردة بالظبط
    const firstDay = tournamentDates[0];
    const nowLocal = new Date();
    const todayStr = nowLocal.toLocaleDateString('en-CA'); // 'YYYY-MM-DD'

    if (firstDay.date === todayStr) {
      const [h, m] = firstDay.startTime.split(':').map(Number);
      const startDateTime = new Date();
      startDateTime.setHours(h, m, 0, 0);
      
      if (startDateTime <= nowLocal) {
        alert("The start time for today's matches must be in the future.");
        return;
      }
    }
    setWizardStep(2); 
    setIsGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 4500));
      await generateBracket(targetTeams, tournamentDates, finalTournamentName);
      setWizardStep(3); 
    } catch (e) {
      console.error(e);
      alert('Error: ' + (e.message ?? 'Unknown error'));
      setWizardStep(1);
    }
    setIsGenerating(false);
  };

  const handleOpenRegistration = async () => {
    if (!tournamentName.trim()) return alert("Enter tournament name first");
    if (!tournamentStartDate || !tournamentEndDate) return alert("Please select start and end dates for the tournament announcement");

    const today = new Date().toISOString().split('T')[0];
    if (tournamentStartDate < today) {
      return alert("Tournament start date cannot be in the past!");
    }
    if (tournamentEndDate < tournamentStartDate) {
      return alert("End date cannot be before start date!");
    }
    try {
      await setDoc(doc(db, 'tournaments', 'main'), {
        registrationOpen: true,
        registrationTitle: tournamentName,
        startDate: tournamentStartDate,
        endDate: tournamentEndDate,
        registeredTeamIds: [],
        createdAt: new Date(),
        status: 'registration'
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCloseRegistration = async () => {
    try {
      await updateDoc(doc(db, 'tournaments', 'main'), {
        registrationOpen: false,
        status: 'setup'
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const addDate = () => {
    if (!dateInput) return;
    if (tournamentDates.some(d => d.date === dateInput)) return;
    setTournamentDates([...tournamentDates, { date: dateInput, startTime: tournamentStartTime }].sort((a,b) => a.date.localeCompare(b.date)));
    setDateInput("");
  };

  const removeDate = (dateObj) => {
    setTournamentDates(tournamentDates.filter(d => d.date !== dateObj.date));
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

  const handleForceReset = async () => {
    if (readOnly) return;
    if (!window.confirm('WARNING: This will completely wipe the current tournament data and registration. Continue?')) return;
    try {
      await deleteDoc(doc(db, 'tournaments', 'main'));
      alert("Tournament data cleared! You can now start fresh.");
      setWizardStep(1);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
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
              {tournament ? (tournament.name || 'Tournament Live') : 'Tournament Setup'}
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              {tournament ? 'The brackets are locked and the competition is live!' : readOnly ? 'Tournament bracket is currently being prepared by officials.' : 'Register teams and initiate the automated random draw.'}
            </p>
          </div>
          {!readOnly && (
            <button 
                onClick={handleForceReset}
                className="ml-auto px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase rounded-xl border border-red-500/20 transition-all"
            >
                Force Reset
            </button>
          )}
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
        {!tournament?.rounds && !readOnly && (
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
           {wizardStep === 1 && !tournament?.rounds && (
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
                <div className="w-full max-w-md mb-8 space-y-6">
                  {/* Phase 1: Registration Management */}
                  {!tournament?.registrationOpen && !tournament?.registeredTeamIds && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-6">
                       <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block tracking-widest">1. Announce Tournament</label>
                       <input 
                        type="text" 
                        placeholder="e.g. Ramadan Cup 2024"
                        value={tournamentName}
                        onChange={(e) => setTournamentName(e.target.value)}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold mb-4"
                      />
                      <div className="grid grid-cols-2 gap-4 mb-4 text-left">
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block tracking-widest">Start Date</label>
                          <input 
                            type="date" 
                            min={new Date().toLocaleDateString('en-CA')}
                            value={tournamentStartDate}
                            onChange={(e) => setTournamentStartDate(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-emerald-500 transition-all font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block tracking-widest">End Date</label>
                          <input 
                            type="date" 
                            min={tournamentStartDate || new Date().toLocaleDateString('en-CA')}
                            value={tournamentEndDate}
                            onChange={(e) => setTournamentEndDate(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-emerald-500 transition-all font-bold"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleOpenRegistration}
                        className="w-full py-3 bg-emerald-500 text-black font-black rounded-xl uppercase text-xs hover:bg-emerald-400 transition-all"
                      >
                        Open Registration
                      </button>
                    </div>
                  )}

                  {tournament?.registrationOpen && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                           <div className="flex flex-col">
                              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Registration Live: {tournament.registrationTitle}</label>
                              {tournament.createdAt && (
                                <span className="text-[8px] font-bold text-emerald-500/60 uppercase">
                                  Deadline: {getDeadlineString()} ({getRemainingTime()})
                                </span>
                              )}
                           </div>
                           <span className={`w-2 h-2 rounded-full ${getRemainingTime() === "Expired" ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                        </div>
                       <div className="space-y-2 mb-6 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {tournament.registeredTeamIds?.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No teams registered yet...</p>
                          ) : (
                            tournament.registeredTeamIds?.map(tid => {
                              const t = teams.find(x => x.id === tid);
                              return (
                                <div key={tid} className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5">
                                  <span className="text-white text-xs font-bold">{t?.teamName || tid}</span>
                                  <FaCheckCircle className="text-emerald-500" size={12} />
                                </div>
                              );
                            })
                          )}
                       </div>
                       <button
                        onClick={handleCloseRegistration}
                        className="w-full py-3 bg-red-500/20 text-red-400 border border-red-500/30 font-black rounded-xl uppercase text-xs hover:bg-red-500/30 transition-all mb-4"
                      >
                        Close Registration
                      </button>
                      <button
                        onClick={handleForceReset}
                        className="w-full py-2 text-red-500/50 hover:text-red-500 text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Force Reset (Clear All)
                      </button>
                    </div>
                  )}

                  {/* Phase 2: Draw Setup (Only visible when registration is closed but bracket not yet made) */}
                  {!tournament?.registrationOpen && (tournament?.registeredTeamIds || tournament?.status === 'setup') && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="text-left bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl mb-2">
                        <label className="text-[10px] font-black text-emerald-500 uppercase block tracking-widest mb-1">Tournament Name</label>
                        <p className="text-white font-black text-xl uppercase italic">{tournamentName || tournament?.registrationTitle || "Main Tournament"}</p>
                      </div>

                      <div className="text-left">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block tracking-widest">Schedule Dates</label>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <input 
                              type="date" 
                              value={dateInput}
                              min={tournament?.startDate || new Date().toISOString().split('T')[0]}
                              max={tournament?.endDate}
                              onChange={(e) => setDateInput(e.target.value)}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 transition-all font-bold"
                            />
                          </div>
                          <div className="w-1/3">
                            <input 
                              type="time" 
                              value={tournamentStartTime}
                              onChange={(e) => setTournamentStartTime(e.target.value)}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500 font-bold"
                            />
                          </div>
                          <button onClick={addDate} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-all text-xs uppercase">Add</button>
                        </div>
                      </div>
                      
                      {tournamentDates.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6 justify-center">
                          {tournamentDates.map(item => (
                            <div key={item.date} className="flex flex-col gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold min-w-[120px]">
                              <div className="flex justify-between items-center">
                                 <span>{item.date}</span>
                                 <button onClick={() => removeDate(item)} className="hover:text-red-400 transition-colors"><FaTrash size={10} /></button>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-emerald-500/70"><FaClock size={8} /> {item.startTime}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        disabled={ (tournament?.registeredTeamIds?.length || 0) < 3 && numTeams < 3 }
                        onClick={handleRunDraw}
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-102 shadow-xl shadow-emerald-900/40 transition-all flex items-center justify-center gap-3"
                      >
                        <FaRandom className="animate-spin-slow" />
                        Initiate Draw ({tournament?.registeredTeamIds?.length || numTeams} Teams)
                      </button>
                    </div>
                  )}
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

          {(wizardStep === 3 || (tournament && tournament.rounds)) && !isGenerating && (
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
            tournamentName={tournament?.name}
            startDate={tournament?.startDate}
            endDate={tournament?.endDate}
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
                  <ArchivedTournamentCard 
                    key={t.id} 
                    tournament={t} 
                    onDelete={async (id) => {
                      if (!window.confirm('Delete this archived tournament?')) return;
                      await deleteDoc(doc(db, 'tournaments_archive', id));
                      setArchived(prev => prev.filter(x => x.id !== id));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Friendly Match Modal ─────────────────────────────────────
const ScheduleMatchModal = ({ prefill, tournamentName, startDate, endDate, onClose }) => {
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
        tournamentName: tournamentName || "Main Tournament"
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
          <h3 className="text-white font-bold text-lg uppercase">Friendly Match</h3>
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
              <input 
                type="date" 
                required 
                value={date} 
                min={startDate || new Date().toISOString().split('T')[0]}
                max={endDate}
                onChange={e => setDate(e.target.value)} 
                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500" 
              />
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
const ArchivedTournamentCard = ({ tournament, onDelete }) => {
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
            <p className="text-white font-bold text-sm uppercase">{tournament.name || (winner ? winner.name : 'Unfinished Tournament')}</p>
            <p className="text-slate-500 text-[8px] font-bold uppercase">{archivedDate} · {tournament.numTeams} teams · {totalRounds} rounds</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(tournament.id); }}
            className="p-2 text-slate-500 hover:text-red-500 transition-colors"
          >
            <FaTrash size={12} />
          </button>
          {expanded ? <FaChevronUp className="text-slate-500" /> : <FaChevronDown className="text-slate-500" />}
        </div>
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
  if (!tournament?.rounds) return null;
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
          {tournament?.rounds && Object.keys(tournament.rounds).sort((a, b) => parseInt(a) - parseInt(b)).map((roundKey, roundIndex) => (
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
          📅 {new Date(roundDate.date || roundDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
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

  const displayDate = scheduledMatch?.date || (roundDate?.date || roundDate);
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
