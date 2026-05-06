import React, { useState } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ImageBackground, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const { width, height } = Dimensions.get("window");

const Login = () => {
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState("student");
  const router = useRouter();

  const handleSubmit = async () => {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("This Student ID is not registered.");
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;
      const userRole = userData.role;

      if (userType === "admin" && userRole !== "admin") {
        setError("Access denied. This ID is not associated with an admin account.");
        setLoading(false);
        return;
      }

      if (userType === "student" && userRole !== "student") {
        setError("Access denied. This is an admin account. Please use the Admin tab.");
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
      const user = userCredential.user;
      const isManuallyVerified = userData.isVerified === true;

      if (!user.emailVerified && !isManuallyVerified) {
              setError("Please verify your university email or contact admin for manual activation.");
              await signOut(auth);
              return;
            }

  
if (userData.role === "admin") {
  router.replace("/(tabs)/admin");
} else {
  router.replace("/(tabs)");
}
    } catch (err) {
      console.error(err.code);
      setError("Invalid ID or Password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#060d14" />

      <View style={styles.background}>
        {/* Glow blobs */}
        <View style={[styles.blob, styles.blobTopLeft]} />
        <View style={[styles.blob, styles.blobBottomRight]} />
        <View style={[styles.blob, styles.blobCenter]} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoText}>SFC</Text>
                </View>
                <Text style={styles.title}>Sign in to your account</Text>
              </View>

              {/* Toggle */}
              <View style={styles.toggleContainer}>
                <View style={styles.toggleWrapper}>
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => { setUserType("student"); setError(""); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.toggleInner, userType === "student" && styles.toggleActiveInner]}>
                      <FontAwesome5 name="graduation-cap" size={13} color={userType === "student" ? "#000" : "#fff"} />
                      <Text style={[styles.toggleText, userType === "student" && styles.toggleTextActive]}>Student</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => { setUserType("admin"); setError(""); }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.toggleInner, userType === "admin" && styles.toggleActiveInner]}>
                      <FontAwesome5 name="shield-alt" size={13} color={userType === "admin" ? "#000" : "#fff"} />
                      <Text style={[styles.toggleText, userType === "admin" && styles.toggleTextActive]}>Admin</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Form */}
              <View style={styles.form}>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{userType === "student" ? "Student ID" : "Admin ID"}</Text>
                  <View style={styles.inputWrapper}>
                    <FontAwesome5
                      name={userType === "student" ? "graduation-cap" : "shield-alt"}
                      size={13} color="#6b7280" style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={userType === "student" ? "Enter your student ID" : "Enter your admin ID"}
                      placeholderTextColor="#4b5563"
                      onChangeText={setStudentCode}
                      value={studentCode}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <FontAwesome5 name="lock" size={13} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor="#4b5563"
                      secureTextEntry
                      onChangeText={setPassword}
                      value={password}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.forgotContainer} onPress={() => router.push("/(auth)/forgotpassword")}>
                  <Text style={styles.forgotText}>Forgot password ?</Text>
                </TouchableOpacity>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#000" />
                      <Text style={styles.submitText}>Signing in...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitText}>Sign In as {userType === "student" ? "Student" : "Admin"}</Text>
                  )}
                </TouchableOpacity>

                {userType === "student" && (
                  <View style={styles.bottomRow}>
                    <Text style={styles.bottomText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                      <Text style={styles.linkText}>Sign up</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {userType === "admin" && (
                  <Text style={styles.adminNote}>Admin accounts are created by system administrators only</Text>
                )}
              </View>
            </View>

            <Text style={styles.footer}>Secure login powered by University Authentication System</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  background: {
    flex: 1,
    backgroundColor: "#060d14",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobTopLeft: {
    top: 60,
    left: -60,
    width: 260,
    height: 260,
    backgroundColor: "rgba(0,255,156,0.06)",
  },
  blobBottomRight: {
    bottom: 60,
    right: -60,
    width: 300,
    height: 300,
    backgroundColor: "rgba(59,130,246,0.06)",
  },
  blobCenter: {
    top: height * 0.35,
    left: width / 2 - 180,
    width: 360,
    height: 360,
    backgroundColor: "rgba(0,255,156,0.03)",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111820",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#00FF9C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoText: { color: "#000", fontWeight: "900", fontSize: 20, letterSpacing: 1 },
  title: { fontSize: 17, color: "#fff", fontWeight: "600", textAlign: "center" },
  toggleContainer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  toggleWrapper: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 4,
    gap: 4,
  },
  toggleBtn: { flex: 1 },
  toggleInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  toggleActiveInner: { backgroundColor: "#00FF9C" },
  toggleText: { color: "#fff", fontWeight: "500", fontSize: 14 },
  toggleTextActive: { color: "#000", fontWeight: "700" },
  form: { paddingHorizontal: 22, paddingBottom: 26, paddingTop: 8, gap: 13 },
  fieldGroup: { gap: 5 },
  label: { color: "#d1d5db", fontSize: 13, fontWeight: "500" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 14 },
  forgotContainer: { alignItems: "flex-end", marginTop: -2 },
  forgotText: { color: "#9ca3af", fontSize: 13 },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: "#f87171", fontSize: 13, textAlign: "center" },
  submitBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: "#00FF9C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  submitBtnDisabled: { opacity: 0.6 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: { color: "#000", fontWeight: "700", fontSize: 15 },
  bottomRow: { flexDirection: "row", justifyContent: "center", marginTop: 2 },
  bottomText: { color: "#9ca3af", fontSize: 13 },
  linkText: { color: "#00FF9C", fontSize: 13, fontWeight: "600" },
  adminNote: { color: "#6b7280", fontSize: 12, textAlign: "center" },
  footer: { color: "#374151", fontSize: 12, textAlign: "center", marginTop: 18 },
});

export default Login;