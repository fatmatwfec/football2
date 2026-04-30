import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDocs, getDoc, collection, query, where, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import TournamentTab from "./TournamentTab";
import { getRoundLabel } from "../services/tournamentService";
import { FaTimes, FaFutbol, FaIdCard, FaChevronRight, FaTrophy, FaCheckCircle, FaClock, FaRunning } from "react-icons/fa";

const StudentDashboard = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [teamData, setTeamData] = useState(null);
    const [newMemberCode, setNewMemberCode] = useState("");
    const [nextMatch, setNextMatch] = useState(null);
    const [savingPosition, setSavingPosition] = useState(false);
    const navigate = useNavigate();
    const [matches, setMatches] = useState([]);
    const [liveMatches, setLiveMatches] = useState([]);
    const [finishedMatches, setFinishedMatches] = useState([]);
    const [approvedTeams, setApprovedTeams] = useState([]);
    const [activeView, setActiveView] = useState("dashboard");
    const [userRank, setUserRank] = useState(null);
    const [currentTournamentName, setCurrentTournamentName] = useState("Tournament");
    const [historyTab, setHistoryTab] = useState("myTeam");
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [allStudents, setAllStudents] = useState([]);
    const [tournament, setTournament] = useState(null);
    const [now, setNow] = useState(Date.now());

    // تحديث الوقت كل دقيقة لضمان دقة حالة المباريات اللايف
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

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

        const unsubTournament = onSnapshot(doc(db, "tournaments", "main"), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setTournament(data);
                setCurrentTournamentName(data.name || "Tournament");
            } else {
                setTournament(null);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeUser();
            unsubscribeTeam();
            unsubTournament();
        };
    }, [navigate]);

    // useEffect جديد لمتابعة الماتشات الخاصة بفريق الطالب
    useEffect(() => {
        if (!userData?.teamId) {
            setNextMatch(null);
            return;
        }

        // 1. أولاً نبحث في الماتشات المجدولة رسمياً في مجموعة matches
        const scheduledMatches = matches.filter(m => {
            if (!m.date || !m.time) return false;
            const [y, mm, d] = m.date.split('-').map(Number);
            const [h, min] = m.time.split(':').map(Number);
            const matchTime = new Date(y, mm - 1, d, h, min).getTime();

            return (m.team1Id === userData.teamId || m.team2Id === userData.teamId) &&
                (m.status || "").toLowerCase() !== "completed" &&
                matchTime > now;
        });

        // 2. ثانياً نبحث في البطولة (الـ Bracket) عن ماتشات غير مجدولة رسمياً بعد
        const bracketMatches = [];
        if (tournament?.rounds) {
            Object.entries(tournament.rounds).forEach(([rKey, roundMatches]) => {
                roundMatches.forEach(m => {
                    const isMyTeam = m.team1?.id === userData.teamId || m.team2?.id === userData.teamId;
                    const notFinished = !m.winner;

                    if (isMyTeam && notFinished) {
                        // نتأكد إنه مش موجود أصلاً في الماتشات المجدولة
                        const alreadyScheduled = scheduledMatches.some(sm =>
                            (sm.team1Id === m.team1?.id && sm.team2Id === m.team2?.id) ||
                            (sm.team1Id === m.team2?.id && sm.team2Id === m.team1?.id)
                        );

                        if (!alreadyScheduled) {
                            const roundDate = tournament.roundDateMap?.[rKey];
                            bracketMatches.push({
                                id: m.id,
                                team1Id: m.team1?.id,
                                team2Id: m.team2?.id,
                                team1Name: m.team1?.name || "TBD",
                                team2Name: m.team2?.name || "TBD",
                                date: roundDate?.date || roundDate || "TBD",
                                time: m.projectedTime || roundDate?.startTime || "TBD",
                                roundLabel: getRoundLabel(parseInt(rKey), Object.keys(tournament.rounds).length),
                                isFromBracket: true
                            });
                        }
                    }
                });
            });
        }

        const allPotentialMatches = [...scheduledMatches, ...bracketMatches];

        if (allPotentialMatches.length === 0) {
            setNextMatch(null);
            return;
        }

        // ترتيب حسب التاريخ والوقت
        const sorted = allPotentialMatches.sort((a, b) => {
            if (!a.date || a.date === "TBD") return 1;
            if (!b.date || b.date === "TBD") return -1;
            const dateA = new Date(`${a.date} ${a.time === "TBD" ? "00:00" : a.time}`).getTime();
            const dateB = new Date(`${b.date} ${b.time === "TBD" ? "00:00" : b.time}`).getTime();
            return dateA - dateB;
        });

        const next = sorted[0];

        // حل اسم الخصم
        let opponentName = "TBD";
        if (next.isFromBracket) {
            opponentName = next.team1Id === userData.teamId ? next.team2Name : next.team1Name;
        } else {
            const opponentId = next.team1Id === userData.teamId ? next.team2Id : next.team1Id;
            const opponentTeam = approvedTeams.find(t => t.id === opponentId);
            opponentName = opponentTeam?.teamName || next.team1Name || next.team2Name || "TBD";
        }

        // حل اسم الدور لو مش موجود (للماتشات المجدولة يدوياً)
        let roundLabel = next.roundLabel;
        if (!roundLabel && tournament?.rounds) {
            // نحاول نعرف الدور من الـ IDs
            Object.entries(tournament.rounds).forEach(([rKey, roundMatches]) => {
                const found = roundMatches.find(m =>
                    (m.team1?.id === next.team1Id && m.team2?.id === next.team2Id) ||
                    (m.team1?.id === next.team2Id && m.team2?.id === next.team1Id)
                );
                if (found) {
                    roundLabel = getRoundLabel(parseInt(rKey), Object.keys(tournament.rounds).length);
                }
            });
        }

        setNextMatch({
            ...next,
            opponentName,
            roundLabel: roundLabel || "Friendly Match"
        });
    }, [matches, approvedTeams, userData?.teamId, tournament, now]);

    useEffect(() => {
        const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setApprovedTeams(all.filter(t => t.status === "approved"));
        });

        const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setMatches(data);
        });

        const unsubAllUsers = onSnapshot(collection(db, "users"), (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllStudents(all);
        });

        return () => {
            unsubTeams();
            unsubMatches();
            unsubAllUsers();
        };
    }, []);

    // فصل منطق تصفية المباريات ليعتمد على الوقت الحالي (now)
    useEffect(() => {
        const DURATION = 20 * 60 * 1000;

        const live = matches.filter((m) => {
            if (!m.date || !m.time) return false;

            const [y, mm, d] = m.date.split('-').map(Number);
            const [h, min] = m.time.split(':').map(Number);
            const start = new Date(y, mm - 1, d, h, min).getTime();

            const isInTimeWindow = now >= start && now <= start + DURATION;
            const notFinished = (m.status || "").toLowerCase() !== "completed";

            return isInTimeWindow && notFinished;
        });

        setLiveMatches(live);
        setFinishedMatches(
            matches.filter(m => (m.status || "").trim().toLowerCase() === "completed")
        );
    }, [matches, now]);

    useEffect(() => {
        const fetchRank = async () => {
            if (!userData?.uid) return;
            try {
                const q = query(collection(db, "users"), where("role", "==", "student"));
                const querySnapshot = await getDocs(q);
                const students = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    goals: doc.data().goals || 0,
                    score: doc.data().score || 0
                }));

                // ترتيب حسب الأهداف أولاً، ثم النقاط
                students.sort((a, b) => b.goals - a.goals || b.score - a.score);

                setAllStudents(students.map(s => ({
                    id: s.id,
                    name: querySnapshot.docs.find(d => d.id === s.id)?.data().name,
                    teamId: querySnapshot.docs.find(d => d.id === s.id)?.data().teamId
                })));

                const rank = students.findIndex(s => s.id === userData.uid) + 1;
                setUserRank(rank);
            } catch (error) {
                console.error("Error fetching rank:", error);
            }
        };

        fetchRank();
    }, [userData?.uid, userData?.goals, userData?.score]);

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

    const handlePositionChange = async (newPosition) => {
        const user = auth.currentUser;
        if (!user || !newPosition) return;
        setSavingPosition(true);
        try {
            await updateDoc(doc(db, "users", user.uid), { position: newPosition });
        } catch (err) {
            console.error(err);
            alert("Failed to update position.");
        }
        setSavingPosition(false);
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

    const handleRequestPlayer = async (position) => {
        if (!teamData) return;
        const currentNeeded = teamData.neededPositions || [];
        let updatedNeeded;
        if (position === null) {
            updatedNeeded = [];
        } else if (currentNeeded.includes(position)) {
            updatedNeeded = currentNeeded.filter(p => p !== position);
        } else {
            updatedNeeded = [...currentNeeded, position];
        }
        
        try {
            await updateDoc(doc(db, "teams", teamData.id), {
                neededPositions: updatedNeeded,
                needsPosition: updatedNeeded.length > 0 ? updatedNeeded[0] : null, // keep legacy for compatibility
                requestTimestamp: new Date()
            });
        } catch (err) {
            console.error(err);
        }
    };

    const [showSoloModal, setShowSoloModal] = useState(false);
    const triggerPlaySolo = (pos) => {
        handlePlaySolo(pos);
        setShowSoloModal(false);
    };

    const handlePlaySolo = async (specificPos = null) => {
        if (!userData) return;
        
        // If canceling
        if (userData.searchingForTeam) {
            try {
                await updateDoc(doc(db, "users", userData.uid), {
                    searchingForTeam: false,
                    playSolo: false
                });
                alert("Solo request cancelled.");
            } catch (err) { console.error(err); }
            return;
        }

        // If initiating, show modal if no position passed
        if (!specificPos) {
            setShowSoloModal(true);
            return;
        }

        try {
            await updateDoc(doc(db, "users", userData.uid), {
                searchingForTeam: true,
                playSolo: true,
                position: specificPos,
                soloPosition: specificPos
            });
            alert(`You are now marked as a Solo ${specificPos}! Admin will match you with a team needing your skills. ⚽`);
        } catch (err) {
            console.error(err);
        }
    };

    const isCaptain = teamData?.captainId === userData?.uid ||
        teamData?.captainName === userData?.name ||
        (userData?.role === 'student' && teamData?.captainName?.toLowerCase() === userData?.name?.toLowerCase());

    const soloPlayers = allStudents.filter(s =>
        (s.searchingForTeam === true || s.playSolo === true) &&
        s.hasTeam !== true &&
        s.role !== 'admin'
    );

    const getRemainingTime = () => {
        if (!tournament?.createdAt) return null;
        const createdAt = tournament.createdAt.toDate ? tournament.createdAt.toDate().getTime() : (typeof tournament.createdAt === 'number' ? tournament.createdAt : new Date(tournament.createdAt).getTime());
        const deadline = createdAt + (48 * 60 * 60 * 1000);
        const diff = deadline - now;

        if (diff <= 0) return "Expired";

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    const getDeadlineString = () => {
        if (!tournament?.createdAt) return null;
        const createdAt = tournament.createdAt.toDate ? tournament.createdAt.toDate().getTime() : (typeof tournament.createdAt === 'number' ? tournament.createdAt : new Date(tournament.createdAt).getTime());
        const deadline = createdAt + (48 * 60 * 60 * 1000);
        return new Date(deadline).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
                                            onClick={() => handlePlaySolo()}
                                            className={`w-full py-3 rounded-xl border transition font-bold ${userData?.searchingForTeam
                                                ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                                : 'bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white border-blue-500/30'
                                                }`}
                                        >
                                            {userData?.searchingForTeam ? 'Cancel Solo Request' : 'Play Solo'}
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

                            {/* Captain Options: Request Players */}
                            {isCaptain && (
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-br from-emerald-950/40 to-black backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl">
                                        <h3 className="text-lg font-bold mb-1 text-left text-emerald-400">Recruit Players</h3>
                                        <p className="text-[10px] text-gray-400 mb-4 text-left uppercase tracking-widest">Need specific positions?</p>
                                        <div className="grid grid-cols-1 gap-2 text-left">
                                            {['Goalkeeper', 'Defender', 'Forward'].map((pos) => (
                                                <button
                                                    key={pos}
                                                    onClick={() => handleRequestPlayer(pos)}
                                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-bold ${(teamData?.neededPositions || []).includes(pos)
                                                        ? 'bg-emerald-500 text-black border-emerald-500'
                                                        : 'bg-white/5 border-white/10 text-gray-300 hover:border-emerald-500/50 hover:text-white'
                                                        }`}
                                                >
                                                    <span>Need {pos}</span>
                                                    {(teamData?.neededPositions || []).includes(pos) && <FaCheckCircle size={14} />}
                                                </button>
                                            ))}
                                            {(teamData?.neededPositions?.length > 0 || teamData?.needsPosition) && (
                                                <button
                                                    onClick={() => handleRequestPlayer(null)}
                                                    className="text-[10px] text-red-400 mt-2 hover:underline w-full text-center"
                                                >
                                                    Clear All Requests
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Solo Players List for Captains */}
                                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                        <h3 className="text-sm font-bold mb-4 text-left uppercase tracking-widest text-gray-400">Available Solo Players</h3>
                                        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1 text-left">
                                            {soloPlayers.length > 0 ? (
                                                soloPlayers.map(player => (
                                                    <div key={player.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-white text-xs font-bold">{player.name}</p>
                                                            <p className="text-[10px] text-emerald-500 font-bold uppercase">{player.position}</p>
                                                        </div>
                                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[10px] text-gray-600 italic">No solo players available right now.</p>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-gray-500 mt-4 leading-relaxed text-left">
                                            * Tell Admin which player you want, or send a position request above.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Settings */}
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                <h3 className="text-lg font-bold mb-4 text-left">Settings</h3>
                                <div className="space-y-3">
                                    {/* Position Selector */}
                                    <div>
                                        <label className="text-gray-400 text-xs font-bold uppercase block mb-2">Your Position</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Forward', 'Defender', 'Goalkeeper'].map((pos) => (
                                                <button
                                                    key={pos}
                                                    onClick={() => handlePositionChange(pos)}
                                                    disabled={savingPosition}
                                                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${userData?.position === pos
                                                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                                                        }`}
                                                >
                                                    {pos === 'Forward' ? '⚡ Forward' : pos === 'Defender' ? '🛡️ Defender' : '🧤 Goalkeeper'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={() => navigate("/EditProfile")} className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl transition text-left">
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
                            {/* Tournament Registration - NEW SECTION */}
                            {tournament?.registrationOpen && (
                                <div className="bg-gradient-to-br from-emerald-600/20 to-transparent backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/20 shadow-xl mb-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-2">
                                        <span className={`flex items-center gap-2 px-3 py-1 ${getRemainingTime() === "Expired" ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} rounded-full`}>
                                            <span className={`w-2 h-2 ${getRemainingTime() === "Expired" ? 'bg-red-500' : 'bg-emerald-500'} rounded-full ${getRemainingTime() === "Expired" ? '' : 'animate-ping'}`}></span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${getRemainingTime() === "Expired" ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {getRemainingTime() === "Expired" ? 'Registration Closed' : 'Registration Open'}
                                            </span>
                                        </span>
                                        {getRemainingTime() !== "Expired" && (
                                            <span className="text-[9px] font-bold text-emerald-500/70 uppercase flex items-center gap-1">
                                                <FaClock className="text-[8px]" /> Ends: {getDeadlineString()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                        <div className={`w-20 h-20 ${getRemainingTime() === "Expired" ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/20 border-emerald-500/30'} rounded-3xl flex items-center justify-center border-2`}>
                                            <FaTrophy className={`text-3xl ${getRemainingTime() === "Expired" ? 'text-red-500' : 'text-emerald-500'}`} />
                                        </div>
                                        <div className="flex-1 text-center md:text-left">
                                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{tournament.registrationTitle}</h3>
                                            <div className="flex gap-4 mb-3">
                                                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                                                    <p className="text-[8px] text-gray-500 uppercase font-black">Starts</p>
                                                    <p className="text-xs font-bold text-white">{tournament.startDate || "TBD"}</p>
                                                </div>
                                                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                                                    <p className="text-[8px] text-gray-500 uppercase font-black">Ends</p>
                                                    <p className="text-xs font-bold text-white">{tournament.endDate || "TBD"}</p>
                                                </div>
                                            </div>
                                            <p className="text-slate-400 text-sm max-w-md">
                                                {getRemainingTime() === "Expired"
                                                    ? "Registration for this tournament has ended. Stay tuned for the brackets!"
                                                    : "A new tournament has been announced! Captains can register their teams now to participate in the upcoming draw."}
                                            </p>
                                            {getRemainingTime() !== "Expired" && (
                                                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Closes in:</span>
                                                    <span className="text-xs font-black text-emerald-400 tracking-tight">{getRemainingTime()}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-full md:w-auto">
                                            {getRemainingTime() === "Expired" ? (
                                                <div className="text-center px-8 py-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                                                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Time Limit Reached</p>
                                                    <p className="text-white text-xs font-bold mt-1">Registration Locked</p>
                                                </div>
                                            ) : (
                                                userData?.uid === teamData?.captainId ? (
                                                    tournament.registeredTeamIds?.includes(userData.teamId) ? (
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="flex items-center gap-2 text-emerald-400 font-black uppercase text-xs">
                                                                <FaCheckCircle /> Registered
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!window.confirm("Withdraw from tournament?")) return;
                                                                    await updateDoc(doc(db, 'tournaments', 'main'), {
                                                                        registeredTeamIds: arrayRemove(userData.teamId)
                                                                    });
                                                                }}
                                                                className="text-[10px] text-red-500 hover:underline uppercase font-bold"
                                                            >
                                                                Withdraw Team
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={async () => {
                                                                if ((teamData?.memberIds?.length || 0) < 5) {
                                                                    alert("Your team must have at least 5 players to register for the tournament! ⚽");
                                                                    return;
                                                                }
                                                                await updateDoc(doc(db, 'tournaments', 'main'), {
                                                                    registeredTeamIds: arrayUnion(userData.teamId)
                                                                });
                                                                alert("Team Registered! Good luck! 🏆");
                                                            }}
                                                            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-2xl uppercase text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all"
                                                        >
                                                            Join Tournament
                                                        </button>
                                                    )
                                                ) : (
                                                    <div className="text-center px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Waiting for Captain</p>
                                                        <p className="text-white text-xs font-bold mt-1">Only leaders can register</p>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {userData?.hasTeam && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    {/* Statistics Card - تم تعديله ليقرأ من userData مباشرة */}
                                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <span className="size-2 bg-green-500 rounded-full"></span>
                                            Your Stats
                                        </h3>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-xs text-gray-400 uppercase font-black truncate" title={currentTournamentName}>Rank in {currentTournamentName}</p>
                                                <p className="text-2xl font-black text-blue-400">#{userRank || "—"}</p>
                                            </div>
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-xs text-gray-400 uppercase font-black">Goals</p>
                                                <p className="text-2xl font-black text-emerald-400">{userData?.goals || 0}</p>
                                            </div>
                                            <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                                                <p className="text-xs text-gray-400 uppercase font-black">Cards</p>
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
                                    <div className="bg-gradient-to-br from-blue-600/20 to-transparent backdrop-blur-xl rounded-3xl p-6 border border-blue-500/20 shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4">
                                            <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full uppercase tracking-widest border border-blue-500/20">
                                                {nextMatch?.roundLabel || "Match"}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold mb-4 italic">Next Match</h3>
                                        {nextMatch ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Opponent</span>
                                                    <span className="text-sm font-black text-white">{nextMatch.opponentName || "TBD"}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-black/20 p-2 rounded-lg">
                                                        <p className="text-[9px] text-blue-400 uppercase font-bold">Date</p>
                                                        <p className="text-xs font-bold">{nextMatch.date || "TBD"}</p>
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
                                        {liveMatches.map(match => {
                                            const isMyTeam = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                                            return (
                                                <div key={match.id} className={`p-4 rounded-2xl border ${isMyTeam ? 'bg-red-500/20 border-red-500/40 animate-pulse' : 'bg-black/40 border-white/5'}`}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live Now</span>
                                                        {isMyTeam && <span className="text-[10px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full uppercase">Your Team</span>}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-center flex-1">
                                                            <p className="text-sm font-bold text-white truncate">{match.team1Name || approvedTeams.find(t => t.id === match.team1Id)?.teamName || "Team 1"}</p>
                                                        </div>
                                                        <div className="bg-black/60 px-4 py-2 rounded-xl border border-white/10">
                                                            <p className="text-xl font-black text-white tracking-tighter">VS</p>
                                                        </div>
                                                        <div className="text-center flex-1">
                                                            <p className="text-sm font-bold text-white truncate">{match.team2Name || approvedTeams.find(t => t.id === match.team2Id)?.teamName || "Team 2"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 mt-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                    <h3 className="text-lg font-bold text-yellow-400">Match History</h3>

                                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-full sm:w-auto">
                                        <button
                                            onClick={() => setHistoryTab("myTeam")}
                                            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${historyTab === 'myTeam' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            My Team
                                        </button>
                                        <button
                                            onClick={() => setHistoryTab("others")}
                                            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${historyTab === 'others' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            Other Teams
                                        </button>
                                    </div>
                                </div>

                                {(() => {
                                    const filtered = finishedMatches.filter(match => {
                                        const isMyMatch = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;
                                        return historyTab === "myTeam" ? isMyMatch : !isMyMatch;
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-10 text-gray-500 italic">
                                                <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-xl">
                                                    {historyTab === "myTeam" ? "🏟️" : "⚽"}
                                                </div>
                                                <p className="text-sm">No {historyTab === "myTeam" ? "team matches" : "other matches"} found</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="max-h-80 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                            {filtered.map(match => {
                                                const t1 = approvedTeams.find(t => t.id === match.team1Id);
                                                const t2 = approvedTeams.find(t => t.id === match.team2Id);
                                                const t1Name = t1?.teamName || "Team 1";
                                                const t2Name = t2?.teamName || "Team 2";
                                                const isMyMatch = match.team1Id === userData?.teamId || match.team2Id === userData?.teamId;

                                                return (
                                                    <div
                                                        key={match.id}
                                                        onClick={() => setSelectedMatch(match)}
                                                        className={`p-4 rounded-2xl border transition-all hover:bg-white/10 cursor-pointer group ${isMyMatch ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-black/40 border-white/5'}`}
                                                    >
                                                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="size-1.5 rounded-full bg-gray-600"></span>
                                                                {match.date}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded-full">Finished</span>
                                                                <FaChevronRight className="opacity-0 group-hover:opacity-100 transition-all text-gray-600" size={8} />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex-1 text-right">
                                                                <p className={`text-sm font-bold truncate ${match.team1Id === userData?.teamId ? 'text-yellow-400' : 'text-white'}`}>{t1Name}</p>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1 px-4 py-2 bg-black/40 rounded-xl border border-white/5 min-w-[80px]">
                                                                <span className="text-lg font-black text-emerald-400 tracking-tighter leading-none">{match.score || "0-0"}</span>
                                                                <span className="text-[8px] text-gray-500 font-black uppercase">Result</span>
                                                            </div>
                                                            <div className="flex-1 text-left">
                                                                <p className={`text-sm font-bold truncate ${match.team2Id === userData?.teamId ? 'text-yellow-400' : 'text-white'}`}>{t2Name}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
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
                        <TournamentTab teams={approvedTeams} onBack={() => setActiveView("dashboard")} readOnly={true} />
                    </div>
                )}
            </div>

            {/* Match Details Modal */}
            {selectedMatch && (
                <MatchDetailsModal
                    match={selectedMatch}
                    allStudents={allStudents}
                    approvedTeams={approvedTeams}
                    onClose={() => setSelectedMatch(null)}
                />
            )}
            {/* Play Solo Modal */}
            {showSoloModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowSoloModal(false)}></div>
                    <div className="relative bg-[#0f172a] border border-white/10 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-fade-in text-center">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                            <FaRunning className="text-blue-400 text-3xl" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 uppercase italic">Choose Your Position</h3>
                        <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest font-bold">Admin will see this when matching you</p>
                        
                        <div className="space-y-3">
                            {['Forward', 'Defender', 'Goalkeeper'].map(pos => (
                                <button
                                    key={pos}
                                    onClick={() => triggerPlaySolo(pos)}
                                    className="w-full py-4 bg-white/5 hover:bg-blue-500 hover:text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3"
                                >
                                    {pos === 'Forward' ? '⚡' : pos === 'Defender' ? '🛡️' : '🧤'} {pos}
                                </button>
                            ))}
                        </div>
                        
                        <button onClick={() => setShowSoloModal(false)} className="mt-6 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
};

// --- Sub-components for Match Details ---

const MatchDetailsModal = ({ match, allStudents, approvedTeams, onClose }) => {
    if (!match) return null;

    const stats = match.statsSnapshot || {};
    const t1 = approvedTeams.find(t => t.id === match.team1Id);
    const t2 = approvedTeams.find(t => t.id === match.team2Id);

    const getTeamStats = (teamId) => {
        return Object.entries(stats)
            .filter(([pId]) => {
                const student = allStudents.find(s => s.id === pId);
                return student?.teamId === teamId;
            })
            .map(([pId, s]) => ({
                name: allStudents.find(st => st.id === pId)?.name || "Unknown",
                ...s
            }))
            .filter(s => (s.goals || 0) > 0 || (s.yellow || 0) > 0 || (s.red || 0) > 0);
    };

    const team1Stats = getTeamStats(match.team1Id);
    const team2Stats = getTeamStats(match.team2Id);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-[#0f172a] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                        <h3 className="text-xl font-bold text-yellow-400">Match Report</h3>
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">{match.date} • {match.pitch || "Main Pitch"}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-400 hover:text-white">
                        <FaTimes size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Header Score */}
                    <div className="flex items-center justify-between mb-8 p-8 bg-black/40 rounded-3xl border border-white/5 shadow-inner">
                        <div className="flex-1 text-center">
                            <div className="size-16 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                                <FaFutbol className="text-white text-2xl" />
                            </div>
                            <p className="text-sm font-bold text-white truncate px-2">{t1?.teamName || "Team 1"}</p>
                            <p className="text-5xl font-black text-white mt-2">{match.score?.split('-')[0] || 0}</p>
                        </div>
                        <div className="px-6 flex flex-col items-center">
                            <span className="text-lg font-black text-gray-700 italic">VS</span>
                        </div>
                        <div className="flex-1 text-center">
                            <div className="size-16 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                                <FaFutbol className="text-white text-2xl" />
                            </div>
                            <p className="text-sm font-bold text-white truncate px-2">{t2?.teamName || "Team 2"}</p>
                            <p className="text-5xl font-black text-white mt-2">{match.score?.split('-')[1] || 0}</p>
                        </div>
                    </div>

                    {match.penalties && (
                        <div className="mb-8 text-center">
                            <div className="inline-flex items-center gap-3 bg-amber-500/10 text-amber-400 px-6 py-2 rounded-2xl border border-amber-500/20 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest">Penalty Shootout</span>
                                <span className="text-lg font-black">{match.penalties}</span>
                            </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Team 1 Stats */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="size-1.5 rounded-full bg-emerald-500"></span>
                                    {t1?.teamName}
                                </h4>
                            </div>
                            {team1Stats.length > 0 ? (
                                <div className="space-y-2">
                                    {team1Stats.map((s, i) => <StatRow key={i} stat={s} />)}
                                </div>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center">
                                    <p className="text-[10px] text-gray-600 italic">No individual contributions recorded</p>
                                </div>
                            )}
                        </div>

                        {/* Team 2 Stats */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="size-1.5 rounded-full bg-blue-500"></span>
                                    {t2?.teamName}
                                </h4>
                            </div>
                            {team2Stats.length > 0 ? (
                                <div className="space-y-2">
                                    {team2Stats.map((s, i) => <StatRow key={i} stat={s} />)}
                                </div>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center">
                                    <p className="text-[10px] text-gray-600 italic">No individual contributions recorded</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white/5 text-center">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Match completed on {match.completedAt?.toDate ? match.completedAt.toDate().toLocaleString() : "N/A"}</p>
                </div>
            </div>
        </div>
    );
};

const StatRow = ({ stat }) => (
    <div className="group flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.08] rounded-2xl border border-white/5 transition-all">
        <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-black/40 flex items-center justify-center text-[10px] font-black text-gray-400 border border-white/5">
                {stat.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-gray-200">{stat.name}</span>
        </div>
        <div className="flex gap-4">
            {stat.goals > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                    <FaFutbol className="text-emerald-400 mb-0.5" size={10} />
                    <span className="text-[10px] font-black text-emerald-400">{stat.goals}</span>
                </div>
            )}
            {stat.yellow > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                    <div className="w-2 h-3 bg-yellow-400 rounded-sm shadow-[0_0_8px_rgba(250,204,21,0.3)]"></div>
                    <span className="text-[10px] font-black text-yellow-400">{stat.yellow}</span>
                </div>
            )}
            {stat.red > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                    <div className="w-2 h-3 bg-red-500 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.3)]"></div>
                    <span className="text-[10px] font-black text-red-500">{stat.red}</span>
                </div>
            )}
        </div>
    </div>
);

export default StudentDashboard;
