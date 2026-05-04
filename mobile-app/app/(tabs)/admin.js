import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ImageBackground, TextInput, Modal, ActivityIndicator,
  FlatList, Dimensions, Switch
} from "react-native";
import { auth, db } from "../../firebase";
import {
  collection, onSnapshot, doc, updateDoc, addDoc,
  getDocs, deleteDoc, writeBatch, getDoc, serverTimestamp, setDoc, increment, arrayUnion, arrayRemove
} from "firebase/firestore";
import { signOut, updatePassword, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

// ─── Helpers ───────────────────────────────────────────────────
const getRoundLabel = (roundIndex, totalRounds) => {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "FINAL";
  if (fromEnd === 1) return "SEMI-FINAL";
  if (fromEnd === 2) return "QUARTER-FINAL";
  return `ROUND ${roundIndex + 1}`;
};

const makeKey = (id1, id2) => [id1, id2].sort().join("__");

const getSuspensionType = (player) => {
  if (!player.suspendedForNextMatch) return null;
  if (player.suspendReason === "red") return "red";
  if (player.suspendReason === "yellow" || player.suspendReason === "accumulated") return "yellow";
  if (Number(player.redCards || 0) > 0) return "red";
  return "yellow";
};

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
  const [now, setNow] = useState(Date.now());

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalView, setAddModalView] = useState("options");
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
  const [isResetting, setIsResetting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  // Players
  const [playersSubTab, setPlayersSubTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statsFilter, setStatsFilter] = useState("total");
  const [showTop10, setShowTop10] = useState(false);

  // Teams
  const [teamSearch, setTeamSearch] = useState("");
  const [renamingTeamId, setRenamingTeamId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [addPlayerModal, setAddPlayerModal] = useState(null); // teamId

  // Tournament
  const [wizardStep, setWizardStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentDates, setTournamentDates] = useState([]);
  const [dateInput, setDateInput] = useState("");
  const [tournamentStartTime, setTournamentStartTime] = useState("09:00");
  const [tournamentStartDate, setTournamentStartDate] = useState("");
  const [tournamentEndDate, setTournamentEndDate] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [archived, setArchived] = useState([]);
  const [scheduleModal, setScheduleModal] = useState(null);

  // Build squad
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [buildTeamName, setBuildTeamName] = useState("");
  const [buildCount, setBuildCount] = useState(5);
  const [isBuilding, setIsBuilding] = useState(false);

  // Match tab
  const [matchSubTab, setMatchSubTab] = useState("upcoming");
  const [roundFilter, setRoundFilter] = useState(null);

  const router = useRouter();

  // ─── Clock ──────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

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
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
      setMatches(sorted);
    });

    const unsubTournament = onSnapshot(doc(db, "tournaments", "main"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTournament({ id: snap.id, ...data });
        if (data.rounds) setWizardStep(3);
        else setWizardStep(1);
      } else {
        setTournament(null);
        setWizardStep(1);
      }
    });

    return () => { unsubUsers(); unsubTeams(); unsubMatches(); unsubTournament(); };
  }, []);

  // ─── Fetch archive ──────────────────────────────────────────
  useEffect(() => {
    const fetchArchive = async () => {
      const snap = await getDocs(collection(db, "tournaments_archive"));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aT = a.archivedAt?.toDate?.() ?? new Date(0);
          const bT = b.archivedAt?.toDate?.() ?? new Date(0);
          return bT - aT;
        });
      setArchived(data);
    };
    fetchArchive();
  }, []);

  // ─── Derived data ────────────────────────────────────────────
  const players = allUsers.filter(u => u.role !== "admin");
  const freeAgents = players.filter(p => !p.hasTeam);

  const resolveTeamName = useCallback((teamId, fallback) => {
    const found = approvedTeams.find(t => t.id === teamId);
    return found?.teamName || fallback || "";
  }, [approvedTeams]);

  const enrichedMatches = useMemo(() =>
    matches
      .map(m => ({
        ...m,
        team1Name: resolveTeamName(m.team1Id, m.team1Name),
        team2Name: resolveTeamName(m.team2Id, m.team2Name),
      }))
      .filter(m => m.tournamentName !== "Friendly"),
    [matches, resolveTeamName]
  );

  const DURATION = 20 * 60 * 1000;

  const upcomingMatches = useMemo(() => enrichedMatches.filter(m => {
    if (m.status === "completed") return false;
    if (!m.date || !m.time) return true;
    const [y, mm, d] = m.date.split("-").map(Number);
    const [h, min] = m.time.split(":").map(Number);
    return new Date(y, mm - 1, d, h, min).getTime() > now;
  }), [enrichedMatches, now]);

  const liveMatches = useMemo(() => enrichedMatches.filter(m => {
    if (m.status === "completed") return false;
    if (!m.date || !m.time) return false;
    const [y, mm, d] = m.date.split("-").map(Number);
    const [h, min] = m.time.split(":").map(Number);
    const matchTime = new Date(y, mm - 1, d, h, min).getTime();
    return matchTime <= now && now < matchTime + DURATION;
  }), [enrichedMatches, now]);

  const pendingResultMatches = useMemo(() => enrichedMatches.filter(m => {
    if (m.status === "completed") return false;
    if (!m.date || !m.time) return false;
    const [y, mm, d] = m.date.split("-").map(Number);
    const [h, min] = m.time.split(":").map(Number);
    return now >= new Date(y, mm - 1, d, h, min).getTime() + DURATION;
  }), [enrichedMatches, now]);

  const completedMatches = useMemo(() =>
    enrichedMatches.filter(m => m.status === "completed"),
    [enrichedMatches]
  );

  // matchCache for bracket lookups
  const matchCache = useMemo(() => {
    const cache = {};
    enrichedMatches.forEach(m => {
      if (m.team1Id && m.team2Id) {
        cache[makeKey(m.team1Id, m.team2Id)] = m;
      }
    });
    return cache;
  }, [enrichedMatches]);

  const getMatchRoundLabel = (match) => {
    if (!tournament?.rounds) return null;
    const totalRounds = Object.keys(tournament.rounds).length;
    let found = null;
    Object.entries(tournament.rounds).forEach(([rKey, rMatches]) => {
      rMatches.forEach(m => {
        if (
          (m.team1?.id === match.team1Id && m.team2?.id === match.team2Id) ||
          (m.team1?.id === match.team2Id && m.team2?.id === match.team1Id)
        ) {
          found = getRoundLabel(parseInt(rKey), totalRounds);
        }
      });
    });
    return found;
  };

  // Tournament winner
  const tournamentWinner = useMemo(() => {
    if (!tournament?.rounds) return null;
    const keys = Object.keys(tournament.rounds);
    const lastRound = tournament.rounds[`${keys.length - 1}`];
    return lastRound?.[0]?.winner ?? null;
  }, [tournament]);

  // ─── Tournament actions ──────────────────────────────────────
  const computeRoundDateMap = (numRounds, sortedDates) => {
    const map = {};
    if (!sortedDates || sortedDates.length === 0) return map;
    for (let r = 0; r < numRounds; r++) {
      const progress = r / numRounds;
      const idx = Math.min(Math.floor(progress * sortedDates.length), sortedDates.length - 1);
      map[r] = sortedDates[idx];
    }
    return map;
  };

  const handleOpenRegistration = async () => {
    if (!tournamentName.trim()) return Alert.alert("Enter tournament name first");
    if (!tournamentStartDate || !tournamentEndDate) return Alert.alert("Select start and end dates");
    const today = new Date().toISOString().split("T")[0];
    if (tournamentStartDate < today) return Alert.alert("Start date cannot be in the past!");
    if (tournamentEndDate < tournamentStartDate) return Alert.alert("End date cannot be before start date!");
    try {
      await setDoc(doc(db, "tournaments", "main"), {
        registrationOpen: true,
        registrationTitle: tournamentName,
        startDate: tournamentStartDate,
        endDate: tournamentEndDate,
        registeredTeamIds: [],
        createdAt: new Date(),
        status: "registration",
      });
    } catch (err) { Alert.alert("Error", err.message); }
  };

  const handleCloseRegistration = async () => {
    try {
      await updateDoc(doc(db, "tournaments", "main"), {
        registrationOpen: false,
        status: "setup",
      });
    } catch (err) { Alert.alert("Error", err.message); }
  };

  const handleRunDraw = async () => {
    const registeredTeams = approvedTeams.filter(t =>
      tournament?.registeredTeamIds?.includes(t.id)
    );
    const targetTeams = registeredTeams.length > 0 ? registeredTeams : approvedTeams;
    if (targetTeams.length < 3) {
      Alert.alert(`Need at least 3 teams. Currently: ${targetTeams.length}`);
      return;
    }
    const finalName = tournamentName.trim() || tournament?.registrationTitle;
    if (!finalName) return Alert.alert("Enter tournament name");
    if (tournamentDates.length === 0) return Alert.alert("Add at least one date");

    setWizardStep(2);
    setIsGenerating(true);
    try {
      const numTeams = targetTeams.length;
      let bracketSize = 4;
      if (numTeams > 4) bracketSize = 8;
      if (numTeams > 8) bracketSize = 16;
      if (numTeams > 16) bracketSize = 32;

      const shuffled = [...targetTeams].sort(() => Math.random() - 0.5);
      const numRounds = Math.log2(bracketSize);
      const rounds = {};

      for (let r = 0; r < numRounds; r++) {
        const numMatches = bracketSize / Math.pow(2, r + 1);
        rounds[`${r}`] = [];
        for (let m = 0; m < numMatches; m++) {
          const match = {
            id: `r${r}_m${m}`, round: r, matchIndex: m,
            team1: null, team2: null, winner: null,
            nextMatchId: r < numRounds - 1 ? `r${r + 1}_m${Math.floor(m / 2)}` : null,
            isBye: false, lockedByMatch: null,
          };
          if (r === 0) {
            if (m < numTeams) match.team1 = { id: shuffled[m].id, name: shuffled[m].teamName };
            const t2Idx = m + numMatches;
            if (t2Idx < numTeams) match.team2 = { id: shuffled[t2Idx].id, name: shuffled[t2Idx].teamName };
            if (match.team1 && !match.team2) { match.isBye = true; match.winner = match.team1; }
          }
          rounds[`${r}`].push(match);
        }
      }

      // advance byes
      rounds["0"].forEach(m => {
        if (m.winner && m.nextMatchId) {
          const nextR = `${parseInt(m.nextMatchId.split("_")[0].replace("r", ""))}`;
          const nextM = parseInt(m.nextMatchId.split("_")[1].replace("m", ""));
          if (m.matchIndex % 2 === 0) rounds[nextR][nextM].team1 = m.winner;
          else rounds[nextR][nextM].team2 = m.winner;
        }
      });

      const sortedDates = [...tournamentDates].sort((a, b) => a.date.localeCompare(b.date));
      const roundDateMap = computeRoundDateMap(numRounds, sortedDates);

      const dayTimeMap = {};
      for (let r = 0; r < numRounds; r++) {
        const dateObj = roundDateMap[r] || (sortedDates.length > 0 ? sortedDates[0] : null);
        if (!dateObj) continue;
        const rDate = dateObj.date;
        if (dayTimeMap[rDate] === undefined) {
          const [h, min] = dateObj.startTime.split(":").map(Number);
          dayTimeMap[rDate] = isNaN(h) ? 540 : h * 60 + (min || 0);
        }
        rounds[`${r}`].forEach(match => {
          const currentTime = dayTimeMap[rDate];
          const h = String(Math.floor(currentTime / 60)).padStart(2, "0");
          const m = String(currentTime % 60).padStart(2, "0");
          match.projectedTime = `${h}:${m}`;
          if (!match.isBye) dayTimeMap[rDate] += 30;
        });
      }

      // auto-schedule round 0
      if (sortedDates.length > 0) {
        const firstDateObj = roundDateMap[0] || sortedDates[0];
        for (const match of rounds["0"]) {
          if (match.isBye || !match.team1 || !match.team2) continue;
          await addDoc(collection(db, "matches"), {
            team1Id: match.team1.id,
            team2Id: match.team2.id,
            date: firstDateObj.date,
            time: match.projectedTime || "09:00",
            pitch: "Main Pitch",
            score: "",
            status: "scheduled",
            tournamentName: finalName,
            createdAt: new Date(),
          });
        }
      }

      await setDoc(doc(db, "tournaments", "main"), {
        name: finalName,
        status: "locked",
        bracketSize,
        numTeams,
        rounds,
        createdAt: new Date(),
        tournamentDates: sortedDates,
        roundDateMap,
      });

      setWizardStep(3);
    } catch (e) {
      Alert.alert("Error", e.message);
      setWizardStep(1);
    }
    setIsGenerating(false);
  };

  const handleManualAdvance = async (match, winnerTeam) => {
    if (!match.team1 || !match.team2 || match.winner) return;
    Alert.alert("Confirm", `Manually advance ${winnerTeam.name}?`, [
      { text: "Cancel" },
      {
        text: "Confirm", onPress: async () => {
          const newRounds = JSON.parse(JSON.stringify(tournament.rounds));
          const rIdx = `${match.round}`;
          const mIdx = match.matchIndex;
          newRounds[rIdx][mIdx].winner = winnerTeam;
          if (match.nextMatchId) {
            const nextR = `${parseInt(match.nextMatchId.split("_")[0].replace("r", ""))}`;
            const nextM = parseInt(match.nextMatchId.split("_")[1].replace("m", ""));
            if (mIdx % 2 === 0) newRounds[nextR][nextM].team1 = winnerTeam;
            else newRounds[nextR][nextM].team2 = winnerTeam;
          }
          await setDoc(doc(db, "tournaments", "main"), { ...tournament, rounds: newRounds });
        }
      }
    ]);
  };

  const handleClearTournament = async () => {
    Alert.alert("⚠️ DANGER", "End tournament? It will be archived.", [
      { text: "Cancel" },
      {
        text: "End Tournament", style: "destructive", onPress: async () => {
          const snap = await getDoc(doc(db, "tournaments", "main"));
          if (snap.exists()) {
            const data = snap.data();
            await setDoc(doc(db, "tournaments_archive", `tournament_${Date.now()}`), {
              ...data,
              archivedAt: new Date(),
              finalWinner: tournamentWinner ?? null,
            });
          }
          await deleteDoc(doc(db, "tournaments", "main"));
          setWizardStep(1);
        }
      }
    ]);
  };

  const handleForceReset = async () => {
    Alert.alert("WARNING", "Wipe current tournament data?", [
      { text: "Cancel" },
      {
        text: "Reset", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "tournaments", "main"));
          setWizardStep(1);
        }
      }
    ]);
  };

  // ─── Match result ────────────────────────────────────────────
  const openResultModal = async (match) => {
    const matchPlayers = players.filter(
      p => (p.teamId === match.team1Id || p.teamId === match.team2Id) && !p.suspendedForNextMatch
    );
    const initial = {};
    matchPlayers.forEach(p => { initial[p.id] = { goals: "0", yellow: "0", red: "0" }; });
    setPlayerStats(initial);
    setScore1("0"); setScore2("0"); setPen1("0"); setPen2("0");
    setResultMatch(match);
  };

  const handleFinalizeMatch = async () => {
    if (!resultMatch) return;

    const s1 = parseInt(score1) || 0;
    const s2 = parseInt(score2) || 0;
    const isDraw = s1 === s2;
    const p1 = parseInt(pen1) || 0;
    const p2 = parseInt(pen2) || 0;

    // Goal validation
    const team1Players = players.filter(p => p.teamId === resultMatch.team1Id && !p.suspendedForNextMatch);
    const team2Players = players.filter(p => p.teamId === resultMatch.team2Id && !p.suspendedForNextMatch);

    let totalGoals1 = 0;
    team1Players.forEach(p => { totalGoals1 += parseInt(playerStats[p.id]?.goals) || 0; });
    let totalGoals2 = 0;
    team2Players.forEach(p => { totalGoals2 += parseInt(playerStats[p.id]?.goals) || 0; });

    if (totalGoals1 !== s1) {
      Alert.alert("Error", `${resultMatch.team1Name}: Player goals (${totalGoals1}) ≠ Team score (${s1})`);
      return;
    }
    if (totalGoals2 !== s2) {
      Alert.alert("Error", `${resultMatch.team2Name}: Player goals (${totalGoals2}) ≠ Team score (${s2})`);
      return;
    }
    if (isDraw && (!pen1 || !pen2)) {
      Alert.alert("Enter penalty scores for both teams");
      return;
    }

    setIsSubmitting(true);
    try {
      let winnerId = null;
      let winnerName = null;

      if (s1 > s2) { winnerId = resultMatch.team1Id; winnerName = resultMatch.team1Name; }
      else if (s2 > s1) { winnerId = resultMatch.team2Id; winnerName = resultMatch.team2Name; }
      else {
        if (p1 > p2) { winnerId = resultMatch.team1Id; winnerName = resultMatch.team1Name; }
        else { winnerId = resultMatch.team2Id; winnerName = resultMatch.team2Name; }
      }

      const batch = writeBatch(db);
      const statsSnapshot = {};
      const tName = resultMatch.tournamentName || "General";

      for (const [pid, stats] of Object.entries(playerStats)) {
        const g = parseInt(stats.goals) || 0;
        const y = parseInt(stats.yellow) || 0;
        const r = parseInt(stats.red) || 0;
        const player = players.find(p => p.id === pid);
        if (!player) continue;

        if (g > 0 || y > 0 || r > 0) {
          statsSnapshot[pid] = { goals: g, yellow: y, red: r };
          batch.update(doc(db, "users", pid), {
            goals: increment(g),
            yellowCards: increment(y),
            redCards: increment(r),
            [`tournamentStats.${tName}.goals`]: increment(g),
            [`tournamentStats.${tName}.yellow`]: increment(y),
            [`tournamentStats.${tName}.red`]: increment(r),
          });
        }

        // Suspensions
        const totalYellow = (player.yellowCards || 0) + y;
        let suspendReason = null;
        if (r >= 1) suspendReason = "red";
        else if (y >= 2) suspendReason = "yellow";
        else if (totalYellow >= 2) suspendReason = "accumulated";
        if (suspendReason) {
          batch.update(doc(db, "users", pid), {
            suspendedForNextMatch: true,
            suspendReason,
          });
        }
      }

      const updateData = {
        status: "completed",
        score: `${s1} - ${s2}`,
        completedAt: new Date(),
        winnerName: winnerName || null,
        statsSnapshot,
      };
      if (isDraw) updateData.penalties = `${p1} - ${p2}`;
      batch.update(doc(db, "matches", resultMatch.id), updateData);

      // Advance bracket
      if (resultMatch.tournamentName && resultMatch.tournamentName !== "Friendly" && tournament?.rounds) {
        const snap = await getDoc(doc(db, "tournaments", "main"));
        if (snap.exists()) {
          const tData = snap.data();
          const newRounds = JSON.parse(JSON.stringify(tData.rounds));
          let found = false;
          for (const rKey of Object.keys(newRounds)) {
            for (const m of newRounds[rKey]) {
              const t1 = m.team1?.id;
              const t2 = m.team2?.id;
              const isMatch = (t1 === resultMatch.team1Id && t2 === resultMatch.team2Id) ||
                (t1 === resultMatch.team2Id && t2 === resultMatch.team1Id);
              if (isMatch && !m.winner) {
                m.winner = { id: winnerId, name: winnerName };
                if (m.nextMatchId) {
                  const nextR = `${parseInt(m.nextMatchId.split("_")[0].replace("r", ""))}`;
                  const nextM = parseInt(m.nextMatchId.split("_")[1].replace("m", ""));
                  if (m.matchIndex % 2 === 0) newRounds[nextR][nextM].team1 = { id: winnerId, name: winnerName };
                  else newRounds[nextR][nextM].team2 = { id: winnerId, name: winnerName };
                }
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (found) {
            await setDoc(doc(db, "tournaments", "main"), { ...tData, rounds: newRounds });
          }
        }
      }

      await batch.commit();
      Alert.alert("✅ Result saved!");
      setResultMatch(null);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setIsSubmitting(false);
  };

  const handleDeleteMatch = async (match) => {
    Alert.alert("Delete Match", "Stats will be rolled back.", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          const batch = writeBatch(db);
          if (match.status === "completed" && match.statsSnapshot) {
            const tName = match.tournamentName || "General";
            Object.entries(match.statsSnapshot).forEach(([pId, stats]) => {
              batch.update(doc(db, "users", pId), {
                goals: increment(-(stats.goals || 0)),
                yellowCards: increment(-(stats.yellow || 0)),
                redCards: increment(-(stats.red || 0)),
                [`tournamentStats.${tName}.goals`]: increment(-(stats.goals || 0)),
                [`tournamentStats.${tName}.yellow`]: increment(-(stats.yellow || 0)),
                [`tournamentStats.${tName}.red`]: increment(-(stats.red || 0)),
              });
            });
          }
          batch.delete(doc(db, "matches", match.id));
          await batch.commit();
        }
      }
    ]);
  };

  // ─── Team actions ─────────────────────────────────────────────
  const getTeamMembers = (team) =>
    players.filter(p => p.teamId && String(p.teamId).trim() === String(team.id).trim());

  const handleApproveTeam = async (teamId) => {
    await updateDoc(doc(db, "teams", teamId), { status: "approved" });
    Alert.alert("✅ Team Approved!");
  };

  const handleRejectTeam = async (team) => {
    Alert.alert("Reject Team", `Reject ${team.teamName}?`, [
      { text: "Cancel" },
      {
        text: "Reject", style: "destructive", onPress: async () => {
          const batch = writeBatch(db);
          (team.memberIds || []).forEach(id => {
            batch.update(doc(db, "users", id), { hasTeam: false, teamId: "", assignedTeam: "" });
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
          getTeamMembers(team).forEach(member => {
            batch.update(doc(db, "users", member.id), { hasTeam: false, teamId: "", assignedTeam: "" });
          });
          batch.delete(doc(db, "teams", team.id));
          await batch.commit();
        }
      }
    ]);
  };

  const handleRenameTeam = async (teamId) => {
    const newName = renameValue.trim();
    if (!newName) return Alert.alert("Team name cannot be empty");
    const teamObj = approvedTeams.find(t => t.id === teamId);
    if (newName === teamObj?.teamName) { setRenamingTeamId(null); return; }

    Alert.alert("Rename", `Rename "${teamObj?.teamName}" to "${newName}"?`, [
      { text: "Cancel" },
      {
        text: "Rename", onPress: async () => {
          const batch = writeBatch(db);
          batch.update(doc(db, "teams", teamId), { teamName: newName });
          getTeamMembers(teamObj).forEach(member => {
            batch.update(doc(db, "users", member.id), { assignedTeam: newName });
          });
          await batch.commit();

          // Update in tournament
          const tSnap = await getDoc(doc(db, "tournaments", "main"));
          if (tSnap.exists()) {
            const tData = tSnap.data();
            const newRounds = JSON.parse(JSON.stringify(tData.rounds || {}));
            for (const rKey of Object.keys(newRounds)) {
              for (const m of newRounds[rKey]) {
                if (m.team1?.id === teamId) m.team1.name = newName;
                if (m.team2?.id === teamId) m.team2.name = newName;
                if (m.winner?.id === teamId) m.winner.name = newName;
              }
            }
            await setDoc(doc(db, "tournaments", "main"), { ...tData, rounds: newRounds });
          }
          setRenamingTeamId(null);
        }
      }
    ]);
  };

  const handleRemovePlayer = async (teamId, teamName, member) => {
    Alert.alert("Remove", `Remove ${member.name} from ${teamName}?`, [
      { text: "Cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          const batch = writeBatch(db);
          batch.update(doc(db, "teams", teamId), {
            memberIds: arrayRemove(member.id),
            members: arrayRemove(member.name),
          });
          batch.update(doc(db, "users", member.id), { hasTeam: false, teamId: "", assignedTeam: "" });
          await batch.commit();
        }
      }
    ]);
  };

  const handleAddPlayerToTeam = async (teamId, teamName, playerId) => {
    const player = freeAgents.find(p => p.id === playerId);
    const teamObj = approvedTeams.find(t => t.id === teamId);
    const teamMembers = getTeamMembers(teamObj);
    if (teamMembers.length >= 7) return Alert.alert("Team is full!");

    Alert.alert("Add Player", `Add ${player.name} to ${teamName}?`, [
      { text: "Cancel" },
      {
        text: "Add", onPress: async () => {
          const batch = writeBatch(db);
          batch.update(doc(db, "teams", teamId), {
            memberIds: arrayUnion(player.id),
            members: arrayUnion(player.name),
          });
          batch.update(doc(db, "users", player.id), {
            hasTeam: true, teamId, assignedTeam: teamName,
          });
          await batch.commit();
          setAddPlayerModal(null);
        }
      }
    ]);
  };

  // ─── Player actions ──────────────────────────────────────────
  const handleManualVerify = async (player) => {
    Alert.alert("Activate", `Activate ${player.name}?`, [
      { text: "Cancel" },
      {
        text: "Activate", onPress: async () => {
          await updateDoc(doc(db, "users", player.id), { isVerified: true, manualActivation: true });
        }
      }
    ]);
  };

  const handleDeletePlayer = async (player) => {
    Alert.alert("Delete", `Delete ${player.name} permanently?`, [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteDoc(doc(db, "users", player.id)); } }
    ]);
  };

  const handleRemoveFromTeam = async (player) => {
    Alert.alert("Remove", `Remove ${player.name} from team?`, [
      { text: "Cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          await updateDoc(doc(db, "users", player.id), { hasTeam: false, teamId: "", assignedTeam: "" });
        }
      }
    ]);
  };

  // ─── Auto-build ──────────────────────────────────────────────
  const handleAutoBuild = async () => {
    if (freeAgents.length < buildCount) return Alert.alert("Not enough free agents");
    setIsBuilding(true);
    try {
      const selected = freeAgents.slice(0, buildCount);
      const name = buildTeamName.trim() || `Squad-${Math.floor(Math.random() * 999)}`;
      const batch = writeBatch(db);
      const teamRef = doc(collection(db, "teams"));
      batch.set(teamRef, {
        teamName: name, captainName: selected[0]?.name || "", status: "approved",
        members: selected.map(p => p.name), memberIds: selected.map(p => p.id), createdAt: new Date(),
      });
      selected.forEach(p => {
        batch.update(doc(db, "users", p.id), { hasTeam: true, teamId: teamRef.id, assignedTeam: name });
      });
      await batch.commit();
      Alert.alert(`✅ ${name} created!`);
      setShowBuildModal(false);
      setBuildTeamName("");
    } catch (e) { Alert.alert("Error", e.message); }
    setIsBuilding(false);
  };

  // ─── Settings ────────────────────────────────────────────────
  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return Alert.alert("Min 6 characters");
    try {
      await updatePassword(auth.currentUser, newPassword);
      Alert.alert("✅ Password updated!");
      setNewPassword("");
    } catch (e) { Alert.alert("Error", "Logout and login again first."); }
  };

  const handleFixDatabase = async () => {
    setIsFixing(true);
    try {
      const batch = writeBatch(db);
      const teamsSnap = await getDocs(collection(db, "teams"));
      const usersSnap = await getDocs(collection(db, "users"));
      const existingTeamIds = teamsSnap.docs.map(d => d.id);
      let fixCount = 0;
      usersSnap.docs.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.hasTeam && !existingTeamIds.includes(userData.teamId)) {
          batch.update(doc(db, "users", userDoc.id), { hasTeam: false, teamId: "", assignedTeam: "" });
          fixCount++;
        }
      });
      if (fixCount > 0) {
        await batch.commit();
        Alert.alert(`✅ Fixed ${fixCount} ghost players.`);
      } else {
        Alert.alert("Database healthy! No issues found.");
      }
    } catch (e) { Alert.alert("Error", e.message); }
    setIsFixing(false);
  };

  const handleResetSystem = async () => {
    Alert.alert("⚠️ CRITICAL WARNING", "Wipe ALL teams, matches, and stats?", [
      { text: "Cancel" },
      {
        text: "RESET", style: "destructive", onPress: async () => {
          setIsResetting(true);
          try {
            const batch = writeBatch(db);
            for (const col of ["teams", "matches"]) {
              const snap = await getDocs(collection(db, col));
              snap.docs.forEach(d => batch.delete(doc(db, col, d.id)));
            }
            const usersSnap = await getDocs(collection(db, "users"));
            usersSnap.docs.forEach(d => batch.update(doc(db, "users", d.id), {
              goals: 0, yellowCards: 0, redCards: 0, hasTeam: false, teamId: "", assignedTeam: ""
            }));
            await batch.commit();
            Alert.alert("✅ System Reset!");
          } catch (e) { Alert.alert("Error", e.message); }
          setIsResetting(false);
        }
      }
    ]);
  };

  // ─── Displayed players ───────────────────────────────────────
  const allPlayers = players.filter(p => p.role === "student" || p.role === "player");

  const availableTournaments = useMemo(() => {
    const names = new Set();
    allPlayers.forEach(p => {
      if (p.tournamentStats) Object.keys(p.tournamentStats).forEach(n => names.add(n));
    });
    return Array.from(names).sort();
  }, [allPlayers]);

  const getStat = (player, statType) => {
    if (statsFilter === "total") {
      if (statType === "goals") return Number(player.goals) || 0;
      if (statType === "yellow") return Number(player.yellowCards) || 0;
      if (statType === "red") return Number(player.redCards) || 0;
      return 0;
    }
    return Number(player.tournamentStats?.[statsFilter]?.[statType]) || 0;
  };

  const sortedByGoals = [...allPlayers].sort((a, b) => getStat(b, "goals") - getStat(a, "goals"));

  const displayedPlayers = useMemo(() => {
    let list = showTop10 ? sortedByGoals.slice(0, 10) : allPlayers;
    if (playersSubTab === "pending") list = list.filter(p => !p.isVerified);
    else if (playersSubTab === "free") list = list.filter(p => !p.hasTeam);
    else if (playersSubTab === "solo") list = list.filter(p => p.searchingForTeam && !p.hasTeam);
    if (searchTerm.trim()) {
      list = list.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.assignedTeam?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return list;
  }, [allPlayers, playersSubTab, searchTerm, showTop10, statsFilter]);

  const getPlayerRank = (playerId) => {
    const idx = sortedByGoals.findIndex(p => p.id === playerId);
    return idx !== -1 ? idx + 1 : "--";
  };

  // ─── Filtered teams ──────────────────────────────────────────
  const filteredTeams = approvedTeams.filter(t =>
    t.teamName?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // ─── Matches for current sub-tab ─────────────────────────────
  const currentMatches = useMemo(() => {
    if (matchSubTab === "upcoming") return upcomingMatches;
    if (matchSubTab === "live") return liveMatches;
    if (matchSubTab === "pending") return pendingResultMatches;
    return completedMatches;
  }, [matchSubTab, upcomingMatches, liveMatches, pendingResultMatches, completedMatches]);

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerLogo}>
            <Text style={s.headerLogoText}>SFC</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>Science FC League</Text>
            <Text style={s.headerSub}>ADMIN PORTAL</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={s.addBtn} onPress={() => { setAddModalView("options"); setShowAddModal(true); }}>
            <Text style={s.addBtnText}> + Create </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ════ DASHBOARD ════ */}
        {activeTab === "dashboard" && (
          <View style={s.tabContent}>
            {/* Stats Grid */}
            <View style={s.statsGrid}>
              <StatCard label="Total Players" value={stats.total} icon="👥" color="#00FF9C" />
              <StatCard label="Pending" value={stats.pending} icon="⏳" color="#fbbf24" />
              <StatCard label="Free Agents" value={stats.free} icon="🏃" color="#60a5fa" />
              <StatCard label="Matches" value={completedMatches.length + liveMatches.length} icon="⚽" color="#a78bfa" />
            </View>

            {/* Champion Banner */}
            {tournamentWinner && (
              <View style={s.championBanner}>
                <Text style={s.championIcon}>🏆</Text>
                <View style={{ alignItems: "center" }}>
                  <Text style={s.championLabel}>TOURNAMENT CHAMPION</Text>
                  <Text style={s.championName}>{tournamentWinner.name}</Text>
                </View>
                <Text style={s.championIcon}>🏆</Text>
              </View>
            )}

            {/* Tabs */}
            <View style={s.dashTabRow}>
              {[
                { id: "live", label: "Live Matches" },
                { id: "history", label: "History" },
                { id: "requests", label: `Requests (${pendingTeams.length})` },
              ].map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveClick(tab.id)}
                  style={[s.dashTab, activeClick === tab.id && s.dashTabActive]}
                >
                  <Text style={[s.dashTabText, activeClick === tab.id && s.dashTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* LIVE */}
            {activeClick === "live" && (
              liveMatches.length === 0
                ? <EmptyState icon="⚽" text="No live matches right now" sub="Check back during match hours" />
                : liveMatches.map(m => (
                  <MatchCardNative key={m.id} match={m} type="live"
                    roundLabel={getMatchRoundLabel(m)}
                    onEnterResult={() => openResultModal(m)}
                    onDelete={() => handleDeleteMatch(m)} />
                ))
            )}

            {/* HISTORY */}
            {activeClick === "history" && (
              completedMatches.length === 0
                ? <EmptyState icon="📋" text="No finished matches yet" />
                : completedMatches.map(m => (
                  <MatchCardNative key={m.id} match={m} type="completed"
                    roundLabel={getMatchRoundLabel(m)}
                    onDelete={() => handleDeleteMatch(m)} />
                ))
            )}

            {/* TEAM REQUESTS */}
            {activeClick === "requests" && (
              pendingTeams.length === 0
                ? <EmptyState icon="👥" text="No pending requests" />
                : pendingTeams.map(team => (
                  <View key={team.id} style={s.requestCard}>
                    <View style={s.requestCardHeader}>
                      <View>
                        <Text style={s.requestTeamName}>{team.teamName}</Text>
                        <Text style={s.requestCaptain}>Captain: {team.captainName || "Unknown"}</Text>
                      </View>
                      <View style={s.playerCountBadge}>
                        <Text style={s.playerCountText}>{team.memberIds?.length || 0} Players</Text>
                      </View>
                    </View>
                    <View style={s.memberTags}>
                      {team.members?.slice(0, 5).map((name, i) => (
                        <View key={i} style={s.memberTag}><Text style={s.memberTagText}>{name}</Text></View>
                      ))}
                      {team.members?.length > 5 && (
                        <View style={s.memberTag}><Text style={s.memberTagText}>+{team.members.length - 5}</Text></View>
                      )}
                    </View>
                    <View style={s.requestActions}>
                      <TouchableOpacity style={s.approveBtn} onPress={() => handleApproveTeam(team.id)}>
                        <Text style={s.approveBtnText}>Approve Team</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.rejectBtn} onPress={() => handleRejectTeam(team)}>
                        <Text style={s.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            )}
          </View>
        )}

        {/* ════ MATCHES TAB ════ */}
        {activeTab === "matches" && (
          <View style={s.tabContent}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>🏆 Match Schedule</Text>
            </View>

            {/* Match Sub-Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              <View style={s.matchTabRow}>
                {[
                  { id: "upcoming", label: " Upcoming ", count: upcomingMatches.length, color: "#00FF9C" },
                  { id: "live", label: " Live ", count: liveMatches.length, color: "#ef4444" },
                  { id: "pending", label: " Pending ", count: pendingResultMatches.length, color: "#fbbf24" },
                  { id: "completed", label: " Done ", count: completedMatches.length, color: "#00FF9C" },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setMatchSubTab(tab.id)}
                    style={[s.matchTabBtn, matchSubTab === tab.id && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}
                  >
                    <Text style={[s.matchTabText, matchSubTab === tab.id && { color: tab.color }]}>
                      {tab.label} ({tab.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {currentMatches.length === 0
              ? <EmptyState icon="⚽" text={`No ${matchSubTab} matches`} />
              : currentMatches.map(m => (
                <MatchCardNative key={m.id} match={m} type={matchSubTab}
                  roundLabel={getMatchRoundLabel(m)}
                  onEnterResult={() => openResultModal(m)}
                  onDelete={() => handleDeleteMatch(m)} />
              ))
            }

            {/* Footer stats */}
            <View style={s.matchStatsFooter}>
              <View style={s.matchStat}>
                <Text style={s.matchStatNum}>{upcomingMatches.length + liveMatches.length + completedMatches.length}</Text>
                <Text style={s.matchStatLabel}>Total</Text>
              </View>
              <View style={s.matchStatDivider} />
              <View style={s.matchStat}>
                <Text style={[s.matchStatNum, { color: "#00FF9C" }]}>{upcomingMatches.length}</Text>
                <Text style={s.matchStatLabel}>Upcoming</Text>
              </View>
              <View style={s.matchStatDivider} />
              <View style={s.matchStat}>
                <Text style={[s.matchStatNum, { color: "#ef4444" }]}>{liveMatches.length}</Text>
                <Text style={s.matchStatLabel}>Live</Text>
              </View>
            </View>
          </View>
        )}

        {/* ════ TEAMS TAB ════ */}
        {activeTab === "teams" && (
          <View style={s.tabContent}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>🏆 Tournament Teams</Text>
              <Text style={s.pageSub}>Meet the competing teams and their statistics</Text>
            </View>

            {/* Search */}
            <View style={s.searchBox}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Search teams..."
                placeholderTextColor="#6c7b91"
                value={teamSearch}
                onChangeText={setTeamSearch}
              />
              {teamSearch ? (
                <TouchableOpacity onPress={() => setTeamSearch("")}>
                  <Text style={{ color: "#6c7b91", fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {filteredTeams.length === 0
              ? <EmptyState text="No teams found" />
              : filteredTeams.map(team => {
                const members = getTeamMembers(team);
                const isRenaming = renamingTeamId === team.id;

                return (
                  <View key={team.id} style={s.teamCard}>
                    {/* Team Header */}
                    <View style={s.teamCardHeader}>
                      <View style={{ flex: 1 }}>
                        {isRenaming ? (
                          <View style={s.renameRow}>
                            <TextInput
                              style={s.renameInput}
                              value={renameValue}
                              onChangeText={setRenameValue}
                              autoFocus
                            />
                            <TouchableOpacity onPress={() => handleRenameTeam(team.id)} style={s.renameConfirm}>
                              <Text style={{ color: "#00FF9C", fontWeight: "bold" }}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setRenamingTeamId(null)} style={s.renameCancel}>
                              <Text style={{ color: "#ef4444", fontWeight: "bold" }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={s.teamNameRow}>
                            <Text style={s.teamCardName}>{team.teamName}</Text>
                            <TouchableOpacity onPress={() => { setRenamingTeamId(team.id); setRenameValue(team.teamName); }}>
                              <Text style={{ color: "#64748b", fontSize: 13, marginLeft: 10 }}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        <View style={s.captainBadge}>
                          <Text style={s.captainBadgeText}>🛡 {team.captainName || "No Leader"}</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteTeam(team)}>
                        <Text style={{ color: "#000000", fontSize: 18 }}> Delete </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Members */}
                    <View style={s.teamMembers}>
                      {members.map((member) => {
                        const suspended = !!member.suspendedForNextMatch;
                        const suspType = getSuspensionType(member);
                        return (
                          <TouchableOpacity
                            key={member.id}
                            style={[
                              s.memberRow,
                              suspended && (suspType === "red" ? s.memberRowRed : s.memberRowYellow)
                            ]}
                            onPress={() => setSelectedMember(member)}
                          >
                            <View style={[s.memberDot, { backgroundColor: suspended ? (suspType === "red" ? "#ef4444" : "#eab308") : "#00FF9C" }]} />
                            <Text style={s.memberName}>{member.name}</Text>
                            {String(member.id) === String(team.captainId) && (
                              <Text style={{ color: "#00FF9C", fontSize: 10, marginLeft: 4 }}>🛡</Text>
                            )}
                            {suspended && <Text style={{ fontSize: 10, marginLeft: 4 }}>{suspType === "red" ? "🟥" : "🟨"}</Text>}
                            <TouchableOpacity
                              style={{ marginLeft: "auto" }}
                              onPress={() => handleRemovePlayer(team.id, team.teamName, member)}
                            >
                              <Text style={{ color: "#475569", fontSize: 14 }}> ✕ </Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                      {members.length === 0 && (
                        <Text style={{ color: "#8e9aaa", fontSize: 12, textAlign: "center", padding: 8 }}>No players yet</Text>
                      )}
                    </View>

                    {/* Add Player */}
                    <TouchableOpacity
                      style={s.addPlayerBtn}
                      onPress={() => setAddPlayerModal(team.id)}
                    >
                      <Text style={s.addPlayerBtnText}> + Add Free Agent </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            }
          </View>
        )}

        {/* ════ PLAYERS TAB ════ */}
        {activeTab === "players" && (
          <View style={s.tabContent}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>🏃 All Players</Text>
              <Text style={s.pageSub}>
                {showTop10 ? "Top 10 Legends" : `${allPlayers.length} players • ${freeAgents.length} free agents`}
              </Text>
            </View>

            {/* Search */}
            <View style={s.searchBox}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Search by name, team..."
                placeholderTextColor="#6e7989"
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>

            {/* Filter Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={s.filterRow}>
                {[
                  { id: "all", label: "All" },
                  { id: "pending", label: `Pending (${allPlayers.filter(p => !p.isVerified).length})` },
                  { id: "free", label: `Free (${freeAgents.length})` },
                  { id: "solo", label: "Solo" },
                ].map(f => (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setPlayersSubTab(f.id)}
                    style={[s.filterBtn, playersSubTab === f.id && s.filterBtnActive]}
                  >
                    <Text style={[s.filterBtnText, playersSubTab === f.id && s.filterBtnTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Top 10 toggle + Stats filter */}
            <View style={s.playerToolbar}>
              <TouchableOpacity
                style={[s.top10Btn, showTop10 && s.top10BtnActive]}
                onPress={() => setShowTop10(!showTop10)}
              >
                <Text style={[s.top10BtnText, showTop10 && { color: "#fbbf24" }]}>
                  ✨ Top 10 Legends
                </Text>
              </TouchableOpacity>
            </View>

            {/* Player List */}
            {displayedPlayers.length === 0
              ? <EmptyState text="No players found" />
              : displayedPlayers.map((player, idx) => {
                const rank = getPlayerRank(player.id);
                const suspended = !!player.suspendedForNextMatch;
                const suspType = getSuspensionType(player);

                return (
                  <View key={player.id} style={[s.playerCard, suspended && s.playerCardSuspended]}>
                    <View style={s.playerRankBadge}>
                      <Text style={[s.playerRank, rank <= 3 && { color: "#fbbf24" }]}>#{rank}</Text>
                    </View>
                    <View style={s.playerAvatar}>
                      <Text style={s.playerAvatarText}>{player.name?.[0]?.toUpperCase() || "?"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.playerName}>{player.name || "Unknown"}</Text>
                      <Text style={s.playerSub}>{player.studentCode || "No ID"} • {player.position || "N/A"}</Text>
                      {player.hasTeam && (
                        <Text style={s.playerTeam}>{player.assignedTeam}</Text>
                      )}
                      <View style={s.playerStats}>
                        <Text style={s.playerStatGoals}> ⚽ {getStat(player, "goals")}</Text>
                        <Text style={s.playerStatYellow}> 🟨 {getStat(player, "yellow")}</Text>
                        <Text style={s.playerStatRed}> 🟥 {getStat(player, "red")}</Text>
                        {suspended && (
                          <Text style={[s.suspendBadge, { backgroundColor: suspType === "red" ? "#ef444422" : "#eab30822" }]}>
                            {suspType === "red" ? "🟥 BANNED" : "🟨 SUSP"}
                          </Text>
                        )}
                      </View>
                      <View style={s.passRow}>
                        <Text style={s.passLabel}>🔑</Text>
                        <Text style={s.passValue}>{player.password || "—"}</Text>
                      </View>
                    </View>
                    <View style={s.playerActions}>
                      {!player.isVerified ? (
                        <TouchableOpacity style={s.activateBtn} onPress={() => handleManualVerify(player)}>
                          <Text style={s.activateBtnText}>Activate</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={s.verifiedBadge}><Text style={s.verifiedText}>✓ Active</Text></View>
                      )}
                      <TouchableOpacity
                        style={s.playerActionBtn}
                        onPress={() => player.hasTeam ? handleRemoveFromTeam(player) : handleDeletePlayer(player)}
                      >
                        <Text style={{ color: "#ef4444" }}>{player.hasTeam ? "👤−" : "🗑"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            }

            {/* Auto-build FAB */}
            {freeAgents.length >= 2 && (
              <TouchableOpacity style={s.fab} onPress={() => setShowBuildModal(true)}>
                <Text style={s.fabText}>✨</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ════ TOURNAMENT TAB ════ */}
        {activeTab === "tournament" && (
          <View style={s.tabContent}>
            <View style={s.tournamentHeader}>
              <Text style={s.pageTitle}> Tournament</Text>
              {!tournament?.rounds && (
                <TouchableOpacity style={s.forceResetBtn} onPress={handleForceReset}>
                  <Text style={s.forceResetText}>Force Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Champion Banner */}
            {tournamentWinner && (
              <View style={s.championBanner}>
                <Text style={s.championIcon}>🏆</Text>
                <View style={{ alignItems: "center" }}>
                  <Text style={s.championLabel}>TOURNAMENT CHAMPION</Text>
                  <Text style={s.championName}>{tournamentWinner.name}</Text>
                </View>
                <Text style={s.championIcon}>🏆</Text>
              </View>
            )}

            {/* Wizard Steps */}
            {!tournament?.rounds && (
              <View style={s.wizardSteps}>
                <WizardStep step={1} current={wizardStep} label="Setup" />
                <Text style={s.wizardArrow}>›</Text>
                <WizardStep step={2} current={wizardStep} label="Draw" />
                <Text style={s.wizardArrow}>›</Text>
                <WizardStep step={3} current={wizardStep} label="Bracket" />
              </View>
            )}

            {/* Step 1 - Setup */}
            {wizardStep === 1 && !tournament?.rounds && (
              <View style={s.tournamentSetup}>
                {/* Registration not open */}
                {!tournament?.registrationOpen && !tournament?.registeredTeamIds && (
                  <View style={s.setupCard}>
                    <Text style={s.setupCardTitle}>1. Announce Tournament</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="e.g. Ramadan Cup 2025"
                      placeholderTextColor="#475569"
                      value={tournamentName}
                      onChangeText={setTournamentName}
                    />
                    <Text style={s.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="2025-01-01"
                      placeholderTextColor="#475569"
                      value={tournamentStartDate}
                      onChangeText={setTournamentStartDate}
                    />
                    <Text style={s.inputLabel}>End Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={s.modalInput}
                      placeholder="2025-01-15"
                      placeholderTextColor="#475569"
                      value={tournamentEndDate}
                      onChangeText={setTournamentEndDate}
                    />
                    <TouchableOpacity style={s.primaryBtn} onPress={handleOpenRegistration}>
                      <Text style={s.primaryBtnText}>Open Registration</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Registration open */}
                {tournament?.registrationOpen && (
                  <View style={s.setupCard}>
                    <View style={s.regLiveHeader}>
                      <Text style={s.regLiveTitle}>🟢 Registration Live: {tournament.registrationTitle}</Text>
                      <View style={s.pulseDot} />
                    </View>
                    <Text style={s.regRange}>
                      {tournament.startDate} → {tournament.endDate}
                    </Text>
                    {tournament.registeredTeamIds?.map(tid => {
                      const t = approvedTeams.find(x => x.id === tid);
                      return (
                        <View key={tid} style={s.registeredTeamRow}>
                          <Text style={s.registeredTeamName}>{t?.teamName || tid}</Text>
                          <Text style={{ color: "#00FF9C" }}>✓</Text>
                        </View>
                      );
                    })}
                    <TouchableOpacity style={s.dangerBtn} onPress={handleCloseRegistration}>
                      <Text style={s.dangerBtnText}>Close Registration</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Setup phase */}
                {!tournament?.registrationOpen && (tournament?.registeredTeamIds || tournament?.status === "setup") && (
                  <View style={s.setupCard}>
                    <Text style={s.setupCardTitle}>Schedule Dates</Text>

                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                      <TextInput
                        style={[s.modalInput, { flex: 1, marginBottom: 0 }]}
                        placeholder="Date (YYYY-MM-DD)"
                        placeholderTextColor="#475569"
                        value={dateInput}
                        onChangeText={setDateInput}
                      />
                      <TextInput
                        style={[s.modalInput, { width: 100, marginBottom: 0 }]}
                        placeholder="Time"
                        placeholderTextColor="#475569"
                        value={tournamentStartTime}
                        onChangeText={setTournamentStartTime}
                      />
                    </View>
                    <TouchableOpacity
                      style={[s.secondaryBtn, { marginBottom: 12 }]}
                      onPress={() => {
                        if (!dateInput) return;
                        if (tournamentDates.some(d => d.date === dateInput)) return;
                        setTournamentDates([...tournamentDates, { date: dateInput, startTime: tournamentStartTime }].sort((a, b) => a.date.localeCompare(b.date)));
                        setDateInput("");
                      }}
                    >
                      <Text style={s.secondaryBtnText}>Add Date</Text>
                    </TouchableOpacity>

                    {tournamentDates.map(item => (
                      <View key={item.date} style={s.dateTag}>
                        <Text style={s.dateTagText}>{item.date} @ {item.startTime}</Text>
                        <TouchableOpacity onPress={() => setTournamentDates(tournamentDates.filter(d => d.date !== item.date))}>
                          <Text style={{ color: "#ef4444" }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]} onPress={handleRunDraw}>
                      <Text style={s.primaryBtnText}>
                        🎲 Initiate Draw ({tournament?.registeredTeamIds?.length || approvedTeams.length} Teams)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Step 2 - Generating */}
            {wizardStep === 2 && isGenerating && (
              <View style={s.generatingContainer}>
                <ActivityIndicator size="large" color="#00FF9C" />
                <Text style={s.generatingTitle}>Generating Bracket...</Text>
                <Text style={s.generatingSubtext}>Randomizing team seeds</Text>
              </View>
            )}

            {/* Step 3 - Bracket */}
            {(wizardStep === 3 || (tournament?.rounds)) && !isGenerating && (
              <View>
                <View style={s.bracketHeader}>
                  <Text style={s.bracketTitle}>🗂 Official Bracket • {tournament?.numTeams} Teams</Text>
                  <TouchableOpacity style={s.dangerBtnSmall} onPress={handleClearTournament}>
                    <Text style={s.dangerBtnSmallText}>End Tournament</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 16, padding: 8 }}>
                    {tournament?.rounds && Object.keys(tournament.rounds)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((rKey, rIdx) => {
                        const totalRounds = Object.keys(tournament.rounds).length;
                        return (
                          <View key={rKey} style={s.bracketColumn}>
                            <Text style={s.bracketRoundLabel}>
                              {getRoundLabel(rIdx, totalRounds)}
                            </Text>
                            {tournament.rounds[rKey].map(match => (
                              <View key={match.id} style={s.bracketMatch}>
                                {/* Match time */}
                                {(match.projectedTime || tournament.roundDateMap?.[rKey]) && !match.winner && (
                                  <Text style={s.bracketMatchTime}>
                                    📅 {tournament.roundDateMap?.[rKey]?.date || ""} {match.projectedTime || ""}
                                  </Text>
                                )}
                                {/* Team 1 */}
                                <TouchableOpacity
                                  style={[
                                    s.bracketTeamSlot,
                                    match.winner?.id === match.team1?.id && s.bracketTeamSlotWinner,
                                  ]}
                                  onPress={() => match.team1 && match.team2 && !match.winner && handleManualAdvance(match, match.team1)}
                                  disabled={!match.team1 || !match.team2 || !!match.winner}
                                >
                                  <Text style={[s.bracketTeamText, match.winner?.id === match.team1?.id && { color: "#00FF9C" }]}>
                                    {match.team1?.name || "TBD"}
                                  </Text>
                                  {match.winner?.id === match.team1?.id && <Text style={{ color: "#00FF9C", fontSize: 10 }}>✓</Text>}
                                </TouchableOpacity>

                                {/* Team 2 or BYE */}
                                {match.isBye ? (
                                  <View style={s.byeSlot}>
                                    <Text style={s.byeText}>BYE</Text>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={[
                                      s.bracketTeamSlot,
                                      match.winner?.id === match.team2?.id && s.bracketTeamSlotWinner,
                                    ]}
                                    onPress={() => match.team1 && match.team2 && !match.winner && handleManualAdvance(match, match.team2)}
                                    disabled={!match.team1 || !match.team2 || !!match.winner}
                                  >
                                    <Text style={[s.bracketTeamText, match.winner?.id === match.team2?.id && { color: "#00FF9C" }]}>
                                      {match.team2?.name || "TBD"}
                                    </Text>
                                    {match.winner?.id === match.team2?.id && <Text style={{ color: "#00FF9C", fontSize: 10 }}>✓</Text>}
                                  </TouchableOpacity>
                                )}
                              </View>
                            ))}
                          </View>
                        );
                      })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Archive */}
            {archived.length > 0 && (
              <View style={s.archiveSection}>
                <TouchableOpacity style={s.archiveToggle} onPress={() => setShowArchive(v => !v)}>
                  <Text style={s.archiveToggleText}>📦 Past Tournaments ({archived.length})</Text>
                  <Text style={{ color: "#64748b" }}>{showArchive ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {showArchive && archived.map(t => (
                  <View key={t.id} style={s.archiveCard}>
                    <Text style={s.archiveCardTitle}>{t.name || "Unnamed Tournament"}</Text>
                    {t.finalWinner && (
                      <Text style={s.archiveWinner}>🏆 {t.finalWinner.name}</Text>
                    )}
                    <Text style={s.archiveDate}>{t.numTeams} teams • {Object.keys(t.rounds || {}).length} rounds</Text>
                    <TouchableOpacity
                      style={s.deleteArchiveBtn}
                      onPress={() => {
                        Alert.alert("Delete", "Delete this archived tournament?", [
                          { text: "Cancel" },
                          {
                            text: "Delete", style: "destructive", onPress: async () => {
                              await deleteDoc(doc(db, "tournaments_archive", t.id));
                              setArchived(prev => prev.filter(x => x.id !== t.id));
                            }
                          }
                        ]);
                      }}
                    >
                      <Text style={s.deleteArchiveBtnText}>🗑 Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ════ SETTINGS TAB ════ */}
        {activeTab === "settings" && (
          <View style={s.tabContent}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>⚙️ Admin Control Room</Text>
              <Text style={s.pageSub}>Manage security, database, and tournament settings</Text>
            </View>

            {/* Security */}
            <View style={s.settingCard}>
              <Text style={s.settingCardTitle}>🔑 Admin Security</Text>
              <Text style={s.settingCardSub}>Change your account password</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.modalInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="New password..."
                  placeholderTextColor="#475569"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity style={s.updatePassBtn} onPress={handleUpdatePassword}>
                  <Text style={s.updatePassText}>💾 Update</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Maintenance */}
            <View style={s.settingCard}>
              <Text style={s.settingCardTitle}>🔧 Maintenance Tools</Text>
              <Text style={s.settingCardSub}>Database cleanup and system utilities</Text>
              <View style={s.maintenanceRow}>
                <TouchableOpacity style={s.maintenanceBtn} onPress={handleFixDatabase} disabled={isFixing}>
                  <Text style={s.maintenanceBtnText}>{isFixing ? "Fixing..." : "🔧 Fix Ghost Players"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Danger Zone */}
            <View style={[s.settingCard, s.dangerCard]}>
              <Text style={[s.settingCardTitle, { color: "#ef4444" }]}>⚠️ Danger Zone</Text>
              <Text style={[s.settingCardSub, { color: "#ef444466" }]}>Irreversible actions - proceed with caution</Text>
              <TouchableOpacity style={s.dangerBtn} onPress={handleResetSystem} disabled={isResetting}>
                <Text style={s.dangerBtnText}>{isResetting ? "Resetting..." : "🗄 Reset Tournament"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.dangerBtn, { marginTop: 8, backgroundColor: "transparent" }]} onPress={() => signOut(auth)}>
                <Text style={[s.dangerBtnText, { color: "#64748b" }]}>🚪 Sign Out</Text>
              </TouchableOpacity>
              <Text style={s.dangerWarning}>⚠️ Reset will clear all teams, matches, and player stats</Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={s.bottomNav}>
        <NavBtn icon="🏠" label="HOME" active={activeTab === "dashboard"} onPress={() => setActiveTab("dashboard")} />
        <NavBtn icon="🏃" label="PLAYERS" active={activeTab === "players"} onPress={() => setActiveTab("players")} />
        <NavBtn icon="🛡" label="TEAMS" active={activeTab === "teams"} onPress={() => setActiveTab("teams")} />
        <NavBtn icon="🗂" label="TOURNAMENT" active={activeTab === "tournament"} onPress={() => setActiveTab("tournament")} />
        <NavBtn icon="📅" label="MATCHES" active={activeTab === "matches"} onPress={() => setActiveTab("matches")} />
        <NavBtn icon="⚙️" label="SETTINGS" active={activeTab === "settings"} onPress={() => setActiveTab("settings")} />
      </View>

      {/* ════ ADD MODAL ════ */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              {addModalView !== "options" && (
                <TouchableOpacity onPress={() => setAddModalView("options")} style={{ marginRight: 12 }}>
                  <Text style={{ color: "#94a3b8" }}> ← Back </Text>
                </TouchableOpacity>
              )}
              <Text style={s.modalTitle}>
                {addModalView === "options" ? "Quick Actions" : addModalView === "teamForm" ? "New Team" : "Schedule Match"}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ marginLeft: "auto" }}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {addModalView === "options" && (
              <View style={{ gap: 12 }}>
                <TouchableOpacity style={s.optionCard} onPress={() => setAddModalView("teamForm")}>
                  <Text style={{ fontSize: 28 }}>🛡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionTitle}>Add Team</Text>
                    <Text style={s.optionSub}>Create and approve a new team</Text>
                  </View>
                  <Text style={{ color: "#64748b" }}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.optionCard} onPress={() => setAddModalView("matchForm")}>
                  <Text style={{ fontSize: 28 }}>⚽</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionTitle}>Schedule Match</Text>
                    <Text style={s.optionSub}>Create a game fixture</Text>
                  </View>
                  <Text style={{ color: "#64748b" }}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            {addModalView === "teamForm" && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput style={s.modalInput} placeholder="Team Name" placeholderTextColor="#475569"
                  value={newTeamName} onChangeText={setNewTeamName} />
                <TextInput style={s.modalInput} placeholder="Captain Name" placeholderTextColor="#475569"
                  value={newCaptainName} onChangeText={setNewCaptainName} />
                <Text style={s.inputLabel}>Add Players (Optional, max 7)</Text>
                {freeAgents.slice(0, 20).map(p => {
                  const sel = selectedFreeAgents.some(x => x.id === p.id);
                  return (
                    <TouchableOpacity key={p.id} style={[s.agentRow, sel && s.agentRowSelected]}
                      onPress={() => {
                        if (sel) setSelectedFreeAgents(prev => prev.filter(x => x.id !== p.id));
                        else if (selectedFreeAgents.length < 7) setSelectedFreeAgents(prev => [...prev, p]);
                        else Alert.alert("Max 7 players");
                      }}>
                      <Text style={[{ color: "#e2e8f0" }, sel && { color: "#00FF9C" }]}>
                        {sel ? "✓ " : ""}{p.name}
                      </Text>
                      <Text style={{ color: "#475569", fontSize: 11 }}>{p.studentCode}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]}
                  onPress={async () => {
                    if (!newTeamName.trim() || !newCaptainName.trim()) return Alert.alert("Enter team name and captain name");
                    setIsSaving(true);
                    try {
                      const batch = writeBatch(db);
                      const teamRef = doc(collection(db, "teams"));
                      batch.set(teamRef, {
                        teamName: newTeamName.trim(), captainName: newCaptainName.trim(),
                        status: "approved",
                        members: selectedFreeAgents.map(p => p.name),
                        memberIds: selectedFreeAgents.map(p => p.id),
                        createdAt: new Date(),
                      });
                      selectedFreeAgents.forEach(p => {
                        batch.update(doc(db, "users", p.id), { hasTeam: true, teamId: teamRef.id, assignedTeam: newTeamName.trim() });
                      });
                      await batch.commit();
                      Alert.alert(" Team Created! ");
                      setShowAddModal(false);
                      setNewTeamName(""); setNewCaptainName(""); setSelectedFreeAgents([]);
                    } catch (e) { Alert.alert("Error", e.message); }
                    setIsSaving(false);
                  }} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>Create Team</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}

            {addModalView === "matchForm" && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.inputLabel}>Home Team</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {approvedTeams.map(t => (
                    <TouchableOpacity key={t.id} style={[s.teamPill, newMatchTeam1?.id === t.id && s.teamPillActive]}
                      onPress={() => setNewMatchTeam1(t)}>
                      <Text style={[s.teamPillText, newMatchTeam1?.id === t.id && { color: "#000" }]}>{t.teamName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={s.inputLabel}>Away Team</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {approvedTeams.map(t => (
                    <TouchableOpacity key={t.id} style={[s.teamPill, newMatchTeam2?.id === t.id && { backgroundColor: "#a855f7" }]}
                      onPress={() => setNewMatchTeam2(t)}>
                      <Text style={[s.teamPillText, newMatchTeam2?.id === t.id && { color: "#fff" }]}>{t.teamName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={s.modalInput} placeholder="Date (YYYY-MM-DD)" placeholderTextColor="#475569"
                  value={newMatchDate} onChangeText={setNewMatchDate} />
                <TextInput style={s.modalInput} placeholder="Time (HH:MM)" placeholderTextColor="#475569"
                  value={newMatchTime} onChangeText={setNewMatchTime} />
                <Text style={s.inputLabel}>Pitch</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {["Main Pitch", "Pitch 2", "Pitch 3"].map(p => (
                    <TouchableOpacity key={p} style={[s.teamPill, newMatchPitch === p && { backgroundColor: "#00FF9C" }]}
                      onPress={() => setNewMatchPitch(p)}>
                      <Text style={[s.teamPillText, newMatchPitch === p && { color: "#000" }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: "#00FF9C" }]}
                  onPress={async () => {
                    if (!newMatchTeam1 || !newMatchTeam2) return Alert.alert("Select both teams");
                    if (newMatchTeam1.id === newMatchTeam2.id) return Alert.alert("Select different teams");
                    setIsSaving(true);
                    try {
                      await addDoc(collection(db, "matches"), {
                        team1Id: newMatchTeam1.id, team2Id: newMatchTeam2.id,
                        date: newMatchDate, time: newMatchTime, pitch: newMatchPitch,
                        score: "", status: "scheduled",
                        tournamentName: tournament?.name || "Friendly",
                        createdAt: new Date(),
                      });
                      Alert.alert(" Match Scheduled!");
                      setShowAddModal(false);
                      setNewMatchTeam1(null); setNewMatchTeam2(null);
                      setNewMatchDate(""); setNewMatchTime("");
                    } catch (e) { Alert.alert("Error", e.message); }
                    setIsSaving(false);
                  }} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : <Text style={[s.primaryBtnText, { color: "#000" }]}>Schedule Match</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ════ RESULT MODAL ════ */}
      <Modal visible={!!resultMatch} transparent animationType="slide" onRequestClose={() => setResultMatch(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: "92%" }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>⚽ Post-Match Report</Text>
              <TouchableOpacity onPress={() => setResultMatch(null)} style={{ marginLeft: "auto" }}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {resultMatch && (
              <Text style={s.resultMatchNames}>{resultMatch.team1Name} vs {resultMatch.team2Name}</Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Score */}
              <View style={s.scoreSection}>
                <Text style={s.scoreSectionTitle}>Match Score</Text>
                <View style={s.scoreRow}>
                  <View style={s.scoreTeam}>
                    <Text style={s.scoreTeamName}>{resultMatch?.team1Name}</Text>
                    <TextInput style={s.scoreInput} value={score1} onChangeText={setScore1}
                      keyboardType="number-pad" maxLength={2} />
                  </View>
                  <Text style={s.scoreVs}>VS</Text>
                  <View style={s.scoreTeam}>
                    <Text style={s.scoreTeamName}>{resultMatch?.team2Name}</Text>
                    <TextInput style={s.scoreInput} value={score2} onChangeText={setScore2}
                      keyboardType="number-pad" maxLength={2} />
                  </View>
                </View>
              </View>

              {/* Penalties */}
              {score1 === score2 && score1 !== "0" && (
                <View style={s.penSection}>
                  <Text style={s.penTitle}>⚡ DRAW — Penalty Shootout</Text>
                  <View style={s.scoreRow}>
                    <TextInput style={[s.scoreInput, { width: 70, height: 70 }]}
                      value={pen1} onChangeText={setPen1} keyboardType="number-pad" />
                    <Text style={{ color: "#64748b", fontSize: 24 }}>-</Text>
                    <TextInput style={[s.scoreInput, { width: 70, height: 70 }]}
                      value={pen2} onChangeText={setPen2} keyboardType="number-pad" />
                  </View>
                </View>
              )}

              {/* Player Stats */}
              <Text style={s.statsSectionTitle}>📊 Match Statistics</Text>
              {resultMatch && [
                { teamId: resultMatch.team1Id, teamName: resultMatch.team1Name },
                { teamId: resultMatch.team2Id, teamName: resultMatch.team2Name },
              ].map(({ teamId, teamName }) => (
                <View key={teamId}>
                  <Text style={s.teamStatsLabel}>🟢 {teamName}</Text>
                  {players.filter(p => p.teamId === teamId && !p.suspendedForNextMatch).map(player => (
                    <View key={player.id} style={s.playerStatRow}>
                      <View style={s.playerStatInfo}>
                        <Text style={s.playerStatName}>{player.name}</Text>
                        <Text style={s.playerStatPos}>{player.position || "Player"}</Text>
                      </View>
                      <View style={s.playerStatInputs}>
                        {[
                          { key: "goals", label: "⚽", color: "#00FF9C" },
                          { key: "yellow", label: "🟨", color: "#eab308" },
                          { key: "red", label: "🟥", color: "#ef4444" },
                        ].map(field => (
                          <View key={field.key} style={s.statInputGroup}>
                            <Text style={s.statInputLabel}>{field.label}</Text>
                            <TextInput
                              style={[s.statInput, { borderColor: field.color + "44" }]}
                              value={playerStats[player.id]?.[field.key] ?? "0"}
                              onChangeText={v => setPlayerStats(prev => ({
                                ...prev,
                                [player.id]: { ...(prev[player.id] || {}), [field.key]: v }
                              }))}
                              keyboardType="number-pad"
                              maxLength={2}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              <TouchableOpacity style={[s.primaryBtn, { marginTop: 20 }]}
                onPress={handleFinalizeMatch} disabled={isSubmitting}>
                {isSubmitting
                  ? <ActivityIndicator color="#000" />
                  : <Text style={[s.primaryBtnText, { color: "#000" }]}>✅ Finalize & Archive Match</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ ADD PLAYER TO TEAM MODAL ════ */}
      <Modal visible={!!addPlayerModal} transparent animationType="slide" onRequestClose={() => setAddPlayerModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>+ Add Free Agent</Text>
              <TouchableOpacity onPress={() => setAddPlayerModal(null)} style={{ marginLeft: "auto" }}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {freeAgents.length === 0
                ? <Text style={{ color: "#64748b", textAlign: "center", padding: 20 }}>No free agents available</Text>
                : freeAgents.map(p => (
                  <TouchableOpacity key={p.id} style={s.agentRow}
                    onPress={() => {
                      const team = approvedTeams.find(t => t.id === addPlayerModal);
                      if (team) handleAddPlayerToTeam(team.id, team.teamName, p.id);
                    }}>
                    <Text style={{ color: "#e2e8f0", fontWeight: "bold" }}>{p.name}</Text>
                    <Text style={{ color: "#64748b", fontSize: 11 }}>{p.position || "N/A"}</Text>
                  </TouchableOpacity>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ PLAYER DETAIL MODAL ════ */}
      <Modal visible={!!selectedMember} transparent animationType="fade" onRequestClose={() => setSelectedMember(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: 400 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Player Details</Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)} style={{ marginLeft: "auto" }}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedMember && (
              <View style={{ alignItems: "center" }}>
                <View style={s.memberDetailAvatar}>
                  <Text style={s.memberDetailAvatarText}>{selectedMember.name?.[0]?.toUpperCase()}</Text>
                </View>
                <Text style={s.memberDetailName}>{selectedMember.name}</Text>
                <Text style={{ color: "#00FF9C", fontSize: 11, fontWeight: "bold", marginBottom: 20 }}>
                  {selectedMember.position || "Player"}
                </Text>
                <View style={s.memberDetailStats}>
                  <View style={s.memberDetailStat}>
                    <Text style={s.memberDetailStatNum}>{selectedMember.goals || 0}</Text>
                    <Text style={s.memberDetailStatLabel}>Goals</Text>
                  </View>
                  <View style={s.memberDetailStat}>
                    <Text style={[s.memberDetailStatNum, { color: "#eab308" }]}>{selectedMember.yellowCards || 0}</Text>
                    <Text style={s.memberDetailStatLabel}>Yellow</Text>
                  </View>
                  <View style={s.memberDetailStat}>
                    <Text style={[s.memberDetailStatNum, { color: "#ef4444" }]}>{selectedMember.redCards || 0}</Text>
                    <Text style={s.memberDetailStatLabel}>Red</Text>
                  </View>
                </View>
                <TouchableOpacity style={[s.primaryBtn, { width: "100%", marginTop: 20 }]} onPress={() => setSelectedMember(null)}>
                  <Text style={[s.primaryBtnText, { color: "#000" }]}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ════ AUTO-BUILD MODAL ════ */}
      <Modal visible={showBuildModal} transparent animationType="fade" onRequestClose={() => setShowBuildModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>✨ Auto-Build Squad</Text>
              <TouchableOpacity onPress={() => setShowBuildModal(false)} style={{ marginLeft: "auto" }}>
                <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.modalInput} placeholder="Team Name (optional)" placeholderTextColor="#475569"
              value={buildTeamName} onChangeText={setBuildTeamName} />
            <Text style={s.inputLabel}>Team Size</Text>
            <View style={s.countBtnRow}>
              {[2, 3, 4, 5, 6, 7].map(n => (
                <TouchableOpacity key={n} style={[s.countBtn, buildCount === n && s.countBtnActive]}
                  onPress={() => setBuildCount(n)}>
                  <Text style={[s.countBtnText, buildCount === n && { color: "#000" }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: "#64748b", textAlign: "center", marginBottom: 12, fontSize: 12 }}>
              {freeAgents.length} free agents available
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={handleAutoBuild}
              disabled={isBuilding || freeAgents.length < buildCount}>
              {isBuilding
                ? <ActivityIndicator color="#000" />
                : <Text style={[s.primaryBtnText, { color: "#000" }]}>Build Squad ({buildCount} players)</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────
const StatCard = ({ label, value, icon, color }) => (
  <View style={[s.statCard, { borderTopColor: color }]}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
      <Text style={s.statCardLabel}>{label}</Text>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <Text style={[s.statCardValue, { color }]}>{value}</Text>
  </View>
);

const NavBtn = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={s.navBtn} onPress={onPress}>
    <Text style={{ fontSize: 20 }}>{icon}</Text>
    <Text style={[s.navLabel, active && { color: "#00FF9C" }]}>{label}</Text>
  </TouchableOpacity>
);

const EmptyState = ({ icon, text, sub }) => (
  <View style={s.emptyState}>
    <Text style={{ fontSize: 40, marginBottom: 12 }}>{icon}</Text>
    <Text style={s.emptyStateText}>{text}</Text>
    {sub && <Text style={s.emptyStateSub}>{sub}</Text>}
  </View>
);

const WizardStep = ({ step, current, label }) => {
  const done = step < current;
  const active = step === current;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[s.wizardStepCircle, active && s.wizardStepActive, done && s.wizardStepDone]}>
        <Text style={[s.wizardStepNum, (active || done) && { color: "#000" }]}>
          {done ? "✓" : step}
        </Text>
      </View>
      <Text style={[s.wizardStepLabel, active && { color: "#fff" }, done && { color: "#00FF9C" }]}>{label}</Text>
    </View>
  );
};

const MatchCardNative = ({ match, type, roundLabel, onEnterResult, onDelete }) => {
  const isLive = type === "live";
  const isPending = type === "pending";
  const isCompleted = type === "completed";

  return (
    <View style={[
      s.matchCard,
      isLive && s.matchCardLive,
      isPending && s.matchCardPending,
    ]}>
      {/* Header */}
      <View style={[s.matchCardHeader, isLive && s.matchCardHeaderLive, isPending && s.matchCardHeaderPending]}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flex: 1 }}>
          {roundLabel && (
            <View style={s.roundBadge}>
              <Text style={s.roundBadgeText}>{roundLabel}</Text>
            </View>
          )}
          {match.tournamentName && (
            <Text style={s.tournamentBadge}>{match.tournamentName}</Text>
          )}
          <Text style={[s.matchStatusText, isLive && { color: "#ef4444" }, isPending && { color: "#fbbf24" }, isCompleted && { color: "#00FF9C" }]}>
            {isLive ? "🔴 LIVE" : isPending ? "⏳ PENDING" : isCompleted ? "✅ DONE" : "📅 UPCOMING"}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete}>
          <Text style={{ color: "#64748b" }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Teams */}
      <View style={s.matchTeamsRow}>
        <View style={s.matchTeamSide}>
          <View style={s.matchTeamIcon}><Text style={{ fontSize: 20 }}>⚽</Text></View>
          <Text style={s.matchTeamName} numberOfLines={1}>{match.team1Name}</Text>
          {isCompleted && match.score && (
            <Text style={s.matchScore}>{match.score.split("-")[0]?.trim()}</Text>
          )}
        </View>
        <View style={s.matchVsCircle}>
          <Text style={s.matchVsText}>VS</Text>
        </View>
        <View style={[s.matchTeamSide, { alignItems: "flex-end" }]}>
          <View style={s.matchTeamIcon}><Text style={{ fontSize: 20 }}>⚽</Text></View>
          <Text style={s.matchTeamName} numberOfLines={1}>{match.team2Name}</Text>
          {isCompleted && match.score && (
            <Text style={s.matchScore}>{match.score.split("-")[1]?.trim()}</Text>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={s.matchInfo}>
        {match.date && <Text style={s.matchInfoText}>📅 {match.date}</Text>}
        {match.time && <Text style={s.matchInfoText}>🕐 {match.time}</Text>}
        {match.pitch && <Text style={s.matchInfoText}>📍 {match.pitch}</Text>}
      </View>

      {/* Penalties */}
      {isCompleted && match.penalties && (
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <Text style={s.penBadge}>Penalties: {match.penalties}</Text>
        </View>
      )}

      {/* Action */}
      {!isCompleted && !isLive && onEnterResult && (
        <TouchableOpacity
          style={[s.enterResultBtn, isPending && s.enterResultBtnPending]}
          onPress={onEnterResult}
        >
          <Text style={[s.enterResultText, isPending && { color: "#000" }]}>
            {isPending ? "Submit Match Score" : "Enter Results Early"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderBottomWidth: 1, borderBottomColor: "rgba(218, 197, 197, 0.08)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#00FF9C", justifyContent: "center", alignItems: "center",
  },
  headerLogoText: { color: "#000", fontWeight: "900", fontSize: 12 },
  headerTitle: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  headerSub: { color: "#64748b", fontSize: 8, letterSpacing: 2, marginTop: 1 },
  addBtn: {
    backgroundColor: "#00FF9C", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnText: { color: "#000", fontWeight: "bold", fontSize: 13 },

  // Content
  tabContent: { padding: 16, paddingBottom: 8 },
  pageHeader: { marginBottom: 16 },
  pageTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  pageSub: { color: "#64748b", fontSize: 12, marginTop: 4 },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: "#0f172a",
    borderRadius: 16, padding: 14, borderTopWidth: 3,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  statCardLabel: { color: "#64748b", fontSize: 11, fontWeight: "bold" },
  statCardValue: { color: "#fff", fontSize: 30, fontWeight: "900", marginTop: 4 },

  // Champion
  championBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, backgroundColor: "rgba(234,179,8,0.08)",
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(234,179,8,0.3)",
    marginBottom: 16,
  },
  championIcon: { fontSize: 28 },
  championLabel: { color: "#eab308", fontSize: 9, fontWeight: "bold", letterSpacing: 2 },
  championName: { color: "#fff", fontSize: 22, fontWeight: "900", textTransform: "uppercase" },

  // Dash tabs
  dashTabRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  dashTab: { paddingBottom: 10, paddingHorizontal: 4, marginRight: 16 },
  dashTabActive: { borderBottomWidth: 2, borderBottomColor: "#00FF9C" },
  dashTabText: { color: "#64748b", fontSize: 14, fontWeight: "bold" },
  dashTabTextActive: { color: "#00FF9C" },

  // Request card
  requestCard: {
    backgroundColor: "#0f172a", borderRadius: 16, padding: 16, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: "#3b82f6",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  requestCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  requestTeamName: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  requestCaptain: { color: "#64748b", fontSize: 12, marginTop: 2 },
  playerCountBadge: { backgroundColor: "rgba(0,255,156,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  playerCountText: { color: "#00FF9C", fontWeight: "bold", fontSize: 11 },
  memberTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  memberTag: { backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  memberTagText: { color: "#e2e8f0", fontSize: 11, fontWeight: "bold" },
  requestActions: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, backgroundColor: "#00FF9C", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  approveBtnText: { color: "#000", fontWeight: "bold", textTransform: "uppercase", fontSize: 12 },
  rejectBtn: {
    flex: 1, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12, paddingVertical: 12,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
  },
  rejectBtnText: { color: "#ef4444", fontWeight: "bold", textTransform: "uppercase", fontSize: 12 },
  deleteBtn: {
    backgroundColor: "#ef4444", paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 15,
  },

  // Match tabs
  matchTabRow: { flexDirection: "row", gap: 0 },
  matchTabBtn: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0, borderBottomColor: "transparent" },
  matchTabText: { color: "#64748b", fontWeight: "bold", fontSize: 12 },
  matchStatsFooter: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 20, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  matchStat: { alignItems: "center" },
  matchStatNum: { color: "#fff", fontSize: 24, fontWeight: "900" },
  matchStatLabel: { color: "#64748b", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  matchStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.08)" },

  // Match card
  matchCard: {
    backgroundColor: "#0f172a", borderRadius: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  matchCardLive: { borderColor: "rgba(239,68,68,0.4)" },
  matchCardPending: { borderColor: "rgba(251,191,36,0.4)" },
  matchCardHeader: {
    flexDirection: "row", alignItems: "center", padding: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  matchCardHeaderLive: { backgroundColor: "rgba(239,68,68,0.1)" },
  matchCardHeaderPending: { backgroundColor: "rgba(251,191,36,0.08)" },
  roundBadge: { backgroundColor: "rgba(0,255,156,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  roundBadgeText: { color: "#00FF9C", fontSize: 9, fontWeight: "bold" },
  tournamentBadge: { color: "#fbbf24", fontWeight: "bold", fontSize: 11 },
  matchStatusText: { color: "#64748b", fontSize: 9, fontWeight: "bold", textTransform: "uppercase" },
  matchTeamsRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  matchTeamSide: { flex: 1, alignItems: "center" },
  matchTeamIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  matchTeamName: { color: "#fff", fontWeight: "bold", fontSize: 13, textAlign: "center" },
  matchScore: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  matchVsCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#1e293b",
    alignItems: "center", justifyContent: "center",
  },
  matchVsText: { color: "#475569", fontSize: 10, fontWeight: "bold" },
  matchInfo: {
    flexDirection: "row", justifyContent: "center", gap: 12,
    paddingVertical: 8, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
  },
  matchInfoText: { color: "#64748b", fontSize: 10 },
  penBadge: { color: "#fbbf24", fontSize: 10, fontWeight: "bold", backgroundColor: "rgba(251,191,36,0.1)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  enterResultBtn: {
    margin: 12, marginTop: 4, backgroundColor: "#00FF9C", borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
  },
  enterResultBtnPending: { backgroundColor: "#fbbf24" },
  enterResultText: { color: "#000", fontWeight: "bold", fontSize: 12, textTransform: "uppercase" },

  // Teams
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 2, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: { marginRight: 8, fontSize: 14 },
  searchInput: { flex: 1, color: "#fff", height: 44, fontSize: 14 },
  teamCard: {
    backgroundColor: "#0f172a", borderRadius: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  teamCardHeader: {
    flexDirection: "row", alignItems: "flex-start", padding: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  teamNameRow: { flexDirection: "row", alignItems: "center" },
  teamCardName: { color: "#fff", fontSize: 20, fontWeight: "900" },
  captainBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,255,156,0.08)", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6,
    alignSelf: "flex-start",
  },
  captainBadgeText: { color: "#00FF9C", fontSize: 11, fontWeight: "bold" },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  renameInput: {
    flex: 1, backgroundColor: "#1e293b", borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, color: "#fff", fontSize: 16, fontWeight: "bold",
    borderWidth: 1, borderColor: "#00FF9C",
  },
  renameConfirm: { padding: 6 },
  renameCancel: { padding: 6 },
  teamMembers: { padding: 12, gap: 4 },
  memberRow: {
    flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  memberRowRed: { backgroundColor: "rgba(239,68,68,0.08)" },
  memberRowYellow: { backgroundColor: "rgba(234,179,8,0.08)" },
  memberDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  memberName: { color: "#e2e8f0", fontWeight: "600", flex: 1 },
  addPlayerBtn: {
    margin: 12, marginTop: 0, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)",
    borderRadius: 12, paddingVertical: 10, alignItems: "center",
    backgroundColor: "rgba(0,255,156,0.04)",
  },
  addPlayerBtnText: { color: "#00FF9C", fontWeight: "bold", fontSize: 12 },

  // Players
  filterRow: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  filterBtnActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  filterBtnText: { color: "#64748b", fontWeight: "bold", fontSize: 11 },
  filterBtnTextActive: { color: "#000" },
  playerToolbar: { flexDirection: "row", marginBottom: 14 },
  top10Btn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  top10BtnActive: { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.4)" },
  top10BtnText: { color: "#64748b", fontWeight: "bold", fontSize: 12 },
  playerCard: {
    flexDirection: "row", gap: 10, backgroundColor: "#0f172a",
    borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "flex-start",
  },
  playerCardSuspended: { borderColor: "rgba(239,68,68,0.3)" },
  playerRankBadge: { width: 28 },
  playerRank: { color: "#64748b", fontWeight: "bold", fontSize: 13 },
  playerAvatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(0,255,156,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(0,255,156,0.3)",
  },
  playerAvatarText: { color: "#00FF9C", fontSize: 18, fontWeight: "bold" },
  playerName: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  playerSub: { color: "#64748b", fontSize: 10, marginTop: 2 },
  playerTeam: { color: "#00FF9C", fontSize: 10, fontWeight: "bold", marginTop: 2 },
  playerStats: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" },
  playerStatGoals: { color: "#00FF9C", fontSize: 11, fontWeight: "bold" },
  playerStatYellow: { color: "#eab308", fontSize: 11, fontWeight: "bold" },
  playerStatRed: { color: "#ef4444", fontSize: 11, fontWeight: "bold" },
  suspendBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontSize: 9, fontWeight: "bold", color: "#fff" },
  passRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  passLabel: { color: "#64748b", fontSize: 10, marginRight: 4 },
  passValue: { color: "#fbbf24", fontSize: 10, fontStyle: "italic", fontWeight: "bold" },
  playerActions: { alignItems: "flex-end", gap: 8 },
  activateBtn: { backgroundColor: "#ea580c", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activateBtnText: { color: "#fff", fontWeight: "bold", fontSize: 10 },
  verifiedBadge: { backgroundColor: "rgba(0,255,156,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { color: "#00FF9C", fontSize: 10, fontWeight: "bold" },
  playerActionBtn: { padding: 4 },
  fab: {
    position: "absolute", bottom: 16, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#00FF9C", alignItems: "center", justifyContent: "center",
    shadowColor: "#00FF9C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  fabText: { fontSize: 24 },

  // Tournament
  tournamentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  forceResetBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  forceResetText: { color: "#ef4444", fontSize: 11, fontWeight: "bold" },
  wizardSteps: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 },
  wizardArrow: { color: "rgba(0,255,156,0.3)", fontSize: 24, fontWeight: "bold" },
  wizardStepCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#334155",
  },
  wizardStepActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  wizardStepDone: { backgroundColor: "rgba(0,255,156,0.2)", borderColor: "#00FF9C" },
  wizardStepNum: { color: "#64748b", fontWeight: "bold", fontSize: 14 },
  wizardStepLabel: { color: "#64748b", fontSize: 9, fontWeight: "bold", textTransform: "uppercase", marginTop: 4 },
  tournamentSetup: { gap: 0 },
  setupCard: {
    backgroundColor: "#0f172a", borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(0,255,156,0.15)",
  },
  setupCardTitle: { color: "#00FF9C", fontWeight: "bold", fontSize: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  regLiveHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  regLiveTitle: { color: "#00FF9C", fontWeight: "bold", fontSize: 13 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#00FF9C" },
  regRange: { color: "#64748b", fontSize: 11, marginBottom: 12 },
  registeredTeamRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 8, marginBottom: 4,
  },
  registeredTeamName: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  dateTag: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(0,255,156,0.08)", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 6,
  },
  dateTagText: { color: "#00FF9C", fontWeight: "bold", fontSize: 12 },
  generatingContainer: { alignItems: "center", padding: 40, gap: 16 },
  generatingTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  generatingSubtext: { color: "#64748b", fontSize: 12 },
  bracketHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  bracketTitle: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  bracketColumn: { width: 180 },
  bracketRoundLabel: {
    color: "#00FF9C", fontSize: 10, fontWeight: "bold", textTransform: "uppercase",
    textAlign: "center", marginBottom: 12, letterSpacing: 1,
  },
  bracketMatch: {
    backgroundColor: "#0f172a", borderRadius: 12, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  bracketMatchTime: { color: "#64748b", fontSize: 8, marginBottom: 6, textAlign: "center" },
  bracketTeamSlot: {
    padding: 10, borderRadius: 8, marginBottom: 4,
    backgroundColor: "#1e293b", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  bracketTeamSlotWinner: { backgroundColor: "rgba(0,255,156,0.1)", borderColor: "rgba(0,255,156,0.3)" },
  bracketTeamText: { color: "#e2e8f0", fontWeight: "bold", fontSize: 11 },
  byeSlot: {
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#334155",
    borderStyle: "dashed", alignItems: "center",
  },
  byeText: { color: "#475569", fontWeight: "bold", fontSize: 11 },
  archiveSection: { marginTop: 24 },
  archiveToggle: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#0f172a", padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 8,
  },
  archiveToggleText: { color: "#64748b", fontWeight: "bold", fontSize: 12 },
  archiveCard: {
    backgroundColor: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  archiveCardTitle: { color: "#fff", fontWeight: "bold", fontSize: 14, marginBottom: 4 },
  archiveWinner: { color: "#fbbf24", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  archiveDate: { color: "#64748b", fontSize: 11 },
  deleteArchiveBtn: { marginTop: 8, alignSelf: "flex-end" },
  deleteArchiveBtnText: { color: "#ef4444", fontSize: 11 },

  // Settings
  settingCard: {
    backgroundColor: "#0f172a", borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  dangerCard: { borderColor: "rgba(239,68,68,0.2)" },
  settingCardTitle: { color: "#fff", fontWeight: "bold", fontSize: 15, marginBottom: 4 },
  settingCardSub: { color: "#64748b", fontSize: 11, marginBottom: 14 },
  passwordRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  updatePassBtn: { backgroundColor: "#3b82f6", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  updatePassText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  maintenanceRow: { gap: 8 },
  maintenanceBtn: {
    backgroundColor: "rgba(0,255,156,0.1)", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)",
    borderRadius: 12, paddingVertical: 12, alignItems: "center",
  },
  maintenanceBtnText: { color: "#00FF9C", fontWeight: "bold", fontSize: 12 },
  dangerWarning: { color: "#64748b", fontSize: 10, textAlign: "center", marginTop: 12, textTransform: "uppercase" },

  // Bottom nav
  bottomNav: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: "rgba(2,6,23,0.97)",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
    paddingBottom: 28, paddingTop: 10,
  },
  navBtn: { alignItems: "center", gap: 3 },
  navLabel: { color: "#475569", fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#0f172a", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", maxHeight: "88%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  modalTitle: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  inputLabel: { color: "#64748b", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", marginBottom: 6, marginTop: 2 },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14,
    color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 12,
  },
  optionCard: {
    flexDirection: "row", gap: 14, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  optionTitle: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  optionSub: { color: "#64748b", fontSize: 12, marginTop: 2 },
  agentRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  agentRowSelected: { backgroundColor: "rgba(0,255,156,0.08)", borderColor: "rgba(0,255,156,0.3)" },
  teamPill: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  teamPillActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  teamPillText: { color: "#94a3b8", fontWeight: "bold", fontSize: 12 },
  countBtnRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  countBtn: {
    width: 46, height: 46, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  countBtnActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  countBtnText: { color: "#94a3b8", fontWeight: "bold" },

  // Result modal
  resultMatchNames: { color: "#94a3b8", textAlign: "center", marginBottom: 16, fontSize: 13 },
  scoreSection: {
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 14,
  },
  scoreSectionTitle: { color: "#00FF9C", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", marginBottom: 14 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  scoreTeam: { alignItems: "center" },
  scoreTeamName: { color: "#64748b", fontSize: 10, marginBottom: 8, textTransform: "uppercase", fontWeight: "bold" },
  scoreInput: {
    width: 90, height: 90, backgroundColor: "#1e293b", borderRadius: 20,
    color: "#fff", fontSize: 40, fontWeight: "900", textAlign: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.1)",
  },
  scoreVs: { color: "#334155", fontSize: 24, fontWeight: "bold" },
  penSection: {
    backgroundColor: "rgba(251,191,36,0.06)", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(251,191,36,0.2)", marginBottom: 14,
  },
  penTitle: { color: "#fbbf24", fontSize: 11, fontWeight: "bold", textAlign: "center", marginBottom: 12 },
  statsSectionTitle: { color: "#fff", fontSize: 13, fontWeight: "bold", marginBottom: 12 },
  teamStatsLabel: { color: "#00FF9C", fontSize: 11, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase" },
  playerStatRow: {
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.04)",
  },
  playerStatInfo: { marginBottom: 10 },
  playerStatName: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  playerStatPos: { color: "#64748b", fontSize: 10, marginTop: 2 },
  playerStatInputs: { flexDirection: "row", gap: 14 },
  statInputGroup: { alignItems: "center" },
  statInputLabel: { fontSize: 14, marginBottom: 6 },
  statInput: {
    width: 52, height: 52, backgroundColor: "#1e293b", borderRadius: 12,
    color: "#fff", fontSize: 20, fontWeight: "bold", textAlign: "center",
    borderWidth: 2,
  },

  // Member detail modal
  memberDetailAvatar: {
    width: 70, height: 70, borderRadius: 20,
    backgroundColor: "rgba(0,255,156,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(0,255,156,0.3)", marginBottom: 12,
  },
  memberDetailAvatarText: { color: "#00FF9C", fontSize: 28, fontWeight: "bold" },
  memberDetailName: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  memberDetailStats: { flexDirection: "row", gap: 20 },
  memberDetailStat: { alignItems: "center", backgroundColor: "#1e293b", borderRadius: 12, padding: 14, minWidth: 70 },
  memberDetailStatNum: { color: "#fff", fontSize: 24, fontWeight: "900" },
  memberDetailStatLabel: { color: "#64748b", fontSize: 9, textTransform: "uppercase", marginTop: 4 },

  // Buttons
  primaryBtn: {
    backgroundColor: "#00FF9C", borderRadius: 14, paddingVertical: 16, alignItems: "center",
  },
  primaryBtnText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "rgba(0,255,156,0.1)", borderRadius: 12, paddingVertical: 12,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)",
  },
  secondaryBtnText: { color: "#00FF9C", fontWeight: "bold", fontSize: 13 },
  dangerBtn: {
    backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", marginTop: 4,
  },
  dangerBtnText: { color: "#ef4444", fontWeight: "bold", fontSize: 13, textTransform: "uppercase" },
  dangerBtnSmall: {
    backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  dangerBtnSmallText: { color: "#ef4444", fontWeight: "bold", fontSize: 11 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyStateText: { color: "#64748b", fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  emptyStateSub: { color: "#334155", fontSize: 12 },
});
