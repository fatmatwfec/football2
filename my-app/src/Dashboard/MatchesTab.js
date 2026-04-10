import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { FaTrophy, FaTrash, FaFutbol, FaTimes, FaCalendarAlt, FaClock, FaCheckCircle } from 'react-icons/fa';

const MatchesTab = () => {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]); 
  const [showAddForm, setShowAddForm] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newMatch, setNewMatch] = useState({
    team1Id: '', team2Id: '', team1Name: '', team2Name: '',
    date: '', time: '', pitch: 'Main Pitch',
  });

  useEffect(() => {
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
    
      const sortedMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
      setMatches(sortedMatches);
    });
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPlayers = onSnapshot(collection(db, "users"), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubMatches(); unsubTeams(); unsubPlayers(); };
  }, []);

  const getActualMemberCount = (teamId) => {
    return players.filter(p => p.teamId === teamId).length;
  };


  const isMatchFinished = (matchDate, matchTime) => {
    const now = new Date();
    const mDate = new Date(`${matchDate} ${matchTime}`);
    return now >= mDate;
  };

  const getAvailableTeams = (otherTeamId = null) => {
    return teams.filter(t => {
      const actualCount = getActualMemberCount(t.id);
      return actualCount >= 7 && t.id !== otherTeamId;
    });
  };

  const handleFinalizeMatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const s1 = parseInt(formData.get('score1')) || 0;
    const s2 = parseInt(formData.get('score2')) || 0;
    const finalScore = `${s1}-${s2}`;

    let team1Goals = 0;
    let team2Goals = 0;

    const matchPlayers = players.filter(p => p.teamId === showResultModal.team1Id || p.teamId === showResultModal.team2Id);
    
    matchPlayers.forEach(player => {
      const g = parseInt(formData.get(`goals-${player.id}`)) || 0;
      if (player.teamId === showResultModal.team1Id) team1Goals += g;
      if (player.teamId === showResultModal.team2Id) team2Goals += g;
    });

    if (team1Goals !== s1) return alert(`أهداف لاعبي ${showResultModal.team1Name} (${team1Goals}) لا تساوي السكور (${s1})`);
    if (team2Goals !== s2) return alert(`أهداف لاعبي ${showResultModal.team2Name} (${team2Goals}) لا تساوي السكور (${s2})`);

    setIsSubmitting(true);
    const batch = writeBatch(db); 

    try {
      const statsSnapshot = {};
      matchPlayers.forEach(player => {
        const goals = parseInt(formData.get(`goals-${player.id}`)) || 0;
        const yellow = parseInt(formData.get(`yellow-${player.id}`)) || 0;
        const red = parseInt(formData.get(`red-${player.id}`)) || 0;

        if (goals > 0 || yellow > 0 || red > 0) {
          statsSnapshot[player.id] = { name: player.name, goals, yellow, red };
          batch.update(doc(db, "users", player.id), {
            goals: increment(goals),
            yellowCards: increment(yellow),
            redCards: increment(red)
          });
        }
      });

      batch.update(doc(db, "matches", showResultModal.id), {
        score: finalScore,
        status: "completed",
        statsSnapshot,
        finalizedAt: new Date()
      });

      await batch.commit();
      alert("Match stats updated successfully!");
      setShowResultModal(null);
    } catch (err) { 
      console.error(err); 
      alert("Error saving results: " + err.message); 
    }
    setIsSubmitting(false);
  };

  const handleDeleteMatch = async (match) => {
    if (!window.confirm("Are you sure? Stats will be rolled back.")) return;
    try {
      const batch = writeBatch(db);
      if (match.status === 'completed' && match.statsSnapshot) {
        Object.entries(match.statsSnapshot).forEach(([pId, stats]) => {
          batch.update(doc(db, "users", pId), {
            goals: increment(-(stats.goals || 0)),
            yellowCards: increment(-(stats.yellow || 0)),
            redCards: increment(-(stats.red || 0))
          });
        });
      }
      batch.delete(doc(db, "matches", match.id));
      await batch.commit();
      alert("Deleted.");
    } catch (err) { console.error(err); }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-40 px-4">
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-white/5">
        <div>
          <h2 className="text-4xl font-black text-white flex items-center gap-4">
            <FaTrophy className="text-yellow-500" /> FIXTURES
          </h2>
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2 italic">Official League Match Center</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-2xl ${showAddForm ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
          {showAddForm ? "Cancel Schedule" : "Schedule New Match"}
        </button>
      </div>

      {showAddForm && (
        <div className="glass p-10 rounded-[3rem] border-2 border-blue-500/20 mb-12 bg-slate-900/40">
          <form onSubmit={async (e) => {
            e.preventDefault();
            await addDoc(collection(db, "matches"), { ...newMatch, score: "", status: "upcoming", createdAt: new Date() });
            setShowAddForm(false);
          }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Home Team</label>
                <select required className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all" 
                    onChange={(e) => {
                        const t = teams.find(x => x.id === e.target.value);
                        setNewMatch({...newMatch, team1Id: t.id, team1Name: t.teamName});
                    }}>
                <option value="">Select Home</option>
                {getAvailableTeams(newMatch.team2Id).map(t => (
                    <option key={t.id} value={t.id}>{t.teamName} ({getActualMemberCount(t.id)} Players)</option>
                ))}
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-4">Away Team</label>
                <select required className="w-full bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all" 
                    onChange={(e) => {
                        const t = teams.find(x => x.id === e.target.value);
                        setNewMatch({...newMatch, team2Id: t.id, team2Name: t.teamName});
                    }}>
                <option value="">Select Away</option>
                {getAvailableTeams(newMatch.team1Id).map(t => (
                    <option key={t.id} value={t.id}>{t.teamName} ({getActualMemberCount(t.id)} Players)</option>
                ))}
                </select>
            </div>
            <input type="date" required className="bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
            <input type="time" required className="bg-slate-950 border-2 border-white/5 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500" onChange={(e) => setNewMatch({...newMatch, time: e.target.value})} />
            <button type="submit" className="md:col-span-2 bg-blue-600 text-white font-black h-16 rounded-[2rem] uppercase text-sm shadow-xl hover:bg-blue-500 transition-all active:scale-95">Confirm Fixture</button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {matches.map((m) => {
          const canFinalize = isMatchFinished(m.date, m.time);
          return (
            <div key={m.id} className={`glass rounded-[3rem] p-8 border-2 transition-all shadow-2xl bg-slate-900/40 ${m.status === 'completed' ? 'border-emerald-500/20' : 'border-white/5'}`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1 text-center md:text-right">
                    <p className="text-white font-black text-2xl uppercase tracking-tighter">{m.team1Name}</p>
                    <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Home Team</p>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <div className={`text-4xl font-black px-10 py-4 rounded-[2rem] shadow-inner ${m.status === 'completed' ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-slate-950 border border-white/5'}`}>
                        {m.score || "VS"}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px] uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-full border border-white/5">
                        <FaCalendarAlt className="text-blue-500" /> {m.date} <FaClock className="text-blue-500 ml-2" /> {m.time}
                    </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                    <p className="text-white font-black text-2xl uppercase tracking-tighter">{m.team2Name}</p>
                    <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Away Team</p>
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-8 border-t border-white/5">
                <button 
                  onClick={() => setShowResultModal(m)} 
                  disabled={m.status === 'completed' || !canFinalize} 
                  className={`flex-[4] py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${
                    m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                    !canFinalize ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 
                    'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl shadow-emerald-900/20'
                  }`}
                >
                  {m.status === 'completed' ? <span className="flex items-center justify-center gap-2"><FaCheckCircle /> Finalized</span> : 
                   !canFinalize ? "Waiting for kick-off" : "Enter Results"}
                </button>
                <button onClick={() => handleDeleteMatch(m)} className="flex-1 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/10 flex items-center justify-center">
                    <FaTrash size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showResultModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-slate-900 border-2 border-white/10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[4rem] p-12 relative shadow-2xl">
            <button onClick={() => setShowResultModal(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all scale-150"><FaTimes /></button>
            
            <div className="text-center mb-10">
                <h3 className="text-white font-black uppercase text-2xl tracking-tighter flex items-center justify-center gap-3">
                    <FaFutbol className="text-emerald-500" /> Post-Match Report
                </h3>
                <p className="text-slate-500 text-xs font-black uppercase mt-2">{showResultModal.team1Name} VS {showResultModal.team2Name}</p>
            </div>
            
            <form onSubmit={handleFinalizeMatch} className="space-y-10">
              <div className="flex items-center justify-center gap-8 bg-slate-950 p-10 rounded-[3rem] border border-white/5 shadow-inner">
                <div className="text-center space-y-3">
                    <label className="text-[10px] text-slate-500 font-black uppercase">{showResultModal.team1Name}</label>
                    <input name="score1" type="number" min="0" placeholder="0" required className="bg-slate-900 text-center text-5xl font-black text-white w-24 h-24 rounded-3xl outline-none focus:border-emerald-500 border-2 border-transparent transition-all" />
                </div>
                <div className="text-4xl font-black text-slate-700 mt-6">-</div>
                <div className="text-center space-y-3">
                    <label className="text-[10px] text-slate-500 font-black uppercase">{showResultModal.team2Name}</label>
                    <input name="score2" type="number" min="0" placeholder="0" required className="bg-slate-900 text-center text-5xl font-black text-white w-24 h-24 rounded-3xl outline-none focus:border-emerald-500 border-2 border-transparent transition-all" />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-emerald-500 font-black uppercase ml-4 tracking-[0.2em]">Individual Player Statistics</p>
                <div className="grid grid-cols-1 gap-3">
                    {players.filter(p => p.teamId === showResultModal.team1Id || p.teamId === showResultModal.team2Id).map(player => (
                    <div key={player.id} className="bg-slate-950/60 p-6 rounded-[2rem] flex items-center justify-between border border-white/5 hover:border-emerald-500/30 transition-all">
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-lg font-bold truncate tracking-tight">{player.name}</p>
                            <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{player.assignedTeam}</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center">
                                <span className="text-[8px] text-slate-500 font-black block mb-1">GOALS</span>
                                <input name={`goals-${player.id}`} type="number" min="0" defaultValue="0" className="w-12 bg-slate-900 rounded-xl p-3 text-center text-sm font-black text-white border border-white/5" />
                            </div>
                            <div className="text-center">
                                <span className="text-[8px] text-yellow-500 font-black block mb-1">YEL</span>
                                <input name={`yellow-${player.id}`} type="number" min="0" max="2" defaultValue="0" className="w-12 bg-slate-900 rounded-xl p-3 text-center text-sm font-black text-white border border-white/5" />
                            </div>
                            <div className="text-center">
                                <span className="text-[8px] text-red-500 font-black block mb-1">RED</span>
                                <input name={`red-${player.id}`} type="number" min="0" max="1" defaultValue="0" className="w-12 bg-slate-900 rounded-xl p-3 text-center text-sm font-black text-white border border-white/5" />
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-2xl shadow-emerald-900/40 transition-all active:scale-95">
                {isSubmitting ? "Syncing with Database..." : "Publish Match Results"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesTab;