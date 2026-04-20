import React, { useState, useEffect } from 'react';
import { FaRobot, FaTimes, FaLightbulb, FaExclamationTriangle, FaTrophy, FaChartLine, FaUsers } from 'react-icons/fa';

const AIChatSidebar = ({ isOpen, onClose, stats, players, teams }) => {
  const [advice, setAdvice] = useState("");
  const [suspendedPlayers, setSuspendedPlayers] = useState([]);
  const [bestTeam, setBestTeam] = useState(null);

  const generateLocalAdvice = () => {
    if (!players || players.length === 0) return "يا ريس البطولة لسه مفيهاش لعيبة، ضيف لعيبة عشان أقدر أحلل لك الأداء.";
    

    const topScorer = [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
    
    const redCardPlayers = players.filter(p => (p.redCards || 0) > 0);
    setSuspendedPlayers(redCardPlayers);


    const sortedTeams = [...teams].sort((a, b) => {
      if ((b.points || 0) !== (a.points || 0)) {
        return (b.points || 0) - (a.points || 0);
      }
      return (b.goalsFor || 0) - (a.goalsFor || 0);
    });
    const topTeam = sortedTeams[0];
    setBestTeam(topTeam);

    let text = `يا مدير، دي القراءة الفنية النهائية للبطولة:\n\n`;
    

    if (topTeam) {
      text += `🏆 حالياً " ${topTeam.teamName} " هو أفضل فريق في البطولة بالأرقام، أداء مستقر وفتاك.\n\n`;
    }


    if (topScorer && topScorer.goals > 0) {
      text += `⚽ النجم "${topScorer.name}" هو الهداف المرعب بـ ${topScorer.goals} أهداف.\n\n`;
    }

    if (redCardPlayers.length > 0) {
      text += `🚫 تنبيه: عندك ${redCardPlayers.length} لعيبة "موقوفين" بسبب الكروت الحمراء، لازم بدلاء فوراً.\n\n`;
    }


    if (players.filter(p => !p.teamId).length > 0) {
      text += `🏃 لسه فيه لعيبة "Free Agents" مستنيين فرصة، البطولة لسه فيها مواهب مخفية.`;
    }

    return text;
  };

  useEffect(() => {
    if (isOpen) {
      setAdvice(generateLocalAdvice());
    }
  }, [isOpen, players, teams]);

  return (
    <aside className={`fixed top-0 right-0 h-full w-full md:w-[420px] z-[500] transition-transform duration-500 ease-out ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      <div className="h-full bg-gradient-to-b from-[#0a0f16] to-[#121821] border-l border-white/10 flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="relative p-6 border-b border-white/10 bg-gradient-to-r from-[#00FF9C]/5 to-transparent">
          <div className="flex justify-between items-center">
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition-all p-2 rounded-lg hover:bg-white/5"
            >
              <FaTimes size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#00FF9C] to-emerald-600 p-2.5 rounded-xl shadow-lg">
                <FaRobot className="text-black text-xl" />
              </div>
              <div className="text-right">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">المحلل الفني الذكي</h3>
                <p className="text-[#00FF9C] text-[10px] tracking-wider">AI Sports Analyst</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#121821] border border-white/10 rounded-xl p-3 text-center">
              <FaUsers className="text-[#00FF9C] text-lg mx-auto mb-1" />
              <p className="text-2xl font-black text-white">{stats?.total || 0}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Total Players</p>
            </div>
            <div className="bg-[#121821] border border-white/10 rounded-xl p-3 text-center">
              <FaChartLine className="text-[#00FF9C] text-lg mx-auto mb-1" />
              <p className="text-2xl font-black text-white">{teams?.length || 0}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Total Teams</p>
            </div>
          </div>
          
          {/* Best Team Card */}
          {bestTeam && (
            <div className="bg-gradient-to-br from-[#00FF9C]/10 to-transparent border border-[#00FF9C]/20 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FaTrophy className="text-[#00FF9C] text-lg" />
                  <span className="text-[#00FF9C] text-[10px] font-bold uppercase tracking-wider">Best Team</span>
                </div>
                <div className="w-8 h-8 bg-[#00FF9C]/20 rounded-lg flex items-center justify-center">
                  <span className="text-[#00FF9C] font-black text-sm">#1</span>
                </div>
              </div>
              <p className="text-white text-xl font-bold text-right">{bestTeam.teamName}</p>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                <p className="text-[#00FF9C] text-[10px] font-medium">Points: {bestTeam.points || 0}</p>
                <p className="text-gray-400 text-[10px]">GD: {bestTeam.goalsFor || 0}</p>
              </div>
            </div>
          )}

          {/* AI Analysis Card */}
          <div className="bg-[#121821] border border-white/10 rounded-xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-[#00FF9C]/10 rounded-lg flex items-center justify-center">
                <FaLightbulb className="text-[#00FF9C] text-xs" />
              </div>
              <span className="text-[#00FF9C] text-[10px] font-bold uppercase tracking-wider">AI Analysis</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line text-right" dir="rtl">
              {advice}
            </p>
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
                    <span className="text-[10px] bg-red-500/80 text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter">
                      Out
                    </span>
                    <span className="text-gray-200 text-sm font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free Agents Alert */}
          {players?.filter(p => !p.teamId).length > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <p className="text-blue-400 text-xs text-center">
                🏃 {players.filter(p => !p.teamId).length} Free Agents available for recruitment
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 text-center border-t border-white/5">
            <p className="text-[9px] text-gray-600 italic uppercase tracking-widest">
              Real-time tournament data analysis
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AIChatSidebar;