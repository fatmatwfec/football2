import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, ImageBackground
} from "react-native";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "expo-router";

export default function StudentDashboard() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserData({ ...userDoc.data(), email: user.email });
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      } else {
        router.replace("/(auth)/login");
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/background.jpg")}
      style={styles.bg}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Navbar */}
        <View style={styles.navbar}>
          <Text style={styles.logo}>SCI-FOOTBALL</Text>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => signOut(auth)}
          >
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
              {userData?.hasTeam ? userData?.assignedTeam : "Under Review"}
            </Text>
          </View>
        </View>

        {/* Team Options */}
        {!userData?.hasTeam && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Team Options</Text>
            <TouchableOpacity style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Create Team</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Play Solo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Player Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Player Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userData?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Position</Text>
            <Text style={[styles.infoValue, { color: "#22c55e" }]}>
              {userData?.position || "Not Selected"}
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.settingBtn}>
            <Text style={styles.settingBtnText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingBtn}
            onPress={() => router.push("/ChangePassword")}
          >
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
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 16, marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)"
  },
  logo: { fontSize: 20, fontWeight: "bold", color: "#22c55e" },
  signOutBtn: { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  signOutText: { color: "#f87171", fontWeight: "600" },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 24,
    padding: 20, marginBottom: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)"
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#16a34a", alignSelf: "center",
    justifyContent: "center", alignItems: "center", marginBottom: 12
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center" },
  studentId: { color: "#9ca3af", textAlign: "center", marginTop: 4 },
  badge: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12 },
  badgeGreen: { backgroundColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  badgeOrange: { backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)" },
  badgeText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#fff", marginBottom: 12 },
  primaryBtn: { backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "rgba(59,130,246,0.2)", borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(59,130,246,0.3)"
  },
  secondaryBtnText: { color: "#60a5fa", fontWeight: "600" },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)"
  },
  infoLabel: { color: "#9ca3af" },
  infoValue: { color: "#fff", fontWeight: "500" },
  settingBtn: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14,
    padding: 14, marginBottom: 8
  },
  settingBtnText: { color: "#fff" },
});