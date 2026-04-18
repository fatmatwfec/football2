import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ImageBackground, TextInput, Modal, ActivityIndicator,
  FlatList, Dimensions
} from "react-native";
import { auth, db } from "../../firebase";
import {
  collection, onSnapshot, doc, updateDoc, addDoc,
  getDocs, deleteDoc, writeBatch, getDoc, serverTimestamp, setDoc
} from "firebase/firestore";
import { signOut, updatePassword, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

// ─── Helpers ───────────────────────────────────────────────────
const getRoundLabel = (roundIndex, totalRounds) => {
   if (roundIndex === 0) return "ROUND 1";
  if (roundIndex === 1) return "ROUND 2";
  if (roundIndex === 2) return "SEMI FINAL";
  if (roundIndex === 3) return "FINAL";
  return `ROUND ${roundIndex + 1}`;
};

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ─── Main Component ────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({ total: 0, pending: 0, free: 0, approved: 0 });
  const [pendingTeams, setPendingTeams] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [activeClick, setActiveClick] = useState("live");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalView, setAddModalView] = useState("options"); // options | teamForm | matchForm
  const [newTeamName, setNewTeamName] = useState("");
  const [newCaptainName, setNewCaptainName] = useState("");
  const [newMatchTeam1, setNewMatchTeam1] = useState(null);
  const [newMatchTeam2, setNewMatchTeam2] = useState(null);
  const [newMatchDate, setNewMatchDate] = useState("");
  const [newMatchTime, setNewMatchTime] = useState("");
  const [newMatchPitch, setNewMatchPitch] = useState("Main Pitch");
  const [selectedFreeAgents, setSelectedFreeAgents] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Result modal
  const [resultMatch, setResultMatch] = useState(null);
  const [score1, setScore1] = useState("0");
  const [score2, setScore2] = useState("0");
  const [pen1, setPen1] = useState("0");
  const [pen2, setPen2] = useState("0");
  const [playerStats, setPlayerStats] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settings
  const [newPassword, setNewPassword] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Players sub-tab
  const [playersSubTab, setPlayersSubTab] = useState("free");
  const [searchTerm, setSearchTerm] = useState("");

  // Build squad modal
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [buildTeamName, setBuildTeamName] = useState("");
  const [buildCount, setBuildCount] = useState(5);
  const [isBuilding, setIsBuilding] = useState(false);

  // Member detail modal
  const [memberModal, setMemberModal] = useState(null);

  const router = useRouter();

  // ─── Auth guard ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/(auth)/login"); return; }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists() || snap.data().role !== "admin") {
        router.replace("/(tabs)");
      }
    });
    return unsub;
  }, []);

  // ─── Firestore listeners ────────────────────────────────────
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      setStats(prev => ({
        ...prev,
        total: all.length,
        free: all.filter(u => !u.hasTeam && u.role !== "admin").length,
      }));
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

    const unsubTournament = onSnapshot(doc(db, "tournaments", "main"), (snap) => {
      setTournament(snap.exists() ? snap.data() : null);
    });

    return () => { unsubUsers(); unsubTeams(); unsubMatches(); unsubTournament(); };
  }, []);

  // ─── Derived data ────────────────────────────────────────────
  const players = allUsers.filter(u => u.role !== "admin");
  const freeAgents = players.filter(p => !p.hasTeam);
  const now = Date.now();

const liveMatches = matches.filter(m => {
  if (!m.startTime) return false;

  const start = m.startTime;

  const isInTimeWindow =
    now >= start &&
    now <= start + 2 * 60 * 60 * 1000;

  const notFinished = m.status !== "completed";

  return isInTimeWindow && notFinished;
});
 const scheduledMatches = matches.filter(m =>
  m.status === "scheduled" &&
  m.startTime > Date.now()
);
  const completedMatches = matches.filter(m => (m.status || "").toLowerCase() === "completed");

  const topScorers = [...players]
    .sort((a, b) => (b.goals || 0) - (a.goals || 0))
    .slice(0, 5);

  const getTeamStats = (teamName) => {
    let s = { points: 0, wins: 0, draws: 0, losses: 0, played: 0, goals: 0, yellowCards: 0, redCards: 0 };
    completedMatches.forEach(m => {
      if (m.team1Name === teamName || m.team2Name === teamName || m.team1 === teamName || m.team2 === teamName) {
        s.played++;
        const scores = (m.score || "0-0").split("-").map(x => parseInt(x.trim()) || 0);
        const isT1 = m.team1Name === teamName || m.team1 === teamName;
        const mine = isT1 ? scores[0] : scores[1];
        const opp = isT1 ? scores[1] : scores[0];
        if (mine > opp) { s.wins++; s.points += 3; }
        else if (mine === opp) { s.draws++; s.points += 1; }
        else s.losses++;
      }
    });
    players.filter(p => p.assignedTeam === teamName).forEach(p => {
      s.goals += (p.goals || 0);
      s.yellowCards += (p.yellowCards || 0);
      s.redCards += (p.redCards || 0);
    });
    return s;
  };

  const rankedTeams = approvedTeams
    .map(t => ({ ...t, stats: getTeamStats(t.teamName) }))
    .sort((a, b) => b.stats.points - a.stats.points);

  // ─── Tournament draw ─────────────────────────────────────────
const handleGenerateDraw = async () => {
  try {
    if (!approvedTeams || approvedTeams.length < 2) {
      Alert.alert("Need at least 2 teams");
      return;
    }
    setIsGenerating(true);

    const shuffled = [...approvedTeams].sort(() => Math.random() - 0.5);
    const totalRounds = Math.ceil(Math.log2(shuffled.length));

    // Build empty bracket
    const rounds = {};
    for (let r = 0; r < totalRounds; r++) {
      const matchesCount = Math.pow(2, totalRounds - r - 1);
      rounds[r] = Array.from({ length: matchesCount }, (_, i) => ({
        id: `${r}-${i}`,
        round: r,
        matchIndex: i,
        team1Id: null,
        team2Id: null,
        team1Name: null,
        team2Name: null,
        winner: null,
      }));
    }

    // ✅ FIX: assign directly by index, no .push()
    let idx = 0;
    for (let i = 0; i < shuffled.length; i += 2) {
      if (rounds[0][idx] && shuffled[i + 1]) {
        rounds[0][idx] = {
          ...rounds[0][idx],
          team1Id: shuffled[i].id,
          team1Name: shuffled[i].teamName,
          team2Id: shuffled[i + 1].id,
          team2Name: shuffled[i + 1].teamName,
        };
      } else if (rounds[0][idx] && !shuffled[i + 1]) {
        // Odd team out → BYE
        rounds[0][idx] = {
          ...rounds[0][idx],
          team1Id: shuffled[i].id,
          team1Name: shuffled[i].teamName,
          isBye: true,
          winner: shuffled[i].teamName, // auto-advance
        };
      }
      idx++;
    }

    await setDoc(doc(db, "tournaments", "main"), {
      rounds,
      createdAt: serverTimestamp(),
    });

    // Create Firestore match docs only for real (non-BYE) Round 0 matches
    for (const m of rounds[0]) {
      if (m.team1Id && m.team2Id && !m.isBye) {
        await addDoc(collection(db, "matches"), {
          team1Id: m.team1Id,
          team1Name: m.team1Name,
          team2Id: m.team2Id,
          team2Name: m.team2Name,
          round: m.round,
          matchIndex: m.matchIndex,
          status: "scheduled",
          score: null,
          createdAt: serverTimestamp(),
        });
      }
    }

    Alert.alert("✅ Tournament started (Round 1 generated)");
  } catch (e) {
    console.error(e);
    Alert.alert("Error generating draw");
  } finally {
    setIsGenerating(false);
  }
};

