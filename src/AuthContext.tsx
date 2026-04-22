import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, getRedirectResult } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (firebaseUser: User) => {
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Farmer',
          role: firebaseUser.email === 's24_patil_prasad@mgmmumbai.ac.in' ? 'admin' : 'user'
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    };

    // Handle redirect result from signInWithRedirect (Vercel deployment)
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect sign-in error", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const handleProfileUpdate = () => {
      if (user) {
        fetchProfile(user);
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [user]);

  const isAdmin = profile?.role === 'admin' || user?.email === 's24_patil_prasad@mgmmumbai.ac.in';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
