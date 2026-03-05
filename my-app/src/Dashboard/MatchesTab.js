import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FaRegCalendarAlt, FaBell, FaTrophy, FaEdit, FaPlus, FaTrash, FaClock, FaLocationArrow } from 'react-icons/fa';

const MatchesTab = () => {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newMatch, setNewMatch] = useState({
    team1: '',
    team2: '',
    date: '',
    time: '',
    pitch: 'Main Pitch',
  });

  useEffect(() => {
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qTeams = query(collection(db, "teams"), where("status", "==", "approved"));
    const unsubTeams = onSnapshot(qTeams, (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubMatches(); unsubTeams(); };
  }, []);

  const handleEnterResult = async (matchId) => {
    const score = prompt("Final Score (e.g., 3-1):");
    if (!score) return;
    const scorer = prompt("Goal Scorers:");
    const yellow = prompt("Number of Yellow Cards:");
    const red = prompt("Number of Red Cards:");

    try {
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        score: score,
        topScorer: scorer,
        yellowCards: parseInt(yellow) || 0,
        redCards: parseInt(red) || 0,
        status: "completed"
      });
      alert("Results Recorded Successfully!");
    } catch (e) { console.error(e); }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (newMatch.team1 === newMatch.team2) return alert("Select two different teams!");

    try {
      await addDoc(collection(db, "matches"), {
        ...newMatch,
        score: "", 
        status: "upcoming",
        createdAt: new Date()
      });
      setShowAddForm(false);
      setNewMatch({ team1: '', team2: '', date: '', time: '', pitch: 'Main Pitch' });
    } catch (err) { console.error(err); }
  };

  const deleteMatch = async (id) => {
    if (window.confirm("Delete this match?")) await deleteDoc(doc(db, "matches", id));
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto pb-40">
      <div className="flex items-center justify-between mb-8 px-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FaTrophy className="text-yellow-500" /> Match Schedule
          </h2>
          <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-widest font-bold">Manage tournament fixtures & results</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg text-sm"
        >
          {showAddForm ? "Cancel" : <><FaPlus /> New Match</>}
        </button>
      </div>
      {showAddForm && (
        <div className="glass p-6 rounded-[2.5rem] border border-blue-500/30 mb-10 animate-in zoom-in duration-300 mx-4">
          <form onSubmit={handleCreateMatch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select required className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none" onChange={(e) => setNewMatch({...newMatch, team1: e.target.value})}>
              <option value="">Select Team 1</option>
              {teams.map(t => <option key={t.id} value={t.teamName}>{t.teamName}</option>)}
            </select>
            <select required className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none" onChange={(e) => setNewMatch({...newMatch, team2: e.target.value})}>
              <option value="">Select Team 2</option>
              {teams.map(t => <option key={t.id} value={t.teamName}>{t.teamName}</option>)}
            </select>
            <input type="date" required className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-white" onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
            <input type="time" required className="bg-slate-900 border border-white/10 rounded-2xl p-4 text-white" onChange={(e) => setNewMatch({...newMatch, time: e.target.value})} />
            <button type="submit" className="md:col-span-2 bg-[#bef264] text-slate-900 font-black h-14 rounded-2xl hover:bg-lime-400 transition-all uppercase tracking-tighter">Schedule Match</button>
          </form>
        </div>
      )}
      <div className="flex flex-col gap-6 px-4">
        {matches.length > 0 ? matches.map((m) => (
          <div key={m.id} className="glass rounded-[2.5rem] p-6 border-l-8 border-blue-600 shadow-2xl relative overflow-hidden group">
            
            <button onClick={() => deleteMatch(m.id)} className="absolute top-4 right-4 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><FaTrash size={12}/></button>

            <div className="flex items-center justify-between mb-6">
              <p className="flex-1 text-center font-black text-white uppercase text-sm tracking-tight">{m.team1}</p>
              <div className="bg-blue-600/20 px-6 py-2 rounded-full border border-blue-500/30 mx-4">
                <span className="text-2xl font-black text-blue-500">{m.score || "VS"}</span>
              </div>
              <p className="flex-1 text-center font-black text-white uppercase text-sm tracking-tight">{m.team2}</p>
            </div>

            {(m.yellowCards > 0 || m.redCards > 0) && (
              <div className="flex justify-center gap-4 mb-4">
                {m.yellowCards > 0 && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-lg font-bold">🟨 {m.yellowCards} Yellows</span>}
                {m.redCards > 0 && <span className="text-[10px] bg-red-500/20 text-red-500 px-3 py-1 rounded-lg font-bold">🟥 {m.redCards} Reds</span>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
              <div className="bg-slate-900/40 rounded-2xl p-3 flex items-center gap-3"><FaRegCalendarAlt className="text-blue-500" /><span className="text-slate-300 text-[11px] font-bold">{m.date}</span></div>
              <div className="bg-slate-900/40 rounded-2xl p-3 flex items-center gap-3"><FaBell className="text-blue-500" /><span className="text-slate-300 text-[11px] font-bold">{m.time}</span></div>
            </div>

            <div className="flex gap-2 mt-6">
              <button className="flex-1 glass hover:bg-white/10 text-white py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"><FaEdit /> Edit</button>
              <button onClick={() => handleEnterResult(m.id)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20">Enter Result</button>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 opacity-30">
            <FaRegCalendarAlt size={40} className="mx-auto mb-4" />
            <p className="italic">No matches scheduled.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchesTab;