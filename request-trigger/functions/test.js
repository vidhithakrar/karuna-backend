 /* eslint-disable */

const util = require('util');
const admin = require('firebase-admin');
let serviceAccount = require('./svc-account-test');

// admin.initializeApp(functions.config().firebase);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

function testFamily(contact) {
    let db = admin.firestore();
    var familiesServedBefore = db.collectionGroup('families')
        .select('requestTimestamp')
        .where('contact', '==', contact)
        .where('requestTimestamp', '<', 1589271334097)
        .orderBy('requestTimestamp', 'desc')
        .limit(1)

    familiesServedBefore.get().then(function (querySnapshot) {
        return (querySnapshot.size > 0) ? querySnapshot.docs[0].data().requestTimestamp
            : 0
    }).then(x => console.log(x))

}

async function updateFamilies(requestDocumentPath) {
    let db = admin.firestore();
    const requestCollections = await db.doc(requestDocumentPath).listCollections();
    const familyCollection = requestCollections.filter(rc => rc.id === "families")[0]
    return await familyCollection.listDocuments().then(docs => docs.map(async doc => {
        const snapshot = await doc.get()
        const family = snapshot.data()
        console.log(family)
        // doc.set({ ...family, 'test': true }, { merge: true })
    }))
}

function testRequests() {
    let db = admin.firestore();
    db.collection('requests')
        .limit(1)
        .get()
        .then((snapshot) => {
            snapshot.forEach(async (doc) => {
                updateFamilies(doc.ref.path)
            });
        })
        .catch((err) => {
            console.log('Error getting documents', err);
        });

}

function testArrayMap() {
    const families = [{
        noOfKits: 1,
        familyLeader: 'Vidhi',
        noOfAdults: 1,
        contact: '7937737397',
        noOfChildren: 0
    },
    {
        noOfKits: 1,
        familyLeader: 'Vidhi',
        noOfAdults: 1,
        contact: '7937737397',
        noOfChildren: 0
    }]

    const families_mapped = families.map(family => ({
        ...family,
        ...{ lastServedDate: 1586696562489 }
    }))

    console.log(families_mapped)
}


// testArrayMap()
// testFamily('1234567890')
testRequests()
