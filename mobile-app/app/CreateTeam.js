import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { db, auth } from "../firebase";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { useRouter } from "expo-router";

export default function CreateTeam() {
  const [teamName, setTeamName] = useState("");
  const router = useRouter();

  const createTeam = async () => {
    if (!teamName.trim()) {
      return Alert.alert("Enter team name");
    }

    try {
      const user = auth.currentUser;

      const teamRef = await addDoc(collection(db, "teams"), {
        teamName: teamName,
        captainId: user.uid,
        memberIds: [user.uid],
        members: ["captin"], 
        createdAt: new Date(),
      });

      await updateDoc(doc(db, "users", user.uid), {
        hasTeam: true,
        teamId: teamRef.id,
        assignedTeam: teamName,
      });

      Alert.alert("Team Created Successfully!");
      router.back(); 

    } catch (err) {
      console.error(err);
      Alert.alert(" Error creating team");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Team</Text>

      <TextInput
        placeholder="Enter Team Name"
        value={teamName}
        onChangeText={setTeamName}
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={createTeam}>
        <Text style={styles.buttonText}>Create</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    padding: 20
  },
  title: {
    fontSize: 24,
    color: "#22c55e",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center"
  },
  input: {
    backgroundColor: "#1e293b",
    color: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20
  },
  button: {
    backgroundColor: "#22c55e",
    padding: 15,
    borderRadius: 12,
    alignItems: "center"
  },
  buttonText: {
    fontWeight: "bold",
    color: "#000"
  }
});
