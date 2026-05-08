import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, ImageBackground, TextInput, Alert,
  Modal, RefreshControl, Dimensions
} from "react-native";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDocs,
  collection, query, where, deleteDoc, getDoc, writeBatch
} from "firebase/firestore";
import { useRouter } from "expo-router";
import AIChatModal from "../Aichatmodal";

const { width } = Dimensions.get("window");

// Helper function for round labels
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

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auth and user data listener
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
      if (snap.exists()) {
        const data = snap.data();
        setTournament(data);
      } else {
        setTournament(null);
      }
    });

    return () => { unsubAuth(); unsubUser(); unsubTeam(); unsubTournament(); };
  }, []);

  // Teams and matches listeners
  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setApprovedTeams(all.filter(t => t.status === "approved"));
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMatches(data);
    });

    const unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllStudents(all);
    });

    return () => { unsubTeams(); unsubMatches(); unsubAllUsers(); };
  }, []);

  // Fetch archived tournaments
  useEffect(() => {
    const fetchArchive = async () => {
      const snap = await getDocs(collection(db, "tournaments_archive"));
      setArchived(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.archivedAt?.toDate?.() ?? new Date(0)) - (a.archivedAt?.toDate?.() ?? new Date(0))));
    };
    fetchArchive();
  }, []);

  // Filter live and finished matches
  useEffect(() => {
    const DURATION = 20 * 60 * 1000;

    const live = matches.filter((m) => {
      if (!m.date || !m.time) return false;
      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const start = new Date(y, mm - 1, d, h, min).getTime();
      const isInTimeWindow = now >= start && now <= start + DURATION;
      const notFinished = (m.status || "").toLowerCase() !== "completed";
      return isInTimeWindow && notFinished;
    });

    setLiveMatches(live);
    setFinishedMatches(
      matches.filter(m => (m.status || "").trim().toLowerCase() === "completed")
    );
  }, [matches, now]);

  // Next match logic
  useEffect(() => {
    if (!userData?.teamId) {
      setNextMatch(null);
      return;
    }

    const scheduledMatches = matches.filter(m => {
      if (!m.date || !m.time) return false;
      const [y, mm, d] = m.date.split('-').map(Number);
      const [h, min] = m.time.split(':').map(Number);
      const matchTime = new Date(y, mm - 1, d, h, min).getTime();
      return (m.team1Id === userData.teamId || m.team2Id === userData.teamId) &&
        (m.status || "").toLowerCase() !== "completed" &&
        matchTime > now;
    });

    if (scheduledMatches.length === 0) {
      setNextMatch(null);
      return;
    }

    const sorted = scheduledMatches.sort((a, b) => {
      if (!a.date || a.date === "TBD") return 1;
      if (!b.date || b.date === "TBD") return -1;
      const dateA = new Date(`${a.date} ${a.time === "TBD" ? "00:00" : a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time === "TBD" ? "00:00" : b.time}`).getTime();
      return dateA - dateB;
    });

    const next = sorted[0];
    const opponentId = next.team1Id === userData.teamId ? next.team2Id : next.team1Id;
    const opponentTeam = approvedTeams.find(t => t.id === opponentId);
    const opponentName = opponentTeam?.teamName || next.team1Name || next.team2Name || "TBD";

    setNextMatch({ ...next, opponentName });
  }, [matches, approvedTeams, userData?.teamId, now]);

  // Fetch user rank
  useEffect(() => {
    const fetchRank = async () => {
      if (!userData?.uid) return;
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const querySnapshot = await getDocs(q);
        const students = querySnapshot.docs.map(doc => ({
          id: doc.id,
          goals: doc.data().goals || 0,
          score: doc.data().score || 0
        }));
        students.sort((a, b) => b.goals - a.goals || b.score - a.score);
        const rank = students.findIndex(s => s.id === userData.uid) + 1;
        setUserRank(rank);
      } catch (error) {
        console.error("Error fetching rank:", error);
      }
    };
    fetchRank();
  }, [userData?.uid]);

  // Get tournament winner
  const tournamentWinner = React.useMemo(() => {
    if (!tournament?.rounds) return null;
    const keys = Object.keys(tournament.rounds);
    return tournament.rounds[`${keys.length - 1}`]?.[0]?.winner ?? null;
  }, [tournament]);

  const acceptInvite = async (req) => {
    if (userData.hasTeam) {
      Alert.alert("Error", "You already have a team!");
      return;
    }
    try {
      const user = auth.currentUser;
      const teamRef = doc(db, "teams", req.teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        Alert.alert("Error", "Team not found!");
        return;
      }
      await updateDoc(teamRef, {
        memberIds: arrayUnion(user.uid),
        members: arrayUnion(userData.name),
      });
      await updateDoc(doc(db, "users", user.uid), {
        hasTeam: true,
        teamId: req.teamId,
        assignedTeam: req.teamName,
        teamRequests: [],
      });
      Alert.alert("Success", "Joined team successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err.message);
    }
  };

  const rejectInvite = async (req) => {
    const updated = userData.teamRequests.filter(r => r.teamId !== req.teamId);
    await updateDoc(doc(db, "users", userData.uid), { teamRequests: updated });
  };

  const leaveTeam = async () => {
    const user = auth.currentUser;
    const index = teamData.memberIds.findIndex(id => id === user.uid);
    if (index === -1) return;
    const newMemberIds = [...teamData.memberIds];
    const newMembers = [...teamData.members];
    newMemberIds.splice(index, 1);
    newMembers.splice(index, 1);
    await updateDoc(doc(db, "teams", userData.teamId), {
      memberIds: newMemberIds,
      members: newMembers,
    });
    await updateDoc(doc(db, "users", user.uid), {
      hasTeam: false,
      teamId: null,
      assignedTeam: null,
    });
  };

  const deleteTeam = async () => {
    Alert.alert("Delete Team", "Are you sure? All members will become Free Agents.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const memberIds = teamData?.memberIds || [];
          for (let id of memberIds) {
            await updateDoc(doc(db, "users", id), { hasTeam: false, teamId: null, assignedTeam: null, teamRequests: [] });
          }
          await deleteDoc(doc(db, "teams", teamData.id));
          Alert.alert("Success", "Team deleted successfully!");
        } catch (err) {
          Alert.alert("Error", err.message);
        }
      }}
    ]);
  };

  const removePlayer = async (index) => {
    Alert.alert("Remove Player", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        const newIds = [...teamData.memberIds];
        const newNames = [...teamData.members];
        const removedId = newIds[index];
        newIds.splice(index, 1);
        newNames.splice(index, 1);
        await updateDoc(doc(db, "teams", teamData.id), { memberIds: newIds, members: newNames });
        await updateDoc(doc(db, "users", removedId), { hasTeam: false, teamId: null, assignedTeam: null });
      }}
    ]);
  };

  const sendInvite = async () => {
    if (!newMemberCode.trim()) {
      Alert.alert("Error", "Enter student code");
      return;
    }
    try {
      const teamRef = doc(db, "teams", userData.teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        Alert.alert("Error", "Team not found");
        return;
      }
      const team = teamSnap.data();
      if ((team.members || []).length >= 7) {
        Alert.alert("Error", "Team is full! Remove a player first.");
        return;
      }
      const q = query(collection(db, "users"), where("studentCode", "==", newMemberCode));
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert("Error", "Student not found");
        return;
      }
      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data();
      if (studentData.hasTeam) {
        Alert.alert("Error", "Student already in a team");
        return;
      }
      const existingRequests = studentData.teamRequests || [];
      if (existingRequests.some(req => req.teamId === teamData.id)) {
        Alert.alert("Error", "Invite already sent to this student");
        return;
      }
      await updateDoc(doc(db, "users", studentDoc.id), {
        teamRequests: arrayUnion({
          teamId: teamData.id,
          teamName: teamData.teamName,
          captainId: userData.uid,
          captainName: userData.name,
        }),
      });
      Alert.alert("Success", `${studentData.name} has been invited to the team`);
      setNewMemberCode("");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err.code);
    }
  };

  const handlePositionChange = async (newPosition) => {
    const user = auth.currentUser;
    if (!user || !newPosition) return;
    setSavingPosition(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { position: newPosition });
      Alert.alert("Success", "Position updated successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to update position.");
    }
    setSavingPosition(false);
  };

  const autoAssign = async (playerId, playerName, playerPos, teamId, teamName) => {
    try {
      const batch = writeBatch(db);
      const teamRef = doc(db, "teams", teamId);
      const userRef = doc(db, "users", playerId);
      batch.update(teamRef, {
        memberIds: arrayUnion(playerId),
        members: arrayUnion(playerName),
        neededPositions: arrayRemove(playerPos),
        needsPosition: null
      });
      batch.update(userRef, {
        hasTeam: true,
        teamId: teamId,
        assignedTeam: teamName,
        searchingForTeam: false,
        playSolo: false
      });
      await batch.commit();
      return true;
    } catch (err) {
      console.error("Auto-assign error:", err);
      return false;
    }
  };

  const handleRequestPlayer = async (position) => {
    if (!teamData) return;
    const currentNeeded = teamData.neededPositions || [];

    if (position === null) {
      try {
        await updateDoc(doc(db, "teams", teamData.id), {
          neededPositions: [],
          needsPosition: null
        });
      } catch (err) { console.error(err); }
      return;
    }

    let updatedNeeded;
    if (currentNeeded.includes(position)) {
      updatedNeeded = currentNeeded.filter(p => p !== position);
    } else {
      updatedNeeded = [...currentNeeded, position];

      if ((teamData.memberIds?.length || 0) < 7) {
        const matchingSolo = allStudents.find(s =>
          (s.searchingForTeam || s.playSolo) &&
          !s.hasTeam &&
          s.position === position &&
          s.id !== userData.uid
        );
        if (matchingSolo) {
          const success = await autoAssign(matchingSolo.id, matchingSolo.name, position, teamData.id, teamData.teamName);
          if (success) {
            Alert.alert("Success", `Auto-matched! ${matchingSolo.name} (${position}) has joined your team! ⚽`);
            return;
          }
        }
      }
    }

    try {
      await updateDoc(doc(db, "teams", teamData.id), {
        neededPositions: updatedNeeded,
        needsPosition: updatedNeeded.length > 0 ? updatedNeeded[0] : null,
        requestTimestamp: new Date()
      });
      if (!currentNeeded.includes(position)) {
        Alert.alert("Info", `Request for a ${position} sent. No immediate matches found, Admin will be notified. 📢`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlaySolo = async (specificPos = null) => {
    if (!userData) return;

    if (userData.searchingForTeam) {
      try {
        await updateDoc(doc(db, "users", userData.uid), {
          searchingForTeam: false,
          playSolo: false
        });
        Alert.alert("Success", "Solo request cancelled.");
      } catch (err) { console.error(err); }
      return;
    }

    if (!specificPos) {
      setShowSoloModal(true);
      return;
    }

    const matchingTeam = approvedTeams.find(t =>
      (t.neededPositions || []).includes(specificPos) &&
      (t.memberIds?.length || 0) < 7
    );

    if (matchingTeam) {
      const success = await autoAssign(userData.uid, userData.name, specificPos, matchingTeam.id, matchingTeam.teamName);
      if (success) {
        Alert.alert("Success", `You've been automatically matched with ${matchingTeam.teamName} needing a ${specificPos}! ⚽`);
        return;
      }
    }

    try {
      await updateDoc(doc(db, "users", userData.uid), {
        searchingForTeam: true,
        playSolo: true,
        position: specificPos,
        soloPosition: specificPos
      });
      Alert.alert("Success", `You are now marked as a Solo ${specificPos}! No immediate team needed your position, Admin will match you later. ⚽`);
    } catch (err) {
      console.error(err);
    }
  };

  const isCaptain = teamData?.captainId === userData?.uid ||
    teamData?.captainName === userData?.name ||
    (userData?.role === 'student' && teamData?.captainName?.toLowerCase() === userData?.name?.toLowerCase());

  const soloPlayers = allStudents.filter(s =>
    (s.searchingForTeam === true || s.playSolo === true) &&
    s.hasTeam !== true &&
    s.role !== 'admin'
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
       {/* Sticky Navbar with transparent background */}
        <View style={styles.stickyNavbar}>
          <View style={styles.navLeft}>
            <TouchableOpacity onPress={() => setActiveView("dashboard")}>
              <Text style={styles.logo}>SCI-FOOTBALL</Text>
            </TouchableOpacity>
            <View style={styles.navLinks}>
               <View style={styles.navRight}>
            <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
            </View>
          </View>
        </View>
      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => {}} colors={["#22c55e"]} />
        }
      >
       

        {activeView === "dashboard" ? (
          <>
            {/* Profile Card */}
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userData?.name?.[0]?.toUpperCase() || "?"}</Text>
              </View>
              <Text style={styles.name}>{userData?.name || "Student Name"}</Text>
              <Text style={styles.studentId}>ID: {userData?.studentCode || "N/A"}</Text>
              <View style={[styles.badge, userData?.hasTeam ? styles.badgeGreen : styles.badgeOrange]}>
                <Text style={styles.badgeText}>
                  {userData?.hasTeam ? `Team: ${userData?.assignedTeam}` : "No Team Yet"}
                </Text>
              </View>
            </View>

            <view style={styles.card}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setActiveView("tournament")}>
                <Text style={[styles.primaryBtnText, activeView === "tournament" && styles.navLinkActive]}> Tournament</Text>
              </TouchableOpacity>
            </view>

            {/* Team Options - No Team */}
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

            {/* Stats & Next Match */}
            {userData?.hasTeam && (
              <View style={styles.statsRow}>
                <View style={[styles.card, styles.statsCard]}>
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
                      <Text style={styles.statLabel}>CARDS</Text>
                      <View style={styles.cardsRow}>
                        <View style={styles.yellowCard} />
                        <Text style={styles.cardCount}>{userData?.yellowCards || 0}</Text>
                        <View style={styles.redCard} />
                        <Text style={styles.cardCount}>{userData?.redCards || 0}</Text>
                      </View>
                    </View>
                  </View>
                  {userData?.redCards > 0 && (
                    <Text style={styles.suspendedText}>⚠️ You are suspended due to a red card!</Text>
                  )}
                </View>

                <View style={[styles.card, styles.nextMatchCard]}>
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
                    <Text style={styles.noTeamText}>No matches scheduled</Text>
                  )}
                </View>
              </View>
            )}

            {/* Live Matches */}
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { color: "#f87171" }]}>🔴 Live Matches</Text>
              {liveMatches.length === 0 ? (
                <Text style={styles.noTeamText}>No live matches</Text>
              ) : (
                <View style={styles.matchesContainer}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {liveMatches.map(match => {
                      const isMyTeam = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                      return (
                        <View key={match.id} style={[styles.matchRow, isMyTeam && styles.myMatchRow]}>
                          <View style={styles.matchHeader}>
                            <Text style={styles.liveTag}>LIVE NOW</Text>
                            {isMyTeam && <Text style={styles.yourTeamTag}>Your Team</Text>}
                          </View>
                          <View style={styles.matchTeamsContainer}>
                            <Text style={styles.matchTeam}>{match.team1Name || "Team 1"}</Text>
                            <Text style={styles.matchVs}>VS</Text>
                            <Text style={styles.matchTeam}>{match.team2Name || "Team 2"}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Match History */}
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
                if (filtered.length === 0) {
                  return (
                    <View style={styles.emptyHistory}>
                      <Text style={styles.emptyHistoryEmoji}>🏟️</Text>
                      <Text style={styles.emptyHistoryText}>No {historyTab === "myTeam" ? "team matches" : "other matches"} found</Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.matchesContainer}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      {filtered.map(match => {
                        const t1 = approvedTeams.find(t => t.id === match.team1Id);
                        const t2 = approvedTeams.find(t => t.id === match.team2Id);
                        const t1Name = t1?.teamName || "Team 1";
                        const t2Name = t2?.teamName || "Team 2";
                        const isMyMatch = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                        return (
                          <TouchableOpacity key={match.id} style={[styles.historyMatchRow, isMyMatch && styles.myHistoryRow]} onPress={() => setSelectedMatch(match)}>
                            <View style={styles.historyMatchHeader}>
                              <Text style={styles.historyMatchDate}>{match.date}</Text>
                              <Text style={styles.historyMatchStatus}>Finished</Text>
                            </View>
                            <View style={styles.historyMatchTeams}>
                              <Text style={[styles.historyMatchTeam, match.team1Id === userData?.teamId && styles.highlightTeam]}>{t1Name}</Text>
                              <Text style={styles.historyMatchScore}>{match.score || "0-0"}</Text>
                              <Text style={[styles.historyMatchTeam, match.team2Id === userData?.teamId && styles.highlightTeam]}>{t2Name}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })()}
            </View>

            {/* AI Coach Section */}
            <TouchableOpacity style={styles.aiCoachCard} onPress={() => setShowAI(true)}>
              <View>
                <Text style={styles.aiCoachTitle}>AI Coach</Text>
                <Text style={styles.aiCoachSubtitle}>اسأل مساعدك الرياضي</Text>
              </View>
              <Text style={styles.aiCoachArrow}>→</Text>
            </TouchableOpacity>

            {/* Team Members */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>👥 Team's Members</Text>
              {userData?.hasTeam && teamData ? (
                <>
                  {(teamData.members || []).map((playerName, i) => (
                    <View key={i} style={styles.memberRow}>
                      <View style={styles.memberDot} />
                      <Text style={styles.memberName}>{playerName}</Text>
                      {teamData.memberIds?.[i] === teamData.captainId && (
                        <Text style={styles.captainBadge}>Leader</Text>
                      )}
                      {isCaptain && playerName !== userData.name && (
                        <TouchableOpacity onPress={() => removePlayer(i)}>
                          <Text style={styles.removeBtn}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

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

                  {isCaptain ? (
                    <TouchableOpacity style={styles.leaveBtn} onPress={deleteTeam}>
                      <Text style={styles.leaveBtnText}>Delete Team</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.leaveBtn} onPress={leaveTeam}>
                      <Text style={styles.leaveBtnText}>Leave Team</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  {userData?.teamRequests?.length > 0 ? (
                    userData.teamRequests.map((req, i) => (
                      <View key={i} style={styles.inviteRow}>
                        <Text style={styles.inviteTeamName}>{req.teamName}</Text>
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
                    <Text style={styles.noTeamText}>No team yet</Text>
                  )}
                </>
              )}
            </View>

            {/* Settings & Player Info */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>⚙️ Settings</Text>
              <Text style={styles.settingLabel}>Your Position</Text>
              <View style={styles.positionGrid}>
                {['Forward', 'Defender', 'Goalkeeper'].map(pos => (
                  <TouchableOpacity 
                    key={pos}
                    style={[styles.positionGridBtn, userData?.position === pos && styles.positionGridBtnActive]} 
                    onPress={() => handlePositionChange(pos)} 
                    disabled={savingPosition}
                  >
                    <Text style={[styles.positionGridBtnText, userData?.position === pos && styles.positionGridBtnTextActive]}>
                      {pos === 'Forward' ? '⚡ Forward' : pos === 'Defender' ? '🛡️ Defender' : '🧤 Goalkeeper'}
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

            {/* Captain Options */}
            {isCaptain && teamData && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>👑 Captain Options</Text>
                <Text style={styles.recruitText}>Recruit Players - Need specific positions?</Text>
                <View style={styles.positionButtons}>
                  {['Goalkeeper', 'Defender', 'Forward'].map(pos => (
                    <TouchableOpacity 
                      key={pos}
                      style={[styles.positionBtn, (teamData?.neededPositions || []).includes(pos) && styles.positionBtnActive]} 
                      onPress={() => handleRequestPlayer(pos)}
                    >
                      <Text style={[styles.positionBtnText, (teamData?.neededPositions || []).includes(pos) && styles.positionBtnTextActive]}>
                        Need {pos}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {(teamData?.neededPositions?.length > 0 || teamData?.needsPosition) && (
                  <TouchableOpacity onPress={() => handleRequestPlayer(null)}>
                    <Text style={styles.clearRequestsText}>Clear All Requests</Text>
                  </TouchableOpacity>
                )}
                
                <Text style={styles.soloPlayersTitle}>Available Solo Players</Text>
                <View style={styles.soloPlayersContainer}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {soloPlayers.length > 0 ? (
                      soloPlayers.map(player => (
                        <View key={player.id} style={styles.soloPlayerRow}>
                          <View>
                            <Text style={styles.soloPlayerName}>{player.name}</Text>
                            <Text style={styles.soloPlayerPosition}>{player.position}</Text>
                          </View>
                          <View style={styles.soloPlayerDot} />
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noSoloText}>No solo players available right now.</Text>
                    )}
                  </ScrollView>
                </View>
                <Text style={styles.soloNote}>* Tell Admin which player you want, or send a position request above.</Text>
              </View>
            )}
          </>
        ) : (
          // TOURNAMENT VIEW - Read Only
          <View style={styles.tournamentContainer}>
            {/* Tournament Header Card */}
            <View style={styles.tournamentHeaderCard}>
              <View style={styles.tournamentHeaderRow}>
                <View style={styles.tournamentIconCircle}>
                  <Text style={styles.tournamentIconText}>🏆</Text>
                </View>
                <View style={styles.tournamentInfoContainer}>
                  <Text style={styles.tournamentName}>{tournament?.name || "No Active Tournament"}</Text>
                  {tournament?.startDate && tournament?.endDate && (
                    <Text style={styles.tournamentPeriod}>
                      {tournament.startDate} → {tournament.endDate}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Champion Banner */}
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

            {/* Bracket View */}
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
                              <Text style={styles.bracketRoundTitle}>
                                {getRoundLabel(rIdx, totalRounds)}
                              </Text>
                              {tournament.roundDateMap?.[rKey] && (
                                <Text style={styles.bracketRoundDate}>
                                  📅 {tournament.roundDateMap[rKey]?.date?.slice(5)?.replace("-", " ")?.toUpperCase()}
                                </Text>
                              )}
                            </View>
                            {tournament.rounds[rKey].map((match, matchIdx) => (
                              <View key={match.id || matchIdx} style={styles.bracketMatchCard}>
                                <Text style={styles.bracketMatchNumber}>MATCH {matchIdx + 1}</Text>
                                <View style={[
                                  styles.bracketTeamLine,
                                  match.winner?.id === match.team1?.id && styles.bracketTeamLineWinner
                                ]}>
                                  <Text style={[
                                    styles.bracketTeamName,
                                    match.winner?.id === match.team1?.id && styles.bracketTeamNameWinner
                                  ]}>
                                    {match.team1?.name || "TBD"}
                                  </Text>
                                  {match.winner?.id === match.team1?.id && (
                                    <Text style={styles.winnerCheckmark}>✓</Text>
                                  )}
                                </View>
                                {match.isBye ? (
                                  <View style={styles.byeContainer}>
                                    <Text style={styles.byeText}>BYE</Text>
                                  </View>
                                ) : (
                                  <View style={[
                                    styles.bracketTeamLine,
                                    match.winner?.id === match.team2?.id && styles.bracketTeamLineWinner
                                  ]}>
                                    <Text style={[
                                      styles.bracketTeamName,
                                      match.winner?.id === match.team2?.id && styles.bracketTeamNameWinner
                                    ]}>
                                      {match.team2?.name || "TBD"}
                                    </Text>
                                    {match.winner?.id === match.team2?.id && (
                                      <Text style={styles.winnerCheckmark}>✓</Text>
                                    )}
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
              // No Tournament Message
              <View style={styles.noTournamentCard}>
                <View style={styles.noTournamentIcon}>
                  <Text style={styles.noTournamentIconText}>🏆</Text>
                </View>
                <Text style={styles.noTournamentTitle}>No Active Tournament</Text>
                <Text style={styles.noTournamentSub}>
                  Check back later for upcoming tournaments and brackets
                </Text>
              </View>
            )}

            {/* Past Tournaments Archive */}
            {archived.length > 0 && (
              <View style={styles.archiveSection}>
                <TouchableOpacity 
                  style={styles.archiveToggleBtn} 
                  onPress={() => setShowArchive(!showArchive)}
                >
                  <View style={styles.archiveToggleLeft}>
                    <Text style={styles.archiveIcon}>📦</Text>
                    <Text style={styles.archiveToggleText}>
                      PAST TOURNAMENTS — {archived.length} ARCHIVED
                    </Text>
                  </View>
                  <Text style={styles.archiveArrow}>
                    {showArchive ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>
                
                {showArchive && archived.map(t => (
                  <View key={t.id} style={styles.archiveCard}>
                    <View style={styles.archiveCardContent}>
                      <View style={styles.archiveCardLeft}>
                        <Text style={styles.archiveCardIcon}>🏆</Text>
                        <View>
                          <Text style={styles.archiveCardTitle}>
                            {(t.name || "Unnamed Tournament").toUpperCase()}
                          </Text>
                          {t.finalWinner && (
                            <Text style={styles.archiveWinner}>🏆 {t.finalWinner.name}</Text>
                          )}
                          <Text style={styles.archiveDate}>
                            {t.archivedAt?.toDate?.()?.toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            }) || ""} • {t.numTeams} TEAMS • {Object.keys(t.rounds || {}).length} ROUNDS
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Back Button */}
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
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Play Solo Modal */}
      <Modal visible={showSoloModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.soloModalContent}>
            <View style={styles.soloModalIcon}>
              <Text style={styles.soloModalIconText}>🏃</Text>
            </View>
            <Text style={styles.soloModalTitle}>Choose Your Position</Text>
            <Text style={styles.soloModalSubtitle}>Admin will see this when matching you</Text>
            <View style={styles.soloModalButtons}>
              {['Forward', 'Defender', 'Goalkeeper'].map(pos => (
                <TouchableOpacity 
                  key={pos}
                  style={styles.soloModalBtn} 
                  onPress={() => {
                    setShowSoloModal(false);
                    handlePlaySolo(pos);
                  }}
                >
                  <Text style={styles.soloModalBtnText}>
                    {pos === 'Forward' ? '⚡' : pos === 'Defender' ? '🛡️' : '🧤'} {pos}
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
  bg: { flex: 1 ,backgroundColor: "#020617"},
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  container: { padding: 16, paddingBottom: 40 ,backgroundColor: "#020617",paddingTop: 80 },
  
  // Sticky Navbar
  stickyNavbar: { 
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,

  flexDirection: "row", 
  justifyContent: "space-between", 
  alignItems: "center", 
  paddingVertical: 16, 
  paddingHorizontal: 16,

  borderBottomWidth: 1, 
  borderBottomColor: "rgba(255,255,255,0.1)",

  backgroundColor: "rgba(15, 23, 42, 0.8)",
},
  navLeft: { flexDirection: "row", alignItems: "center", gap: 20 },
  logo: { fontSize: 20, fontWeight: "bold", color: "#22c55e" },
  navLinks: { flexDirection: "row", gap: 16 },
  navLink: { color: "#9ca3af", fontWeight: "bold", fontSize: 14 },
  navLinkActive: { color: "#22c55e" },
  navRight: { flexDirection: "row", gap: 12 },
  signOutBtn: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  signOutText: { color: "#f87171", fontWeight: "600" },
  
  // Cards
  card: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  statsCard: { flex: 1, marginRight: 0,marginBottom:16 },
  nextMatchCard: { flex: 1, marginLeft: 0 },
  
  // Profile
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#16a34a", alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center" },
  studentId: { color: "#9ca3af", textAlign: "center", marginTop: 4 },
  badge: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  badgeGreen: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  badgeOrange: { backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)" },
  badgeText: { color: "#fff", fontWeight: "600" },
  
  // Stats
  statsRow: { flexDirection: "column", marginBottom: 16 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  statBox: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  statLabel: { color: "#9ca3af", fontSize: 10, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "bold" },
  cardsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  yellowCard: { width: 10, height: 14, backgroundColor: "#facc15", borderRadius: 2 },
  redCard: { width: 10, height: 14, backgroundColor: "#ef4444", borderRadius: 2 },
  cardCount: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  suspendedText: { color: "#ef4444", fontSize: 11, fontWeight: "bold", textAlign: "center", marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 12 },
  
  // Info Rows
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  infoLabel: { color: "#9ca3af" },
  infoValue: { color: "#fff", fontWeight: "500" },
  
  // Buttons
  primaryBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  secondaryBtn: { backgroundColor: "rgba(59,130,246,0.2)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" },
  secondaryBtnActive: { backgroundColor: "rgba(249,115,22,0.2)", borderColor: "rgba(249,115,22,0.3)" },
  secondaryBtnText: { color: "#60a5fa", fontWeight: "600" },
  secondaryBtnTextActive: { color: "#f97316" },
  
  // Live Matches
  matchesContainer: { maxHeight: 200, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 8, backgroundColor: "rgba(0,0,0,0.2)" },
  matchRow: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  myMatchRow: { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)" },
  matchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  liveTag: { color: "#22c55e", fontSize: 10, fontWeight: "bold" },
  yourTeamTag: { color: "#fff", fontSize: 10, fontWeight: "bold", backgroundColor: "rgba(239,68,68,0.3)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  matchTeamsContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  matchTeam: { color: "#fff", fontWeight: "bold", fontSize: 12, flex: 1, textAlign: "center" },
  matchVs: { color: "#9ca3af", fontSize: 10, marginHorizontal: 8 },
  
  // History
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  historyTabs: { flexDirection: "row", gap: 8 },
  historyTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
  historyTabActive: { backgroundColor: "rgba(251,191,36,0.2)" },
  historyTabText: { color: "#9ca3af", fontSize: 10, fontWeight: "bold" },
  historyTabTextActive: { color: "#fbbf24" },
  historyMatchRow: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  myHistoryRow: { backgroundColor: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.2)" },
  historyMatchHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  historyMatchDate: { color: "#9ca3af", fontSize: 9 },
  historyMatchStatus: { color: "#fbbf24", fontSize: 9, fontWeight: "bold" },
  historyMatchTeams: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyMatchTeam: { color: "#fff", fontSize: 12, fontWeight: "bold", flex: 1, textAlign: "center" },
  highlightTeam: { color: "#fbbf24" },
  historyMatchScore: { color: "#60a5fa", fontSize: 14, fontWeight: "bold", marginHorizontal: 8 },
  emptyHistory: { alignItems: "center", paddingVertical: 20 },
  emptyHistoryEmoji: { fontSize: 32, marginBottom: 8 },
  emptyHistoryText: { color: "#475569", fontSize: 12 },
  
  // AI Coach
  aiCoachCard: { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", marginBottom: 16 },
  aiCoachTitle: { fontSize: 14, fontWeight: "bold", color: "#22c55e", marginBottom: 4 },
  aiCoachSubtitle: { fontSize: 10, color: "#22c55e", opacity: 0.7 },
  aiCoachArrow: { fontSize: 18, color: "#22c55e" },
  
  // Team Members
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 12, marginBottom: 6 },
  memberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  memberName: { color: "#e2e8f0", fontWeight: "600", flex: 1 },
  captainBadge: { backgroundColor: "rgba(234,179,8,0.2)", color: "#eab308", fontSize: 9, fontWeight: "bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  removeBtn: { color: "#f87171", fontSize: 12, fontWeight: "bold" },
  inviteSection: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  inviteSectionTitle: { color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 8 },
  inviteInputRow: { flexDirection: "row", gap: 8 },
  inviteInput: { flex: 1, backgroundColor: "#0f172a", borderRadius: 10, padding: 10, color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  inviteSendBtn: { backgroundColor: "#22c55e", borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  inviteSendBtnText: { color: "#000", fontWeight: "bold" },
  leaveBtn: { backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  leaveBtnText: { color: "#f87171", fontWeight: "bold" },
  inviteRow: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  inviteTeamName: { color: "#fff", fontWeight: "bold", marginBottom: 8 },
  inviteBtns: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 10, padding: 8, alignItems: "center" },
  acceptBtnText: { color: "#000", fontWeight: "bold", fontSize: 12 },
  rejectBtn: { flex: 1, backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 10, padding: 8, alignItems: "center" },
  rejectBtnText: { color: "#f87171", fontWeight: "bold", fontSize: 12 },
  noTeamText: { color: "#475569", fontStyle: "italic", textAlign: "center", padding: 20 },
  
  // Settings
  settingLabel: { color: "#9ca3af", fontSize: 11, marginBottom: 8 },
  positionGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  positionGridBtn: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  positionGridBtnActive: { backgroundColor: "rgba(34,197,94,0.2)", borderColor: "#22c55e" },
  positionGridBtnText: { color: "#9ca3af", fontSize: 10, fontWeight: "bold" },
  positionGridBtnTextActive: { color: "#22c55e" },
  settingBtn: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, marginBottom: 8 },
  settingBtnText: { color: "#fff" },
  
  // Info Grid
  infoGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  infoCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  
  // Captain Options
  recruitText: { color: "#9ca3af", fontSize: 11, marginBottom: 12 },
  positionButtons: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  positionBtn: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  positionBtnActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  positionBtnText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  positionBtnTextActive: { color: "#000" },
  clearRequestsText: { color: "#f87171", fontSize: 10, textAlign: "center", marginTop: 8 },
  soloPlayersTitle: { fontSize: 13, fontWeight: "bold", color: "#fff", marginTop: 16, marginBottom: 8 },
  soloPlayersContainer: { maxHeight: 150, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  soloPlayerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  soloPlayerName: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  soloPlayerPosition: { color: "#22c55e", fontSize: 9, fontWeight: "bold", marginTop: 2 },
  soloPlayerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  noSoloText: { color: "#475569", fontSize: 11, textAlign: "center", paddingVertical: 16 },
  soloNote: { color: "#475569", fontSize: 9, marginTop: 8, textAlign: "center" },
  
  // TOURNAMENT TAB STYLES
  tournamentContainer: { padding: 0, paddingBottom: 40 },
  
  tournamentHeaderCard: { 
    backgroundColor: "rgba(0,255,156,0.08)", 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: "rgba(0,255,156,0.2)" 
  },
  tournamentHeaderRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  tournamentIconCircle: { 
    width: 56, 
    height: 56, 
    borderRadius: 18, 
    backgroundColor: "rgba(0,255,156,0.15)", 
    alignItems: "center", 
    justifyContent: "center", 
    borderWidth: 1, 
    borderColor: "rgba(0,255,156,0.3)" 
  },
  tournamentIconText: { fontSize: 28 },
  tournamentInfoContainer: { flex: 1 },
  tournamentName: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  tournamentPeriod: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  
  championBannerContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 16, 
    backgroundColor: "rgba(234,179,8,0.1)", 
    borderRadius: 20, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: "rgba(234,179,8,0.22)", 
    marginBottom: 16 
  },
  championTrophy: { fontSize: 32 },
  championInfo: { alignItems: "center" },
  championLabel: { color: "#eab308", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  championTeamName: { color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase" },
  
  bracketMainContainer: { 
    backgroundColor: "#0f172a", 
    borderRadius: 20, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.07)", 
    marginBottom: 20 
  },
  bracketHeaderRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 8 
  },
  bracketMainTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  teamCountBadge: { 
    backgroundColor: "rgba(0,255,156,0.1)", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: "rgba(0,255,156,0.2)" 
  },
  teamCountText: { color: "#00FF9C", fontSize: 10, fontWeight: "800" },
  bracketSubHeader: { color: "#64748b", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 18 },
  bracketColumnsContainer: { flexDirection: "row", gap: 24, padding: 4 },
  bracketColumn: { width: 200 },
  bracketRoundHeader: { alignItems: "center", marginBottom: 14 },
  bracketRoundTitle: { color: "#00FF9C", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 },
  bracketRoundDate: { color: "#64748b", fontSize: 8, marginTop: 4 },
  bracketMatchCard: { 
    backgroundColor: "#1e293b", 
    borderRadius: 14, 
    padding: 12, 
    marginBottom: 14, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.07)" 
  },
  bracketMatchNumber: { 
    color: "#475569", 
    fontSize: 8, 
    fontWeight: "800", 
    textTransform: "uppercase", 
    letterSpacing: 1, 
    textAlign: "center", 
    marginBottom: 10 
  },
  bracketTeamLine: { 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 10, 
    backgroundColor: "rgba(255,255,255,0.04)", 
    marginBottom: 6, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.05)" 
  },
  bracketTeamLineWinner: { 
    backgroundColor: "rgba(0,255,156,0.1)", 
    borderColor: "rgba(0,255,156,0.25)" 
  },
  bracketTeamName: { color: "#e2e8f0", fontWeight: "700", fontSize: 12 },
  bracketTeamNameWinner: { color: "#00FF9C" },
  winnerCheckmark: { color: "#00FF9C", fontSize: 12, fontWeight: "bold" },
  byeContainer: { 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: "#334155", 
    borderStyle: "dashed", 
    alignItems: "center",
    marginBottom: 6
  },
  byeText: { color: "#475569", fontWeight: "700", fontSize: 10 },
  bracketMatchTime: { marginTop: 8, alignItems: "center" },
  bracketTimeText: { color: "#475569", fontSize: 9 },
  
  noTournamentCard: { 
    backgroundColor: "rgba(255,255,255,0.05)", 
    borderRadius: 24, 
    padding: 32, 
    alignItems: "center", 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  noTournamentIcon: { 
    width: 72, 
    height: 72, 
    borderRadius: 24, 
    backgroundColor: "rgba(255,255,255,0.05)", 
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  noTournamentIconText: { fontSize: 36 },
  noTournamentTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  noTournamentSub: { color: "#9ca3af", fontSize: 12, textAlign: "center" },
  
  archiveSection: { marginTop: 8, marginBottom: 20 },
  archiveToggleBtn: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    backgroundColor: "rgba(255,255,255,0.05)", 
    padding: 16, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.07)", 
    marginBottom: 8 
  },
  archiveToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  archiveIcon: { color: "#00FF9C", fontSize: 13 },
  archiveToggleText: { color: "#64748b", fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  archiveArrow: { color: "#64748b" },
  archiveCard: { 
    backgroundColor: "rgba(255,255,255,0.05)", 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.06)" 
  },
  archiveCardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  archiveCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  archiveCardIcon: { fontSize: 24 },
  archiveCardTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  archiveWinner: { color: "#fbbf24", fontSize: 11, fontWeight: "700", marginTop: 2 },
  archiveDate: { color: "#64748b", fontSize: 10, fontWeight: "600", marginTop: 2 },
  
  backToDashboardBtn: { 
    backgroundColor: "rgba(255,255,255,0.1)", 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    borderRadius: 14, 
    alignItems: "center",
    marginTop: 8
  },
  backToDashboardText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#0f172a", borderRadius: 24, width: "90%", maxWidth: 400, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  modalTitle: { color: "#fbbf24", fontSize: 18, fontWeight: "bold" },
  modalClose: { color: "#9ca3af", fontSize: 20, fontWeight: "bold" },
  modalBody: { padding: 20 },
  modalScoreContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTeam: { flex: 1, alignItems: "center" },
  modalTeamName: { color: "#fff", fontSize: 14, fontWeight: "bold", textAlign: "center" },
  modalScore: { color: "#60a5fa", fontSize: 28, fontWeight: "bold", marginTop: 8 },
  modalVs: { color: "#9ca3af", fontSize: 16, fontWeight: "bold", marginHorizontal: 16 },
  modalDate: { color: "#9ca3af", fontSize: 12, textAlign: "center" },
  
  // Solo Modal
  soloModalContent: { backgroundColor: "#0f172a", borderRadius: 24, width: "85%", maxWidth: 350, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  soloModalIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(59,130,246,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" },
  soloModalIconText: { fontSize: 32 },
  soloModalTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  soloModalSubtitle: { color: "#9ca3af", fontSize: 10, marginBottom: 20, textAlign: "center" },
  soloModalButtons: { width: "100%", gap: 10, marginBottom: 16 },
  soloModalBtn: { backgroundColor: "rgba(255,255,255,0.05)", paddingVertical: 14, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  soloModalBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  soloModalCancel: { color: "#f87171", fontSize: 12, marginTop: 8 }
});