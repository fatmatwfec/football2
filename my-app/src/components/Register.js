import { auth, db } from "../firebase"; 
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaPhoneAlt, FaLock, FaEnvelope } from "react-icons/fa";
import '../index.css';

function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); 
  const [studentCode, setStudentCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.endsWith("edu.eg")) {
      setError("Only Cairo University emails (edu.eg) are allowed.");
      return;
    }

    if (password !== confirmPassword) { setError("Passwords mismatch!"); return; }
    
      if (phone.length < 11) {
      setError("Please enter a valid phone number.");
      return;
    }

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { setError("Student ID already exists!"); return; }

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

alert(
  `A verification link has been sent to: ${email}\n\n` +
  `Please check your university inbox and click the link to activate your account.\n` +
  `Check your Spam/Junk folder if you don't see it.`
);
      navigate("/Login");
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
    <div className="wrapper register-wrapper">
      <div className="form-box register">
        <form onSubmit={handleRegister}>
          <h1>Registration</h1>
          <div className="input-box">
            <input type="text" placeholder="Full Name" required onChange={(e) => setName(e.target.value)} />
            <FaUser className="icon" />
          </div>
          <div className="input-box">
            <input type="email" placeholder="University Email" required onChange={(e) => setEmail(e.target.value)} />
            <FaEnvelope className="icon" />
          </div>
          <div className="input-box">
            <input type="text" placeholder="Student ID" required onChange={(e) => setStudentCode(e.target.value)} />
            <FaUser className="icon" />
          </div>
          <div className="input-box">
            <input type="text" placeholder="Phone Number" required onChange={(e) => setPhone(e.target.value)} />
            <FaPhoneAlt className="icon" />
          </div>
          <div className="input-box">
            <input type="password" placeholder="Password" required onChange={(e) => setPassword(e.target.value)} />
            <FaLock className="icon" />
          </div>
          <div className="input-box">
            <input type="password" placeholder="Confirm Password" required onChange={(e) => setConfirmPassword(e.target.value)} />
            <FaLock className="icon" />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit">Register</button>
          <div className="register-link"><p>Have an account? <a href="#" onClick={() => navigate('/Login')}>Login</a></p></div>
        </form>
      </div>
    </div>
  );
}
export default Register;