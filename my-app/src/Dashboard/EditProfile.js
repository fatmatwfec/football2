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

  // تحميل بيانات المستخدم
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

  // اختيار صورة جديدة
  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // رفع الصورة على Cloudinary
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

  // حفظ البيانات
  const handleUpdate = async () => {
    if (!user) return alert("User not logged in");
    setLoading(true);

    try {
      // رفع الصورة لو موجودة
      let imageUrl = preview;
      if (image) {
        imageUrl = await uploadToCloudinary(image);
      }

      // تحديث الاسم والصورة في Auth
      await updateProfile(user, {
        displayName: name,
        photoURL: imageUrl,
      });

      // تحديث الإيميل
      if (email !== user.email) {
        await updateEmail(user, email);
      }

      // تحديث Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { name, phone, photo: imageUrl });

      alert("✅ Profile updated successfully!");
      navigate("/student"); // ارجاع للـ Dashboard
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 px-4">

      {/* Navbar */}
      <nav className="w-full border-b border-white/20 backdrop-blur-lg bg-white/5 fixed top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-700 text-transparent bg-clip-text">
            SCI-FOOTBALL
          </h1>
          <button
            onClick={() => navigate("/student")}
            className="bg-blue-600/20 hover:bg-blue-600/40 px-4 py-2 rounded-full transition text-white font-medium"
          >
            Back
          </button>
        </div>
      </nav>

      {/* Form */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-xl text-center mt-20">

        <h2 className="text-white text-2xl font-bold mb-4">
          Edit Profile
        </h2>

        {/* صورة البروفايل */}
        <div className="relative w-fit mx-auto">
          <img
            src={preview}
            alt="profile"
            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
          />
          <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer">
            +
            <input
              type="file"
              className="hidden"
              onChange={handleImageChange}
            />
          </label>
        </div>

        <div className="space-y-5 mt-6 text-left">
          {/* الاسم */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-4 pl-12 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-green-200 outline-none focus:border-green-500/50 focus:bg-white/15 transition-all shadow-inner"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">👤</span>
            </div>
          </div>

          {/* الإيميل */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@edu.eg"
                className="w-full p-4 pl-12 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-green-500/50 focus:bg-white/15 transition-all shadow-inner"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">📧</span>
            </div>
          </div>

          {/* رقم الموبايل */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 ml-1">Phone Number</label>
            <div className="relative">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full p-4 pl-12 rounded-2xl bg-white/10 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-green-500/50 focus:bg-white/15 transition-all shadow-inner"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">📞</span>
            </div>
          </div>
        </div>

        {/* زرار حفظ */}
        <button
          onClick={handleUpdate}
          disabled={loading}
          className={`mt-6 w-full py-3 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>

      </div>
    </div>
  );
};

export default EditProfile;