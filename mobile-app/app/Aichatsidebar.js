import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Dimensions
} from "react-native";

const { width, height } = Dimensions.get("window");

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_AI_KEY;

export default function AIChatSidebar({ visible, onClose, stats, players = [], teams = [], matches = [] }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "أهلاً Admin! 👋\nأنا مساعدك الذكي لإدارة البطولة\n\n📊 تحليل الأداء والإحصائيات\n⚽ متابعة المباريات والنتائج\n🚫 إدارة الإيقافات والبطاقات\n🏆 توقعات وتحليل الفرق\n💡 نصائح إدارية للبطولة",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: width, duration: 280, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const suspendedPlayers = players.filter((p) => p.suspendedForNextMatch);
  const topScorer = [...players].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
  const completedMatches = matches.filter((m) => (m.status || "").toLowerCase() === "completed");
  const liveMatches = matches.filter((m) => {
    if (!m.date || !m.time) return false;
    const start = new Date(`${m.date} ${m.time}`).getTime();
    return Date.now() >= start && Date.now() <= start + 20 * 60 * 1000;
  });

  const getTeamStrength = (team) => {
    const tp = players.filter((p) => p.teamId === team.id);
    const goals = tp.reduce((s, p) => s + (p.goals || 0), 0);
    const red = tp.reduce((s, p) => s + (p.redCards || 0), 0);
    return (team.wins || 0) * 5 + goals * 2 - red * 3;
  };

  const favTeam = teams.length ? [...teams].sort((a, b) => getTeamStrength(b) - getTeamStrength(a))[0] : null;

  const systemPrompt = `You are a football tournament assistant. Reply in the SAME language as the user's message.
Keep responses SHORT, CLEAR, and use simple bullet points.
No tables, no complex formatting.
IMPORTANT: Keep all team names and player names EXACTLY as provided in the data below. Do not translate or transliterate any names.

Tournament data:
- Players: ${stats?.total || players.length}
- Teams: ${teams.length}
- Completed Matches: ${completedMatches.length}
- Suspended: ${suspendedPlayers.length}
- Top Scorer: ${topScorer?.name || "N/A"} (${topScorer?.goals || 0} goals)
- Favorite: ${favTeam?.teamName || "N/A"}

Teams:
${teams.slice(0, 10).map((t) => {
  const tp = players.filter((p) => p.teamId === t.id);
  const goals = tp.reduce((s, p) => s + (p.goals || 0), 0);
  return `${t.teamName}: ${tp.length} players, ${goals} goals`;
}).join("\n")}`;


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
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://football.app",
        "X-Title": "Football",
      },
      body: JSON.stringify({
       model: "tencent/hy3-preview:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...updatedMessages.filter((m) => m.content?.trim()),
        ],
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    console.log("API Response:", JSON.stringify(data));
    if (data.error) throw new Error(data.error.message);
    
    
    const msg = data.choices?.[0]?.message;
    const aiReply = msg?.content || 
      msg?.reasoning_details?.[0]?.text?.split('\n\n').slice(-1)[0] ||
      msg?.reasoning ||
        "عذراً، لم يتمكن الذكاء الاصطناعي من الرد.";
    setMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);
  } catch (err) {
    console.error("Error:", err.message);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `⚠️ ${err.message}` },
    ]);
  }
  setLoading(false);
};

