import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { FaSitemap, FaTrophy, FaLock, FaRandom, FaCheckCircle, FaTimes, FaUsers, FaCog } from 'react-icons/fa';

const TournamentTab = ({ teams }) => {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Wizard state: 1 (Register), 2 (Lock), 3 (Draw/Loading), 4 (Bracket)
  const [wizardStep, setWizardStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tournaments", "main"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().status === "locked") {
        setTournament(docSnap.data());
        setWizardStep(4);
      } else {
        setTournament(null);
        if (wizardStep === 4) setWizardStep(1);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [wizardStep]);

  const runAutomatedDraw = async () => {
    setWizardStep(3); // Go to loading/animation step
    setIsGenerating(true);

    // Simulate drawing animation time
    setTimeout(async () => {
      const numTeams = teams.length;
      let bracketSize = 4;
      if (numTeams > 4) bracketSize = 8;
      if (numTeams > 8) bracketSize = 16;
      if (numTeams > 16) bracketSize = 32;

      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
      const numRounds = Math.log2(bracketSize);
      let rounds = {};

      for (let r = 0; r < numRounds; r++) {
        let numMatchesInRound = bracketSize / Math.pow(2, r + 1);
        let roundMatches = [];

        for (let m = 0; m < numMatchesInRound; m++) {
          let match = {
            id: `r${r}_m${m}`,
            round: r,
            matchIndex: m,
            team1: null,
            team2: null,
            winner: null,
            nextMatchId: r < numRounds - 1 ? `r${r + 1}_m${Math.floor(m / 2)}` : null,
            isBye: false
          };

          if (r === 0) {
             if (m < numTeams) {
                 match.team1 = { id: shuffledTeams[m].id || '', name: shuffledTeams[m].teamName || 'Team' };
             }
             let team2Index = m + numMatchesInRound;
             if (team2Index < numTeams) {
                 match.team2 = { id: shuffledTeams[team2Index].id || '', name: shuffledTeams[team2Index].teamName || 'Team' };
             }

             if (match.team1 && !match.team2) {
                 match.isBye = true;
                 match.winner = match.team1;
             }
          }
          
          roundMatches.push(match);
        }
        rounds[`${r}`] = roundMatches;
      }

      // Auto-advance byes to round 2
      rounds['0'].forEach(m1 => {
          if (m1.winner && m1.nextMatchId) {
              let nextR = parseInt(m1.nextMatchId.split('_')[0].replace('r', ''));
              let nextM = parseInt(m1.nextMatchId.split('_')[1].replace('m', ''));
              if (m1.matchIndex % 2 === 0) {
                  rounds[nextR][nextM].team1 = m1.winner;
              } else {
                  rounds[nextR][nextM].team2 = m1.winner;
              }
          }
      });

      const tournamentData = {
        status: "locked",
        bracketSize: bracketSize,
        numTeams: numTeams,
        rounds: rounds,
        createdAt: new Date()
      };

      try {
        await setDoc(doc(db, "tournaments", "main"), tournamentData);
        // Will auto navigate to step 4 via onSnapshot
      } catch (e) {
        console.error("FIREBASE ERROR:", e);
        alert("Error generating tournament: " + (e.message || "Unknown error"));
        setWizardStep(1);
      }
      setIsGenerating(false);
    }, 2500); // 2.5 second dramatic delay
  };

  const advanceWinner = async (match, winnerTeam) => {
    if(!match.team1 || !match.team2) return;
    if(match.winner) return;

    if(!window.confirm(`Advance ${winnerTeam.name} to the next round?`)) return;

    let newRounds = JSON.parse(JSON.stringify(tournament.rounds));
    let rIdx = `${match.round}`;
    let mIdx = match.matchIndex;
    
    newRounds[rIdx][mIdx].winner = winnerTeam;

    if (match.nextMatchId) {
        let nextR = `${parseInt(match.nextMatchId.split('_')[0].replace('r', ''))}`;
        let nextM = parseInt(match.nextMatchId.split('_')[1].replace('m', ''));
        if (mIdx % 2 === 0) {
            newRounds[nextR][nextM].team1 = winnerTeam;
        } else {
            newRounds[nextR][nextM].team2 = winnerTeam;
        }
    }

    try {
        await setDoc(doc(db, "tournaments", "main"), { ...tournament, rounds: newRounds });
    } catch(e) {
        console.error(e);
        alert("Failed to advance winner.");
    }
  };

  const clearTournament = async () => {
    if(!window.confirm("DANGER: Are you sure you want to delete the active tournament? All bracket data will be lost!")) return;
    try {
        import('firebase/firestore').then(({deleteDoc}) => {
            deleteDoc(doc(db, "tournaments", "main"));
        });
        setWizardStep(1);
    } catch(e) { console.error(e); }
  }


  if (loading) return <div className="text-white text-center py-20 flex flex-col items-center"><FaCog className="animate-spin text-4xl mb-4 text-emerald-500"/> Loading Tournament Module...</div>;

  return (
    <div className="animate-in fade-in duration-500 max-w-[95%] mx-auto pb-40 px-4">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-white/5 shadow-2xl">
        <div>
          <h2 className="text-4xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
            <FaSitemap className="text-blue-500" /> STAGE 3: Tournament Logic
          </h2>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2 italic">Automated bracket generation & tamper-proof draw system</p>
        </div>
        
        {tournament && (
            <div className="flex items-center gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                    <FaLock /> Bracket Locked
                </div>
                <button onClick={clearTournament} className="bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white transition-all p-4 rounded-xl border border-red-500/20">
                    <FaTimes />
                </button>
            </div>
        )}
      </div>

      {/* Progress Wizard Visual */}
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
                <p className="text-slate-400 font-bold mb-8 max-w-lg">There are currently <span className="text-blue-400 text-xl mx-2 font-black">{teams.length}</span> approved teams ready for the draw. Ensure all valid teams are approved before locking.</p>
                <button 
                  disabled={teams.length < 3} 
                  onClick={() => setWizardStep(2)} 
                  className={`px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm transition-all shadow-xl ${teams.length < 3 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-blue-900/40'}`}
                >
                  Proceed to Lock Registration
                </button>
            </div>
        )}

        {wizardStep === 2 && (
            <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
                <div className="size-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border-4 border-amber-500/20">
                    <FaLock className="text-4xl text-amber-500" />
                </div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Lock Data & Registration</h3>
                <p className="text-slate-400 font-bold mb-8 max-w-lg">Once you lock the registration, no further modifications or manual entries can be made to the participants. The draw will automatically adjust for Byes if needed.</p>
                <div className="flex gap-4">
                    <button onClick={() => setWizardStep(1)} className="px-8 py-4 bg-slate-800 text-white rounded-[2rem] font-black uppercase text-xs hover:bg-slate-700 transition-all">Cancel</button>
                    <button onClick={runAutomatedDraw} className="px-10 py-5 bg-amber-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm transition-all hover:bg-amber-500 shadow-xl shadow-amber-900/40 hover:scale-105 active:scale-95">Lock & Proceed</button>
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
            <div className="w-full">
                <div className="text-left mb-8 flex items-center justify-between border-b border-white/5 pb-8">
                   <div>
                       <h3 className="text-2xl font-black text-white uppercase tracking-tight">Official Bracket Generated</h3>
                       <p className="text-slate-400 font-bold text-sm mt-1">Tap a team in any active fixture to officially advance them to the next round.</p>
                   </div>
                   <div className="text-right">
                       <span className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">{tournament.numTeams} Teams</span>
                   </div>
                </div>

                <div className="overflow-x-auto pb-10 custom-scrollbar mt-12 pl-12">
                    <div className="flex gap-16 min-w-max">
                        {Object.keys(tournament.rounds).sort().map((roundKey, roundIndex) => {
                            const roundMatches = tournament.rounds[roundKey];
                            return (
                            <div key={roundIndex} className="flex flex-col justify-around gap-8 relative" style={{ width: '320px' }}>
                                
                                {/* Round Header */}
                                <div className="absolute -top-16 left-0 w-full text-center">
                                    <h3 className="text-blue-500 font-black uppercase text-sm tracking-[0.3em] bg-slate-900 inline-block px-6 py-2 rounded-full border border-blue-500/20">
                                        {roundIndex === Object.keys(tournament.rounds).length - 1 ? "Finals" : 
                                         roundIndex === Object.keys(tournament.rounds).length - 2 ? "Semi-Finals" : 
                                         roundIndex === Object.keys(tournament.rounds).length - 3 ? "Quarter-Finals" :
                                         `Round ${roundIndex + 1}`}
                                    </h3>
                                </div>

                                {/* Matches */}
                                {roundMatches.map((match, matchIndex) => (
                                    <div key={match.id} className="relative flex items-center">
                                        {/* Connector Lines Logic (Visual Only) */}
                                        {roundIndex < Object.keys(tournament.rounds).length - 1 && (
                                            <>
                                                <div className="absolute top-1/2 -right-8 w-8 h-[2px] bg-slate-700"></div>
                                                {matchIndex % 2 === 0 ? (
                                                     <div className="absolute top-1/2 -right-8 w-[2px] h-[calc(50%+2rem)] bg-slate-700"></div>
                                                ) : (
                                                      <div className="absolute bottom-1/2 -right-8 w-[2px] h-[calc(50%+2rem)] bg-slate-700"></div>
                                                )}
                                            </>
                                        )}
                                        {roundIndex > 0 && (
                                            <div className="absolute top-1/2 -left-8 w-8 h-[2px] bg-slate-700"></div>
                                        )}

                                        {/* Match Card */}
                                        <div className="w-full bg-slate-900 border-2 border-slate-800 rounded-[2rem] shadow-2xl relative z-10 hover:border-blue-500/50 transition-all group overflow-hidden">
                                            <div className="p-2 bg-slate-950 text-center border-b border-white/5">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Match {match.matchIndex + 1}</span>
                                            </div>
                                            <div className="p-4 space-y-2 relative">
                                                
                                                {/* Team 1 */}
                                                <div 
                                                  onClick={() => advanceWinner(match, match.team1)}
                                                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${match.winner?.id && match.winner.id === match.team1?.id ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-950 border-white/5 text-slate-300'} ${match.team1 && match.team2 && !match.winner ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                                                >
                                                    <span className="font-black uppercase truncate text-sm">
                                                        {match.team1 ? match.team1.name : <span className="text-slate-600">TBD</span>}
                                                    </span>
                                                    {match.winner?.id === match.team1?.id && <FaCheckCircle className="text-blue-500" />}
                                                </div>

                                                {/* Team 2 */}
                                                {match.isBye ? (
                                                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/20 border border-slate-800 border-dashed">
                                                        <span className="font-black uppercase text-slate-600 tracking-widest text-sm">BYE</span>
                                                    </div>
                                                ) : (
                                                    <div 
                                                      onClick={() => advanceWinner(match, match.team2)}
                                                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${match.winner?.id && match.winner.id === match.team2?.id ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-950 border-white/5 text-slate-300'} ${match.team1 && match.team2 && !match.winner ? 'cursor-pointer hover:bg-slate-800' : ''}`}
                                                    >
                                                        <span className="font-black uppercase truncate text-sm">
                                                            {match.team2 ? match.team2.name : <span className="text-slate-600">TBD</span>}
                                                        </span>
                                                        {match.winner?.id === match.team2?.id && <FaCheckCircle className="text-blue-500" />}
                                                    </div>
                                                )}

                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>

    </div>
  );
};

const WizardStep = ({ step, currentStep, label }) => {
    const isCompleted = step < currentStep;
    const isActive = step === currentStep;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className={`size-20 rounded-full border-4 flex items-center justify-center text-xl font-black transition-all duration-500 shadow-xl ${
                isActive ? 'border-blue-500 bg-blue-600 text-white scale-110 shadow-blue-600/30' : 
                isCompleted ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 
                'border-slate-800 bg-slate-900 text-slate-600'
            }`}>
               {isCompleted ? <FaCheckCircle /> : step}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest text-center w-24 ${isActive ? 'text-white' : isCompleted ? 'text-emerald-500' : 'text-slate-500'}`}>
                {label}
            </span>
        </div>
    )
}

export default TournamentTab;
