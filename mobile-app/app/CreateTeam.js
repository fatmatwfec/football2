import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, FlatList, SafeAreaView, ActivityIndicator
} from "react-native";
import { db, auth } from "../firebase";
import {
  collection, addDoc, updateDoc, doc, getDocs,
  query, where, getDoc, serverTimestamp, limit
} from "firebase/firestore";
import { useRouter } from "expo-router";

export default function CreateTeam() {
  const [teamName, setTeamName] = useState("");
  const [nameExists, setNameExists] = useState(false);
  const [codes, setCodes] = useState([""]);
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // debounce helper
  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  // check team name uniqueness
  const checkTeamName = debounce(async (name) => {
    if (!name.trim()) return setNameExists(false);
    const q = query(collection(db, "teams"), where("teamName", "==", name));
    const snap = await getDocs(q);
    setNameExists(!snap.empty);
  }, 500);

  const addPlayer = () => {
    if (codes.length >= 6) return Alert.alert("Max 7 players allowed");
    setCodes([...codes, ""]);
  };

  const removePlayer = (index) => {
    const newCodes = codes.filter((_, i) => i !== index);
    setCodes(newCodes);
    const newSuggestions = { ...suggestions };
    delete newSuggestions[index];
    setSuggestions(newSuggestions);
  };

  const fetchSuggestions = debounce(async (index, value) => {
    if (!value) {
      setSuggestions(prev => ({ ...prev, [index]: [] }));
      return;
    }
    const snapshot = await getDocs(query(collection(db, "users"), limit(20)));
    const results = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(user =>
        (user.name?.toLowerCase().includes(value.toLowerCase()) ||
          user.studentCode?.toString().includes(value)) &&
        user.role !== "admin" && !user.hasTeam
      );
    setSuggestions(prev => ({ ...prev, [index]: results }));
  }, 400);

  const updateCode = (index, value) => {
    const newCodes = [...codes];
    newCodes[index] = value;
    setCodes(newCodes);
    fetchSuggestions(index, value);
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return Alert.alert("Enter team name");
    if (nameExists) return Alert.alert("Team name already exists");

    const filteredCodes = codes.filter(c => c.trim() !== "");
    if (filteredCodes.length === 0) return Alert.alert("Add at least one player");
    if (filteredCodes.length > 6) return Alert.alert("Max 7 players allowed");

    const uniqueCodes = new Set(filteredCodes);
    if (uniqueCodes.size !== filteredCodes.length)
      return Alert.alert("Duplicate student codes are not allowed");

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const captainDoc = await getDoc(doc(db, "users", user.uid));
      const captainData = captainDoc.data();
      if (!captainData) throw new Error("Captain data not found");

      const memberIds = [user.uid];
      const members = [captainData.name];
      const playersToInvite = [];

      for (let inputCode of filteredCodes) {
        let snap = await getDocs(
          query(collection(db, "users"), where("studentCode", "==", inputCode))
        );
        if (snap.empty && !isNaN(inputCode)) {
          snap = await getDocs(
            query(collection(db, "users"), where("studentCode", "==", Number(inputCode)))
          );
        }
        if (snap.empty) {
          setLoading(false);
          return Alert.alert(`Code "${inputCode}" not found`);
        }
        const playerDoc = snap.docs[0];
        const playerData = playerDoc.data();

        if (playerData.hasTeam) {
          setLoading(false);
          return Alert.alert(`${playerData.name} already in a team`);
        }
        if (playerData.role === "admin") {
          setLoading(false);
          return Alert.alert(`"${playerData.name}" is an admin and cannot join a team`);
        }
        if (memberIds.includes(playerDoc.id)) continue;

        memberIds.push(playerDoc.id);
        members.push(playerData.name);
        playersToInvite.push({ id: playerDoc.id, data: playerData });
      }

      // create team with "pending" status
      const teamRef = await addDoc(collection(db, "teams"), {
        teamName: teamName.trim(),
        captainId: user.uid,
        captainName: captainData.name,
        category: "General League",
        status: "pending",
        createdAt: serverTimestamp(),
        memberIds,
        members,
      });

      // send invites to players
      for (let player of playersToInvite) {
        await updateDoc(doc(db, "users", player.id), {
          teamRequests: [
            ...(player.data.teamRequests || []),
            { teamId: teamRef.id, teamName: teamName.trim(), captainId: user.uid }
          ]
        });
      }

      // update captain
      await updateDoc(doc(db, "users", user.uid), {
        hasTeam: true,
        teamId: teamRef.id,
        assignedTeam: teamName.trim(),
      });

      Alert.alert("✅ Team created successfully!");
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Your Team</Text>

        {/* Team Name */}
        <TextInput
          placeholder="Enter Team Name"
          placeholderTextColor="#475569"
          value={teamName}
          onChangeText={(v) => { setTeamName(v); checkTeamName(v); }}
          style={[styles.input, nameExists && styles.inputError]}
        />
        {nameExists && <Text style={styles.errorText}>Team name already exists</Text>}

        {/* Players */}
        {codes.map((code, i) => (
          <View key={i} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder={`Player ${i + 1} (name or ID)`}
                  placeholderTextColor="#475569"
                  value={code}
                  onChangeText={(v) => updateCode(i, v)}
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                />
                {codes.length > 1 && (
                  <TouchableOpacity onPress={() => removePlayer(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Suggestions */}
              {suggestions[i]?.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {suggestions[i].map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.suggestionItem}
                      onPress={() => {
                        updateCode(i, s.studentCode?.toString());
                        setSuggestions(prev => ({ ...prev, [i]: [] }));
                      }}
                    >
                      <Text style={styles.suggestionName}>{s.name}</Text>
                      <Text style={styles.suggestionCode}>ID: {s.studentCode}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addPlayer}>
          <Text style={styles.addBtnText}>+ Add Player</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.7 }]}
          onPress={handleCreateTeam}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.createBtnText}>Create Team</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, color: "#22c55e", fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: {
    backgroundColor: "#1e293b", color: "#fff", padding: 14,
    borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  inputError: { borderColor: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 12, marginBottom: 10, marginLeft: 4 },
  playerRow: { marginBottom: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  removeBtn: {
    backgroundColor: "rgba(239,68,68,0.2)", padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
  },
  removeBtnText: { color: "#f87171", fontWeight: "bold" },
  suggestionsBox: {
    backgroundColor: "#1e293b", borderRadius: 10, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden",
  },
  suggestionItem: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    flexDirection: "row", justifyContent: "space-between",
  },
  suggestionName: { color: "#fff", fontWeight: "600" },
  suggestionCode: { color: "#64748b", fontSize: 12 },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14,
    alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  addBtnText: { color: "#94a3b8", fontWeight: "600" },
  createBtn: {
    backgroundColor: "#22c55e", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8,
  },
  createBtnText: { color: "#000", fontWeight: "bold", fontSize: 16 },
});