const getWinner = (match) => {
  const [s1, s2] = (match.score || "0-0").split("-").map(Number);

  if (s1 > s2) return {
    id: match.team1Id,
    name: match.team1Name
  };

  if (s2 > s1) return {
    id: match.team2Id,
    name: match.team2Name
  };

  
  if (match.penalties) {
    const [p1, p2] = match.penalties.split("-").map(Number);
    return p1 > p2
      ? { id: match.team1Id, name: match.team1Name }
      : { id: match.team2Id, name: match.team2Name };
  }

  return null;
};

  // ─── Team actions ────────────────────────────────────────────
  const handleApprove = async (id) => {
    await updateDoc(doc(db, "teams", id), { status: "approved" });
    Alert.alert("✅ Team Approved!");
  };

  const handleRejectTeam = async (team) => {
    Alert.alert("Reject Team", `Reject ${team.teamName}?`, [
      { text: "Cancel" },
      {
        text: "Reject", style: "destructive", onPress: async () => {
          const batch = writeBatch(db);
          (team.memberIds || []).forEach(id => {
            batch.update(doc(db, "users", id), { hasTeam: false, teamId: null, assignedTeam: null });
          });
          batch.delete(doc(db, "teams", team.id));
          await batch.commit();
        }
      }
    ]);
  };

  const handleDeleteTeam = async (team) => {
    Alert.alert("Delete Team", `Delete ${team.teamName}?`, [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          const batch = writeBatch(db);
          (team.memberIds || []).forEach(id => {
            batch.update(doc(db, "users", id), { hasTeam: false, teamId: null, assignedTeam: null });
          });
          batch.delete(doc(db, "teams", team.id));
          await batch.commit();
        }
      }
    ]);
  };

  // ─── Player actions ──────────────────────────────────────────
  const handleManualVerify = async (player) => {
    Alert.alert("Activate", `Activate account for ${player.name}?`, [
      { text: "Cancel" },
      {
        text: "Yes", onPress: async () => {
          await updateDoc(doc(db, "users", player.id), { isVerified: true });
        }
      }
    ]);
  };

  const handleRemoveFromTeam = async (player) => {
    Alert.alert("Remove", `Remove ${player.name} from team?`, [
      { text: "Cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          await updateDoc(doc(db, "users", player.id), { hasTeam: false, teamId: null, assignedTeam: null });
        }
      }
    ]);
  };

  const handleDeletePlayer = async (player) => {
    Alert.alert("Delete", `Delete ${player.name} permanently?`, [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "users", player.id));
        }
      }
    ]);
  };

  // ─── Add Team (modal) ────────────────────────────────────────
  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !newCaptainName.trim()) {
      Alert.alert("Enter team name and captain name");
      return;
    }
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const teamRef = doc(collection(db, "teams"));
      const members = selectedFreeAgents.map(p => p.name);
      const memberIds = selectedFreeAgents.map(p => p.id);
      batch.set(teamRef, {
        teamName: newTeamName.trim(),
        captainName: newCaptainName.trim(),
        status: "approved",
        members,
        memberIds,
        createdAt: new Date(),
      });
      selectedFreeAgents.forEach(p => {
        batch.update(doc(db, "users", p.id), {
          hasTeam: true,
          teamId: teamRef.id,
          assignedTeam: newTeamName.trim(),
        });
      });
      await batch.commit();
      Alert.alert("✅ Team Created!");
      setShowAddModal(false);
      setNewTeamName(""); setNewCaptainName(""); setSelectedFreeAgents([]);
    } catch (e) { console.error(e); Alert.alert("Error creating team"); }
    setIsSaving(false);
  };

  // ─── Add Match (modal) ───────────────────────────────────────
  const handleCreateMatch = async () => {
    if (!newMatchTeam1 || !newMatchTeam2) {
      Alert.alert("Select both teams");
      return;
    }
    if (newMatchTeam1.id === newMatchTeam2.id) {
      Alert.alert("Select different teams");
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db, "matches"), {
        team1Id: newMatchTeam1.id,
        team1Name: newMatchTeam1.teamName,
        team2Id: newMatchTeam2.id,
        team2Name: newMatchTeam2.teamName,
        date: newMatchDate,
        time: newMatchTime,
        startTime: new Date(`${newMatchDate} ${newMatchTime}`).getTime(),
        pitch: newMatchPitch,
        status: "scheduled",
        score: null,
        createdAt: new Date(),
      });
      Alert.alert("✅ Match Scheduled!");
      setShowAddModal(false);
      setNewMatchTeam1(null); setNewMatchTeam2(null);
      setNewMatchDate(""); setNewMatchTime("");
    } catch (e) { console.error(e); Alert.alert("Error scheduling match"); }
    setIsSaving(false);
  };

  // ─── Result modal ────────────────────────────────────────────
  const openResultModal = async (match) => {
    // Set to live
    
    const matchPlayers = players.filter(
      p => p.teamId === match.team1Id || p.teamId === match.team2Id
    );
    const initial = {};
    matchPlayers.forEach(p => { initial[p.id] = { goals: "0", yellow: "0", red: "0" }; });
    setPlayerStats(initial);
    setScore1("0"); setScore2("0"); setPen1("0"); setPen2("0");
    setResultMatch(match);
  };

  const handleFinalizeMatch = async () => {
    if (!resultMatch) return;
    setIsSubmitting(true);
    try {
      const s1 = parseInt(score1) || 0;
      const s2 = parseInt(score2) || 0;
      const isDraw = s1 === s2;
      const p1 = parseInt(pen1) || 0;
      const p2 = parseInt(pen2) || 0;

      const batch = writeBatch(db);
      const statsSnapshot = {};

      for (const [pid, stats] of Object.entries(playerStats)) {
        const g = parseInt(stats.goals) || 0;
        const y = parseInt(stats.yellow) || 0;
        const r = parseInt(stats.red) || 0;
        const player = players.find(p => p.id === pid);
        if (!player) continue;

        statsSnapshot[pid] = { name: player.name, goals: g, yellow: y, red: r };

        batch.update(doc(db, "users", pid), {
          goals: (player.goals || 0) + g,
          yellowCards: (player.yellowCards || 0) + y,
          redCards: (player.redCards || 0) + r,
          suspendedForNextMatch: r > 0 || (player.yellowCards || 0) + y >= 2,
        });
      }

      const penStr = isDraw ? `(${p1}-${p2} pen)` : "";
      batch.update(doc(db, "matches", resultMatch.id), {
        score: `${s1}-${s2}`,
        penalties: isDraw ? `${p1}-${p2}` : null,
        status: "completed",
        statsSnapshot,
        completedAt: new Date(),
      });

      await batch.commit();

      await advanceTournament(resultMatch);
      
      Alert.alert("✅ Result Saved!");
      setResultMatch(null);
    } catch (e) { console.error(e); Alert.alert("Error saving result"); }
    setIsSubmitting(false);
  };
  const advanceTournament = async (match) => {
  const winner = getWinner(match);
  if (!winner) return;

  const tournamentRef = doc(db, "tournaments", "main");
  const snap = await getDoc(tournamentRef);
  if (!snap.exists()) return;

  const data = snap.data();

  const rounds = JSON.parse(JSON.stringify(data.rounds));

  const currentRound = match.round;         
  const nextRound = currentRound + 1;       
  const matchIndex = match.matchIndex;      
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const isTop = matchIndex % 2 === 0;       

 
  const nextRoundKey = String(nextRound);

  if (!rounds[nextRoundKey]) {
    await updateDoc(tournamentRef, {
      rounds,
      winner: winner.name,
    });
    return;
  }

  const nextMatch = rounds[nextRoundKey][nextMatchIndex];
  if (!nextMatch) return;

  rounds[nextRoundKey][nextMatchIndex] = {
    ...nextMatch,
    team1Id:   isTop ? winner.id   : nextMatch.team1Id,
    team1Name: isTop ? winner.name : nextMatch.team1Name,
    team2Id:   !isTop ? winner.id   : nextMatch.team2Id,
    team2Name: !isTop ? winner.name : nextMatch.team2Name,
  };

  await updateDoc(tournamentRef, { rounds });
};

 const handleDeleteMatch = async (match) => {
  Alert.alert("Delete Match", "Are you sure?", [
    { text: "Cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        try {

          await deleteDoc(doc(db, "matches", match.id));
          const tournamentRef = doc(db, "tournaments", "main");
          const snap = await getDoc(tournamentRef);
          if (!snap.exists()) return;

          const data = snap.data();
          const rounds = JSON.parse(JSON.stringify(data.rounds));

          const roundKey = String(match.round);
          if (
            rounds[roundKey] &&
            match.matchIndex !== undefined &&
            rounds[roundKey][match.matchIndex]
          ) {

            rounds[roundKey][match.matchIndex] = {
              ...rounds[roundKey][match.matchIndex],
              team1Id: null,
              team1Name: null,
              team2Id: null,
              team2Name: null,
              winner: null,
              score: null,
              isBye: false,
            };

            await updateDoc(tournamentRef, { rounds });
          }
        } catch (e) {
          console.error(e);
          Alert.alert("Error deleting match");
        }
      },
    },
  ]);
};     

  // ─── Auto-build squad ────────────────────────────────────────
  const handleAutoBuild = async () => {
    if (freeAgents.length < buildCount) {
      Alert.alert("Not enough free agents");
      return;
    }
    setIsBuilding(true);
    try {
      const selected = freeAgents.slice(0, buildCount);
      const name = buildTeamName.trim() || `Squad-${Math.floor(Math.random() * 999)}`;
      const batch = writeBatch(db);
      const teamRef = doc(collection(db, "teams"));
      batch.set(teamRef, {
        teamName: name,
        captainName: selected[0]?.name || "",
        status: "approved",
        members: selected.map(p => p.name),
        memberIds: selected.map(p => p.id),
        createdAt: new Date(),
      });
      selected.forEach(p => {
        batch.update(doc(db, "users", p.id), { hasTeam: true, teamId: teamRef.id, assignedTeam: name });
      });
      await batch.commit();
      Alert.alert(`✅ ${name} created!`);
      setShowBuildModal(false);
      setBuildTeamName("");
    } catch (e) { console.error(e); }
    setIsBuilding(false);
  };

  // ─── Settings ────────────────────────────────────────────────
  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) { Alert.alert("Min 6 characters"); return; }
    try {
      await updatePassword(auth.currentUser, newPassword);
      Alert.alert("✅ Password updated!");
      setNewPassword("");
    } catch (e) { Alert.alert("Error", "Please logout and login again first."); }
  };

  const handleResetSystem = async () => {
    Alert.alert("⚠️ WARNING", "This will wipe ALL teams, matches and reset stats!", [
      { text: "Cancel" },
      {
        text: "Reset", style: "destructive", onPress: async () => {
          setIsResetting(true);
          try {
            const batch = writeBatch(db);
            const teamsSnap = await getDocs(collection(db, "teams"));
            teamsSnap.docs.forEach(d => batch.delete(doc(db, "teams", d.id)));
            const matchesSnap = await getDocs(collection(db, "matches"));
            matchesSnap.docs.forEach(d => batch.delete(doc(db, "matches", d.id)));
            const usersSnap = await getDocs(collection(db, "users"));
            usersSnap.docs.forEach(d => batch.update(doc(db, "users", d.id), {
              goals: 0, yellowCards: 0, redCards: 0, hasTeam: false, teamId: null, assignedTeam: null
            }));
            await batch.commit();
            Alert.alert("✅ System Reset!");
          } catch (e) { console.error(e); }
          setIsResetting(false);
        }
      }
    ]);
  };

  // ─── Displayed players ───────────────────────────────────────
  const displayedPlayers = players.filter(p => {
    if (searchTerm.trim()) return p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return playersSubTab === "free" ? !p.hasTeam : p.hasTeam;
  });


  const handleManualWin = (match, winner) => {
  if (!match.team1Name || !match.team2Name || match.winner) return;

  setTournament(prev => {
    const updated = { ...prev };

    const roundsKeys = Object.keys(updated.rounds);

    let currentRoundIndex = -1;
    let matchIndex = -1;

    roundsKeys.forEach((rKey, rIdx) => {
      updated.rounds[rKey].forEach((m, mIdx) => {
        if (m === match) {
          currentRoundIndex = rIdx;
          matchIndex = mIdx;
        }
      });
    });

    if (currentRoundIndex === -1) return prev;

    const nextRoundKey = roundsKeys[currentRoundIndex + 1];

    if (!nextRoundKey) {
      updated.winner = winner;
      return updated;
    }

    const nextMatchIndex = Math.floor(matchIndex / 2);
    const isTop = matchIndex % 2 === 0;

    updated.rounds = Object.fromEntries(
      Object.entries(updated.rounds).map(([key, matches]) => {
        if (key === roundsKeys[currentRoundIndex]) {
          return [
            key,
            matches.map(m =>
              m === match ? { ...m, winner } : m
            )
          ];
        }

        if (key === nextRoundKey) {
          return [
            key,
            matches.map((m, idx) => {
              if (idx === nextMatchIndex) {
                return {
                  ...m,
                  team1Name: isTop ? winner : m.team1Name,
                  team2Name: !isTop ? winner : m.team2Name,
                };
              }
              return m;
            })
          ];
        }

        return [key, matches];
      })
    );

    return updated;
  });
};

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <ImageBackground
      source={{ uri: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000" }}
      style={s.bg}
    >
      <View style={s.overlay}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIcon}><Text style={{ color: "#3b82f6", fontSize: 18 }}>⊞</Text></View>
            <View>
              <Text style={s.headerTitle}>Admin Portal</Text>
              <Text style={s.headerSub}>LEAGUE MANAGEMENT</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={s.newBtn} onPress={() => { setAddModalView("options"); setShowAddModal(true); }}>
              <Text style={s.newBtnText}>+ New</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.avatarCircle} onPress={() => signOut(auth)}>
              <Text style={{ color: "#fff", fontSize: 16 }}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Content ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>

          {/* ════ DASHBOARD ════ */}
          {activeTab === "dashboard" && (
            <View>
              {/* Stats Grid */}
              <View style={s.statsGrid}>
                <View style={s.statCardDark}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>Total Players</Text>
                    <Text style={{ fontSize: 16 }}>👥</Text>
                  </View>
                  <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>{stats.total}</Text>
                </View>
                <View style={s.statCardDark}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>Pending Approval</Text>
                    <Text style={{ fontSize: 16 }}>⏳</Text>
                  </View>
                  <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>{stats.pending}</Text>
                </View>
                <View style={s.statCardDark}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>Free Agents</Text>
                    <Text style={{ fontSize: 16 }}>🏃</Text>
                  </View>
                  <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>{stats.free}</Text>
                </View>
                <View style={s.statCardDark}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "bold" }}>Matches</Text>
                    <Text style={{ fontSize: 16 }}>✅</Text>
                  </View>
                  <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900" }}>{matches.length}</Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={s.dashNavRow}>
                <TouchableOpacity onPress={() => setActiveClick("live")} style={[s.dashNavBtn, activeClick === "live" && s.dashNavBtnActive]}>
                  <Text style={[s.dashNavTxt, activeClick === "live" && s.dashNavTxtActive]}>Live</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveClick("history")} style={[s.dashNavBtn, activeClick === "history" && s.dashNavBtnActive]}>
                  <Text style={[s.dashNavTxt, activeClick === "history" && s.dashNavTxtActive]}>Match History</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveClick("requests")} style={[s.dashNavBtn, activeClick === "requests" && s.dashNavBtnActive]}>
                  <Text style={[s.dashNavTxt, activeClick === "requests" && s.dashNavTxtActive]}>Team Request ({pendingTeams.length})</Text>
                </TouchableOpacity>
              </View>

              {/* LIVE */}
              {activeClick === "live" && (
                <View style={{ marginTop: 10 }}>
                  {liveMatches.length === 0 ? <Text style={s.emptyText}>No live matches</Text> : liveMatches.map(m => (
                    <View key={m.id} style={s.matchCardDark}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <Text style={{ color: "#fff" }}></Text>
                        <View style={s.liveBadge}><Text style={s.liveBadgeTxt}>LIVE</Text></View>
                      </View>
                      <View style={s.matchTeamsRow}>
                        <Text style={s.matchTeamDark}>{m.team1Name}</Text>
                        <Text style={s.scoreTextDark}>{m.score || "0 - 0"}</Text>
                        <Text style={s.matchTeamDark}>{m.team2Name}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                        <TouchableOpacity style={s.enterResultBtn} onPress={() => openResultModal(m)}>
                          <Text style={s.enterResultText}>Enter Result</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.deleteBtnSmall} onPress={() => handleDeleteMatch(m)}>
                          <Text style={{ color: "#ef4444" }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* HISTORY */}
              {activeClick === "history" && (
                <View style={{ marginTop: 10 }}>
                  {completedMatches.length === 0 ? <Text style={s.emptyText}>No finished matches</Text> : completedMatches.map(m => (
                    <View key={m.id} style={s.matchCardDark}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <Text style={s.matchTeamDark}>{m.team1Name}</Text>
                        <Text style={{ color: "#94a3b8", fontSize: 12 }}>VS</Text>
                        <Text style={s.matchTeamDark}>{m.team2Name}</Text>
                      </View>
                      <View style={{ alignItems: "center", marginBottom: 12 }}>
                        <Text style={s.scoreTextYellow}>{m.score || "0 - 0"}</Text>
                      </View>
                      <View style={{ alignItems: "center", marginBottom: 12 }}>
                        <View style={s.finishedBadge}><Text style={s.finishedBadgeTxt}>Finished</Text></View>
                      </View>
                      <TouchableOpacity style={[s.deleteBtnSmall, { alignSelf: "flex-end", marginTop: 4 }]} onPress={() => handleDeleteMatch(m)}>
                        <Text style={{ color: "#ef4444" }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* REQUESTS */}
              {activeClick === "requests" && (
                <View style={{ marginTop: 10 }}>
                  {pendingTeams.length === 0
                    ? <Text style={s.emptyText}>No pending requests at the moment.</Text>
                    : pendingTeams.map(team => (
                      <View key={team.id} style={s.requestCard}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                          <View>
                            <Text style={{ color: "#f1f5f9", fontSize: 20, fontWeight: "bold" }}>{team.teamName}</Text>
                            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Captain: {team.captainName || "Unknown"}</Text>
                          </View>
                          <View style={{ backgroundColor: "#dbeafe", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 11 }}>{team.memberIds?.length || 0} Players</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                          {team.members?.map((name, i) => (
                            <View key={i} style={{ backgroundColor: "#334155", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                              <Text style={{ color: "#f1f5f9", fontSize: 11, fontWeight: "bold" }}>• {name}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <TouchableOpacity style={s.requestApproveBtn} onPress={() => handleApprove(team.id)}>
                            <Text style={{ color: "#fff", fontWeight: "bold", textTransform: "uppercase", fontSize: 12 }}>Approve Team</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.requestRejectBtn} onPress={() => handleRejectTeam(team)}>
                            <Text style={{ color: "#f87171", fontWeight: "bold", textTransform: "uppercase", fontSize: 12 }}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  }
                </View>
              )}
            </View>
          )}

          {/* ════ PLAYERS ════ */}
          {activeTab === "players" && (
            <View>
              <Text style={s.pageTitle}>🏃 Players Management</Text>
              {/* Search */}
              <View style={s.searchBox}>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search player..."
                  placeholderTextColor="#475569"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>
              {/* Sub-tabs */}
              {!searchTerm && (
                <View style={s.subTabRow}>
                  <TouchableOpacity
                    style={[s.subTab, playersSubTab === "free" && s.subTabActive]}
                    onPress={() => setPlayersSubTab("free")}
                  >
                    <Text style={[s.subTabTxt, playersSubTab === "free" && { color: "#fff" }]}>
                      FREE ({freeAgents.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.subTab, playersSubTab === "team" && s.subTabActive]}
                    onPress={() => setPlayersSubTab("team")}
                  >
                    <Text style={[s.subTabTxt, playersSubTab === "team" && { color: "#fff" }]}>
                      IN TEAMS ({players.filter(p => p.hasTeam).length})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Player Cards */}
              {displayedPlayers.length === 0
                ? <Text style={s.emptyText}>No players found</Text>
                : displayedPlayers.map(p => (
                  <View key={p.id} style={s.playerCard}>
                    <View style={s.playerAvatar}>
                      <Text style={s.playerAvatarTxt}>{p.name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.playerName}>{p.name}</Text>
                      <Text style={s.playerInfo}>ID: {p.studentCode}</Text>
                      {p.assignedTeam && <Text style={[s.playerInfo, { color: "#3b82f6" }]}>TEAM: {p.assignedTeam}</Text>}
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                        <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "bold" }}>⚽ {p.goals || 0}</Text>
                        <Text style={{ color: "#eab308", fontSize: 11, fontWeight: "bold" }}>🟨 {p.yellowCards || 0}</Text>
                        <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: "bold" }}>🟥 {p.redCards || 0}</Text>
                      </View>
                      <View style={s.passBox}>
                        <Text style={{ color: "#64748b", fontSize: 9 }}>🔑 </Text>
                        <Text style={{ color: "#eab308", fontSize: 11, fontStyle: "italic" }}>{p.password || "—"}</Text>
                      </View>
                      {!p.isVerified ? (
                        <TouchableOpacity style={s.activateBtn} onPress={() => handleManualVerify(p)}>
                          <Text style={s.activateTxt}>👤 MANUAL ACTIVATE</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={s.verifiedBadge}><Text style={s.verifiedTxt}>✓ VERIFIED</Text></View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => p.hasTeam ? handleRemoveFromTeam(p) : handleDeletePlayer(p)}
                      style={{ padding: 8 }}
                    >
                      <Text style={{ fontSize: 18 }}>{p.hasTeam ? "👤−" : "🗑"}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              }

              {/* Auto-build button */}
              {playersSubTab === "free" && !searchTerm && freeAgents.length >= 2 && (
                <TouchableOpacity style={s.buildBtn} onPress={() => setShowBuildModal(true)}>
                  <Text style={s.buildBtnTxt}>✨ AUTO-BUILD SQUAD</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ════ TEAMS ════ */}
          {activeTab === "teams" && (
            <View>
              <Text style={s.pageTitle}>🛡 Tournament Teams</Text>
              <Text style={s.pageSub}>MANAGE ROSTERS & FINALIZE SQUADS</Text>
              {approvedTeams.length === 0
                ? <Text style={s.emptyText}>No approved teams yet</Text>
                : approvedTeams.map(team => {
                  const members = players.filter(p =>
                    p.teamId === team.id || p.assignedTeam === team.teamName
                  );
                  return (
                    <View key={team.id} style={s.teamCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={s.teamAvatarGreen}>
                          <Text style={{ color: "#10b981", fontSize: 20, fontWeight: "bold" }}>{team.teamName?.[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.teamName}>{team.teamName}</Text>
                          <Text style={{ color: "#10b981", fontSize: 11 }}>VERIFIED SQUAD • {members.length}/7</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteTeam(team)}>
                          <Text style={{ color: "#475569", fontSize: 18 }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={s.membersList}>
                        {members.map((m, i) => (
                          <View key={i} style={s.memberRow}>
                            <View style={s.memberDot} />
                            <Text style={s.memberName}>{m.name}</Text>
                            {m.suspendedForNextMatch && (
                              <Text style={{ color: "#ef4444", fontSize: 10, marginLeft: 4 }}>⚠️ SUSP</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
              }
            </View>
          )}

          {/* ════ DRAW ════ */}
          {activeTab === "draw" && (
            <View>
              <Text style={s.pageTitle}>🏆 Tournament Draw</Text>
              <Text style={s.pageSub}>BRACKET & FIXTURES</Text>

              <TouchableOpacity
                style={[s.generateBtn, isGenerating && { opacity: 0.6 }]}
                onPress={handleGenerateDraw}
                disabled={isGenerating}
              >
                {isGenerating
                  ? <ActivityIndicator color="#0f172a" />
                  : <Text style={s.generateBtnTxt}>🎲 Generate Tournament Draw</Text>
                }
              </TouchableOpacity>

             {/* Tournament Bracket */}
{tournament && tournament.rounds ? (
  <View style={{ marginTop: 20 }}>
    
    <Text style={[s.sectionLabel, { color: "#eab308" }]}>
      📊 BRACKET
    </Text>

    {/* 🏆 Champion */}
    {tournament.winner && (
      <View style={{
        backgroundColor: "#facc1533",
        padding: 14,
        borderRadius: 14,
        marginBottom: 16,
        alignItems: "center"
      }}>
        <Text style={{ color: "#facc15", fontWeight: "bold" }}>
          🏆 Champion: {tournament.winner}
        </Text>
      </View>
    )}

    <ScrollView horizontal showsHorizontalScrollIndicator={false}>

      {Object.entries(tournament.rounds).map(([rIdx, roundMatches]) => (

        <View key={rIdx} style={{ marginRight: 20 }}>

          {/* Round Title */}
          <Text style={{
            color: "#3b82f6",
            fontSize: 12,
            marginBottom: 10,
            textAlign: "center",
            fontWeight: "bold"
          }}>
            {getRoundLabel(parseInt(rIdx), Object.keys(tournament.rounds).length)}
          </Text>

          {/* Matches */}
          {roundMatches.map((m, i) => {

            const isFinished = !!m.winner;

            return (
              <View
                key={i}
                style={{
                  backgroundColor: "#020617",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 2,
                  borderColor: isFinished ? "#22c55e55" : "#1e293b",
                  marginBottom: 16,
                  minWidth: 180
                }}
              >

                {/* Match Label */}
                <Text style={{
                  color: "#64748b",
                  fontSize: 10,
                  marginBottom: 6,
                  textAlign: "center"
                }}>
                  Match {i + 1}
                </Text>

                {/* Team 1 */}
                <TouchableOpacity
                  disabled={!m.team1Name || !m.team2Name || isFinished}
                  onPress={() => handleManualWin(m, m.team1Name)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor:
                      m.winner === m.team1Name ? "#22c55e33" : "#020617",
                    borderWidth: 1,
                    borderColor: "#1e293b",
                    marginBottom: 6
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    {m.team1Name || "TBD"}
                  </Text>
                </TouchableOpacity>

                {/* BYE */}
                {m.isBye ? (
                  <View style={{
                    padding: 10,
                    borderRadius: 10,
                    borderStyle: "dashed",
                    borderWidth: 1,
                    borderColor: "#475569",
                    alignItems: "center"
                  }}>
                    <Text style={{ color: "#64748b" }}>BYE</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    disabled={!m.team1Name || !m.team2Name || isFinished}
                    onPress={() => handleManualWin(m, m.team2Name)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor:
                        m.winner === m.team2Name ? "#22c55e33" : "#020617",
                      borderWidth: 1,
                      borderColor: "#1e293b"
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      {m.team2Name || "TBD"}
                    </Text>
                  </TouchableOpacity>
                )}

              </View>
            );
          })}

        </View>

      ))}

    </ScrollView>
  </View>
) : (
  <Text style={[s.emptyText, { marginTop: 30 }]}>
    No draw generated yet.{"\n"}
    Press the button above to generate brackets for {approvedTeams.length} approved teams.
  </Text>
)}

              {/* Standings */}
              <Text style={[s.sectionLabel, { color: "#a855f7", marginTop: 20 }]}>🥇 STANDINGS</Text>
              {rankedTeams.length === 0
                ? <Text style={s.emptyText}>No match data yet</Text>
                : rankedTeams.map((team, idx) => (
                  <View key={team.id} style={s.standingRow}>
                    <Text style={s.standingRank}>{idx + 1}</Text>
                    <Text style={[s.standingName, { flex: 1 }]}>{team.teamName}</Text>
                    <Text style={s.standingPts}>{team.stats.points} PTS</Text>
                    <Text style={{ color: "#64748b", fontSize: 10 }}>
                      W{team.stats.wins} D{team.stats.draws} L{team.stats.losses}
                    </Text>
                  </View>
                ))
              }

              {/* Top Scorers */}
              <Text style={[s.sectionLabel, { color: "#22c55e", marginTop: 20 }]}>⚽ TOP SCORERS</Text>
              {topScorers.map((p, i) => (
                <View key={p.id} style={s.scorerRow}>
                  <Text style={{ color: "#eab308", fontWeight: "bold", width: 24 }}>#{i + 1}</Text>
                  <Text style={{ color: "#fff", flex: 1, fontWeight: "bold" }}>{p.name}</Text>
                  <Text style={{ color: "#22c55e", fontWeight: "bold" }}>{p.goals || 0} Goals</Text>
                </View>
              ))}
            </View>
          )}

          {/* ════ MATCHES ════ */}
          {activeTab === "matches" && (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={s.pageTitle}>📅 Fixtures</Text>
                <TouchableOpacity style={s.newMatchBtn} onPress={() => { setAddModalView("matchForm"); setShowAddModal(true); }}>
                  <Text style={s.newMatchBtnTxt}>+ Match</Text>
                </TouchableOpacity>
              </View>

              {/* Scheduled */}
              {scheduledMatches.length > 0 && (
                <View>
                  <Text style={s.sectionLabel}>🕐 UPCOMING</Text>
                  {scheduledMatches.map(m => (
                    <View key={m.id} style={[s.matchCard, { borderLeftColor: "#3b82f6" }]}>
                      {m.round && <Text style={{ color: "#3b82f6", fontSize: 10, fontWeight: "bold", marginBottom: 6 }}>{m.round}</Text>}
                      <View style={s.matchTeamsRow}>
                        <Text style={s.matchTeam}>{m.team1Name}</Text>
                        <View style={s.scoreBox}><Text style={[s.scoreText, { color: "#3b82f6" }]}>VS</Text></View>
                        <Text style={s.matchTeam}>{m.team2Name}</Text>
                      </View>
                      {(m.date || m.time) && (
                        <Text style={{ color: "#64748b", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                          📍 {m.pitch}  📅 {m.date}  🕐 {m.time}
                        </Text>
                      )}
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TouchableOpacity style={s.enterResultBtn} onPress={() => openResultModal(m)}>
                          <Text style={s.enterResultText}>Enter Result</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.deleteBtnSmall} onPress={() => handleDeleteMatch(m)}>
                          <Text style={{ color: "#ef4444" }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Live */}
              {liveMatches.length > 0 && (
                <View>
                  <Text style={[s.sectionLabel, { color: "#ef4444" }]}>🔴 LIVE</Text>
                  {liveMatches.map(m => (
                    <View key={m.id} style={[s.matchCard, { borderLeftColor: "#ef4444" }]}>
                      <View style={s.matchTeamsRow}>
                        <Text style={s.matchTeam}>{m.team1Name}</Text>
                        <View style={s.scoreBox}><Text style={[s.scoreText, { color: "#ef4444" }]}>{m.score || "LIVE"}</Text></View>
                        <Text style={s.matchTeam}>{m.team2Name}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TouchableOpacity style={s.enterResultBtn} onPress={() => openResultModal(m)}>
                          <Text style={s.enterResultText}>Enter Result</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.deleteBtnSmall} onPress={() => handleDeleteMatch(m)}>
                          <Text style={{ color: "#ef4444" }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Completed */}
              {completedMatches.length > 0 && (
                <View>
                  <Text style={[s.sectionLabel, { color: "#22c55e" }]}>✅ COMPLETED</Text>
                  {completedMatches.map(m => (
                    <View key={m.id} style={[s.matchCard, { borderLeftColor: "#22c55e" }]}>
                      {m.round && <Text style={{ color: "#22c55e", fontSize: 10, fontWeight: "bold", marginBottom: 6 }}>{m.round}</Text>}
                      <View style={s.matchTeamsRow}>
                        <Text style={s.matchTeam}>{m.team1Name}</Text>
                        <View style={s.scoreBox}><Text style={[s.scoreText, { color: "#22c55e" }]}>{m.score}</Text></View>
                        <Text style={s.matchTeam}>{m.team2Name}</Text>
                      </View>
                      {m.penalties && (
                        <Text style={{ color: "#eab308", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                          Penalties: {m.penalties}
                        </Text>
                      )}
                      {/* Stats snapshot */}
                      {m.statsSnapshot && Object.keys(m.statsSnapshot).length > 0 && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={{ color: "#475569", fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>PLAYER STATS</Text>
                          {Object.entries(m.statsSnapshot).map(([pid, st]) => (
                            st.goals > 0 || st.yellow > 0 || st.red > 0 ? (
                              <View key={pid} style={{ flexDirection: "row", gap: 8, marginBottom: 3 }}>
                                <Text style={{ color: "#e2e8f0", fontSize: 11, flex: 1 }}>{st.name}</Text>
                                {st.goals > 0 && <Text style={{ color: "#22c55e", fontSize: 11 }}>⚽{st.goals}</Text>}
                                {st.yellow > 0 && <Text style={{ color: "#eab308", fontSize: 11 }}>🟨{st.yellow}</Text>}
                                {st.red > 0 && <Text style={{ color: "#ef4444", fontSize: 11 }}>🟥{st.red}</Text>}
                              </View>
                            ) : null
                          ))}
                        </View>
                      )}
                      <TouchableOpacity style={[s.deleteBtnSmall, { alignSelf: "flex-end", marginTop: 8 }]} onPress={() => handleDeleteMatch(m)}>
                        <Text style={{ color: "#ef4444" }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {matches.length === 0 && (
                <Text style={s.emptyText}>No matches yet. Create one with + Match</Text>
              )}
            </View>
          )}

          {/* ════ SETTINGS ════ */}
          {activeTab === "settings" && (
            <View>
              <Text style={s.pageTitle}>⚙️ Admin Control Room</Text>

              {/* Password */}
              <View style={s.settingCard}>
                <Text style={s.settingCardTitle}>🔑 Change Password</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <TextInput
                    style={s.passInput}
                    placeholder="New password..."
                    placeholderTextColor="#475569"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity style={s.updatePassBtn} onPress={handleUpdatePassword}>
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>💾 Update</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Generate Draw */}
              <TouchableOpacity style={[s.settingCard, { borderColor: "rgba(59,130,246,0.3)" }]} onPress={handleGenerateDraw}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={[s.settingCardTitle, { color: "#3b82f6" }]}>Generate Tournament Draw</Text>
                    <Text style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>RANDOMIZED BRACKET</Text>
                  </View>
                  <Text style={{ fontSize: 24 }}>{isGenerating ? "⏳" : "🗂"}</Text>
                </View>
              </TouchableOpacity>

              {/* Lock */}
              <View style={s.settingCard}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={s.settingCardTitle}>Registration Lock</Text>
                    <Text style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>FREEZE ALL ENTRIES</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.lockBtn, { backgroundColor: isLocked ? "#ef4444" : "#22c55e" }]}
                    onPress={() => setIsLocked(!isLocked)}
                  >
                    <Text style={{ fontSize: 22 }}>{isLocked ? "🔒" : "🔓"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reset */}
              <TouchableOpacity style={[s.settingCard, { borderColor: "rgba(239,68,68,0.3)" }]} onPress={handleResetSystem}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={[s.settingCardTitle, { color: "#ef4444" }]}>Reset Tournament</Text>
                    <Text style={{ color: "#ef4444", fontSize: 10, marginTop: 2, opacity: 0.6 }}>CLEAR ALL DATA</Text>
                  </View>
                  <Text style={{ fontSize: 24 }}>{isResetting ? "⏳" : "🗄"}</Text>
                </View>
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity style={[s.settingCard, { marginTop: 8 }]} onPress={() => signOut(auth)}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[s.settingCardTitle, { color: "#ef4444" }]}>EXIT ADMIN SESSION</Text>
                  <Text style={{ fontSize: 24 }}>🚪</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>

        {/* ── Bottom Nav ── */}
        <View style={s.bottomNav}>
          <NavBtn icon="⊞" label="HOME" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
          <NavBtn icon="🏃" label="PLAYERS" active={activeTab === "players"} onPress={() => setActiveTab("players")} />
          <NavBtn icon="🛡" label="TEAMS" active={activeTab === "teams"} onPress={() => setActiveTab("teams")} />
          <NavBtn icon="🏆" label="DRAW" active={activeTab === "draw"} onPress={() => setActiveTab("draw")} />
          <NavBtn icon="📅" label="MATCHES" active={activeTab === "matches"} onPress={() => setActiveTab("matches")} />
          <NavBtn icon="⚙️" label="SETTINGS" active={activeTab === "settings"} onPress={() => setActiveTab("settings")} />
        </View>
      </View>

      {/* ════════════════════════════════════════════════════════
          ADD MODAL (New Team / New Match)
      ════════════════════════════════════════════════════════ */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              {addModalView !== "options" && (
                <TouchableOpacity onPress={() => setAddModalView("options")}>
                  <Text style={{ color: "#94a3b8", fontSize: 16 }}>← Back</Text>
                </TouchableOpacity>
              )}
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 18, flex: 1, textAlign: "center" }}>
                {addModalView === "options" ? "Quick Actions" : addModalView === "teamForm" ? "New Team" : "Schedule Match"}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Options */}
            {addModalView === "options" && (
              <View style={{ gap: 12 }}>
                <TouchableOpacity style={s.optionBtn} onPress={() => setAddModalView("teamForm")}>
                  <Text style={{ fontSize: 28 }}>🛡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Add Team</Text>
                    <Text style={{ color: "#64748b", fontSize: 11 }}>{pendingTeams.length + approvedTeams.length}/32 slots used</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={s.optionBtn} onPress={() => setAddModalView("matchForm")}>
                  <Text style={{ fontSize: 28 }}>⚽</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Schedule Match</Text>
                    <Text style={{ color: "#64748b", fontSize: 11 }}>Create game fixture</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Team Form */}
            {addModalView === "teamForm" && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput style={s.modalInput} placeholder="Team Name" placeholderTextColor="#475569"
                  value={newTeamName} onChangeText={setNewTeamName} />
                <TextInput style={s.modalInput} placeholder="Captain Name" placeholderTextColor="#475569"
                  value={newCaptainName} onChangeText={setNewCaptainName} />

                <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Select Players (Optional)</Text>
                {freeAgents.slice(0, 20).map(p => {
                  const sel = selectedFreeAgents.some(x => x.id === p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.agentRow, sel && { backgroundColor: "rgba(59,130,246,0.2)", borderColor: "#3b82f6" }]}
                      onPress={() => {
                        if (sel) setSelectedFreeAgents(prev => prev.filter(x => x.id !== p.id));
                        else if (selectedFreeAgents.length < 7) setSelectedFreeAgents(prev => [...prev, p]);
                        else Alert.alert("Max 7 players");
                      }}
                    >
                      <Text style={{ color: sel ? "#3b82f6" : "#e2e8f0", fontWeight: sel ? "bold" : "normal" }}>
                        {sel ? "✓ " : ""}{p.name}
                      </Text>
                      <Text style={{ color: "#475569", fontSize: 11 }}>{p.studentCode}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[s.modalBtn, isSaving && { opacity: 0.6 }]}
                  onPress={handleCreateTeam}
                  disabled={isSaving}
                >
                  {isSaving ? <ActivityIndicator color="#000" /> : <Text style={s.modalBtnTxt}>Create Team</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Match Form */}
            {addModalView === "matchForm" && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Home Team</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {approvedTeams.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[s.teamPill, newMatchTeam1?.id === t.id && { backgroundColor: "#3b82f6" }]}
                      onPress={() => setNewMatchTeam1(t)}
                    >
                      <Text style={{ color: newMatchTeam1?.id === t.id ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: "bold" }}>
                        {t.teamName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Away Team</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {approvedTeams.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[s.teamPill, newMatchTeam2?.id === t.id && { backgroundColor: "#a855f7" }]}
                      onPress={() => setNewMatchTeam2(t)}
                    >
                      <Text style={{ color: newMatchTeam2?.id === t.id ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: "bold" }}>
                        {t.teamName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TextInput style={s.modalInput} placeholder="Date (e.g. 2025-06-01)" placeholderTextColor="#475569"
                  value={newMatchDate} onChangeText={setNewMatchDate} />
                <TextInput style={s.modalInput} placeholder="Time (e.g. 15:00)" placeholderTextColor="#475569"
                  value={newMatchTime} onChangeText={setNewMatchTime} />

                <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Pitch</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {["Main Pitch", "Pitch 2", "Pitch 3"].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[s.teamPill, newMatchPitch === p && { backgroundColor: "#22c55e" }]}
                      onPress={() => setNewMatchPitch(p)}
                    >
                      <Text style={{ color: newMatchPitch === p ? "#000" : "#94a3b8", fontSize: 11, fontWeight: "bold" }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: "#22c55e" }, isSaving && { opacity: 0.6 }]}
                  onPress={handleCreateMatch}
                  disabled={isSaving}
                >
                  {isSaving ? <ActivityIndicator color="#000" /> : <Text style={s.modalBtnTxt}>Schedule Match</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          RESULT MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal visible={!!resultMatch} transparent animationType="slide" onRequestClose={() => setResultMatch(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: "90%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>⚽ Post-Match Report</Text>
              <TouchableOpacity onPress={() => setResultMatch(null)}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {resultMatch && (
              <Text style={{ color: "#94a3b8", textAlign: "center", marginBottom: 16, fontSize: 13 }}>
                {resultMatch.team1Name} vs {resultMatch.team2Name}
              </Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Score */}
              <View style={s.scoreInputRow}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4 }}>{resultMatch?.team1Name}</Text>
                  <TextInput
                    style={s.scoreInput}
                    value={score1}
                    onChangeText={setScore1}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text style={{ color: "#475569", fontSize: 30, fontWeight: "bold", marginTop: 20 }}>-</Text>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#94a3b8", fontSize: 10, marginBottom: 4 }}>{resultMatch?.team2Name}</Text>
                  <TextInput
                    style={s.scoreInput}
                    value={score2}
                    onChangeText={setScore2}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>

              {/* Penalties if draw */}
              {score1 === score2 && score1 !== "" && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: "#eab308", textAlign: "center", fontSize: 12, marginBottom: 8 }}>
                    DRAW — Enter Penalty Shootout
                  </Text>
                  <View style={s.scoreInputRow}>
                    <TextInput style={[s.scoreInput, { width: 60, height: 60 }]} value={pen1} onChangeText={setPen1} keyboardType="number-pad" />
                    <Text style={{ color: "#475569", fontSize: 24, fontWeight: "bold" }}>-</Text>
                    <TextInput style={[s.scoreInput, { width: 60, height: 60 }]} value={pen2} onChangeText={setPen2} keyboardType="number-pad" />
                  </View>
                </View>
              )}

              {/* Player stats */}
              <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "bold", marginBottom: 10 }}>
                PLAYER STATS
              </Text>
              {resultMatch && players
                .filter(p => p.teamId === resultMatch.team1Id || p.teamId === resultMatch.team2Id)
                .filter(p => !p.suspendedForNextMatch)
                .map(p => (
                  <View key={p.id} style={s.playerStatRow}>
                    <Text style={{ color: "#e2e8f0", flex: 1, fontSize: 13, fontWeight: "bold" }}>{p.name}</Text>
                    <Text style={{ color: "#64748b", fontSize: 10 }}>{p.assignedTeam}</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      {[
                        { key: "goals", label: "⚽", color: "#22c55e" },
                        { key: "yellow", label: "🟨", color: "#eab308" },
                        { key: "red", label: "🟥", color: "#ef4444" },
                      ].map(field => (
                        <View key={field.key} style={{ alignItems: "center" }}>
                          <Text style={{ color: field.color, fontSize: 10, marginBottom: 3 }}>{field.label}</Text>
                          <TextInput
                            style={s.statInput}
                            value={playerStats[p.id]?.[field.key] ?? "0"}
                            onChangeText={v => setPlayerStats(prev => ({
                              ...prev,
                              [p.id]: { ...(prev[p.id] || {}), [field.key]: v }
                            }))}
                            keyboardType="number-pad"
                            maxLength={2}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              }

              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: "#22c55e", marginTop: 20 }, isSubmitting && { opacity: 0.6 }]}
                onPress={handleFinalizeMatch}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.modalBtnTxt}>Publish Results</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          AUTO-BUILD MODAL
      ════════════════════════════════════════════════════════ */}
      <Modal visible={showBuildModal} transparent animationType="fade" onRequestClose={() => setShowBuildModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 18 }}>✨ Auto-Build Squad</Text>
              <TouchableOpacity onPress={() => setShowBuildModal(false)}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.modalInput} placeholder="Team Name (optional)" placeholderTextColor="#475569"
              value={buildTeamName} onChangeText={setBuildTeamName} />
            <Text style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>Number of Players</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {[2, 3, 4, 5, 6, 7].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.countBtn, buildCount === n && { backgroundColor: "#a3e635" }]}
                  onPress={() => setBuildCount(n)}
                >
                  <Text style={{ color: buildCount === n ? "#0f172a" : "#94a3b8", fontWeight: "bold" }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: "#a3e635" }, isBuilding && { opacity: 0.6 }]}
              onPress={handleAutoBuild}
              disabled={isBuilding || freeAgents.length < buildCount}
            >
              {isBuilding ? <ActivityIndicator color="#0f172a" /> : <Text style={[s.modalBtnTxt, { color: "#0f172a" }]}>Build Squad ({buildCount} players)</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ImageBackground>
  );
}

// ─── Small components ──────────────────────────────────────────
const StatCard = ({ label, value, icon, color }) => (
  <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
    <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
    <Text style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
    <Text style={{ color: "#fff", fontSize: 26, fontWeight: "bold", marginTop: 4 }}>{value}</Text>
  </View>
);

const NavBtn = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={s.navBtn} onPress={onPress}>
    <Text style={{ fontSize: 20 }}>{icon}</Text>
    <Text style={[s.navLabel, { color: active ? "#3b82f6" : "#64748b" }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.93)" },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)"
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.2)", borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)", justifyContent: "center", alignItems: "center"
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  headerSub: { color: "#64748b", fontSize: 8, letterSpacing: 1, marginTop: 1 },
  newBtn: { backgroundColor: "rgba(59,130,246,0.3)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  newBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "#3b82f6", backgroundColor: "#1e293b", justifyContent: "center", alignItems: "center" },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  // Labels
  sectionLabel: { color: "#64748b", fontSize: 10, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  pageTitle: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  pageSub: { color: "#64748b", fontSize: 9, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" },
  emptyText: { color: "#475569", fontStyle: "italic", textAlign: "center", padding: 30 },

  // Cards
  card: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  teamCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  // Team
  teamAvatarBlue: { width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(59,130,246,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  teamAvatarGreen: { width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.2)", justifyContent: "center", alignItems: "center" },
  teamName: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  teamCapt: { color: "#94a3b8", fontSize: 12, fontStyle: "italic", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  approveBtn: { flex: 1, backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  approveTxt: { color: "#fff", fontWeight: "bold" },
  rejectBtn: { flex: 1, backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  rejectTxt: { color: "#f87171", fontWeight: "bold" },

  // Members
  membersList: { marginTop: 14 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 10, marginBottom: 6 },
  memberDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10b981" },
  memberName: { color: "#e2e8f0", fontWeight: "600", flex: 1 },

  // Players
  subTabRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  subTabActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  subTabTxt: { color: "#64748b", fontWeight: "bold", fontSize: 11 },
  searchBox: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  searchInput: { color: "#fff", height: 44, fontSize: 14 },
  playerCard: { flexDirection: "row", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  playerAvatar: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#1e3a5f", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#3b82f6" },
  playerAvatarTxt: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  playerName: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  playerInfo: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  passBox: { flexDirection: "row", backgroundColor: "#0f172a", borderRadius: 8, padding: 6, marginTop: 6, alignItems: "center" },
  activateBtn: { backgroundColor: "#ea580c", borderRadius: 8, padding: 6, alignItems: "center", marginTop: 6 },
  activateTxt: { color: "#fff", fontSize: 9, fontWeight: "bold" },
  verifiedBadge: { backgroundColor: "rgba(59,130,246,0.1)", borderRadius: 8, padding: 6, alignItems: "center", marginTop: 6, borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" },
  verifiedTxt: { color: "#3b82f6", fontSize: 9, fontWeight: "bold" },
  buildBtn: { backgroundColor: "#a3e635", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 20 },
  buildBtnTxt: { color: "#0f172a", fontWeight: "bold", fontSize: 13 },

  // Matches
  matchCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  matchTeamsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matchTeam: { color: "#fff", fontWeight: "bold", fontSize: 14, flex: 1, textAlign: "center" },
  scoreBox: { backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  scoreText: { fontWeight: "bold", fontSize: 18 },
  enterResultBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  enterResultText: { color: "#000", fontWeight: "bold", fontSize: 12 },
  deleteBtnSmall: { backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  newMatchBtn: { backgroundColor: "#3b82f6", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  newMatchBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  // Draw
  generateBtn: { backgroundColor: "#a3e635", borderRadius: 16, padding: 18, alignItems: "center", marginBottom: 8 },
  generateBtnTxt: { color: "#0f172a", fontWeight: "bold", fontSize: 15 },
  roundLabel: { color: "#3b82f6", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  bracketMatch: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bracketTeam: { color: "#e2e8f0", fontWeight: "bold", fontSize: 13 },
  standingRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 6 },
  standingRank: { color: "#eab308", fontWeight: "bold", fontSize: 16, width: 24 },
  standingName: { color: "#fff", fontWeight: "bold" },
  standingPts: { color: "#3b82f6", fontWeight: "bold", marginRight: 8 },
  scorerRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10, padding: 12, marginBottom: 6 },

  // Settings
  settingCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  settingCardTitle: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  passInput: { flex: 1, backgroundColor: "#0f172a", borderRadius: 10, padding: 12, color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  updatePassBtn: { backgroundColor: "#3b82f6", borderRadius: 10, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  lockBtn: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },

  // Nav
  bottomNav: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "rgba(10,16,28,0.97)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingBottom: 28, paddingTop: 12 },
  navBtn: { alignItems: "center", gap: 3 },
  navLabel: { fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#0f172a", borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", maxHeight: "85%" },
  modalInput: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginBottom: 12 },
  modalBtn: { backgroundColor: "#3b82f6", borderRadius: 14, padding: 18, alignItems: "center", marginTop: 8 },
  modalBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  optionBtn: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  agentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  teamPill: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  countBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },

  // Result modal
  scoreInputRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20, padding: 20, marginBottom: 16 },
  scoreInput: { width: 80, height: 80, backgroundColor: "#1e293b", borderRadius: 16, color: "#fff", fontSize: 36, fontWeight: "bold", textAlign: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.1)" },
  playerStatRow: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  statInput: { width: 44, height: 44, backgroundColor: "#1e293b", borderRadius: 10, color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },

  // New Dashboard Parity Styles
  statCardDark: { flex: 1, minWidth: "45%", backgroundColor: "#1e293b", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  dashNavRow: { flexDirection: "row", gap: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", paddingBottom: 10, marginBottom: 10, marginTop: 10 },
  dashNavBtn: { paddingBottom: 8 },
  dashNavBtnActive: { borderBottomWidth: 3, borderBottomColor: "#22c55e" },
  dashNavTxt: { color: "#94a3b8", fontSize: 16, fontWeight: "bold" },
  dashNavTxtActive: { color: "#22c55e" },
  matchCardDark: { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  matchTeamDark: { color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center", flex: 1 },
  scoreTextDark: { color: "#60a5fa", fontSize: 28, fontWeight: "900", textAlign: "center", width: 80 },
  scoreTextYellow: { color: "#facc15", fontSize: 32, fontWeight: "900", textAlign: "center", width: 100 },
  liveBadge: { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  liveBadgeTxt: { color: "#4ade80", fontSize: 10, fontWeight: "bold" },
  finishedBadge: { backgroundColor: "transparent", borderColor: "#facc15", borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  finishedBadgeTxt: { color: "#facc15", fontSize: 10, fontWeight: "bold" },
  requestCard: { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 6, borderLeftColor: "#2563eb", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  requestApproveBtn: { flex: 1, backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  requestRejectBtn: { flex: 1, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
});