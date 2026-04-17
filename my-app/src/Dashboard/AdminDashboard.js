import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import PlayersTab from "./PlayersTab";
import MatchesTab from "./MatchesTab";
import SettingsTab from "./SettingsTab";
import TeamsTab from "./TeamsTab";
import TournamentTab from "./TournamentTab";
import AIChatSidebar from "./AIChatSidebar";
import AddActionModal from "./AddActionModal";
import { FaUsers, FaUserPlus, FaCheck, FaRegCalendarAlt, FaCog, FaShieldAlt, FaPlus, FaRobot, FaSitemap } from 'react-icons/fa';
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
  const [allUsers, setAllUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [finishedMatches, setFinishedMatches] = useState([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      setStats(prev => ({ ...prev, total: all.length, free: all.filter(u => !u.hasTeam && u.role !== 'admin').length }));
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingTeams(all.filter(t => t.status === "pending"));
      setApprovedTeams(all.filter(t => t.status === "approved"));
      setStats(prev => ({ ...prev, pending: all.filter(t => t.status === "pending").length }));
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMatches(data);
      setLiveMatches(data.filter(m => m.status !== "completed"));
      setFinishedMatches(data.filter(m => (m.status || "").trim().toLowerCase() === "completed"));
    });

    return () => { unsubUsers(); unsubTeams(); unsubMatches(); };
  }, []);

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
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-50 flex flex-col font-['Lexend'] text-slate-800">
      <style>{`
.stadium-bg {
  position: relative;
  min-height: 100vh;

  background-image: url("/staduimPicture.jpg");
  background-size: cover;
  background-position: center;

}


/* كروت مش flat */
.glass {
  background: linear-gradient(145deg, #ffffff, #f1f5f9);
  border: 1px solid #e2e8f0;
  box-shadow: 
    0 4px 10px rgba(0, 0, 0, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(4px);
}

/* Scrollbar شيك */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #3b82f6, #2563eb);
  border-radius: 10px;
}
      `}</style>

      <div className="flex-1 flex flex-col stadium-bg overflow-hidden relative">
        <header className="w-full flex items-center p-6 md:p-8 justify-between 
