import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, arrayUnion, getDocs, getDoc, collection, query, where, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import TournamentTab from "./TournamentTab";

const StudentDashboard = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState(null);
    const [newMemberCode, setNewMemberCode] = useState("");
    const [nextMatch, setNextMatch] = useState(null);
    const navigate = useNavigate();
    const [matches, setMatches] = useState([]);
    const [liveMatches, setLiveMatches] = useState([]);
    const [finishedMatches, setFinishedMatches] = useState([]);
    const [approvedTeams, setApprovedTeams] = useState([]);
    const [activeView, setActiveView] = useState("dashboard");

    useEffect(() => {
        let unsubscribeUser = () => { };
        let unsubscribeTeam = () => { };

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);

                unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserData({ ...data, email: user.email, uid: user.uid });

                        if (data.teamId) {
                            const teamRef = doc(db, "teams", data.teamId);
                            unsubscribeTeam();
                            unsubscribeTeam = onSnapshot(teamRef, (snap) => {
                                if (snap.exists()) {
                                    setTeamData({ id: snap.id, ...snap.data() });
                                }
                            });
                        } else {
                            setTeamData(null);
                            unsubscribeTeam();
                        }
                    }
                    setLoading(false);
                });
            } else {
                navigate("/login");
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeUser();
            unsubscribeTeam();
        };
    }, [navigate]);

    // useEffect جديد لمتابعة الماتشات الخاصة بفريق الطالب
    useEffect(() => {
        if (userData?.teamId) {
            const q = query(collection(db, "matches"), where("teams", "array-contains", userData.teamId));
            const unsubMatch = onSnapshot(q, (snap) => {
                const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // بنعرض أول ماتش قادم
                setNextMatch(matches[0] || null);
            });
            return () => unsubMatch();
        }
    }, [userData?.teamId]);

     useEffect(() => {
        const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setApprovedTeams(all.filter(t => t.status === "approved"));
        });

        const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const now = Date.now();

            setMatches(data);

            const live = data.filter((m) => {
                if (!m.startTime && !m.time) return false;

                const start = m.startTime?.toMillis
                    ? m.startTime.toMillis()
                    : (m.date && m.time ? new Date(`${m.date} ${m.time}`).getTime() : now);
                const isInTimeWindow =
                    now >= start &&
                    now <= start + 20 * 60 * 1000;

                const notFinished = (m.status || "").toLowerCase() !== "completed";

                return isInTimeWindow && notFinished;
            });
            setLiveMatches(live);
            setFinishedMatches(
                data.filter(m => (m.status || "").trim().toLowerCase() === "completed")
            );
        });

        return () => {
            unsubTeams();
            unsubMatches();
        };
    }, []);

    const acceptInvite = async (req) => {
        const user = auth.currentUser;

        if (userData.hasTeam) {
            return alert("You already in a team");
        }

        try {
            const teamRef = doc(db, "teams", req.teamId);

            // ✅ تحقق إن التيم موجود
            const teamSnap = await getDoc(teamRef);

            if (!teamSnap.exists()) {
                return alert("Team not found ");
            }

            // ✅ ضيف اللاعب للتيم
            await updateDoc(teamRef, {
                memberIds: arrayUnion(user.uid),
                members: arrayUnion(userData.name),
            });

            // ✅ تحديث بيانات المستخدم
            await updateDoc(doc(db, "users", user.uid), {
                hasTeam: true,
                teamId: req.teamId,
                assignedTeam: req.teamName,
                teamRequests: [],
            });

            alert("Joined team successfully ✅");

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };

    // رفض الدعوة
    const rejectInvite = async (req) => {
        const user = auth.currentUser;
        const updatedRequests = userData.teamRequests.filter(
            (r) => r.teamId !== req.teamId
        );
        await updateDoc(doc(db, "users", user.uid), {
            teamRequests: updatedRequests,
        });
    };

    // ترك الفريق
    const leaveTeam = async () => {
        const user = auth.currentUser;
        const index = teamData.memberIds.findIndex((id) => id === user.uid);
        if (index === -1) return;
        const newMemberIds = [...teamData.memberIds];
        const newMembers = [...teamData.members];
        newMemberIds.splice(index, 1);
        newMembers.splice(index, 1);
        await updateDoc(doc(db, "teams", userData.teamId), {
            memberIds: newMemberIds,
            members: newMembers,
        });
        await updateDoc(doc(db, "users", user.uid), {
            hasTeam: false,
            teamId: "",
            assignedTeam: "",
        });
    };

    const deleteTeam = async () => {
        if (!window.confirm("Are you sure you want to delete the team? All members will become Free Agents.")) return;

        try {
            // 1. نجلب كل الأعضاء الحاليين في الفريق لتحديث بياناتهم
            const memberIds = teamData.memberIds;

            // 2. تحديث كل لاعب في الفريق ليصبح Free Agent
            const updatePromises = memberIds.map(id =>
                updateDoc(doc(db, "users", id), { hasTeam: false, teamId: "", assignedTeam: "", teamRequests: [] })
            );
            await Promise.all(updatePromises);
            await deleteDoc(doc(db, "teams", teamData.id));
            alert("Team has been deleted successfully.");
        } catch (err) {
            console.error("Error deleting team:", err);
            alert("Failed to delete team.");
        }
    };

    // إزالة لاعب (من قبل القائد)
    const removePlayer = async (index) => {
        const newIds = [...teamData.memberIds];
        const newNames = [...teamData.members];
        const removedId = newIds[index];

        newIds.splice(index, 1);
        newNames.splice(index, 1);

        await updateDoc(doc(db, "teams", teamData.id), {
            memberIds: newIds,
            members: newNames,
        });

        await updateDoc(doc(db, "users", removedId), {
            hasTeam: false,
            teamId: "",
            assignedTeam: "",
        });
    };


    const MAX_PLAYERS = 7;

    const sendInvite = async () => {
        if (!newMemberCode.trim()) return alert("Enter student code");

        try {
            // ✅ هات بيانات التيم
            const teamRef = doc(db, "teams", userData.teamId);
            const teamSnap = await getDoc(teamRef);

            if (!teamSnap.exists()) return alert("Team not found");

            const team = teamSnap.data();
            const players = team.members || [];

            // ✅ تحقق من العدد
            if (players.length >= MAX_PLAYERS) {
                return alert("Team is full! Remove a player first.");
            }

            // ✅ دور على الطالب
            const q = query(collection(db, "users"), where("studentCode", "==", newMemberCode));
            const snap = await getDocs(q);

            if (snap.empty) return alert("Student not found");

            const studentDoc = snap.docs[0];
            const studentData = studentDoc.data();

            if (studentData.hasTeam) {
                return alert("Student already in a team");
            }

            // ✅ منع تكرار الدعوة
            const existingRequests = studentData.teamRequests || [];
            const alreadyInvited = existingRequests.some((req) => req.teamId === teamData.id);

            if (alreadyInvited) {
                return alert("Invite already sent to this student");
            }

            // ✅ إرسال الدعوة
            await updateDoc(doc(db, "users", studentDoc.id), {
                teamRequests: arrayUnion({
                    teamId: teamData.id,
                    teamName: teamData.teamName,
                    captainId: userData.uid,
                    captainName: userData.name,
                }),
            });

            alert(`${studentData.name} has been invited to the team`);
            setNewMemberCode("");

        } catch (err) {
            console.error(err);
            alert(err.code);
        }
    };

    if (loading) {
        return (
            <div className="loader">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
            {/* Navbar */}
            <nav className="w-full border-b border-white/10 backdrop-blur-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
                    <div className="flex items-center gap-8">
                        <h1 
                            className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text cursor-pointer"
                            onClick={() => setActiveView("dashboard")}
                        >
                            SCI-FOOTBALL
                        </h1>
                        <div className="hidden md:flex gap-6">
                            <button 
                                onClick={() => setActiveView("dashboard")}
                                className={`text-sm font-bold uppercase transition-all ${activeView === 'dashboard' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                            >
                                Dashboard
                            </button>
                            <button 
                                onClick={() => setActiveView("tournament")}
                                className={`text-sm font-bold uppercase transition-all ${activeView === 'tournament' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                            >
                                Tournament
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut(auth)}
                        className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-5 py-2 rounded-xl transition font-bold text-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* Main Layout */}
            <div className="max-w-7xl mx-auto p-6">
                {activeView === "dashboard" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <aside className="lg:col-span-4 space-y-6">
                            {/* Profile Card */}
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 text-center shadow-xl">
                                {/* حاوية الصورة أو الحرف */}
                                <div className="w-40 h-40 mx-auto mb-6 flex items-center justify-center rounded-full overflow-hidden shadow-lg border-2 border-white/10">
                                    {userData?.photo ? (
                                        // إذا كانت الصورة موجودة
                                        <img src={userData.photo} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        // إذا لم تكن الصورة موجودة، نظهر أول حرف مع الخلفية الملونة
                                        <div className="w-full h-full bg-gradient-to-tr from-green-500 to-emerald-700 flex items-center justify-center text-4xl font-bold text-white">
                                            {userData?.name ? userData.name[0].toUpperCase() : "?"}
                                        </div>
                                    )}
                                </div>

                                {/* بيانات الطالب */}
                                <h2 className="text-2xl font-bold">{userData?.name || "Student Name"}</h2>
                                <p className="text-gray-400 mt-1">ID : {userData?.studentCode || "N/A"}</p>

                                {/* حالة الفريق */}
                                <div className="mt-5">
                                    {userData?.hasTeam ? (
                                        <span className="bg-green-500/20 text-green-400 px-5 py-2 rounded-xl border border-green-500/30 inline-block">
                                            Team Name : {userData?.assignedTeam}
                                        </span>
                                    ) : (
                                        <span className="bg-orange-500/20 text-orange-400 px-5 py-2 rounded-xl border border-orange-500/30 inline-block">
                                            No Team Yet
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Team Options */}
                            {userData && !userData.hasTeam && (
                                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl mt-5">
                                    <h3 className="text-lg font-bold mb-4 text-left">Team Options</h3>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => navigate("/CreateTeam")}
                                            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl transition"
                                        >
                                            Create Team
                                        </button>
                                        <button
                                            onClick={() => navigate("/solo-request")}
                                            className="w-full bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white py-3 rounded-xl border border-blue-500/30 transition"
                                        >
                                            Play Solo
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tournament Quick Access */}
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                <h3 className="text-lg font-bold mb-4 text-left">Tournament</h3>
                                <button 
                                    onClick={() => setActiveView("tournament")}
                                    className="w-full p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between hover:bg-emerald-500/20 transition-all group"
                                >
                                    <span className="text-emerald-400 font-bold uppercase text-xs tracking-widest">View Bracket</span>
                                    <span className="text-emerald-400 group-hover:translate-x-1 transition-transform">❯</span>
                                </button>
                            </div>

                            {/* Settings */}
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                <h3 className="text-lg font-bold mb-4 text-left">Settings</h3>
                                <div className="space-y-3">
                                    <button onClick={() => navigate("/EditProfile")} className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl transition text-left" >
                                        Edit Profile
                                    </button>
                                    <button
                                        onClick={() => navigate("/ChangePassword")}
                                        className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl transition text-left"
                                    >
                                        Change Password
                                    </button>
                                </div>
                            </div>
                        </aside>

                        {/* Main Content */}
                        <main className="lg:col-span-8 space-y-6">

                            {/* --- FIXED SECTION: Stats & Next Match --- */}
                            {userData?.hasTeam && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Statistics Card - تم تعديله ليقرأ من userData مباشرة */}
                                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <span className="size-2 bg-green-500 rounded-full"></span>
                                            Your Stats
                                        </h3>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Score</p>
                                                <p className="text-2xl font-black text-blue-400">{userData?.score || 0}</p>
                                            </div>
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Goals</p>
                                                <p className="text-2xl font-black text-emerald-400">{userData?.goals || 0}</p>
                                            </div>
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-[10px] text-gray-400 uppercase font-black">Cards</p>
                                                <div className="flex justify-center gap-2 mt-1">
                                                    <span className="w-3 h-4 bg-yellow-400 rounded-sm" title="Yellow Cards"></span>
                                                    <span className="text-xs font-bold">{userData?.yellowCards || 0}</span>
                                                    <span className="w-3 h-4 bg-red-600 rounded-sm" title="Red Cards"></span>
                                                    <span className="text-xs font-bold">{userData?.redCards || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* تنبيه في حالة الإيقاف */}
                                        {userData?.redCards > 0 && (
                                            <p className="mt-3 text-[10px] text-red-500 font-bold text-center animate-pulse">
                                                You are suspended due to a red card!
                                            </p>
                                        )}
                                    </div>

                                    {/* Next Match Card */}
                                    <div className="bg-gradient-to-br from-blue-600/20 to-transparent backdrop-blur-xl rounded-3xl p-6 border border-blue-500/20 shadow-xl">
                                        <h3 className="text-lg font-bold mb-4 italic">Next Match</h3>
                                        {nextMatch ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Opponent</span>
                                                    <span className="text-sm font-black text-white">{nextMatch.opponentName || "TBD"}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-black/20 p-2 rounded-lg">
                                                        <p className="text-[9px] text-blue-400 uppercase font-bold">Pitch</p>
                                                        <p className="text-xs font-bold">{nextMatch.pitch || "N/A"}</p>
                                                    </div>
                                                    <div className="bg-black/20 p-2 rounded-lg">
                                                        <p className="text-[9px] text-blue-400 uppercase font-bold">Time</p>
                                                        <p className="text-xs font-bold">{nextMatch.time || "TBD"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-24 italic text-gray-500 text-sm">
                                                No matches scheduled
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                <h3 className="text-lg font-bold mb-4 text-red-400">Live Matches</h3>

                                {liveMatches.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No live matches</p>
                                ) : (
                                    <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                                        {liveMatches.map(match => (
                                            <div key={match.id} className="p-3 bg-black/40 rounded-xl">
                                                <p className="font-bold">
                                                    {match.team1Name} vs {match.team2Name}
                                                </p>
                                                <p className="text-blue-400 text-xl font-black">
                                                    {match.score || "0-0"}
                                                </p>
                                                <span className="text-green-400 text-xs">LIVE</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 mt-6">
                                <h3 className="text-lg font-bold mb-4 text-yellow-400">Match History</h3>

                                {finishedMatches.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No finished matches</p>
                                ) : (
                                    <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                                        {finishedMatches.map(match => (
                                            <div key={match.id} className="p-3 bg-black/40 rounded-xl">
                                                <p className="font-bold">
                                                    {match.team1Name} vs {match.team2Name}
                                                </p>
                                                <p className="text-lg">
                                                    {match.score || "0-0"}
                                                </p>
                                                <span className="text-yellow-400 text-xs">Finished</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Team Members */}
                            <div className="bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl p-8 border border-green-500/20 shadow-xl">
                                <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                    <h3 className="text-lg font-bold mb-4 text-left">Team's Members</h3>
                                    {userData?.hasTeam ? (
                                        <div className="space-y-3">
                                            {teamData?.members?.map((playerName, i) => (
                                                <div key={i} className="flex justify-between bg-black/40 p-2 rounded">
                                                    <span className="flex items-center gap-2">
                                                        <span className="size-2 bg-green-500 rounded-full"></span>
                                                        {playerName}
                                                        {teamData.memberIds[i] === teamData.captainId &&
                                                            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 rounded">Leader</span>
                                                        }
                                                    </span>
                                                    {userData.uid === teamData.captainId && playerName !== userData.name && (
                                                        <button onClick={() => removePlayer(i)} className="text-red-400 text-sm hover:underline" >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                    ) : (
                                        <>
                                            {userData?.teamRequests?.length > 0 ? (
                                                userData.teamRequests.map((req, index) => (
                                                    <div key={index} className="mb-3 p-3 bg-black/40 rounded-xl">
                                                        <p className="font-bold">{req.teamName}</p>
                                                        <div className="mt-2 space-x-2">
                                                            <button onClick={() => acceptInvite(req)} className="bg-green-500 px-3 py-1 rounded">
                                                                Accept
                                                            </button>
                                                            <button onClick={() => rejectInvite(req)} className="bg-red-500 px-3 py-1 rounded">
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-gray-400 text-sm">No team requests</p>
                                            )}
                                        </>
                                    )}

                                    {userData?.hasTeam && (
                                        <div className="mt-4 space-y-2">
                                            {userData.uid === teamData?.captainId ? (
                                                <button onClick={deleteTeam} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl transition shadow-lg shadow-red-500/20" >
                                                    Delete Team
                                                </button>
                                            ) : (<button onClick={leaveTeam} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl transition">
                                                Leave Team
                                            </button>
                                            )}
                                        </div>)}


                                    {userData.uid === teamData?.captainId && (
                                        <div className="mt-6 bg-white/5 p-4 rounded-xl border border-white/10">
                                            <h4 className="font-bold mb-2 text-left">Add Member (Send Invite)</h4>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Enter student code"
                                                    value={newMemberCode}
                                                    onChange={(e) => setNewMemberCode(e.target.value)}
                                                    className="flex-1 p-2 rounded bg-black border border-white/10"
                                                />
                                                <button
                                                    onClick={sendInvite}
                                                    className="bg-green-500 px-4 py-2 rounded hover:bg-green-600 transition"
                                                >
                                                    Invite
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Player Info */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <span className="text-gray-400 block mb-1">Email</span>
                                    <span className="font-medium">{userData?.email}</span>
                                </div>

                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                    <span className="text-gray-400 block mb-1">Your Role</span>
                                    <span className="text-green-400 font-bold">
                                        {userData?.uid === teamData?.captainId ? "Team Leader" : "Player"}
                                    </span>
                                </div>
                            </div>
                        </main>
                    </div>
                ) : (
                    <div className="animate-fade-slide-up">
                        <TournamentTab teams={approvedTeams} onBack={() => setActiveView("dashboard")} />
                    </div>
                )}
            </div>
        </div >
    );
};

export default StudentDashboard;
