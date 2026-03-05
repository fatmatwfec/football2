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
      setError("Please use your university email (ends with .edu.eg)");
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
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode.trim()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { 
        setError("This Student ID is already registered!"); 
        return; 
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await sendEmailVerification(userCredential.user);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        studentCode: studentCode.trim(),
        phone: phone,
        email: email,
        password: password, 
        role: "student",
        uid: userCredential.user.uid,
        hasTeam: false, 
        isVerified: false, 
        createdAt: new Date()
      });

      alert(
        `Registration Successful!\n\n` +
        `A verification link has been sent to: ${email}\n` +
        `Check your inbox or contact the admin for manual activation.`
      );
      navigate("/Login");

    } catch (err) {
      console.error(err.code);
      if (err.code === "auth/email-already-in-use") {
        setError("Email is already in use.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Registration failed. Please try again.");
      }
    }
  };

  return (
    <div className="auth-container"> 
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
            <div className="register-link">
              <p>Already have an account? <span className="login-link" onClick={() => navigate('/Login')} style={{cursor: 'pointer', color: '#bef264', fontWeight: 'bold'}}> Login</span></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;