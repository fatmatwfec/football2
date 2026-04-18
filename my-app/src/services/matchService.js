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

export const finalizeMatch = async (match, raw, activePlayers) => {
  // ✅ FIX: تأكد إن match.id موجود
  if (!match?.id) return { ok: false, error: 'معرّف المباراة غير موجود.' };

  const s1 = parseInt(raw.score1);
  const s2 = parseInt(raw.score2);

  if (isNaN(s1) || isNaN(s2)) return { ok: false, error: 'يجب إدخال النتيجة.' };
  if (s1 < 0 || s2 < 0)       return { ok: false, error: 'لا يمكن أن تكون النتيجة سالبة.' };

  let p1 = null, p2 = null;
  let finalWinnerId, finalWinnerName;

  if (s1 === s2) {
    p1 = parseInt(raw.pen1);
    p2 = parseInt(raw.pen2);

    if (isNaN(p1) || isNaN(p2)) return { ok: false, error: 'المباراة تعادلت — يجب إدخال نتيجة ضربات الجزاء.' };
    if (p1 < 0 || p2 < 0)       return { ok: false, error: 'نتيجة الجزاء لا يمكن أن تكون سالبة.' };
    if (p1 === p2)               return { ok: false, error: 'لا يمكن التعادل في ضربات الجزاء. لازم يكون في فائز.' };

    finalWinnerId   = p1 > p2 ? match.team1Id   : match.team2Id;
    // ✅ FIX: الاسم بييجي من match مباشرة (enriched في الـ UI)
    finalWinnerName = p1 > p2 ? match.team1Name : match.team2Name;
  } else {
    finalWinnerId   = s1 > s2 ? match.team1Id   : match.team2Id;
    finalWinnerName = s1 > s2 ? match.team1Name : match.team2Name;
  }

  let team1Goals = 0, team2Goals = 0;
  activePlayers.forEach(player => {
    const g = parseInt(raw[`goals-${player.id}`]) || 0;
    if (player.teamId === match.team1Id) team1Goals += g;
    if (player.teamId === match.team2Id) team2Goals += g;
  });

  if (team1Goals !== s1) return { ok: false, error: `أهداف لاعبي ${match.team1Name} (${team1Goals}) لا تساوي السكور (${s1}).` };
  if (team2Goals !== s2) return { ok: false, error: `أهداف لاعبي ${match.team2Name} (${team2Goals}) لا تساوي السكور (${s2}).` };

  const batch = writeBatch(db);

  const statsSnapshot = {};
  activePlayers.forEach(player => {
    const goals  = parseInt(raw[`goals-${player.id}`])  || 0;
    const yellow = parseInt(raw[`yellow-${player.id}`]) || 0;
    const red    = parseInt(raw[`red-${player.id}`])    || 0;

    if (goals > 0 || yellow > 0 || red > 0) {
      statsSnapshot[player.id] = { name: player.name, goals, yellow, red };
      batch.update(doc(db, 'users', player.id), {
        goals:       increment(goals),
        yellowCards: increment(yellow),
        redCards:    increment(red),
      });
    }
  });

  const matchUpdate = {
    score:       `${s1}-${s2}`,
    status:      'completed',
    statsSnapshot,
    winnerId:    finalWinnerId,
    winnerName:  finalWinnerName,
    finalizedAt: new Date(),
  };
  if (p1 !== null) matchUpdate.penalties = `${p1}-${p2}`;

  batch.update(doc(db, 'matches', match.id), matchUpdate);
  await batch.commit();
  await applySuspensions(raw, activePlayers);
  await advanceBracketWinner(finalWinnerId, finalWinnerName, match.team1Id, match.team2Id);

  return { ok: true };
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
  // ✅ FIX: تأكد إن match.id موجود وصالح قبل الحذف
  if (!match?.id) throw new Error('معرّف المباراة غير موجود — لا يمكن الحذف.');

  // ✅ FIX: تحقق إن الـ document موجود فعلاً في Firestore قبل الحذف
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