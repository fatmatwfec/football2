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

  const [stats, setStats] = useState({ total: 0, pending: 0, free: 0 });
  const [pendingTeams, setPendingTeams] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
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
      setPendingTeams(all.filter(t => t.status === "pending"));
      setApprovedTeams(all.filter(t => t.status === "approved"));
      setStats(prev => ({ ...prev, pending: all.filter(t => t.status === "pending").length }));
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
        /* تعديل: تفتيح الخلفية قليلاً (من 0.9 لـ 0.7) عشان صورة الملعب تنور */
        .stadium-bg { 
            background-image: linear-gradient(to bottom, rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.85)), 
            url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2000'); 
            background-size: cover; background-position: center; background-attachment: fixed;
        }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.12); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
      `}</style>

      <div className="flex-1 flex flex-col stadium-bg overflow-hidden relative">


        <header className="w-full flex items-center p-6 md:p-8 justify-between z-[60] glass shadow-2xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/30 p-3 rounded-xl border border-blue-500/40">
              <BsGridFill className="text-blue-500 text-3xl" />
            </div>
            <div>
              <h1 className="text-white text-3xl font-black leading-none tracking-tighter">ADMIN PORTAL</h1>
              <p className="text-[11px] text-blue-400 font-black uppercase mt-1 tracking-[0.2em]">Management Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setIsAIChatOpen(true)} className="size-14 rounded-2xl bg-slate-900 border border-blue-500/30 flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg">
              <FaRobot className="text-blue-400 group-hover:text-white text-2xl" />
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">
              <FaPlus className="inline mr-2" /> Create New
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

              <h2 className="text-xl font-black uppercase tracking-widest text-white mb-8 flex items-center gap-3">
                <span className="size-3 bg-blue-500 rounded-full animate-ping shadow-[0_0_10px_rgba(59,130,246,1)]"></span>
                Team Requests
              </h2>

              <div className="grid grid-cols-1 gap-6">
                {pendingTeams.map(team => (
                  <div key={team.id} className="glass rounded-[2rem] p-8 border-l-8 border-l-blue-600 hover:scale-[1.01] transition-all">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                      <div>
                        <h3 className="text-white font-black text-3xl uppercase tracking-tight mb-2">{team.teamName}</h3>
                        <p className="text-lg text-blue-400 font-bold italic">Captain: {team.captainName || "Unknown"}</p>
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

        <nav className="fixed bottom-0 left-0 right-0 glass border-t-2 border-white/10 px-12 pb-12 pt-8 flex justify-between items-center z-[100] rounded-t-[4rem] bg-slate-900/95 backdrop-blur-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
          <NavButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<BsGridFill />} label="HOME" />
          <NavButton active={activeTab === "players"} onClick={() => setActiveTab("players")} icon={<FaUserPlus />} label="PLAYERS" />
          <NavButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")} icon={<FaShieldAlt />} label="TEAMS" />
          <NavButton active={activeTab === "tournament"} onClick={() => setActiveTab("tournament")} icon={<FaSitemap />} label="DRAW" />
          <NavButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={<FaRegCalendarAlt />} label="MATCHES" />
          <NavButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<FaCog />} label="SETTINGS" />
        </nav>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="glass p-8 rounded-[2rem] flex flex-col gap-4 border border-white/10 group hover:border-blue-500/50 hover:bg-white/5 transition-all duration-300 shadow-xl">
    <div className={`text-4xl ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">{label}</p>
    <p className="text-white text-5xl font-black leading-none">{value}</p>
  </div>
);

const NavButton = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all ${active ? 'text-blue-500 scale-125' : 'text-slate-500 hover:text-white'}`}>
    <div className="text-3xl">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default AdminDashboard;