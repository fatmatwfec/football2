import React, { useState, useEffect, useCallback } from 'react';
import {
  FaRobot,
  FaTimes,
  FaLightbulb,
  FaExclamationTriangle,
  FaTrophy,
  FaChartLine,
  FaUsers
} from 'react-icons/fa';

const AIChatSidebar = ({ isOpen, onClose, stats, players = [], teams = [], onUpdatePlayer }) => {
  const [advice, setAdvice] = useState('');
  const [suspendedPlayers, setSuspendedPlayers] = useState([]);
  const [bestTeam, setBestTeam] = useState(null);

  const calculateTeamStrength = useCallback(
    (team) => {
      const teamPlayers = players.filter((p) => p.teamId === team.id);
      const goals = teamPlayers.reduce((sum, p) => sum + (p.goals || 0), 0);
      const assists = teamPlayers.reduce((sum, p) => sum + (p.assists || 0), 0);
      const redCards = teamPlayers.reduce((sum, p) => sum + (p.redCards || 0), 0);
      const wins = team.wins || 0;
      return wins * 5 + goals * 2 + assists - redCards * 3;
    },
    [players]
  );

  const predictKnockoutMatch = useCallback(
    (teamA, teamB) => {
      const strengthA = calculateTeamStrength(teamA);
      const strengthB = calculateTeamStrength(teamB);
      if (strengthA > strengthB) return `🔥 ${teamA.teamName} الأقرب للتأهل`;
      if (strengthB > strengthA) return `🔥 ${teamB.teamName} الأقرب للتأهل`;
      return `⚖️ المواجهة صعبة وممكن تروح لركلات الترجيح`;
    },
    [calculateTeamStrength]
  );

  const getTournamentFavorite = useCallback(() => {
    if (!teams.length) return null;
    return [...teams].sort(
      (a, b) => calculateTeamStrength(b) - calculateTeamStrength(a)
    )[0];
  }, [teams, calculateTeamStrength]);

  const generateAnalysis = useCallback(() => {
    if (!players.length) {
      return {
        text: 'لسه مفيش بيانات كفاية للتحليل.',
        favorite: null,
        redCardPlayers: [],
      };
    }

    const favorite = getTournamentFavorite();
    const redCardPlayers = players.filter((p) => (p.redCards || 0) > 0);

    let text = `🏆 تحليل البطولة:\n\n`;

    if (favorite) {
      text += `🔥 أقرب فريق للفوز بالبطولة: ${favorite.teamName}\n\n`;
    }

    if (redCardPlayers.length > 0) {
      text += `🚫 عندك ${redCardPlayers.length} لاعيبة موقوفين، وده خطر في مباريات الإقصاء.\n\n`;
    }

    const bestPlayers = [...players]
      .sort(
        (a, b) =>
          (b.goals || 0) + (b.assists || 0) - ((a.goals || 0) + (a.assists || 0))
      )
      .slice(0, 3);

    if (bestPlayers.length > 0) {
      text += `⭐ مفاتيح اللعب:\n`;
      bestPlayers.forEach((p) => {
        text += `- ${p.name} (${p.goals || 0}G / ${p.assists || 0}A)\n`;
      });
      text += `\n`;
    }

    const freeAgents = players.filter((p) => !p.teamId);
    if (freeAgents.length > 0) {
      text += `🏃 فيه ${freeAgents.length} لاعيبة فري ممكن تدعم بيهم الفرق.\n\n`;
    }

    if (teams.length >= 2) {
      const sorted = [...teams].sort(
        (a, b) => calculateTeamStrength(b) - calculateTeamStrength(a)
      );
      text += predictKnockoutMatch(sorted[0], sorted[1]);
    }

    return { text, favorite, redCardPlayers };
  }, [players, teams, getTournamentFavorite, predictKnockoutMatch, calculateTeamStrength]);

  useEffect(() => {
    if (!isOpen) return;

    const { text, favorite, redCardPlayers } = generateAnalysis();
    setAdvice(text);
    setBestTeam(favorite);
    setSuspendedPlayers(redCardPlayers);
  }, [isOpen, generateAnalysis]);

  return (
    <aside
      className={`fixed top-0 right-0 h-full w-full md:w-[420px] z-[500] transition-transform duration-500 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="h-full bg-[#0f172a] border-l border-white/10 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes size={20} />
          </button>

          <div className="flex items-center gap-2">
            <FaRobot className="text-green-400" />
            <h3 className="text-white font-bold text-sm">AI Analyzer</h3>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e293b] p-3 rounded text-center">
              <FaUsers className="mx-auto text-green-400" />
              <p className="text-white text-xl">{stats?.total || 0}</p>
              <p className="text-gray-400 text-xs">Players</p>
            </div>

            <div className="bg-[#1e293b] p-3 rounded text-center">
              <FaChartLine className="mx-auto text-green-400" />
              <p className="text-white text-xl">{teams?.length || 0}</p>
              <p className="text-gray-400 text-xs">Teams</p>
            </div>
          </div>

          {/* Best Team */}
          {bestTeam && (
            <div className="bg-green-500/10 p-4 rounded">
              <FaTrophy className="text-green-400 mb-2" />
              <p className="text-white font-bold">{bestTeam.teamName}</p>
              <p className="text-gray-400 text-xs">
                Strength: {calculateTeamStrength(bestTeam)}
              </p>
            </div>
          )}

          {/* Advice */}
          <div className="bg-[#1e293b] p-4 rounded">
            <FaLightbulb className="text-green-400 mb-2" />
            <p className="text-gray-300 text-sm whitespace-pre-line">{advice}</p>
          </div>

          {/* Suspended Players */}
          {suspendedPlayers.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <FaExclamationTriangle className="text-red-400 text-xs" />
                </div>
                <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">
                  Suspended ({suspendedPlayers.length})
                </span>
              </div>
              <div className="space-y-2">
                {suspendedPlayers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                    <button
                      onClick={() => {
                        if (!onUpdatePlayer) return;
                        onUpdatePlayer({ ...p, redCards: 0 });
                        setSuspendedPlayers(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-[10px] bg-green-500/80 hover:bg-green-500 text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter transition-colors"
                    >
                      out
                    </button>
                    <span className="text-gray-200 text-sm font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AIChatSidebar;