bg-transparent 
border-b border-white/10 
backdrop-blur-sm 
shrink-0">
          <div className="flex items-center gap-4">

            <button active={false} onClick={() => setIsSidebarOpen(true)} className="text-green-200" >
              <BsGridFill className="size-9 text-green-100" /> Menu
            </button>
            <div>
              <h1 className="text-gray-200 text-2xl font-black">Admin Area</h1>
              <p className="text-gray-300 text-xs font-bold uppercase mt-1 tracking-widest">Management Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsAIChatOpen(true)} className="rounded-xl bg-slate-100 hover:bg-blue-100 p-3 border border-slate-200 flex  transition">
              <FaRobot className="text-blue-600 text-xl" />
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest shadow-md transition ">
              <FaPlus className="inline mr-2" /> Create New Team
            </button>
          </div>
        </header>

        <AIChatSidebar
          isOpen={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          stats={stats} players={filteredPlayers} matches={matches} teams={approvedTeams}
        />

        <AddActionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentTeamsCount={pendingTeams.length + approvedTeams.length}
          freeAgents={filteredPlayers.filter(p => !p.hasTeam)}
        />

        <main className="flex-1 overflow-y-auto px-6 md:px-12 py-10 pb-48 custom-scrollbar">
          {activeTab === "dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">

              {/* Stats */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 shadow-md hover:scale-[1.02] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white text-xl font-bold">Total Players</span>
                    <FaUsers className="text-blue-400 text-xl" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.total}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 shadow-md hover:scale-[1.02] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white text-xl font-bold">Pending Approval</span>
                    <FaRegCalendarAlt className="text-yellow-400 text-xl" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.pending}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 shadow-md hover:scale-[1.02] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white text-xl font-bold">Free Agents</span>
                    <FaUserPlus className="text-green-400 text-xl" />
                  </div>
                  <p className="text-3xl font-black text-white">{stats.free}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 shadow-md hover:scale-[1.02] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white text-xl font-bold">Matches</span>
                    <FaCheck className="text-purple-400 text-xl" />
                  </div>
                  <p className="text-3xl font-black text-white">{matches.length}</p>
                </div>
              </section>

              {/* Tabs */}
              <div className="flex gap-10 border-b pb-2 mb-3 mt-3">
                <button
                  onClick={() => setActiveClick("live")}
                  className={`font-bold text-3xl tracking-wide ${activeClick === "live"
                    ? "text-green-500 border-b-4 border-green-500 pb-1"
                    : "text-gray-300"
                    }`}
                >
                  Live
                </button>

                <button
                  onClick={() => setActiveClick("history")}
                  className={`font-bold text-3xl tracking-wide ${activeClick === "history"
                    ? "text-green-500 border-b-4 border-green-500 pb-1"
                    : "text-gray-300"
                    }`}
                >
                  Match History
                </button>

                <button
                  onClick={() => setActiveClick("requests")}
                  className={`font-bold text-3xl tracking-wide ${activeClick === "requests"
                    ? "text-green-800 border-b-4 border-green-500 pb-1"
                    : "text-black"
                    }`}
                >
                  Team Request ({pendingTeams.length})
                </button>
              </div>

              {activeClick === "live" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">



                  {liveMatches.map(match => (
                    <div key={match.id}
                      className="relative rounded-2xl p-5 
        bg-gradient-to-br from-slate-800 via-slate-700 to-blue-900/40
        border border-white/10
        shadow-md hover:shadow-xl hover:shadow-blue-500/10
        transition-all duration-300"
                    >

                      {/* 🔹 Top Row */}
                      <div className="flex justify-between items-center mb-4">

                        {/* Teams */}
                        <p className="text-white font-semibold text-2xl :text-base">

                        </p>

                        {/* Status */}
                        <span className="text-xs font-bold 
            text-green-400 
            border border-green-400/30 
            bg-green-500/10 
            p-3 rounded-full flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          LIVE
                        </span>
                      </div>

                      {/* 🔹 Bottom Row */}
                      <div className="flex items-center justify-between">


                        {/* Score */}
                        <div className="text-center flex-1">
                          <div className="flex justify-between items-center mb-4">
                            <p className="text-white font-semibold text-2xl :text-base flex items-center gap-2">
                              {match.team1Name}
                            </p>
                            <p className="text-white font-semibold text-2xl :text-base flex items-center gap-2">
                              {match.team2Name}
                            </p>
                          </div>
                          <p className="text-3xl font-black text-blue-400 tracking-wider">
                            {match.score || "0 - 0"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* HISTORY */}
              {activeClick === "history" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {finishedMatches.map(match => (
                    <div
                      key={match.id}
                      className="relative rounded-2xl p-5 
        bg-gradient-to-br from-slate-800 via-slate-700 to-blue-900/40
        border border-white/10
        shadow-md hover:shadow-xl hover:shadow-blue-500/10
        transition-all duration-300"
                    >
                      {/* Teams */}
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-white text-2xl">
                          {match.team1Name}
                        </span>

                        <span className="text-s text-slate-400">VS</span>

                        <span className="font-bold text-white text-2xl">
                          {match.team2Name}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="text-center mb-4">
                        <p className="text-3xl font-black text-yellow-400 tracking-wider">
                          {match.score || "0 - 0"}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        <span className="text-xs font-bold text-yellow-300 border border-yellow-400 px-3 py-1 rounded-full">
                          Finished
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TEAM REQUEST */}
              {activeClick === "requests" && (
                <div className="grid grid-cols-2 gap-6">
                  {pendingTeams.length > 0 ? (
                    pendingTeams.map(team => (
                      <div
                        key={team.id}
                        className="bg-gray rounded-xl p-6 shadow-sm border border-l-8 border-l-blue-600 hover:scale-[1.01] transition-all"
                      >
                        {/* Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                          <div>
                            <h3 className="text-slate-100 font-bold text-2xl">
                              {team.teamName}
                            </h3>
                            <p className="text-slate-500 text-sm">
                              Captain: {team.captainName || "Unknown"}
                            </p>
                          </div>

                          <span className="bg-blue-100 text-blue-600 px-4 py-1 rounded-lg text-sm font-bold">
                            {team.memberIds?.length || 0} Players
                          </span>
                        </div>

                        {/* Members */}
                        <div className="flex gap-2 flex-wrap mb-4">
                          {team.members?.map((name, i) => (
                            <span
                              key={i}
                              className="text-sm font-bold bg-slate-700 text-slate-100 px-3 py-1 rounded-lg border border-white/5"
                            >
                              • {name}
                            </span>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleApproveTeam(team.id)}
                            className="flex-1 bg-blue-600 text-white font-bold uppercase py-2 rounded-lg hover:bg-blue-500 transition-all shadow-lg"
                          >
                            Approve Team
                          </button>

                          <button
                            onClick={() => handleRejectTeam(team)}
                            className="flex-1 bg-red-500/10 font-bold uppercase py-2 text-red-400 hover:text-white rounded-lg hover:bg-red-500 transition-all border border-slate-300"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xl italic text-center py-10">
                      No pending requests at the moment.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "players" && <PlayersTab players={filteredPlayers} />}
          {activeTab === "teams" && <TeamsTab teams={approvedTeams} players={filteredPlayers} />}
          {activeTab === "tournament" && <TournamentTab teams={approvedTeams} />}
          {activeTab === "schedule" && <MatchesTab matches={matches} teams={approvedTeams} players={filteredPlayers} />}
          {activeTab === "settings" && <SettingsTab />}
        </main>

        {/* Overlay */}
        <div
          onClick={() => setIsSidebarOpen(false)}
          className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-all duration-300 ${isSidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
            }`}
        />

        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full w-72 z-[100] transform transition-transform duration-500 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="h-full bg-white border-r border-slate-200 shadow-xl p-6 flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-lg tracking-widest">MENU</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-Black text-xl"
              >
                ✕
              </button>
            </div>

            {/* Links */}
            <div className="flex flex-col space-y-3 gap-4 mt-6">
              <NavButton active={activeTab === "dashboard"} onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }} icon={<BsGridFill />} label="HOME" />
              <NavButton active={activeTab === "players"} onClick={() => { setActiveTab("players"); setIsSidebarOpen(false); }} icon={<FaUserPlus />} label="PLAYERS" />
              <NavButton active={activeTab === "teams"} onClick={() => { setActiveTab("teams"); setIsSidebarOpen(false); }} icon={<FaShieldAlt />} label="TEAMS" />
              <NavButton active={activeTab === "tournament"} onClick={() => { setActiveTab("tournament"); setIsSidebarOpen(false); }} icon={<FaSitemap />} label="DRAW" />
              <NavButton active={activeTab === "schedule"} onClick={() => { setActiveTab("schedule"); setIsSidebarOpen(false); }} icon={<FaRegCalendarAlt />} label="MATCHES" />
              <NavButton active={activeTab === "settings"} onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }} icon={<FaCog />} label="SETTINGS" />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
    <div>
      <p className="text-blue-500 text-xs font-bold uppercase tracking-widest">{label}</p>
      <p className="text-slate-900 text-xl font-black">{value}</p>
    </div>
    <div className={`text-3xl ${color} group-hover:scale-110 transition-transform `}>
      {icon}
    </div>
  </div>
);

const NavButton = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2 transition-all w-full rounded-lg
      ${active
        ? 'bg-blue-50 text-blue-600'
        : 'text-slate-600 hover:bg-slate-100'}`}
  >
    <div className="text-2xl">{icon}</div>
    <span className="text-xl font-bold uppercase tracking-wide">
      {label}
    </span>
  </button>
);

export default AdminDashboard;