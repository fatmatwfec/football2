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
  Alert 
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { auth, db } from "../../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, query, collection, where, getDocs } from "firebase/firestore";

const { width } = Dimensions.get("window");

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");

    if (!email.endsWith("edu.eg")) {
      setError("Invalid Email");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords mismatch!");
      return;
    }

    if (phone.length < 11) {
      setError("Please enter a valid phone number.");
      return;
    }

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setError("Student ID already exists!");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        studentCode,
        phone,
        email,
        role: "student",
        uid: userCredential.user.uid,
        createdAt: new Date()
      });

      Alert.alert(
        "Verification Sent",
        `A verification link has been sent to: ${email}\n\nPlease check your university inbox and click the link to activate your account.`,
        [{ text: "OK", onPress: () => router.push("/(auth)/login") }]
      );

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This Student Code is already registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Registration failed. Please try again.");
      }
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
                <Text style={styles.title}>Registration</Text>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Name"
                    placeholderTextColor="#fff"
                    onChangeText={setName}
                  />
                  <FontAwesome5 name="user" size={16} color="white" style={styles.icon} />
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="University Email"
                    placeholderTextColor="#fff"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={setEmail}
                  />
                  <MaterialIcons name="email" size={18} color="white" style={styles.icon} />
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Student ID"
                    placeholderTextColor="#fff"
                    onChangeText={setStudentCode}
                  />
                  <FontAwesome5 name="id-card" size={16} color="white" style={styles.icon} />
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    placeholderTextColor="#fff"
                    keyboardType="phone-pad"
                    onChangeText={setPhone}
                  />
                  <FontAwesome5 name="phone-alt" size={16} color="white" style={styles.icon} />
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#fff"
                    secureTextEntry
                    onChangeText={setPassword}
                  />
                  <FontAwesome5 name="lock" size={16} color="white" style={styles.icon} />
                </View>

                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#fff"
                    secureTextEntry
                    onChangeText={setConfirmPassword}
                  />
                  <FontAwesome5 name="lock" size={16} color="white" style={styles.icon} />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.button} onPress={handleRegister}>
                  <Text style={styles.buttonText}>Register</Text>
                </TouchableOpacity>

                <View style={styles.loginLink}>
                  <Text style={styles.whiteText}>Have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                    <Text style={styles.linkText}>Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>

          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  wrapper: {
    width: 420,
    maxWidth: width * 0.9,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(225, 225, 255, 0.1)",
    overflow: "hidden",
    padding: 25,
  },
  formBox: { width: "100%", alignItems: "center" },
  title: { fontSize: 28, color: "#fff", fontWeight: "bold", marginBottom: 20 },
  inputBox: { position: "relative", width: "100%", height: 48, marginVertical: 10 },
  input: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(225, 225, 255, 0.2)",
    borderRadius: 40,
    color: "#fff",
    paddingHorizontal: 20,
    paddingRight: 45,
  },
  icon: { position: "absolute", right: 18, top: 14 },
  errorText: { color: "#ffb3b3", backgroundColor: "rgba(255, 0, 0, 0.2)",
     padding: 8, borderRadius: 10, marginVertical: 10, width: "100%", textAlign: "center", fontSize: 13 },
  button: {
    width: "100%",
    height: 45,
    backgroundColor: "#fff",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#333", fontSize: 16, fontWeight: "bold" },
  loginLink: { flexDirection: "row", marginTop: 20 },
  whiteText: { color: "#fff", fontSize: 14 },
  linkText: { color: "#fff", fontWeight: "600", textDecorationLine: "underline" }
});