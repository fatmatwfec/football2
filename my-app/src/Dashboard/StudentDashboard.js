import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, arrayUnion, getDocs, collection, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const StudentDashboard = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState(null);
    const [newMemberCode, setNewMemberCode] = useState("");
    const navigate = useNavigate();

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

    // قبول الدعوة
    const acceptInvite = async (req) => {
        const user = auth.currentUser;
        if (userData.hasTeam) {
            return alert("You already in a team");
        }
        try {
            await updateDoc(doc(db, "teams", req.teamId), {
                memberIds: arrayUnion(user.uid),
                members: arrayUnion(userData.name),
            });
            await updateDoc(doc(db, "users", user.uid), {
                hasTeam: true,
                teamId: req.teamId,
                assignedTeam: req.teamName,
                teamRequests: [],
            });
        } catch (err) {
            console.error(err);
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
            teamId: null,
            assignedTeam: null,
        });
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
            teamId: null,
            assignedTeam: null,
        });
    };

    // إرسال Invite لعضو جديد
    const sendInvite = async () => {
        if (!newMemberCode.trim()) return alert("Enter student code");

        try {
            // البحث عن الطالب
            const q = query(
                collection(db, "users"),
                where("studentCode", "==", newMemberCode)
            );
            const snap = await getDocs(q);

            if (snap.empty) return alert("Student not found");

            const studentDoc = snap.docs[0];
            const studentData = studentDoc.data();

            if (studentData.hasTeam) return alert("Student already in a team");

            // تحديث الدعوة
            await updateDoc(doc(db, "users", studentDoc.id), {
                teamRequests: arrayUnion({
                    teamId: teamData.id,
                    teamName: teamData.teamName,
                    captainId: userData.uid,
                }),
            });

            alert(`${studentData.name} has been invited to the team`);
            setNewMemberCode("");
        } catch (err) {
            console.error(err);
            alert("Error sending invite");
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
            <nav className="w-full border-b border-white/10 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text">
                        SCI-FOOTBALL
                    </h1>
                    <button
                        onClick={() => signOut(auth)}
                        className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-5 py-2 rounded-xl transition"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* Main Layout */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-6">
                <aside className="lg:col-span-4 space-y-6">
                    {/* Profile Card */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 text-center shadow-xl">
                        <div className="w-28 h-28 bg-gradient-to-tr from-green-500 to-emerald-700 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl font-bold">
                            {userData?.name?.[0]}
                        </div>
                        <h2 className="text-2xl font-bold">{userData?.name}</h2>
                        <p className="text-gray-400 mt-1">ID : {userData?.studentCode}</p>

                        <div className="mt-5">
                            {userData?.hasTeam ? (
                                <span className="bg-green-500/20 text-green-400 px-5 py-2 rounded-xl border border-green-500/30">
                                    Team Name : {userData?.assignedTeam}
                                </span>
                            ) : (
                                <span className="bg-orange-500/20 text-orange-400 px-5 py-2 rounded-xl border border-orange-500/30">
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

                    {/* Settings */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                        <h3 className="text-lg font-bold mb-4 text-left">Settings</h3>
                        <div className="space-y-3">
                            <button className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl transition text-left">
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
                    {/* Team Members */}
                    <div className="bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl p-8 border border-green-500/20 shadow-xl">
                        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                            <h3 className="text-lg font-bold mb-4 text-left">Team's Members</h3>
                            {userData?.hasTeam ? (
                                <div className="space-y-3">
                                    {teamData?.members?.map((playerName, i) => (
                                        <div key={i} className="flex justify-between bg-black/40 p-2 rounded">
                                            <span>{playerName}</span>
                                            {userData.uid === teamData.captainId && playerName !== userData.name && (
                                                <button onClick={() => removePlayer(i)} className="text-red-400">
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

                            {/* زر ترك الفريق */}
                            {userData?.hasTeam && (
                                <button
                                    onClick={leaveTeam}
                                    className="mt-4 w-full bg-red-500 py-2 rounded"
                                >
                                    Leave Team
                                </button>
                            )}

                            {/* زر Add Member للقائد */}
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
                                {userData.uid === userData.captainId ? "Team Leader" : "Player"}
                            </span>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentDashboard;