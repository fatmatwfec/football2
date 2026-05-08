import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, ActivityIndicator, Alert, SafeAreaView
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from "../firebase";
import { updateProfile, updateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dn3bjc1pq/image/upload";
const UPLOAD_PRESET = "FootBall_AddPicture";

const EditProfile = () => {
  const user = auth.currentUser;
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("https://via.placeholder.com/150");
  const [loading, setLoading] = useState(false);
  const [newImage, setNewImage] = useState(null);


  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || "");
          setPhone(data.phone || "");
          setPreview(data.photo || preview);
        }
        setEmail(user.email || "");
      } catch (err) {
        console.log(err);
      }
    };
    fetchData();
  }, [user]);

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission Denied", "اسمح بالوصول للصور");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        const selectedImage = result.assets[0];

        setNewImage(selectedImage.uri);
        setPreview(selectedImage.uri);
      }
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const uploadToCloudinary = async (fileUri) => {
    try {
      const formData = new FormData();

      formData.append("file", {
        uri: fileUri,
        type: "image/*",
        name: "profile.jpg",
      });

      formData.append("upload_preset", UPLOAD_PRESET);

      const res = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.secure_url) {
        throw new Error("Image upload failed");
      }

      return data.secure_url;
    } catch (err) {
      throw err;
    }
  };

  const handleUpdate = async () => {
    if (!user)
      return Alert.alert("Error", "User not logged in");

    setLoading(true);

    try {

      let imageUrl = preview;

      if (newImage) {
        imageUrl = await uploadToCloudinary(newImage);
      }

      await updateProfile(user, { displayName: name, photoURL: imageUrl });

      if (email !== user.email) {
        try {
          await updateEmail(user, email);
        } catch (e) {
          Alert.alert(
            "Email Update Failed",
            "محتاج تسجل دخول تاني قبل تغيير الإيميل"
          );
        }
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { name, phone, photo: imageUrl });

      Alert.alert("Success", "✅ Profile updated successfully!");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Update Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SCI-FOOTBALL</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Edit Profile</Text>

        {/* Profile Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: preview || "https://via.placeholder.com/150" }} style={styles.profileImage} />
          <TouchableOpacity style={styles.cameraIcon} onPress={pickImage}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Inputs */}
        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="example@edu.eg"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="01xxxxxxxxx"
            placeholderTextColor="#999"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && { opacity: 0.7 }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.2)'
  },
  headerTitle: { color: '#10b981', fontSize: 20, fontWeight: 'bold' },
  backButton: { color: 'white', fontSize: 16 },
  scrollContent: { padding: 20, alignItems: 'center' },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  imageContainer: { position: 'relative', marginBottom: 30 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#fff' },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f172a'
  },
  form: { w: '100%', width: '100%' },
  label: { color: '#cbd5e1', marginBottom: 8, fontSize: 14, marginLeft: 5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    color: 'white',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  saveButton: {
    backgroundColor: '#10b981',
    width: '100%',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10
  },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});

export default EditProfile;