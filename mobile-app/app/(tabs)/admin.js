import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, ImageBackground, Alert
} from "react-native";
import { auth, db } from "../../firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({ total: 0, pending: 0, free: 0, approved: 0 });
  const [pendingTeams, setPendingTeams] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      const free = all.filter(u => (u.role === "student") && !u.hasTeam);
      setStats(prev => ({ ...prev, total: all.length, free: free.length }));
    });
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pending = all.filter(t => t.status === "pending");
      const approved = all.filter(t => t.status === "approved");
      setPendingTeams(pending);
      setApprovedTeams(approved);
      setStats(prev => ({ ...prev, pending: pending.length, approved: approved.length }));
    });
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubTeams(); unsubMatches(); };
  }, []);

  const handleApprove = async (id) => {
    await updateDoc(doc(db, "teams", id), { status: "approved" });
    Alert.alert("✅ Team Approved!");
  };

  const handleReject = async (id) => {
    await updateDoc(doc(db, "teams", id), { status: "rejected" });
    Alert.alert("❌ Team Rejected!");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <TouchableOpacity onPress={() => signOut(auth)} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === "dashboard" && (
          <View>
            {/* Stats */}
            <View style={styles.statsGrid}>
              <StatCard label="Registered" value={stats.total} color="#3b82f6" />
              <StatCard label="Pending" value={stats.pending} color="#eab308" />
              <StatCard label="Free Agents" value={stats.free} color="#22c55e" />
              <StatCard label="Approved" value={stats.approved} color="#a855f7" />
            </View>

            {/* Pending Teams */}
            <Text style={styles.sectionTitle}>Team Requests</Text>
            {pendingTeams.length === 0 && (
              <Text style={styles.emptyText}>No pending requests</Text>
            )}
            {pendingTeams.map(team => (
              <View key={team.id} style={styles.teamCard}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamAvatarText}>{team.teamName?.[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{team.teamName}</Text>
                  <Text style={styles.teamCapt}>Captain: {team.captainName}</Text>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(team.id)}>
                    <Text style={styles.approveBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(team.id)}>
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "players" && (
          <View>
            <Text style={styles.sectionTitle}>All Players</Text>
            {allUsers.filter(u => u.role === "student").map(p => (
              <View key={p.id} style={styles.playerCard}>
                <View style={styles.playerAvatar}>
                  <Text style={styles.playerAvatarText}>{p.name?.[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <Text style={styles.playerInfo}>ID: {p.studentCode}</Text>
                  <Text style={[styles.playerInfo, { color: p.hasTeam ? "#22c55e" : "#f97316" }]}>
                    {p.hasTeam ? `Team: ${p.assignedTeam}` : "Free Agent"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "teams" && (
          <View>
            <Text style={styles.sectionTitle}>Approved Teams ({approvedTeams.length})</Text>
            {approvedTeams.map(team => (
              <View key={team.id} style={styles.teamCard}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamAvatarText}>{team.teamName?.[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{team.teamName}</Text>
                  <Text style={styles.teamCapt}>
                    {(team.members || []).length} Players
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: "rgba(34,197,94,0.2)" }]}>
                  <Text style={{ color: "#22c55e", fontSize: 10, fontWeight: "bold" }}>APPROVED</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "matches" && (
          <View>
            <Text style={styles.sectionTitle}>Matches ({matches.length})</Text>
            {matches.map(m => (
              <View key={m.id} style={[styles.matchCard, { borderLeftColor: m.status === "completed" ? "#22c55e" : "#3b82f6" }]}>
                <View style={styles.matchTeams}>
                  <Text style={styles.matchTeamName}>{m.team1}</Text>
                  <View style={styles.matchScore}>
                    <Text style={styles.matchScoreText}>{m.score || "VS"}</Text>
                  </View>
                  <Text style={styles.matchTeamName}>{m.team2}</Text>
                </View>
                <Text style={styles.matchInfo}>{m.date} {m.time && `· ${m.time}`}</Text>
                <View style={[styles.matchStatus, { backgroundColor: m.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)" }]}>
                  <Text style={{ color: m.status === "completed" ? "#22c55e" : "#60a5fa", fontSize: 10, fontWeight: "bold" }}>
                    {m.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <NavBtn icon="⊞" label="Home" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
        <NavBtn icon="👥" label="Players" active={activeTab === "players"} onPress={() => setActiveTab("players")} />
        <NavBtn icon="🛡" label="Teams" active={activeTab === "teams"} onPress={() => setActiveTab("teams")} />
        <NavBtn icon="⚽" label="Matches" active={activeTab === "matches"} onPress={() => setActiveTab("matches")} />
      </View>
    </View>
  );
}

const StatCard = ({ label, value, color }) => (
  <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const NavBtn = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={styles.navBtn} onPress={onPress}>
    <Text style={{ fontSize: 20 }}>{icon}</Text>
    <Text style={[styles.navLabel, { color: active ? "#3b82f6" : "#64748b" }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingTop: 50, backgroundColor: "rgba(255,255,255,0.03)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)"
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  logoutBtn: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  logoutText: { color: "#f87171", fontWeight: "600" },
  content: { flex: 1, padding: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  },
  statValue: { fontSize: 28, fontWeight: "bold" },
  statLabel: { color: "#94a3b8", fontSize: 11, marginTop: 4, textTransform: "uppercase" },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 12, marginTop: 8 },
  emptyText: { color: "#475569", fontStyle: "italic", textAlign: "center", padding: 20 },
  teamCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  },
  teamAvatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.2)", justifyContent: "center", alignItems: "center"
  },
  teamAvatarText: { color: "#60a5fa", fontSize: 20, fontWeight: "bold" },
  teamName: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  teamCapt: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  actionBtns: { flexDirection: "row", gap: 8 },
  approveBtn: { backgroundColor: "#3b82f6", width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  approveBtnText: { color: "#fff", fontWeight: "bold" },
  rejectBtn: { backgroundColor: "rgba(239,68,68,0.2)", width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rejectBtnText: { color: "#f87171", fontWeight: "bold" },
  playerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20,
    padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  playerAvatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(99,102,241,0.2)", justifyContent: "center", alignItems: "center"
  },
  playerAvatarText: { color: "#818cf8", fontSize: 18, fontWeight: "bold" },
  playerName: { color: "#fff", fontWeight: "bold" },
  playerInfo: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  matchCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16,
    marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  matchTeams: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  matchTeamName: { color: "#fff", fontWeight: "bold", flex: 1, textAlign: "center" },
  matchScore: { backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10 },
  matchScoreText: { color: "#60a5fa", fontWeight: "bold", fontSize: 16 },
  matchInfo: { color: "#64748b", fontSize: 11, textAlign: "center", marginBottom: 8 },
  matchStatus: { alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bottomNav: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: "rgba(15,23,42,0.95)", borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)", paddingBottom: 24, paddingTop: 12
  },
  navBtn: { alignItems: "center", gap: 4 },
  navLabel: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },
});