import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { FaArrowLeft, FaFutbol, FaTrophy, FaUsers, FaEnvelope, FaPhone, FaIdCard, FaRunning } from 'react-icons/fa';

const TeamDetails = () => {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamStats, setTeamStats] = useState({ played: 0, won: 0, lost: 0, goals: 0 });

    useEffect(() => {
        if (!teamId) return;

        // Live listener for team data
        const unsubTeam = onSnapshot(doc(db, "teams", teamId), async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setTeam({ id: snap.id, ...data });

                // Fetch members data
                if (data.memberIds && data.memberIds.length > 0) {
                    const q = query(collection(db, "users"), where("uid", "in", data.memberIds));
                    const memberSnap = await getDocs(q);
                    const membersList = memberSnap.docs.map(d => d.data());
                    
                    // Sort members: Leader first, then by name
                    membersList.sort((a, b) => {
                        if (a.uid === data.captainId) return -1;
                        if (b.uid === data.captainId) return 1;
                        return (a.name || "").localeCompare(b.name || "");
                    });
                    setMembers(membersList);
                }
            } else {
                alert("Team not found!");
                navigate(-1);
            }
            setLoading(false);
        });

        // Calculate Team Stats from completed matches
        const fetchStats = async () => {
            const q = query(collection(db, "matches"), where("status", "==", "completed"));
            const matchSnap = await getDocs(q);
            let p = 0, w = 0, l = 0, g = 0;

            matchSnap.docs.forEach(doc => {
                const m = doc.data();
                const isTeam1 = m.team1Id === teamId;
                const isTeam2 = m.team2Id === teamId;

                if (isTeam1 || isTeam2) {
                    p++;
                    const scores = (m.score || "0 - 0").split("-").map(s => parseInt(s.trim()));
                    const myScore = isTeam1 ? scores[0] : scores[1];
                    const oppScore = isTeam1 ? scores[1] : scores[0];
                    
                    g += myScore;
                    if (myScore > oppScore) w++;
                    else if (myScore < oppScore) l++;
                }
            });
            setTeamStats({ played: p, won: w, lost: l, goals: g });
        };

        fetchStats();
        return () => unsubTeam();
    }, [teamId, navigate]);

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#00FF9C] border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0f16] text-white font-['Lexend'] pb-12">
            {/* Header Background */}
            <div className="relative h-64 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#00FF9C]/20 to-[#0a0f16] z-10"></div>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000')] bg-cover bg-center opacity-30"></div>
                
                {/* Back Button */}
                <button 
                    onClick={() => navigate(-1)}
                    className="absolute top-8 left-8 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                >
                    <FaArrowLeft /> Back
                </button>
            </div>

            <div className="max-w-6xl mx-auto px-6 -mt-32 relative z-20">
                {/* Team Profile Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                        <div className="w-40 h-40 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#00FF9C]/20">
                            <span className="text-black text-6xl font-black">{team?.teamName?.[0]}</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-4 justify-center md:justify-start mb-2">
                                <h1 className="text-4xl md:text-5xl font-black tracking-tight">{team?.teamName}</h1>
                                <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-yellow-500/20">
                                    Official Team
                                </span>
                            </div>
                            <p className="text-gray-400 text-lg flex items-center gap-2 justify-center md:justify-start">
                                <FaIdCard className="text-[#00FF9C]" />
                                Captained by <span className="text-white font-bold">{team?.captainName}</span>
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
                        <StatCard icon={<FaFutbol className="text-blue-400" />} label="Matches Played" value={teamStats.played} />
                        <StatCard icon={<FaTrophy className="text-yellow-400" />} label="Victories" value={teamStats.won} />
                        <StatCard icon={<FaRunning className="text-red-400" />} label="Defeats" value={teamStats.lost} />
                        <StatCard icon={<FaUsers className="text-[#00FF9C]" />} label="Total Goals" value={teamStats.goals} />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Squad Members */}
                    <div className="lg:col-span-2">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <FaUsers className="text-[#00FF9C]" /> Squad Members
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {members.map((member, i) => (
                                <MemberCard key={i} member={member} isCaptain={member.uid === team?.captainId} />
                            ))}
                        </div>
                    </div>

                    {/* Team Info / Achievements */}
                    <div className="space-y-8">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6">
                            <h3 className="text-xl font-bold mb-4">Team Info</h3>
                            <div className="space-y-4">
                                <InfoRow label="Status" value="Active" color="text-green-400" />
                                <InfoRow label="Established" value={team?.createdAt?.toDate ? new Date(team.createdAt.toDate()).toLocaleDateString() : "New Team"} />
                                <InfoRow label="Region" value="Science Faculty" />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-[#00FF9C]/10 to-transparent border border-[#00FF9C]/20 rounded-3xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-[#00FF9C]">Philosophy</h3>
                            <p className="text-gray-400 italic leading-relaxed">
                                "Our team is built on the spirit of discovery and competition. Every match is an experiment in excellence."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value }) => (
    <div className="bg-black/40 border border-white/5 rounded-3xl p-6 text-center hover:border-white/20 transition-all group">
        <div className="text-2xl mb-2 flex justify-center group-hover:scale-110 transition-transform">{icon}</div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">{label}</p>
    </div>
);

const MemberCard = ({ member, isCaptain }) => (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-all group">
        <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
            {member.name?.[0]}
        </div>
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <p className="font-bold text-white">{member.name}</p>
                {isCaptain && <span className="bg-yellow-500/20 text-yellow-500 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">Leader</span>}
            </div>
            <p className="text-xs text-gray-500">{member.position || "Player"}</p>
            <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                    <FaEnvelope size={8} className="text-emerald-500/50" />
                    <span className="text-[9px] text-gray-400 truncate max-w-[100px]">{member.email}</span>
                </div>
                {member.phone && (
                    <div className="flex items-center gap-1">
                        <FaPhone size={8} className="text-blue-500/50" />
                        <span className="text-[9px] text-gray-400">{member.phone}</span>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const InfoRow = ({ label, value, color = "text-white" }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">{label}</span>
        <span className={`font-bold ${color}`}>{value}</span>
    </div>
);

export default TeamDetails;
