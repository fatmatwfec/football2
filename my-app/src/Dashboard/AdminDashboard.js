import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import PlayersTab from "./PlayersTab";
import MatchesTab from "./MatchesTab";
import SettingsTab from "./SettingsTab";
import TeamsTab from "./TeamsTab";
import AddActionModal from "./AddActionModal";
import { FaUsers, FaUserPlus, FaCheck, FaTimes, FaRegCalendarAlt, FaCog, FaShieldAlt } from 'react-icons/fa';
import { BsGridFill } from 'react-icons/bs';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [stats, setStats] = useState({ total: 0, pending: 0, free: 0, approved: 0 });
  const [pendingTeams, setPendingTeams] = useState([]);
  const [approvedTeams, setApprovedTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [freeAgents, setFreeAgents] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);

      const free = all.filter(u =>
        (u.role === "student" || u.role === "player") && (u.hasTeam === false || u.hasTeam === undefined)
      );

      setFreeAgents(free);
      setStats(prev => ({ ...prev, total: all.length, free: free.length }));
    });

    const unsubTeams = onSnapshot(collection(db, "teams"), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pending = all.filter(t => t.status === "pending");
      const approved = all.filter(t => t.status === "approved");

      setPendingTeams(pending);
      setApprovedTeams(approved);
      setStats(prev => ({ ...prev, pending: pending.length, approved: approved.length }));
    });

    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUsers(); unsubTeams(); unsubMatches(); };
  }, []);

  const handleApprove = async (id) => await updateDoc(doc(db, "teams", id), { status: "approved" });
  const handleReject = async (id) => await updateDoc(doc(db, "teams", id), { status: "rejected" });

  const handleAutoBuild = async () => {
    if (freeAgents.length < 5) return alert("Need at least 5 free agents!");
    const selected = freeAgents.slice(0, 5);
    const teamName = `Elite-${Math.floor(Math.random() * 999)}`;
    try {
      const teamRef = await addDoc(collection(db, "teams"), {
        teamName,
        status: "approved",
        members: selected.map(p => p.name),
        createdAt: new Date()
      });
      for (let p of selected) await updateDoc(doc(db, "users", p.id), { hasTeam: true });
      alert(`Team ${teamName} Created!`);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-y-auto bg-slate-950 stadium-bg z-[100] flex flex-col font-['Lexend'] antialiased text-slate-100">
      <style>{`
        .stadium-bg { 
            background-image: linear-gradient(to bottom, rgba(16, 22, 34, 0.9), rgba(16, 22, 34, 0.98)), url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000'); 
            background-size: cover; background-position: center; background-attachment: fixed;
        }
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
      `}
      </style>

      <header className="w-full flex items-center p-4 md:p-6 justify-between sticky top-0 z-50 glass shadow-2xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
            <BsGridFill className="text-blue-500 text-xl" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-none">Admin Portal</h1>
            <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-wider">League Management</p>
          </div>
        </div>
        <div className="size-10 rounded-full border-2 border-blue-500 bg-slate-800 flex items-center justify-center overflow-hidden">
          <span className="material-symbols-outlined text-slate-300">person</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 pb-32">
        {activeTab === "dashboard" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Registered" value={stats.total} icon={<FaUsers />} color="text-blue-500" trend="+12%" />
              <StatCard label="Pending" value={stats.pending} icon={<FaRegCalendarAlt />} color="text-yellow-500" trend="+5%" />
              <StatCard label="Free Agents" value={stats.free} icon={<FaUserPlus />} color="text-green-500" trend="-2%" />
              <StatCard label="Approved" value={stats.approved} icon={<FaCheck />} color="text-purple-500" trend="+8%" />
            </section>

            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Team Requests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTeams.map(team => (
                <div key={team.id} className="glass rounded-2xl p-5 flex flex-col gap-4 border-l-4 border-l-blue-500 transition-transform hover:scale-[1.01]">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className="size-12 rounded-lg glass flex items-center justify-center text-blue-500 font-bold text-xl">{team.teamName?.[0]}</div>
                      <div>
                        <h3 className="text-white font-bold">{team.teamName}</h3>
                        <p className="text-slate-400 text-xs italic">Captain: {team.captainName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full pt-2">
                    <button onClick={() => handleApprove(team.id)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                      <FaCheck /> Approve
                    </button>
                    <button onClick={() => handleReject(team.id)} className="flex-1 glass hover:bg-red-500/10 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                      <FaTimes /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "players" && <PlayersTab players={freeAgents} onAutoBuild={handleAutoBuild} />}
        {activeTab === "teams" && <TeamsTab teams={approvedTeams} players={allUsers} />}
        {activeTab === "schedule" && <MatchesTab matches={matches} />}
        {activeTab === "settings" && <SettingsTab />}
      </main>

      <AddActionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />


      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/10 pl-[4rem] pr-[4rem] pb-8 pt-4 flex justify-between items-center z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <NavButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<BsGridFill />} label="Home" />
        <NavButton active={activeTab === "players"} onClick={() => setActiveTab("players")} icon={<FaUserPlus />} label="Players" />


        <div className="relative -top-8">
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 size-14 rounded-full shadow-lg shadow-blue-600/40 flex items-center justify-center border-4 border-slate-950 text-white text-2xl hover:scale-110 transition-transform active:scale-95">
            +
          </button>
        </div>

        <NavButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")} icon={<FaShieldAlt />} label="Teams" />
        <NavButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={<FaRegCalendarAlt />} label="Matches" />
        <NavButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<FaCog />} label="Settings" />
      </nav>
    </div>
  );
};
const StatCard = ({ icon, label, value, trend, color }) => (
  <div className="glass p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
    <div className={`text-xl ${color}`}>{icon}</div>
    <p className="text-slate-400 text-[10px] font-medium uppercase">{label}</p>
    <div className="flex items-end justify-between">
      <p className="text-white text-2xl font-bold">{value}</p>
      <span className="text-accent-lime text-[10px] font-bold">{trend}</span>
    </div>
  </div>
);

const NavButton = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
    <div className="text-xl">{icon}</div>
    <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

export default AdminDashboard;