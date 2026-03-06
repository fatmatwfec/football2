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
import { useRouter, Stack } from "expo-router";
import { BlurView } from "expo-blur";
import { FontAwesome5 } from "@expo/vector-icons";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const { width } = Dimensions.get("window");

const Login = () => {
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async () => {
    setError("");

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("This Student ID is not registered.");
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        setError("Please verify your university email first.");
        await signOut(auth);
        return;
      }

      if (userData.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }

    } catch (err) {
      console.error(err.code);
      setError("Invalid ID or Password.");
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
                <Text style={styles.title}>Login</Text>

                {/* Student ID */}
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Student ID"
                    placeholderTextColor="#fff"
                    onChangeText={(text) => setStudentCode(text)}
                    value={studentCode}
                  />
                  <FontAwesome5 name="user" size={18} color="white" style={styles.icon} />
                </View>

                {/* Password */}
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#fff"
                    secureTextEntry
                    onChangeText={(text) => setPassword(text)}
                    value={password}
                  />
                  <FontAwesome5 name="lock" size={18} color="white" style={styles.icon} />
                </View>

                {/* Forget Password - outside inputBox */}
                <TouchableOpacity 
                  style={styles.forgetPasswordContainer}
                  onPress={() => router.push("/(auth)/forgotpassword")}
                >
                  <Text style={styles.forgetPassword}>Forget Password ?</Text>
                </TouchableOpacity>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                  <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>

                <View style={styles.registerLink}>
                  <Text style={styles.whiteText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() =>router.push("/(auth)/register")}>
                    <Text style={styles.linkText}>Register</Text>
                  </TouchableOpacity>
                </View>
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
    fontSize: 36,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
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
  forgetPasswordContainer: {
    width: "100%",
    alignItems: "flex-end",
    marginTop: -5,
    marginBottom: 5,
  },
  forgetPassword: {
    color: "#b2b9dc",
    fontSize: 13,
    fontStyle: "italic",
    marginRight: 10,
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
  button: {
    width: "100%",
    height: 45,
    backgroundColor: "#fff",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },
  buttonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerLink: {
    flexDirection: "row",
    marginTop: 20,
  },
  whiteText: {
    color: "#fff",
    fontSize: 14.5,
  },
  linkText: {
    color: "#fff",
    fontWeight: "600",
    textDecorationLine: "underline",
  }
});

export default Login;