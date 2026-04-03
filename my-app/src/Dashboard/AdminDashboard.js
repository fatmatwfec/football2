import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import PlayersTab from "./PlayersTab";
import MatchesTab from "./MatchesTab";
import SettingsTab from "./SettingsTab";
import TeamsTab from "./TeamsTab";
import AIChatSidebar from "./AIChatSidebar";
import { FaUsers, FaUserPlus, FaCheck, FaRegCalendarAlt, FaCog, FaShieldAlt, FaPlus, FaRobot } from 'react-icons/fa';
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
      setStats(prev => ({ ...prev, total: all.length, free: all.filter(u => !u.hasTeam).length }));
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

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 flex flex-col font-['Lexend'] text-slate-100">
      <style>{`
        .stadium-bg { 
            background-image: linear-gradient(to bottom, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.98)), 
            url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2000'); 
            background-size: cover; background-position: center; background-attachment: fixed;
        }
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}</style>
      
      {/* Wrapper to apply the background image correctly */}
      <div className="flex-1 flex flex-col stadium-bg overflow-hidden relative">
        
        {/* Header */}
        <header className="w-full flex items-center p-4 md:p-6 justify-between z-[60] glass shadow-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
              <BsGridFill className="text-blue-500 text-xl" />
            </div>
            <div>
              <h1 className="text-white text-lg font-bold leading-none tracking-tighter">Admin Portal</h1>
              <p className="text-[9px] text-blue-500 font-black uppercase mt-1 tracking-widest">AI Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsAIChatOpen(true)} className="size-11 rounded-2xl bg-slate-900 border border-blue-500/30 flex items-center justify-center hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/10">
              <FaRobot className="text-blue-400 group-hover:text-white text-xl" />
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">
              <FaPlus className="inline mr-1" /> New
            </button>
          </div>
        </header>

        {/* AI Sidebar Component */}
        <AIChatSidebar 
          isOpen={isAIChatOpen} 
          onClose={() => setIsAIChatOpen(false)} 
          stats={stats} players={allUsers} matches={matches} teams={approvedTeams} 
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-40 custom-scrollbar relative z-10">
          {activeTab === "dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  <StatCard label="Players" value={stats.total} icon={<FaUsers />} color="text-blue-500" />
                  <StatCard label="Pending" value={stats.pending} icon={<FaRegCalendarAlt />} color="text-yellow-500" />
                  <StatCard label="Free Agents" value={stats.free} icon={<FaUserPlus />} color="text-green-500" />
                  <StatCard label="Matches" value={matches.length} icon={<FaCheck />} color="text-purple-500" />
               </section>

               <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                 <span className="size-2 bg-blue-500 rounded-full animate-ping"></span> Team Requests
               </h2>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingTeams.map(team => (
                    <div key={team.id} className="glass rounded-3xl p-6 border-l-4 border-l-blue-600 hover:scale-[1.02] transition-all">
                      <h3 className="text-white font-black text-sm mb-4 uppercase tracking-tight">{team.teamName}</h3>
                      <div className="flex gap-2">
                         <button onClick={() => updateDoc(doc(db, "teams", team.id), { status: "approved" })} className="flex-1 bg-blue-600 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10">Approve</button>
                         <button onClick={() => updateDoc(doc(db, "teams", team.id), { status: "rejected" })} className="flex-1 bg-white/5 text-[10px] font-black uppercase py-3 rounded-xl hover:bg-white/10 transition-all border border-white/5">Reject</button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
          
          {activeTab === "players" && <PlayersTab players={allUsers} />}
          {activeTab === "teams" && <TeamsTab teams={approvedTeams} players={allUsers} />}
          {activeTab === "schedule" && <MatchesTab matches={matches} teams={approvedTeams} players={allUsers} />}
          {activeTab === "settings" && <SettingsTab />}
        </main>

        {/* Nav Bar */}
        <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/10 px-8 pb-10 pt-5 flex justify-between items-center z-[100] rounded-t-[3rem] bg-slate-900/90 backdrop-blur-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
          <NavButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<BsGridFill />} label="Home" />
          <NavButton active={activeTab === "players"} onClick={() => setActiveTab("players")} icon={<FaUserPlus />} label="Players" />
          <NavButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")} icon={<FaShieldAlt />} label="Teams" />
          <NavButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={<FaRegCalendarAlt />} label="Matches" />
          <NavButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<FaCog />} label="Settings" />
        </nav>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
    <div className="glass p-5 rounded-3xl flex flex-col gap-3 border border-white/5 group hover:border-blue-500/40 hover:bg-white/5 transition-all duration-300">
      <div className={`text-xl ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
      <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">{label}</p>
      <p className="text-white text-3xl font-black">{value}</p>
    </div>
);

const NavButton = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-500 scale-110' : 'text-slate-500 hover:text-white'}`}>
      <div className="text-2xl">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
);

export default AdminDashboard;