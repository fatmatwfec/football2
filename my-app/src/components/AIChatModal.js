import React, { useState, useRef, useEffect } from "react";
import { FaTimes, FaPaperPlane, FaRobot } from "react-icons/fa";

const AI_KEY = process.env.REACT_APP_OPENROUTER_API_KEY;

const AIChatModal = ({ onClose, userData, teamData, nextMatch, userRank }) => {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: `مرحباً ${userData?.name || "لاعب"} / Hello! 👋\nأنا مساعدك الرياضي / I'm your AI Sports Assistant\n⚽ نصايح تكتيكية / Tactical tips\n💪 برامج تدريب / Training programs\n🔥 تحفيز / Motivation\n📊 تحليل أداء / Performance analysis`
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const systemPrompt = `You are a smart sports assistant specialized in football for a student tournament app called SCI-Football.

Current player data:
- Name: ${userData?.name || "Unknown"}
- Team: ${userData?.assignedTeam || "No team yet"}
- Position: ${userData?.position || "Not specified"}
- Goals: ${userData?.goals || 0}
- Yellow Cards: ${userData?.yellowCards || 0}
- Red Cards: ${userData?.redCards || 0}
- Ranking: ${userRank ? `#${userRank}` : "Unranked"}
- Next Match: ${nextMatch ? `vs ${nextMatch.opponentName} on ${nextMatch.date} at ${nextMatch.time}` : "No upcoming matches"}
- Team Members: ${teamData?.members?.length || 0}
- Is Captain: ${teamData?.captainId === userData?.uid ? "Yes" : "No"}

Your tasks:
1. Give tactical and technical tips based on the player's position
2. Suggest simple training programs suitable for students - short and without complex equipment
3. Motivate the player before matches and build confidence
4. Analyze performance based on available stats
5. Give advice on handling cards and suspensions
6. If captain, give team leadership advice

CRITICAL RULES:
- ALWAYS detect the language of the user's message and reply in the SAME language
- If the user writes in Arabic, reply in clear simple Arabic
- If the user writes in English, reply in English
- Keep responses practical, short, and well organized using bullet points
- Be motivating and positive even if performance is weak
- Use the player's real data in your responses
- Never use complicated or formal language, keep it friendly and simple`;

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
                    "Authorization": `Bearer ${AI_KEY}`
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

            const aiReply = data.choices?.[0]?.message?.content || "Sorry, an error occurred. / عذراً، حدث خطأ.";
            setMessages(prev => [...prev, { role: "assistant", content: aiReply }]);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "⚠️ Connection error. Please check your internet. / خطأ في الاتصال. تحقق من الإنترنت."
            }]);
        }

        setLoading(false);
    };

    const quickPrompts = [
        "نصيحة قبل المباراة 🔥",
        "Training program 💪",
        "كيف أتحسن في مركزي؟ ⚡",
        "Motivate me 🌟",
        "تحليل أدائي 📊"
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#0f172a] border border-white/10 w-full sm:max-w-lg h-[88vh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col">

                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-gradient-to-r from-emerald-900/30 to-transparent flex-shrink-0">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                        <FaRobot className="text-emerald-400 text-lg" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-bold text-sm">AI Sports Assistant / المساعد الرياضي</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">AI Powered</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white">
                        <FaTimes size={16} />
                    </button>
                </div>

                {/* Player Info Strip */}
                <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center gap-3 flex-shrink-0 overflow-x-auto">
                    <span className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">Stats:</span>
                    {userData?.position && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold whitespace-nowrap">
                            {userData.position}
                        </span>
                    )}
                    {userData?.goals > 0 && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold whitespace-nowrap">
                            {userData.goals} Goals ⚽
                        </span>
                    )}
                    {userRank && (
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold whitespace-nowrap">
                            Rank #{userRank}
                        </span>
                    )}
                    {nextMatch && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-bold whitespace-nowrap">
                            vs {nextMatch.opponentName}
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
                <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 custom-scrollbar">
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
                        placeholder="Ask me anything / اسألني أي حاجة..."
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
    );
};

export default AIChatModal;