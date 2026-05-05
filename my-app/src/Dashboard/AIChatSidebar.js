import React, { useState, useRef, useEffect } from "react";
import { FaTimes, FaPaperPlane, FaRobot } from "react-icons/fa";

const AIChatSidebar = ({ isOpen, onClose, stats, players = [], teams = [], matches = [], onUpdatePlayer }) => {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: `مرحباً Admin! 👋\nأنا مساعدك الذكي لإدارة البطولة\n\n📊 تحليل الأداء والإحصائيات\n⚽ متابعة المباريات والنتائج\n🚫 إدارة الإيقافات والبطاقات\n🏆 توقعات وتحليل الفرق\n💡 نصائح إدارية للبطولة`
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const suspendedPlayers = players.filter(p => p.suspendedForNextMatch);
    const topScorer = [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
    const completedMatches = matches.filter(m => (m.status || "").toLowerCase() === "completed");
    const liveMatches = matches.filter(m => {
        if (!m.date || !m.time) return false;
        const start = new Date(`${m.date} ${m.time}`).getTime();
        const end = start + 20 * 60 * 1000;
        const now = Date.now();
        return now >= start && now <= end;
    });

    const getTeamStrength = (team) => {
        const tp = players.filter(p => p.teamId === team.id);
        const goals = tp.reduce((s, p) => s + (p.goals || 0), 0);
        const red = tp.reduce((s, p) => s + (p.redCards || 0), 0);
        return (team.wins || 0) * 5 + goals * 2 - red * 3;
    };

    const favTeam = teams.length
        ? [...teams].sort((a, b) => getTeamStrength(b) - getTeamStrength(a))[0]
        : null;

    const systemPrompt = `You are a smart AI assistant for the admin of SCI-Football — a student football tournament management system.

Current tournament data:
- Total Players: ${stats?.total || players.length}
- Pending Approvals: ${stats?.pending || 0}
- Free Agents: ${stats?.free || players.filter(p => !p.hasTeam).length}
- Total Teams: ${teams.length}
- Completed Matches: ${completedMatches.length}
- Live Matches Now: ${liveMatches.length}
- Suspended Players: ${suspendedPlayers.length}
- Tournament Favorite: ${favTeam?.teamName || "N/A"} (Strength: ${favTeam ? getTeamStrength(favTeam) : 0})
- Top Scorer: ${topScorer?.name || "N/A"} (${topScorer?.goals || 0} goals)

Teams summary:
${teams.slice(0, 10).map(t => {
    const tp = players.filter(p => p.teamId === t.id);
    const goals = tp.reduce((s, p) => s + (p.goals || 0), 0);
    return `- ${t.teamName}: ${tp.length} players, ${goals} goals, Strength ${getTeamStrength(t)}`;
}).join("\n")}

Suspended players:
${suspendedPlayers.slice(0, 10).map(p => `- ${p.name} (${p.suspendReason || "suspended"})`).join("\n") || "None"}

Your tasks as Admin AI Assistant:
1. Answer questions about tournament statistics and standings
2. Analyze team performance and predict match outcomes
3. Give advice on tournament management decisions
4. Identify players at risk of suspension
5. Suggest tactical improvements for the tournament
6. Help manage scheduling and team organization

CRITICAL RULES:
- ALWAYS detect the language of the admin's message and reply in the SAME language
- If admin writes in Arabic, reply in clear Arabic
- If admin writes in English, reply in English
- Be analytical and data-driven in responses
- Use bullet points for clarity
- Reference actual data from the tournament in your answers
- Be professional but friendly`;

    const sendMessage = async () => {
        if (!input.trim() || loading) return;
        setLoading(true);

        const userMsg = { role: "user", content: input.trim() };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput("");

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.REACT_APP_AI_KEY}`
                },
                body: JSON.stringify({
                    model: "openrouter/free",
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...updatedMessages.filter(m => m.content?.trim())
                    ],
                    max_tokens: 1000
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            const aiReply = data.choices?.[0]?.message?.content || "عذراً، حدث خطأ.";
            setMessages(prev => [...prev, { role: "assistant", content: aiReply }]);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "⚠️ خطأ في الاتصال. تحقق من الإنترنت أو الـ API Key."
            }]);
        }

        setLoading(false);
    };

    const quickPrompts = [
        "تحليل البطولة 📊",
        "من الأقرب للفوز؟ 🏆",
        "اللاعبين الموقوفين 🚫",
        "أفضل اللاعبين ⭐",
        "Match predictions 🔮",
        "Team stats overview 📈",
    ];

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[490] transition-all duration-300 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
            />

            {/* Sidebar */}
            <div className={`fixed top-0 right-0 h-full w-full md:w-[440px] z-[500] transform transition-transform duration-500 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
                <div className="h-full bg-[#0f172a] border-l border-white/10 flex flex-col shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-gradient-to-r from-emerald-900/30 to-transparent flex-shrink-0">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                            <FaRobot className="text-emerald-400 text-lg" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold text-sm">AI Admin Assistant / المساعد الإداري</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Tournament Intelligence</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
                            <FaTimes size={16} />
                        </button>
                    </div>

                    {/* Stats Strip */}
                    <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
                        <span className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">Stats:</span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold whitespace-nowrap">
                            {stats?.total || players.length} Players
                        </span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold whitespace-nowrap">
                            {teams.length} Teams
                        </span>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20 font-bold whitespace-nowrap">
                            {completedMatches.length} Done
                        </span>
                        {suspendedPlayers.length > 0 && (
                            <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-bold whitespace-nowrap">
                                {suspendedPlayers.length} Suspended 🚫
                            </span>
                        )}
                        {liveMatches.length > 0 && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 font-bold whitespace-nowrap animate-pulse">
                                🔴 {liveMatches.length} Live
                            </span>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.role === "assistant" && (
                                    <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 mt-1 border border-emerald-500/20">
                                        <FaRobot className="text-emerald-400 text-xs" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                    msg.role === "user"
                                        ? "bg-emerald-600 text-white rounded-br-sm"
                                        : "bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm"
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 border border-emerald-500/20">
                                    <FaRobot className="text-emerald-400 text-xs" />
                                </div>
                                <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Quick Prompts */}
                    <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
                        {quickPrompts.map(q => (
                            <button
                                key={q}
                                onClick={() => setInput(q)}
                                className="whitespace-nowrap text-[10px] font-bold px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:border-emerald-500/50 transition-all"
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-white/10 flex gap-2 flex-shrink-0">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey && !loading) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="اسأل عن البطولة / Ask about the tournament..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500/50 transition-all placeholder-gray-600"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                        >
                            <FaPaperPlane className="text-black text-sm" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AIChatSidebar;