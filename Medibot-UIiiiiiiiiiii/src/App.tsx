/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LoginGateway from './components/LoginGateway';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import ProfileEditor from './components/ProfileEditor';
import DoctorProfileEditor from './components/DoctorProfileEditor';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePatientStore } from './store/usePatientStore';
import { getPatient, createPatientDoc } from './lib/patientService';
import { useThemeStore } from './store/useThemeStore';

type Role = 'patient' | 'doctor';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<Role>('patient');
  const [userEmail, setUserEmail] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showDoctorSetup, setShowDoctorSetup] = useState(false);
  const { setUid, setProfile, clearStore } = usePatientStore();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // 6-second safety timeout to bypass infinite loading if Firebase hangs
    const timer = setTimeout(() => {
      setIsInitializing((prev) => {
        if (prev) {
          console.warn('Firebase initialization timed out after 6 seconds. Bypassing loading screen to prevent hang.');
        }
        return false;
      });
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          let detectedRole: Role = 'patient';

          if (userDoc.exists()) {
            const userData = userDoc.data();
            detectedRole = userData.role as Role;
            setRole(detectedRole);
          }

          setUserEmail(user.email || '');
          setUid(user.uid);

          if (detectedRole === 'patient') {
            let profile = await getPatient(user.uid);

            const hasCompletedSetup =
              userDoc.exists() && userDoc.data().hasCompletedSetup === true;
            const hasValidName = profile?.name && profile.name.trim().length > 0;

            if (!profile) {
              await createPatientDoc(user.uid, user.displayName || '');
              profile = await getPatient(user.uid);
              setShowProfileSetup(true);
            } else if (!hasCompletedSetup || !hasValidName) {
              setShowProfileSetup(true);
            }

            if (profile) setProfile(profile);
          }

          // Doctor setup gatekeeper
          if (detectedRole === 'doctor') {
            const hasCompletedSetup =
              userDoc.exists() && userDoc.data().hasCompletedSetup === true;
            if (!hasCompletedSetup) {
              setShowDoctorSetup(true);
            }
          }

          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
          clearStore();
        }
      } catch (err: any) {
        console.error('Failed to restore auth session or fetch user data:', err);
        setIsLoggedIn(false);
        clearStore();
      } finally {
        setIsInitializing(false);
        clearTimeout(timer);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleLogin = (selectedRole: Role, email: string) => {
    setRole(selectedRole);
    setUserEmail(email);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setRole('patient');
      setUserEmail('');
      setShowProfileSetup(false);
      clearStore();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-teal-950 flex flex-col items-center justify-center text-slate-900 dark:text-white gap-4">
        <div className="relative">
          <div className="w-16 h-16 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-emerald-500 animate-spin absolute" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-900 dark:text-white font-bold text-lg">Medi<span className="text-emerald-500">BOT</span></p>
          <p className="text-slate-500 dark:text-teal-400 text-sm mt-0.5">Initializing AI Engine…</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginGateway onLogin={handleLogin} />;
  }

  return (
    <>
      {role === 'patient' ? (
        <PatientDashboard onLogout={handleLogout} />
      ) : (
        <DoctorDashboard onLogout={handleLogout} />
      )}
      {showProfileSetup && role === 'patient' && (
        <ProfileEditor
          isFirstTime
          onClose={() => setShowProfileSetup(false)}
        />
      )}
      {showDoctorSetup && role === 'doctor' && (
        <DoctorProfileEditor
          isFirstTime
          onClose={() => setShowDoctorSetup(false)}
        />
      )}
    </>
  );
}
