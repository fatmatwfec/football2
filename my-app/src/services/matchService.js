import { db } from '../firebase';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, setDoc, writeBatch, increment, getDocs,
} from 'firebase/firestore';
import { advanceBracketWinner } from './tournamentService';

export const scheduleMatch = async (newMatch) => {
  const { team1Id, team2Id, team1Name, team2Name, date, time, pitch } = newMatch;

  if (!team1Id || !team2Id)  throw new Error('يجب اختيار الفريقين.');
  if (team1Id === team2Id)   throw new Error('لا يمكن جدولة فريق ضد نفسه.');
  if (!date || !time)        throw new Error('يجب تحديد التاريخ والوقت.');
  if (!pitch)                throw new Error('يجب تحديد الملعب.');

  const conflict = await checkScheduleConflict(team1Id, team2Id, date, time, pitch);
  if (conflict) throw new Error(conflict);

  // ✅ FIX: لا نحفظ الأسماء نهائياً — بنحفظ الـ IDs بس
  // الأسماء بتتحل دايماً من teams collection في الـ UI
  await addDoc(collection(db, 'matches'), {
    team1Id, team2Id,
    date, time, pitch,
    score:     '',
    status:    'scheduled',
    tournamentName: newMatch.tournamentName || "Friendly",
    createdAt: new Date(),
  });
};

const checkScheduleConflict = async (team1Id, team2Id, date, time, pitch) => {
  const snap       = await getDocs(collection(db, 'matches'));
  const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const dayMatches = allMatches.filter(
    m => m.date === date && m.status !== 'completed'
  );

  for (const m of dayMatches) {
    const mTime    = new Date(`${m.date} ${m.time}`);
    const newTime  = new Date(`${date} ${time}`);
    const diffMins = Math.abs(mTime - newTime) / 60000;

    // RULE: At least 30 minutes gap between matches (assuming 30 min duration + 30 min break = 60 mins total)
    const timeClash  = diffMins < 60; 

    const teamClash  =
      m.team1Id === team1Id || m.team1Id === team2Id ||
      m.team2Id === team1Id || m.team2Id === team2Id;
    const pitchClash = m.pitch === pitch;

    if (timeClash && teamClash) {
      return 'تعارض في الجدول: أحد الفريقين لديه مباراة أخرى في نفس الوقت تقريباً.';
    }
    if (timeClash && pitchClash) {
      return `تعارض في الملعب: الملعب "${pitch}" محجوز في نفس الوقت.`;
    }
  }

  return null;
};

export const prepareMatchForResult = async (match, players) => {
  // ✅ FIX: تأكد إن match.id موجود قبل أي عملية
  if (!match?.id) throw new Error('معرّف المباراة غير موجود.');

  const matchPlayers = players.filter(
    p => p.teamId === match.team1Id || p.teamId === match.team2Id
  );

  const batch   = writeBatch(db);
  let anyLifted = false;

  matchPlayers.forEach(player => {
    if (player.suspendedForNextMatch === true) {
      const update = {
        suspendedForNextMatch: false,
        suspendReason:         null,
      };

      if (
        player.suspendReason === 'yellow' ||
        player.suspendReason === 'accumulated'
      ) {
        update.yellowCards = 0;
      }

      batch.update(doc(db, 'users', player.id), update);
      anyLifted = true;
    }
  });

  if (anyLifted) await batch.commit();
};


