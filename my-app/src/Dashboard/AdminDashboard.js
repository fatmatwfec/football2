import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import PlayersTab from "./PlayersTab";
import MatchesTab from "./MatchesTab";
import SettingsTab from "./SettingsTab";
import TeamsTab from "./TeamsTab";
import TournamentTab from "./TournamentTab";
import AIChatSidebar from "./AIChatSidebar";
import AddActionModal from "./AddActionModal";
import {
  FaUsers, FaRegCalendarAlt, FaUserPlus, FaCheck, FaRobot,
  FaShieldAlt, FaSitemap, FaCog, FaFutbol, FaHistory
} from 'react-icons/fa';
import { BsGridFill } from 'react-icons/bs';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeClick, setActiveClick] = useState("live");

  const [stats, setStats] = useState({ total: 0, pending: 0, free: 0 });
  const [pendingTeams, setPendingTeams] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      setStats(prev => ({ ...prev, total: all.length, free: all.filter(u => !u.hasTeam && u.role !== 'admin').length }));
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllTeams(all);
      setPendingTeams(all.filter(t => t.status === "pending"));
      setApprovedTeams(all.filter(t => t.status === "approved"));
      setStats(prev => ({ ...prev, pending: all.filter(t => t.status === "pending").length }));
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMatches(data);
    });

    return () => { unsubUsers(); unsubTeams(); unsubMatches(); };
  }, []);

  // ✅ مفيش players state منفصلة — البيانات بتيجي من Firebase في allUsers
  // لما الـ redCards بتتصفر في Firestore، الـ onSnapshot هيحدّث allUsers تلقائياً
  const handleUpdatePlayer = async (updatedPlayer) => {
    try {
      await updateDoc(doc(db, "users", updatedPlayer.id), { redCards: 0 });
    } catch (error) {
      console.error("Error updating player:", error);
    }
  };

  const resolveTeamName = useCallback(
    (teamId, fallback) => {
      const found = allTeams.find(t => t.id === teamId);
      return found?.teamName || fallback || '';
    },
    [allTeams],
  );

  const enrichedMatches = useMemo(() =>
    matches.map(m => ({
      ...m,
      team1Name: resolveTeamName(m.team1Id, m.team1Name),
      team2Name: resolveTeamName(m.team2Id, m.team2Name),
    })),
    [matches, resolveTeamName],
  );

  const now = Date.now();

  const liveMatches = useMemo(() =>
    enrichedMatches.filter((m) => {
      if (!m.date || !m.time) return false;
      const start = new Date(`${m.date} ${m.time}`).getTime();
      const end = start + 20 * 60 * 1000;
      return now >= start && now <= end;
    }),
    [enrichedMatches],
  );

  const finishedMatches = useMemo(() =>
    enrichedMatches.filter(m => (m.status || "").trim().toLowerCase() === "completed"),
    [enrichedMatches],
  );
  const countMatces = finishedMatches.length + liveMatches.length;

  const filteredPlayers = allUsers.filter(u => u.role !== 'admin');

  const handleApproveTeam = async (teamId) => {
    try {
      await updateDoc(doc(db, "teams", teamId), { status: "approved" });
      alert("تم قبول الفريق بنجاح!");
    } catch (error) {
      console.error("Error approving team:", error);
    }
  };

  const handleRejectTeam = async (team) => {
    if (!window.confirm(`هل أنت متأكد من رفض فريق ${team.teamName}؟ اللاعبين سيعودون Free Agents.`)) return;
    try {
      const batch = writeBatch(db);
      if (team.memberIds && team.memberIds.length > 0) {
        team.memberIds.forEach((playerId) => {
          const userRef = doc(db, "users", playerId);
          batch.update(userRef, { hasTeam: false, teamId: null, assignedTeam: null });
        });
      }
      batch.delete(doc(db, "teams", team.id));
      await batch.commit();
      alert("تم رفض الفريق وتحرير اللاعبين بنجاح.");
    } catch (error) {
      console.error("Error rejecting team:", error);
      alert("حدث خطأ أثناء معالجة الطلب.");
    }
  };

  return (
     <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-black via-slate-900 to-[#0a1927] font-['Lexend']">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #121821;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #00FF9C;
          border-radius: 10px;
        }
        .glow-on-hover:hover {
          box-shadow: 0 0 12px rgba(0, 255, 156, 0.3);
        }
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-slide-up {
          animation: fadeSlideUp 0.6s ease-out forwards;
        }
      `}</style>

      <div className="relative h-full w-full overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#00FF9C]/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]"></div>
        </div>

        {/* Header / Navbar */}
        <header className="relative z-20 w-full backdrop-blur-md bg-black/30 border-b border-white/10 sticky top-0">
          <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-between">
            {/* Logo */}
             <div className="flex items-center gap-3">
              <div className="w-20 h-20 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-3xl flex items-center justify-center">
                <span className="text-black font-black text-4xl">SFC</span>
              </div>
              <div>
                <h1 className="text-white text-3xl font-bold tracking-tight">Science FC League</h1>
              </div>
            </div>

            {/* Center Navigation */}
            <div className="hidden md:flex items-center text-2xl gap-8">
              {['Home', 'Matches', 'Teams', 'Players', 'Tournament', 'Settings'].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    if (item === 'Home') setActiveTab('dashboard');
                    if (item === 'Matches') setActiveTab('schedule');
                    if (item === 'Teams') setActiveTab('teams');
                    if (item === 'Players') setActiveTab('players');
                    if (item === 'Tournament') setActiveTab('tournament');
                    if (item === 'Settings') setActiveTab('settings');
                  }}
                  className={`text-gray-300  hover:text-white font-medium transition-colors pb-1 border-b-2 ${(item === 'Home' && activeTab === 'dashboard') ||
                    (item === 'Matches' && activeTab === 'schedule') ||
                    (item === 'Teams' && activeTab === 'teams') ||
                    (item === 'Players' && activeTab === 'players') ||
                    (item === 'Tournament' && activeTab === 'tournament') ||
                    (item === 'Settings' && activeTab === 'settings')
                    ? 'border-[#00FF9C] text-white'
                    : 'border-transparent'
                    }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* Right Buttons */}
               <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAIChatOpen(true)}
                 className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                 <FaRobot className="text-2xl" />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                 className="bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-all duration-300 glow-on-hover"
                 >
                + Create Team
              </button>
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2.5 rounded-xl bg-white/5 border border-white/10 text-white"
              >
                <BsGridFill />
              </button>
            </div>
          </div>
        </header>

        <main className="relative z-10 w-full h-[calc(100vh-73px)] overflow-y-auto custom-scrollbar">
          <div className="w-full px-6 lg:px-8 py-8">
            {/* HERO SECTION */}
            {activeTab === "dashboard" && (
              <div className="animate-fade-slide-up w-full">
                 <div className="text-center py-12 md:py-20">
                  <div className="inline-flex items-center gap-2 bg-[#00FF9C]/10 backdrop-blur-sm border border-[#00FF9C]/20 rounded-full px-4 py-1.5 mb-6">
                    <span className="w-2 h-2 bg-[#00FF9C] rounded-full animate-pulse"></span>
                    <span className="text-[#00FF9C] text-sm font-medium tracking-wide">LIVE TOURNAMENT</span>
                  </div>
                 <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-4 leading-tight">
                    Science Faculty Football
                  </h1>
                 <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-8">
                    The ultimate battle of skill, strategy, and passion. Watch your favorite faculty teams compete for glory.
                  </p>
                   <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => setActiveTab("schedule")}
                     className="bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold px-6 md:px-8 py-3 md:py-4 rounded-xl text-base md:text-lg hover:scale-105 transition-all duration-300 glow-on-hover flex items-center justify-center gap-2"
                    >
                      <FaFutbol /> View Matches
                    </button>
                    <button
                      onClick={() => setActiveTab("teams")}
                     className="bg-white/5 border border-white/10 text-white font-bold px-6 md:px-8 py-3 md:py-4 rounded-xl text-base md:text-lg hover:bg-white/10 hover:scale-105 transition-all duration-300 backdrop-blur-sm"
                    >
                      Browse Teams
                    </button>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-6">
                  <div className="bg-[#121821] border border-white/10 rounded-2xl p-5 md:p-6 hover:border-[#00FF9C]/30 transition-all group">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <span className="text-blue-500 text-xl md:text-xl font-medium">Total Players</span>
                      <FaUsers className="text-[#00FF9C] text-xl md:text-2xl group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-white">{stats.total}</p>
                    <p className="text-gray-500 text-lg mt-2">Registered athletes</p>
                  </div>

                  <div className="bg-[#121821] border border-white/10 rounded-2xl p-5 md:p-6 hover:border-[#00FF9C]/30 transition-all group">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <span className="text-yellow-400 text-xs md:text-xl font-medium">Pending Approval</span>
                      <FaRegCalendarAlt className="text-yellow-400 text-xl md:text-2xl group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-white">{stats.pending}</p>
                    <p className="text-gray-500 text-lg mt-2">Awaiting verification</p>
                  </div>

                  <div className="bg-[#121821] border border-white/10 rounded-2xl p-5 md:p-6 hover:border-[#00FF9C]/30 transition-all group">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <span className="text-green-400 text-xl md:text-xl font-medium">Free Agents</span>
                      <FaUserPlus className="text-[#00FF9C] text-xl md:text-2xl group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-white">{stats.free}</p>
                    <p className="text-gray-500 text-lg mt-2">Available players</p>
                  </div>

                  <div className="bg-[#121821] border border-white/10 rounded-2xl p-5 md:p-6 hover:border-[#00FF9C]/30 transition-all group">
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <span className="text-purple-400 text-xl md:text-xl font-medium">Total Matches</span>
                      <FaCheck className="text-purple-400 text-xl md:text-2xl group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-white">{countMatces}</p>
                    <p className="text-gray-500 text-lg mt-2">Scheduled & played</p>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex gap-6 md:gap-8 border-b border-white/10 mt-8 md:mt-12 mb-6 md:mb-8">
                  <button
                    onClick={() => setActiveClick("live")}
                    className={`pb-2 md:pb-3 px-1 font-bold text-base md:text-xl transition-all ${activeClick === "live"
                      ? "text-[#00FF9C] border-b-2 border-[#00FF9C]"
                      : "text-gray-400 hover:text-gray-300"
                      }`}
                  >
                    Live Matches
                  </button>
                  <button
                    onClick={() => setActiveClick("history")}
                    className={`pb-2 md:pb-3 px-1 font-bold text-base md:text-xl transition-all ${activeClick === "history"
                      ? "text-[#00FF9C] border-b-2 border-[#00FF9C]"
                      : "text-gray-400 hover:text-gray-300"
                      }`}
                  >
                    Match History
                  </button>
                  <button
                    onClick={() => setActiveClick("requests")}
                    className={`pb-2 md:pb-3 px-1 font-bold text-base md:text-xl transition-all relative ${activeClick === "requests"
                      ? "text-[#00FF9C] border-b-2 border-[#00FF9C]"
                      : "text-gray-400 hover:text-gray-300"
                      }`}
                  >
                    Team Requests
                    {pendingTeams.length > 0 && (
                      <span className="absolute -top-1 -right-2 bg-[#00FF9C] text-black text-lg font-bold rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                        {pendingTeams.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* LIVE MATCHES */}
                {activeClick === "live" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {liveMatches.length === 0 ? (
                      <div className="col-span-full text-center py-12 md:py-16 bg-[#121821] rounded-2xl border border-white/10">
                        <FaFutbol className="text-4xl md:text-5xl text-gray-600 mx-auto mb-3 md:mb-4" />
                        <p className="text-gray-400 text-base md:text-lg">No live matches at the moment</p>
                        <p className="text-gray-500 text-lg">Check back during match hours</p>
                      </div>
                    ) : (
                      liveMatches.map(match => (
                        <div key={match.id} className="bg-[#121821] border border-white/10 rounded-2xl overflow-hidden hover:border-[#00FF9C]/30 transition-all group">
                          <div className="p-4 md:p-6">
                            <div className="flex justify-between items-center mb-4 md:mb-6">
                              <span className="text-lg font-bold text-[#00FF9C] bg-[#00FF9C]/10 px-2 md:px-3 py-1 rounded-full flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#00FF9C] rounded-full animate-pulse"></span>
                                LIVE NOW
                              </span>
                              <span className="text-gray-500 text-lg">Week {match.week || 1}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 md:gap-4">
                              <div className="text-center flex-1">
                                <p className="text-white font-bold text-base md:text-xl mb-2">{match.team1Name}</p>
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl mx-auto flex items-center justify-center">
                                  <span className="text-xl md:text-2xl">⚽</span>
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl md:text-3xl font-black text-[#00FF9C]">{match.score || "0 - 0"}</p>
                                <p className="text-gray-500 text-xs mt-1">vs</p>
                              </div>
                              <div className="text-center flex-1">
                                <p className="text-white font-bold text-base md:text-xl mb-2">{match.team2Name}</p>
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl mx-auto flex items-center justify-center">
                                  <span className="text-xl md:text-2xl">⚽</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* MATCH HISTORY */}
                {activeClick === "history" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {finishedMatches.length === 0 ? (
                      <div className="col-span-full text-center py-12 md:py-16 bg-[#121821] rounded-2xl border border-white/10">
                        <FaHistory className="text-4xl md:text-5xl text-gray-600 mx-auto mb-3 md:mb-4" />
                        <p className="text-white text-base md:text-xlg">No finished matches yet</p>
                        <p className="text-gray-400 text-lg">Completed matches will appear here</p>
                      </div>
                    ) : (
                      finishedMatches.map(match => (
                        <div key={match.id} className="bg-[#121821] border border-white/10 rounded-2xl p-4 md:p-6 hover:border-white/20 transition-all">
                          <div className="flex items-center justify-between mb-3 md:mb-4">
                            <span className="font-bold text-white text-base md:text-lg">{match.team1Name}</span>
                            <span className="text-gray-500 text-xs md:text-sm">VS</span>
                            <span className="font-bold text-white text-base md:text-lg">{match.team2Name}</span>
                          </div>
                          <div className="text-center mb-3 md:mb-4">
                            <p className="text-2xl md:text-3xl font-black text-yellow-400">{match.score || "0 - 0"}</p>
                          </div>
                          <div className="flex justify-center">
                            <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 md:px-3 py-1 rounded-full">Finished</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TEAM REQUESTS */}
                {activeClick === "requests" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {pendingTeams.length > 0 ? (
                      pendingTeams.map(team => (
                        <div key={team.id} className="bg-[#121821] border border-white/10 rounded-2xl overflow-hidden">
                          <div className="p-4 md:p-6">
                            <div className="flex flex-wrap justify-between items-start gap-3 md:gap-4 mb-3 md:mb-4">
                              <div>
                                <h3 className="text-white font-bold text-xl md:text-2xl">{team.teamName}</h3>
                                <p className="text-gray-400 text-xs md:text-sm mt-1">Captain: {team.captainName || "Unknown"}</p>
                              </div>
                              <span className="bg-[#00FF9C]/10 text-[#00FF9C] px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium">
                                {team.memberIds?.length || 0} Players
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 md:gap-2 mb-4 md:mb-6">
                              {team.members?.slice(0, 5).map((name, i) => (
                                <span key={i} className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded-lg">
                                  {name}
                                </span>
                              ))}
                              {team.members?.length > 5 && (
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded-lg">
                                  +{team.members.length - 5} more
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleApproveTeam(team.id)}
                                className="flex-1 bg-gradient-to-r from-[#00FF9C] to-emerald-600 text-black font-bold py-2 rounded-xl hover:scale-105 transition-all text-sm md:text-base"
                              >
                                Approve Team
                              </button>
                              <button
                                onClick={() => handleRejectTeam(team)}
                                className="flex-1 bg-white/5 border border-white/10 text-gray-300 font-bold py-2 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all text-sm md:text-base"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 md:py-16 bg-[#121821] rounded-2xl border border-white/10">
                        <FaUsers className="text-4xl md:text-5xl text-gray-600 mx-auto mb-3 md:mb-4" />
                        <p className="text-gray-400 text-base md:text-lg">No pending team requests</p>
                        <p className="text-gray-500 text-sm">All teams have been reviewed</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/*  PLAYERS TAB  */}
            {activeTab === "players" && (
              <div className="animate-fade-slide-up">
                <PlayersTab
                  players={filteredPlayers}
                  matches={enrichedMatches}
                  teams={approvedTeams}
                />
              </div>
            )}

            {/*  TEAMS TAB  */}
            {activeTab === "teams" && (
              <div className="animate-fade-slide-up">
                <TeamsTab teams={approvedTeams} players={filteredPlayers} matches={enrichedMatches} />
              </div>
            )}

            {activeTab === "tournament" && (
              <div className="animate-fade-slide-up">
                <TournamentTab teams={approvedTeams} />
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="animate-fade-slide-up">
                <MatchesTab matches={matches} teams={approvedTeams} players={filteredPlayers} />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="animate-fade-slide-up">
                <SettingsTab />
              </div>
            )}
          </div>
        </main>

        {/* Sidebar Overlay */}
        <div
          onClick={() => setIsSidebarOpen(false)}
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] transition-all duration-300 ${isSidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
            }`}
        />

        {/* Mobile Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full w-80 z-[100] transform transition-transform duration-500 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="h-full bg-[#0a0f16] border-r border-white/10 p-6 flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#00FF9C] to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">SFC</span>
                </div>
                <h2 className="text-white font-bold">Menu</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 text-2xl hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "dashboard"
                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <BsGridFill className="text-xl" />
                <span className="font-medium">HOME</span>
              </button>
              <button
                onClick={() => { setActiveTab("players"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "players"
                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <FaUserPlus className="text-xl" />
                <span className="font-medium">PLAYERS</span>
              </button>
              <button
                onClick={() => { setActiveTab("teams"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "teams"
                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <FaShieldAlt className="text-xl" />
                <span className="font-medium">TEAMS</span>
              </button>
              <button
                onClick={() => { setActiveTab("tournament"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "tournament"
                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <FaSitemap className="text-xl" />
                <span className="font-medium">TOURNAMENT</span>
              </button>
              <button
                onClick={() => { setActiveTab("schedule"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "schedule"
                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <FaRegCalendarAlt className="text-xl" />
                <span className="font-medium">MATCHES</span>
              </button>
              <button
                onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "settings"
                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <FaCog className="text-xl" />
                <span className="font-medium">SETTINGS</span>
              </button>
            </div>
          </div>
        </div>

        <AIChatSidebar
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          stats={stats}
          players={filteredPlayers}
          matches={enrichedMatches}
          teams={approvedTeams}
          onUpdatePlayer={handleUpdatePlayer}
        />

        <AddActionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentTeamsCount={pendingTeams.length + approvedTeams.length}
          freeAgents={filteredPlayers.filter(p => !p.hasTeam)}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;