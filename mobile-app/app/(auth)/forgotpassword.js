import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";

const { width, height } = Dimensions.get("window");

const Field = React.memo(({
  label,
  placeholder,
  iconName,
  iconLib = "fa",
  value,
  onChangeText,
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
        autoCapitalize="none"
        keyboardType="email-address"
        blurOnSubmit={false}
        autoCorrect={false}
      />
    </View>
  </View>
));

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    setMessage("");
    setError("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Reset link sent! Check your email 📩");
      setEmail("");
    } catch (err) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        setError("Invalid email.");
      } else {
        setError("Something went wrong.");
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
        <View style={[styles.blob, styles.blobTopLeft]} />
        <View style={[styles.blob, styles.blobBottomRight]} />
        <View style={[styles.blob, styles.blobCenter]} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="always"
          >
            <View style={styles.card}>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconBadge}>
                  <FontAwesome5 name="key" size={22} color="#00FF9C" />
                </View>
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>Reset your account password</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <Field
                  label="Email"
                  placeholder="Enter your email"
                  iconName="email"
                  iconLib="mi"
                  value={email}
                  onChangeText={setEmail}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {message ? <Text style={styles.success}>{message}</Text> : null}

                <TouchableOpacity
                  style={[styles.btn, loading && { opacity: 0.6 }]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.btnText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.link}>← Back to Login</Text>
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#060d14" },

  blob: { position: "absolute", borderRadius: 999 },
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#111820",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },

  header: {
    alignItems: "center",
    padding: 20,
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
    marginBottom: 10,
  },

  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 13 },

  form: { padding: 20, gap: 12 },

  fieldGroup: { gap: 5 },
  label: { color: "#d1d5db", fontSize: 13 },

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

  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#fff" },

  btn: {
    backgroundColor: "#00FF9C",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },

  btnText: { color: "#000", fontWeight: "bold" },

  link: {
    color: "#00FF9C",
    textAlign: "center",
    marginTop: 15,
    fontWeight: "600",
  },

  error: { color: "#f87171", textAlign: "center" },
  success: { color: "#4ade80", textAlign: "center" },
});