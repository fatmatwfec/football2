import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import {
    FaArrowLeft, FaFutbol, FaTrophy, FaUserAlt,
    FaEnvelope, FaPhone, FaIdCard, FaRunning,
    FaShieldAlt, FaStar, FaHandshake
} from 'react-icons/fa';

const PlayerProfile = () => {
    const { playerId } = useParams();
    const navigate = useNavigate();
    const [player, setPlayer] = useState(null);
    const [team, setTeam] = useState(null);
    const [matchHistory, setMatchHistory] = useState([]);
    const [stats, setStats] = useState({ played: 0, won: 0, lost: 0, drawn: 0, goalsScored: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!playerId) return;

        const fetchData = async () => {
            try {
                // 1. Fetch player (user) doc — try by doc ID first, then by uid field
                let playerData = null;
                const byDocId = await getDoc(doc(db, 'users', playerId));
                if (byDocId.exists()) {
                    playerData = { id: byDocId.id, ...byDocId.data() };
                } else {
                    const q = query(collection(db, 'users'), where('uid', '==', playerId));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        playerData = { id: snap.docs[0].id, ...snap.docs[0].data() };
                    }
                }

                if (!playerData) {
                    alert('Player not found!');
                    navigate(-1);
                    return;
                }
                setPlayer(playerData);

                // 2. Fetch team data if player has a team
                if (playerData.teamId) {
                    const teamSnap = await getDoc(doc(db, 'teams', playerData.teamId));
                    if (teamSnap.exists()) {
                        setTeam({ id: teamSnap.id, ...teamSnap.data() });
                    }
                }

                // 3. Fetch completed matches involving the player's team
                if (playerData.teamId) {
                    const matchSnap = await getDocs(
                        query(collection(db, 'matches'), where('status', '==', 'completed'))
                    );

                    let played = 0, won = 0, lost = 0, drawn = 0, goalsScored = 0;
                    const history = [];

                    matchSnap.docs.forEach(d => {
                        const m = d.data();
                        const isTeam1 = m.team1Id === playerData.teamId;
                        const isTeam2 = m.team2Id === playerData.teamId;
                        if (!isTeam1 && !isTeam2) return;

                        played++;
                        const scores = (m.score || '0-0').replace(/ /g, '').split('-').map(s => parseInt(s) || 0);
                        const myScore = isTeam1 ? scores[0] : scores[1];
                        const oppScore = isTeam1 ? scores[1] : scores[0];
                        goalsScored += myScore;

                        let result = 'Draw';
                        if (myScore > oppScore) { won++; result = 'Win'; }
                        else if (myScore < oppScore) { lost++; result = 'Loss'; }
                        else drawn++;

                        history.push({
                            id: d.id,
                            date: m.date,
                            myTeam: isTeam1 ? (m.team1Name || 'My Team') : (m.team2Name || 'My Team'),
                            opponent: isTeam1 ? (m.team2Name || 'Opponent') : (m.team1Name || 'Opponent'),
                            score: m.score || '0-0',
                            myScore,
                            oppScore,
                            result,
                            tournamentName: m.tournamentName || null,
                        });
                    });

                    history.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    setMatchHistory(history);
                    setStats({ played, won, lost, drawn, goalsScored });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [playerId, navigate]);

    const positionColor = {
        Forward: 'text-red-400 bg-red-500/10 border-red-500/20',
        Midfielder: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        Defender: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        Goalkeeper: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    };
    const posClass = positionColor[player?.position] || 'text-gray-400 bg-white/5 border-white/10';

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0f16] text-white pb-16" style={{ fontFamily: "'Lexend', sans-serif" }}>

            {/* ── Hero Header ── */}
            <div className="relative h-56 w-full overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000')] bg-cover bg-center opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/30 via-transparent to-[#0a0f16]" />
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-8 left-8 z-20 flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-all text-sm font-bold"
                >
                    <FaArrowLeft /> Back
                </button>
            </div>

            {/* Avatar — outside overflow-hidden hero, overlapping with -mt */}
            <div className="flex justify-center -mt-16 relative z-20 mb-4">
                <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-emerald-500 to-emerald-800 flex items-center justify-center text-5xl font-black text-black shadow-2xl shadow-emerald-500/30 border-4 border-[#0a0f16] overflow-hidden">
                    {player?.photo ? (
                        <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                        player?.name?.[0]?.toUpperCase() || '?'
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6">

                {/* ── Player Identity ── */}
                <div className="text-center mb-10">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <h1 className="text-4xl font-black tracking-tight">{player?.name}</h1>
                        {player?.uid === team?.captainId && (
                            <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-yellow-500/20">
                                ⭐ Leader
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-3 flex-wrap mt-2">
                        {player?.position && (
                            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${posClass}`}>
                                {player.position}
                            </span>
                        )}
                        {team && (
                            <span
                                onClick={() => navigate(`/team/${team.id}`)}
                                className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full cursor-pointer hover:bg-emerald-500/20 transition-all uppercase tracking-widest"
                            >
                                🏟️ {team.teamName}
                            </span>
                        )}
                        {player?.studentCode && (
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                                ID: {player.studentCode}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Stats Grid ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                    <StatBox icon={<FaFutbol className="text-blue-400" />}  label="Played"  value={stats.played} />
                    <StatBox icon={<FaTrophy className="text-yellow-400" />} label="Wins"    value={stats.won} accent="text-yellow-400" />
                    <StatBox icon={<FaRunning className="text-red-400" />}   label="Losses"  value={stats.lost} accent="text-red-400" />
                    <StatBox icon={<FaHandshake className="text-blue-300" />} label="Draws"  value={stats.drawn} accent="text-blue-300" />
                    <StatBox icon={<FaStar className="text-emerald-400" />}  label="Goals"   value={stats.goalsScored} accent="text-emerald-400" />
                </div>

                {/* ── Cards Info ── */}
                {(player?.yellowCards > 0 || player?.redCards > 0) && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-10 flex items-center gap-8">
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Discipline</p>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-6 bg-yellow-400 rounded-sm shadow-[0_0_10px_rgba(250,204,21,0.4)]" />
                            <span className="text-white font-black text-lg">{player?.yellowCards || 0}</span>
                            <span className="text-gray-500 text-xs ml-1">Yellow</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-6 bg-red-600 rounded-sm shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                            <span className="text-white font-black text-lg">{player?.redCards || 0}</span>
                            <span className="text-gray-500 text-xs ml-1">Red</span>
                        </div>
                        {player?.redCards > 0 && (
                            <span className="ml-auto text-xs text-red-500 font-bold uppercase animate-pulse">⚠ Suspended</span>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Match History ── */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-black mb-5 flex items-center gap-3">
                            <FaFutbol className="text-emerald-400" /> Match History
                        </h2>
                        {matchHistory.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center text-gray-500 italic">
                                No completed matches found yet.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                                {matchHistory.map(m => {
                                    const resultColor = m.result === 'Win' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
                                        : m.result === 'Loss' ? 'text-red-400 border-red-500/30 bg-red-500/5'
                                            : 'text-blue-400 border-blue-500/30 bg-blue-500/5';
                                    return (
                                        <div key={m.id} className={`flex items-center justify-between p-4 rounded-2xl border ${resultColor}`}>
                                            <div className="flex flex-col gap-0.5">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.date || '—'}</p>
                                                <p className="text-sm font-black text-white">{m.myTeam} <span className="text-gray-500">vs</span> {m.opponent}</p>
                                                {m.tournamentName && <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-widest">{m.tournamentName}</p>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-lg font-black">{m.score}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${resultColor}`}>{m.result}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Sidebar Info ── */}
                    <div className="space-y-6">
                        {/* Contact */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <h3 className="text-lg font-black mb-5 flex items-center gap-2">
                                <FaIdCard className="text-emerald-400" /> Contact
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                        <FaEnvelope className="text-emerald-400" size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Email</p>
                                        <p className="text-xs text-white font-bold break-all">{player?.email || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                        <FaPhone className="text-blue-400" size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Phone</p>
                                        <p className="text-xs text-white font-bold">{player?.phone || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Performance Summary */}
                        <div className="bg-gradient-to-br from-emerald-900/20 to-transparent border border-emerald-500/20 rounded-3xl p-6">
                            <h3 className="text-lg font-black mb-4 text-emerald-400 flex items-center gap-2">
                                <FaShieldAlt /> Performance
                            </h3>
                            <div className="space-y-3">
                                <PerfRow label="Win Rate" value={stats.played > 0 ? `${Math.round((stats.won / stats.played) * 100)}%` : '—'} />
                                <PerfRow label="Goals / Game" value={stats.played > 0 ? (stats.goalsScored / stats.played).toFixed(1) : '—'} />
                                <PerfRow label="Team Status" value={player?.hasTeam ? 'In Team' : 'Free Agent'} color={player?.hasTeam ? 'text-emerald-400' : 'text-orange-400'} />
                                <PerfRow label="Role" value={player?.uid === team?.captainId ? 'Team Leader' : 'Player'} color={player?.uid === team?.captainId ? 'text-yellow-400' : 'text-white'} />
                            </div>
                        </div>

                        {/* User Account */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <h3 className="text-base font-black mb-4 flex items-center gap-2">
                                <FaUserAlt className="text-gray-400" size={12} /> Account
                            </h3>
                            <div className="space-y-3">
                                <PerfRow label="Student ID" value={player?.studentCode || '—'} />
                                <PerfRow label="Faculty" value="Science" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Sub-components ──────────────────────────────────────────────

const StatBox = ({ icon, label, value, accent = 'text-white' }) => (
    <div className="bg-black/40 border border-white/5 rounded-3xl p-5 text-center hover:border-white/20 transition-all group">
        <div className="text-xl mb-2 flex justify-center group-hover:scale-110 transition-transform">{icon}</div>
        <p className={`text-2xl font-black ${accent}`}>{value}</p>
        <p className="text-gray-500 text-[9px] uppercase font-black tracking-widest mt-1">{label}</p>
    </div>
);

const PerfRow = ({ label, value, color = 'text-white' }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500 font-bold">{label}</span>
        <span className={`font-black ${color}`}>{value}</span>
    </div>
);

export default PlayerProfile;
