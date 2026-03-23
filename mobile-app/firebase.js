 

import { initializeApp } from "firebase/app"; 
import { getAuth } from "firebase/auth"; 
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyDdMuHhfYiGDokBwEj_seBaQSrO9c_ertI",
  authDomain: "football-tournament-f8545.firebaseapp.com",
  projectId: "football-tournament-f8545",
  storageBucket: "football-tournament-f8545.firebasestorage.app",
  messagingSenderId: "833048671728",
  appId: "1:833048671728:web:f5f27fc88f5973da37d935",
  measurementId: "G-C3DK7R47NQ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

 