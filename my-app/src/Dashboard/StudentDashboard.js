import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const StudentDashboard = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (users) => {
            if (users) {
                try {
                    const userDocRef = doc(db, "users", users.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        setUserData({
                            ...userDoc.data(),
                            email: users.email,
                        });
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                navigate("/login");
            }
        });

        return () => unsubscribe();
    }, [navigate]);

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

                {/* Profile Section */}
                <aside className="lg:col-span-4 space-y-6">

                    {/* Profile Card */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 text-center shadow-xl">

                        <div className="w-28 h-28 bg-gradient-to-tr from-green-500 to-emerald-700 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl font-bold">
                            {userData?.name?.[0]}
                        </div>

                        <h2 className="text-2xl font-bold">{userData?.name}</h2>
                        <p className="text-gray-400 mt-1">
                            ID : {userData?.studentCode}
                        </p>

                        <div className="mt-5">

                            {userData?.hasTeam ? (
                                <span className="bg-green-500/20 text-green-400 px-5 py-2 rounded-xl border border-green-500/30">
                                    {userData?.assignedTeam}
                                </span>
                            ) : (
                                <span className="bg-orange-500/20 text-orange-400 px-5 py-2 rounded-xl border border-orange-500/30">
                                    Under Review
                                </span>
                            )}

                        </div>
                    </div>

                    {/* Team Options */}
                    {userData && !userData.hasTeam && (
                        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl mt-5">
                            <h3 className="text-lg font-bold mb-4 text-left">
                                Team Options
                            </h3>

                            <div className="space-y-3">
                                <button
                                    onClick={() => navigate("/create-team")}
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

                        <h3 className="text-lg font-bold mb-4 text-left">
                            Settings
                        </h3>

                        <div className="space-y-3">

                            <button className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl transition text-left">
                                Edit Profile
                            </button>

                            <button onClick={() => navigate("/ChangePassword")}
                                className="w-full bg-white/5 hover:bg-white/10 p-3 rounded-xl transition text-left">
                                Change Password
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="lg:col-span-8 space-y-6">

                    {/* Next Match */}
                    <div className="bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl p-8 border border-green-500/20 shadow-xl">

                        {/* <div className="flex justify-between mb-6">
                            <h3 className="text-xl font-bold">Next Match</h3>
                            <span className="bg-green-500 text-black text-xs px-3 py-1 rounded-full font-bold">
                                LIVE Soon
                            </span>
                        </div> */}

                        {/* <div className="flex justify-around text-center items-center">

                            <div>
                                <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center mb-2">
                                    Team A
                                </div>
                                <span className="text-sm text-gray-400">Your Team</span>
                            </div>

                            <div className="text-2xl font-bold text-gray-500">VS</div>

                            <div>
                                <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center mb-2">
                                    Team B
                                </div>
                                <span className="text-sm text-gray-400">Opponent</span>
                            </div>

                        </div> */}

                    </div>

                    {/* Player Info */}
                    <div className="grid md:grid-cols-2 gap-4">

                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <span className="text-gray-400 block mb-1">
                                Email
                            </span>
                            <span className="font-medium">
                                {userData?.email}
                            </span>
                        </div>

                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <span className="text-gray-400 block mb-1">
                                Your Position in Your Team
                            </span>
                            <span className="text-green-400 font-bold">
                                {userData?.position || "Not Selected"}
                            </span>
                        </div>

                    </div>

                </main>

            </div>
        </div>
    );
};

export default StudentDashboard;