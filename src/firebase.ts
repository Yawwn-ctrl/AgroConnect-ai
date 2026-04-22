import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    // Use redirect on deployed environments, popup on localhost
    if (window.location.hostname === 'localhost') {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } else {
      await signInWithRedirect(auth, googleProvider);
    }
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export { getRedirectResult };

export const logout = () => signOut(auth);