export const finalizeMatch = async (match, formData, activePlayers) => {
  try {
    const score1 = parseInt(formData.score1) || 0;
    const score2 = parseInt(formData.score2) || 0;

    // تحديد الفائز (مع مراعاة ضربات الجزاء)
    let winnerId = null;
    let winnerName = null;

    if (score1 > score2) {
      winnerId = match.team1Id;
      winnerName = match.team1Name;
    } else if (score2 > score1) {
      winnerId = match.team2Id;
      winnerName = match.team2Name;
    } else {
      const pen1 = parseInt(formData.pen1) || 0;
      const pen2 = parseInt(formData.pen2) || 0;
      if (pen1 > pen2) {
        winnerId = match.team1Id;
        winnerName = match.team1Name;
      } else {
        winnerId = match.team2Id;
        winnerName = match.team2Name;
      }
    }

    // تأمين الأسماء في حالة لو مش موجودة في الـ match doc
    if (!winnerName) {
      const teamSnap = await getDoc(doc(db, 'teams', winnerId));
      winnerName = teamSnap.exists() ? teamSnap.data().teamName : 'Unknown Team';
    }

    // تجهيز إحصائيات اللاعبين
    const statsSnapshot = {};
    const batch = writeBatch(db);
    const tName = match.tournamentName || "General";

    activePlayers.forEach(player => {
      const g = parseInt(formData[`goals-${player.id}`]) || 0;
      const y = parseInt(formData[`yellow-${player.id}`]) || 0;
      const r = parseInt(formData[`red-${player.id}`]) || 0;

      if (g > 0 || y > 0 || r > 0) {
        statsSnapshot[player.id] = { goals: g, yellow: y, red: r };
        
        // تحديث اللاعب - إحصائيات عامة + إحصائيات البطولة دي بالذات
        const playerRef = doc(db, 'users', player.id);
        
        // بنستخدم Dot Notation عشان نحدث خانة البطولة المعينة في الـ Map
        batch.update(playerRef, {
          goals: increment(g),
          yellowCards: increment(y),
          redCards: increment(r),
          [`tournamentStats.${tName}.goals`]: increment(g),
          [`tournamentStats.${tName}.yellow`]: increment(y),
          [`tournamentStats.${tName}.red`]: increment(r),
        });
      }
    });

    // تطبيق الإنذارات/الإيقافات
    await applySuspensions(formData, activePlayers, batch);
    
    const updateData = {
      status: 'completed',
      score: `${score1} - ${score2}`,
      completedAt: new Date(),
      winnerName: winnerName || null, 
      statsSnapshot,
    };
    
    if (formData.pen1 && formData.pen2) {
      updateData.penalties = `${formData.pen1} - ${formData.pen2}`;
    }
    
    batch.update(doc(db, 'matches', match.id), updateData);

    // إذا كانت مباراة بطولة، نحدث الـ Bracket
    if (match.tournamentName && match.tournamentName !== "Friendly") {
      await advanceBracketWinner(
        winnerId,
        winnerName,
        match.team1Id, match.team2Id
      );
    }

    await batch.commit();
    return { ok: true };
  } catch (error) {
    console.error('Error finalizing match:', error);
    return { ok: false, error: error.message };
  }
};

const applySuspensions = async (raw, activePlayers, batch) => {
  for (const player of activePlayers) {
    const yellowInMatch = parseInt(raw[`yellow-${player.id}`]) || 0;
    const redInMatch    = parseInt(raw[`red-${player.id}`])    || 0;
    const totalYellow   = (player.yellowCards || 0) + yellowInMatch;

    let suspendReason = null;

    if (redInMatch >= 1) {
      suspendReason = 'red';
    } else if (yellowInMatch >= 2) {
      suspendReason = 'yellow';
    } else if (totalYellow >= 2) {
      suspendReason = 'accumulated';
    }

    if (suspendReason) {
      batch.update(doc(db, 'users', player.id), {
        suspendedForNextMatch: true,
        suspendReason,
      });
    }
  }
};

export const deleteMatch = async (match) => {
  if (!match?.id) throw new Error('معرّف المباراة غير موجود — لا يمكن الحذف.');

  const matchRef  = doc(db, 'matches', match.id);
  const matchSnap = await getDoc(matchRef);

  if (!matchSnap.exists()) {
    throw new Error(`المباراة غير موجودة في قاعدة البيانات (id: ${match.id})`);
  }

  const batch = writeBatch(db);

  if (match.status === 'completed' && match.statsSnapshot) {
    const tName = match.tournamentName || "General";
    Object.entries(match.statsSnapshot).forEach(([pId, stats]) => {
      batch.update(doc(db, 'users', pId), {
        goals:       increment(-(stats.goals  || 0)),
        yellowCards: increment(-(stats.yellow || 0)),
        redCards:    increment(-(stats.red    || 0)),
        [`tournamentStats.${tName}.goals`]: increment(-(stats.goals || 0)),
        [`tournamentStats.${tName}.yellow`]: increment(-(stats.yellow || 0)),
        [`tournamentStats.${tName}.red`]: increment(-(stats.red || 0)),
      });
    });
  }

  batch.delete(matchRef);
  await batch.commit();
};

export const syncMatchStatuses = async (matches) => {
  // تم إيقاف التحديث التلقائي في قاعدة البيانات لتجنب مشاكل فروق التوقيت
  // الاعتماد كلياً على توقيت جهاز المستخدم في العرض
  return;
};