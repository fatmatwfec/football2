import React, { useState } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView 
} from "react-native";
import { auth } from "../firebase"; 
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useRouter } from "expo-router";

const ChangePassword = () => {
  const [yourPassword, setYourPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const handleChangePassword = async () => {
  
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters!");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setIsUpdating(true);

    try {
      const user = auth.currentUser;
      // إعادة المصادقة (Re-authentication) مطلوبة في Firebase لتغيير الباسورد
      const credential = EmailAuthProvider.credential(user.email, yourPassword);
      await reauthenticateWithCredential(user, credential);
      
      await updatePassword(user, password);
      
      Alert.alert("Success ✅", "Password updated successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
      
      setYourPassword("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.log(err.code);
      let errorMsg = "Something went wrong";
      
      if (err.code === "auth/too-many-requests") {
        errorMsg = "Too many attempts. Try again later.";
      } else if (err.code === "auth/wrong-password") {
        errorMsg = "Your current password is wrong";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "The new password is too weak";
      }
      
      Alert.alert("Error", errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Header/Navbar */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Change Password</Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Form Container */}
          <View style={styles.card}>
            <Text style={styles.title}>Update Security</Text>
            <Text style={styles.subtitle}>Please enter your current and new password below.</Text>

            {/* Current Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Current Password"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={yourPassword}
                onChangeText={setYourPassword}
              />
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {/* Confirm New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.updateBtn, isUpdating && { opacity: 0.7 }]} 
              onPress={handleChangePassword}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.updateBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617", 
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    paddingVertical: 10,
  },
  backButton: {
    color: "#94a3b8",
    fontSize: 16,
  },
  headerTitle: {
    color: "#10b981", 
    fontSize: 18,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 25,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 15,
    padding: 15,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  updateBtn: {
    backgroundColor: "#10b981",
    borderRadius: 15,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  updateBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default ChangePassword;