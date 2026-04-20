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

    const timeClash  = diffMins < 90;
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

    let winnerName = null;
    if (score1 > score2) {
      winnerName = match.team1Name;
    } else if (score2 > score1) {
      winnerName = match.team2Name;
    } else {
      const pen1 = parseInt(formData.pen1) || 0;
      const pen2 = parseInt(formData.pen2) || 0;
      if (pen1 > pen2) {
        winnerName = match.team1Name;
      } else if (pen2 > pen1) {
        winnerName = match.team2Name;
      }
    }
    
    const updateData = {
      status: 'completed',
      score: `${score1} - ${score2}`,
      completedAt: new Date(),
      winnerName: winnerName || null, 
    };
    
    if (formData.pen1 && formData.pen2) {
      updateData.penalties = `${formData.pen1} - ${formData.pen2}`;
    }
    
    await updateDoc(doc(db, 'matches', match.id), updateData);
    return { ok: true };
  } catch (error) {
    console.error('Error finalizing match:', error);
    return { ok: false, error: error.message };
  }
};

const applySuspensions = async (raw, activePlayers) => {
  const batch    = writeBatch(db);
  let anyApplied = false;

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
      anyApplied = true;
    }
  }

  if (anyApplied) await batch.commit();
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
    Object.entries(match.statsSnapshot).forEach(([pId, stats]) => {
      batch.update(doc(db, 'users', pId), {
        goals:       increment(-(stats.goals  || 0)),
        yellowCards: increment(-(stats.yellow || 0)),
        redCards:    increment(-(stats.red    || 0)),
      });
    });
  }

  batch.delete(matchRef);
  await batch.commit();
};

export const syncMatchStatuses = async (matches) => {
  const now   = new Date();
  const batch = writeBatch(db);
  let   any   = false;

  matches.forEach(m => {
    if (m.status !== 'scheduled') return;
    const start = new Date(`${m.date} ${m.time}`);
    const end   = new Date(start.getTime() + 90 * 60 * 1000);

    if (now >= start && now < end) {
      batch.update(doc(db, 'matches', m.id), { status: 'live' });
      any = true;
    }
  });

  if (any) await batch.commit();
};