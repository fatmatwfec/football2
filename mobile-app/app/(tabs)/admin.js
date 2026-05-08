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
import AIChatSidebar from "../Aichatsidebar";

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
export default function admin() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAI, setShowAI] = useState(false);
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
  const [showMatchModal, setShowMatchModal] = useState(null); 

  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth() + 1);
  const [tempDay, setTempDay] = useState(new Date().getDate());
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);
  const [datePickerTarget, setDatePickerTarget] = useState(null);

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
  const [showStatsPicker, setShowStatsPicker] = useState(false);

  // Teams
  const [teamSearch, setTeamSearch] = useState("");
  const [renamingTeamId, setRenamingTeamId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [addPlayerModal, setAddPlayerModal] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState({});

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
  const [expandedArchive, setExpandedArchive] = useState({});
  //  const [scheduleModal, setScheduleModal] = useState(null);

  // Build squad
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [buildTeamName, setBuildTeamName] = useState("");
  const [buildCount, setBuildCount] = useState(5);
  const [isBuilding, setIsBuilding] = useState(false);

  // Match tab
  const [matchSubTab, setMatchSubTab] = useState("upcoming");
  const [roundFilter, setRoundFilter] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
    const nowMs = Date.now();
    setNow(nowMs);

    const DURATION = 20 * 60 * 1000;
    const toUpdate = matches.filter(m => {
      if (m.status === 'completed') return false;
      if (!m.date || !m.time) return false;
      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(y, mm - 1, d, h, min).getTime();
      const isLive = matchTime <= nowMs && nowMs < matchTime + DURATION;
      const isPast = nowMs >= matchTime + DURATION;
      if (isLive && m.status !== 'live') return true;
      if (isPast && m.status !== 'pending_result') return true;
      return false;
    });

    if (toUpdate.length > 0) {
      const batch = writeBatch(db);
      const nowMs2 = Date.now();
      toUpdate.forEach(m => {
        const [y, mm, d] = m.date.split('-').map(Number);
        const [h, min] = m.time.split(':').map(Number);
        const matchTime = new Date(y, mm - 1, d, h, min).getTime();
        const newStatus = (matchTime <= nowMs2 && nowMs2 < matchTime + DURATION)
          ? 'live' : 'pending_result';
        batch.update(doc(db, 'matches', m.id), { status: newStatus });
      });
      try { await batch.commit(); } catch (e) { console.error(e); }
    }
      
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/(auth)/login"); return; }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists() || snap.data().role !== "admin") router.replace("/(tabs)");
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      setStats(prev => ({ ...prev, total: all.length, free: all.filter(u => !u.hasTeam && u.role !== "admin").length }));
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
      const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() }))
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

  useEffect(() => {
    const fetchArchive = async () => {
      const snap = await getDocs(collection(db, "tournaments_archive"));
      setArchived(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.archivedAt?.toDate?.() ?? new Date(0)) - (a.archivedAt?.toDate?.() ?? new Date(0))));
    };
    fetchArchive();
  }, []);

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
        team2Name: resolveTeamName(m.team2Id, m.team2Name)
      })),
    [matches, resolveTeamName]);


  const DURATION = 20 * 60 * 1000;

  const upcomingMatches = useMemo(() => enrichedMatches.filter(m => {
    if (m.status === 'completed') return false;
    if (!m.date || !m.time) return true;
    const [y, mm, d] = m.date.split("-").map(Number);
    const [h, min] = m.time.split(":").map(Number);
    const matchTime = new Date(y, mm - 1, d, h, min).getTime();
    return matchTime > now;
  }), [enrichedMatches, now]);


  const liveMatches = useMemo(() => enrichedMatches.filter(m => {
    if (m.status === "completed") return false;
    if (!m.date || !m.time) return false;
    const [y, mm, d] = m.date.split("-").map(Number);
    const [h, min] = m.time.split(":").map(Number);
    const matchTime = new Date(y, mm - 1, d, h, min).getTime();
    return (matchTime <= now && now < (matchTime + DURATION));
  }), [enrichedMatches, now]);

  const pendingResultMatches = useMemo(() => enrichedMatches.filter(m => {
    if (m.status === "completed") return false;
    if (!m.date || !m.time) return false;
    const [y, mm, d] = m.date.split("-").map(Number);
    const [h, min] = m.time.split(":").map(Number);
    return now >= new Date(y, mm - 1, d, h, min).getTime() + DURATION;
  }), [enrichedMatches, now]);

  const completedMatches = useMemo(() => enrichedMatches.filter(m => m.status === "completed"), [enrichedMatches]);

  const matchCache = useMemo(() => {
    const cache = {};
    enrichedMatches.forEach(m => { if (m.team1Id && m.team2Id) cache[makeKey(m.team1Id, m.team2Id)] = m; });
    return cache;
  }, [enrichedMatches]);

  const getMatchRoundLabel = (match) => {
    if (!tournament?.rounds) return null;
    const totalRounds = Object.keys(tournament.rounds).length;
    let found = null;
    Object.entries(tournament.rounds).forEach(([rKey, rMatches]) => {
      rMatches.forEach(m => {
        if ((m.team1?.id === match.team1Id && m.team2?.id === match.team2Id) ||
          (m.team1?.id === match.team2Id && m.team2?.id === match.team1Id)) {
          found = getRoundLabel(parseInt(rKey), totalRounds);
        }
      });
    });
    return found;
  };

  const tournamentWinner = useMemo(() => {
    if (!tournament?.rounds) return null;
    const keys = Object.keys(tournament.rounds);
    return tournament.rounds[`${keys.length - 1}`]?.[0]?.winner ?? null;
  }, [tournament]);

  const availableRounds = useMemo(() => {
    if (!tournament?.rounds) return [];
    return Object.keys(tournament.rounds).sort((a, b) => parseInt(a) - parseInt(b))
      .map((rKey, idx) => ({ key: parseInt(rKey), label: getRoundLabel(idx, Object.keys(tournament.rounds).length) }));
  }, [tournament]);

  const currentMatches = useMemo(() => {
    let list = matchSubTab === "upcoming" ? upcomingMatches : matchSubTab === "live" ? liveMatches : matchSubTab === "pending" ? pendingResultMatches : completedMatches;
    if (roundFilter !== null && tournament?.rounds) {
      list = list.filter(m => {
        let found = false;
        Object.entries(tournament.rounds).forEach(([rKey, rMatches]) => {
          rMatches.forEach(rm => {
            if (parseInt(rKey) === roundFilter &&
              ((rm.team1?.id === m.team1Id && rm.team2?.id === m.team2Id) ||
                (rm.team1?.id === m.team2Id && rm.team2?.id === m.team1Id))) found = true;
          });
        });
        return found;
      });
    }
    return list;
  }, [matchSubTab, upcomingMatches, liveMatches, pendingResultMatches, completedMatches, roundFilter, tournament]);

  // ─── Tournament actions ──────────────────────────────────────
  const computeRoundDateMap = (numRounds, sortedDates) => {
    const map = {};
    if (!sortedDates?.length) return map;
    for (let r = 0; r < numRounds; r++) {
      const idx = Math.min(Math.floor((r / numRounds) * sortedDates.length), sortedDates.length - 1);
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
        registrationOpen: true, registrationTitle: tournamentName,
        startDate: tournamentStartDate, endDate: tournamentEndDate,
        registeredTeamIds: [], createdAt: new Date(), status: "registration",
      });
    } catch (err) { Alert.alert("Error", err.message); }
  };

  const handleCloseRegistration = async () => {
    try { await updateDoc(doc(db, "tournaments", "main"), { registrationOpen: false, status: "setup" }); }
    catch (err) { Alert.alert("Error", err.message); }
  };

  const handleRunDraw = async () => {
    const registeredTeams = approvedTeams.filter(t => tournament?.registeredTeamIds?.includes(t.id));
    const targetTeams = registeredTeams.length > 0 ? registeredTeams : approvedTeams;
    if (targetTeams.length < 3) return Alert.alert(`Need at least 3 teams. Currently: ${targetTeams.length}`);
    const finalName = tournamentName.trim() || tournament?.registrationTitle;
    if (!finalName) return Alert.alert("Enter tournament name");
    if (tournamentDates.length === 0) return Alert.alert("Add at least one date");

    setWizardStep(2); setIsGenerating(true);
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
          const match = { id: `r${r}_m${m}`, round: r, matchIndex: m, team1: null, team2: null, winner: null, nextMatchId: r < numRounds - 1 ? `r${r + 1}_m${Math.floor(m / 2)}` : null, isBye: false };
          if (r === 0) {
            if (m < numTeams) match.team1 = { id: shuffled[m].id, name: shuffled[m].teamName };
            const t2Idx = m + numMatches;
            if (t2Idx < numTeams) match.team2 = { id: shuffled[t2Idx].id, name: shuffled[t2Idx].teamName };
            if (match.team1 && !match.team2) { match.isBye = true; match.winner = match.team1; }
          }
          rounds[`${r}`].push(match);
        }
      }
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
        const dateObj = roundDateMap[r] || sortedDates[0];
        if (!dateObj) continue;
        const rDate = dateObj.date;
        if (dayTimeMap[rDate] === undefined) {
          const [h, min] = dateObj.startTime.split(":").map(Number);
          dayTimeMap[rDate] = isNaN(h) ? 540 : h * 60 + (min || 0);
        }
        rounds[`${r}`].forEach(match => {
          const t = dayTimeMap[rDate];
          match.projectedTime = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
          if (!match.isBye) dayTimeMap[rDate] += 30;
        });
      }

      if (sortedDates.length > 0) {
        const firstDateObj = roundDateMap[0] || sortedDates[0];
        for (const match of rounds["0"]) {
          if (match.isBye || !match.team1 || !match.team2) continue;
          await addDoc(collection(db, "matches"), {
            team1Id: match.team1.id, team2Id: match.team2.id,
            date: firstDateObj.date, time: match.projectedTime || "09:00",
            pitch: "Main Pitch", score: "", status: "scheduled",
            tournamentName: finalName, createdAt: new Date(),
          });
        }
      }
      await setDoc(doc(db, "tournaments", "main"), { name: finalName, status: "locked", bracketSize, numTeams, rounds, createdAt: new Date(), tournamentDates: sortedDates, roundDateMap });
      setWizardStep(3);
    } catch (e) { Alert.alert("Error", e.message); setWizardStep(1); }
    setIsGenerating(false);
  };

  const handleManualAdvance = async (match, winnerTeam) => {
    if (!match.team1 || !match.team2 || match.winner) return;
    Alert.alert("Confirm", `Manually advance ${winnerTeam.name}?`, [
      { text: "Cancel" },
      {
        text: "Confirm", onPress: async () => {
          const newRounds = JSON.parse(JSON.stringify(tournament.rounds));
          newRounds[`${match.round}`][match.matchIndex].winner = winnerTeam;
          if (match.nextMatchId) {
            const nextR = `${parseInt(match.nextMatchId.split("_")[0].replace("r", ""))}`;
            const nextM = parseInt(match.nextMatchId.split("_")[1].replace("m", ""));
            if (match.matchIndex % 2 === 0) newRounds[nextR][nextM].team1 = winnerTeam;
            else newRounds[nextR][nextM].team2 = winnerTeam;
          }
          await setDoc(doc(db, "tournaments", "main"), { ...tournament, rounds: newRounds });
        }
      }
    ]);
  };

  const handleClearTournament = async () => {
    Alert.alert("DANGER", "End tournament? It will be archived.", [
      { text: "Cancel" },
      {
        text: "End Tournament", style: "destructive", onPress: async () => {
          const snap = await getDoc(doc(db, "tournaments", "main"));
          if (snap.exists()) {
            await setDoc(doc(db, "tournaments_archive", `tournament_${Date.now()}`), { ...snap.data(), archivedAt: new Date(), finalWinner: tournamentWinner ?? null });
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
      { text: "Reset", style: "destructive", onPress: async () => { await deleteDoc(doc(db, "tournaments", "main")); setWizardStep(1); } }
    ]);
  };

  // ─── Match result ────────────────────────────────────────────
  const openResultModal = async (match) => {
    const matchPlayers = players.filter(p => (p.teamId === match.team1Id || p.teamId === match.team2Id) && !p.suspendedForNextMatch);
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

    const team1Players = players.filter(p => p.teamId === resultMatch.team1Id && !p.suspendedForNextMatch);
    const team2Players = players.filter(p => p.teamId === resultMatch.team2Id && !p.suspendedForNextMatch);
    let totalGoals1 = 0, totalGoals2 = 0;
    team1Players.forEach(p => { totalGoals1 += parseInt(playerStats[p.id]?.goals) || 0; });
    team2Players.forEach(p => { totalGoals2 += parseInt(playerStats[p.id]?.goals) || 0; });

    if (totalGoals1 !== s1) { Alert.alert("Error", `${resultMatch.team1Name}: Player goals (${totalGoals1}) ≠ Team score (${s1})`); return; }
    if (totalGoals2 !== s2) { Alert.alert("Error", `${resultMatch.team2Name}: Player goals (${totalGoals2}) ≠ Team score (${s2})`); return; }
    if (isDraw && (!pen1 || !pen2)) { Alert.alert("Enter penalty scores for both teams"); return; }

    setIsSubmitting(true);
    try {
      let winnerId = null, winnerName = null;
      if (s1 > s2) { winnerId = resultMatch.team1Id; winnerName = resultMatch.team1Name; }
      else if (s2 > s1) { winnerId = resultMatch.team2Id; winnerName = resultMatch.team2Name; }
      else { if (p1 > p2) { winnerId = resultMatch.team1Id; winnerName = resultMatch.team1Name; } else { winnerId = resultMatch.team2Id; winnerName = resultMatch.team2Name; } }

      const batch = writeBatch(db);
      const statsSnapshot = {};
      const tName = resultMatch.tournamentName || "General";

      for (const [pid, stats] of Object.entries(playerStats)) {
        const g = parseInt(stats.goals) || 0, y = parseInt(stats.yellow) || 0, r = parseInt(stats.red) || 0;
        const player = players.find(p => p.id === pid);
        if (!player) continue;
        if (g > 0 || y > 0 || r > 0) {
          statsSnapshot[pid] = { goals: g, yellow: y, red: r };
          batch.update(doc(db, "users", pid), { goals: increment(g), yellowCards: increment(y), redCards: increment(r), [`tournamentStats.${tName}.goals`]: increment(g), [`tournamentStats.${tName}.yellow`]: increment(y), [`tournamentStats.${tName}.red`]: increment(r) });
        }
        const totalYellow = (player.yellowCards || 0) + y;
        let suspendReason = null;
        if (r >= 1) suspendReason = "red";
        else if (y >= 2) suspendReason = "yellow";
        else if (totalYellow >= 2) suspendReason = "accumulated";
        if (suspendReason) batch.update(doc(db, "users", pid), { suspendedForNextMatch: true, suspendReason });
      }

      const updateData = { status: "completed", score: `${s1} - ${s2}`, completedAt: new Date(), winnerName: winnerName || null, statsSnapshot };
      if (isDraw) updateData.penalties = `${p1} - ${p2}`;
      batch.update(doc(db, "matches", resultMatch.id), updateData);

      if (resultMatch.tournamentName && resultMatch.tournamentName !== "Friendly" && tournament?.rounds) {
        const snap = await getDoc(doc(db, "tournaments", "main"));
        if (snap.exists()) {
          const tData = snap.data();
          const newRounds = JSON.parse(JSON.stringify(tData.rounds));
          let found = false;
          for (const rKey of Object.keys(newRounds)) {
            for (const m of newRounds[rKey]) {
              const isMatch = (m.team1?.id === resultMatch.team1Id && m.team2?.id === resultMatch.team2Id) || (m.team1?.id === resultMatch.team2Id && m.team2?.id === resultMatch.team1Id);
              if (isMatch && !m.winner) {
                m.winner = { id: winnerId, name: winnerName };
                if (m.nextMatchId) {
                  const nextR = `${parseInt(m.nextMatchId.split("_")[0].replace("r", ""))}`;
                  const nextM = parseInt(m.nextMatchId.split("_")[1].replace("m", ""));
                  if (m.matchIndex % 2 === 0) newRounds[nextR][nextM].team1 = { id: winnerId, name: winnerName };
                  else newRounds[nextR][nextM].team2 = { id: winnerId, name: winnerName };
                }
                found = true; break;
              }
            }
            if (found) break;
          }
          if (found) await setDoc(doc(db, "tournaments", "main"), { ...tData, rounds: newRounds });
        }
      }
      await batch.commit();
      Alert.alert(" Result saved!");
      setResultMatch(null);
    } catch (e) { Alert.alert("Error", e.message); }
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
              batch.update(doc(db, "users", pId), { goals: increment(-(stats.goals || 0)), yellowCards: increment(-(stats.yellow || 0)), redCards: increment(-(stats.red || 0)), [`tournamentStats.${tName}.goals`]: increment(-(stats.goals || 0)), [`tournamentStats.${tName}.yellow`]: increment(-(stats.yellow || 0)), [`tournamentStats.${tName}.red`]: increment(-(stats.red || 0)) });
            });
          }
          batch.delete(doc(db, "matches", match.id));
          await batch.commit();
        }
      }
    ]);
  };

  // ─── Team actions ─────────────────────────────────────────────
  const getTeamMembers = (team) => players.filter(p => p.teamId && String(p.teamId).trim() === String(team.id).trim());

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
          (team.memberIds || []).forEach(id => batch.update(doc(db, "users", id), { hasTeam: false, teamId: "", assignedTeam: "" }));
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
          getTeamMembers(team).forEach(m => batch.update(doc(db, "users", m.id), { hasTeam: false, teamId: "", assignedTeam: "" }));
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
          getTeamMembers(teamObj).forEach(m => batch.update(doc(db, "users", m.id), { assignedTeam: newName }));
          await batch.commit();
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
          batch.update(doc(db, "teams", teamId), { memberIds: arrayRemove(member.id), members: arrayRemove(member.name) });
          batch.update(doc(db, "users", member.id), { hasTeam: false, teamId: "", assignedTeam: "" });
          await batch.commit();
        }
      }
    ]);
  };

  const handleAddPlayerToTeam = async (teamId, teamName, playerId) => {
    const player = freeAgents.find(p => p.id === playerId);
    const teamObj = approvedTeams.find(t => t.id === teamId);
    if (getTeamMembers(teamObj).length >= 7) return Alert.alert("Team is full!");
    Alert.alert("Add Player", `Add ${player.name} to ${teamName}?`, [
      { text: "Cancel" },
      {
        text: "Add", onPress: async () => {
          const batch = writeBatch(db);
          batch.update(doc(db, "teams", teamId), { memberIds: arrayUnion(player.id), members: arrayUnion(player.name) });
          batch.update(doc(db, "users", player.id), { hasTeam: true, teamId, assignedTeam: teamName });
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
      { text: "Activate", onPress: async () => { await updateDoc(doc(db, "users", player.id), { isVerified: true, manualActivation: true }); } }
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
      { text: "Remove", style: "destructive", onPress: async () => { await updateDoc(doc(db, "users", player.id), { hasTeam: false, teamId: "", assignedTeam: "" }); } }
    ]);
  };

  //  const sortedByFilter = [...allPlayers].sort((a, b) => {
  //   const valA = getStat(a, 'goals');
  //   const valB = getStat(b, 'goals');
  //   return valB - valA;
  // });

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
        members: selected.map(p => p.name), memberIds: selected.map(p => p.id), createdAt: new Date()
      });
      selected.forEach(p =>
        batch.update(doc(db, "users", p.id), { hasTeam: true, teamId: teamRef.id, assignedTeam: name }));
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
    }
    catch (e) {
      Alert.alert("Error", "Logout and login again first.");
    }
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
      } else
        Alert.alert("Database healthy! No issues found.");
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
            usersSnap.docs.forEach(d => batch.update(doc(db, "users", d.id), { goals: 0, yellowCards: 0, redCards: 0, hasTeam: false, teamId: "", assignedTeam: "" }));
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

  const sortedByGoals = [...allPlayers].sort((a, b) => {
    const valA = Number(getStat(a, 'goals')) || 0;
    const valB = Number(getStat(b, 'goals')) || 0;
    return valB - valA;
  });


  const displayedPlayers = useMemo(() => {
    let list = [...allPlayers];

    // Sort
    list.sort((a, b) => {
      const valA = Number(getStat(a, 'goals')) || 0;
      const valB = Number(getStat(b, 'goals')) || 0;
      return valB - valA; 
    });

    // Top 10 
    if (showTop10) {
      list = list.slice(0, 10);
    }

    // (Pending, Search, etc.)
    if (playersSubTab === "pending") {
      list = list.filter(p => !p.isVerified);
    } else if (playersSubTab === "free") {
      list = list.filter(p => !p.hasTeam);
    } else if (playersSubTab === "solo")
      list = list.filter(p => p.searchingForTeam && !p.hasTeam);

    // فلتر البحث
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.assignedTeam?.toLowerCase().includes(term)||
        p.position?.toLowerCase().includes(term) 
      );
    }

    return list;
  }, [allPlayers, statsFilter, showTop10, playersSubTab, searchTerm]);

  const getPlayerRank = (playerId) => {
    const idx = sortedByGoals.findIndex(p => p.id === playerId);
    return idx !== -1 ? idx + 1 : "--";
  };

  const filteredTeams = approvedTeams.filter(t =>
    t.teamName?.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const getPositionColor = (position) => {
    if (position === "Forward") return { bg: "rgba(34,197,94,0.15)", text: "#22c55e" };
    if (position === "Defender") return { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" };
    if (position === "Goalkeeper") return { bg: "rgba(234,179,8,0.15)", text: "#eab308" };
    return { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" };
  };

  // الحصول على اسم الإحصائيات الحالي للعرض
  const getCurrentStatsLabel = () => {
    if (statsFilter === "total") return "All-Time (Total)";
    return `🏆 ${statsFilter}`;
  };

 const handleAssignToTeam = async (player, team) => {
    try {
      const teamObj = approvedTeams.find(t => t.id === team.id);
      if (getTeamMembers(teamObj).length >= 7) {
        Alert.alert('Team Full', 'This team already has 7 players!');
        return;
      }
      const batch = writeBatch(db);
      const neededPositions = (team.neededPositions || []).filter(p => p !== player.position);
      batch.update(doc(db, 'teams', team.id), {
        memberIds: arrayUnion(player.id),
        members: arrayUnion(player.name),
        neededPositions,
        needsPosition: neededPositions.length > 0 ? neededPositions[0] : null,
      });
      batch.update(doc(db, 'users', player.id), {
        hasTeam: true,
        teamId: team.id,
        assignedTeam: team.teamName,
        searchingForTeam: false,
      });
      await batch.commit();
      setShowMatchModal(null);
      Alert.alert('✅ Done!', `${player.name} assigned to ${team.teamName}`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const getTournamentDeadline = () => {
    if (!tournament?.createdAt) return null;
    const createdAt = tournament.createdAt?.toDate
      ? tournament.createdAt.toDate().getTime()
      : new Date(tournament.createdAt).getTime();
    return createdAt + 48 * 60 * 60 * 1000;
  };

  const getTournamentRemainingTime = () => {
    const deadline = getTournamentDeadline();
    if (!deadline) return null;
    const diff = deadline - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getTournamentDeadlineString = () => {
    const deadline = getTournamentDeadline();
    if (!deadline) return null;
    return new Date(deadline).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };


  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const openDatePicker = (target) => {
    const today = new Date();
    setTempYear(today.getFullYear());
    setTempMonth(today.getMonth() + 1);
    setTempDay(today.getDate());
    setDatePickerTarget(target);
    setShowDatePickerModal(true);
  };

  const confirmDate = () => {
    const y = tempYear;
    const m = String(tempMonth).padStart(2, "0");
    const d = String(Math.min(tempDay, getDaysInMonth(tempYear, tempMonth))).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    if (datePickerTarget === "schedule") setDateInput(dateStr);
    else if (datePickerTarget === "start") setTournamentStartDate(dateStr);
    else if (datePickerTarget === "end") setTournamentEndDate(dateStr);
    setShowDatePickerModal(false);
  };

  const confirmTime = () => {
    const h = String(tempHour).padStart(2, "0");
    const min = String(tempMinute).padStart(2, "0");
    setTournamentStartTime(`${h}:${min}`);
    setShowTimePickerModal(false);
  };

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
          <Text style={s.headerTitle}>Science FC League</Text>  
        </View>      
        <View style={{ flexDirection: "column", gap: 6, alignItems: "stretch" }}>
  <TouchableOpacity 
    style={[s.addBtn, { alignItems: "center" }]} 
    onPress={() => { setAddModalView("options"); setShowAddModal(true); }}
  >
    <Text style={s.addBtnText}>+ Create</Text>
  </TouchableOpacity>
  <TouchableOpacity 
    style={[s.addBtn, { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "rgba(0,255,156,0.3)", alignItems: "center" }]} 
    onPress={() => setShowAI(true)}
  >
    <Text style={[s.addBtnText, { color: "#00FF9C" }]}>🤖 AI</Text>
  </TouchableOpacity>
</View>
      </View>

      {/* ── Content ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ════ DASHBOARD ════ */}
        {activeTab === "dashboard" && (
          <View style={s.tabContent}>
            {/* Hero */}
            <View style={s.heroSection}>
              <View style={s.livePill}>
                <View style={s.livePillDot} />
                <Text style={s.livePillText}>LIVE TOURNAMENT</Text>
              </View>
              <Text style={s.heroTitle}>Science Faculty Football</Text>
              <Text style={s.heroSub}>The ultimate battle of skill, strategy, and passion.</Text>
              <View style={s.heroButtons}>
                <TouchableOpacity style={s.heroBtn} onPress={() => setActiveTab("matches")}>
                  <Text style={s.heroBtnText}> View Matches </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.heroBtnOutline} onPress={() => setActiveTab("teams")}>
                  <Text style={s.heroBtnOutlineText}>Browse Teams</Text>
                </TouchableOpacity>
              </View>
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

            {/* Stats Grid */}
            <View style={s.statsGrid}>
              <StatCard label="Total Players" value={stats.total} icon="👥" color="#60a5fa" sub="Registered athletes" />
              <StatCard label="Pending Approval" value={stats.pending} icon="📅" color="#fbbf24" sub="Awaiting verification" />
              <StatCard label="Free Agents" value={stats.free} icon="👤" color="#00FF9C" sub="Available players" />
              <StatCard label="Total Matches" value={completedMatches.length + liveMatches.length} icon="✓" color="#a78bfa" sub="Scheduled & played" />
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
            <View style={s.dashTabRow}>
              {[{ id: "live", label: "Live Matches" },
              { id: "history", label: "Match History" },
              { id: "requests", label: `Team Requests`, badge: pendingTeams.length }
              ].map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveClick(tab.id)}
                  style={[s.dashTab, activeClick === tab.id && s.dashTabActive]}
                >
                  <Text style={
                    [s.dashTabText, activeClick === tab.id && s.dashTabTextActive]
                  }>
                    {tab.label}
                  </Text>
                  {tab.badge > 0 && <View style={s.tabBadge}><Text style={s.tabBadgeText}>{tab.badge}</Text></View>}
                </TouchableOpacity>
              ))}
            </View>
            </ScrollView>

            {activeClick === "live" && (
              liveMatches.length === 0
                ? <EmptyState icon="⚽" text="No live matches at the moment" sub="Check back during match hours" />
                : <View style={s.matchGrid}>{liveMatches.map(m =>
                  <MatchCard key={m.id} match={m} type="live"
                    roundLabel={getMatchRoundLabel(m)}
                    onEnterResult={() => openResultModal(m)}
                    onDelete={() => handleDeleteMatch(m)} />)}</View>
            )}

            {activeClick === "history" && (
              completedMatches.length === 0
                ? <EmptyState icon="📋" text="No finished matches yet" sub="Completed matches will appear here" />
                : <View style={s.matchGrid}>{completedMatches.map(m =>
                  <MatchCard key={m.id} match={m} type="completed"
                    roundLabel={getMatchRoundLabel(m)}
                    onDelete={() => handleDeleteMatch(m)} />)}</View>
            )}

            {activeClick === "requests" && (
              pendingTeams.length === 0
                ? <EmptyState icon="👥" text="No pending team requests" sub="All teams have been reviewed" />
                : <View style={s.matchGrid}>{pendingTeams.map(team => (
                  <View key={team.id} style={s.requestCard}>
                    <View style={s.requestCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.requestTeamName}>{team.teamName}</Text>
                        <Text style={s.requestCaptain}>Captain: {team.captainName || "Unknown"}</Text>
                      </View>
                      <View style={s.playerCountBadge}><Text style={s.playerCountText}>{team.memberIds?.length || 0} Players</Text></View>
                    </View>
                    <View style={s.memberTags}>
                      {team.members?.slice(0, 5).map((name, i) =>
                        <View key={i} style={s.memberTag}><Text style={s.memberTagText}>{name}</Text></View>
                      )}
                      {team.members?.length > 5 &&
                        <View style={s.memberTag}><Text style={s.memberTagText}>+{team.members.length - 5} more</Text></View>
                      }
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
                ))}
                </View>
            )}
          </View>
        )}

        {/* ════ MATCHES TAB ════ */}
        {activeTab === "matches" && (
          <View style={s.tabContent}>
            <View style={s.pageHeaderRow}>
              <View>
                <Text style={s.pageTitle}>🏆 Match Schedule</Text>
                <Text style={s.pageSub}>Stay updated with all tournament matches</Text>
              </View>
            </View>

            {/* Round filter */}
            {availableRounds.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: "#64748b", fontSize: 11 }}>▼</Text>
                  <TouchableOpacity style={[s.roundFilterBtn, roundFilter === null && s.roundFilterBtnActive]} onPress={() => setRoundFilter(null)}>
                    <Text style={[s.roundFilterText, roundFilter === null && { color: "#000" }]}>ALL</Text>
                  </TouchableOpacity>
                  {availableRounds.map(r => (
                    <TouchableOpacity key={r.key} style={[s.roundFilterBtn, roundFilter === r.key && s.roundFilterBtnActive]} onPress={() => setRoundFilter(r.key)}>
                      <Text style={[s.roundFilterText, roundFilter === r.key && { color: "#000" }]}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={s.matchTabRow}>
                {[
                  { id: "upcoming", label: "UPCOMING", icon: "📅", color: "#00FF9C", count: upcomingMatches.length },
                  { id: "live", label: "LIVE", icon: "🔴", color: "#ef4444", count: liveMatches.length },
                  { id: "pending", label: "PENDING RESULT", icon: "⏳", color: "#fbbf24", count: pendingResultMatches.length },
                  { id: "completed", label: "COMPLETED", icon: "✅", color: "#00FF9C", count: completedMatches.length },
                ].map(tab => (
                  <TouchableOpacity key={tab.id} onPress={() => setMatchSubTab(tab.id)} style={[s.matchTabBtn, matchSubTab === tab.id && { borderBottomWidth: 2, borderBottomColor: tab.color }]}>
                    <Text style={[s.matchTabText, matchSubTab === tab.id && { color: tab.color }]}>{tab.icon} {tab.label} ({tab.count})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {currentMatches.length === 0
              ? <EmptyState icon="⚽" text={`No ${matchSubTab} matches`} sub="Check back later for updates" />
              : <View style={s.matchGrid}>{currentMatches.map(m => <MatchCard key={m.id} match={m} type={matchSubTab} roundLabel={getMatchRoundLabel(m)} onEnterResult={() => openResultModal(m)} onDelete={() => handleDeleteMatch(m)} />)}</View>
            }

            {/* Footer stats */}
            <View style={s.matchStatsFooter}>
              <View style={s.matchStat}><Text style={s.matchStatNum}>{String((upcomingMatches.length) + (liveMatches.length) + (completedMatches.length))}</Text><Text style={s.matchStatLabel}>TOTAL MATCHES</Text></View>
              <View style={s.matchStatDivider} />
              <View style={s.matchStat}><Text style={[s.matchStatNum, { color: "#00FF9C" }]}>{String((upcomingMatches.length))}</Text><Text style={s.matchStatLabel}>UPCOMING</Text></View>
              <View style={s.matchStatDivider} />
              <View style={s.matchStat}><Text style={[s.matchStatNum, { color: "#ef4444" }]}>{liveMatches.length}</Text><Text style={s.matchStatLabel}>LIVE NOW</Text></View>
            </View>
          </View>
        )}

        {/* ════ TEAMS TAB ════ */}
        {activeTab === "teams" && (
          <View style={s.tabContent}>
            <View style={s.pageHeaderRow}>
              <View>
                <Text style={s.pageTitle}>🏆 Tournament Teams</Text>
                <Text style={s.pageSub}>Meet the competing teams and their statistics</Text>
              </View>
              <View style={s.searchBoxSmall}>
                <Text style={{ color: "#64748b", marginRight: 6, fontSize: 12 }}>🔍</Text>
                <TextInput style={s.searchInputSmall} placeholder="Search teams..." placeholderTextColor="#475569" value={teamSearch} onChangeText={setTeamSearch} />
              </View>
            </View>

            {filteredTeams.length === 0
              ? <EmptyState text="No teams found" />
              : <View style={s.teamsGrid}>
                {filteredTeams.map(team => {
                  const members = getTeamMembers(team);
                  const isRenaming = renamingTeamId === team.id;
                  const isExpanded = expandedTeams[team.id];
                  return (
                    <View key={team.id} style={s.teamCard}>
                      <View style={s.teamCardHeader}>
                        <View style={{ flex: 1 }}>
                          {isRenaming ? (
                            <View style={s.renameRow}>
                              <TextInput style={s.renameInput} value={renameValue} onChangeText={setRenameValue} autoFocus />
                              <TouchableOpacity onPress={() => handleRenameTeam(team.id)} style={{ padding: 6 }}><Text style={{ color: "#00FF9C", fontWeight: "bold", fontSize: 16 }}>✓</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => setRenamingTeamId(null)} style={{ padding: 6 }}><Text style={{ color: "#ef4444", fontWeight: "bold", fontSize: 16 }}>✕</Text></TouchableOpacity>
                            </View>
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={s.teamCardName}>{team.teamName}</Text>
                              <TouchableOpacity onPress={() => { setRenamingTeamId(team.id); setRenameValue(team.teamName); }}>
                                <Text style={{ color: "#64748b", fontSize: 14 }}>✏️</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          <View style={s.teamPlayerCount}>
                            <Text style={s.teamPlayerCountText}>🎮 {members.length} Players</Text>
                          </View>
                          <View style={s.captainBadge}>
                            <Text style={s.captainBadgeText}>🛡 TEAM LEADER</Text>
                            <Text style={s.captainName}>{team.captainName || "No Leader"}</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteTeam(team)} style={s.deleteIconBtn}>
                          <Text style={{ color: "#64748b", fontSize: 16 }}>🗑</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Roster toggle */}
                      <TouchableOpacity style={s.rosterToggle} onPress={() => setExpandedTeams(prev => ({ ...prev, [team.id]: !prev[team.id] }))}>
                        <Text style={s.rosterToggleText}>📋 ROSTER ({members.length})</Text>
                        <Text style={{ color: "#64748b" }}>{isExpanded ? "▲" : "▼"}</Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={s.rosterList}>
                          {members.map(member => {
                            const suspended = !!member.suspendedForNextMatch;
                            const suspType = getSuspensionType(member);
                            return (
                              <TouchableOpacity key={member.id} style={[s.rosterRow, suspended && (suspType === "red" ? s.rosterRowRed : s.rosterRowYellow)]} onPress={() => setSelectedMember(member)}>
                                <View style={[s.rosterDot, { backgroundColor: suspended ? (suspType === "red" ? "#ef4444" : "#eab308") : "#00FF9C" }]} />
                                <Text style={s.rosterName}>{member.name}</Text>
                                {suspended && <Text style={{ fontSize: 10, marginLeft: 4 }}>{suspType === "red" ? "🟥" : "🟨"}</Text>}
                                <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => handleRemovePlayer(team.id, team.teamName, member)}>
                                  <Text style={{ color: "#475569", fontSize: 13 }}>✕</Text>
                                </TouchableOpacity>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      <TouchableOpacity style={s.addAgentBtn} onPress={() => setAddPlayerModal(team.id)}>
                        <Text style={s.addAgentBtnText}>+ Add Free Agent</Text>
                        <View style={s.addAgentIcon}><Text style={{ color: "#fff", fontSize: 14 }}>👤</Text></View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            }
          </View>
        )}

        {/* ════ PLAYERS TAB ════ */}
        {activeTab === "players" && (
          <View style={s.tabContent}>
            <View style={s.pageHeaderRow}>
              <View>
                <Text style={s.pageTitle}>🏃 All Players</Text>
                <Text style={s.pageSub}>{showTop10 ? "Top 10 Legends" : `Total ${allPlayers.length} players • ${freeAgents.length} free agents`}</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={s.searchBox}>
              <Text style={{ color: "#64748b", marginRight: 8, fontSize: 13 }}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Search by name, team, or position..."
                placeholderTextColor="#8f9db0" value={searchTerm}
                onChangeText={setSearchTerm} />
            </View>

            {/* Stats Period - Custom Dropdown بدون مكتبات */}
            <View style={s.playerControlRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Text style={s.statsLabel}> STATS PERIOD :</Text>

                <TouchableOpacity
                  style={s.customDropdownBtn}
                  onPress={() => setShowStatsPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={s.customDropdownBtnText}>{getCurrentStatsLabel()}</Text>
                  <Text style={s.customDropdownArrow}>▼</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.top10Btn, showTop10 && s.top10BtnActive]} onPress={() => setShowTop10(!showTop10)}>
                  <Text style={[s.top10BtnText, showTop10 && { color: "#fbbf24" }]}>✨ Top 10 Legends</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal للـ Dropdown */}
            <Modal
              visible={showStatsPicker}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowStatsPicker(false)}
            >
              <TouchableOpacity
                style={s.modalOverlayLight}
                activeOpacity={1}
                onPress={() => setShowStatsPicker(false)}
              >
                <View style={s.dropdownModal}>
                  <View style={s.dropdownHeader}>
                    <Text style={s.dropdownTitle}>Select Stats Period</Text>
                    <TouchableOpacity onPress={() => setShowStatsPicker(false)}>
                      <Text style={s.dropdownClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={[{ id: "total", label: " All-Time (Total)" }, ...availableTournaments.map(name => ({ id: name, label: `🏆 ${name}` }))]}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[s.dropdownItem, statsFilter === item.id && s.dropdownItemActive]}
                        onPress={() => {
                          setStatsFilter(item.id);
                          setShowStatsPicker(false);
                        }}
                      >
                        <Text style={[s.dropdownItemText, statsFilter === item.id && s.dropdownItemTextActive]}>{item.label}</Text>
                        {statsFilter === item.id && <Text style={s.dropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8, padding: 2 }}>
                {[
                  { id: "all", label: "ALL" },
                  { id: "pending", label: `PENDING (${allPlayers.filter(p => !p.isVerified).length})` },
                  { id: "free", label: `FREE AGENTS` },
                  { id: "solo", label: `SOLO (${allPlayers.filter(p => p.searchingForTeam && !p.hasTeam).length})` }].map(f => (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setPlayersSubTab(f.id)}
                      style={[s.filterPill, playersSubTab === f.id && s.filterPillActive]}
                    >
                      <Text style={[s.filterPillText, playersSubTab === f.id && { color: "#000" }]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>

            {/* Team Recruitment Requests */}
            {playersSubTab === 'solo' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#a78bfa', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  🔮 Teams Looking for Players
                </Text>
                {approvedTeams.filter(t => t.needsPosition || t.neededPositions?.length > 0).length === 0 ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#475569', fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>No active team requests</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
                      {approvedTeams.filter(t => t.needsPosition || t.neededPositions?.length > 0).map(t => (
                        <View key={t.id} style={{
                          backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: 14, padding: 14,
                          borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)', minWidth: 160
                        }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, marginBottom: 4 }}>{t.teamName}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                            {(t.neededPositions || [t.needsPosition]).filter(Boolean).map((pos, i) => (
                              <View key={i} style={{ backgroundColor: 'rgba(167,139,250,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ color: '#a78bfa', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>{pos}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            )}

            {/* Table Header */}
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { width: 36 }]}>RANK</Text>
              <Text style={[s.tableHeaderText, { flex: 1.2 }]}>PLAYER</Text>
              <Text style={[s.tableHeaderText, { flex: 0.9 }]}>TEAM</Text>
              <Text style={[s.tableHeaderText, { flex: 0.8 }]}>POS</Text>
              <Text style={[s.tableHeaderText, { flex: 0.7 }]}>STATUS</Text>
              <Text style={[s.tableHeaderText, { width: 50, textAlign: "center" }]}>ACTION</Text>
            </View>

            {displayedPlayers.length === 0
              ? <EmptyState text="No players found" />
              : displayedPlayers.map(player => {
                const rank = getPlayerRank(player.id);
                const suspended = !!player.suspendedForNextMatch;
                const suspType = getSuspensionType(player);
                const posStyle = getPositionColor(player.position);

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
                        <Text style={s.playerTeam}>Team : {player.assignedTeam}</Text>
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

                      {playersSubTab === 'solo' && !player.hasTeam && (
                        <TouchableOpacity
                          style={{ backgroundColor: '#a78bfa', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 6,width:64,alignItems:'center', }}
                          onPress={() => setShowMatchModal(player)}
                        >
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>Match</Text>
                        </TouchableOpacity>
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
            <View style={s.pageHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.pageTitle}>🗂 {tournament?.name || "Tournament"}</Text>
                {tournament?.rounds && <Text style={s.pageSub}>The brackets are locked and the competition is live!</Text>}
              </View>
              {!tournament?.rounds && (
                <TouchableOpacity style={s.forceResetBtn} onPress={handleForceReset}>
                  <Text style={s.forceResetText}>FORCE RESET</Text>
                </TouchableOpacity>
              )}
              {tournament?.rounds && (
                <TouchableOpacity style={s.dangerBtnSmall} onPress={handleClearTournament}>
                  <Text style={s.dangerBtnSmallText}>RESET TOURNAMENT</Text>
                </TouchableOpacity>
              )}
            </View>

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

            {!tournament?.rounds && (
              <View style={s.wizardSteps}>
                <WizardStep step={1} current={wizardStep} label="Setup" />
                <Text style={s.wizardArrow}>›</Text>
                <WizardStep step={2} current={wizardStep} label="Draw" />
                <Text style={s.wizardArrow}>›</Text>
                <WizardStep step={3} current={wizardStep} label="Bracket" />
              </View>
            )}

            {wizardStep === 1 && !tournament?.rounds && (
              <View>
                {!tournament?.registrationOpen && !tournament?.registeredTeamIds && (
                  <View style={s.setupCard}>
                    <Text style={s.setupCardTitle}>1. ANNOUNCE TOURNAMENT</Text>
                    <TextInput style={s.modalInput} placeholder="e.g. Ramadan Cup 2025" placeholderTextColor="#475569" value={tournamentName} onChangeText={setTournamentName} />
                    <Text style={s.inputLabel}>Start Date</Text>
                    <TouchableOpacity
                      style={[s.modalInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                      onPress={() => openDatePicker("start")}
                    >
                      <Text style={{ color: tournamentStartDate ? "#fff" : "#475569", fontSize: 14 }}>
                        {tournamentStartDate || "Tap to select start date"}
                      </Text>
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </TouchableOpacity>

                    <Text style={s.inputLabel}>End Date</Text>
                    <TouchableOpacity
                      style={[s.modalInput, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                      onPress={() => openDatePicker("end")}
                    >
                      <Text style={{ color: tournamentEndDate ? "#fff" : "#475569", fontSize: 14 }}>
                        {tournamentEndDate || "Tap to select end date"}
                      </Text>
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.primaryBtn} onPress={handleOpenRegistration}><Text style={s.primaryBtnText}>Open Registration</Text></TouchableOpacity>
                  </View>
                )}
                {tournament?.registrationOpen && (
                  <View style={s.setupCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text style={s.regLiveTitle}>🟢 Registration Live: {tournament.registrationTitle}</Text>
                      <View style={s.pulseDot} />
                    </View>

                     {/* Deadline Countdown */}
                      {getTournamentDeadlineString() && (
                        <View style={{ backgroundColor: 'rgba(0,255,156,0.06)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,255,156,0.15)' }}>
                          <Text style={{ color: '#64748b', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Registration Deadline
                          </Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                              {getTournamentDeadlineString()}
                            </Text>
                            <Text style={{
                              color: getTournamentRemainingTime() === 'Expired' ? '#ef4444' : '#00FF9C',
                              fontSize: 11, fontWeight: '900',
                              }}>
                              {getTournamentRemainingTime()}
                            </Text>
                          </View>
                        </View>
                      )}

                    <Text style={s.regRange}>{tournament.startDate} → {tournament.endDate}</Text>

                     {/* Registered Teams List */}
                    {tournament.registeredTeamIds?.length > 0 ? (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ color: '#475569', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                          Registered Teams ({tournament.registeredTeamIds.length})
                        </Text>
                        {tournament.registeredTeamIds.map(tid => {
                          const t = approvedTeams.find(x => x.id === tid);
                          return (
                            <View key={tid} style={s.registeredTeamRow}>
                              <Text style={s.registeredTeamName}>{t?.teamName || tid}</Text>
                              <Text style={{ color: '#00FF9C' }}>✓</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ color: '#475569', fontSize: 12, fontStyle: 'italic', marginBottom: 12 }}>
                        No teams registered yet...
                      </Text>
                    )}
                    {tournament.registeredTeamIds?.map(tid => {
                      const t = approvedTeams.find(x => x.id === tid);
                      return <View key={tid} style={s.registeredTeamRow}><Text style={s.registeredTeamName}>{t?.teamName || tid}</Text><Text style={{ color: "#00FF9C" }}>✓</Text></View>;
                    })}
                    <TouchableOpacity style={s.dangerBtn} onPress={handleCloseRegistration}><Text style={s.dangerBtnText}>CLOSE REGISTRATION</Text></TouchableOpacity>
                  </View>
                )}
                {!tournament?.registrationOpen && (tournament?.registeredTeamIds || tournament?.status === "setup") && (
                  <View style={s.setupCard}>
                    <Text style={s.setupCardTitle}>SCHEDULE DATES</Text>
                   <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[s.modalInput, { flex: 1, marginBottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                        onPress={() => openDatePicker("schedule")}
                      >
                        <Text style={{ color: dateInput ? "#fff" : "#475569", fontSize: 14 }}>
                          {dateInput || "Select Date"}
                        </Text>
                        <Text style={{ fontSize: 18 }}>📅</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[s.modalInput, { width: 110, marginBottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                        onPress={() => {
                          const [h, min] = tournamentStartTime.split(":").map(Number);
                          setTempHour(h);
                          setTempMinute(Math.round(min / 5) * 5);
                          setShowTimePickerModal(true);
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 14 }}>{tournamentStartTime}</Text>
                        <Text style={{ fontSize: 16 }}>🕐</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={[s.secondaryBtn, { marginBottom: 12 }]} onPress={() => {
                      if (!dateInput) return;
                      if (tournamentDates.some(d => d.date === dateInput)) return;
                      setTournamentDates([...tournamentDates, { date: dateInput, startTime: tournamentStartTime }].sort((a, b) => a.date.localeCompare(b.date)));
                      setDateInput("");
                    }}><Text style={s.secondaryBtnText}>Add Date</Text></TouchableOpacity>
                    {tournamentDates.map(item => (
                      <View key={item.date} style={s.dateTag}>
                        <Text style={s.dateTagText}>{item.date} @ {item.startTime}</Text>
                        <TouchableOpacity onPress={() => setTournamentDates(tournamentDates.filter(d => d.date !== item.date))}><Text style={{ color: "#ef4444" }}>✕</Text></TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]} onPress={handleRunDraw}>
                      <Text style={s.primaryBtnText}>🎲 Initiate Draw ({tournament?.registeredTeamIds?.length || approvedTeams.length} Teams)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {wizardStep === 2 && isGenerating && (
              <View style={s.generatingContainer}>
                <ActivityIndicator size="large" color="#00FF9C" />
                <Text style={s.generatingTitle}>Generating Bracket...</Text>
                <Text style={s.generatingSubtext}>Randomizing team seeds</Text>
              </View>
            )}

            {/* Bracket */}
            {tournament?.rounds && !isGenerating && (
              <View style={s.bracketContainer}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <Text style={s.bracketTitle}>🗂 OFFICIAL BRACKET</Text>
                </View>
                <Text style={s.bracketSubtitle}>LIVE TOURNAMENT • {tournament?.numTeams} TEAMS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 20, padding: 4 }}>
                    {Object.keys(tournament.rounds).sort((a, b) => parseInt(a) - parseInt(b)).map((rKey, rIdx) => {
                      const totalRounds = Object.keys(tournament.rounds).length;
                      return (
                        <View key={rKey} style={s.bracketColumn}>
                          <View style={s.bracketRoundHeader}>
                            <Text style={s.bracketRoundLabel}>{getRoundLabel(rIdx, totalRounds)}</Text>
                            {tournament.roundDateMap?.[rKey] && (
                              <Text style={s.bracketRoundDate}>📅 {tournament.roundDateMap[rKey]?.date?.slice(5)?.replace("-", " ")?.toUpperCase()}</Text>
                            )}
                          </View>
                          {tournament.rounds[rKey].map(match => (
                            <View key={match.id} style={s.bracketMatchBox}>
                              <Text style={s.bracketMatchLabel}>MATCH INFO</Text>
                              <TouchableOpacity
                                style={[s.bracketTeamRow, match.winner?.id === match.team1?.id && s.bracketTeamRowWinner]}
                                onPress={() => match.team1 && match.team2 && !match.winner && handleManualAdvance(match, match.team1)}
                                disabled={!match.team1 || !match.team2 || !!match.winner}
                              >
                                <Text style={[s.bracketTeamText, match.winner?.id === match.team1?.id && { color: "#00FF9C" }]}>
                                  {match.team1?.name || "TBD"}
                                </Text>
                                {match.winner?.id === match.team1?.id && <Text style={{ color: "#00FF9C", fontSize: 12 }}>✓</Text>}
                              </TouchableOpacity>
                              {match.isBye
                                ? <View style={s.byeRow}><Text style={s.byeText}>BYE</Text></View>
                                : <TouchableOpacity
                                  style={[s.bracketTeamRow, match.winner?.id === match.team2?.id && s.bracketTeamRowWinner]}
                                  onPress={() => match.team1 && match.team2 && !match.winner && handleManualAdvance(match, match.team2)}
                                  disabled={!match.team1 || !match.team2 || !!match.winner}
                                >
                                  <Text style={[s.bracketTeamText, match.winner?.id === match.team2?.id && { color: "#00FF9C" }]}>
                                    {match.team2?.name || "TBD"}
                                  </Text>
                                  {match.winner?.id === match.team2?.id && <Text style={{ color: "#00FF9C", fontSize: 12 }}>✓</Text>}
                                </TouchableOpacity>
                              }
                              {match.date && (
                                <View style={s.bracketMatchMeta}>
                                  <Text style={s.bracketMatchMetaText}>📅 {match.date}</Text>
                                  {match.time && <Text style={s.bracketMatchMetaText}>🕐 {match.time}</Text>}
                                </View>
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: "#00FF9C", fontSize: 13 }}>📦</Text>
                    <Text style={s.archiveToggleText}>PAST TOURNAMENTS — {archived.length} ARCHIVED</Text>
                  </View>
                  <Text style={{ color: "#64748b" }}>{showArchive ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {showArchive && archived.map(t => {
                  const isExpanded = expandedArchive[t.id];
                  const roundKeys = Object.keys(t.rounds || {}).sort((a, b) => parseInt(a) - parseInt(b));
                  const totalRounds = roundKeys.length;

                  return (
                    <View key={t.id} style={s.archiveCard}>
                      {/* Header Row */}
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}
                        onPress={() => setExpandedArchive(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <Text style={{ color: "#64748b", fontSize: 14 }}>🏆</Text>
                            <Text style={s.archiveCardTitle}>{(t.name || "Unnamed Tournament").toUpperCase()}</Text>
                          </View>
                          {t.finalWinner && <Text style={s.archiveWinner}>🏆 {t.finalWinner.name}</Text>}
                          <Text style={s.archiveDate}>
                            {t.archivedAt?.toDate?.()?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) || ""} • {t.numTeams} TEAMS • {totalRounds} ROUNDS
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                          <TouchableOpacity onPress={() => Alert.alert("Delete", "Delete this archived tournament?", [
                            { text: "Cancel" },
                            {
                              text: "Delete", style: "destructive", onPress: async () => {
                                await deleteDoc(doc(db, "tournaments_archive", t.id));
                                setArchived(prev => prev.filter(x => x.id !== t.id));
                              }
                            }
                          ])}>
                            <Text style={{ color: "#64748b", fontSize: 16 }}>🗑</Text>
                          </TouchableOpacity>
                          <Text style={{ color: "#64748b" }}>{isExpanded ? "▲" : "▼"}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <View style={{ marginTop: 14 }}>
                          {/* Winner Banner */}
                          {t.finalWinner && (
                            <View style={{ backgroundColor: "rgba(234,179,8,0.07)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(234,179,8,0.2)", alignItems: "center", marginBottom: 14 }}>
                              <Text style={{ color: "#eab308", fontSize: 9, fontWeight: "800", letterSpacing: 2 }}>TOURNAMENT CHAMPION</Text>
                              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 4 }}>🏆 {t.finalWinner.name}</Text>
                            </View>
                          )}

                          {/* Bracket per round */}
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", gap: 12 }}>
                              {roundKeys.map((rKey, rIdx) => (
                                <View key={rKey} style={{ width: 160 }}>
                                  <Text style={{ color: "#00FF9C", fontSize: 8, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>
                                    {getRoundLabel(rIdx, totalRounds)}
                                  </Text>
                                  {(t.rounds[rKey] || []).map((match, mIdx) => (
                                    <View key={mIdx} style={{ backgroundColor: "#1e293b", borderRadius: 10, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                        <Text style={{ color: match.winner?.id === match.team1?.id ? "#00FF9C" : "#94a3b8", fontSize: 11, fontWeight: match.winner?.id === match.team1?.id ? "800" : "400", flex: 1 }} numberOfLines={1}>
                                          {match.team1?.name || "TBD"}
                                        </Text>
                                        {match.winner?.id === match.team1?.id && <Text style={{ fontSize: 10 }}>✓</Text>}
                                      </View>
                                      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 3 }} />
                                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                        <Text style={{ color: match.winner?.id === match.team2?.id ? "#00FF9C" : "#94a3b8", fontSize: 11, fontWeight: match.winner?.id === match.team2?.id ? "800" : "400", flex: 1 }} numberOfLines={1}>
                                          {match.isBye ? "BYE" : (match.team2?.name || "TBD")}
                                        </Text>
                                        {match.winner?.id === match.team2?.id && <Text style={{ fontSize: 10 }}>✓</Text>}
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ════ SETTINGS TAB ════ */}
        {activeTab === "settings" && (
          <View style={s.tabContent}>
            <Text style={s.pageTitle}>⚙️ Admin Control Room</Text>
            <Text style={s.pageSub}>Manage security, database, and tournament settings</Text>

            <View style={[s.settingCard, { marginTop: 20 }]}>
              <Text style={s.settingCardTitle}>🔑 Admin Security</Text>
              <Text style={s.settingCardSub}>Change your account password</Text>
              <View style={{ flexDirection: "column", gap: 10 }}>
                <TextInput style={[s.modalInput, { flex: 1, marginBottom: 0 }]} placeholder="New password..." placeholderTextColor="#475569" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                <TouchableOpacity style={s.updatePassBtn} onPress={handleUpdatePassword}><Text style={s.updatePassText}>💾 Update</Text></TouchableOpacity>
              </View>
            </View>

            <View style={s.settingCard}>
              <Text style={s.settingCardTitle}>🔧 Maintenance Tools</Text>
              <Text style={s.settingCardSub}>Database cleanup and system utilities</Text>
              <TouchableOpacity style={s.maintenanceBtn} onPress={handleFixDatabase} disabled={isFixing}>
                <Text style={s.maintenanceBtnText}>{isFixing ? "Fixing..." : "🔧 Fix Ghost Players"}</Text>
              </TouchableOpacity>
            </View>

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
        {[
          { id: "dashboard", icon: "🏠", label: "HOME" },
          { id: "players", icon: "🏃", label: "PLAYERS" },
          { id: "teams", icon: "🛡", label: "TEAMS" },
          { id: "tournament", icon: "🗂", label: "TOURNAMENT" },
          { id: "matches", icon: "📅", label: "MATCHES" },
          { id: "settings", icon: "⚙️", label: "SETTINGS" },
        ].map(tab => (
          <TouchableOpacity key={tab.id} style={s.navBtn} onPress={() => setActiveTab(tab.id)}>
            <View style={[s.navIconWrap, activeTab === tab.id && s.navIconWrapActive]}>
              <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
            </View>
            <Text style={[s.navLabel, activeTab === tab.id && s.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ════ ADD MODAL ════ */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              {addModalView !== "options" && (
                <TouchableOpacity onPress={() => setAddModalView("options")} style={{ marginRight: 12 }}>
                  <Text style={{ color: "#94a3b8" }}>← Back</Text>
                </TouchableOpacity>
              )}
              <Text style={s.modalTitle}>{addModalView === "options" ? "Quick Actions" : addModalView === "teamForm" ? "New Team" : "Schedule Match"}</Text>
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
                <TextInput style={s.modalInput} placeholder="Team Name" placeholderTextColor="#475569" value={newTeamName} onChangeText={setNewTeamName} />
                <TextInput style={s.modalInput} placeholder="Captain Name" placeholderTextColor="#475569" value={newCaptainName} onChangeText={setNewCaptainName} />
                <Text style={s.inputLabel}>Add Players (Optional, max 7)</Text>
                {freeAgents.slice(0, 20).map(p => {
                  const sel = selectedFreeAgents.some(x => x.id === p.id);
                  return (
                    <TouchableOpacity key={p.id} style={[s.agentRow, sel && s.agentRowSelected]} onPress={() => {
                      if (sel) setSelectedFreeAgents(prev => prev.filter(x => x.id !== p.id));
                      else if (selectedFreeAgents.length < 7) setSelectedFreeAgents(prev => [...prev, p]);
                      else Alert.alert("Max 7 players");
                    }}>
                      <Text style={[{ color: "#e2e8f0" }, sel && { color: "#00FF9C" }]}>{sel ? "✓ " : ""}{p.name}</Text>
                      <Text style={{ color: "#475569", fontSize: 11 }}>{p.studentCode}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]} onPress={async () => {
                  if (!newTeamName.trim() || !newCaptainName.trim()) return Alert.alert("Enter team name and captain name");
                  setIsSaving(true);
                  try {
                    const batch = writeBatch(db);
                    const teamRef = doc(collection(db, "teams"));
                    batch.set(teamRef, { teamName: newTeamName.trim(), captainName: newCaptainName.trim(), status: "approved", members: selectedFreeAgents.map(p => p.name), memberIds: selectedFreeAgents.map(p => p.id), createdAt: new Date() });
                    selectedFreeAgents.forEach(p => batch.update(doc(db, "users", p.id), { hasTeam: true, teamId: teamRef.id, assignedTeam: newTeamName.trim() }));
                    await batch.commit();
                    Alert.alert("Team Created!");
                    setShowAddModal(false); setNewTeamName(""); setNewCaptainName(""); setSelectedFreeAgents([]);
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
                    <TouchableOpacity key={t.id} style={[s.teamPill, newMatchTeam1?.id === t.id && s.teamPillActive]} onPress={() => setNewMatchTeam1(t)}>
                      <Text style={[s.teamPillText, newMatchTeam1?.id === t.id && { color: "#000" }]}>{t.teamName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={s.inputLabel}>Away Team</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {approvedTeams.map(t => (
                    <TouchableOpacity key={t.id} style={[s.teamPill, newMatchTeam2?.id === t.id && { backgroundColor: "#a855f7" }]} onPress={() => setNewMatchTeam2(t)}>
                      <Text style={[s.teamPillText, newMatchTeam2?.id === t.id && { color: "#fff" }]}>{t.teamName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={s.modalInput} placeholder="Date (YYYY-MM-DD)" placeholderTextColor="#475569" value={newMatchDate} onChangeText={setNewMatchDate} />
                <TextInput style={s.modalInput} placeholder="Time (HH:MM)" placeholderTextColor="#475569" value={newMatchTime} onChangeText={setNewMatchTime} />
                <Text style={s.inputLabel}>Pitch</Text>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {["Main Pitch", "Pitch 2", "Pitch 3"].map(p => (
                    <TouchableOpacity key={p} style={[s.teamPill, newMatchPitch === p && { backgroundColor: "#00FF9C" }]} onPress={() => setNewMatchPitch(p)}>
                      <Text style={[s.teamPillText, newMatchPitch === p && { color: "#000" }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.primaryBtn} onPress={async () => {
                  if (!newMatchTeam1 || !newMatchTeam2) return Alert.alert("Select both teams");
                  if (newMatchTeam1.id === newMatchTeam2.id) return Alert.alert("Select different teams");
                  setIsSaving(true);
                  try {
                    await addDoc(collection(db, "matches"), { team1Id: newMatchTeam1.id, team2Id: newMatchTeam2.id, date: newMatchDate, time: newMatchTime, pitch: newMatchPitch, score: "", status: "scheduled", tournamentName: tournament?.name || "Friendly", createdAt: new Date() });
                    Alert.alert("Match Scheduled!");
                    setShowAddModal(false); setNewMatchTeam1(null); setNewMatchTeam2(null); setNewMatchDate(""); setNewMatchTime("");
                  } catch (e) { Alert.alert("Error", e.message); }
                  setIsSaving(false);
                }} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>Schedule Match</Text>}
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
            {resultMatch && <Text style={s.resultMatchNames}>{resultMatch.team1Name} vs {resultMatch.team2Name}</Text>}
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.scoreSection}>
                <Text style={s.scoreSectionTitle}>MATCH SCORE</Text>
                <View style={s.scoreRow}>
                  <View style={s.scoreTeam}>
                    <Text style={s.scoreTeamName}>{resultMatch?.team1Name}</Text>
                    <TextInput style={s.scoreInput} value={score1} onChangeText={setScore1} keyboardType="number-pad" maxLength={2} />
                  </View>
                  <View style={s.scoreVsBox}><Text style={s.scoreVsText}>VS</Text></View>
                  <View style={s.scoreTeam}>
                    <Text style={s.scoreTeamName}>{resultMatch?.team2Name}</Text>
                    <TextInput style={s.scoreInput} value={score2} onChangeText={setScore2} keyboardType="number-pad" maxLength={2} />
                  </View>
                </View>
              </View>

              {score1 === score2 && score1 !== "0" && (
                <View style={s.penSection}>
                  <Text style={s.penTitle}>⚡ DRAW — Penalty Shootout</Text>
                  <View style={s.scoreRow}>
                    <TextInput style={[s.scoreInput, { width: 70, height: 70 }]} value={pen1} onChangeText={setPen1} keyboardType="number-pad" />
                    <Text style={{ color: "#64748b", fontSize: 24, marginHorizontal: 8 }}>-</Text>
                    <TextInput style={[s.scoreInput, { width: 70, height: 70 }]} value={pen2} onChangeText={setPen2} keyboardType="number-pad" />
                  </View>
                </View>
              )}

              <Text style={s.statsSectionTitle}>📊 Match Statistics</Text>
              {resultMatch && [{ teamId: resultMatch.team1Id, teamName: resultMatch.team1Name }, { teamId: resultMatch.team2Id, teamName: resultMatch.team2Name }].map(({ teamId, teamName }) => (
                <View key={teamId}>
                  <Text style={s.teamStatsLabel}>🟢 {teamName}</Text>
                  {players.filter(p => p.teamId === teamId && !p.suspendedForNextMatch).map(player => (
                    <View key={player.id} style={s.playerStatRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.playerStatName}>{player.name}</Text>
                        <Text style={s.playerStatPos}>{player.position || "Player"}</Text>
                      </View>
                      <View style={s.playerStatInputs}>
                        {[{ key: "goals", label: "⚽", color: "#00FF9C" }, { key: "yellow", label: "🟨", color: "#eab308" }, { key: "red", label: "🟥", color: "#ef4444" }].map(field => (
                          <View key={field.key} style={s.statInputGroup}>
                            <Text style={{ fontSize: 13, marginBottom: 5 }}>{field.label}</Text>
                            <TextInput style={[s.statInput, { borderColor: field.color + "44" }]} value={playerStats[player.id]?.[field.key] ?? "0"} onChangeText={v => setPlayerStats(prev => ({ ...prev, [player.id]: { ...(prev[player.id] || {}), [field.key]: v } }))} keyboardType="number-pad" maxLength={2} />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              <TouchableOpacity style={[s.primaryBtn, { marginTop: 20 }]} onPress={handleFinalizeMatch} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>✅ Finalize & Archive Match</Text>}
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
                  <TouchableOpacity key={p.id} style={s.agentRow} onPress={() => { const team = approvedTeams.find(t => t.id === addPlayerModal); if (team) handleAddPlayerToTeam(team.id, team.teamName, p.id); }}>
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
          <View style={[s.modalBox, { maxHeight: 420 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Player Details</Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)} style={{ marginLeft: "auto" }}><Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>
            {selectedMember && (
              <View style={{ alignItems: "center" }}>
                <View style={s.memberDetailAvatar}><Text style={s.memberDetailAvatarText}>{selectedMember.name?.[0]?.toUpperCase()}</Text></View>
                <Text style={s.memberDetailName}>{selectedMember.name}</Text>
                <Text style={{ color: "#00FF9C", fontSize: 11, fontWeight: "bold", marginBottom: 20 }}>{selectedMember.position || "Player"}</Text>
                <View style={s.memberDetailStats}>
                  <View style={s.memberDetailStat}><Text style={s.memberDetailStatNum}>{selectedMember.goals || 0}</Text><Text style={s.memberDetailStatLabel}>Goals</Text></View>
                  <View style={s.memberDetailStat}><Text style={[s.memberDetailStatNum, { color: "#eab308" }]}>{selectedMember.yellowCards || 0}</Text><Text style={s.memberDetailStatLabel}>Yellow</Text></View>
                  <View style={s.memberDetailStat}><Text style={[s.memberDetailStatNum, { color: "#ef4444" }]}>{selectedMember.redCards || 0}</Text><Text style={s.memberDetailStatLabel}>Red</Text></View>
                </View>
                <TouchableOpacity style={[s.primaryBtn, { width: "100%", marginTop: 20 }]} onPress={() => setSelectedMember(null)}>
                  <Text style={s.primaryBtnText}>Close</Text>
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
              <TouchableOpacity onPress={() => setShowBuildModal(false)} style={{ marginLeft: "auto" }}><Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={s.modalInput} placeholder="Team Name (optional)" placeholderTextColor="#475569" value={buildTeamName} onChangeText={setBuildTeamName} />
            <Text style={s.inputLabel}>Team Size</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {[2, 3, 4, 5, 6, 7].map(n => (
                <TouchableOpacity key={n} style={[s.countBtn, buildCount === n && s.countBtnActive]} onPress={() => setBuildCount(n)}>
                  <Text style={[s.countBtnText, buildCount === n && { color: "#000" }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: "#64748b", textAlign: "center", marginBottom: 12, fontSize: 12 }}>{freeAgents.length} free agents available</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={handleAutoBuild} disabled={isBuilding || freeAgents.length < buildCount}>
              {isBuilding ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>Build Squad ({buildCount} players)</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      
      <AIChatSidebar
        visible={showAI}
        onClose={() => setShowAI(false)}
        stats={stats}
        players={players}
        teams={approvedTeams}
        matches={matches}
      />

      {/* ════ MATCHMAKING MODAL ════ */}
      <Modal visible={!!showMatchModal} transparent animationType="slide" onRequestClose={() => setShowMatchModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>🔮 Match Player</Text>
              <TouchableOpacity onPress={() => setShowMatchModal(null)} style={{ marginLeft: 'auto' }}>
                <Text style={{ color: '#94a3b8', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {showMatchModal && (
              <>
                <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 16, fontSize: 13 }}>
                  Assign <Text style={{ color: '#fff', fontWeight: '800' }}>{showMatchModal.name}</Text>
                  {showMatchModal.position ? ` (${showMatchModal.position})` : ''} to a team
                </Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Teams needing this position */}
                  {approvedTeams.filter(t =>
                    (t.neededPositions || []).includes(showMatchModal.position) ||
                    t.needsPosition === showMatchModal.position
                  ).length > 0 && (
                      <>
                        <Text style={{ color: '#a78bfa', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                          🎯 Teams Needing {showMatchModal.position}
                        </Text>
                        {approvedTeams
                          .filter(t =>
                            (t.neededPositions || []).includes(showMatchModal.position) ||
                            t.needsPosition === showMatchModal.position
                          )
                          .map(t => (
                            <TouchableOpacity
                              key={t.id}
                              style={[s.agentRow, { borderColor: 'rgba(167,139,250,0.35)', backgroundColor: 'rgba(167,139,250,0.08)', marginBottom: 8 }]}
                              onPress={() => handleAssignToTeam(showMatchModal, t)}
                            >
                              <View>
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t.teamName}</Text>
                                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                                  {(t.neededPositions || [t.needsPosition]).filter(Boolean).map((pos, i) => (
                                    <View key={i} style={{
                                      backgroundColor: pos === showMatchModal.position ? '#a78bfa' : 'rgba(167,139,250,0.15)',
                                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6
                                    }}>
                                      <Text style={{ color: pos === showMatchModal.position ? '#fff' : '#a78bfa', fontSize: 8, fontWeight: '800' }}>{pos}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                              <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '800' }}>Match →</Text>
                            </TouchableOpacity>
                          ))
                        }
                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 }} />
                      </>
                    )}

                  {/* All other teams */}
                  <Text style={{ color: '#475569', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    All Other Teams
                  </Text>
                  {approvedTeams
                    .filter(t =>
                      !(t.neededPositions || []).includes(showMatchModal.position) &&
                      t.needsPosition !== showMatchModal.position
                    )
                    .map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.agentRow, { marginBottom: 8 }]}
                        onPress={() => handleAssignToTeam(showMatchModal, t)}
                      >
                        <Text style={{ color: '#e2e8f0', fontWeight: '700' }}>{t.teamName}</Text>
                        <Text style={{ color: '#475569', fontSize: 11 }}>
                          {getTeamMembers(t).length}/7
                        </Text>
                      </TouchableOpacity>
                    ))
                  }
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>


      {/* ════ DATE PICKER MODAL ════ */}
<Modal visible={showDatePickerModal} transparent animationType="fade" onRequestClose={() => setShowDatePickerModal(false)}>
  <View style={s.modalOverlay}>
    <View style={[s.modalBox, { maxHeight: 420 }]}>
      <View style={s.modalHeader}>
        <Text style={s.modalTitle}>📅 Select Date</Text>
        <TouchableOpacity onPress={() => setShowDatePickerModal(false)} style={{ marginLeft: "auto" }}>
          <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        <ScrollPicker
          label="Day"
          width={70}
          data={Array.from({ length: getDaysInMonth(tempYear, tempMonth) }, (_, i) => ({
            value: i + 1,
            label: String(i + 1).padStart(2, "0"),
          }))}
          selected={tempDay}
          onSelect={setTempDay}
        />
        <ScrollPicker
          label="Month"
          width={110}
          data={[
            { value: 1, label: "Jan" }, { value: 2, label: "Feb" },
            { value: 3, label: "Mar" }, { value: 4, label: "Apr" },
            { value: 5, label: "May" }, { value: 6, label: "Jun" },
            { value: 7, label: "Jul" }, { value: 8, label: "Aug" },
            { value: 9, label: "Sep" }, { value: 10, label: "Oct" },
            { value: 11, label: "Nov" }, { value: 12, label: "Dec" },
          ]}
          selected={tempMonth}
          onSelect={setTempMonth}
        />
        <ScrollPicker
          label="Year"
          width={90}
          data={Array.from({ length: 3 }, (_, i) => {
            const y = new Date().getFullYear() + i;
            return { value: y, label: String(y) };
          })}
          selected={tempYear}
          onSelect={setTempYear}
        />
      </View>

      {/* Preview */}
      <View style={{ backgroundColor: "rgba(0,255,156,0.06)", borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,255,156,0.15)" }}>
        <Text style={{ color: "#64748b", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Selected Date</Text>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>
          {String(Math.min(tempDay, getDaysInMonth(tempYear, tempMonth))).padStart(2, "0")} / {String(tempMonth).padStart(2, "0")} / {tempYear}
        </Text>
      </View>

      <TouchableOpacity style={s.primaryBtn} onPress={confirmDate}>
        <Text style={s.primaryBtnText}>Confirm Date</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

{/* ════ TIME PICKER MODAL ════ */}
<Modal visible={showTimePickerModal} transparent animationType="fade" onRequestClose={() => setShowTimePickerModal(false)}>
  <View style={s.modalOverlay}>
    <View style={[s.modalBox, { maxHeight: 380 }]}>
      <View style={s.modalHeader}>
        <Text style={s.modalTitle}>🕐 Select Time</Text>
        <TouchableOpacity onPress={() => setShowTimePickerModal(false)} style={{ marginLeft: "auto" }}>
          <Text style={{ color: "#94a3b8", fontSize: 20 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <ScrollPicker
          label="Hour"
          width={90}
          data={Array.from({ length: 24 }, (_, i) => ({
            value: i,
            label: String(i).padStart(2, "0"),
          }))}
          selected={tempHour}
          onSelect={setTempHour}
        />
        <Text style={{ color: "#00FF9C", fontSize: 28, fontWeight: "900", marginTop: 20 }}>:</Text>
        <ScrollPicker
          label="Min"
          width={90}
          data={Array.from({ length: 12 }, (_, i) => ({
            value: i * 5,
            label: String(i * 5).padStart(2, "0"),
          }))}
          selected={tempMinute}
          onSelect={setTempMinute}
        />
      </View>

      {/* Preview */}
      <View style={{ backgroundColor: "rgba(0,255,156,0.06)", borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,255,156,0.15)" }}>
        <Text style={{ color: "#64748b", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Selected Time</Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>
          {String(tempHour).padStart(2, "0")} : {String(tempMinute).padStart(2, "0")}
        </Text>
      </View>

      <TouchableOpacity style={s.primaryBtn} onPress={confirmTime}>
        <Text style={s.primaryBtnText}>Confirm Time</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, sub }) => (
  <View style={s.statCard}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <Text style={[s.statCardLabel, { color }]}>{label}</Text>
      <Text style={{ fontSize: 18, color }}>{icon}</Text>
    </View>
    <Text style={s.statCardValue}>{value}</Text>
    {sub && <Text style={s.statCardSub}>{sub}</Text>}
  </View>
);

const EmptyState = ({ icon, text, sub }) => (
  <View style={s.emptyState}>
    <View style={s.emptyStateBox}>
      {icon ? <Text style={{ fontSize: 36 }}>{icon}</Text> : <Text style={{ fontSize: 36, color: "#475569" }}>⚽</Text>}
    </View>
    <Text style={s.emptyStateText}>{text}</Text>
    {sub && <Text style={s.emptyStateSub}>{sub}</Text>}
  </View>
);

const WizardStep = ({ step, current, label }) => {
  const done = step < current, active = step === current;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[s.wizardCircle, active && s.wizardCircleActive, done && s.wizardCircleDone]}>
        <Text style={[s.wizardNum, (active || done) && { color: "#000" }]}>{done ? "✓" : step}</Text>
      </View>
      <Text style={[s.wizardLabel, active && { color: "#fff" }, done && { color: "#00FF9C" }]}>{label}</Text>
    </View>
  );
};

const MatchCard = ({ match, type, roundLabel, onEnterResult, onDelete }) => {
  const isLive = type === "live", isPending = type === "pending", isCompleted = type === "completed";
  const statusConfig = isLive
    ? { label: "LIVE NOW", color: "#ef4444", headerBg: "rgba(239,68,68,0.12)" }
    : isPending ? { label: "PENDING RESULT", color: "#fbbf24", headerBg: "rgba(251,191,36,0.08)" }
      : isCompleted ? { label: "FINISHED", color: "#00FF9C", headerBg: "rgba(0,255,156,0.07)" }
        : { label: "UPCOMING", color: "#64748b", headerBg: "rgba(255,255,255,0.03)" };

  return (
    <View style={[s.matchCard, isLive && { borderColor: "rgba(239,68,68,0.35)" }, isPending && { borderColor: "rgba(251,191,36,0.3)" }]}>
      <View style={[s.matchCardHeader, { backgroundColor: statusConfig.headerBg }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {roundLabel && <View style={s.roundBadge}><Text style={s.roundBadgeText}>{roundLabel}</Text></View>}
          {match.tournamentName && <Text style={s.tournamentBadge}>{match.tournamentName}</Text>}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {isLive && <View style={s.liveDot} />}
            <Text style={[s.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <Text style={{ color: "#475569" }}>🗑</Text>
        </TouchableOpacity>
      </View>

      <View style={s.matchTeamsRow}>
        <View style={s.matchTeamSide}>
          <View style={s.teamIconBox}><Text style={{ fontSize: 26 }}>⚽</Text></View>
          <Text style={s.matchTeamName} numberOfLines={1}>{match.team1Name}</Text>
          {isCompleted && match.score && <Text style={s.matchScoreNum}>{match.score.split("-")[0]?.trim()}</Text>}
        </View>
        <View style={s.matchVsBox}>
          {isCompleted && match.score
            ? <Text style={s.fullScore}>{match.score.replace(/ /g, "")}</Text>
            : <Text style={s.vsText}>VS</Text>
          }
        </View>
        <View style={[s.matchTeamSide, { alignItems: "flex-end" }]}>
          <View style={s.teamIconBox}><Text style={{ fontSize: 26 }}>⚽</Text></View>
          <Text style={[s.matchTeamName, { textAlign: "right" }]} numberOfLines={1}>{match.team2Name}</Text>
          {isCompleted && match.score && <Text style={s.matchScoreNum}>{match.score.split("-")[1]?.trim()}</Text>}
        </View>
      </View>

      <View style={s.matchMeta}>
        {match.date && <Text style={s.matchMetaText}>📅 {match.date}</Text>}
        {match.time && <Text style={s.matchMetaText}>🕐 {match.time}</Text>}
        {match.pitch && <Text style={s.matchMetaText}>📍 {match.pitch}</Text>}
      </View>

      {isCompleted && match.penalties && (
        <View style={{ alignItems: "center", paddingBottom: 10 }}>
          <Text style={s.penBadge}>Penalties: {match.penalties}</Text>
        </View>
      )}

      {!isCompleted && !isLive && onEnterResult && (
        <TouchableOpacity style={[s.matchActionBtn, isPending && { backgroundColor: "#fbbf24" }]} onPress={onEnterResult}>
          <Text style={[s.matchActionBtnText, isPending && { color: "#000" }]}>{isPending ? "Submit Match Score" : "Enter Results Early"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const ScrollPicker = ({ data, selected, onSelect, width = 80, label }) => {
  const ITEM_H = 44;
  const ref = React.useRef(null);
  const idx = data.findIndex(d => d.value === selected);

  React.useEffect(() => {
    if (ref.current && idx >= 0) {
      ref.current.scrollTo({ y: idx * ITEM_H, animated: false });
    }
  }, [selected]);

  return (
    <View style={{ alignItems: "center", width }}>
      {label && <Text style={{ color: "#64748b", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</Text>}
      <View style={{ height: ITEM_H * 5, width, overflow: "hidden", position: "relative" }}>
        {/* Highlight Center */}
        <View style={{ position: "absolute", top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H, backgroundColor: "rgba(0,255,156,0.08)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(0,255,156,0.25)", zIndex: 1, pointerEvents: "none" }} />
        {/* Top Fade */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 2, zIndex: 2, pointerEvents: "none", background: "transparent" }} />
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
            const clamped = Math.max(0, Math.min(index, data.length - 1));
            onSelect(data[clamped].value);
          }}
        >
          {data.map((item) => (
            <TouchableOpacity
              key={item.value}
              onPress={() => {
                onSelect(item.value);
                const i = data.findIndex(d => d.value === item.value);
                ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
              }}
              style={{ height: ITEM_H, justifyContent: "center", alignItems: "center" }}
            >
              <Text style={{
                color: item.value === selected ? "#00FF9C" : "#64748b",
                fontSize: item.value === selected ? 20 : 15,
                fontWeight: item.value === selected ? "900" : "400",
              }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14, backgroundColor: "rgba(2,6,23,0.95)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#00FF9C", justifyContent: "center", alignItems: "center" },
  headerLogoText: { color: "#000", fontWeight: "900", fontSize: 13 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  addBtn: { backgroundColor: "#00FF9C", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12},
  addBtnText: { color: "#000", fontWeight: "800", fontSize: 13 },

  // Content
  tabContent: { padding: 18, paddingBottom: 8 },
  pageHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  pageSub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  // Hero
  heroSection: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 16 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,255,156,0.1)", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  livePillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#00FF9C" },
  livePillText: { color: "#00FF9C", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 10, letterSpacing: -0.5 },
  heroSub: { color: "#64748b", fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  heroButtons: { flexDirection: "column", gap: 10, width: "100%", paddingHorizontal: 16 },
  heroBtn: { backgroundColor: "#00FF9C", paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, alignItems: "center"},
  heroBtnText: { color: "#000", fontWeight: "800", fontSize: 14 },
  heroBtnOutline: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  heroBtnOutlineText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Champion
  championBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "rgba(234,179,8,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(234,179,8,0.22)", marginBottom: 16 },
  championIcon: { fontSize: 28 },
  championLabel: { color: "#eab308", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  championName: { color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase" },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: "#0f172a", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  statCardLabel: { fontSize: 12, fontWeight: "700" },
  statCardValue: { color: "#fff", fontSize: 34, fontWeight: "900", marginTop: 6, letterSpacing: -1 },
  statCardSub: { color: "#64748b", fontSize: 11, marginTop: 4 },

  // Dash tabs
  dashTabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)", marginBottom: 20, gap: 4 },
  dashTab: { paddingBottom: 12, paddingHorizontal: 4, marginRight: 16, flexDirection: "row", alignItems: "center", gap: 6 },
  dashTabActive: { borderBottomWidth: 2, borderBottomColor: "#00FF9C" },
  dashTabText: { color: "#64748b", fontSize: 14, fontWeight: "700" },
  dashTabTextActive: { color: "#00FF9C" },
  tabBadge: { backgroundColor: "#00FF9C", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { color: "#000", fontSize: 9, fontWeight: "900" },

  // Match grid
  matchGrid: { gap: 14 },

  // Match Card
  matchCard: { backgroundColor: "#0f172a", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  matchCardHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },
  statusLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  roundBadge: { backgroundColor: "rgba(0,255,156,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  roundBadgeText: { color: "#00FF9C", fontSize: 8, fontWeight: "800" },
  tournamentBadge: { color: "#fbbf24", fontWeight: "800", fontSize: 11 },
  matchTeamsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 18, gap: 8 },
  matchTeamSide: { flex: 1, alignItems: "center", gap: 8 },
  teamIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#00FF9C", alignItems: "center", justifyContent: "center" },
  matchTeamName: { color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" },
  matchScoreNum: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  matchVsBox: { width: 44, alignItems: "center" },
  vsText: { color: "#334155", fontSize: 12, fontWeight: "800" },
  fullScore: { color: "#fff", fontSize: 20, fontWeight: "900" },
  matchMeta: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  matchMetaText: { color: "#64748b", fontSize: 10 },
  penBadge: { color: "#fbbf24", fontSize: 10, fontWeight: "700", backgroundColor: "rgba(251,191,36,0.1)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  matchActionBtn: { marginHorizontal: 14, marginBottom: 14, backgroundColor: "#00FF9C", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  matchActionBtnText: { color: "#000", fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },

  // Request card
  requestCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 16, borderLeftWidth: 4, borderLeftColor: "#3b82f6", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  requestCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  requestTeamName: { color: "#fff", fontSize: 20, fontWeight: "900" },
  requestCaptain: { color: "#64748b", fontSize: 12, marginTop: 3 },
  playerCountBadge: { backgroundColor: "rgba(0,255,156,0.1)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  playerCountText: { color: "#00FF9C", fontWeight: "700", fontSize: 11 },
  memberTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  memberTag: { backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  memberTagText: { color: "#cbd5e1", fontSize: 11, fontWeight: "600" },
  requestActions: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, backgroundColor: "#00FF9C", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  approveBtnText: { color: "#000", fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
  rejectBtn: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  rejectBtnText: { color: "#94a3b8", fontWeight: "700", fontSize: 12 },

  // Match tabs
  matchTabRow: { flexDirection: "row" },
  matchTabBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  matchTabText: { color: "#475569", fontWeight: "700", fontSize: 11 },
  matchStatsFooter: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", marginTop: 28, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1,
   borderTopColor: "rgba(255,255,255,0.07)", backgroundColor: "#0f172a", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  matchStat: { alignItems: "center", flex: 1 },
  matchStatNum: { color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  matchStatLabel: { color: "#475569", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginTop: 4, fontWeight: "800", textAlign: "center" },
  matchStatDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.08)" },

  // Round filter
  roundFilterBtn: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  roundFilterBtnActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  roundFilterText: { color: "#64748b", fontWeight: "700", fontSize: 10, textTransform: "uppercase" },

  //players
  playerCard: {
    flexDirection: "row", gap: 8, backgroundColor: "#0f172a",
    borderRadius: 16, padding: 12,  marginBottom: 10,
    borderWidth: 1, borderColor: "rgb(66, 154, 104)", alignItems: "center",
  },
  playerCardSuspended: { borderColor: "rgb(214, 109, 109)" },
  playerRankBadge: { width: 36 },
  playerRank: { color: "#97b3db", fontWeight: "bold", fontSize: 18 },
  playerAvatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "rgba(0,255,156,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(0,255,156,0.3)",
  },
  playerAvatarText: { color: "#00FF9C", fontSize: 16, fontWeight: "bold" },
  playerName: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  playerSub: { color: "#acb0b5", fontSize: 10, marginTop: 1 },
  playerTeam: { color: "#00FF9C", fontSize: 11, fontWeight: "bold", marginTop: 1 },
  playerStats: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  playerStatGoals: { color: "#00FF9C", fontSize: 11, fontWeight: "bold" },
  playerStatYellow: { color: "#eab308", fontSize: 11, fontWeight: "bold" },
  playerStatRed: { color: "#ef4444", fontSize: 12, fontWeight: "bold" },
  suspendBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontSize: 9, fontWeight: "bold", color: "#fff" },
  passRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  passLabel: { color: "#64748b", fontSize: 8, marginRight: 3 },
  passValue: { color: "#fbbf24", fontSize: 10, fontStyle: "italic", fontWeight: "bold" },
  playerActions: { alignItems: "flex-end", gap: 6, justifyContent: "center", minWidth: 68  },
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

  // Teams
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  searchInput: { flex: 1, color: "#fff", height: 46, fontSize: 14 },
  searchBoxSmall: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", minWidth: 160 },
  searchInputSmall: { color: "#fff", fontSize: 13, height: 38 },
  teamsGrid: { gap: 14 },
  teamCard: { backgroundColor: "#0f172a", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  teamCardHeader: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  teamCardName: { color: "#fff", fontSize: 20, fontWeight: "900" },
  teamPlayerCount: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 8 },
  teamPlayerCountText: { color: "#00FF9C", fontSize: 12, fontWeight: "700" },
  captainBadge: { backgroundColor: "rgba(0,255,156,0.08)", borderWidth: 1, borderColor: "rgba(0,255,156,0.18)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  captainBadgeText: { color: "#00FF9C", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 2 },
  captainName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  deleteIconBtn: { padding: 6 },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  renameInput: { flex: 1, backgroundColor: "#1e293b", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: "#fff", fontSize: 16, fontWeight: "700", borderWidth: 1, borderColor: "#00FF9C" },
  rosterToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  rosterToggleText: { color: "#64748b", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  rosterList: { paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  rosterRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.03)" },
  rosterRowRed: { backgroundColor: "rgba(239,68,68,0.07)" },
  rosterRowYellow: { backgroundColor: "rgba(234,179,8,0.07)" },
  rosterDot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  rosterName: { color: "#e2e8f0", fontWeight: "600", flex: 1, fontSize: 13 },
  addAgentBtn: { margin: 12, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(0,255,156,0.04)" },
  addAgentBtnText: { color: "#00FF9C", fontWeight: "700", fontSize: 13 },
  addAgentIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#00FF9C", alignItems: "center", justifyContent: "center" },

  // Players table
  playerControlRow: { marginBottom: 12 },
  statsLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Custom Dropdown Styles
  customDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 180,
  },
  customDropdownBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  customDropdownArrow: {
    color: "#00FF9C",
    fontSize: 10,
    marginLeft: 8,
  },
  modalOverlayLight: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModal: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    width: width * 0.85,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  dropdownTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  dropdownClose: {
    color: "#64748b",
    fontSize: 18,
    fontWeight: "600",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  dropdownItemActive: {
    backgroundColor: "rgba(0,255,156,0.1)",
  },
  dropdownItemText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "500",
  },
  dropdownItemTextActive: {
    color: "#00FF9C",
    fontWeight: "700",
  },
  dropdownCheck: {
    color: "#00FF9C",
    fontSize: 14,
    fontWeight: "bold",
  },

  statsFilterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statsFilterBtnActive: { backgroundColor: "#334155", borderColor: "#475569" },
  statsFilterText: { color: "#9099a4", fontWeight: "600", fontSize: 12 },
  top10Btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  top10BtnActive: { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)" },
  top10BtnText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  filterPillActive: { backgroundColor: "#00FF9C" },
  filterPillText: { color: "#64748b", fontWeight: "800", fontSize: 10 },
  tableHeader: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, marginBottom: 4 },
  tableHeaderText: { color: "#475569", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  tableRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#0f172a", borderRadius: 14, marginBottom: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", alignItems: "center" },
  rankText: { color: "#64748b", fontWeight: "800", fontSize: 13 },
  playerAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,255,156,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,255,156,0.25)" },
  playerAvatarText: { color: "#00FF9C", fontSize: 15, fontWeight: "800" },
  playerNameText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  playerCodeText: { color: "#64748b", fontSize: 10, marginTop: 1 },
  playerGoals: { color: "#00FF9C", fontSize: 10, fontWeight: "700" },
  playerYellow: { color: "#eab308", fontSize: 10, fontWeight: "700" },
  playerRed: { color: "#ef4444", fontSize: 10, fontWeight: "700" },
  passText: { color: "#fbbf24", fontSize: 10, marginTop: 2 },
  teamBadge: { backgroundColor: "rgba(0,255,156,0.12)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  teamBadgeText: { color: "#00FF9C", fontWeight: "700", fontSize: 10 },
  freeAgentBadge: { backgroundColor: "rgba(100,116,139,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  freeAgentBadgeText: { color: "#94a3b8", fontSize: 10, fontWeight: "600" },
  positionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  positionBadgeText: { fontSize: 10, fontWeight: "700" },
  activateBtn: { backgroundColor: "#ea580c", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  activateBtnText: { color: "#fff", fontWeight: "700", fontSize: 10 },
  activeBadge: { backgroundColor: "rgba(0,255,156,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  activeBadgeText: { color: "#00FF9C", fontSize: 10, fontWeight: "700" },
  fab: { position: "absolute", bottom: 16, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: "#00FF9C", alignItems: "center", justifyContent: "center", elevation: 8 },
  fabText: { fontSize: 24 },

  // Tournament
  forceResetBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  forceResetText: { color: "#ef4444", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  wizardSteps: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 },
  wizardArrow: { color: "rgba(0,255,156,0.3)", fontSize: 24, fontWeight: "700" },
  wizardCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#334155" },
  wizardCircleActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  wizardCircleDone: { backgroundColor: "rgba(0,255,156,0.2)", borderColor: "#00FF9C" },
  wizardNum: { color: "#64748b", fontWeight: "800", fontSize: 14 },
  wizardLabel: { color: "#64748b", fontSize: 9, fontWeight: "800", textTransform: "uppercase", marginTop: 5, letterSpacing: 1 },
  setupCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(0,255,156,0.12)" },
  setupCardTitle: { color: "#00FF9C", fontWeight: "800", fontSize: 10, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 },
  regLiveTitle: { color: "#00FF9C", fontWeight: "700", fontSize: 13 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#00FF9C" },
  regRange: { color: "#64748b", fontSize: 11, marginBottom: 14 },
  registeredTeamRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10, marginBottom: 5 },
  registeredTeamName: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dateTag: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,255,156,0.07)", borderWidth: 1, borderColor: "rgba(0,255,156,0.18)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginBottom: 8 },
  dateTagText: { color: "#00FF9C", fontWeight: "700", fontSize: 12 },
  generatingContainer: { alignItems: "center", padding: 48, gap: 16 },
  generatingTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  generatingSubtext: { color: "#64748b", fontSize: 13 },
  bracketContainer: { backgroundColor: "#0f172a", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  bracketTitle: { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: -0.3 },
  bracketSubtitle: { color: "#64748b", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 16 },
  bracketColumn: { width: 188 },
  bracketRoundHeader: { alignItems: "center", marginBottom: 12 },
  bracketRoundLabel: { color: "#00FF9C", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 },
  bracketRoundDate: { color: "#64748b", fontSize: 8, marginTop: 4 },
  bracketMatchBox: { backgroundColor: "#1e293b", borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  bracketMatchLabel: { color: "#475569", fontSize: 7, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 },
  bracketTeamRow: { padding: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  bracketTeamRowWinner: { backgroundColor: "rgba(0,255,156,0.1)", borderColor: "rgba(0,255,156,0.25)" },
  bracketTeamText: { color: "#e2e8f0", fontWeight: "700", fontSize: 11 },
  byeRow: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#334155", borderStyle: "dashed", alignItems: "center" },
  byeText: { color: "#475569", fontWeight: "700", fontSize: 10 },
  bracketMatchMeta: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 8 },
  bracketMatchMetaText: { color: "#475569", fontSize: 8 },
  archiveSection: { marginTop: 24 },
  archiveToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0f172a", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 8 },
  archiveToggleText: { color: "#64748b", fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  archiveCard: { backgroundColor: "#0f172a", borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  archiveCardTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  archiveWinner: { color: "#fbbf24", fontSize: 12, fontWeight: "700", marginBottom: 3 },
  archiveDate: { color: "#64748b", fontSize: 10, fontWeight: "600" },

  // Settings
  settingCard: { backgroundColor: "#0f172a", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  dangerCard: { borderColor: "rgba(239,68,68,0.18)" },
  settingCardTitle: { color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 5 },
  settingCardSub: { color: "#64748b", fontSize: 12, marginBottom: 16 },
  updatePassBtn: { backgroundColor: "#3b82f6", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  updatePassText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  maintenanceBtn: { backgroundColor: "rgba(0,255,156,0.08)", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  maintenanceBtnText: { color: "#00FF9C", fontWeight: "700", fontSize: 13 },
  dangerWarning: { color: "#475569", fontSize: 10, textAlign: "center", marginTop: 14, textTransform: "uppercase" },

  // Bottom Nav
  bottomNav: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "rgba(2,6,23,0.97)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", paddingBottom: 30, paddingTop: 10 },
  navBtn: { alignItems: "center", gap: 4, minWidth: 44 },
  navIconWrap: { width: 40, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  navIconWrapActive: { backgroundColor: "rgba(0,255,156,0.12)" },
  navLabel: { color: "#334155", fontSize: 7, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  navLabelActive: { color: "#00FF9C" },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#0f172a", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", maxHeight: "88%" },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
  modalTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  inputLabel: { color: "#475569", fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginBottom: 7, marginTop: 2, letterSpacing: 1 },
  modalInput: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 12 },
  optionCard: { flexDirection: "row", gap: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  optionTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  optionSub: { color: "#64748b", fontSize: 12, marginTop: 3 },
  agentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  agentRowSelected: { backgroundColor: "rgba(0,255,156,0.07)", borderColor: "rgba(0,255,156,0.28)" },
  teamPill: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  teamPillActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  teamPillText: { color: "#94a3b8", fontWeight: "700", fontSize: 12 },
  countBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  countBtnActive: { backgroundColor: "#00FF9C", borderColor: "#00FF9C" },
  countBtnText: { color: "#94a3b8", fontWeight: "700" },

  // Result modal
  resultMatchNames: { color: "#94a3b8", textAlign: "center", marginBottom: 18, fontSize: 13 },
  scoreSection: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 16 },
  scoreSectionTitle: { color: "#00FF9C", fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginBottom: 16, letterSpacing: 1 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  scoreTeam: { alignItems: "center" },
  scoreTeamName: { color: "#64748b", fontSize: 10, marginBottom: 10, textTransform: "uppercase", fontWeight: "700" },
  scoreInput: { width: 90, height: 90, backgroundColor: "#1e293b", borderRadius: 22, color: "#fff", fontSize: 42, fontWeight: "900", textAlign: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.1)" },
  scoreVsBox: { width: 40, alignItems: "center" },
  scoreVsText: { color: "#334155", fontSize: 20, fontWeight: "700" },
  penSection: { backgroundColor: "rgba(251,191,36,0.06)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(251,191,36,0.18)", marginBottom: 16 },
  penTitle: { color: "#fbbf24", fontSize: 10, fontWeight: "800", textAlign: "center", marginBottom: 14, textTransform: "uppercase" },
  statsSectionTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 14 },
  teamStatsLabel: { color: "#00FF9C", fontSize: 10, fontWeight: "800", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  playerStatRow: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", flexDirection: "row", alignItems: "center" },
  playerStatName: { color: "#fff", fontWeight: "700", fontSize: 13 },
  playerStatPos: { color: "#64748b", fontSize: 10, marginTop: 2 },
  playerStatInputs: { flexDirection: "row", gap: 12 },
  statInputGroup: { alignItems: "center" },
  statInput: { width: 52, height: 52, backgroundColor: "#1e293b", borderRadius: 14, color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", borderWidth: 2 },

  // Member detail
  memberDetailAvatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: "rgba(0,255,156,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(0,255,156,0.25)", marginBottom: 14 },
  memberDetailAvatarText: { color: "#00FF9C", fontSize: 30, fontWeight: "800" },
  memberDetailName: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  memberDetailStats: { flexDirection: "row", gap: 16 },
  memberDetailStat: { alignItems: "center", backgroundColor: "#1e293b", borderRadius: 16, padding: 16, minWidth: 74, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  memberDetailStatNum: { color: "#fff", fontSize: 26, fontWeight: "900" },
  memberDetailStatLabel: { color: "#64748b", fontSize: 9, textTransform: "uppercase", marginTop: 4 },

  // Buttons
  primaryBtn: { backgroundColor: "#00FF9C", borderRadius: 16, paddingVertical: 17, alignItems: "center" },
  primaryBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
  secondaryBtn: { backgroundColor: "rgba(0,255,156,0.08)", borderRadius: 14, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  secondaryBtnText: { color: "#00FF9C", fontWeight: "700", fontSize: 13 },
  dangerBtn: { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.22)", marginTop: 6 },
  dangerBtnText: { color: "#ef4444", fontWeight: "800", fontSize: 13, textTransform: "uppercase" },
  dangerBtnSmall: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  dangerBtnSmallText: { color: "#ef4444", fontSize: 11, fontWeight: "800" },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 52 },
  emptyStateBox: { width: 72, height: 72, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyStateText: { color: "#475569", fontSize: 15, fontWeight: "700", marginBottom: 5 },
  emptyStateSub: { color: "#334155", fontSize: 12 },
});