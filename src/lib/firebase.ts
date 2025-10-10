
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';


// This is a public configuration and is safe to be exposed on the client-side.
// Security is enforced by Firebase Security Rules.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAGbbOra2xq5gofQglFln0AWKzYZLJSHNk",
  authDomain: "studio-6167596920-dbcef.firebaseapp.com",
  projectId: "studio-6167596920-dbcef",
  storageBucket: "studio-6167596920-dbcef.appspot.com",
  messagingSenderId: "1041595331915",
  appId: "1:1041595331915:web:58281b2d730cd78670a4ce"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase initialization error", e);
    // In a dummy setup, we don't want to throw a hard error.
    // We'll just log it and let the app continue.
  }
} else {
  app = getApp();
}

// Dummy initializations - these will not work without a valid config.
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;
const auth = app ? getAuth(app) : null;
const functions = app ? getFunctions(app) : null;


export { app, db, storage, auth, functions };
