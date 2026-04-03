import React, { useState, useEffect } from 'react';
import { FaRobot, FaTimes, FaLightbulb, FaExclamationTriangle, FaTrophy } from 'react-icons/fa';

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
    <aside className={`fixed top-0 right-0 h-full w-full md:w-[380px] z-[500] transition-transform duration-500 shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full bg-slate-900 border-l border-white/10 flex flex-col">
        
    
        <div className="p-6 border-b border-white/5 bg-blue-600/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
              <FaRobot className="text-white text-xl" />
            </div>
            <h3 className="text-white font-bold text-[11px] uppercase tracking-widest">المحلل الفني الذكي</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-all p-2">
            <FaTimes size={20} />
          </button>
        </div>

        
        <div className="flex-1 overflow-y-auto p-6 bg-black/20 custom-scrollbar space-y-5">
          
          
          {bestTeam && (
            <div className="bg-gradient-to-br from-yellow-600/20 to-transparent border border-yellow-500/30 p-5 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2 text-yellow-500 mb-2 font-bold text-[10px] uppercase tracking-widest">
                <FaTrophy className="text-lg" /> الفريق الأفضل حالياً:
              </div>
              <p className="text-white text-xl font-black text-right">{bestTeam.teamName}</p>
              <p className="text-yellow-500/70 text-[10px] text-right mt-1 font-medium">متصدر الترتيب بناءً على النتائج</p>
            </div>
          )}

        
          <div className="bg-slate-800/80 border border-white/10 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 text-blue-400 mb-4 font-bold text-xs">
              <FaLightbulb /> ملخص الأداء:
            </div>
            <p className="text-slate-200 text-[13px] leading-relaxed whitespace-pre-line text-right" dir="rtl">
              {advice}
            </p>
          </div>

          {suspendedPlayers.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl">
              <div className="flex items-center gap-2 text-red-500 mb-3 font-bold text-[10px] uppercase">
                <FaExclamationTriangle /> غيابات للإيقاف:
              </div>
              <div className="space-y-2">
                {suspendedPlayers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter">Out</span>
                    <span className="text-slate-200 text-[12px] font-medium">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="py-4 text-center">
             <p className="text-[9px] text-slate-600 italic uppercase tracking-widest">
               Real-time tournament data analysis
             </p>
          </div>
        </div>

      </div>
    </aside>
  );
};

export default AIChatSidebar;