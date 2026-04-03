import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ImageBackground, TextInput
} from "react-native";
import { auth, db } from "../../firebase";
import {
  collection, onSnapshot, doc, updateDoc, addDoc,
  getDocs, deleteDoc, writeBatch, increment
} from "firebase/firestore";
import { signOut, updatePassword } from "firebase/auth";
import { useRouter } from "expo-router";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({ total: 0, pending: 0, free: 0, approved: 0 });
  const [pendingTeams, setPendingTeams] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [freeAgents, setFreeAgents] = useState([]);
  const [matches, setMatches] = useState([]);
  const [playersSubTab, setPlayersSubTab] = useState("free");
  const [isLocked, setIsLocked] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      const free = all.filter(u => (u.role === "student" || u.role === "player") && !u.hasTeam);
      setFreeAgents(free);
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
  };

  const handleReject = async (id) => {
    await updateDoc(doc(db, "teams", id), { status: "rejected" });
  };

  const handleManualVerify = async (playerId, playerName) => {
    Alert.alert("Activate", `Activate account for ${playerName}?`, [
      { text: "Cancel" },
      { text: "Yes", onPress: async () => {
        await updateDoc(doc(db, "users", playerId), { isVerified: true });
      }}
    ]);
  };

  const handleAutoBuild = async () => {
    if (freeAgents.length < 5) return Alert.alert("Need at least 5 free agents!");
    const selected = freeAgents.slice(0, 5);
    const teamName = `Elite-${Math.floor(Math.random() * 999)}`;
    try {
      const teamRef = await addDoc(collection(db, "teams"), {
        teamName, status: "approved",
        members: selected.map(p => p.name),
        memberIds: selected.map(p => p.id),
        createdAt: new Date()
      });
      for (let p of selected) {
        await updateDoc(doc(db, "users", p.id), {
          hasTeam: true, teamId: teamRef.id, assignedTeam: teamName
        });
      }
      Alert.alert(`✅ Team ${teamName} Created!`);
    } catch (e) { console.error(e); }
  };

  const handleRemoveFromTeam = async (player) => {
    Alert.alert("Remove", `Remove ${player.name} from their team?`, [
      { text: "Cancel" },
      { text: "Yes", onPress: async () => {
        await updateDoc(doc(db, "users", player.id), {
          hasTeam: false, teamId: "", assignedTeam: ""
        });
      }}
    ]);
  };

  const handleDeletePlayer = async (player) => {
    Alert.alert("Delete", `Delete ${player.name} permanently?`, [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteDoc(doc(db, "users", player.id));
      }}
    ]);
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return Alert.alert("Password must be at least 6 characters!");
    try {
      await updatePassword(auth.currentUser, newPassword);
      Alert.alert("✅ Password updated!");
      setNewPassword("");
    } catch (e) {
      Alert.alert("Error", "Please logout and login again first.");
    }
  };

  const handleGenerateBrackets = async () => {
    setIsGenerating(true);
    try {
      const teamsSnap = await getDocs(collection(db, "teams"));
      const allTeams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status === "approved");
      if (allTeams.length < 2) {
        Alert.alert("Need at least 2 approved teams!");
        setIsGenerating(false);
        return;
      }
      const shuffled = allTeams.sort(() => 0.5 - Math.random());
      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          await addDoc(collection(db, "matches"), {
            team1: shuffled[i].teamName, team2: shuffled[i + 1].teamName,
            status: "upcoming", round: "Knockout Stage", createdAt: new Date()
          });
        }
      }
      Alert.alert("✅ Tournament Brackets Generated!");
    } catch (e) { console.error(e); }
    setIsGenerating(false);
  };

  const handleResetSystem = async () => {
    Alert.alert("⚠️ WARNING", "This will wipe ALL Teams, Matches & reset Player stats!", [
      { text: "Cancel" },
      { text: "Reset", style: "destructive", onPress: async () => {
        setIsResetting(true);
        try {
          const batch = writeBatch(db);
          const teamsSnap = await getDocs(collection(db, "teams"));
          teamsSnap.docs.forEach(d => batch.delete(doc(db, "teams", d.id)));
          const matchesSnap = await getDocs(collection(db, "matches"));
          matchesSnap.docs.forEach(d => batch.delete(doc(db, "matches", d.id)));
          const usersSnap = await getDocs(collection(db, "users"));
          usersSnap.docs.forEach(d => batch.update(doc(db, "users", d.id), {
            goals: 0, yellowCards: 0, redCards: 0,
            hasTeam: false, teamId: "", assignedTeam: ""
          }));
          await batch.commit();
          Alert.alert("✅ System Reset Successfully!");
        } catch (e) { console.error(e); }
        setIsResetting(false);
      }}
    ]);
  };

  const getTeamStats = (teamName) => {
    let s = { points: 0, wins: 0, draws: 0, losses: 0, played: 0, goals: 0, yellowCards: 0, redCards: 0 };
    matches.filter(m => m.status === "completed").forEach(m => {
      if (m.team1 === teamName || m.team2 === teamName) {
        s.played++;
        const scores = m.score?.split('-').map(x => parseInt(x.trim())) || [0, 0];
        const isT1 = m.team1 === teamName;
        const mine = isT1 ? scores[0] : scores[1];
        const opp = isT1 ? scores[1] : scores[0];
        if (mine > opp) { s.wins++; s.points += 3; }
        else if (mine === opp) { s.draws++; s.points += 1; }
        else s.losses++;
      }
    });
    allUsers.filter(p => p.assignedTeam === teamName).forEach(p => {
      s.goals += (p.goals || 0);
      s.yellowCards += (p.yellowCards || 0);
      s.redCards += (p.redCards || 0);
    });
    return s;
  };

  const rankedTeams = approvedTeams
    .map(t => ({ ...t, stats: getTeamStats(t.teamName) }))
    .sort((a, b) => b.stats.points - a.stats.points);

  const topScorers = allUsers
    .filter(p => p.role !== 'admin')
    .sort((a, b) => (b.goals || 0) - (a.goals || 0))
    .slice(0, 5);

  const displayedPlayers = allUsers.filter(p => {
    const isPlayer = p.role === "student" || p.role === "player";
    return playersSubTab === "free" ? (isPlayer && !p.hasTeam) : (isPlayer && p.hasTeam);
  });

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000' }}
      style={styles.bg}
    >
      <View style={styles.overlay}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Text style={{ color: "#3b82f6", fontSize: 16 }}>⊞</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Admin Portal</Text>
              <Text style={styles.headerSub}>LEAGUE MANAGEMENT</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.newBtn}>
              <Text style={styles.newBtnText}>+ New</Text>
            </TouchableOpacity>
            <View style={styles.avatarCircle}>
              <Text style={{ color: "#fff" }}>👤</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>

          {/* ===== DASHBOARD ===== */}
          {activeTab === "dashboard" && (
            <View>
              <View style={styles.statsGrid}>
                <StatCard label="REGISTERED" value={stats.total} icon="👥" color="#3b82f6" trend="+12%" />
                <StatCard label="PENDING" value={stats.pending} icon="📅" color="#eab308" trend="+5%" />
                <StatCard label="FREE AGENTS" value={stats.free} icon="👤" color="#22c55e" trend="-2%" />
                <StatCard label="APPROVED" value={stats.approved} icon="✓" color="#a855f7" trend="+8%" />
              </View>

              <Text style={styles.sectionTitle}>Team Requests</Text>
              {pendingTeams.length === 0 && (
                <Text style={styles.emptyText}>No pending requests</Text>
              )}
              {pendingTeams.map(team => (
                <View key={team.id} style={styles.pendingCard}>
                  <View style={styles.teamAvatarBlue}>
                    <Text style={styles.teamAvatarText}>{team.teamName?.[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{team.teamName}</Text>
                    <Text style={styles.teamCapt}>Captain: {team.captainName}</Text>
                  </View>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(team.id)}>
                      <Text style={styles.approveBtnText}>✓ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(team.id)}>
                      <Text style={styles.rejectBtnText}>✕ Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ===== PLAYERS ===== */}
          {activeTab === "players" && (
            <View>
              <Text style={styles.pageTitleWithIcon}>🏃 Players Management</Text>
              <View style={styles.subTabRow}>
                <TouchableOpacity
                  style={[styles.subTab, playersSubTab === "free" && styles.subTabActive]}
                  onPress={() => setPlayersSubTab("free")}
                >
                  <Text style={[styles.subTabText, playersSubTab === "free" && styles.subTabTextActive]}>
                    FREE AGENTS ({freeAgents.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, playersSubTab === "team" && styles.subTabActive]}
                  onPress={() => setPlayersSubTab("team")}
                >
                  <Text style={[styles.subTabText, playersSubTab === "team" && styles.subTabTextActive]}>
                    IN TEAMS ({allUsers.filter(p => p.hasTeam).length})
                  </Text>
                </TouchableOpacity>
              </View>

              {displayedPlayers.length === 0 && (
                <Text style={styles.emptyText}>No players in this section.</Text>
              )}

              {displayedPlayers.map(p => (
                <View key={p.id} style={styles.playerCard}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerAvatarText}>{p.name?.[0]?.toUpperCase()}{p.name?.split(' ')[1]?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={styles.playerInfo}>ID: {p.studentCode}</Text>
                    {p.assignedTeam && (
                      <Text style={[styles.playerInfo, { color: "#3b82f6" }]}>TEAM: {p.assignedTeam}</Text>
                    )}
                    <View style={styles.passwordBox}>
                      <Text style={styles.passwordLabel}>🔑 PASSWORD</Text>
                      <Text style={styles.passwordValue}>{p.password || "No pass"}</Text>
                    </View>
                    {!p.isVerified ? (
                      <TouchableOpacity style={styles.activateBtn} onPress={() => handleManualVerify(p.id, p.name)}>
                        <Text style={styles.activateBtnText}>👤 MANUAL ACTIVATE</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.verifiedBtn}>
                        <Text style={styles.verifiedBtnText}>✓ ACCOUNT VERIFIED</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => p.hasTeam ? handleRemoveFromTeam(p) : handleDeletePlayer(p)}
                  >
                    <Text style={{ color: "#64748b", fontSize: 16 }}>{p.hasTeam ? "👤−" : "🗑"}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {playersSubTab === "free" && (
                <TouchableOpacity style={styles.createSquadBtn} onPress={handleAutoBuild}>
                  <Text style={styles.createSquadText}>✨ CREATE CUSTOM SQUAD</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ===== TEAMS ===== */}
          {activeTab === "teams" && (
            <View>
              <Text style={styles.pageTitleWithIcon}>🛡 Tournament Teams</Text>
              <Text style={styles.pageSubTitle}>FINALIZE ROSTERS AND MANAGE TEAM MEMBERS</Text>
              {approvedTeams.map(team => (
                <View key={team.id} style={styles.teamCard}>
                  <View style={styles.teamCardHeader}>
                    <View style={styles.teamAvatarGreen}>
                      <Text style={styles.teamAvatarGreenText}>{team.teamName?.[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{team.teamName}</Text>
                      <Text style={[styles.teamCapt, { color: "#10b981" }]}>VERIFIED SQUAD</Text>
                    </View>
                    <TouchableOpacity>
                      <Text style={{ color: "#475569" }}>🗑</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.squadHeader}>
                    <Text style={styles.squadLabel}>SQUAD MEMBERS</Text>
                    <Text style={styles.squadCount}>{(team.members || []).length} / 7</Text>
                  </View>

                  {(team.members || []).map((member, i) => (
                    <View key={i} style={styles.memberRow}>
                      <View style={styles.memberDot} />
                      <Text style={styles.memberName}>{member}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* ===== LEADERBOARD ===== */}
          {activeTab === "leaderboard" && (
            <View>
              <Text style={styles.leaderboardTitle}>🏆 TOURNAMENT STANDINGS</Text>
              <View style={styles.leaderboardGrid}>

                {/* Top Scorers */}
                <View style={styles.leaderCard}>
                  <Text style={styles.leaderCardTitle}>⚽ Top Scorers</Text>
                  {topScorers.map(p => (
                    <View key={p.id} style={styles.leaderRow}>
                      <Text style={styles.leaderName}>{p.name}</Text>
                      <Text style={styles.leaderGoals}>{p.goals || 0} Goals</Text>
                    </View>
                  ))}
                </View>

                {/* Elite Teams */}
                <View style={styles.leaderCard}>
                  <Text style={styles.leaderCardTitle}>🥇 Elite Teams</Text>
                  {rankedTeams.map((team, index) => (
                    <View key={team.id} style={styles.eliteTeamCard}>
                      <View style={styles.eliteTeamHeader}>
                        <Text style={styles.eliteTeamName}>{index + 1}. {team.teamName}</Text>
                        <Text style={styles.eliteTeamPts}>{team.stats.points} PTS</Text>
                      </View>
                      <View style={styles.eliteTeamStats}>
                        <Text style={styles.eliteTeamStat}>W: {team.stats.wins}</Text>
                        <Text style={styles.eliteTeamStat}>D: {team.stats.draws}</Text>
                        <Text style={styles.eliteTeamStat}>L: {team.stats.losses}</Text>
                        <Text style={styles.eliteTeamStat}>P: {team.stats.played}</Text>
                      </View>
                      <View style={styles.eliteTeamCards}>
                        <Text style={styles.eliteTeamCardStat}>⚽ {team.stats.goals} G</Text>
                        <Text style={styles.eliteTeamCardStat}>🟨 {team.stats.yellowCards} YC</Text>
                        <Text style={styles.eliteTeamCardStat}>🟥 {team.stats.redCards} RC</Text>
                      </View>
                    </View>
                  ))}
                </View>

              </View>
            </View>
          )}

          {/* ===== MATCHES ===== */}
          {activeTab === "matches" && (
            <View>
              <View style={styles.matchesHeader}>
                <Text style={styles.pageTitleWithIcon}>🏆 Match Center</Text>
                <TouchableOpacity style={styles.newMatchBtn}>
                  <Text style={styles.newMatchBtnText}>NEW MATCH</Text>
                </TouchableOpacity>
              </View>
              {matches.map(m => (
                <View key={m.id} style={[styles.matchCard, { borderLeftColor: m.status === "completed" ? "#22c55e" : "#3b82f6" }]}>
                  <View style={styles.matchTeamsRow}>
                    <Text style={styles.matchTeamName}>{m.team1}</Text>
                    <View style={styles.matchScoreBox}>
                      <Text style={styles.matchScoreText}>{m.score || "VS"}</Text>
                    </View>
                    <Text style={styles.matchTeamName}>{m.team2}</Text>
                  </View>
                  <View style={styles.matchFooter}>
                    <View style={[styles.matchStatusBadge, { backgroundColor: m.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)" }]}>
                      <Text style={{ color: m.status === "completed" ? "#22c55e" : "#60a5fa", fontSize: 11, fontWeight: "bold" }}>
                        {m.status?.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.deleteMatchBtn}>
                      <Text style={{ color: "#ef4444" }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ===== SETTINGS ===== */}
          {activeTab === "settings" && (
            <View>
              <Text style={styles.pageTitleWithIcon}>👤 Admin Control Room</Text>

              {/* Admin Security */}
              <View style={styles.settingCard}>
                <Text style={styles.settingCardTitle}>🔑 Admin Security</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter New Password"
                    placeholderTextColor="#475569"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity style={styles.updateBtn} onPress={handleUpdatePassword}>
                    <Text style={styles.updateBtnText}>💾 Update</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Generate Brackets */}
              <TouchableOpacity style={styles.settingCard} onPress={handleGenerateBrackets}>
                <View style={styles.settingCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingCardTitle, { color: "#3b82f6" }]}>Generate Tournament Brackets</Text>
                    <Text style={styles.settingCardSub}>RANDOMIZED MATCH ALLOCATION</Text>
                  </View>
                  <View style={styles.settingIconBlue}>
                    <Text style={{ color: "#3b82f6" }}>{isGenerating ? "⏳" : "🗂"}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Registration Lock */}
              <View style={styles.settingCard}>
                <View style={styles.settingCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingCardTitle}>Registration Lock</Text>
                    <Text style={styles.settingCardSub}>FREEZE ALL ENTRIES</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.lockBtn, { backgroundColor: isLocked ? "#ef4444" : "#22c55e" }]}
                    onPress={() => setIsLocked(!isLocked)}
                  >
                    <Text style={{ color: "#fff", fontSize: 18 }}>{isLocked ? "🔒" : "🔓"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reset Tournament */}
              <TouchableOpacity style={styles.settingCard} onPress={handleResetSystem}>
                <View style={styles.settingCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingCardTitle}>Reset Tournament</Text>
                    <Text style={[styles.settingCardSub, { color: "#ef4444" }]}>CLEAR ALL DATA & RESET STATS</Text>
                  </View>
                  <View style={styles.settingIconRed}>
                    <Text style={{ color: "#ef4444" }}>{isResetting ? "⏳" : "🗄"}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Exit */}
              <TouchableOpacity style={[styles.settingCard, { marginTop: 8 }]} onPress={() => signOut(auth)}>
                <View style={styles.settingCardRow}>
                  <Text style={[styles.settingCardTitle, { color: "#ef4444" }]}>EXIT ADMIN SESSION</Text>
                  <View style={styles.settingIconRed}>
                    <Text style={{ color: "#ef4444" }}>🚪</Text>
                  </View>
                </View>
              </TouchableOpacity>

            </View>
          )}

        </ScrollView>

        {/* Bottom Nav */}
        <View style={styles.bottomNav}>
          <NavBtn icon="⊞" label="HOME" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
          <NavBtn icon="👤+" label="PLAYERS" active={activeTab === "players"} onPress={() => setActiveTab("players")} />
          <NavBtn icon="🛡" label="TEAMS" active={activeTab === "teams"} onPress={() => setActiveTab("teams")} />
          <NavBtn icon="🏆" label="RANK" active={activeTab === "leaderboard"} onPress={() => setActiveTab("leaderboard")} />
          <NavBtn icon="📅" label="MATCHES" active={activeTab === "matches"} onPress={() => setActiveTab("matches")} />
          <NavBtn icon="⚙️" label="SETTINGS" active={activeTab === "settings"} onPress={() => setActiveTab("settings")} />
        </View>
      </View>
    </ImageBackground>
  );
}

// ===== SUB COMPONENTS =====
const StatCard = ({ label, value, icon, color, trend }) => (
  <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={[styles.statIcon, { color }]}>{icon}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statBottom}>
      <Text style={[styles.statValue, { color: "#fff" }]}>{value}</Text>
      <Text style={styles.statTrend}>{trend}</Text>
    </View>
  </View>
);

const NavBtn = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={styles.navBtn} onPress={onPress}>
    <Text style={{ fontSize: 18 }}>{icon}</Text>
    <Text style={[styles.navLabel, { color: active ? "#3b82f6" : "#64748b" }]}>{label}</Text>
  </TouchableOpacity>
);

// ===== STYLES =====
const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.92)" },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1, borderColor: "rgba(59,130,246,0.3)",
    justifyContent: "center", alignItems: "center"
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  headerSub: { color: "#64748b", fontSize: 9, letterSpacing: 1, marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  newBtn: {
    backgroundColor: "rgba(59,130,246,0.3)", paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 12
  },
  newBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2, borderColor: "#3b82f6",
    backgroundColor: "#1e293b", justifyContent: "center", alignItems: "center"
  },

  // Content
  content: { flex: 1, padding: 16 },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statLabel: { color: "#94a3b8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  statBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 },
  statValue: { fontSize: 28, fontWeight: "bold" },
  statTrend: { color: "#a3e635", fontSize: 11, fontWeight: "bold" },

  // Section
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 12, marginTop: 4 },
  pageTitleWithIcon: { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  pageSubTitle: { color: "#64748b", fontSize: 10, letterSpacing: 1, marginBottom: 16 },
  emptyText: { color: "#475569", fontStyle: "italic", textAlign: "center", padding: 30 },

  // Pending Team Card
  pendingCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderLeftWidth: 4, borderLeftColor: "#3b82f6"
  },
  teamAvatarBlue: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.2)", justifyContent: "center",
    alignItems: "center", marginBottom: 10
  },
  teamAvatarText: { color: "#60a5fa", fontSize: 22, fontWeight: "bold" },
  teamName: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  teamCapt: { color: "#94a3b8", fontSize: 12, fontStyle: "italic", marginTop: 2 },
  actionBtns: { flexDirection: "row", gap: 8, marginTop: 12 },
  approveBtn: {
    flex: 1, backgroundColor: "#3b82f6", borderRadius: 12,
    paddingVertical: 12, alignItems: "center"
  },
  approveBtnText: { color: "#fff", fontWeight: "bold" },
  rejectBtn: {
    flex: 1, backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)"
  },
  rejectBtnText: { color: "#f87171", fontWeight: "bold" },

  // Players
  subTabRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  subTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  },
  subTabActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  subTabText: { color: "#64748b", fontWeight: "bold", fontSize: 11 },
  subTabTextActive: { color: "#fff" },
  playerCard: {
    flexDirection: "row", gap: 12, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  playerAvatar: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: "#1e3a5f", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#3b82f6"
  },
  playerAvatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  playerName: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  playerInfo: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  passwordBox: {
    backgroundColor: "#0f172a", borderRadius: 10, padding: 8, marginTop: 8
  },
  passwordLabel: { color: "#64748b", fontSize: 9, fontWeight: "bold" },
  passwordValue: { color: "#eab308", fontSize: 12, fontStyle: "italic", fontWeight: "bold" },
  activateBtn: {
    backgroundColor: "#ea580c", borderRadius: 10, padding: 8,
    alignItems: "center", marginTop: 8
  },
  activateBtnText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  verifiedBtn: {
    backgroundColor: "rgba(59,130,246,0.1)", borderRadius: 10, padding: 8,
    alignItems: "center", marginTop: 8,
    borderWidth: 1, borderColor: "rgba(59,130,246,0.2)"
  },
  verifiedBtnText: { color: "#3b82f6", fontSize: 10, fontWeight: "bold" },
  deleteBtn: { padding: 4 },
  createSquadBtn: {
    backgroundColor: "#a3e635", borderRadius: 16, padding: 16,
    alignItems: "center", marginTop: 16
  },
  createSquadText: { color: "#0f172a", fontWeight: "bold", fontSize: 14 },

  // Teams
  teamCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  teamCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  teamAvatarGreen: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: "rgba(16,185,129,0.2)", justifyContent: "center", alignItems: "center"
  },
  teamAvatarGreenText: { color: "#10b981", fontSize: 22, fontWeight: "bold" },
  squadHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  squadLabel: { color: "#64748b", fontSize: 10, fontWeight: "bold", letterSpacing: 1 },
  squadCount: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(15,23,42,0.5)", borderRadius: 12,
    padding: 12, marginBottom: 6
  },
  memberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981" },
  memberName: { color: "#e2e8f0", fontWeight: "600", fontSize: 13 },

  // Leaderboard
  leaderboardTitle: {
    color: "#eab308", fontSize: 22, fontWeight: "bold",
    textAlign: "center", marginBottom: 20
  },
  leaderboardGrid: { gap: 16 },
  leaderCard: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 24, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  leaderCardTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  leaderRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#0f172a", borderRadius: 12,
    padding: 12, marginBottom: 6
  },
  leaderName: { color: "#fff", fontWeight: "bold" },
  leaderGoals: { color: "#22c55e", fontWeight: "bold" },
  eliteTeamCard: {
    backgroundColor: "#0f172a", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  eliteTeamHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  eliteTeamName: { color: "#fff", fontWeight: "bold" },
  eliteTeamPts: { color: "#3b82f6", fontWeight: "bold" },
  eliteTeamStats: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
    padding: 8, marginBottom: 8
  },
  eliteTeamStat: { color: "#94a3b8", fontSize: 11, fontWeight: "bold" },
  eliteTeamCards: { flexDirection: "row", gap: 16 },
  eliteTeamCardStat: { color: "#64748b", fontSize: 11 },

  // Matches
  matchesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  newMatchBtn: { backgroundColor: "#3b82f6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  newMatchBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  matchCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16,
    marginBottom: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  matchTeamsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  matchTeamName: { color: "#fff", fontWeight: "bold", flex: 1, textAlign: "center" },
  matchScoreBox: { backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  matchScoreText: { color: "#60a5fa", fontWeight: "bold", fontSize: 18 },
  matchFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  matchStatusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  deleteMatchBtn: { padding: 8 },

  // Settings
  settingCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  settingCardTitle: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  settingCardSub: { color: "#64748b", fontSize: 10, letterSpacing: 1, marginTop: 4 },
  settingCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  passwordRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  passwordInput: {
    flex: 1, backgroundColor: "#0f172a", borderRadius: 12, padding: 12,
    color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  },
  updateBtn: { backgroundColor: "#3b82f6", borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" },
  updateBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  lockBtn: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  settingIconBlue: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.2)", justifyContent: "center", alignItems: "center"
  },
  settingIconRed: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.2)", justifyContent: "center", alignItems: "center"
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: "rgba(10,16,28,0.97)", borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)", paddingBottom: 28, paddingTop: 12
  },
  navBtn: { alignItems: "center", gap: 3 },
  navLabel: { fontSize: 8, fontWeight: "bold" },
});