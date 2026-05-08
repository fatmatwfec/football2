import React, { useState, useRef, useEffect } from "react";
import { FaTimes, FaPaperPlane, FaRobot } from "react-icons/fa";

const AI_KEY = process.env.REACT_APP_AI_KEY;

const fontStyle = `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`;

const AIChatModal = ({ onClose, userData, teamData, nextMatch, userRank }) => {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: `Hello! ${userData?.name || "لاعب"} \nI'm your AI Sports Assistant\nI can Help You in :\n 1- Tactical tips\n 2- Training programs\n 3- Motivation\n 4- Performance analysis`
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = fontStyle;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const buildSystemPrompt = (userMessage) => {
        const arabicPattern = /[\u0600-\u06FF]/;
        const isArabic = arabicPattern.test(userMessage);
        const detectedLang = isArabic ? "Arabic" : "English";

        return `You are a smart sports assistant specialized in football for a student tournament app called SCI-Football.

=== CRITICAL LANGUAGE RULE — HIGHEST PRIORITY ===
The user's message is written in: ${detectedLang}
You MUST reply ENTIRELY in ${detectedLang}. 
- Do NOT mix languages under any circumstances.
- Do NOT translate proper nouns, names, or technical terms. Keep them as-is in their original script.
  Examples:
  * Player name "Ahmed" → stays "Ahmed" (never write it as "أحمد" unless the user wrote it in Arabic themselves)
  * Team name "Al-Ahly" → stays "Al-Ahly"
  * Position "Striker" → if replying in Arabic, say "مهاجم" (translate the meaning, NOT the spelling of the English word)
- If replying in Arabic: write clean Modern Standard Arabic or simple Egyptian dialect. Never transliterate English words into Arabic letters (e.g., never write "ستريكر" — say "مهاجم" instead).
- If replying in English: write clear simple English.
=== END LANGUAGE RULE ===

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
2. Suggest simple training programs suitable for students — short and without complex equipment
3. Motivate the player before matches and build confidence
4. Analyze performance based on available stats
5. Give advice on handling cards and suspensions
6. If captain, give team leadership advice

Additional rules:
- Keep responses practical, short, and well organized using bullet points
- Be motivating and positive even if performance is weak
- Use the player's real data in your responses
- Never use complicated or formal language, keep it friendly and simple`;
    };

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
                    model: "openai/gpt-4o-mini",
                    messages: [
                        { role: "system", content: buildSystemPrompt(userMsg.content) },
                        ...updatedMessages.filter(m => m.content?.trim())
                    ],
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const aiReply = data.choices?.[0]?.message?.content || "Sorry, an error occurred.";
            setMessages(prev => [...prev, { role: "assistant", content: aiReply }]);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Connection error. Please check your internet."
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
        <div style={{ fontFamily: "'Tajawal', sans-serif" }} className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#0f172a] border border-white/10 w-full sm:max-w-lg h-[88vh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col">

                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-gradient-to-r from-emerald-900/30 to-transparent flex-shrink-0">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                        <FaRobot className="text-emerald-400 text-lg" />
                    </div>
                    <div className="flex-1">
                        <h3 style={{ fontWeight: 800 }} className="text-white text-xl">AI Sports Assistant</h3>
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
                    <span className="text-[13px] text-white font-bold uppercase whitespace-nowrap">Stats:</span>
                    {userData?.position && (
                        <span className="text-[13px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold whitespace-nowrap">
                            {userData.position}
                        </span>
                    )}
                    {userData?.goals > 0 && (
                        <span className="text-[13px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold whitespace-nowrap">
                            {userData.goals} Goals ⚽
                        </span>
                    )}
                    {userRank && (
                        <span className="text-[13px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold whitespace-nowrap">
                            Rank #{userRank}
                        </span>
                    )}
                    {nextMatch && (
                        <span className="text-[13px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-bold whitespace-nowrap">
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
                                    <FaRobot className="text-emerald-400 text-xl" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
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
                            <div className="bg-black border border-white/10 px-4 py-3 rounded-2xl flex items-center gap-1.5">
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
                        placeholder="Ask me anything"
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