import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ImageBackground, TextInput, Modal, ActivityIndicator,
  FlatList, Dimensions, Switch, Image
} from "react-native";
import { auth, db } from "../../firebase";
import {
  collection, onSnapshot, doc, updateDoc, addDoc,
  getDocs, deleteDoc, writeBatch, getDoc, serverTimestamp, setDoc, increment, arrayUnion, arrayRemove, query, where
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "expo-router";
import AIChatModal from "../Aichatmodal";

const { width } = Dimensions.get("window");

const getRoundLabel = (roundIndex, totalRounds) => {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "FINAL";
  if (fromEnd === 1) return "SEMI-FINALS";
  if (fromEnd === 2) return "QUARTER-FINAL";
  return `ROUND ${roundIndex + 1}`;
};

export default function StudentDashboard() {
  const [userData, setUserData] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMemberCode, setNewMemberCode] = useState("");
  const [nextMatch, setNextMatch] = useState(null);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [finishedMatches, setFinishedMatches] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
  const [activeView, setActiveView] = useState("dashboard");
  const [userRank, setUserRank] = useState(null);
  const [historyTab, setHistoryTab] = useState("myTeam");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [savingPosition, setSavingPosition] = useState(false);
  const [showSoloModal, setShowSoloModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archived, setArchived] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let unsubUser = () => {};
    let unsubTeam = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserData({ ...data, email: user.email, uid: user.uid });
            if (data.teamId) {
              const teamRef = doc(db, "teams", data.teamId);
              if (unsubTeam) unsubTeam();
              unsubTeam = onSnapshot(teamRef, (tSnap) => {
                if (tSnap.exists()) setTeamData({ id: tSnap.id, ...tSnap.data() });
                else setTeamData(null);
              });
            } else {
              setTeamData(null);
            }
          }
          setLoading(false);
        });
      } else {
        router.replace("/(auth)/login");
      }
    });

    const unsubTournament = onSnapshot(doc(db, "tournaments", "main"), (snap) => {
      if (snap.exists()) setTournament({ id: snap.id, ...snap.data() });
      else setTournament(null);
    });

    return () => { unsubAuth(); unsubUser(); unsubTeam(); unsubTournament(); };
  }, []);

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setApprovedTeams(all.filter(t => t.status === "approved"));
    });
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
      setAllStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubTeams(); unsubMatches(); unsubAllUsers(); };
  }, []);

  useEffect(() => {
    const fetchArchive = async () => {
      const snap = await getDocs(collection(db, "tournaments_archive"));
      setArchived(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.archivedAt?.toDate?.() ?? new Date(0)) - (a.archivedAt?.toDate?.() ?? new Date(0))));
    };
    fetchArchive();
  }, []);

  useEffect(() => {
    const DURATION = 20 * 60 * 1000;
    const live = matches.filter((m) => {
      if (!m.date || !m.time) return false;
      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const start = new Date(y, mm - 1, d, h, min).getTime();
      return now >= start && now <= start + DURATION && (m.status || "").toLowerCase() !== "completed";
    });
    setLiveMatches(live);
    setFinishedMatches(matches.filter(m => (m.status || "").trim().toLowerCase() === "completed"));
  }, [matches, now]);

  useEffect(() => {
    if (!userData?.teamId) { setNextMatch(null); return; }
    const scheduled = matches.filter(m => {
      if (!m.date || !m.time) return false;
      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(y, mm - 1, d, h, min).getTime();
      return (m.team1Id === userData.teamId || m.team2Id === userData.teamId) &&
        (m.status || "").toLowerCase() !== "completed" && matchTime > now;
    });
    if (!scheduled.length) { setNextMatch(null); return; }
    const sorted = [...scheduled].sort((a, b) => {
      const da = new Date(`${a.date} ${a.time || "00:00"}`).getTime();
      const db2 = new Date(`${b.date} ${b.time || "00:00"}`).getTime();
      return da - db2;
    });
    const next = sorted[0];
    const opponentId = next.team1Id === userData.teamId ? next.team2Id : next.team1Id;
    const opponentTeam = approvedTeams.find(t => t.id === opponentId);
    setNextMatch({ ...next, opponentName: opponentTeam?.teamName || next.team1Name || next.team2Name || "TBD" });
  }, [matches, approvedTeams, userData?.teamId, now]);

  useEffect(() => {
    const fetchRank = async () => {
      if (!userData?.uid) return;
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const snap = await getDocs(q);
        const students = snap.docs.map(d => ({ id: d.id, goals: d.data().goals || 0 }));
        students.sort((a, b) => b.goals - a.goals);
        setUserRank(students.findIndex(s => s.id === userData.uid) + 1);
      } catch (e) { console.error(e); }
    };
    fetchRank();
  }, [userData?.uid]);

  // ─── Tournament helpers ───────────────────────────────────────
  const getRemainingTime = () => {
    if (!tournament?.createdAt) return "Expired";
    const createdAt = tournament.createdAt?.toDate
      ? tournament.createdAt.toDate().getTime()
      : typeof tournament.createdAt === "number"
        ? tournament.createdAt
        : new Date(tournament.createdAt).getTime();
    const deadline = createdAt + 48 * 60 * 60 * 1000;
    const diff = deadline - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getDeadlineString = () => {
    if (!tournament?.createdAt) return null;
    const createdAt = tournament.createdAt?.toDate
      ? tournament.createdAt.toDate().getTime()
      : typeof tournament.createdAt === "number"
        ? tournament.createdAt
        : new Date(tournament.createdAt).getTime();
    const deadline = createdAt + 48 * 60 * 60 * 1000;
    const date = new Date(deadline);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month}, ${hours}:${minutes}`;
  };

  const tournamentWinner = React.useMemo(() => {
    if (!tournament?.rounds) return null;
    const keys = Object.keys(tournament.rounds);
    return tournament.rounds[`${keys.length - 1}`]?.[0]?.winner ?? null;
  }, [tournament]);

  // ─── Team actions ─────────────────────────────────────────────
  const acceptInvite = async (req) => {
    if (userData.hasTeam) { Alert.alert("Error", "You already have a team!"); return; }
    try {
      const user = auth.currentUser;
      const teamRef = doc(db, "teams", req.teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) { Alert.alert("Error", "Team not found!"); return; }
      await updateDoc(teamRef, { memberIds: arrayUnion(user.uid), members: arrayUnion(userData.name) });
      await updateDoc(doc(db, "users", user.uid), {
        hasTeam: true, teamId: req.teamId, assignedTeam: req.teamName, teamRequests: [],
      });
      Alert.alert("Success", "Joined team successfully! ✅");
    } catch (err) { Alert.alert("Error", err.message); }
  };

  const rejectInvite = async (req) => {
    const updated = userData.teamRequests.filter(r => r.teamId !== req.teamId);
    await updateDoc(doc(db, "users", userData.uid), { teamRequests: updated });
  };

  const leaveTeam = async () => {
    Alert.alert("Leave Team", "Are you sure you want to leave the team?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave", style: "destructive", onPress: async () => {
          const user = auth.currentUser;
          const index = teamData.memberIds.findIndex(id => id === user.uid);
          if (index === -1) return;
          const newMemberIds = [...teamData.memberIds];
          const newMembers = [...teamData.members];
          newMemberIds.splice(index, 1);
          newMembers.splice(index, 1);
          try {
            const batch = writeBatch(db);
            if (userData.uid === teamData.captainId) {
              if (newMemberIds.length > 0) {
                batch.update(doc(db, "teams", userData.teamId), {
                  memberIds: newMemberIds, members: newMembers,
                  captainId: newMemberIds[0], captainName: newMembers[0]
                });
              } else {
                batch.delete(doc(db, "teams", userData.teamId));
              }
            } else {
              batch.update(doc(db, "teams", userData.teamId), { memberIds: newMemberIds, members: newMembers });
            }
            batch.update(doc(db, "users", user.uid), { hasTeam: false, teamId: "", assignedTeam: "" });
            await batch.commit();
          } catch (err) { Alert.alert("Error", err.message); }
        }
      }
    ]);
  };

  const removePlayer = async (index) => {
    Alert.alert("Remove Player", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          const newIds = [...teamData.memberIds];
          const newNames = [...teamData.members];
          const removedId = newIds[index];
          newIds.splice(index, 1);
          newNames.splice(index, 1);
          await updateDoc(doc(db, "teams", teamData.id), { memberIds: newIds, members: newNames });
          await updateDoc(doc(db, "users", removedId), { hasTeam: false, teamId: "", assignedTeam: "" });
        }
      }
    ]);
  };

  const sendInvite = async () => {
    if (!newMemberCode.trim()) { Alert.alert("Error", "Enter student code"); return; }
    try {
      const teamRef = doc(db, "teams", userData.teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) { Alert.alert("Error", "Team not found"); return; }
      const team = teamSnap.data();
      if ((team.members || []).length >= 7) { Alert.alert("Error", "Team is full!"); return; }
      const q = query(collection(db, "users"), where("studentCode", "==", newMemberCode));
      const snap = await getDocs(q);
      if (snap.empty) { Alert.alert("Error", "Student not found"); return; }
      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data();
      if (studentData.hasTeam) { Alert.alert("Error", "Student already in a team"); return; }
      const existingRequests = studentData.teamRequests || [];
      if (existingRequests.some(req => req.teamId === teamData.id)) {
        Alert.alert("Error", "Invite already sent"); return;
      }
      await updateDoc(doc(db, "users", studentDoc.id), {
        teamRequests: arrayUnion({
          teamId: teamData.id, teamName: teamData.teamName,
          captainId: userData.uid, captainName: userData.name,
        }),
      });
      Alert.alert("Success", `${studentData.name} has been invited!`);
      setNewMemberCode("");
    } catch (err) { Alert.alert("Error", err.code); }
  };

  const handlePositionChange = async (newPosition) => {
    const user = auth.currentUser;
    if (!user || !newPosition) return;
    setSavingPosition(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { position: newPosition });
    } catch (err) { Alert.alert("Error", "Failed to update position."); }
    setSavingPosition(false);
  };

  const autoAssign = async (playerId, playerName, playerPos, teamId, teamName) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "teams", teamId), {
        memberIds: arrayUnion(playerId), members: arrayUnion(playerName),
        neededPositions: arrayRemove(playerPos), needsPosition: null
      });
      batch.update(doc(db, "users", playerId), {
        hasTeam: true, teamId, assignedTeam: teamName, searchingForTeam: false, playSolo: false
      });
      await batch.commit();
      return true;
    } catch (err) { return false; }
  };

  const handleRequestPlayer = async (position) => {
    if (!teamData) return;
    const currentNeeded = teamData.neededPositions || [];
    if (position === null) {
      await updateDoc(doc(db, "teams", teamData.id), { neededPositions: [], needsPosition: null });
      return;
    }
    let updatedNeeded;
    if (currentNeeded.includes(position)) {
      updatedNeeded = currentNeeded.filter(p => p !== position);
    } else {
      updatedNeeded = [...currentNeeded, position];
      if ((teamData.memberIds?.length || 0) < 7) {
        const matchingSolo = allStudents.find(s =>
          (s.searchingForTeam || s.playSolo) && !s.hasTeam && s.position === position && s.id !== userData.uid
        );
        if (matchingSolo) {
          const success = await autoAssign(matchingSolo.id, matchingSolo.name, position, teamData.id, teamData.teamName);
          if (success) { Alert.alert("Auto-matched! ⚽", `${matchingSolo.name} (${position}) joined your team!`); return; }
        }
      }
    }
    await updateDoc(doc(db, "teams", teamData.id), {
      neededPositions: updatedNeeded,
      needsPosition: updatedNeeded.length > 0 ? updatedNeeded[0] : null,
      requestTimestamp: new Date()
    });
    if (!currentNeeded.includes(position)) {
      Alert.alert("Info", `Request for a ${position} sent. Admin will be notified 📢`);
    }
  };

  // ── FIX 4: handlePlaySolo مصلحة ──
  const handlePlaySolo = async (specificPos = null) => {
    if (!userData) return;

    if (userData.searchingForTeam) {
      await updateDoc(doc(db, "users", userData.uid), {
        searchingForTeam: false,
        playSolo: false,
        soloPosition: null,
      });
      Alert.alert("Cancelled", "Solo request cancelled.");
      return;
    }

    if (!specificPos) {
      setShowSoloModal(true);
      return;
    }

    // إغلاق الـ modal الأول قبل أي عملية async
    setShowSoloModal(false);

    const matchingTeam = approvedTeams.find(
      (t) =>
        (t.neededPositions || []).includes(specificPos) &&
        (t.memberIds?.length || 0) < 7
    );

    if (matchingTeam) {
      const success = await autoAssign(
        userData.uid,
        userData.name,
        specificPos,
        matchingTeam.id,
        matchingTeam.teamName
      );
      if (success) {
        Alert.alert("Matched! ⚽", `You joined ${matchingTeam.teamName}!`);
        return;
      }
    }

    await updateDoc(doc(db, "users", userData.uid), {
      searchingForTeam: true,
      playSolo: true,
      position: specificPos,
      soloPosition: specificPos,
    });
    Alert.alert("Solo Mode", `You are now a Solo ${specificPos}! Admin will match you. ⚽`);
  };

  const isCaptain =
    teamData?.captainId === userData?.uid ||
    (!!userData?.name &&
      teamData?.captainName?.trim().toLowerCase() === userData?.name?.trim().toLowerCase());

  const soloPlayers = allStudents.filter(s =>
    (s.searchingForTeam === true || s.playSolo === true) && s.hasTeam !== true && s.role !== 'admin'
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ImageBackground source={require("../../assets/images/background.jpg")} style={styles.bg}>
      {/* Sticky Navbar */}
      <View style={styles.stickyNavbar}>
        <TouchableOpacity onPress={() => setActiveView("dashboard")}>
          <Text style={styles.logo}>SCI-FOOTBALL</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity style={styles.aiBtn} onPress={() => setShowAI(true)}>
            <Text style={styles.aiBtnText}>🤖 AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>

        {activeView === "dashboard" ? (
          <>
            {/* ── Profile Card ── */}
            <View style={styles.card}>
              {userData?.photo ? (
                <Image source={{ uri: userData.photo }} style={styles.image} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{userData?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
              <Text style={styles.name}>{userData?.name || "Student Name"}</Text>
              <Text style={styles.studentId}>ID: {userData?.studentCode || "N/A"}</Text>
              <View style={[styles.badge, userData?.hasTeam ? styles.badgeGreen : styles.badgeOrange]}>
                {userData?.hasTeam ? (
                  <TouchableOpacity onPress={() => router.push({ pathname: '/TeamDetails', params: { teamId: userData?.teamId } })}>
                    <Text style={styles.badgeText}>Team: {userData?.assignedTeam} →</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.badgeText}>No Team Yet</Text>
                )}
              </View>
            </View>

            {/* ── Tournament Card ── */}
            {tournament?.registrationOpen && (
              <View style={styles.tournamentCard}>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusBadge, getRemainingTime() === "Expired" ? styles.statusExpired : styles.statusOpen]}>
                    <View style={[styles.statusDot, { backgroundColor: getRemainingTime() === "Expired" ? "#ef4444" : "#10b981" }]} />
                    <Text style={[styles.statusText, { color: getRemainingTime() === "Expired" ? "#f87171" : "#34d399" }]}>
                      {getRemainingTime() === "Expired" ? "REGISTRATION CLOSED" : "REGISTRATION OPEN"}
                    </Text>
                  </View>
                  {getRemainingTime() !== "Expired" && (
                    <Text style={styles.deadlineText}>Ends: {getDeadlineString()}</Text>
                  )}
                </View>

                <Text style={styles.tournamentTitle}>{tournament.registrationTitle}</Text>

                <View style={styles.dateRow}>
                  <View style={styles.dateCard}>
                    <Text style={styles.dateLabel}>STARTS</Text>
                    <Text style={styles.dateValue}>{tournament.startDate || "TBD"}</Text>
                  </View>
                  <View style={styles.dateCard}>
                    <Text style={styles.dateLabel}>ENDS</Text>
                    <Text style={styles.dateValue}>{tournament.endDate || "TBD"}</Text>
                  </View>
                </View>

                {getRemainingTime() !== "Expired" && (
                  <View style={styles.remainingBox}>
                    <Text style={styles.remainingLabel}>CLOSES IN:</Text>
                    <Text style={styles.remainingValue}>{getRemainingTime()}</Text>
                  </View>
                )}

                <View style={{ marginTop: 16 }}>
                  {getRemainingTime() === 'Expired' ? (
                    <View style={styles.lockedBox}>
                      <Text style={styles.lockedTitle}>TIME LIMIT REACHED</Text>
                      <Text style={styles.lockedSub}>Registration Locked</Text>
                    </View>
                  ) : !userData?.hasTeam ? (
                    <View style={styles.waitingBox}>
                      <Text style={styles.waitingTitle}>JOIN A TEAM FIRST</Text>
                      <Text style={styles.waitingSub}>You need a team to register</Text>
                    </View>
                  ) : isCaptain ? (
                    tournament?.registeredTeamIds?.includes(userData?.teamId) ? (
                      <View style={styles.registeredBox}>
                        <Text style={styles.registeredText}>✓ REGISTERED</Text>
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert('Withdraw', 'Withdraw from tournament?', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Withdraw',
                                style: 'destructive',
                                onPress: async () => {
                                  await updateDoc(doc(db, 'tournaments', 'main'), {
                                    registeredTeamIds: arrayRemove(userData.teamId),
                                  });
                                },
                              },
                            ]);
                          }}
                        >
                          <Text style={styles.withdrawText}>Withdraw Team</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.joinButton}
                        onPress={async () => {
                          if ((teamData?.memberIds?.length || 0) < 5) {
                            Alert.alert('Error', 'Your team needs at least 5 players to register ⚽');
                            return;
                          }
                          await updateDoc(doc(db, 'tournaments', 'main'), {
                            registeredTeamIds: arrayUnion(userData.teamId),
                          });
                          Alert.alert('Success', 'Team Registered! 🏆');
                        }}
                      >
                        <Text style={styles.joinButtonText}>JOIN TOURNAMENT</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    tournament?.registeredTeamIds?.includes(userData?.teamId) ? (
                      <View style={styles.registeredBox}>
                        <Text style={styles.registeredText}>✓ YOUR TEAM IS REGISTERED</Text>
                        <Text style={{ color: '#34d399', fontSize: 11, marginTop: 4 }}>
                          {teamData?.teamName}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.waitingBox}>
                        <Text style={styles.waitingTitle}>WAITING FOR CAPTAIN</Text>
                        <Text style={styles.waitingSub}>Only your team leader can register</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            )}

            {/* ── Tournament Button ── */}
            <View style={styles.card}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setActiveView("tournament")}>
                <Text style={styles.primaryBtnText}>🏆 View Tournament Bracket</Text>
              </TouchableOpacity>
            </View>

            {/* ── Team Options (No Team) ── */}
            {!userData?.hasTeam && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Team Options</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/CreateTeam")}>
                  <Text style={styles.primaryBtnText}>Create Team</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, userData?.searchingForTeam && styles.secondaryBtnActive]}
                  onPress={() => handlePlaySolo()}
                >
                  <Text style={[styles.secondaryBtnText, userData?.searchingForTeam && styles.secondaryBtnTextActive]}>
                    {userData?.searchingForTeam ? "Cancel Solo Request" : "Play Solo"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Stats & Next Match ── */}
            {userData?.hasTeam && (
              <View>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>⚡ Your Stats</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>RANK</Text>
                      <Text style={[styles.statValue, { color: "#60a5fa" }]}>#{userRank || "—"}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>GOALS</Text>
                      <Text style={[styles.statValue, { color: "#34d399" }]}>{userData?.goals || 0}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>YELLOW</Text>
                      <Text style={[styles.statValue, { color: "#fbbf24" }]}>{userData?.yellowCards || 0}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>RED</Text>
                      <Text style={[styles.statValue, { color: "#ef4444" }]}>{userData?.redCards || 0}</Text>
                    </View>
                    <View style={[styles.statBox, { width: "100%", flexDirection: "row", justifyContent: "space-between" }]}>
                      <Text style={styles.statLabel}>POSITION</Text>
                      <Text style={[styles.statValue, { color: "#a78bfa" }]}>{userData?.position || "—"}</Text>
                    </View>
                  </View>
                  {userData?.redCards > 0 && (
                    <Text style={styles.suspendedText}>⚠️ You are suspended due to a red card!</Text>
                  )}
                  {(userData?.yellowCards > 0 || userData?.redCards > 0) && (
                    <View style={styles.disciplineBox}>
                      <Text style={styles.disciplineTitle}>🟨 Discipline</Text>
                      <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
                        <View style={{ alignItems: "center" }}>
                          <View style={styles.yellowCardIcon} />
                          <Text style={styles.disciplineCount}>{userData?.yellowCards || 0} Yellow</Text>
                        </View>
                        <View style={{ alignItems: "center" }}>
                          <View style={styles.redCardIcon} />
                          <Text style={styles.disciplineCount}>{userData?.redCards || 0} Red</Text>
                        </View>
                        {userData?.redCards > 0 && (
                          <Text style={styles.suspendedBadge}>⚠ Suspended</Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>🏟️ Next Match</Text>
                  {nextMatch ? (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Opponent</Text>
                        <Text style={styles.infoValue}>{nextMatch.opponentName || "TBD"}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date</Text>
                        <Text style={styles.infoValue}>{nextMatch.date || "TBD"}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Time</Text>
                        <Text style={styles.infoValue}>{nextMatch.time || "TBD"}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>No matches scheduled</Text>
                  )}
                </View>
              </View>
            )}

            {/* ── Live Matches ── */}
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { color: "#f87171" }]}>🔴 Live Matches</Text>
              {liveMatches.length === 0 ? (
                <Text style={styles.emptyText}>No live matches</Text>
              ) : liveMatches.map(match => {
                const isMyTeam = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                return (
                  <View key={match.id} style={[styles.matchRow, isMyTeam && styles.myMatchRow]}>
                    <Text style={styles.liveTag}>🔴 LIVE NOW {isMyTeam ? "• YOUR TEAM" : ""}</Text>
                    <View style={styles.matchTeamsContainer}>
                      <Text style={styles.matchTeam}>{match.team1Name || "Team 1"}</Text>
                      <Text style={styles.matchVs}>VS</Text>
                      <Text style={styles.matchTeam}>{match.team2Name || "Team 2"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Match History ── */}
            <View style={styles.card}>
              <View style={styles.historyHeader}>
                <Text style={[styles.sectionTitle, { color: "#fbbf24" }]}>📜 Match History</Text>
                <View style={styles.historyTabs}>
                  <TouchableOpacity
                    style={[styles.historyTab, historyTab === "myTeam" && styles.historyTabActive]}
                    onPress={() => setHistoryTab("myTeam")}
                  >
                    <Text style={[styles.historyTabText, historyTab === "myTeam" && styles.historyTabTextActive]}>My Team</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.historyTab, historyTab === "others" && styles.historyTabActive]}
                    onPress={() => setHistoryTab("others")}
                  >
                    <Text style={[styles.historyTabText, historyTab === "others" && styles.historyTabTextActive]}>Other Teams</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {(() => {
                const filtered = finishedMatches.filter(match => {
                  const isMyMatch = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                  return historyTab === "myTeam" ? isMyMatch : !isMyMatch;
                });
                if (!filtered.length) return <Text style={styles.emptyText}>No matches found</Text>;
                return filtered.map(match => {
                  const t1 = approvedTeams.find(t => t.id === match.team1Id);
                  const t2 = approvedTeams.find(t => t.id === match.team2Id);
                  const isMyMatch = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                  return (
                    <TouchableOpacity key={match.id} style={[styles.historyMatchRow, isMyMatch && styles.myHistoryRow]} onPress={() => setSelectedMatch(match)}>
                      <View style={styles.historyMatchHeader}>
                        <Text style={styles.historyMatchDate}>{match.date}</Text>
                        <Text style={styles.historyMatchStatus}>Finished ✅</Text>
                      </View>
                      <View style={styles.historyMatchTeams}>
                        <Text style={[styles.historyMatchTeam, match.team1Id === userData?.teamId && styles.highlightTeam]}>{t1?.teamName || "Team 1"}</Text>
                        <Text style={styles.historyMatchScore}>{match.score || "0-0"}</Text>
                        <Text style={[styles.historyMatchTeam, match.team2Id === userData?.teamId && styles.highlightTeam]}>{t2?.teamName || "Team 2"}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>

            {/* ── AI Coach Card ── */}
            <TouchableOpacity style={styles.aiCoachCard} onPress={() => setShowAI(true)}>
              <View>
                <Text style={styles.aiCoachTitle}>🤖 AI Coach</Text>
                <Text style={styles.aiCoachSubtitle}>اسأل مساعدك الرياضي</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  {["نصايح تكتيكية", "تدريب", "تحفيز"].map(tag => (
                    <View key={tag} style={styles.aiTag}><Text style={styles.aiTagText}>{tag}</Text></View>
                  ))}
                </View>
              </View>
              <Text style={styles.aiCoachArrow}>→</Text>
            </TouchableOpacity>

            {/* ── Team Members ── */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>👥 Team's Members</Text>
              {userData?.hasTeam && teamData ? (
                <>
                  {teamData?.members?.map((playerName, i) => {
                    const memberId = teamData.memberIds[i];
                    const memberInfo = allStudents.find(s => s.id === memberId);
                    return (
                      <View key={i} style={styles.memberCard}>
                        <View style={styles.memberTopRow}>
                          <View style={styles.memberNameRow}>
                            <View style={styles.greenDot} />
                            <Text style={styles.memberName}>{playerName}</Text>
                            {memberId === teamData.captainId && (
                              <View style={styles.leaderBadge}><Text style={styles.leaderText}>Leader</Text></View>
                            )}
                          </View>
                          {userData.uid === teamData.captainId && memberId !== userData.uid && (
                            <TouchableOpacity onPress={() => removePlayer(i)}>
                              <Text style={styles.removeBtn}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.memberEmail}>{memberInfo?.email || "—"}</Text>
                        {memberInfo?.phone && <Text style={styles.memberPhone}>{memberInfo.phone}</Text>}
                      </View>
                    );
                  })}
                  {isCaptain && (
                    <View style={styles.inviteSection}>
                      <Text style={styles.inviteSectionTitle}>Add Member (Send Invite)</Text>
                      <View style={styles.inviteInputRow}>
                        <TextInput
                          style={styles.inviteInput}
                          placeholder="Enter student code"
                          placeholderTextColor="#475569"
                          value={newMemberCode}
                          onChangeText={setNewMemberCode}
                        />
                        <TouchableOpacity style={styles.inviteSendBtn} onPress={sendInvite}>
                          <Text style={styles.inviteSendBtnText}>Invite</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  <TouchableOpacity style={styles.leaveBtn} onPress={leaveTeam}>
                    <Text style={styles.leaveBtnText}>Leave Team</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {userData?.teamRequests?.length > 0 ? (
                    userData.teamRequests.map((req, i) => (
                      <View key={i} style={styles.inviteRow}>
                        <Text style={styles.inviteTeamName}>{req.teamName}</Text>
                        <Text style={styles.inviteCaptain}>From: {req.captainName}</Text>
                        <View style={styles.inviteBtns}>
                          <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptInvite(req)}>
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectInvite(req)}>
                            <Text style={styles.rejectBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No team requests</Text>
                  )}
                </>
              )}
            </View>

            {/* ── Captain Options ── */}
            {isCaptain && teamData && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>👑 Captain Options</Text>
                <Text style={styles.recruitText}>Recruit Players - Need specific positions?</Text>
                <View style={styles.positionButtons}>
                  {['Midfielder', 'Goalkeeper', 'Defender', 'Forward'].map(pos => {
                    const isFull = (teamData?.memberIds?.length || 0) >= 7;
                    const isRequested = (teamData?.neededPositions || []).includes(pos);
                    return (
                      <TouchableOpacity
                        key={pos}
                        style={[styles.positionBtn, isRequested && styles.positionBtnActive, isFull && !isRequested && styles.positionBtnDisabled]}
                        onPress={() => handleRequestPlayer(pos)}
                        disabled={isFull && !isRequested}
                      >
                        <Text style={[styles.positionBtnText, isRequested && styles.positionBtnTextActive]}>
                          {isFull && !isRequested ? "Full (7/7)" : `Need ${pos}`}
                          {isRequested ? " ✓" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {(teamData?.neededPositions?.length > 0) && (
                  <TouchableOpacity onPress={() => handleRequestPlayer(null)}>
                    <Text style={styles.clearRequestsText}>Clear All Requests</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.soloPlayersTitle}>Available Solo Players</Text>
                {soloPlayers.length > 0 ? soloPlayers.map(player => (
                  <View key={player.id} style={styles.soloPlayerRow}>
                    <View>
                      <Text style={styles.soloPlayerName}>{player.name}</Text>
                      <Text style={styles.soloPlayerPosition}>{player.position}</Text>
                    </View>
                    <View style={styles.soloPlayerDot} />
                  </View>
                )) : (
                  <Text style={styles.emptyText}>No solo players available right now.</Text>
                )}
                <Text style={styles.soloNote}>* Tell Admin which player you want, or send a position request above.</Text>
              </View>
            )}

            {/* ── Settings ── */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>⚙️ Settings</Text>
              <Text style={styles.settingLabel}>Your Position</Text>
              <View style={styles.positionGrid}>
                {['Forward', 'Defender', 'Goalkeeper', 'Midfielder'].map(pos => (
                  <TouchableOpacity
                    key={pos}
                    style={[styles.positionGridBtn, userData?.position === pos && styles.positionGridBtnActive]}
                    onPress={() => handlePositionChange(pos)}
                    disabled={savingPosition}
                  >
                    <Text style={[styles.positionGridBtnText, userData?.position === pos && styles.positionGridBtnTextActive]}>
                      {pos === 'Forward' ? '⚡' : pos === 'Defender' ? '🛡️' : pos === 'Goalkeeper' ? '🧤' : '⚽'} {pos}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.settingBtn} onPress={() => router.push("/EditProfile")}>
                <Text style={styles.settingBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingBtn} onPress={() => router.push("/ChangePassword")}>
                <Text style={styles.settingBtnText}>Change Password</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userData?.email}</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Your Role</Text>
                <Text style={[styles.infoValue, { color: "#34d399" }]}>
                  {isCaptain ? "Team Leader" : "Player"}
                </Text>
              </View>
            </View>
          </>
        ) : (
          // ── TOURNAMENT VIEW ──
          <View style={styles.tournamentContainer}>
            <View style={styles.tournamentHeaderCard}>
              <View style={styles.tournamentHeaderRow}>
                <View style={styles.tournamentIconCircle}>
                  <Text style={styles.tournamentIconText}>🏆</Text>
                </View>
                <View style={styles.tournamentInfoContainer}>
                  <Text style={styles.tournamentName}>{tournament?.name || tournament?.registrationTitle || "No Active Tournament"}</Text>
                  {tournament?.startDate && tournament?.endDate && (
                    <Text style={styles.tournamentPeriod}>{tournament.startDate} → {tournament.endDate}</Text>
                  )}
                </View>
              </View>
            </View>

            {tournamentWinner && (
              <View style={styles.championBannerContainer}>
                <Text style={styles.championTrophy}>🏆</Text>
                <View style={styles.championInfo}>
                  <Text style={styles.championLabel}>TOURNAMENT CHAMPION</Text>
                  <Text style={styles.championTeamName}>{tournamentWinner.name}</Text>
                </View>
                <Text style={styles.championTrophy}>🏆</Text>
              </View>
            )}

            {tournament?.rounds ? (
              <View style={styles.bracketMainContainer}>
                <View style={styles.bracketHeaderRow}>
                  <Text style={styles.bracketMainTitle}>🗂 OFFICIAL BRACKET</Text>
                  <View style={styles.teamCountBadge}>
                    <Text style={styles.teamCountText}>{tournament?.numTeams || 0} TEAMS</Text>
                  </View>
                </View>
                <Text style={styles.bracketSubHeader}>LIVE TOURNAMENT • KNOCKOUT STAGE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.bracketColumnsContainer}>
                    {Object.keys(tournament.rounds)
                      .sort((a, b) => parseInt(a) - parseInt(b))
                      .map((rKey, rIdx) => {
                        const totalRounds = Object.keys(tournament.rounds).length;
                        return (
                          <View key={rKey} style={styles.bracketColumn}>
                            <View style={styles.bracketRoundHeader}>
                              <Text style={styles.bracketRoundTitle}>{getRoundLabel(rIdx, totalRounds)}</Text>
                              {tournament.roundDateMap?.[rKey] && (
                                <Text style={styles.bracketRoundDate}>
                                  📅 {tournament.roundDateMap[rKey]?.date?.slice(5)?.replace("-", " ")?.toUpperCase()}
                                </Text>
                              )}
                            </View>
                            {tournament.rounds[rKey].map((match, matchIdx) => (
                              <View key={match.id || matchIdx} style={styles.bracketMatchCard}>
                                <Text style={styles.bracketMatchNumber}>MATCH {matchIdx + 1}</Text>
                                <View style={[styles.bracketTeamLine, match.winner?.id === match.team1?.id && styles.bracketTeamLineWinner]}>
                                  <Text style={[styles.bracketTeamName, match.winner?.id === match.team1?.id && styles.bracketTeamNameWinner]}>
                                    {match.team1?.name || "TBD"}
                                  </Text>
                                  {match.winner?.id === match.team1?.id && <Text style={styles.winnerCheckmark}>✓</Text>}
                                </View>
                                {match.isBye ? (
                                  <View style={styles.byeContainer}><Text style={styles.byeText}>BYE</Text></View>
                                ) : (
                                  <View style={[styles.bracketTeamLine, match.winner?.id === match.team2?.id && styles.bracketTeamLineWinner]}>
                                    <Text style={[styles.bracketTeamName, match.winner?.id === match.team2?.id && styles.bracketTeamNameWinner]}>
                                      {match.team2?.name || "TBD"}
                                    </Text>
                                    {match.winner?.id === match.team2?.id && <Text style={styles.winnerCheckmark}>✓</Text>}
                                  </View>
                                )}
                                {match.projectedTime && (
                                  <View style={styles.bracketMatchTime}>
                                    <Text style={styles.bracketTimeText}>🕐 {match.projectedTime}</Text>
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
            ) : (
              <View style={styles.noTournamentCard}>
                <Text style={{ fontSize: 40 }}>🏆</Text>
                <Text style={styles.noTournamentTitle}>No Active Tournament</Text>
                <Text style={styles.noTournamentSub}>Check back later for upcoming tournaments and brackets</Text>
              </View>
            )}

            {archived.length > 0 && (
              <View style={styles.archiveSection}>
                <TouchableOpacity style={styles.archiveToggleBtn} onPress={() => setShowArchive(!showArchive)}>
                  <Text style={styles.archiveToggleText}>📦 PAST TOURNAMENTS — {archived.length} ARCHIVED</Text>
                  <Text style={{ color: "#64748b" }}>{showArchive ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {showArchive && archived.map(t => (
                  <View key={t.id} style={styles.archiveCard}>
                    <Text style={styles.archiveCardTitle}>{(t.name || "Unnamed Tournament").toUpperCase()}</Text>
                    {t.finalWinner && <Text style={styles.archiveWinner}>🏆 {t.finalWinner.name}</Text>}
                    <Text style={styles.archiveDate}>
                      {t.archivedAt?.toDate?.()?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) || ""} • {t.numTeams} TEAMS
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.backToDashboardBtn} onPress={() => setActiveView("dashboard")}>
              <Text style={styles.backToDashboardText}>← Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Match Details Modal */}
      <Modal visible={selectedMatch !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedMatch && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Match Report</Text>
                  <TouchableOpacity onPress={() => setSelectedMatch(null)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  <View style={styles.modalScoreContainer}>
                    <View style={styles.modalTeam}>
                      <Text style={styles.modalTeamName}>{approvedTeams.find(t => t.id === selectedMatch.team1Id)?.teamName || "Team 1"}</Text>
                      <Text style={styles.modalScore}>{selectedMatch.score?.split('-')[0] || 0}</Text>
                    </View>
                    <Text style={styles.modalVs}>VS</Text>
                    <View style={styles.modalTeam}>
                      <Text style={styles.modalTeamName}>{approvedTeams.find(t => t.id === selectedMatch.team2Id)?.teamName || "Team 2"}</Text>
                      <Text style={styles.modalScore}>{selectedMatch.score?.split('-')[1] || 0}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalDate}>{selectedMatch.date} • {selectedMatch.pitch || "Main Pitch"}</Text>
                  {selectedMatch.penalties && (
                    <Text style={{ color: "#fbbf24", textAlign: "center", marginTop: 8, fontWeight: "bold" }}>
                      Penalties: {selectedMatch.penalties}
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Solo Modal */}
      <Modal visible={showSoloModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.soloModalContent}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🏃</Text>
            <Text style={styles.soloModalTitle}>Choose Your Position</Text>
            <Text style={styles.soloModalSubtitle}>Admin will see this when matching you</Text>
            <View style={styles.soloModalButtons}>
              {['Forward', 'Defender', 'Goalkeeper', 'Midfielder'].map(pos => (
                <TouchableOpacity
                  key={pos}
                  style={styles.soloModalBtn}
                  onPress={() => handlePlaySolo(pos)}
                >
                  <Text style={styles.soloModalBtnText}>
                    {pos === 'Forward' ? '⚡' : pos === 'Defender' ? '🛡️' : pos === 'Goalkeeper' ? '🧤' : '⚽'} {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowSoloModal(false)}>
              <Text style={styles.soloModalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AIChatModal
        visible={showAI}
        onClose={() => setShowAI(false)}
        userData={userData}
        teamData={teamData}
        nextMatch={nextMatch}
        userRank={userRank}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#020617" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  container: { padding: 16, paddingBottom: 40, paddingTop: 80 },

  stickyNavbar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 18, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  logo: { fontSize: 18, fontWeight: "bold", color: "#22c55e" },
  aiBtn: { backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  aiBtnText: { color: "#34d399", fontWeight: "700", fontSize: 13 },
  signOutBtn: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  signOutText: { color: "#f87171", fontWeight: "600" },

  card: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#16a34a", alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)" },
  image: { width: 100, height: 100, borderRadius: 50, alignSelf: "center", marginBottom: 16 },
  avatarText: { fontSize: 36, fontWeight: "bold", color: "white" },
  name: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center" },
  studentId: { color: "#9ca3af", textAlign: "center", marginTop: 4 },
  badge: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  badgeGreen: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  badgeOrange: { backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)" },
  badgeText: { color: "#fff", fontWeight: "600" },

  tournamentCard: { backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "rgba(16,185,129,0.2)", marginBottom: 16 },
  statusContainer: { alignItems: "flex-end", marginBottom: 14 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusOpen: { backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)" },
  statusExpired: { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: "800" },
  deadlineText: { color: "#6ee7b7", fontSize: 10, marginTop: 5, fontWeight: "600" },
  tournamentTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  dateCard: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  dateLabel: { color: "#9ca3af", fontSize: 9, fontWeight: "800" },
  dateValue: { color: "white", fontSize: 12, fontWeight: "bold", marginTop: 3 },
  remainingBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  remainingLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "bold", marginRight: 8 },
  remainingValue: { color: "#34d399", fontSize: 12, fontWeight: "900" },
  joinButton: { backgroundColor: "#10b981", paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  joinButtonText: { color: "black", fontWeight: "900", fontSize: 15 },
  registeredBox: { alignItems: "center", gap: 10 },
  registeredText: { color: "#34d399", fontWeight: "900", fontSize: 14 },
  withdrawText: { color: "#ef4444", fontWeight: "bold", fontSize: 12 },
  waitingBox: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 16, alignItems: "center" },
  waitingTitle: { color: "#94a3b8", fontSize: 10, fontWeight: "800" },
  waitingSub: { color: "white", fontSize: 12, fontWeight: "bold", marginTop: 4 },
  lockedBox: { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 18, padding: 16, alignItems: "center" },
  lockedTitle: { color: "#ef4444", fontWeight: "800", fontSize: 10 },
  lockedSub: { color: "white", fontWeight: "bold", marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 12 },
  emptyText: { color: "#475569", fontStyle: "italic", textAlign: "center", padding: 16 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: { flex: 1, minWidth: "45%", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 18, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  statLabel: { color: "#9ca3af", fontSize: 9, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "bold" },
  suspendedText: { color: "#ef4444", fontSize: 11, fontWeight: "bold", textAlign: "center", marginTop: 10 },

  disciplineBox: { marginTop: 14, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  disciplineTitle: { color: "#fff", fontWeight: "700", fontSize: 13, marginBottom: 10 },
  yellowCardIcon: { width: 20, height: 26, backgroundColor: "#facc15", borderRadius: 3, marginBottom: 6 },
  redCardIcon: { width: 20, height: 26, backgroundColor: "#ef4444", borderRadius: 3, marginBottom: 6 },
  disciplineCount: { color: "#94a3b8", fontSize: 10, fontWeight: "600" },
  suspendedBadge: { color: "#ef4444", fontSize: 11, fontWeight: "800" },

  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  infoLabel: { color: "#9ca3af" },
  infoValue: { color: "#fff", fontWeight: "500" },

  matchRow: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  myMatchRow: { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.25)" },
  liveTag: { color: "#22c55e", fontSize: 10, fontWeight: "bold", marginBottom: 6 },
  matchTeamsContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  matchTeam: { color: "#fff", fontWeight: "bold", fontSize: 13, flex: 1, textAlign: "center" },
  matchVs: { color: "#9ca3af", fontSize: 11, marginHorizontal: 8 },

  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  historyTabs: { flexDirection: "row", gap: 8 },
  historyTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
  historyTabActive: { backgroundColor: "rgba(251,191,36,0.2)" },
  historyTabText: { color: "#9ca3af", fontSize: 10, fontWeight: "bold" },
  historyTabTextActive: { color: "#fbbf24" },
  historyMatchRow: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  myHistoryRow: { backgroundColor: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.2)" },
  historyMatchHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  historyMatchDate: { color: "#9ca3af", fontSize: 9 },
  historyMatchStatus: { color: "#34d399", fontSize: 9, fontWeight: "bold" },
  historyMatchTeams: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyMatchTeam: { color: "#fff", fontSize: 12, fontWeight: "bold", flex: 1, textAlign: "center" },
  highlightTeam: { color: "#fbbf24" },
  historyMatchScore: { color: "#60a5fa", fontSize: 16, fontWeight: "bold", marginHorizontal: 8 },

  aiCoachCard: { backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 20, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", marginBottom: 16 },
  aiCoachTitle: { fontSize: 15, fontWeight: "bold", color: "#22c55e", marginBottom: 4 },
  aiCoachSubtitle: { fontSize: 11, color: "#22c55e", opacity: 0.7 },
  aiTag: { backgroundColor: "rgba(34,197,94,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.2)" },
  aiTagText: { color: "#34d399", fontSize: 9, fontWeight: "700" },
  aiCoachArrow: { fontSize: 22, color: "#22c55e" },

  memberCard: { backgroundColor: "rgba(0,0,0,0.4)", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", marginBottom: 10 },
  memberTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  memberName: { color: "white", fontWeight: "bold" },
  leaderBadge: { backgroundColor: "rgba(234,179,8,0.2)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  leaderText: { color: "#EAB308", fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },
  removeBtn: { color: "#F87171", fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },
  memberEmail: { fontSize: 11, color: "#9CA3AF", marginTop: 6, marginLeft: 16 },
  memberPhone: { fontSize: 11, color: "#60a5fa", marginTop: 4, marginLeft: 16 },
  inviteSection: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  inviteSectionTitle: { color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 10 },
  inviteInputRow: { flexDirection: "row", gap: 8 },
  inviteInput: { flex: 1, backgroundColor: "#0f172a", borderRadius: 10, padding: 10, color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  inviteSendBtn: { backgroundColor: "#22c55e", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  inviteSendBtnText: { color: "#000", fontWeight: "bold" },
  leaveBtn: { backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  leaveBtnText: { color: "#f87171", fontWeight: "bold" },
  inviteRow: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  inviteTeamName: { color: "#fff", fontWeight: "bold", fontSize: 15, marginBottom: 4 },
  inviteCaptain: { color: "#9ca3af", fontSize: 11, marginBottom: 10 },
  inviteBtns: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 10, padding: 10, alignItems: "center" },
  acceptBtnText: { color: "#000", fontWeight: "bold", fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 10, padding: 10, alignItems: "center" },
  rejectBtnText: { color: "#f87171", fontWeight: "bold", fontSize: 13 },

  primaryBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  secondaryBtn: { backgroundColor: "rgba(59,130,246,0.15)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" },
  secondaryBtnActive: { backgroundColor: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.3)" },
  secondaryBtnText: { color: "#60a5fa", fontWeight: "600" },
  secondaryBtnTextActive: { color: "#f97316" },

  recruitText: { color: "#9ca3af", fontSize: 11, marginBottom: 12 },
  positionButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  positionBtn: { flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  positionBtnActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  positionBtnDisabled: { opacity: 0.4 },
  positionBtnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  positionBtnTextActive: { color: "#000" },
  clearRequestsText: { color: "#f87171", fontSize: 11, textAlign: "center", marginTop: 8 },
  soloPlayersTitle: { fontSize: 13, fontWeight: "bold", color: "#fff", marginTop: 16, marginBottom: 8 },
  soloPlayerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 10, marginBottom: 6 },
  soloPlayerName: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  soloPlayerPosition: { color: "#22c55e", fontSize: 10, fontWeight: "bold", marginTop: 2 },
  soloPlayerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  soloNote: { color: "#475569", fontSize: 10, marginTop: 8, textAlign: "center" },

  settingLabel: { color: "#9ca3af", fontSize: 11, marginBottom: 10 },
  positionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  positionGridBtn: { flex: 1, minWidth: "45%", backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  positionGridBtnActive: { backgroundColor: "rgba(34,197,94,0.2)", borderColor: "#22c55e" },
  positionGridBtnText: { color: "#9ca3af", fontSize: 11, fontWeight: "bold" },
  positionGridBtnTextActive: { color: "#22c55e" },
  settingBtn: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, marginBottom: 8 },
  settingBtnText: { color: "#fff" },

  infoGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  infoCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },

  tournamentContainer: { paddingBottom: 40 },
  tournamentHeaderCard: { backgroundColor: "rgba(0,255,156,0.08)", borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  tournamentHeaderRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  tournamentIconCircle: { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(0,255,156,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,255,156,0.3)" },
  tournamentIconText: { fontSize: 28 },
  tournamentInfoContainer: { flex: 1 },
  tournamentName: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  tournamentPeriod: { color: "#9ca3af", fontSize: 12, marginTop: 4 },

  championBannerContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "rgba(234,179,8,0.1)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(234,179,8,0.22)", marginBottom: 16 },
  championTrophy: { fontSize: 32 },
  championInfo: { alignItems: "center" },
  championLabel: { color: "#eab308", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  championTeamName: { color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase" },

  bracketMainContainer: { backgroundColor: "#0f172a", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 20 },
  bracketHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  bracketMainTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  teamCountBadge: { backgroundColor: "rgba(0,255,156,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,255,156,0.2)" },
  teamCountText: { color: "#00FF9C", fontSize: 10, fontWeight: "800" },
  bracketSubHeader: { color: "#64748b", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 18 },
  bracketColumnsContainer: { flexDirection: "row", gap: 24, padding: 4 },
  bracketColumn: { width: 200 },
  bracketRoundHeader: { alignItems: "center", marginBottom: 14 },
  bracketRoundTitle: { color: "#00FF9C", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 },
  bracketRoundDate: { color: "#64748b", fontSize: 8, marginTop: 4 },
  bracketMatchCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  bracketMatchNumber: { color: "#475569", fontSize: 8, fontWeight: "800", textTransform: "uppercase", textAlign: "center", marginBottom: 10 },
  bracketTeamLine: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  bracketTeamLineWinner: { backgroundColor: "rgba(0,255,156,0.1)", borderColor: "rgba(0,255,156,0.25)" },
  bracketTeamName: { color: "#e2e8f0", fontWeight: "700", fontSize: 12 },
  bracketTeamNameWinner: { color: "#00FF9C" },
  winnerCheckmark: { color: "#00FF9C", fontSize: 12, fontWeight: "bold" },
  byeContainer: { paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#334155", borderStyle: "dashed", alignItems: "center", marginBottom: 6 },
  byeText: { color: "#475569", fontWeight: "700", fontSize: 10 },
  bracketMatchTime: { marginTop: 8, alignItems: "center" },
  bracketTimeText: { color: "#475569", fontSize: 9 },

  noTournamentCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 40, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  noTournamentTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginTop: 12, marginBottom: 8 },
  noTournamentSub: { color: "#9ca3af", fontSize: 12, textAlign: "center" },

  archiveSection: { marginTop: 8, marginBottom: 20 },
  archiveToggleBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 8 },
  archiveToggleText: { color: "#64748b", fontWeight: "800", fontSize: 11 },
  archiveCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  archiveCardTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  archiveWinner: { color: "#fbbf24", fontSize: 12, fontWeight: "700", marginTop: 4 },
  archiveDate: { color: "#64748b", fontSize: 10, marginTop: 4 },

  backToDashboardBtn: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 8 },
  backToDashboardText: { color: "#fff", fontWeight: "bold", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#0f172a", borderRadius: 24, width: "90%", maxWidth: 400, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  modalTitle: { color: "#fbbf24", fontSize: 18, fontWeight: "bold" },
  modalClose: { color: "#9ca3af", fontSize: 20, fontWeight: "bold" },
  modalBody: { padding: 20 },
  modalScoreContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTeam: { flex: 1, alignItems: "center" },
  modalTeamName: { color: "#fff", fontSize: 14, fontWeight: "bold", textAlign: "center" },
  modalScore: { color: "#60a5fa", fontSize: 28, fontWeight: "bold", marginTop: 8 },
  modalVs: { color: "#9ca3af", fontSize: 16, fontWeight: "bold", marginHorizontal: 12 },
  modalDate: { color: "#9ca3af", fontSize: 12, textAlign: "center" },

  soloModalContent: { backgroundColor: "#0f172a", borderRadius: 24, width: "85%", maxWidth: 350, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  soloModalTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  soloModalSubtitle: { color: "#9ca3af", fontSize: 11, marginBottom: 20, textAlign: "center" },
  soloModalButtons: { width: "100%", gap: 10, marginBottom: 16 },
  soloModalBtn: { backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 14, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  soloModalBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  soloModalCancel: { color: "#f87171", fontSize: 13, marginTop: 8 },
});