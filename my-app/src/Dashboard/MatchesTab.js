import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, increment, getDoc } from 'firebase/firestore';
import { FaTrophy, FaTrash, FaFutbol, FaTimes } from 'react-icons/fa';

const MatchesTab = () => {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]); 
  const [showAddForm, setShowAddForm] = useState(false);
  const [showResultModal, setShowResultModal] = useState(null); 
  
  const [newMatch, setNewMatch] = useState({
    team1: '', team2: '', date: '', time: '', pitch: 'Main Pitch',
  });

  useEffect(() => {
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPlayers = onSnapshot(collection(db, "users"), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubMatches(); unsubTeams(); unsubPlayers(); };
  }, []);

  const updatePlayerStats = async (playerName, stats, isIncrement = true) => {
    const playerObj = players.find(p => p.name === playerName);
    if (!playerObj) return;

    const userRef = doc(db, "users", playerObj.id);
    const multiplier = isIncrement ? 1 : -1;
    await updateDoc(userRef, {
      goals: increment((stats.goals || 0) * multiplier),
      yellowCards: increment((stats.yellow || 0) * multiplier),
      redCards: increment((stats.red || 0) * multiplier)
    });
  };

  const handleFinalizeMatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const score = formData.get('score');
    const matchId = showResultModal.id;
    const statsSnapshot = {};

    try {
      for (let player of getMatchPlayers()) {
        const goals = parseInt(formData.get(`goals-${player.name}`)) || 0;
        const yellow = parseInt(formData.get(`yellow-${player.name}`)) || 0;
        const red = parseInt(formData.get(`red-${player.name}`)) || 0;

        if (goals > 0 || yellow > 0 || red > 0) {
          statsSnapshot[player.name] = { goals, yellow, red };
          await updatePlayerStats(player.name, { goals, yellow, red }, true);
        }
      }

      await updateDoc(doc(db, "matches", matchId), {
        score: score,
        status: "completed",
        statsSnapshot: statsSnapshot
      });

      alert("Match Result & Player Stats Updated!");
      setShowResultModal(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteMatch = async (match) => {
    if (!window.confirm("هل أنت متأكد؟ سيتم خصم إحصائيات هذا الماتش من اللاعبين إذا كان مكتملاً.")) return;
    try {
      if (match.status === 'completed' && match.statsSnapshot) {
        for (const [playerName, stats] of Object.entries(match.statsSnapshot)) {
          await updatePlayerStats(playerName, stats, false);
        }
      }
      await deleteDoc(doc(db, "matches", match.id));
      alert("تم الحذف بنجاح!");
    } catch (err) { console.error(err); }
  };

  const getMatchPlayers = () => {
    if (!showResultModal) return [];
    const team1Data = teams.find(t => t.teamName === showResultModal.team1);
    const team2Data = teams.find(t => t.teamName === showResultModal.team2);
    const combinedMembers = [...(team1Data?.members || []), ...(team2Data?.members || [])];
    return players.filter(p => combinedMembers.includes(p.name));
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto pb-40 px-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><FaTrophy className="text-yellow-500" /> Match Center</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-xl">
          {showAddForm ? "Close" : "New Match"}
        </button>
      </div>

      {showAddForm && (
        <div className="glass p-8 rounded-[2.5rem] border border-blue-500/30 mb-10 animate-in slide-in-from-top-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            const t1 = teams.find(t => t.teamName === newMatch.team1);
            const t2 = teams.find(t => t.teamName === newMatch.team2);
            
            if (newMatch.team1 === newMatch.team2) return alert("لا يمكن للفريق أن يلعب ضد نفسه!");
            if ((t1?.members?.length || 0) < 7 || (t2?.members?.length || 0) < 7) return alert("يجب أن يحتوي كل فريق على 7 لاعبين على الأقل!");
            
            const isBusy = matches.some(m => 
                m.status === 'upcoming' && 
                (m.team1 === newMatch.team1 || m.team2 === newMatch.team1 || 
                 m.team1 === newMatch.team2 || m.team2 === newMatch.team2) &&
                m.date === newMatch.date
            );
            if (isBusy) return alert("أحد الفريقين لديه ماتش آخر في هذا اليوم!");

            addDoc(collection(db, "matches"), { ...newMatch, score: "", status: "upcoming", createdAt: new Date() });
            setShowAddForm(false);
          }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setNewMatch({...newMatch, team1: e.target.value})}>
              <option value="">Team A</option>
              {teams.map(t => <option key={t.id} value={t.teamName}>{t.teamName}</option>)}
            </select>
            <select required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setNewMatch({...newMatch, team2: e.target.value})}>
              <option value="">Team B</option>
              {teams.map(t => <option key={t.id} value={t.teamName}>{t.teamName}</option>)}
            </select>
            <input type="date" required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
            <input type="time" required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setNewMatch({...newMatch, time: e.target.value})} />
            <button type="submit" className="md:col-span-2 bg-[#bef264] text-slate-900 font-black h-14 rounded-2xl uppercase text-sm">Post Match</button>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {matches.map((m) => (
          <div key={m.id} className={`glass rounded-[2.5rem] p-8 border-l-8 ${m.status === 'completed' ? 'border-emerald-500' : 'border-blue-600'} relative group`}>
             <div className="flex items-center justify-between mb-8">
                <p className="text-white font-black flex-1 text-center">{m.team1}</p>
                <div className="bg-white/5 px-6 py-2 rounded-2xl font-black text-xl text-blue-500">{m.score || "VS"}</div>
                <p className="text-white font-black flex-1 text-center">{m.team2}</p>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => setShowResultModal(m)}
                  disabled={m.status === 'completed'}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] ${m.status === 'completed' ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                >
                  {m.status === 'completed' ? "Completed" : "Enter Stats"}
                </button>
                <button onClick={() => handleDeleteMatch(m)} className="bg-red-500/10 text-red-500 px-6 rounded-2xl transition-all"><FaTrash size={14} /></button>
             </div>
          </div>
        ))}
      </div>

      {showResultModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3rem] p-8 relative">
            <button onClick={() => setShowResultModal(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><FaTimes /></button>
            <h3 className="text-white text-xl font-black mb-2 flex items-center gap-2 uppercase tracking-tighter">
              <FaFutbol className="text-lime-400" /> Match Report
            </h3>
            <p className="text-slate-500 text-[10px] uppercase font-bold mb-8 italic">{showResultModal.team1} vs {showResultModal.team2}</p>

            <form onSubmit={handleFinalizeMatch}>
              <div className="mb-10 text-center">
                <label className="text-[10px] text-slate-500 font-black uppercase mb-3 block">Final Score</label>
                <input name="score" placeholder="e.g. 2 - 1" required className="bg-slate-950 border border-white/10 rounded-2xl px-8 py-4 text-center text-2xl font-black text-white outline-none focus:border-lime-400" />
              </div>

              <div className="space-y-4">
                <p className="text-xs text-blue-400 font-black uppercase border-b border-white/5 pb-2">Squad Statistics</p>
                {getMatchPlayers().map(player => (
                  <div key={player.id} className="bg-slate-950/50 p-4 rounded-3xl border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-xs truncate">{player.name}</p>
                      <p className="text-slate-500 text-[8px] uppercase">{player.assignedTeam}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] text-slate-600 uppercase font-black mb-1">Goals</span>
                        <input name={`goals-${player.name}`} type="number" min="0" placeholder="0" className="w-10 bg-slate-900 border border-white/5 rounded-lg p-1 text-center text-xs text-white" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] text-yellow-600 uppercase font-black mb-1">Yellow</span>
                        <input name={`yellow-${player.name}`} type="number" min="0" max="2" placeholder="0" className="w-10 bg-slate-900 border border-white/5 rounded-lg p-1 text-center text-xs text-white" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] text-red-600 uppercase font-black mb-1">Red</span>
                        <input name={`red-${player.name}`} type="number" min="0" max="1" placeholder="0" className="w-10 bg-slate-900 border border-white/5 rounded-lg p-1 text-center text-xs text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" className="w-full bg-lime-400 text-slate-900 py-5 rounded-[2rem] font-black uppercase text-sm mt-10 shadow-xl shadow-lime-500/20 active:scale-95 transition-all">
                Finalize & Save All Stats
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesTab;