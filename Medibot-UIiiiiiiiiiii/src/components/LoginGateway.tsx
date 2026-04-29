import React, { useState } from 'react';
import {
  Stethoscope, User, Lock, Mail, Activity, ShieldCheck,
  BrainCircuit, Loader2, CheckCircle, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useThemeStore } from '../store/useThemeStore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createPatientDoc } from '../lib/patientService';

type Role = 'patient' | 'doctor';

interface LoginGatewayProps {
  onLogin: (role: Role, email: string) => void;
}

export default function LoginGateway({ onLogin }: LoginGatewayProps) {
  const { isDarkMode, toggleTheme } = useThemeStore();
  const [role, setRole] = useState<Role>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setError(''); setIsLoading(true);
    try {
      if (isSignUp) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email, role, displayName: email.split('@')[0],
          hasCompletedSetup: false, createdAt: new Date().toISOString()
        });
        if (role === 'patient') await createPatientDoc(user.uid, email.split('@')[0]);
        onLogin(role, email);
      } else {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        onLogin(userDoc.exists() ? (userDoc.data().role as Role) : role, email);
      }
    } catch (err: any) {
      setError(err.code === 'auth/wrong-password' ? 'Incorrect password.' :
        err.code === 'auth/user-not-found' ? 'No account found with this email.' :
        err.code === 'auth/email-already-in-use' ? 'Email already registered. Try logging in.' :
        err.message || 'Authentication failed');
    } finally { setIsLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true); setError('');
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        onLogin(userDoc.data().role as Role, user.email || '');
      } else {
        await setDoc(userDocRef, {
          email: user.email, role, displayName: user.displayName || user.email?.split('@')[0] || '',
          hasCompletedSetup: false, createdAt: new Date().toISOString()
        });
        if (role === 'patient') await createPatientDoc(user.uid, user.displayName || user.email?.split('@')[0] || '');
        onLogin(role, user.email || '');
      }
    } catch (err: any) { setError(err.message || 'Google sign-in failed'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="h-screen bg-stone-50 dark:bg-teal-950 text-slate-200 font-sans flex overflow-hidden selection:bg-emerald-500 dark:emerald-400/30">

      {/* ── Left Column ── */}
      <div className="w-full md:w-[42%] h-screen flex flex-col px-10 py-6 relative z-10 border-r border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/90 backdrop-blur-2xl">

        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
          {/* Icon mark */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 dark:emerald-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-500/10">
              <Activity className="text-slate-900 dark:text-white w-5 h-5" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#121318] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>
          {/* Wordmark */}
          <div className="flex flex-col leading-none">
            <span className="text-[18px] font-extrabold text-slate-900 dark:text-white tracking-tight">
              Medi<span className="text-emerald-500 dark:emerald-400">BOT</span>
            </span>
            <span className="text-[9px] font-bold text-slate-500 dark:text-teal-300 uppercase tracking-[0.15em] mt-0.5">AI Health Intelligence</span>
          </div>
          </div>

          <button onClick={toggleTheme} className="p-2 rounded-full bg-white dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 text-slate-600 dark:text-teal-300 hover:bg-stone-50 dark:hover:bg-teal-900 transition-colors">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Role Toggle — visible immediately */}
        <div className="flex-shrink-0 mb-5">
          <p className="text-[10px] font-bold text-slate-500 dark:text-teal-300 uppercase tracking-widest mb-2">Select Dashboard Role</p>
          <div className="flex p-1 bg-white dark:bg-teal-950 rounded-xl border border-slate-200 dark:border-emerald-800">
            {(['patient', 'doctor'] as Role[]).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${role === r ? 'bg-emerald-500 text-white dark:bg-emerald-400/10 dark:text-emerald-400 ring-1 ring-emerald-500 dark:ring-emerald-400/20 shadow-lg' : 'text-slate-500 dark:text-teal-300 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {r === 'patient' ? <User size={15} /> : <Stethoscope size={15} />}
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Form area */}
        <motion.div
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          className="flex-1 flex flex-col justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.div key={isSignUp ? 'signup' : 'login'}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1.5">
                {isSignUp ? 'Create Account.' : 'Intelligent Healthcare.'}
              </h1>
              <p className="text-slate-500 dark:text-teal-200 text-sm mb-6 leading-relaxed">
                {isSignUp ? 'Join the future of AI-driven medical assistance.' : 'Your personalised AI health intelligence platform.'}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-teal-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-teal-500" size={14} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="block w-full bg-white dark:bg-teal-950/50 border-2 border-slate-200 dark:border-emerald-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400/50 text-sm transition-all"
                  placeholder="your.email@domain.com" autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-teal-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-teal-500" size={14} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="block w-full bg-white dark:bg-teal-950/50 border-2 border-slate-200 dark:border-emerald-800 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-teal-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400/50 text-sm transition-all"
                  placeholder="••••••••" autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-red-400 text-xs font-medium bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg"
                >{error}</motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-3 pt-1">
              <button type="submit" disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/40 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
              >
                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>

              <div className="relative py-3">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-emerald-800" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-teal-300">
                  <span className="bg-stone-100 dark:bg-emerald-900 px-4">Or continue with</span>
                </div>
              </div>

              <button type="button" onClick={handleGoogleLogin} disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-teal-950/50 hover:bg-stone-50 dark:hover:bg-teal-900 text-slate-900 dark:text-white font-semibold py-3 rounded-xl border border-slate-200 dark:border-emerald-800 transition-all text-sm"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Continue with Google
              </button>
            </div>
          </form>

          <div className="mt-5 text-xs text-slate-500 dark:text-teal-300 flex items-center gap-1">
            <span>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:text-emerald-700 dark:hover:text-emerald-300 ml-1"
            >{isSignUp ? 'Sign In' : 'Sign Up'}</button>
          </div>
        </motion.div>

        {/* Trust badges */}
        <div className="flex-shrink-0 mt-4 pt-4 border-t border-slate-200 dark:border-emerald-800 flex items-center justify-center gap-6">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-emerald-500 dark:text-emerald-400" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-teal-300 uppercase tracking-wide">HIPAA Compliant</span>
          </div>
          <div className="w-px h-3 bg-slate-300 dark:bg-teal-700" />
          <div className="flex items-center gap-1.5">
            <CheckCircle size={11} className="text-emerald-500 dark:text-emerald-400" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-teal-300 uppercase tracking-wide">AES-256 Encrypted</span>
          </div>
          <div className="w-px h-3 bg-slate-300 dark:bg-teal-700" />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-teal-300 uppercase tracking-wide">SOC 2 Type II</span>
          </div>
        </div>
      </div>

      {/* ── Right Column ── */}
      <div className="hidden md:flex flex-col flex-1 bg-stone-50 dark:bg-teal-950 relative overflow-hidden">

        {/* System Status badge — replaces the dummy nav links */}
        <div className="absolute top-0 right-0 left-0 px-10 py-6 flex justify-end z-20">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-xl">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-emerald-400">AI Engine Online</span>
          </div>
        </div>

        {/* Central AI Graphic */}
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="absolute top-[15%] right-[10%] w-[380px] h-[380px] bg-emerald-500 bg-opacity-20 dark:bg-emerald-400 dark:bg-opacity-10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[20%] left-[15%] w-[260px] h-[260px] bg-indigo-500 bg-opacity-20 rounded-full blur-[100px]" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="w-full max-w-xl relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white to-stone-50 dark:from-emerald-600/10 dark:to-teal-600/10 rounded-[50px] transform -rotate-2 scale-105 border border-slate-200 dark:border-emerald-500/20 shadow-2xl shadow-slate-200/50 dark:shadow-black/50" />
            <div className="relative bg-white/70 dark:bg-[#062d24] backdrop-blur-2xl border border-slate-200 dark:border-emerald-500/30 rounded-[40px] p-10 overflow-hidden flex flex-col items-center justify-center min-h-[380px]">
              <div className="w-40 h-40 rounded-full border border-emerald-500 dark:emerald-400/20 flex items-center justify-center relative mb-6">
                <div className="absolute inset-0 bg-emerald-500 dark:emerald-400/5 rounded-full animate-pulse" />
                <BrainCircuit className="w-16 h-16 text-emerald-500 dark:emerald-400" />
                <div className="absolute -top-3 -right-3 w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-slate-300 dark:border-teal-700 shadow-xl">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="absolute -bottom-2 -left-3 w-10 h-10 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-slate-300 dark:border-teal-700 shadow-xl">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-400 mb-2">AI Clinical Intelligence</h3>
              <p className="text-center text-slate-600 dark:text-teal-100/90 max-w-xs text-sm leading-relaxed">
                Experience seamless integration between clinical context, real-time vitals, and predictive diagnostics.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {['Real-time Vitals', 'Drug Interactions', 'X-ray Analysis', 'AI Diagnosis'].map(f => (
                  <span key={f} className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">{f}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom "Want to Get Started" banner — shifted upward */}
        <div className="absolute bottom-8 left-0 right-0 px-10 flex justify-center z-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white/[0.04] backdrop-blur-xl rounded-full px-7 py-2.5 flex items-center gap-5 border border-white/8 max-w-xl w-full shadow-2xl"
          >
            <span className="text-slate-600 dark:text-teal-300 dark:text-teal-200 text-xs font-semibold whitespace-nowrap">Want to get started?</span>
            <div className="flex-1 flex items-center gap-2 bg-stone-100 dark:bg-emerald-900/60 rounded-full pl-4 pr-1 py-1 border border-slate-200 dark:border-emerald-800">
              <input type="email" placeholder="Your email" className="bg-transparent border-none outline-none text-xs text-slate-900 dark:text-white w-full py-1.5 placeholder-slate-600" />
              <button className="bg-emerald-500 dark:emerald-400 hover:bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-white text-[10px] font-bold py-1.5 px-5 rounded-full transition-colors whitespace-nowrap">
                Send
              </button>
            </div>
            <a href="#" className="hidden sm:block text-emerald-500 dark:emerald-400 text-xs font-bold hover:text-emerald-400 dark:emerald-300">Join us →</a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
