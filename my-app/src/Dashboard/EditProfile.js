import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

function EditProfile() {

  const studentId = "student1"; // id الطالب في firestore

  const [student, setStudent] = useState({
    name: "",
    position: "",
    goals: "",
    matches: ""
  });

  // جلب البيانات من Firebase
  useEffect(() => {

    const getStudent = async () => {
      const docRef = doc(db, "users", users.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setStudent(docSnap.data());
      }
    };

    getStudent();

  }, []);

  // تغيير القيم
  const handleChange = (e) => {
    setStudent({
      ...student,
      [e.target.name]: e.target.value
    });
  };

  // حفظ التعديلات
  const handleSubmit = async (e) => {
    e.preventDefault();

    const docRef = doc(db, "users", uid);

    await updateDoc(docRef, users);

    alert("Profile Updated Successfully ✅");
  };

  return (
    <div style={{ padding: "30px" }}>

      <h2>Edit Profile ⚽</h2>

      <form onSubmit={handleSubmit}>

        <input
          type="text"
          name="name"
          placeholder="Name"
          value={users.name}
          onChange={handleChange}
        />

        <br /><br />

        {/* <input
          type="text"
          name="position"
          placeholder="Position"
          value={student.position}
          onChange={handleChange}
        /> */}

        <br /><br />

        {/* <input
          type="number"
          name="goals"
          placeholder="Goals"
          value={student.goals}
          onChange={handleChange}
        /> */}

        <br /><br />

        <input
          type="number"
          name="matches"
          placeholder="Matches"
          value={student.matches}
          onChange={handleChange}
        />

        <br /><br />

        <button type="submit">Save Changes</button>

      </form>

    </div>
  );
}

export default EditProfile;