const util = require('util')
const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp(functions.config().firebase)
const db = admin.firestore()

function isUpdateFromTrigger(before, after) {
    const beforeTimestamp = before.data().triggerTimestamp
    const afterTimestamp = after.data().triggerTimestamp

    const isFirstUpdateFromApp = () =>
        util.isNullOrUndefined(beforeTimestamp) &&
        util.isNullOrUndefined(afterTimestamp)
    const isNextUpdatesFromApp = () => beforeTimestamp === afterTimestamp

    const isUpdateFromApp = isFirstUpdateFromApp() || isNextUpdatesFromApp()
    return !isUpdateFromApp
}

function shouldIgnoreChange(change) {
    const isUpdated = change.before.exists
    const isDeleted = !change.after.exists

    if (isDeleted)
        return true

    if (isUpdated && isUpdateFromTrigger(change.before, change.after))
        return true

    return false
}


async function getTimestampsForFamily(request, family) {
    let familyTimestamps = { requestTimestamp: request.modifiedTimestamp }
    const familiesServedBefore = db.collectionGroup('families')
        .select('requestTimestamp')
        .where('contact', '==', family.contact)
        .where('requestTimestamp', '<', request.modifiedTimestamp)
        .orderBy('requestTimestamp', 'desc')
        .limit(1)
    const querySnapshot = await familiesServedBefore.get()

    const lastServedDate = querySnapshot.size > 0 ? querySnapshot.docs[0].data().requestTimestamp : 0
    if (lastServedDate != 0) familyTimestamps.lastServedDate = lastServedDate

    return familyTimestamps
}

async function updateFamilies(request, requestDocumentPath) {
    const requestCollections = await db.doc(requestDocumentPath).listCollections()
    const familyCollection = requestCollections.filter(rc => rc.id === "families")[0]
    return await familyCollection.listDocuments().then(docs => docs.map(async doc => {
        const snapshot = await doc.get()
        const family = snapshot.data()
        const timestamps = await getTimestampsForFamily(request, family)
        await doc.set(timestamps, { merge: true })
    }))
}

exports.onWriteRequest = functions.firestore
    .document('requests/{requestsId}')
    // eslint-disable-next-line no-unused-vars
    .onWrite(async (change, _context) => {
        if (shouldIgnoreChange(change)) return null

        const request = change.after.data()
        const requestDocumentPath = change.after.ref.path
        await updateFamilies(request, requestDocumentPath)
        return change.after.ref.set({ triggerTimestamp: Date.now() }, { merge: true })
    })

//https://console.firebase.google.com/v1/r/project/{{PROJECT_ID}}/firestore/indexes?create_composite=ClVwcm9qZWN0cy9rYXJ1bmEtYmFja2VuZC01ZTNkNy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvZmFtaWxpZXMvaW5kZXhlcy9fEAIaCwoHY29udGFjdBABGhQKEHJlcXVlc3RUaW1lc3RhbXAQAhoMCghfX25hbWVfXxAC
