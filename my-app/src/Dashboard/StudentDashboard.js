import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase'; // تأكدي من مسار ملف الفايربيس عندك
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

const StudentDashboard = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (users) => {
            if (users) {
                try {
                    // جلب البيانات من كولكشن user باستخدام UID الطالب
                    const userDocRef = doc(db, "users", users.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        setUserData({
                            ...userDoc.data(),
                            email: users.email
                        });
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                navigate('/login');
            }
        });
        return () => unsubscribe(); // تنظيف الـ listener عند إغلاق المكون
    }, [navigate]);

    const handleSignOut = () => {
        signOut(auth).then(() => {
            navigate('/login');
        });
    };
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        // يجب أن يكون كل شيء داخل div واحد أو Fragment
        <div className="min-h-screen bg-gray-900 text-white p-4 font-['Cairo']" dir="rtl">

            {/* Navbar Section */}
            <nav className="max-w-4xl mx-auto flex justify-between items-center py-6 border-b border-gray-800">
                <button
                    onClick={handleSignOut}
                    className="text-red-400 hover:text-red-300 transition flex items-center gap-2"
                >
                    <span>SignOut</span>
                    <i className="fas fa-sign-out-alt"></i>
                </button>
            </nav>

            <main className="max-w-2xl mx-auto mt-10">
                {/* Profile Card */}
                <div className="bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>
                    <div className="w-20 h-20 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                        {/* عرض أول حرف من الاسم */}
                        <span className="text-3xl text-gray-400 uppercase">
                            {userData?.name ? userData.name[0] : 'U'}
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold">{userData?.name || "لاعب جديد"}</h2>
                    <p className="text-gray-400 text-sm">ID: {userData?.studentCode || "---"}</p>

                    <div className={`mt-4 inline-block px-4 py-1 rounded-full text-xs font-bold ${userData?.teamStatus === "مقبول" ? "bg-green-500/20 text-green-500" : "bg-gray-700 text-gray-400"
                        }`}>
                        {userData?.assignedTeam || "بانتظار التسجيل"}
                    </div>
                </div>

                {/* Info Section */}
                <div className="mt-8 space-y-4">
                    <h3 className="text-lg font-bold px-2 flex items-center gap-2">
                        المعلومات الشخصية
                    </h3>
                    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 space-y-4">
                        <div className="flex justify-between border-b border-gray-700 pb-2">
                            <span className="text-gray-400">Email</span>
                            <span>{userData?.email}</span>
                        </div>
                        {/* <div className="flex justify-between">
                            <span className="text-gray-400">المركز المفضل</span>
                            <span className="text-blue-400">{userData?.position || "غير محدد"}</span>
                        </div> */}
                    </div>
                </div>
            </main>
        </div>
    );
};



export default StudentDashboard;