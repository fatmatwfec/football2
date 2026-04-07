import React, { useState } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTeam = () => {
    const [teamName, setTeamName] = useState("");
    const [codes, setCodes] = useState([""]); // student codes
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // ➕ add player input
    const addPlayer = () => setCodes([...codes, ""]);

    // ✏️ update code
    const updateCode = (index, value) => {
        const newCodes = [...codes];
        newCodes[index] = value;
        setCodes(newCodes);
    };

    const handleCreateTeam = async () => {
        if (!teamName.trim()) return alert("Enter team name");
        const filteredCodes = codes.filter(c => c.trim() !== "");
        if (filteredCodes.length === 0) return alert("Please add at least one player code");
        if (filteredCodes.length === 6) return alert("The maximum number For Teams is 7 players");

        setLoading(true);

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User not authenticated");

            // 🟢 get captain data
            const captainDoc = await getDoc(doc(db, "users", user.uid));
            const captainData = captainDoc.data();

            if (!captainData) throw new Error("Captain data not found");

            // 🔍 check team name uniqueness
            const nameQuery = query(
                collection(db, "teams"),
                where("teamName", "==", teamName)
            );
            const nameSnap = await getDocs(nameQuery);
            if (!nameSnap.empty) {
                setLoading(false);
                return alert("Team name already exists");
            }

            // 🟢 prepare arrays
            const memberIds = [user.uid];
            const members = [captainData.name];
            const playersToInvite = [];

            // 🔁 loop on codes for VALIDATION first
            for (let inputCode of filteredCodes) {
                console.log("Checking code:", inputCode);


                const usersRef = collection(db, "users");
                let snap = await getDocs(query(usersRef, where("studentCode", "==", inputCode)));

                if (snap.empty && !isNaN(inputCode)) {
                    snap = await getDocs(query(usersRef, where("studentCode", "==", Number(inputCode))));
                }
                // 1️⃣ التأكد إن الطالب موجود في الداتا
                if (snap.empty) {
                    setLoading(false);
                    return alert(`The student code "${inputCode}" does not exist in our records.`);
                }

                const playerDoc = snap.docs[0];
                const playerData = playerDoc.data();

                // 2️⃣ التأكد إن الطالب مش في فريق تاني
                if (playerData.hasTeam) {
                    setLoading(false);
                    return alert(`The student "${playerData.name}" (Code: ${inputCode}) is already in another team.`);
                }

                // 3️⃣ منع التكرار في نفس القائمة
                if (memberIds.includes(playerDoc.id)) continue;// {
                // setLoading(false);
                //return alert(`Student "${playerData.name}" is repeated in your list.`);
                // }

                memberIds.push(playerDoc.id);
                members.push(playerData.name);
                playersToInvite.push({ id: playerDoc.id, data: playerData });
            }

            // ✅ 1. Create the team first
            const teamRef = await addDoc(collection(db, "teams"), {
                teamName: teamName.trim(),
                captainId: user.uid,
                captainName: captainData.name,
                category: "General League",
                status: "pending",
                createdAt: serverTimestamp(),
                memberIds,
                members
            });

            // 📩 2. Send Invites to validated players
            for (let player of playersToInvite) {
                await updateDoc(doc(db, "users", player.id), {
                    teamRequests: [
                        ...(player.data.teamRequests || []),
                        {
                            teamId: teamRef.id,
                            teamName,
                            captainId: user.uid
                        }
                    ]
                });
            }

            // 🟢 3. Update captain status
            await updateDoc(doc(db, "users", user.uid), {
                hasTeam: true,
                teamId: teamRef.id,
                assignedTeam: teamName,
                captainId: user.uid
            });

            alert("Team Created Successfully! Invites sent to players.");
            navigate("/student");
        } catch (err) {
            console.error(err);
            alert("Error creating team: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex items-center justify-center">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-xl">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text">
                    Create Your Team
                </h2>

                {/* Team Name */}
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-1 px-1">TEAM NAME</label>
                    <input
                        type="text"
                        placeholder="Enter team name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full p-3 rounded-xl bg-black border border-white/10 focus:border-green-500 transition-colors outline-none"
                    />
                </div>

                {/* Player Codes */}
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-1 px-1">PLAYER CODES</label>
                    {codes.map((code, i) => (
                        <input
                            key={i}
                            type="text"
                            placeholder={`Student Code ${i + 1}`}
                            value={code}
                            onChange={(e) => updateCode(i, e.target.value)}
                            className="w-full p-3 mb-2 rounded-xl bg-black border border-white/10 focus:border-blue-500 transition-colors outline-none"
                        />
                    ))}
                </div>

                <button
                    onClick={addPlayer}
                    className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-xl mb-6 text-sm font-medium transition-all"
                >
                    + Add More Player Slots
                </button>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCreateTeam}
                        disabled={loading}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-green-500/20"
                    >
                        {loading ? "Validating..." : "Create Team"}
                    </button>

                    <button
                        onClick={() => navigate("/student")}
                        className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl border border-white/10 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTeam;