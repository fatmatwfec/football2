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
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { auth, db } from "../../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, query, collection, where, getDocs } from "firebase/firestore";

const { width, height } = Dimensions.get("window");

const Field = React.memo(({
  label,
  placeholder,
  iconName,
  iconLib = "fa",
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      <View style={styles.inputIcon}>
        {iconLib === "mi"
          ? <MaterialIcons name={iconName} size={16} color="#6b7280" />
          : <FontAwesome5 name={iconName} size={13} color="#6b7280" />
        }
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#4b5563"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "sentences"}
        blurOnSubmit={false}
        autoCorrect={false}
      />
    </View>
  </View>
));

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    setLoading(true);

    if (!email.endsWith("edu.eg")) {
      setError("Invalid Email");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Passwords mismatch!");
      setLoading(false);
      return;
    }

    if (phone.length !== 11) {
      setError("Please enter a valid phone number.");
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode.trim()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setError("Student ID already exists!");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        studentCode: studentCode.trim(),
        phone,
        email,
        role: "student",
        uid: userCredential.user.uid,
        hasTeam: false,
        isVerified: false,
        createdAt: new Date(),
      });

      Alert.alert(
        "Verification Sent",
        `A verification link has been sent to: ${email}\n\nPlease check your university inbox and click the link to activate your account.`,
        [{ text: "OK", onPress: () => router.push("/(auth)/login") }]
      );
    } catch (err) {
      console.error(err.code);
      if (err.code === "auth/email-already-in-use") {
        setError("This Student Code is already registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Registration failed. Please try again.");
      }
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
                <View style={styles.iconBadge}>
                  <FontAwesome5 name="user" size={22} color="#00FF9C" />
                </View>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join the Science FC Championship</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <Field
                  label="Full Name"
                  placeholder="Enter your full name"
                  iconName="user"
                  value={name}
                  onChangeText={setName}
                />
                <Field
                  label="University Email"
                  placeholder="your.name@edu.eg"
                  iconName="email"
                  iconLib="mi"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Student ID"
                  placeholder="Enter your student ID"
                  iconName="id-card"
                  value={studentCode}
                  onChangeText={setStudentCode}
                  autoCapitalize="none"
                />
                <Field
                  label="Phone Number"
                  placeholder="01XXXXXXXXX"
                  iconName="phone-alt"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <Field
                  label="Password"
                  placeholder="Create a password (min. 6 characters)"
                  iconName="lock"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <Field
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  iconName="lock"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleRegister}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#000" />
                      <Text style={styles.submitText}>Creating Account...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.bottomRow}>
                  <Text style={styles.bottomText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                    <Text style={styles.linkText}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>
                  By registering, you agree to our terms and conditions
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

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
    top: height * 0.4,
    left: width / 2 - 180,
    width: 360,
    height: 360,
    backgroundColor: "rgba(0,255,156,0.03)",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: "100%",
    maxWidth: 440,
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
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(0,255,156,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,255,156,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 20, color: "#fff", fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#9ca3af" },
  form: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20, gap: 13 },
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
    height: 48,
  },
  inputIcon: { marginRight: 10, width: 18, alignItems: "center" },
  input: { flex: 1, color: "#fff", fontSize: 14 },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: "#f87171", fontSize: 13, textAlign: "center" },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#00FF9C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitText: { color: "#000", fontWeight: "700", fontSize: 15 },
  bottomRow: { flexDirection: "row", justifyContent: "center", marginTop: 2 },
  bottomText: { color: "#9ca3af", fontSize: 13 },
  linkText: { color: "#00FF9C", fontSize: 13, fontWeight: "600" },
  cardFooter: { paddingHorizontal: 24, paddingBottom: 24, alignItems: "center" },
  cardFooterText: { color: "#4b5563", fontSize: 12, textAlign: "center" },
});