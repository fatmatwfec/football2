const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

/**
 * Ensure that studentCode is unique across all users.
 * If a duplicate is detected, the newly-written document is flagged as invalid.
 * This prevents a malicious client from creating two accounts with the same Student ID.
 */
exports.ensureUniqueStudentCode = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const after = change.after.data();
    if (!after) return null; // document deleted

    const studentCode = after.studentCode;
    if (!studentCode) return null;

    const snapshot = await db.collection('users').where('studentCode', '==', studentCode).get();
    if (snapshot.size <= 1) return null; // unique

    // More than one user has this studentCode - flag the newest record.
    // (Could also delete the duplicate, but that may break auth links).
    const duplicateIds = snapshot.docs
      .map((d) => d.id)
      .filter((id) => id !== context.params.userId);

    if (duplicateIds.length === 0) return null;

    return db.collection('users').doc(context.params.userId).set({ invalidStudentCode: true }, { merge: true });
  });

/**
 * Enforce that a player can only be in one team.
 * When a team is created/updated, this function will:
 *  - ensure each player is marked as part of this team
 *  - if a player is already on another team, remove them from this team
 */
exports.enforceSingleTeamMembership = functions.firestore
  .document('teams/{teamId}')
  .onWrite(async (change, context) => {
    const after = change.after.data();
    if (!after) return null; // team deleted

    const teamId = context.params.teamId;
    const memberIds = Array.isArray(after.memberIds) ? after.memberIds : [];
    const teamName = after.teamName || '';

    const updates = [];

    for (const playerId of memberIds) {
      if (!playerId) continue;
      const userRef = db.collection('users').doc(playerId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) continue;
      const user = userSnap.data();

      // If the user already belongs to another team, remove them from this team
      if (user.hasTeam && user.teamId && user.teamId !== teamId) {
        updates.push(
          db.collection('teams').doc(teamId).update({
            memberIds: admin.firestore.FieldValue.arrayRemove(playerId),
            members: admin.firestore.FieldValue.arrayRemove(user.name || ''),
          })
        );
      } else {
        // Ensure user references this team
        updates.push(
          userRef.update({
            hasTeam: true,
            teamId,
            assignedTeam: teamName,
          })
        );
      }
    }

    return Promise.all(updates);
  });

/**
 * When a team is deleted, clear membership flags from its players.
 */
exports.clearTeamMembershipOnDelete = functions.firestore
  .document('teams/{teamId}')
  .onDelete(async (snap) => {
    const data = snap.data();
    const memberIds = Array.isArray(data?.memberIds) ? data.memberIds : [];
    const promises = memberIds.map((playerId) => {
      if (!playerId) return null;
      const userRef = db.collection('users').doc(playerId);
      return userRef.update({ hasTeam: false, teamId: "", assignedTeam: "" });
    });
    return Promise.all(promises.filter(Boolean));
  });
