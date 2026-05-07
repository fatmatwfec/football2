import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Dimensions} from "react-native";

const { width, height } = Dimensions.get("window");

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_AI_KEY;

export default function AIChatModal({ visible, onClose, userData, teamData, nextMatch, userRank }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `أهلاً ${userData?.name || "لاعب"} 👋\nأنا مساعدك الرياضي الذكي!\n\nأقدر أساعدك في:\n⚡ نصائح تكتيكية\n💪 برامج تدريب\n🔥 تحفيز قبل المباريات\n📊 تحليل أدائك`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  useEffect(() => {
    if (userData?.name) {
      setMessages([{
        role: "assistant",
        content: `أهلاً ${userData.name} 👋\nأنا مساعدك الرياضي الذكي!\n\nأقدر أساعدك في:\n⚡ نصائح تكتيكية\n💪 برامج تدريب\n🔥 تحفيز قبل المباريات\n📊 تحليل أدائك`,
      }]);
    }
  }, [userData?.name]);

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

CRITICAL RULES:
- ALWAYS detect the language of the user's message and reply in the SAME language
- If the user writes in Arabic, reply in clear simple Arabic
- If the user writes in English, reply in English
- Keep responses practical, short, and well organized
- Be motivating and positive
- Use the player's real data in your responses
- Keep it friendly and simple`;

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
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openrouter/free",  
          messages: [
            { role: "system", content: systemPrompt },
            ...updatedMessages.filter((m) => m.content?.trim()),
          ],
          max_tokens: 2000,  // ✅ fixed from "00"
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const aiReply = data.choices?.[0]?.message?.content || "عذراً، لم يتمكن الذكاء الاصطناعي من الرد.";
      setMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ خطأ في الاتصال. تحقق من الإنترنت." },
      ]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    "نصيحة قبل المباراة 🔥",
    "Training tips 💪",
    "حلل أدائي 📊",
    "Motivate me 🌟",
    "كيف أتحسن؟ ⚡",
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.overlay}>
          <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
          <Animated.View style={[s.sheet, { opacity: fadeAnim }]}>

            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.robotIcon}>
                  <Text style={{ fontSize: 20 }}>🤖</Text>
                </View>
                <View>
                  <Text style={s.headerTitle}>AI Sports Assistant</Text>
                  <View style={s.livePill}>
                    <View style={s.liveDot} />
                    <Text style={s.livePillText}>AI POWERED</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── Stats Strip ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsStrip} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 6, gap: 6 }}>
              {userData?.position && (
                <View style={[s.statPill, { borderColor: "rgba(0,255,156,0.3)", backgroundColor: "rgba(0,255,156,0.08)" }]}>
                  <Text style={[s.statPillText, { color: "#00FF9C" }]}>{userData.position}</Text>
                </View>
              )}
              {(userData?.goals > 0) && (
                <View style={[s.statPill, { borderColor: "rgba(96,165,250,0.3)", backgroundColor: "rgba(96,165,250,0.08)" }]}>
                  <Text style={[s.statPillText, { color: "#60a5fa" }]}>⚽ {userData.goals} Goals</Text>
                </View>
              )}
              {userRank && (
                <View style={[s.statPill, { borderColor: "rgba(251,191,36,0.3)", backgroundColor: "rgba(251,191,36,0.08)" }]}>
                  <Text style={[s.statPillText, { color: "#fbbf24" }]}>Rank #{userRank}</Text>
                </View>
              )}
              {nextMatch && (
                <View style={[s.statPill, { borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)" }]}>
                  <Text style={[s.statPillText, { color: "#f87171" }]}>vs {nextMatch.opponentName}</Text>
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
                placeholder="اسألني أي شيء..."
                placeholderTextColor="#475569"
                multiline
                maxLength={500}
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
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    height: height * 0.88,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
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
  livePillText: { color: "#00FF9C", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
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
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: "#000", fontWeight: "600" },
  bubbleTextAI: { color: "#e2e8f0" },
  typingBubble: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  quickRow: { maxHeight: 46, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  quickPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  quickPillText: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  inputRow: {
    flexDirection: "row", gap: 10, padding: 14,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
  },
  input: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    maxHeight: 100,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: "#00FF9C", alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#000", fontSize: 22, fontWeight: "900" },
});