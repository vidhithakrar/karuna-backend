
export function getFireStoreInstance() {
    const scriptProperties = PropertiesService.getScriptProperties()
    const serviceAccount = scriptProperties.getProperty('SERVICE_ACCOUNT');
    const firestoreSecret = scriptProperties.getProperty('FIRESTORE_SECRET');
    const appName = scriptProperties.getProperty('FIRESTORE_APP');
      return FirestoreApp.getFirestore(serviceAccount, firestoreSecret, appName);
  }
  