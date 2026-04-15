import { db } from '../firebase';
import {
  doc, getDoc, setDoc, deleteDoc, collection, addDoc, getDocs, orderBy, query,
} from 'firebase/firestore';

export const generateBracket = async (teams) => {
  if (!teams || teams.length < 3) throw new Error('يجب وجود 3 فرق على الأقل.');

  const numTeams   = teams.length;
  let bracketSize  = 4;
  if (numTeams > 4)  bracketSize = 8;
  if (numTeams > 8)  bracketSize = 16;
  if (numTeams > 16) bracketSize = 32;

  const shuffled  = [...teams].sort(() => Math.random() - 0.5);
  const numRounds = Math.log2(bracketSize);
  const rounds    = {};

  for (let r = 0; r < numRounds; r++) {
    const numMatches = bracketSize / Math.pow(2, r + 1);
    rounds[`${r}`]   = [];

    for (let m = 0; m < numMatches; m++) {
      const match = {
        id:            `r${r}_m${m}`,
        round:         r,
        matchIndex:    m,
        team1:         null,
        team2:         null,
        winner:        null,
        nextMatchId:   r < numRounds - 1 ? `r${r + 1}_m${Math.floor(m / 2)}` : null,
        isBye:         false,
        lockedByMatch: null,
      };

      if (r === 0) {
        if (m < numTeams) {
          match.team1 = { id: shuffled[m].id, name: shuffled[m].teamName };
        }
        const t2Idx = m + numMatches;
        if (t2Idx < numTeams) {
          match.team2 = { id: shuffled[t2Idx].id, name: shuffled[t2Idx].teamName };
        }
        if (match.team1 && !match.team2) {
          match.isBye  = true;
          match.winner = match.team1;
        }
      }

      rounds[`${r}`].push(match);
    }
  }

  rounds['0'].forEach(m => {
    if (m.winner && m.nextMatchId) {
      const [nextR, nextM] = parseNextMatchId(m.nextMatchId);
      if (m.matchIndex % 2 === 0) {
        rounds[nextR][nextM].team1 = m.winner;
      } else {
        rounds[nextR][nextM].team2 = m.winner;
      }
    }
  });

  await setDoc(doc(db, 'tournaments', 'main'), {
    status:      'locked',
    bracketSize,
    numTeams,
    rounds,
    createdAt:   new Date(),
  });
};

export const updateTeamNameInTournament = async (teamId, newName) => {
  const snap = await getDoc(doc(db, 'tournaments', 'main'));
  if (!snap.exists()) return; 

  const tData     = snap.data();
  const newRounds = JSON.parse(JSON.stringify(tData.rounds));
  let   changed   = false;

  for (const rKey of Object.keys(newRounds)) {
    for (const match of newRounds[rKey]) {
      if (match.team1?.id === teamId) {
        match.team1.name = newName;
        changed = true;
      }
      if (match.team2?.id === teamId) {
        match.team2.name = newName;
        changed = true;
      }
      if (match.winner?.id === teamId) {
        match.winner.name = newName;
        changed = true;
      }
    }
  }

  if (changed) {
    await setDoc(doc(db, 'tournaments', 'main'), { ...tData, rounds: newRounds });
  }
};

export const advanceBracketWinner = async (winnerId, winnerName, team1Id, team2Id) => {
  const snap = await getDoc(doc(db, 'tournaments', 'main'));
  if (!snap.exists()) return;

  const tData     = snap.data();
  const newRounds = JSON.parse(JSON.stringify(tData.rounds));
  let found       = false;

  for (const rKey of Object.keys(newRounds)) {
    for (const match of newRounds[rKey]) {
      const t1      = match.team1?.id;
      const t2      = match.team2?.id;
      const isMatch =
        (t1 === team1Id && t2 === team2Id) ||
        (t1 === team2Id && t2 === team1Id);

      if (isMatch && !match.winner) {
        match.winner        = { id: winnerId, name: winnerName };
        match.lockedByMatch = true;

        if (match.nextMatchId) {
          const [nextR, nextM] = parseNextMatchId(match.nextMatchId);
          if (match.matchIndex % 2 === 0) {
            newRounds[nextR][nextM].team1 = { id: winnerId, name: winnerName };
          } else {
            newRounds[nextR][nextM].team2 = { id: winnerId, name: winnerName };
          }
        }
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (found) {
    await setDoc(doc(db, 'tournaments', 'main'), { ...tData, rounds: newRounds });
  }
};

export const manualAdvanceWinner = async (tournament, match, winnerTeam) => {
  const newRounds = JSON.parse(JSON.stringify(tournament.rounds));
  const rIdx      = `${match.round}`;
  const mIdx      = match.matchIndex;

  newRounds[rIdx][mIdx].winner = winnerTeam;

  if (match.nextMatchId) {
    const [nextR, nextM] = parseNextMatchId(match.nextMatchId);
    if (mIdx % 2 === 0) {
      newRounds[nextR][nextM].team1 = winnerTeam;
    } else {
      newRounds[nextR][nextM].team2 = winnerTeam;
    }
  }

  await setDoc(doc(db, 'tournaments', 'main'), { ...tournament, rounds: newRounds });
};

export const clearTournament = async () => {
  const snap = await getDoc(doc(db, 'tournaments', 'main'));

  if (snap.exists()) {
    const data      = snap.data();
    const winner    = getTournamentWinner({ rounds: data.rounds });
    const archiveId = `tournament_${Date.now()}`;

    await setDoc(doc(db, 'tournaments_archive', archiveId), {
      ...data,
      archiveId,
      archivedAt:  new Date(),
      finalWinner: winner ?? null,
    });
  }

  await deleteDoc(doc(db, 'tournaments', 'main'));
};

export const fetchArchivedTournaments = async () => {
  const snap = await getDocs(collection(db, 'tournaments_archive'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aTime = a.archivedAt?.toDate?.() ?? new Date(0);
      const bTime = b.archivedAt?.toDate?.() ?? new Date(0);
      return bTime - aTime;
    });
};

export const getTournamentWinner = (tournament) => {
  if (!tournament?.rounds) return null;
  const keys      = Object.keys(tournament.rounds);
  const lastRound = tournament.rounds[`${keys.length - 1}`];
  return lastRound?.[0]?.winner ?? null;
};

export const getRoundLabel = (roundIndex, totalRounds) => {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-Finals';
  if (fromEnd === 2) return 'Quarter-Finals';
  return `Round ${roundIndex + 1}`;
};

export const buildMatchCache = (tournament) => {
  if (!tournament?.rounds) return {};
  const cache = {};
  Object.entries(tournament.rounds).forEach(([rKey, matches]) => {
    matches.forEach(m => {
      if (m.team1?.id && m.team2?.id) {
        const key = makeKey(m.team1.id, m.team2.id);
        cache[key] = { roundIndex: parseInt(rKey), match: m };
      }
    });
  });
  return cache;
};

export const getMatchRoundFromCache = (cache, team1Id, team2Id) => {
  if (!team1Id || !team2Id) return null;
  return cache[makeKey(team1Id, team2Id)] ?? null;
};

const makeKey = (id1, id2) =>
  [id1, id2].sort().join('__');

const parseNextMatchId = (nextMatchId) => {
  const nextR = `${parseInt(nextMatchId.split('_')[0].replace('r', ''))}`;
  const nextM = parseInt(nextMatchId.split('_')[1].replace('m', ''));
  return [nextR, nextM];
};