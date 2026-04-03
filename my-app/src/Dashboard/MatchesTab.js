import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, increment, writeBatch } from 'firebase/firestore';
import { FaTrophy, FaTrash, FaFutbol, FaTimes, FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa';

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
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
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

  const getAvailableTeams = (otherTeamId = null) => {
    return teams.filter(t => {
      const actualCount = getActualMemberCount(t.id);
      const isFull = actualCount >= 7; 
      
      const isBusy = matches.some(m => 
        m.status === 'upcoming' && 
        m.date === newMatch.date && 
        (m.team1Id === t.id || m.team2Id === t.id)
      );

      const isSelf = t.id === otherTeamId;
      return isFull && !isBusy && !isSelf;
    });
  };

  const validateScores = (formData, match) => {
    const totalScoreStr = formData.get('score');
    if (!totalScoreStr.includes('-')) return "السكور لازم يكون بتنسيق (2-1) مثلاً";
    
    const [score1, score2] = totalScoreStr.split('-').map(s => parseInt(s.trim()));
    let team1Goals = 0;
    let team2Goals = 0;

    const matchPlayers = players.filter(p => p.teamId === match.team1Id || p.teamId === match.team2Id);
    
    matchPlayers.forEach(player => {
      const g = parseInt(formData.get(`goals-${player.id}`)) || 0;
      if (player.teamId === match.team1Id) team1Goals += g;
      if (player.teamId === match.team2Id) team2Goals += g;
    });

    if (team1Goals !== score1) return `أهداف لاعبي ${match.team1Name} (${team1Goals}) لا تساوي السكور (${score1})`;
    if (team2Goals !== score2) return `أهداف لاعبي ${match.team2Name} (${team2Goals}) لا تساوي السكور (${score2})`;
    
    return null;
  };

  const handleFinalizeMatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const error = validateScores(formData, showResultModal);
    if (error) return alert(error);

    setIsSubmitting(true);
    const batch = writeBatch(batch.db || db);

    try {
      const statsSnapshot = {};
      const matchPlayers = players.filter(p => p.teamId === showResultModal.team1Id || p.teamId === showResultModal.team2Id);

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
        score: formData.get('score'),
        status: "completed",
        statsSnapshot,
        finalizedAt: new Date()
      });

      await batch.commit();
      alert("Match stats updated successfully!");
      setShowResultModal(null);
    } catch (err) { console.error(err); alert("Error saving results."); }
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
      batch.delete(doc(db, "matches", String(match.id)));
      await batch.commit();
      alert("Deleted.");
    } catch (err) {
      console.error(err);
      await deleteDoc(doc(db, "matches", match.id));
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto pb-40 px-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3"><FaTrophy className="text-yellow-500" /> Match Center</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-500">
          {showAddForm ? "Cancel" : "Schedule Match"}
        </button>
      </div>

      {showAddForm && (
        <div className="glass p-8 rounded-[2.5rem] border border-blue-500/30 mb-10">
          <form onSubmit={async (e) => {
            e.preventDefault();
            await addDoc(collection(db, "matches"), { ...newMatch, score: "", status: "upcoming", createdAt: new Date() });
            setShowAddForm(false);
          }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-blue-500" 
                onChange={(e) => {
                    const t = teams.find(x => x.id === e.target.value);
                    setNewMatch({...newMatch, team1Id: t.id, team1Name: t.teamName});
                }}>
              <option value="">Home Team (Min 7 Players)</option>
              {getAvailableTeams(newMatch.team2Id).map(t => (
                <option key={t.id} value={t.id}>{t.teamName} ({getActualMemberCount(t.id)} active)</option>
              ))}
            </select>
            <select required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-blue-500" 
                onChange={(e) => {
                    const t = teams.find(x => x.id === e.target.value);
                    setNewMatch({...newMatch, team2Id: t.id, team2Name: t.teamName});
                }}>
              <option value="">Away Team (Min 7 Players)</option>
              {getAvailableTeams(newMatch.team1Id).map(t => (
                <option key={t.id} value={t.id}>{t.teamName} ({getActualMemberCount(t.id)} active)</option>
              ))}
            </select>
            <input type="date" required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
            <input type="time" required className="bg-slate-950 border border-white/10 rounded-2xl p-4 text-white text-xs" onChange={(e) => setNewMatch({...newMatch, time: e.target.value})} />
            <button type="submit" className="md:col-span-2 bg-[#bef264] text-slate-900 font-black h-14 rounded-2xl uppercase text-sm">Post Fixture</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {matches.map((m) => (
          <div key={m.id} className="glass rounded-[2rem] p-6 border border-white/5">
              <div className="flex items-center justify-between gap-4 mb-6">
                <p className="text-white font-bold text-xs flex-1 text-center truncate">{m.team1Name}</p>
                <div className={`px-4 py-2 rounded-xl font-black text-lg ${m.status === 'completed' ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-white/5'}`}>{m.score || "VS"}</div>
                <p className="text-white font-bold text-xs flex-1 text-center truncate">{m.team2Name}</p>
              </div>
              <div className="flex items-center justify-center gap-3 text-slate-500 text-[9px] font-bold mb-6">
                <FaCalendarAlt className="text-blue-500/50" /> <span>{m.date} • {m.time}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowResultModal(m)} disabled={m.status === 'completed'} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] ${m.status === 'completed' ? 'bg-slate-800 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                  {m.status === 'completed' ? "Completed" : "Enter Results"}
                </button>
                <button onClick={() => handleDeleteMatch(m)} className="bg-red-500/10 text-red-500 px-4 rounded-xl hover:bg-red-500 hover:text-white transition-all"><FaTrash size={12} /></button>
              </div>
          </div>
        ))}
      </div>

      {showResultModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-white font-black uppercase text-sm flex items-center gap-2"><FaFutbol className="text-lime-400" /> Match Statistics</h3>
                <button onClick={() => setShowResultModal(null)} className="text-slate-500 hover:text-white"><FaTimes /></button>
            </div>
            
            <form onSubmit={handleFinalizeMatch} className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-3xl border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-2 tracking-widest">Final Score Line</span>
                <input name="score" placeholder="0-0" required className="bg-transparent text-center text-4xl font-black text-white w-full outline-none placeholder:opacity-20" />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-blue-500 font-bold uppercase ml-2 tracking-widest">Individual Stats</p>
                {players.filter(p => p.teamId === showResultModal.team1Id || p.teamId === showResultModal.team2Id).map(player => (
                  <div key={player.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5">
                    <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-bold truncate">{player.name}</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">{player.assignedTeam}</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="text-center">
                            <span className="text-[7px] text-slate-600 font-bold block">GOALS</span>
                            <input name={`goals-${player.id}`} type="number" min="0" defaultValue="0" className="w-8 bg-slate-900 rounded p-1 text-center text-[10px] text-white" />
                        </div>
                        <div className="text-center">
                            <span className="text-[7px] text-yellow-600 font-bold block">YEL</span>
                            <input name={`yellow-${player.id}`} type="number" min="0" max="2" defaultValue="0" className="w-8 bg-slate-900 rounded p-1 text-center text-[10px] text-white" />
                        </div>
                        <div className="text-center">
                            <span className="text-[7px] text-red-600 font-bold block">RED</span>
                            <input name={`red-${player.id}`} type="number" min="0" max="1" defaultValue="0" className="w-8 bg-slate-900 rounded p-1 text-center text-[10px] text-white" />
                        </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-lime-400 text-slate-900 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">
                {isSubmitting ? "Processing..." : "Confirm & Save Results"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesTab;