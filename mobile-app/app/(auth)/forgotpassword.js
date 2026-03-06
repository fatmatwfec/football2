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
  ScrollView
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";

const { width } = Dimensions.get("window");

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Done! Check your email for the reset link.");
      setEmail("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        setError("Invalid Email");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require("../../assets/images/background.jpg")}
        style={styles.background}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

            <BlurView intensity={25} tint="light" style={styles.wrapper}>
              <View style={styles.formBox}>
                <Text style={styles.title}>Forgot Password</Text>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Your Email"
                    placeholderTextColor="#fff"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={(text) => setEmail(text)}
                    value={email}
                  />
                  <MaterialIcons name="email" size={18} color="white" style={styles.icon} />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {message ? <Text style={styles.successText}>{message}</Text> : null}

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => router.push("/(auth)/login")}
                >
                  <Text style={styles.linkText}>← Back to Login</Text>
                </TouchableOpacity>

              </View>
            </BlurView>

          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  wrapper: {
    width: 420,
    maxWidth: width * 0.9,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(225, 225, 255, 0.1)",
    overflow: "hidden",
    padding: 30,
  },
  formBox: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
  },
  inputBox: {
    position: "relative",
    width: "100%",
    height: 50,
    marginVertical: 15,
  },
  input: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(225, 225, 255, 0.2)",
    borderRadius: 40,
    color: "#fff",
    paddingHorizontal: 20,
    paddingRight: 50,
  },
  icon: {
    position: "absolute",
    right: 20,
    top: 13,
  },
  errorText: {
    color: "#ffb3b3",
    backgroundColor: "rgba(255, 0, 0, 0.2)",
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
    width: "100%",
    textAlign: "center",
  },
  successText: {
    color: "#b3ffb3",
    backgroundColor: "rgba(0, 255, 0, 0.15)",
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
    width: "100%",
    textAlign: "center",
  },
  button: {
    width: "100%",
    height: 45,
    backgroundColor: "#fff",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
  },
  backLink: {
    marginTop: 20,
  },
  linkText: {
    color: "#fff",
    fontWeight: "600",
    textDecorationLine: "underline",
    fontSize: 14,
  },
});

export default ForgotPassword;