console.log("KEY:", process.env.EXPO_PUBLIC_AI_KEY);
  const quickPrompts = [
    "تحليل البطولة 📊",
    "من الأقرب للفوز؟ 🏆",
    "اللاعبين الموقوفين 🚫",
    "أفضل اللاعبين ⭐",
    "Match predictions 🔮",
    "Team stats overview 📈",
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.overlay}>
          <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>

            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.robotIcon}>
                  <Text style={{ fontSize: 20 }}>🤖</Text>
                </View>
                <View>
                  <Text style={s.headerTitle}>AI Admin Assistant</Text>
                  <View style={s.livePill}>
                    <View style={s.liveDot} />
                    <Text style={s.livePillText}>TOURNAMENT INTELLIGENCE</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── Stats Strip ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsStrip} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 6, gap: 6 }}>
              <View style={[s.statPill, { borderColor: "rgba(0,255,156,0.3)", backgroundColor: "rgba(0,255,156,0.08)" }]}>
                <Text style={[s.statPillText, { color: "#00FF9C" }]}>{stats?.total || players.length} Players</Text>
              </View>
              <View style={[s.statPill, { borderColor: "rgba(96,165,250,0.3)", backgroundColor: "rgba(96,165,250,0.08)" }]}>
                <Text style={[s.statPillText, { color: "#60a5fa" }]}>{teams.length} Teams</Text>
              </View>
              <View style={[s.statPill, { borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(167,139,250,0.08)" }]}>
                <Text style={[s.statPillText, { color: "#a78bfa" }]}>{completedMatches.length} Done</Text>
              </View>
              {suspendedPlayers.length > 0 && (
                <View style={[s.statPill, { borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)" }]}>
                  <Text style={[s.statPillText, { color: "#f87171" }]}>🚫 {suspendedPlayers.length} Suspended</Text>
                </View>
              )}
              {liveMatches.length > 0 && (
                <View style={[s.statPill, { borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.12)" }]}>
                  <Text style={[s.statPillText, { color: "#ef4444" }]}>🔴 {liveMatches.length} Live</Text>
                </View>
              )}
            </ScrollView>

            {/* ── Messages ── */}
            <ScrollView
              ref={scrollRef}
              style={s.messages}
              contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg, i) => (
                <View key={i} style={[s.msgRow, msg.role === "user" ? s.msgRowUser : s.msgRowAI]}>
                  {msg.role === "assistant" && (
                    <View style={s.msgAvatar}><Text style={{ fontSize: 14 }}>🤖</Text></View>
                  )}
                  <View style={[s.bubble, msg.role === "user" ? s.bubbleUser : s.bubbleAI]}>
                    <Text style={[s.bubbleText, msg.role === "user" ? s.bubbleTextUser : s.bubbleTextAI]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
              {loading && (
                <View style={[s.msgRow, s.msgRowAI]}>
                  <View style={s.msgAvatar}><Text style={{ fontSize: 14 }}>🤖</Text></View>
                  <View style={s.typingBubble}>
                    <ActivityIndicator size="small" color="#00FF9C" />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* ── Quick Prompts ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickRow} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 6, gap: 8 }}>
              {quickPrompts.map((q) => (
                <TouchableOpacity key={q} style={s.quickPill} onPress={() => setInput(q)}>
                  <Text style={s.quickPillText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Input ── */}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="اسأل عن البطولة / Ask about tournament..."
                placeholderTextColor="#475569"
                multiline
                maxLength={600}
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!input.trim() || loading}
              >
                <Text style={s.sendBtnText}>↑</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", flexDirection: "row" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  sidebar: {
    width: Math.min(width * 0.93, 430),
    height: "100%",
    backgroundColor: "#0f172a",
    borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.08)",
    marginLeft: "auto",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
    paddingTop: Platform.OS === "ios" ? 56 : 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(0,255,156,0.04)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  robotIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(0,255,156,0.12)", borderWidth: 1,
    borderColor: "rgba(0,255,156,0.25)", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00FF9C" },
  livePillText: { color: "#00FF9C", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#64748b", fontSize: 16, fontWeight: "700" },
  statsStrip: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)", maxHeight: 46 },
  statPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statPillText: { fontSize: 11, fontWeight: "700" },
  messages: { flex: 1 },
  msgRow: { flexDirection: "row", marginBottom: 10, alignItems: "flex-end" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAI: { justifyContent: "flex-start" },
  msgAvatar: {
    width: 30, height: 30, borderRadius: 10, marginRight: 8,
    backgroundColor: "rgba(0,255,156,0.1)", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: "#00FF9C", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 13, lineHeight: 20 },
  bubbleTextUser: { color: "#000", fontWeight: "600" },
  bubbleTextAI: { color: "#e2e8f0" },
  typingBubble: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  quickRow: { maxHeight: 46, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  quickPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  quickPillText: { color: "#64748b", fontSize: 10, fontWeight: "700" },
  inputRow: {
    flexDirection: "row", gap: 10, padding: 14,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    paddingBottom: Platform.OS === "ios" ? 34 : 14,
  },
  input: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    color: "#fff", fontSize: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    maxHeight: 100,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: "#00FF9C", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#000", fontSize: 22, fontWeight: "900" },
});