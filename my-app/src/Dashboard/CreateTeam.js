import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
    collection,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc,
    query,
    where,
    getDocs,
    getDoc
} from "firebase/firestore";
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

            // 🔁 loop on codes
            for (let code of codes) {
                if (!code.trim()) continue;

                const q = query(
                    collection(db, "users"),
                    where("studentCode", "==", code)
                );

                const snap = await getDocs(q);
                if (snap.empty) continue;

                const playerDoc = snap.docs[0];
                const playerData = playerDoc.data();

                // ❌ already has team
                if (playerData.hasTeam) continue;

                // ❌ prevent duplicates
                if (memberIds.includes(playerDoc.id)) continue;

                memberIds.push(playerDoc.id);
                members.push(playerData.name);

                // 📩 send invite
                await updateDoc(doc(db, "users", playerDoc.id), {
                    teamRequests: [
                        ...(playerData.teamRequests || []),
                        {
                            teamId: "", // سيتم تحديثه بعد إنشاء الفريق
                            teamName,
                            captainId: user.uid
                        }
                    ]
                });
            }

            // ✅ create team
            const teamRef = await addDoc(collection(db, "teams"), {
                teamName,
                captainId: user.uid,
                captainName: captainData.name,
                category: "General League",
                status: "pending",
                createdAt: serverTimestamp(),
                memberIds,
                members
            });

            // 🔁 update invites with real teamId
            for (let id of memberIds) {
                if (id === user.uid) continue;

                const userRef = doc(db, "users", id);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();

                const updatedRequests = (userData.teamRequests || []).map(req =>
                    req.teamName === teamName ? { ...req, teamId: teamRef.id } : req
                );

                await updateDoc(userRef, { teamRequests: updatedRequests });
            }

            // 🟢 update captain
            await updateDoc(doc(db, "users", user.uid), {
                hasTeam: true,
                teamId: teamRef.id,
                assignedTeam: teamName,
                captainId: user.uid
            });

            alert("Team Created Successfully");
            navigate("/student");
        } catch (err) {
            console.error(err);
            alert("Error creating team");
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
                <input
                    type="text"
                    placeholder="Team Name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full p-3 mb-4 rounded-xl bg-black border border-white/10"
                />

                {/* Player Codes */}
                {codes.map((code, i) => (
                    <input
                        key={i}
                        type="text"
                        placeholder={`Player Code ${i + 1}`}
                        value={code}
                        onChange={(e) => updateCode(i, e.target.value)}
                        className="w-full p-3 mb-2 rounded-xl bg-black border border-white/10"
                    />
                ))}

                <button
                    onClick={addPlayer}
                    className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-xl mb-4"
                >
                    Add Player
                </button>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCreateTeam}
                        disabled={loading}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl"
                    >
                        {loading ? "Creating..." : "Create"}
                    </button>

                    <button
                        onClick={() => navigate("/student")}
                        className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl"
                    >
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    );
};

export default CreateTeam;