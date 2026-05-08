import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs, getDoc, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTeam = () => {
    const [teamName, setTeamName] = useState("");
    const [nameExists, setNameExists] = useState(false);

    const [codes, setCodes] = useState([""]);
    const [suggestions, setSuggestions] = useState({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // ✅ debounce helper
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    // ✅ check team name uniqueness
    const checkTeamName = debounce(async (name) => {
        if (!name.trim()) return setNameExists(false);

        const q = query(collection(db, "teams"), where("teamName", "==", name));
        const snap = await getDocs(q);

        setNameExists(!snap.empty);
    }, 500);

    const debouncedCheckName = debounce(checkTeamName, 500);

    // ✅ add player (max 7)
    const addPlayer = () => {
        if (codes.length >= 6) return alert("Max 7 players allowed");
        setCodes([...codes, ""]);
    };

    // ✅ remove player
    const removePlayer = (index) => {
        const newCodes = codes.filter((_, i) => i !== index);
        setCodes(newCodes);

        const newSuggestions = { ...suggestions };
        delete newSuggestions[index];
        setSuggestions(newSuggestions);
    };

    // ✅ update code
    const updateCode = (index, value) => {
        const newCodes = [...codes];
        newCodes[index] = value;
        setCodes(newCodes);

        fetchSuggestions(index, value);
    };

    // ✅ fetch suggestions per input
    const fetchSuggestions = debounce(async (index, value) => {
        if (!value) {
            setSuggestions(prev => ({ ...prev, [index]: [] }));
            return;
        }

        const usersRef = collection(db, "users");
        const snapshot = await getDocs(query(usersRef, limit(20)));

        const results = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(user =>
                (
                    user.name?.toLowerCase().includes(value.toLowerCase()) ||
                    user.studentCode?.toString().includes(value)
                )
                && user.role !== "admin" && !user.hasTeam
            );

        setSuggestions(prev => ({ ...prev, [index]: results }));
    }, 400);

    // ✅ create team
    const handleCreateTeam = async () => {
        if (!teamName.trim()) return alert("Enter team name");
        if (nameExists) return alert("Team name already exists");

        const filteredCodes = codes.filter(c => c.trim() !== "");
        if (filteredCodes.length < 4)
            return alert("You must add at least 4 more players (Total 5 including yourself) to create a team.");

        if (filteredCodes.length > 6)
            return alert("Max 7 players allowed");

        const uniqueCodes = new Set(filteredCodes);
        if (uniqueCodes.size !== filteredCodes.length)
            return alert("Duplicate student codes are not allowed");


        setLoading(true);

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User not authenticated");

            const captainDoc = await getDoc(doc(db, "users", user.uid));
            const captainData = captainDoc.data();
            if (!captainData) throw new Error("Captain data not found");

            const memberIds = [user.uid];
            const members = [captainData.name];
            const playersToInvite = [];

            for (let inputCode of filteredCodes) {
                const usersRef = collection(db, "users");

                let snap = await getDocs(
                    query(usersRef, where("studentCode", "==", inputCode))
                );

                if (snap.empty && !isNaN(inputCode)) {
                    snap = await getDocs(
                        query(usersRef, where("studentCode", "==", Number(inputCode)))
                    );
                }

                if (snap.empty) {
                    setLoading(false);
                    return alert(`Code "${inputCode}" not found`);
                }

                const playerDoc = snap.docs[0];
                const playerData = playerDoc.data();

                if (playerData.hasTeam) {
                    setLoading(false);
                    return alert(`${playerData.name} already in a team`);
                }


                // ❌ منع الأدمن
                if (playerData.role === "admin") {
                    setLoading(false);
                    return alert(`"${playerData.name}" is an admin and cannot join a team`);
                }

                if (memberIds.includes(playerDoc.id)) continue;

                memberIds.push(playerDoc.id);
                members.push(playerData.name);
                playersToInvite.push({ id: playerDoc.id, data: playerData });
            }

            // ✅ create team
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

            // ✅ send invites
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

            // ✅ update captain
            await updateDoc(doc(db, "users", user.uid), {
                hasTeam: true,
                teamId: teamRef.id,
                assignedTeam: teamName,
                captainId: user.uid
            });

            alert("Team created successfully!");
            navigate("/student");

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-screen bg-black text-white flex items-center justify-center">
            <div className="p-8 w-full max-w-md bg-white/5 rounded-2xl">

                <h2 className="text-xl mb-4">Create Your Team</h2>

                {/* Team Name */}
                <input
                    type="text"
                    placeholder="Enter Team Name"
                    value={teamName}
                    onChange={(e) => {
                        setTeamName(e.target.value);
                        debouncedCheckName(e.target.value);
                    }}
                    className="w-full p-3 mb-2 bg-black border rounded"
                />

                {nameExists && (
                    <p className="text-red-500 text-sm">
                        Team name already exists
                    </p>
                )}

                {/* Players */}
                {codes.map((code, i) => (
                    <div key={i} className="mb-3">

                        <div className="flex gap-2">
                            <input type="text" placeholder={`Player ${i + 1}`} value={code} onChange={(e) => updateCode(i, e.target.value)}
                                className="w-full p-3 bg-black border rounded"
                            />

                            {codes.length > 1 && (
                                <button
                                    onClick={() => removePlayer(i)}
                                    className="bg-red-500 px-3 rounded"
                                >
                                    X
                                </button>
                            )}
                        </div>

                        {/* Suggestions */}
                        {suggestions[i]?.length > 0 && (
                            <div className="bg-gray-900 mt-1 rounded max-h-32 overflow-y-auto">
                                {suggestions[i].map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            updateCode(i, s.studentCode);
                                            setSuggestions(prev => ({
                                                ...prev,
                                                [i]: []
                                            }));
                                        }}
                                        className="p-2 hover:bg-gray-700 cursor-pointer"
                                    >
                                        {s.name} ({s.studentCode})
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                <button
                    onClick={addPlayer}
                    className="w-full bg-gray-700 py-2 mb-4 rounded"
                >
                    Add Player
                </button>

                <button
                    onClick={handleCreateTeam}
                    disabled={loading}
                    className="w-full bg-green-500 py-3 rounded"
                >
                    {loading ? "Creating..." : "Create Team"}
                </button>

            </div>
        </div>
    );
};

export default CreateTeam;