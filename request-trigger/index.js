const util = require('util');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

function isUpdateFromTrigger(before, after) {
    const isFirstUpdateFromApp = () =>
        util.isNullOrUndefined(before.triggerTimestamp) &&
        util.isNullOrUndefined(after.triggerTimestamp);

    const isNextUpdatesFromApp = () => before.triggerTimestamp === after.triggerTimestamp;

    return !(isFirstUpdateFromApp() || isNextUpdatesFromApp());
}

function shouldIgnoreChange(change) {
    const isUpdated = change.before.exists;
    const isDeleted = !change.after.exists;

    if (isDeleted)
        return true;

    if (isUpdated && isUpdateFromTrigger(change.before, change.after))
        return true;

    return false;
}


function getRequestTimestampForFamily(request) {
    return request.modifiedTimestamp
}

function getLastServedTimestampForFamily(family) {
    const db = admin.firestore();
    const familiesServedBefore = db.collectionGroup('families')
        .select('requestTimestamp')
        .where('contact', '==', family.contact)
        .where('requestTimestamp', '<', family.requestTimestamp)
        .orderBy('requestTimestamp', 'desc')
        .limit(1)

    return familiesServedBefore.get().then(querySnapshot =>
        (querySnapshot.size > 0)
            ? querySnapshot.docs[0].data().requestTimestamp
            : 0)
}

function updateFamilyTimeStamps(request, family) {
    return getLastServedTimestampForFamily(request, family).then(lastServedDate => {
        let familyWithTimestamps = { ...family };
        familyWithTimestamps.requestTimestamp = getRequestTimestampForFamily(request);
        if (lastServedDate != 0) familyWithTimestamps.lastServedDate = lastServedDate;
        return familyWithTimestamps;
    })
}

exports.onWriteRequest = functions.firestore
    .document('requests/{requestsId}')
    // eslint-disable-next-line no-unused-vars
    .onWrite((change, _context) => {
        if (shouldIgnoreChange(change)) return null;
        const request = change.after.data();
        return Promise.all(request.families.map(family => updateFamilyTimeStamps(request, family)))
            .then(familiesWithTimestamps => change.after.ref.set({
                triggerTimestamp: Date.now(),
                families: familiesWithTimestamps
            }, { merge: true }))
    });

    //https://console.firebase.google.com/v1/r/project/{{PROJECT_ID}}/firestore/indexes?create_composite=ClVwcm9qZWN0cy9rYXJ1bmEtYmFja2VuZC01ZTNkNy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvZmFtaWxpZXMvaW5kZXhlcy9fEAIaCwoHY29udGFjdBABGhQKEHJlcXVlc3RUaW1lc3RhbXAQAhoMCghfX25hbWVfXxAC