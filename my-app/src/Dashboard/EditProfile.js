import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { updateProfile, updateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dn3bjc1pq/image/upload";
const UPLOAD_PRESET = "FootBall_AddPicture";

const EditProfile = () => {
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("https://via.placeholder.com/150");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({});

  // تحميل البيانات
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "");
        setPhone(data.phone || "");
        setPreview(data.photo || preview);
      }

      setEmail(user.email || "");
    };

    fetchData();
  }, [user]);

  // اختيار صورة
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // رفع الصورة
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return data.secure_url;
  };

  // Validation
  const validate = () => {
    let newErrors = {};

    if (name.trim() === "") {
      newErrors.name = "Name cannot be empty";
    }

    if (email.trim() === "") {
      newErrors.email = "Email cannot be empty";
    }

    if (phone.trim() === "") {
      newErrors.phone = "Phone cannot be empty";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // حفظ البيانات
  const handleUpdate = async () => {
    if (!user) return alert("User not logged in");

    if (!validate()) return;

    setLoading(true);

    try {
      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);

      if (!snap.exists()) return;

      const oldData = snap.data();

      // fallback للقيم القديمة
      const updatedName = name.trim() === "" ? oldData.name : name;
      const updatedPhone = phone.trim() === "" ? oldData.phone : phone;
      const updatedEmail = email.trim() === "" ? user.email : email;

      let imageUrl = oldData.photo;
      if (image) {
        imageUrl = await uploadToCloudinary(image);
      }

      // Auth
      await updateProfile(user, {
        displayName: updatedName,
        photoURL: imageUrl,
      });

      if (updatedEmail !== user.email) {
        await updateEmail(user, updatedEmail);
      }

      // Firestore
      await updateDoc(docRef, {
        name: updatedName,
        phone: updatedPhone,
        photo: imageUrl,
      });

      alert("Profile updated successfully!");
      navigate("/student");

    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading;

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-black-900 to-slate-800 px-4">

      {/* Navbar */}
      <nav className="w-full border-b border-white/20 backdrop-blur-lg bg-white/5 fixed top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold text-white">SCI-FOOTBALL</h1>
          <button
            onClick={() => navigate("/student")}
            className="bg-blue-600/20 hover:bg-green-800/40 px-4 py-2 rounded-full text-white"
          >
            Back
          </button>
        </div>
      </nav>

      {/* Form */}
      <div className="w-full max-w-md bg-white/10 p-8 rounded-3xl mt-20">

        <h2 className="text-white text-2xl font-bold mb-4 text-center">
          Edit Profile
        </h2>

        {/* الصورة */}
        <div className="relative w-fit mx-auto">
          <img
            src={preview}
            alt="profile"
            className="w-32 h-32 rounded-full"
          />
          <label className="absolute bottom-0 right-0 bg-green-800 p-2 rounded-full cursor-pointer text-white">
            +
            <input type="file" className="hidden" onChange={handleImageChange} />
          </label>
        </div>

        <div className="space-y-4 mt-6">

          {/* Name */}
          <div>
            <input
              type="text"
              value={name}
              placeholder="Name"
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded bg-white/10 text-white"
            />
            {errors.name && <p className="text-red-400 text-sm">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <input
              type="email"
              value={email}
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded bg-white/10 text-white"
            />
            {errors.email && <p className="text-red-400 text-sm">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <input
              type="text"
              value={phone}
              placeholder="Phone"
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 rounded bg-white/10 text-white"
            />
            {errors.phone && <p className="text-red-400 text-sm">{errors.phone}</p>}
          </div>

        </div>

        <button
          onClick={handleUpdate}
          disabled={isDisabled}
          className={`mt-6 w-full py-3 rounded bg-green-800 text-white ${isDisabled ? "opacity-50" : ""
            }`}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>

      </div>
    </div>
  );
};

export default EditProfile;