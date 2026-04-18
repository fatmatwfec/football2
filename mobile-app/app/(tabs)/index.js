import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, ImageBackground, TextInput, Alert
} from "react-native";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, onSnapshot, updateDoc, arrayUnion, getDocs,
  collection, query, where, deleteDoc, getDoc
} from "firebase/firestore";
import { useRouter } from "expo-router";

export default function StudentDashboard() {
  const [userData, setUserData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMemberCode, setNewMemberCode] = useState("");
  const [nextMatch, setNextMatch] = useState(null);
  const [liveMatches, setLiveMatches] = useState([]);
  const [finishedMatches, setFinishedMatches] = useState([]);
  const router = useRouter();

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
              });
            } else {
              setTeamData(null);
              unsubTeam();
            }
          }
          setLoading(false);
        });
      } else {
        router.replace("/(auth)/login");
      }
    });

    return () => { unsubAuth(); unsubUser(); unsubTeam(); };
  }, []);

  // All matches listener (live + finished)
 useEffect(() => {
  const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = Date.now();

    const live = data.filter(m => {
      if (!m.startTime) return false;

      const start = m.startTime?.toMillis
        ? m.startTime.toMillis()
        : new Date(m.startTime).getTime();

      const isInTimeWindow =
        now >= start &&
        now <= start + 20 * 60 * 1000;

      const notFinished = m.status !== "completed";

      return isInTimeWindow && notFinished;
    });

    setLiveMatches(live);
    setFinishedMatches(
      data.filter(m =>
        (m.status || "").trim().toLowerCase() === "completed"
      )
    );
  });

  return () => unsubMatches();
}, []);

  // Next match for this team
  useEffect(() => {
    if (!userData?.teamId) return;
    const q = query(
      collection(db, "matches"),
      where("team1Id", "==", userData.teamId)
    );
    const q2 = query(
      collection(db, "matches"),
      where("team2Id", "==", userData.teamId)
    );
    let combined = [];
    const unsub1 = onSnapshot(q, (snap) => {
      combined = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNextMatch(combined.find(m => m.status !== "completed") || null);
    });
    return () => unsub1();
  }, [userData?.teamId]);

  const acceptInvite = async (req) => {
    if (userData.hasTeam) return Alert.alert("You already have a team!");
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, "teams", req.teamId), {
        memberIds: arrayUnion(user.uid),
        members: arrayUnion(userData.name),
      });
      await updateDoc(doc(db, "users", user.uid), {
        hasTeam: true,
        teamId: req.teamId,
        assignedTeam: req.teamName,
        teamRequests: [],
      });
      Alert.alert("✅ Joined Team Successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error joining team");
    }
  };

  const rejectInvite = async (req) => {
    const updated = userData.teamRequests.filter(r => r.teamId !== req.teamId);
    await updateDoc(doc(db, "users", userData.uid), { teamRequests: updated });
  };

  const leaveTeam = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !teamData) return;
      const index = teamData.memberIds.findIndex(id => id === user.uid);
      if (index === -1) return;
      const newMemberIds = [...teamData.memberIds];
      const newMembers = [...teamData.members];
      newMemberIds.splice(index, 1);
      newMembers.splice(index, 1);
      await updateDoc(doc(db, "teams", userData.teamId), { memberIds: newMemberIds, members: newMembers });
      await updateDoc(doc(db, "users", user.uid), { hasTeam: false, teamId: null, assignedTeam: null });
    } catch (err) {
      console.log("LEAVE ERROR:", err);
    }
  };

  const removePlayer = async (index) => {
    Alert.alert("Remove Player", "Are you sure?", [
      { text: "Cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        const newIds = [...(teamData.memberIds || [])];
        const newNames = [...(teamData.members || [])];
        const removedId = newIds[index];
        newIds.splice(index, 1);
        newNames.splice(index, 1);
        await updateDoc(doc(db, "teams", teamData.id), { memberIds: newIds, members: newNames });
        await updateDoc(doc(db, "users", removedId), { hasTeam: false, teamId: null, assignedTeam: null });
      }}
    ]);
  };

  const deleteTeam = async () => {
    Alert.alert("Delete Team", "Are you sure? All members will become Free Agents.", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const memberIds = teamData?.memberIds || [];
          for (let id of memberIds) {
            await updateDoc(doc(db, "users", id), { hasTeam: false, teamId: null, assignedTeam: null });
          }
          await deleteDoc(doc(db, "teams", teamData.id));
          Alert.alert("✅ Team Deleted");
        } catch (err) {
          Alert.alert("Error", err.message);
        }
      }}
    ]);
  };

  const sendInvite = async () => {
    if (!newMemberCode.trim()) return Alert.alert("Enter student code");
    try {
      const teamRef = doc(db, "teams", userData.teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) return Alert.alert("Team not found");
      const team = teamSnap.data();
      if ((team.members || []).length >= 7) return Alert.alert("Team is full!");

      const q = query(collection(db, "users"), where("studentCode", "==", newMemberCode));
      const snap = await getDocs(q);
      if (snap.empty) return Alert.alert("Student not found");
      const studentDoc = snap.docs[0];
      const studentData = studentDoc.data();
      if (studentData.hasTeam) return Alert.alert("Student already in a team");

      const existingRequests = studentData.teamRequests || [];
      if (existingRequests.some(req => req.teamId === teamData.id))
        return Alert.alert("Invite already sent");

      await updateDoc(doc(db, "users", studentDoc.id), {
        teamRequests: arrayUnion({
          teamId: teamData.id,
          teamName: teamData.teamName,
          captainId: userData.uid,
          captainName: userData.name,
        }),
      });
      Alert.alert(`✅ ${studentData.name} has been invited!`);
      setNewMemberCode("");
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const isCaptain = teamData && userData?.uid === teamData?.captainId;

  return (
    <ImageBackground source={require("../../assets/images/background.jpg")} style={styles.bg}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Navbar */}
        <View style={styles.navbar}>
          <Text style={styles.logo}>SCI-FOOTBALL</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userData?.name?.[0]}</Text>
          </View>
          <Text style={styles.name}>{userData?.name}</Text>
          <Text style={styles.studentId}>ID: {userData?.studentCode}</Text>
          <View style={[styles.badge, userData?.hasTeam ? styles.badgeGreen : styles.badgeOrange]}>
            <Text style={styles.badgeText}>
              {userData?.hasTeam ? `Team: ${userData?.assignedTeam}` : "No Team Yet"}
            </Text>
          </View>
        </View>

        {/* Stats */}
        {userData?.hasTeam && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⚡ Your Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>SCORE</Text>
                <Text style={[styles.statValue, { color: "#60a5fa" }]}>{userData?.score || 0}</Text>
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
        )}

        {/* Next Match */}
        {userData?.hasTeam && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🏟️ Next Match</Text>
            {nextMatch ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Opponent</Text>
                  <Text style={styles.infoValue}>
                    {nextMatch.team1Id === userData.teamId ? nextMatch.team2Name : nextMatch.team1Name}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pitch</Text>
                  <Text style={styles.infoValue}>{nextMatch.pitch || "N/A"}</Text>
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
        )}

        {/* Live Matches */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: "#f87171" }]}>🔴 Live Matches</Text>
          {liveMatches.length === 0 ? (
            <Text style={styles.noTeamText}>No live matches</Text>
          ) : (
            <View style={{ maxHeight: 180, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
              <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                {liveMatches.map(match => (
                  <View key={match.id} style={styles.matchRow}>
                    <Text style={styles.matchTeams}>{match.team1Name} vs {match.team2Name}</Text>
                    <Text style={styles.matchScore}>{match.score || "0-0"}</Text>
                    <Text style={styles.liveTag}>LIVE</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Match History */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: "#fbbf24" }]}>📜 Match History</Text>
          {finishedMatches.length === 0 ? (
            <Text style={styles.noTeamText}>No finished matches</Text>
          ) : (
            <View style={{ maxHeight: 180, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 8, backgroundColor: "rgba(0,0,0,0.2)" }}>
              <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                {finishedMatches.map(match => (
                  <View key={match.id} style={styles.matchRow}>
                    <Text style={styles.matchTeams}>{match.team1Name} vs {match.team2Name}</Text>
                    <Text style={styles.matchScore}>{match.score || "0-0"}</Text>
                    <Text style={styles.finishedTag}>Finished</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Team Options - no team */}
        {!userData?.hasTeam && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Team Options</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/CreateTeam")}>
              <Text style={styles.primaryBtnText}>Create Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Play Solo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invites */}
        {!userData?.hasTeam && userData?.teamRequests?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📩 Team Invites</Text>
            {userData.teamRequests.map((req, i) => (
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
            ))}
          </View>
        )}

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
            <Text style={styles.noTeamText}>No team yet</Text>
          )}
        </View>

        {/* Player Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Player Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userData?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Your Role</Text>
            <Text style={[styles.infoValue, { color: "#34d399" }]}>
              {isCaptain ? "Team Leader" : "Player"}
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.settingBtn} onPress={() => router.push("/EditProfile")}>
            <Text style={styles.settingBtnText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingBtn} onPress={() => router.push("/ChangePassword")}>
            <Text style={styles.settingBtnText}>Change Password</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  container: { padding: 16, paddingBottom: 40 },
  navbar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 16, marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)"
  },
  logo: { fontSize: 20, fontWeight: "bold", color: "#22c55e" },
  signOutBtn: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  signOutText: { color: "#f87171", fontWeight: "600" },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24,
    padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#16a34a",
    alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 12
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center" },
  studentId: { color: "#9ca3af", textAlign: "center", marginTop: 4 },
  badge: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  badgeGreen: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  badgeOrange: { backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)" },
  badgeText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 12 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  statBox: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 16,
    padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  statLabel: { color: "#9ca3af", fontSize: 9, fontWeight: "bold", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "bold" },
  cardsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  yellowCard: { width: 10, height: 14, backgroundColor: "#facc15", borderRadius: 2 },
  redCard: { width: 10, height: 14, backgroundColor: "#ef4444", borderRadius: 2 },
  cardCount: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  suspendedText: { color: "#ef4444", fontSize: 11, fontWeight: "bold", textAlign: "center", marginTop: 10 },
  matchRow: {
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  matchTeams: { color: "#fff", fontWeight: "bold", marginBottom: 4 },
  matchScore: { color: "#60a5fa", fontSize: 20, fontWeight: "bold", marginBottom: 2 },
  liveTag: { color: "#22c55e", fontSize: 10, fontWeight: "bold" },
  finishedTag: { color: "#fbbf24", fontSize: 10, fontWeight: "bold" },
  primaryBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "rgba(59,130,246,0.2)", borderRadius: 14, paddingVertical: 14,
    alignItems: "center", borderWidth: 1, borderColor: "rgba(59,130,246,0.3)"
  },
  secondaryBtnText: { color: "#60a5fa", fontWeight: "600" },
  inviteRow: {
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
  },
  inviteTeamName: { color: "#fff", fontWeight: "bold", marginBottom: 8 },
  inviteBtns: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#22c55e", borderRadius: 10, padding: 8, alignItems: "center" },
  acceptBtnText: { color: "#000", fontWeight: "bold", fontSize: 12 },
  rejectBtn: { flex: 1, backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 10, padding: 8, alignItems: "center" },
  rejectBtnText: { color: "#f87171", fontWeight: "bold", fontSize: 12 },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 12,
    padding: 12, marginBottom: 6
  },
  memberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  memberName: { color: "#e2e8f0", fontWeight: "600", flex: 1 },
  captainBadge: {
    backgroundColor: "rgba(234,179,8,0.2)", color: "#eab308",
    fontSize: 9, fontWeight: "bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6
  },
  removeBtn: { color: "#f87171", fontSize: 12, fontWeight: "bold" },
  leaveBtn: {
    backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 14, padding: 14,
    alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)"
  },
  leaveBtnText: { color: "#f87171", fontWeight: "bold" },
  noTeamText: { color: "#475569", fontStyle: "italic", textAlign: "center", padding: 20 },
  inviteSection: {
    marginTop: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
  },
  inviteSectionTitle: { color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 8 },
  inviteInputRow: { flexDirection: "row", gap: 8 },
  inviteInput: {
    flex: 1, backgroundColor: "#0f172a", borderRadius: 10, padding: 10,
    color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)"
  },
  inviteSendBtn: { backgroundColor: "#22c55e", borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  inviteSendBtnText: { color: "#000", fontWeight: "bold" },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)"
  },
  infoLabel: { color: "#9ca3af" },
  infoValue: { color: "#fff", fontWeight: "500" },
  settingBtn: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, marginBottom: 8 },
  settingBtnText: { color: "#fff" },
});