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
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 flex flex-col font-['Lexend'] text-slate-100">
      <style>{`

        .stadium-bg { 
            background-image: linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.85)), 
            url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2000'); 
            background-size: cover; background-position: center; background-attachment: fixed;
        }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.12); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(5, 209, 43, 0.83); border-radius: 10px; }
      `}</style>

      <div className="flex-1 flex flex-col stadium-bg overflow-hidden relative">
        <header className="w-full flex items-center p-6 md:p-8 justify-between z-[60] glass shadow-2xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button active={false} onClick={() => setIsSidebarOpen(true)} >
                <BsGridFill className="size-10" /> Menu
              </button>
            </div>


            <div>
              <h1 className="text-white text-3xl font-black leading-none tracking-tighter">Admin Area</h1>
              <p className="text-[11px] text-slate-400 text-sm font-black uppercase mt-1 tracking-[0.2em]">Management Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setIsAIChatOpen(true)} className="size-17 rounded-4xl bg-slate-900 hover:bg-indigo-500 rounded-lg p-3 border-blue-500/30 flex items-center justify-center hover:bg-gray-500 transition-all shadow-lg">
              <FaRobot className="text-blue-400 group-hover:text-white text-2xl" />
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-bold px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">
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

        <main className="flex-1 overflow-y-auto px-6 md:px-12 py-10 pb-48 custom-scrollbar relative z-10">
          {activeTab === "dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard label="Total Players" value={stats.total} icon={<FaUsers />} color="text-blue-500" />
                <StatCard label="Pending Approval" value={stats.pending} icon={<FaRegCalendarAlt />} color="text-yellow-500" />
                <StatCard label="Free Agents" value={stats.free} icon={<FaUserPlus />} color="text-green-500" />
                <StatCard label="Matches" value={matches.length} icon={<FaCheck />} color="text-purple-500" />
              </section>



              <h2 className="text-xs font-black uppercase text-slate-400 mb-4">
                🔴 Live Matches
              </h2>

              {liveMatches.map(match => (
                <div key={match.id} className="glass p-4 rounded-2xl mb-3">
                  <h3 className="text-white font-bold">
                    {match.team1Name} vs {match.team2Name}
                  </h3>
                  <p className="text-2xl font-black text-blue-500">
                    {match.score || "0-0"}
                  </p>
                  <p className="text-[10px] text-green-400">LIVE</p>
                </div>
              ))}

              <h2 className="text-xs font-black uppercase text-slate-400 mt-8 mb-4">
                📜 Match History
              </h2>

              {finishedMatches.map(match => (
                <div key={match.id} className="glass p-4 rounded-2xl mb-3 opacity-80">
                  <h3 className="text-white font-bold">
                    {match.team1Name} vs {match.team2Name}
                  </h3>
                  <p className="text-lg">
                    {match.score || "0-0"}
                  </p>
                  <p className="text-[10px] text-yellow-400">
                    Finished
                  </p>
                </div>
              ))}

              <h2 className="text-xl font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
                <span className="size-3 bg-blue-500 rounded-full animate-ping shadow-[0_0_10px_rgba(59,130,246,1)]"></span>
                Team Requests
              </h2>

              <div className="grid grid-cols-1 gap-6">
                {pendingTeams.map(team => (
                  <div key={team.id} className="bg-white rounded-xl p-6 shadow-sm border border-l-8 border-l-blue-600 hover:scale-[1.01] transition-all">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                      <div>
                        <h3 className="text-indigo-900 font-bold text-xl">{team.teamName}</h3>
                        <p className="text-slate-500">Captain: {team.captainName || "Unknown"}</p>
                      </div>
                      <span className="text-lg bg-blue-500/20 text-blue-400 px-6 py-2 rounded-xl border border-blue-500/30 font-black">
                        {team.memberIds?.length || 0} Players
                      </span>
                    </div>

                    <div className="mb-8 flex flex-wrap gap-3 bg-black/30 p-4 rounded-2xl">
                      {team.members && team.members.map((name, i) => (
                        <span key={i} className="text-sm font-bold bg-slate-900 text-slate-200 px-4 py-2 rounded-lg border border-white/5">
                          • {name}
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => handleApproveTeam(team.id)}
                        className="flex-1 bg-blue-600 text-sm font-black uppercase py-5 rounded-2xl hover:bg-blue-500 transition-all shadow-lg"
                      >
                        Approve Team
                      </button>
                      <button
                        onClick={() => handleRejectTeam(team)}
                        className="flex-1 bg-white/5 text-sm font-black uppercase py-5 rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-white/10"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {pendingTeams.length === 0 && <p className="text-slate-400 text-xl italic text-center py-10">No pending requests at the moment.</p>}
              </div>
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
          <div className="h-full bg-white/10 backdrop-blur-2xl border-r border-white/10 shadow-2xl p-6 flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-white font-black text-lg tracking-widest">MENU</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Links */}
            <div className="flex flex-col space-y-5 gap-4 mt-6">
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
  <div className="glass p-6 rounded-xl shadow-sm flex items-center justify-between">
    <div>
      <p className="text-slate-200 text-sm  font-black uppercase tracking-[0.2em] ">{label}</p>
      <p className="text-white text-2xl font-black  text-indigo-900 leading-non">{value}</p>
    </div>
    <div className={`text-3xl ${color} group-hover:scale-110 transition-transform `}>
      {icon}
    </div>
  </div>
);

const NavButton = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2 transition-all w-full
      ${active
        ? 'text-green scale-105'
        : 'text-slate-500 hover:text-blue-700'}`}
  >
    <div className="text-2xl">{icon}</div>
    <span className="text-xl font-bold uppercase tracking-wide">
      {label}
    </span>
  </button>
);

export default AdminDashboard;