import React from 'react';
import { FaTrophy, FaFutbol, FaMedal } from 'react-icons/fa';

const LeaderboardTab = ({ players, teams, matches = [] }) => {
  
  const topScorers = players
    .filter(p => p.role !== 'admin' && p.name !== 'Admin')
    .sort((a, b) => (b.goals || 0) - (a.goals || 0))
    .slice(0, 5);

  const getFullTeamStats = (teamName) => {
    let stats = { 
        points: 0, goals: 0, yellowCards: 0, redCards: 0, 
        played: 0, wins: 0, draws: 0, losses: 0 
    };
    
    matches.filter(m => m.status === "completed").forEach(m => {
      if (m.team1 === teamName || m.team2 === teamName) {
        stats.played++;
        
        const scores = m.score.split('-').map(s => parseInt(s.trim()));
        const isT1 = m.team1 === teamName;
        const myScore = isT1 ? scores[0] : scores[1];
        const oppScore = isT1 ? scores[1] : scores[0];

        if (myScore > oppScore) { stats.wins++; stats.points += 3; }
        else if (myScore === oppScore) { stats.draws++; stats.points += 1; }
        else { stats.losses++; }
      }
    });

    players.filter(p => p.assignedTeam === teamName).forEach(p => {
      stats.goals += (p.goals || 0);
      stats.yellowCards += (p.yellowCards || 0);
      stats.redCards += (p.redCards || 0);
    });

    return stats;
  };

  const rankedTeams = teams
    .map(t => ({ ...t, stats: getFullTeamStats(t.teamName) }))
    .sort((a, b) => b.stats.points - a.stats.points);

  return (
    <div className="pb-40 px-4 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-black text-white uppercase flex justify-center gap-3">
          <FaTrophy className="text-yellow-500" /> Tournament Standings
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <div className="glass rounded-[3rem] p-8 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <FaFutbol className="text-lime-400" /> Top Scorers
          </h3>
          {topScorers.length > 0 ? topScorers.map(p => (
            <div key={p.id} className="flex justify-between bg-slate-950 p-4 rounded-xl mb-2 border border-white/5">
              <span className="text-white text-sm font-bold">{p.name}</span>
              <span className="text-emerald-500 font-black">{p.goals || 0} Goals</span>
            </div>
          )) : <p className="text-slate-600 text-sm italic">No data yet.</p>}
        </div>

        <div className="glass rounded-[3rem] p-8 border border-white/5">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <FaMedal className="text-blue-400" /> Elite Teams
          </h3>
          {rankedTeams.map((team, index) => (
            <div key={team.id} className="bg-slate-950 p-4 rounded-xl mb-4 border border-white/5 hover:border-blue-500/30 transition-all">
              <div className="flex justify-between text-white font-black mb-2">
                <span>{index + 1}. {team.teamName}</span>
                <span className="text-blue-400">{team.stats.points} PTS</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[9px] text-slate-400 font-bold uppercase my-3 bg-white/5 p-2 rounded-xl">
                  <div>W: {team.stats.wins}</div>
                  <div>D: {team.stats.draws}</div>
                  <div>L: {team.stats.losses}</div>
                  <div>P: {team.stats.played}</div>
              </div>

              <div className="flex gap-6 text-[10px] text-slate-400 uppercase font-bold">
                <span>⚽ {team.stats.goals} G</span>
                <span>🟨 {team.stats.yellowCards} YC</span>
                <span>🟥 {team.stats.redCards} RC</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardTab;