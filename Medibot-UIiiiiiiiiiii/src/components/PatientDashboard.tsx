/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import ErrorBoundary from './ErrorBoundary';
import ProfileEditor from './ProfileEditor';
import { saveChatMessage, getChatHistory, saveDiagnosticResult, saveVitalsSnapshot, getUnsyncedRecords, markAsSynced } from '../lib/db';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db as firestoreDb, storage } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { usePatientStore } from '../store/usePatientStore';
import apiClient from '../lib/apiClient';
import {
  Stethoscope, User, Activity, ShieldCheck, BrainCircuit, Loader2,
  LayoutDashboard, History, Microscope, Pill, MessageSquare, LogOut,
  Heart, Footprints, Watch, Upload, AlertTriangle, QrCode, Send,
  AlertCircle, Paperclip, Mic, PhoneCall, Search, Plus, ChevronRight,
  Bot, Menu, X,
  Trash2, Pencil, Download, PlusCircle, MessageCircle, Calendar, FileText, FlaskConical, Sun, Moon, Eye, SortAsc, SortDesc
} from 'lucide-react';
import { checkInteractions } from '../utils/drugSafetyData';
import { motion, AnimatePresence } from 'motion/react';
import { useThemeStore } from '../store/useThemeStore';

type Tab = 'overview' | 'timeline' | 'lab' | 'prescriptions' | 'chat';

// --- Sub-components ---

const Sidebar = ({ activeTab, setActiveTab, onLogout, isOpen, setIsOpen }: {
  activeTab: Tab,
  setActiveTab: (t: Tab) => void,
  onLogout: () => void,
  isOpen: boolean,
  setIsOpen: (b: boolean) => void
}) => {
  const menuItems = [
    { id: 'overview', label: 'Health Overview', icon: LayoutDashboard },
    { id: 'timeline', label: 'Medical Timeline', icon: History },
    { id: 'lab', label: 'AI Diagnostic Lab', icon: Microscope },
    { id: 'prescriptions', label: 'Prescription Manager', icon: Pill },
    { id: 'chat', label: 'MediBOT AI Chat', icon: MessageSquare },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed md:sticky top-0 left-0 z-50
        w-64 glass-card border-r border-slate-200 dark:border-emerald-800 flex flex-col h-screen
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-2xl border border-emerald-500/20 dark:border-emerald-400/20">
              <BrainCircuit className="text-emerald-600 dark:text-emerald-400 w-8 h-8" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">Medi<span className="text-emerald-500 dark:emerald-400">BOT</span></span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:text-slate-600 dark:text-teal-300 dark:text-teal-200">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as Tab);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all border-l-4 ${activeTab === item.id
                ? 'border-emerald-500 bg-emerald-500 text-slate-900 dark:text-white dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-400/20 shadow-lg'
                : 'border-transparent text-slate-600 dark:text-teal-300 dark:text-teal-300 hover:bg-stone-100 dark:hover:bg-teal-900 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white'
                }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-emerald-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:bg-red-500/10 ring-1 ring-red-500/20 hover:text-red-400 transition-all"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

const Header = ({ patientName, uid, onMenuClick, onProfileClick, onApptClick }: { patientName: string, uid: string | null, onMenuClick: () => void, onProfileClick: () => void, onApptClick: () => void }) => {
  const { isDarkMode, toggleTheme } = useThemeStore();
  return (
  <header className="h-20 glass-card border-b backdrop-blur-md sticky top-0 z-20 border-slate-200 dark:border-emerald-800 px-4 md:px-8 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 text-slate-600 dark:text-teal-300 hover:bg-stone-100 dark:hover:bg-teal-900 rounded-lg"
      >
        <Menu size={24} />
      </button>
      <div>
        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white truncate max-w-[150px] md:max-w-none">
          Hi, <span className="text-emerald-500 dark:emerald-400">{patientName.split(' ')[0] || 'Patient'}</span>
        </h2>
        <p className="hidden md:block text-xs text-slate-600 dark:text-teal-300 dark:text-teal-300 font-medium mt-0.5">
          Patient ID: #{uid ? uid.slice(0, 8).toUpperCase() : '--------'}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 md:gap-4">
      <button onClick={toggleTheme} className="p-2 rounded-full bg-stone-100 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 text-slate-600 dark:text-teal-300 hover:bg-stone-200 dark:hover:bg-teal-800 transition-colors">
        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button onClick={onApptClick} className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-full border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
        <Calendar size={12} className="text-indigo-600 dark:text-indigo-400" />
        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hidden md:block">Book Appt</span>
      </button>
      <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-full border border-emerald-500/20">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-[8px] md:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Secured</span>
      </div>
      <button onClick={onProfileClick} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-100 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 flex items-center justify-center overflow-hidden hover:bg-stone-200 dark:hover:bg-teal-800 transition-colors">
        <User size={18} className="text-slate-600 dark:text-teal-300" />
      </button>
    </div>
  </header>
  );
};

interface VitalsProps {
  heartRate: number;
  spo2: number;
  steps: number;
  uid: string | null;
}

const HealthOverview = ({ heartRate, spo2, steps, uid }: VitalsProps) => {
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ heartRate: String(heartRate), spo2: String(spo2), steps: String(steps) });
  const { updateProfile } = usePatientStore();

  const handleSaveVitals = async () => {
    if (!uid) return;
    setSaving(true);
    const hr = Number(form.heartRate);
    const o2 = Number(form.spo2);
    const st = Number(form.steps);
    try {
      await updateDoc(doc(firestoreDb, 'patients', uid), {
        'recentVitals.heartRate': hr,
        'recentVitals.spo2': o2,
        'recentVitals.steps': st,
        'recentVitals.timestamp': new Date().toISOString(),
      });
      await saveVitalsSnapshot(uid, hr, o2, st, 'manual');
      updateProfile({ recentVitals: { heartRate: hr, spo2: o2, steps: st } });
      setShowVitalsModal(false);
      toast.success('Vitals updated');
    } catch (e) {
      console.error('Failed to save vitals:', e);
      toast.error('Failed to save vitals');
    } finally {
      setSaving(false);
    }
  };

  const hrOk = heartRate >= 60 && heartRate <= 90;
  const spo2Score = spo2 >= 97 ? 40 : spo2 >= 95 ? 25 : 10;
  const stepScore = Math.min(20, Math.floor(steps / 500));
  const healthScore = Math.min(100, Math.round((hrOk ? 40 : 10) + spo2Score + stepScore));

  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:text-white">Live Vitals</h3>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowVitalsModal(true)}
          className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-400/10 ring-1 ring-emerald-500/20 dark:ring-emerald-400/20 rounded-full border border-emerald-500/20 dark:border-emerald-400/20 hover:bg-emerald-500/20 dark:hover:bg-emerald-400/20 transition-colors"
        >
          <Watch size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Update Vitals</span>
        </button>
      </div>
    </div>

    <AnimatePresence>
      {showVitalsModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            className="bg-white dark:bg-emerald-900 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-300 dark:border-teal-700"
          >
            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-6">Update Vitals</h4>
            <div className="space-y-4">
              {[
                { label: 'Heart Rate (bpm)', key: 'heartRate', min: 30, max: 250 },
                { label: 'Blood Oxygen SpO₂ (%)', key: 'spo2', min: 50, max: 100 },
                { label: 'Daily Steps', key: 'steps', min: 0, max: 99999 },
              ].map(({ label, key, min, max }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 uppercase tracking-wider block mb-1">{label}</label>
                  <input
                    type="number" min={min} max={max}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveVitals} disabled={saving}
                className="flex-1 py-3 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold hover:bg-emerald-600 dark:emerald-500 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Vitals'}
              </button>
              <button onClick={() => setShowVitalsModal(false)}
                className="px-6 py-3 bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 dark:text-teal-200 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:text-slate-900 dark:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Top Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Circular Health Score Widget */}
      <div className="bg-white dark:bg-emerald-900 p-6 rounded-3xl border border-slate-200 dark:border-emerald-800 shadow-2xl shadow-sm dark:shadow-sm dark:shadow-black/20 flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-36 h-36 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="72" cy="72" r="62" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-[#0F1015]" />
            <circle cx="72" cy="72" r="62" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="389" strokeDashoffset={389 - (389 * healthScore) / 100} className="text-emerald-500 dark:emerald-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)] transition-all duration-1000 ease-out" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tighter">{healthScore}<span className="text-lg text-slate-600 dark:text-teal-300 dark:text-teal-200">%</span></span>
          </div>
        </div>
        <div className="flex-1 space-y-4 w-full">
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:text-white">Health Index</h4>
            <p className="text-xs text-slate-600 dark:text-teal-300 dark:text-teal-200 mt-1">Based on sleep, activity, and vitals over the last 7 days.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-stone-50 dark:bg-teal-950 p-3 rounded-2xl flex-1 border border-slate-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase">Sleep Score</span>
              <div className="text-base font-bold text-indigo-400 mt-0.5">92/100</div>
            </div>
            <div className="bg-stone-50 dark:bg-teal-950 p-3 rounded-2xl flex-1 border border-slate-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase">Recovery</span>
              <div className="text-base font-bold text-emerald-400 mt-0.5">Optimal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart Widget */}
      <div className="bg-white dark:bg-emerald-900 p-6 rounded-3xl border border-slate-200 dark:border-emerald-800 shadow-2xl shadow-sm dark:shadow-sm dark:shadow-black/20 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-900 dark:text-white">Activity Timeline</h4>
            <p className="text-xs text-slate-600 dark:text-teal-300 dark:text-teal-200">Weekly step progression</p>
          </div>
          <div className="p-2 bg-stone-50 dark:bg-teal-950 rounded-xl border border-slate-200 dark:border-emerald-800">
            <Footprints size={16} className="text-emerald-500" />
          </div>
        </div>
        <div className="flex items-end justify-between h-32 gap-1.5 md:gap-3 mt-4">
          {(() => {
            const today = new Date().getDay();
            const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            const mockActivity = [68, 82, 57, 91, 74, 95, 64];
            return days.map((day, i) => {
              const isToday = i === today;
              // Use live steps for today (floor at 25% so it's always visible), mock for others
              const todayPct = Math.max(25, Math.min(100, Math.round(steps / 100)));
              const val = isToday ? todayPct : mockActivity[i];
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full rounded-lg overflow-hidden bg-slate-50/50 dark:bg-emerald-950/30" style={{ height: '6rem', display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      className={`w-full rounded-lg transition-all duration-1000 ease-out ${
                        isToday
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                          : 'bg-gradient-to-t from-[#2A3040] to-[#3A4255] hover:from-sky-900 hover:to-sky-700'
                      }`}
                      style={{ height: `${val}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${isToday ? 'text-emerald-400' : 'text-slate-600'}`}>{day}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>

    {/* Bottom Metrics Row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 hover:border-emerald-500 dark:emerald-400/30 transition-colors group">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
            <Heart className="text-red-500 w-5 h-5 animate-[pulse_1.5s_ease-in-out_infinite]" />
          </div>
          <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase">Heart Rate</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{heartRate}</span>
          <span className="text-slate-600 dark:text-teal-300 dark:text-teal-200 text-xs">bpm</span>
        </div>
      </div>

      <div className="bg-white dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 hover:border-sky-500 dark:hover:border-sky-400/30 transition-colors group">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-sky-500/10 dark:bg-sky-400/10 rounded-lg group-hover:bg-sky-500/20 dark:hover:bg-sky-400/20 transition-colors">
            <Activity className="text-sky-500 dark:text-sky-400 w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase">Blood Oxygen</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{spo2}</span>
          <span className="text-slate-600 dark:text-teal-300 dark:text-teal-200 text-xs">%</span>
        </div>
      </div>

      <div className="bg-white dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 hover:border-emerald-500 dark:emerald-400/30 transition-colors group">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
            <Footprints className="text-orange-500 w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase">Daily Steps</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">{steps.toLocaleString()}</span>
          <span className="text-slate-600 dark:text-teal-300 dark:text-teal-200 text-xs">steps</span>
        </div>
      </div>

      <div className="bg-white dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 hover:border-emerald-500 dark:emerald-400/30 transition-colors group">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
            <Activity className="text-indigo-500 w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase">Stress Lvl</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">Low</span>
        </div>
      </div>
    </div>

    {/* My Doctor Card */}
    <MyDoctorCard uid={uid} />
  </div>
  );
};

// --- Doctor Linking ---

interface Doctor { uid: string; email: string; displayName?: string; specialization?: string; }

const MyDoctorCard = ({ uid }: { uid: string | null }) => {
  const { profile, updateProfile } = usePatientStore();
  const [linkedDoctors, setLinkedDoctors] = useState<{ uid: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [linking, setLinking] = useState(false);

  // Load linked doctors — backwards compatible with old single doctorUid
  useEffect(() => {
    const ld = (profile as any)?.linkedDoctors;
    if (ld && Array.isArray(ld) && ld.length > 0) {
      setLinkedDoctors(ld);
    } else if (profile?.doctorUid) {
      getDoc(doc(firestoreDb, 'users', profile.doctorUid)).then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          setLinkedDoctors([{ uid: profile.doctorUid!, name: d.displayName || d.email }]);
        }
      });
    }
  }, [profile?.doctorUid, (profile as any)?.linkedDoctors]);

  const openModal = async () => {
    setShowModal(true); setLoadingDoctors(true);
    try {
      const snap = await getDocs(query(collection(firestoreDb, 'users'), where('role', '==', 'doctor')));
      setDoctors(snap.docs.map(d => ({ uid: d.id, email: d.data().email, displayName: d.data().displayName, specialization: d.data().specialization })));
    } catch (e) { console.error(e); }
    finally { setLoadingDoctors(false); }
  };

  const addDoctor = async (doctor: Doctor) => {
    if (!uid || linkedDoctors.some(d => d.uid === doctor.uid)) { toast.error('Already in your care team'); return; }
    setLinking(true);
    try {
      const updated = [...linkedDoctors, { uid: doctor.uid, name: doctor.displayName || doctor.email }];
      await updateDoc(doc(firestoreDb, 'patients', uid), { linkedDoctors: updated, doctorUid: doctor.uid });
      updateProfile({ ...(profile as any), linkedDoctors: updated, doctorUid: doctor.uid });
      setLinkedDoctors(updated);
      setShowModal(false);
      toast.success(`${doctor.displayName || doctor.email} added to your care team`);
    } catch { toast.error('Failed to link doctor'); }
    finally { setLinking(false); }
  };

  const removeDoctor = async (doctorUid: string) => {
    if (!uid) return;
    const updated = linkedDoctors.filter(d => d.uid !== doctorUid);
    try {
      await updateDoc(doc(firestoreDb, 'patients', uid), { linkedDoctors: updated, doctorUid: updated[0]?.uid ?? null });
      setLinkedDoctors(updated);
      updateProfile({ ...(profile as any), linkedDoctors: updated });
      toast.success('Doctor removed from care team');
    } catch { toast.error('Failed to remove doctor'); }
  };

  const filtered = doctors.filter(d =>
    (d.displayName || d.email).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="bg-white dark:bg-emerald-900 p-6 rounded-3xl border border-slate-200 dark:border-emerald-800 shadow-2xl shadow-sm dark:shadow-sm dark:shadow-black/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest mb-0.5">Your Care Team</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">
              {linkedDoctors.length === 0 ? 'No doctors linked yet'
                : `${linkedDoctors.length} doctor${linkedDoctors.length > 1 ? 's' : ''} in your team`}
            </p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 dark:bg-indigo-400/10 border border-indigo-500/20 dark:border-indigo-400/20 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 dark:hover:bg-indigo-400/20 transition-all">
            <Plus size={14} /> Add Doctor
          </button>
        </div>
        {linkedDoctors.length === 0 ? (
          <div className="flex items-center gap-3 py-1 text-slate-600 dark:text-teal-300">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center">
              <User size={18} className="text-slate-600" />
            </div>
            <p className="text-sm">Click "Add Doctor" to link your physician to your profile</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {linkedDoctors.map(d => (
              <div key={d.uid} className="flex items-center gap-3 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 rounded-2xl px-4 py-2.5 hover:border-indigo-500 dark:hover:border-indigo-400/20 transition-all">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center">
                  <User size={14} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">{d.name}</p>
                  <p className="text-[10px] text-slate-600 dark:text-teal-300">Attending Physician</p>
                </div>
                <button onClick={() => removeDoctor(d.uid)}
                  className="ml-1 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Remove">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-emerald-900 rounded-[2rem] shadow-2xl max-w-md w-full border border-slate-300 dark:border-teal-700 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-emerald-800">
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-1">Add to Your Care Team</h4>
                <p className="text-xs text-slate-600 dark:text-teal-300 dark:text-teal-200 mb-4">Link multiple doctors to your MediBOT profile</p>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-teal-300" />
                  <input type="text" placeholder="Search by name or email..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50 placeholder-slate-500" />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {loadingDoctors ? (
                  <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500 dark:emerald-400" size={24} /></div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-slate-600 dark:text-teal-300 text-sm">
                    {doctors.length === 0 ? 'No doctors registered yet.' : 'No results found.'}
                  </div>
                ) : filtered.map(doctor => {
                  const isLinked = linkedDoctors.some(d => d.uid === doctor.uid);
                  return (
                    <button key={doctor.uid} onClick={() => addDoctor(doctor)} disabled={linking || isLinked}
                      className="w-full flex items-center gap-4 p-4 hover:bg-[#2A2E39] transition-colors text-left disabled:opacity-60">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 dark:emerald-400/10 flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-emerald-500 dark:emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">{doctor.displayName || 'Doctor'}</p>
                        <p className="text-xs text-slate-600 dark:text-teal-300 dark:text-teal-200 mt-0.5">{doctor.email}</p>
                        {doctor.specialization && <p className="text-[10px] text-emerald-500 dark:emerald-400 font-bold mt-0.5">{doctor.specialization}</p>}
                      </div>
                      {isLinked
                        ? <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">In Team ✓</span>
                        : <Plus size={16} className="text-slate-600 dark:text-teal-300 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-emerald-800">
                <button onClick={() => setShowModal(false)}
                  className="w-full py-2.5 bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 dark:text-teal-200 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:text-slate-900 dark:text-white transition-all">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const EVENT_TYPES = [
  { value: 'checkup', label: 'Checkup / Consultation', color: 'indigo' },
  { value: 'surgery', label: 'Surgery / Procedure', color: 'red' },
  { value: 'med', label: 'Medication / Immunization', color: 'sky' },
  { value: 'birth', label: 'Birth Record', color: 'pink' },
  { value: 'lab', label: 'Lab Test / Blood Work', color: 'emerald' },
  { value: 'xray', label: 'Imaging / X-ray / MRI', color: 'purple' },
  { value: 'allergy', label: 'Allergy Record', color: 'amber' },
  { value: 'er', label: 'Emergency Visit', color: 'rose' },
  { value: 'dental', label: 'Dental', color: 'cyan' },
  { value: 'mental', label: 'Mental Health', color: 'violet' },
  { value: 'physio', label: 'Physiotherapy', color: 'teal' },
  { value: 'other', label: 'Other', color: 'slate' },
];

const TYPE_ICON_MAP: Record<string, any> = {
  checkup: Stethoscope, surgery: AlertCircle, med: Pill, birth: Heart, lab: FlaskConical, xray: Eye,
  allergy: AlertTriangle, er: AlertTriangle, dental: User, mental: BrainCircuit, physio: Footprints, other: FileText
};

const TYPE_COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20',
  red: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
  sky: 'bg-emerald-500 dark:emerald-400/10 text-emerald-500 dark:emerald-400 ring-1 ring-emerald-500 dark:emerald-400/20',
  pink: 'bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  purple: 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
  amber: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20',
  violet: 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
  teal: 'bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-teal-300 dark:text-teal-200 ring-1 ring-slate-500/20',
};

const TYPE_TEXT_MAP: Record<string, string> = {
  indigo: 'text-indigo-400', red: 'text-red-400', sky: 'text-emerald-500 dark:emerald-400',
  pink: 'text-pink-400', emerald: 'text-emerald-400', purple: 'text-purple-400',
  amber: 'text-amber-400', rose: 'text-rose-400', cyan: 'text-cyan-400',
  violet: 'text-violet-400', teal: 'text-teal-400', slate: 'text-slate-600 dark:text-teal-300 dark:text-teal-200',
};

const formatDate = (d: string) => {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const getTypeMeta = (type: string) =>
  EVENT_TYPES.find(e => e.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];

const EventForm = ({ data, setData, files, setFiles, onSubmit, onCancel, title, label, saving }: {
  data: any; setData: (fn: (d: any) => any) => void; files: File[]; setFiles: (f: File[]) => void;
  onSubmit: () => void; onCancel: () => void; title: string; label: string; saving?: boolean;
}) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <motion.div initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
      className="bg-white dark:bg-emerald-900 rounded-[2rem] shadow-2xl max-w-lg w-full border border-slate-300 dark:border-teal-700 overflow-hidden max-h-[90vh] overflow-y-auto">
      <div className="p-5 border-b border-slate-200 dark:border-emerald-800 flex items-center justify-between sticky top-0 bg-white dark:bg-emerald-900 z-10">
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-900 dark:text-white">{title}</h4>
        <button onClick={onCancel} className="p-2 text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/5 rounded-xl transition-colors"><X size={17} /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Date *</label>
            <input type="date" value={data.date} onChange={e => setData((d: any) => ({ ...d, date: e.target.value }))}
              className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50 [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Event Type</label>
            <select value={data.type} onChange={e => setData((d: any) => ({ ...d, type: e.target.value }))}
              className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50">
              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Event Title *</label>
          <input type="text" value={data.title} onChange={e => setData((d: any) => ({ ...d, title: e.target.value }))}
            className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50" placeholder="e.g. Annual physical exam" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Clinical Notes / Description</label>
          <textarea value={data.desc} onChange={e => setData((d: any) => ({ ...d, desc: e.target.value }))}
            className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50 resize-none h-20"
            placeholder="Findings, recommendations, dosage notes..." />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Doctor / Provider</label>
          <input type="text" value={data.doctor} onChange={e => setData((d: any) => ({ ...d, doctor: e.target.value }))}
            className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50" placeholder="Dr. Name, Hospital" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Attachments (PDF / Images)</label>
          <label className="flex flex-col items-center justify-center w-full py-5 bg-stone-50 dark:bg-teal-950 border-2 border-dashed border-slate-300 dark:border-teal-700 rounded-xl cursor-pointer hover:border-emerald-500 dark:emerald-400/40 hover:bg-emerald-500 dark:emerald-400/5 transition-all group">
            <Upload size={18} className="text-slate-600 dark:text-teal-300 group-hover:text-emerald-500 dark:emerald-400 mb-1.5 transition-colors" />
            <span className="text-sm text-slate-600 dark:text-teal-300 dark:text-teal-200">{files.length > 0 ? `${files.length} file(s) selected` : 'Click or drag files here'}</span>
            <span className="text-[10px] text-slate-600 mt-0.5">Multiple files supported</span>
            <input type="file" className="hidden" multiple accept="image/*,.pdf"
              onChange={e => { if (e.target.files) setFiles(Array.from(e.target.files)); }} />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f: File, i: number) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 dark:emerald-400/10 border border-emerald-500 dark:emerald-400/20 text-emerald-500 dark:emerald-400 rounded-full text-xs font-bold">
                  <FileText size={10} /> {f.name.length > 22 ? f.name.slice(0, 22) + '…' : f.name}
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="hover:text-red-400 ml-0.5"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="p-5 border-t border-slate-200 dark:border-emerald-800 flex gap-3">
        <button onClick={onSubmit} disabled={saving}
          className="flex-1 py-3 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold hover:bg-emerald-600 dark:emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : label}
        </button>
        <button onClick={onCancel} className="px-5 py-3 bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 dark:text-teal-200 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:text-slate-900 dark:text-white">Cancel</button>
      </div>
    </motion.div>
  </motion.div>
);

const MedicalTimeline = ({ uid }: { uid: string | null }) => {
  const BLANK_EVENT = { date: '', title: '', desc: '', doctor: '', type: 'checkup' };
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [newEvent, setNewEvent] = useState({ ...BLANK_EVENT });
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [addFiles, setAddFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (!uid) { setLoadingEvents(false); return; }
    getDocs(query(collection(firestoreDb, 'medicalEvents', uid, 'events'), orderBy('date', 'desc')))
      .then(snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoadingEvents(false));
  }, [uid]);

  const sortedInsert = (arr: any[], item: any) =>
    [...arr, item].sort((a, b) => b.date.localeCompare(a.date));

  const handleExport = () => {
    if (!events.length) { toast.error('No records to export'); return; }
    const rows = events.map(e => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${formatDate(e.date)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0"><strong>${e.title}</strong><br/><small style="color:#64748b">${e.desc || ''}</small></td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${e.doctor || '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0">${getTypeMeta(e.type).label}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Medical Timeline — MediBOT</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{font-size:22px;margin-bottom:4px}
      p{color:#64748b;margin-bottom:24px;font-size:13px}table{width:100%;border-collapse:collapse}
      th{background:#0f172a;color:#fff;padding:12px 10px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px}
      @media print{button{display:none}}</style></head><body>
      <h1>📋 Medical Timeline</h1><p>Exported ${new Date().toLocaleString()} · ${events.length} record(s)</p>
      <table><thead><tr><th>Date</th><th>Event</th><th>Provider</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    toast.success('Print dialog opened');
  };

  const handleAdd = async () => {
    if (!uid || !newEvent.date || !newEvent.title) { toast.error('Date and title are required'); return; }
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      if (addFiles.length > 0) { await new Promise(r => setTimeout(r, 800)); fileUrl = URL.createObjectURL(addFiles[0]); }
      const ref = await addDoc(collection(firestoreDb, 'medicalEvents', uid, 'events'), { ...newEvent, fileUrl, createdAt: serverTimestamp() });
      setEvents(prev => sortedInsert(prev, { id: ref.id, ...newEvent, fileUrl }));
      setNewEvent({ ...BLANK_EVENT }); setAddFiles([]); setShowAddEvent(false);
      toast.success('Medical event added');
    } catch { toast.error('Failed to add event'); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!uid || !editingEvent?.id) return;
    setSaving(true);
    try {
      let fileUrl = editingEvent.fileUrl;
      if (editFiles.length > 0) { await new Promise(r => setTimeout(r, 800)); fileUrl = URL.createObjectURL(editFiles[0]); }
      await updateDoc(doc(firestoreDb, 'medicalEvents', uid, 'events', editingEvent.id), {
        date: editingEvent.date, title: editingEvent.title, desc: editingEvent.desc,
        doctor: editingEvent.doctor, type: editingEvent.type, fileUrl,
      });
      const updated = { ...editingEvent, fileUrl };
      setEvents(prev => sortedInsert(prev.filter(e => e.id !== editingEvent.id), updated));
      if (selectedEvent?.id === editingEvent.id) setSelectedEvent(updated);
      setEditingEvent(null); setEditFiles([]);
      toast.success('Event updated');
    } catch { toast.error('Failed to update event'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (eventId: string) => {
    if (!uid || !window.confirm('Delete this medical record? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(firestoreDb, 'medicalEvents', uid, 'events', eventId));
      setEvents(prev => prev.filter(e => e.id !== eventId));
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
      toast.success('Record deleted');
    } catch { toast.error('Failed to delete record'); }
  };


  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-3">
            Medical Timeline
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:text-white dark:hover:text-slate-900 rounded-xl transition-all border border-emerald-500/20 dark:border-emerald-400/20"
              title={`Sort by Date (${sortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
            >
              {sortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
            </button>
          </h3>
          <p className="text-xs text-slate-600 dark:text-teal-300 mt-0.5">{events.length} record{events.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-[#2A2E39] transition-colors">
            <Download size={13} /> Export / Print
          </button>
          <button onClick={() => setShowAddEvent(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-xs font-bold hover:bg-emerald-600 dark:emerald-500 transition-colors shadow-lg shadow-emerald-500 dark:emerald-400/20">
            <Plus size={13} /> Add Event
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddEvent && (
          <EventForm data={newEvent} setData={setNewEvent} files={addFiles} setFiles={setAddFiles}
            onSubmit={handleAdd} onCancel={() => { setShowAddEvent(false); setAddFiles([]); }}
            title="Add Medical Event" label="Save Event" saving={saving} />
        )}
        {editingEvent && (
          <EventForm data={editingEvent} setData={setEditingEvent} files={editFiles} setFiles={setEditFiles}
            onSubmit={handleEdit} onCancel={() => { setEditingEvent(null); setEditFiles([]); }}
            title="Edit Medical Event" label="Update Event" saving={saving} />
        )}
      </AnimatePresence>

      {/* List + Detail panel */}
      <div className="flex gap-5">
        {/* Event list */}
        <div className="flex-1 bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/50 grid grid-cols-12 gap-3">
            <div className="col-span-3 text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest">Date</div>
            <div className="col-span-5 text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest">Event</div>
            <div className="col-span-2 text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest hidden md:block">Provider</div>
            <div className="col-span-2 text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest text-right">Actions</div>
          </div>
          <div className="divide-y divide-white/5">
            {loadingEvents && <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-emerald-500 dark:emerald-400" size={26} /></div>}
            {!loadingEvents && events.length === 0 && (
              <div className="p-12 text-center">
                <History size={30} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-600 dark:text-teal-300 text-sm font-bold">No medical events yet</p>
                <p className="text-slate-600 text-xs mt-1">Add your first record to begin your health timeline</p>
              </div>
            )}
            {events.slice().sort((a, b) => sortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)).map(event => {
              const meta = getTypeMeta(event.type);
              const isSelected = selectedEvent?.id === event.id;
              return (
                <div key={event.id}
                  onClick={() => setSelectedEvent(isSelected ? null : event)}
                  className={`px-5 py-4 grid grid-cols-12 gap-3 items-center cursor-pointer transition-all group border-l-2 ${isSelected ? 'bg-emerald-500 dark:emerald-400/5 border-emerald-500 dark:emerald-400' : 'border-transparent hover:bg-[#2A2E39]/20'}`}>
                  <div className="col-span-3">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">{formatDate(event.date)}</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${TYPE_TEXT_MAP[meta.color] || 'text-slate-600 dark:text-teal-300 dark:text-teal-200'}`}>{meta.label}</div>
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 ${TYPE_COLOR_MAP[meta.color] || TYPE_COLOR_MAP.slate}`}>
                      {React.createElement(TYPE_ICON_MAP[event.type] || FileText, { size: 18 })}
                    </div>
                    <div>
                      <div className={`text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white transition-colors ${isSelected ? 'text-emerald-500 dark:emerald-400' : 'group-hover:text-emerald-500 dark:emerald-400'}`}>{event.title}</div>
                      {event.desc && <div className="text-xs text-slate-600 dark:text-teal-300 mt-0.5 line-clamp-1">{event.desc}</div>}
                    </div>
                  </div>
                  <div className="col-span-2 hidden md:block">
                    <span className="text-xs text-slate-600 dark:text-teal-300 dark:text-teal-200 truncate block">{event.doctor || '—'}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {event.fileUrl && (
                        <button onClick={() => window.open(event.fileUrl, '_blank')}
                          className="p-2 bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:text-white dark:hover:text-slate-900 rounded-lg transition-all" title="View Document">
                          <Eye size={16} />
                        </button>
                      )}
                      <button onClick={() => { setEditingEvent({ ...event }); setEditFiles([]); }} title="Edit"
                        className="p-2 rounded-lg bg-stone-100 dark:bg-emerald-800 text-slate-600 dark:text-teal-200 hover:bg-stone-200 dark:hover:bg-emerald-700 transition-all"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(event.id)} title="Delete"
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedEvent && (
            <motion.div
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-72 flex-shrink-0 bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest">Record Detail</span>
                <button onClick={() => setSelectedEvent(null)} className="p-1.5 text-slate-600 dark:text-teal-300 hover:text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/5 rounded-lg transition-colors"><X size={14} /></button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase mb-1">Date</div>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-emerald-500 dark:emerald-400" />
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">{formatDate(selectedEvent.date)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase mb-1.5">Event</div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">{selectedEvent.title}</p>
                  {(() => { const m = getTypeMeta(selectedEvent.type); return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1.5 ${TYPE_COLOR_MAP[m.color] || ''}`}>{m.label}</span>
                  ); })()}
                </div>
                {selectedEvent.desc && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase mb-1">Clinical Notes</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedEvent.desc}</p>
                  </div>
                )}
                {selectedEvent.doctor && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase mb-1.5">Provider</div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-emerald-500 dark:emerald-400/10 rounded-lg flex items-center justify-center"><User size={12} className="text-emerald-500 dark:emerald-400" /></div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-900 dark:text-white">{selectedEvent.doctor}</span>
                    </div>
                  </div>
                )}
                {selectedEvent.fileUrl && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase mb-1.5">Document</div>
                    {/\.(jpg|jpeg|png|gif|webp)/i.test(selectedEvent.fileUrl) ? (
                      <img src={selectedEvent.fileUrl} alt="Attachment" className="w-full rounded-xl border border-slate-300 dark:border-teal-700 object-cover max-h-40" />
                    ) : (
                      <button onClick={() => window.open(selectedEvent.fileUrl, '_blank')}
                        className="w-full flex items-center gap-3 p-3 bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl hover:border-emerald-500 dark:emerald-400/30 transition-all">
                        <FileText size={16} className="text-emerald-500 dark:emerald-400 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-300 truncate">View Document</span>
                        <ChevronRight size={13} className="text-slate-600 dark:text-teal-300 ml-auto flex-shrink-0" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-emerald-800 flex gap-2">
                <button onClick={() => { setEditingEvent({ ...selectedEvent }); setEditFiles([]); }}
                  className="flex-1 py-2 bg-emerald-500 dark:emerald-400/10 text-emerald-500 dark:emerald-400 border border-emerald-500 dark:emerald-400/20 rounded-xl text-xs font-bold hover:bg-emerald-500 dark:emerald-400/20 flex items-center justify-center gap-1.5 transition-all">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => handleDelete(selectedEvent.id)}
                  className="flex-1 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-500/20 flex items-center justify-center gap-1.5 transition-all">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};



const AIDiagnosticLab = ({ uid }: { uid: string | null }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'imaging' | 'reports'>('imaging');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (file: File) => {
    setAnalyzing(true);
    setResult(null);
    setSaved(false);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const imageBase64 = await base64Promise;

      const endpoint = mode === 'imaging' ? '/api/vision/analyze_xray' : '/api/vision/extract_report';
      const { data } = await apiClient.post(endpoint, {
        image_base64: imageBase64,
        patient_id: uid ?? 'unknown',
      });
      setResult(data);
    } catch (error) {
      setResult({
        result: 'Error: Could not connect to the AI engine.',
        type: 'error',
        text: 'Connection failed.'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveToProfile = async () => {
    if (!uid || !result || result.type === 'error') return;
    setSaving(true);
    try {
      await saveDiagnosticResult(uid, {
        imageHash: String(Date.now()),
        predictedClass: result.predicted_class ?? result.type ?? 'unknown',
        severity: result.severity ?? 'Unknown',
        confidence: result.confidence ?? '—',
        recommendation: result.recommendation ?? result.text ?? '',
      });
      await addDoc(collection(firestoreDb, 'diagnostics', uid, 'results'), {
        predictedClass: result.predicted_class ?? result.type ?? 'unknown',
        severity: result.severity ?? 'Unknown',
        confidence: result.confidence ?? '—',
        recommendation: result.recommendation ?? result.text ?? '',
        timestamp: serverTimestamp(),
      });
      
      await addDoc(collection(firestoreDb, 'medicalEvents', uid, 'events'), {
        date: new Date().toISOString().split('T')[0],
        title: `Self-Diagnostic: ${result.predicted_class ?? result.type ?? 'Report'}`,
        desc: `Severity: ${result.severity ?? 'N/A'}. ${result.recommendation ?? result.text ?? ''}`,
        type: 'lab',
        doctor: 'Self-Reported',
        createdAt: serverTimestamp()
      });

      setSaved(true);
      toast.success('Result saved to profile');
    } catch (e) {
      console.error('Failed to save diagnostic:', e);
      toast.error('Failed to save result');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleScan(file);
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-2">
            <BrainCircuit className="text-emerald-500 dark:emerald-400 w-6 h-6" /> AI Diagnostic Lab
          </h3>
          <p className="text-sm text-slate-600 dark:text-teal-300 dark:text-teal-200 mt-1">Upload imaging or clinical reports for instant AI analysis.</p>
        </div>
        <div className="flex bg-stone-100 dark:bg-emerald-900 p-1.5 rounded-xl border border-slate-200 dark:border-emerald-800 shadow-inner">
          <button
            onClick={() => { setMode('imaging'); setResult(null); }}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'imaging' ? 'bg-white dark:bg-emerald-900 text-emerald-500 dark:emerald-400 shadow-xl border border-slate-200 dark:border-emerald-800' : 'text-slate-600 dark:text-teal-300 hover:text-slate-300'}`}
          >
            <Microscope size={16} /> Imaging
          </button>
          <button
            onClick={() => { setMode('reports'); setResult(null); }}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${mode === 'reports' ? 'bg-white dark:bg-emerald-900 text-emerald-500 dark:emerald-400 shadow-xl border border-slate-200 dark:border-emerald-800' : 'text-slate-600 dark:text-teal-300 hover:text-slate-300'}`}
          >
            <Paperclip size={16} /> Reports
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div
          className={`relative overflow-hidden border-2 border-dashed border-slate-300 dark:border-teal-700 rounded-3xl p-10 flex flex-col items-center justify-center text-center bg-white dark:bg-emerald-900/50 hover:bg-white dark:bg-emerald-900 hover:border-emerald-500 dark:emerald-400/50 transition-all cursor-pointer group min-h-[360px] shadow-2xl shadow-sm dark:shadow-sm dark:shadow-black/20 ${analyzing ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={!analyzing ? handleDropZoneClick : undefined}
        >
          {analyzing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white dark:bg-emerald-900/80 backdrop-blur-md rounded-3xl">
              <Loader2 className="w-12 h-12 text-emerald-500 dark:emerald-400 animate-spin mb-4" />
              <h4 className="font-bold text-slate-900 dark:text-slate-900 dark:text-white text-lg">{mode === 'imaging' ? 'AI Analyzing Scan...' : 'AI Scanning Report...'}</h4>
              <p className="text-sm text-emerald-500 dark:emerald-400 mt-1">{mode === 'imaging' ? 'Running Vision Models' : 'Extracting Text via OCR'}</p>
            </div>
          )}

          <div className="w-24 h-24 bg-stone-50 dark:bg-teal-950 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-emerald-500 dark:emerald-400/10 transition-all border border-slate-200 dark:border-emerald-800 shadow-inner duration-500">
            {mode === 'imaging' ? (
              <Microscope className="text-slate-600 dark:text-teal-300 w-10 h-10 group-hover:text-emerald-500 dark:emerald-400 transition-colors duration-500" />
            ) : (
              <Paperclip className="text-slate-600 dark:text-teal-300 w-10 h-10 group-hover:text-emerald-500 dark:emerald-400 transition-colors duration-500" />
            )}
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-2 tracking-wide">
            {mode === 'imaging' ? 'Upload Medical Scan' : 'Upload Clinical Report'}
          </h4>
          <p className="text-sm text-slate-600 dark:text-teal-300 max-w-[280px] mx-auto leading-relaxed">
            Drag & drop or click to browse. Supports JPG, PNG up to 50MB.
          </p>
          <button className="mt-8 px-8 py-3 bg-stone-50 dark:bg-teal-950 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold border border-slate-300 dark:border-teal-700 group-hover:border-emerald-500 dark:emerald-400/50 transition-colors shadow-lg">
            {mode === 'imaging' ? 'Select Scan' : 'Select Report'}
          </button>
        </div>

        {/* Results Area */}
        <div className="bg-white dark:bg-emerald-900 rounded-3xl border border-slate-200 dark:border-emerald-800 shadow-2xl shadow-sm dark:shadow-sm dark:shadow-black/20 flex flex-col min-h-[360px] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 dark:emerald-400/20 to-transparent"></div>

          <div className="p-6 border-b border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 dark:emerald-400/10 flex items-center justify-center border border-emerald-500 dark:emerald-400/20 shadow-inner">
                <Activity className="w-5 h-5 text-emerald-500 dark:emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-900 dark:text-white text-base">Analysis Results</h4>
                <p className="text-xs text-slate-600 dark:text-teal-300 uppercase tracking-widest mt-0.5">{result ? 'Completed' : 'Awaiting Input'}</p>
              </div>
            </div>
            {result && (
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold border border-emerald-500/20">Success</div>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col justify-center overflow-y-auto">
            {!result ? (
              <div className="flex flex-col items-center text-center opacity-40">
                <BrainCircuit className="w-16 h-16 text-slate-600 dark:text-teal-300 mb-6 drop-shadow-lg" />
                <p className="text-base font-semibold text-slate-900 dark:text-slate-900 dark:text-white">AI Engine Ready</p>
                <p className="text-sm text-slate-600 dark:text-teal-300 mt-2 max-w-[250px]">Upload a document to begin instant automated analysis.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 w-full">
                  {result.type === 'image_analysis' ? (
                    <div className="space-y-4">
                      <div className="p-5 bg-stone-50 dark:bg-teal-950 rounded-2xl border border-slate-200 dark:border-emerald-800 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest block mb-3 flex items-center gap-2"><Microscope size={12} /> Finding Overview</span>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-900 dark:text-white leading-relaxed">{result.result}</div>
                      </div>
                      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-bold leading-relaxed">Note: AI diagnostics are preliminary screening tools. Always consult a licensed physician for medical advice.</span>
                      </div>
                    </div>
                  ) : result.type === 'report_scan' ? (
                    <div className="space-y-4 w-full">
                      {/* Condensed Report View */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-stone-50 dark:bg-teal-950 rounded-2xl border border-slate-200 dark:border-emerald-800 shadow-inner">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest block mb-3 flex items-center gap-2"><Pill size={12} /> Medications</span>
                          <ul className="space-y-2">
                            {result.structured_data?.active_medications?.length > 0 ? (
                              result.structured_data.active_medications.map((m: string, i: number) => (
                                <li key={i} className="text-sm font-bold text-emerald-500 dark:emerald-400">{m}</li>
                              ))
                            ) : <li className="text-xs text-slate-600 dark:text-teal-300 italic">None Detected</li>}
                          </ul>
                        </div>
                        <div className="p-5 bg-stone-50 dark:bg-teal-950 rounded-2xl border border-slate-200 dark:border-emerald-800 shadow-inner">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest block mb-3 flex items-center gap-2"><AlertTriangle size={12} /> Allergies</span>
                          <ul className="space-y-2">
                            {result.structured_data?.allergies?.length > 0 ? (
                              result.structured_data.allergies.map((a: string, i: number) => (
                                <li key={i} className="text-sm font-bold text-red-500">{a}</li>
                              ))
                            ) : <li className="text-xs text-slate-600 dark:text-teal-300 italic">None Detected</li>}
                          </ul>
                        </div>
                      </div>
                      {result.structured_data?.vitals && Object.keys(result.structured_data.vitals).length > 0 && (
                        <div className="p-5 bg-stone-50 dark:bg-teal-950 rounded-2xl border border-slate-200 dark:border-emerald-800 shadow-inner flex flex-wrap gap-6">
                          {Object.entries(result.structured_data.vitals).map(([k, v], i) => (
                            <div key={i} className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase mb-1">{k.replace('_', ' ')}</span>
                              <span className="text-base font-bold text-emerald-400 tracking-wide">{v as string}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-400 text-sm font-bold p-5 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center gap-4">
                      <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                      {result.result || 'An error occurred during analysis.'}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 border-t border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/50 flex gap-4 mt-auto">
                <button
                  onClick={handleSaveToProfile}
                  disabled={saving || saved}
                  className="flex-1 py-3 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold hover:bg-emerald-600 dark:emerald-500 transition-all shadow-lg shadow-emerald-500 dark:emerald-400/20 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save to Profile'}
                </button>
                <button onClick={() => setResult(null)} className="px-6 py-3 bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 dark:text-teal-200 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:text-slate-900 dark:text-white hover:bg-slate-800 transition-all shadow-inner">
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const PrescriptionManager = ({ uid }: { uid: string | null }) => {
  const [meds, setMeds] = useState<any[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [showAddMed, setShowAddMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', freq: 'Once daily', type: '', doctor: '' });
  const [addingSaving, setAddingSaving] = useState(false);

  const [qrModal, setQrModal] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) { setLoadingMeds(false); return; }
    const q = query(collection(firestoreDb, 'prescriptions'), where('patientId', '==', uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      
      const flatMeds: any[] = [];
      for (const presc of docs) {
        if (presc.medications) {
          for (const m of presc.medications) {
            flatMeds.push({
              id: presc.id,
              name: m.name,
              dosage: m.dosage,
              freq: m.frequency,
              type: m.duration || 'Prescription',
              doctor: presc.prescribedBy || 'Doctor',
              status: presc.status || 'Active',
              qrCodeData: presc.qrCodeData
            });
          }
        } else if (presc.medication) { // Legacy format fallback
            flatMeds.push({
              id: presc.id,
              name: presc.medication,
              dosage: presc.dosage,
              freq: presc.frequency,
              type: presc.duration || 'Prescription',
              doctor: presc.prescribedBy || 'Doctor',
              status: presc.status || 'Active',
              qrCodeData: null
            });
        }
      }
      setMeds(flatMeds);
      setLoadingMeds(false);
    }, (e) => {
      console.error('Failed to load meds:', e);
      setLoadingMeds(false);
    });
    return () => unsubscribe();
  }, [uid]);

  const handleAddMed = async () => {
    if (!uid || !newMed.name) return;
    setAddingSaving(true);
    try {
      await addDoc(collection(firestoreDb, 'prescriptions'), {
        patientId: uid,
        medications: [{ name: newMed.name, dosage: newMed.dosage, frequency: newMed.freq, duration: newMed.type }],
        prescribedBy: newMed.doctor || 'Self-Reported',
        status: 'Active',
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
      setNewMed({ name: '', dosage: '', freq: 'Once daily', type: '', doctor: '' });
      setShowAddMed(false);
      toast.success('Prescription added');
    } catch (e) {
      console.error('Failed to add med:', e);
      toast.error('Failed to add prescription');
    } finally {
      setAddingSaving(false);
    }
  };
  const [warning, setWarning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Drug interaction check: warn if new med name overlaps with existing allergy or known interactions
  const checkInteraction = (name: string) => {
    const activeMeds = meds.filter(m => m.status === 'Active').map(m => m.name.toLowerCase());
    const interaction = checkInteractions(name, activeMeds);
    if (interaction) {
      setWarning(interaction);
      return true;
    }
    setWarning(null);
    return false;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">Active Prescriptions</h3>
          <p className="text-sm text-slate-600 dark:text-teal-300 dark:text-teal-200 mt-1">Manage your medications and view pharmacy QR codes.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-teal-300" />
            <input type="text" placeholder="Search medications..." className="w-full bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50 placeholder-slate-500 shadow-inner" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <button
            onClick={() => setShowAddMed(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold hover:bg-emerald-600 dark:emerald-500 transition-all shadow-lg shadow-emerald-500 dark:emerald-400/20 whitespace-nowrap"
          >
            <Plus size={16} />
            Add New
          </button>
        </div>
      </div>

      <AnimatePresence>
        {warning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/10 ring-1 ring-amber-500/20 border border-amber-500/20 rounded-2xl p-4 flex gap-4 overflow-hidden shadow-lg"
          >
            <AlertTriangle className="text-amber-500 w-6 h-6 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-500 uppercase tracking-tight">Interaction Warning</h4>
              <p className="text-sm text-amber-100/70 mt-1">{warning}</p>
            </div>
            <button onClick={() => setWarning(null)} className="p-2 h-fit text-amber-500 hover:bg-amber-500/20 rounded-lg transition-colors bg-amber-500/10"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-3xl shadow-2xl shadow-sm dark:shadow-sm dark:shadow-black/20 overflow-hidden">
        {/* Table Header */}
        <div className="p-4 md:px-6 border-b border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/50 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest w-1/3 sm:w-1/4 max-w-[250px]">Medication</div>
          <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest flex-1 hidden sm:block">Dosage & Type</div>
          <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest hidden md:block w-32">Provider</div>
          <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest hidden sm:block w-24">Status</div>
          <div className="text-[10px] font-bold text-slate-600 dark:text-teal-300 uppercase tracking-widest w-12 text-center">Action</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-white/5">
          {meds.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).map((med, idx) => (
            <div key={idx} className="p-4 md:px-6 flex items-center gap-4 hover:bg-[#2A2E39]/30 transition-colors group cursor-pointer">
              <div className="w-1/3 sm:w-1/4 max-w-[250px] flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${med.status === 'Active' ? 'bg-emerald-500 dark:emerald-400/10 text-emerald-500 dark:emerald-400 ring-1 ring-emerald-500 dark:emerald-400/20' : 'bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 border border-slate-200 dark:border-emerald-800'}`}>
                  <Pill size={20} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${med.status === 'Active' ? 'text-slate-900 dark:text-slate-900 dark:text-white group-hover:text-emerald-500 dark:emerald-400 text-base' : 'text-slate-600 dark:text-teal-300 dark:text-teal-200'} transition-colors`}>{med.name}</h4>
                  <p className="text-[10px] text-slate-600 dark:text-teal-300 font-semibold mt-1 uppercase tracking-wider">{med.freq}</p>
                </div>
              </div>

              <div className="flex-1 hidden sm:flex flex-col">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">{med.dosage}</div>
                <div className="text-xs text-slate-600 dark:text-teal-300 mt-0.5">{med.type}</div>
              </div>

              <div className="hidden md:block w-32">
                <span className="px-3 py-1.5 bg-stone-50 dark:bg-teal-950 rounded-xl text-xs font-semibold text-slate-300 border border-slate-200 dark:border-emerald-800 shadow-inner whitespace-nowrap">
                  {med.doctor}
                </span>
              </div>

              <div className="hidden sm:flex w-24 items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${med.status === 'Active' ? 'bg-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}`}></div>
                <span className={`text-xs font-bold ${med.status === 'Active' ? 'text-emerald-400' : 'text-slate-600 dark:text-teal-300 dark:text-teal-200'}`}>{med.status}</span>
              </div>

              <div className="w-12 flex justify-center">
                {med.qrCodeData ? (
                  <button onClick={(e) => { e.stopPropagation(); setQrModal(med.qrCodeData); }} className="w-8 h-8 rounded-xl bg-emerald-500 dark:emerald-400/10 flex items-center justify-center border border-emerald-500 dark:emerald-400/20 text-emerald-500 dark:emerald-400 hover:bg-emerald-500 dark:emerald-400 hover:text-slate-900 dark:text-slate-900 dark:text-white transition-colors shadow-sm" title="View Pharmacy QR">
                    <QrCode size={16} />
                  </button>
                ) : (
                  <button className="w-8 h-8 rounded-xl bg-stone-50 dark:bg-teal-950 flex items-center justify-center border border-slate-200 dark:border-emerald-800 text-slate-600 dark:text-teal-300 shadow-sm hover:bg-white/5 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {loadingMeds && (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="animate-spin text-emerald-500 dark:emerald-400" size={28} />
            </div>
          )}
          {!loadingMeds && meds.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
            <div className="p-12 text-center text-slate-600 dark:text-teal-300 text-sm font-bold">
              {searchQuery ? `No medications matching "${searchQuery}"` : 'No prescriptions yet. Add your first medication.'}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddMed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-emerald-900 p-8 rounded-[2rem] shadow-2xl max-w-md w-full border border-slate-300 dark:border-teal-700"
            >
              <h4 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-6">Add Prescription</h4>
              <div className="space-y-4">
                {[
                  { label: 'Medication Name', key: 'name' },
                  { label: 'Dosage (e.g. 5mg)', key: 'dosage' },
                  { label: 'Frequency', key: 'freq' },
                  { label: 'Type / Category', key: 'type' },
                  { label: 'Prescribing Doctor', key: 'doctor' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 uppercase tracking-wider block mb-1">{label}</label>
                    <input
                      type="text"
                      value={newMed[key as keyof typeof newMed]}
                      onChange={e => {
                        const val = e.target.value;
                        setNewMed(n => ({ ...n, [key]: val }));
                        if (key === 'name') {
                          checkInteraction(val);
                        }
                      }}
                      className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAddMed} disabled={addingSaving}
                  className="flex-1 py-3 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold hover:bg-emerald-600 dark:emerald-500 transition-all disabled:opacity-50"
                >
                  {addingSaving ? 'Saving...' : 'Add Medication'}
                </button>
                <button onClick={() => setShowAddMed(false)}
                  className="px-6 py-3 bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 dark:text-teal-200 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:text-slate-900 dark:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {qrModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-slate-900">Pharmacy QR</h4>
                <button onClick={() => setQrModal(null)} className="text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:text-slate-600 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-4 shadow-inner">
                <QRCodeSVG value={qrModal} size={180} level="M" />
              </div>
              <p className="text-xs text-slate-600 dark:text-teal-300 text-center font-medium">Show this digital prescription at any partnered pharmacy to instantly retrieve your medication details.</p>
              <button onClick={() => setQrModal(null)} className="w-full mt-6 py-3 bg-emerald-500 dark:emerald-400 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-sm font-bold hover:bg-emerald-600 dark:emerald-500 transition-all shadow-lg shadow-emerald-500 dark:emerald-400/20">Done</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

interface ChatMsg { role: 'user' | 'ai'; text: string; type: string; result?: string; confidence?: string; }
interface ChatSession { id: string; title: string; messages: ChatMsg[]; createdAt: string; }

const WELCOME_MSG: ChatMsg = {
  role: 'ai',
  text: "Hello! I'm your MediBOT AI Assistant. I've reviewed your latest vitals and medications. How can I assist you today?",
  type: 'text'
};

const AIChat = ({ uid }: { uid: string | null }) => {
  const { profile } = usePatientStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');

  const storageKey = `medibot_sessions_${uid || 'guest'}`;

  const makeSession = (initial?: ChatMsg): ChatSession => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Chat',
    messages: [initial ?? WELCOME_MSG],
    createdAt: new Date().toISOString(),
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) { const p = JSON.parse(stored); if (p?.length) return p; }
    } catch {}
    return [makeSession()];
  });

  const [activeId, setActiveId] = useState(() => sessions[0]?.id || '');
  const [hasFetchedWelcome, setHasFetchedWelcome] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(sessions)); } catch {}
  }, [sessions, storageKey]);

  const activeSession = sessions.find(s => s.id === activeId);
  const messages = activeSession?.messages || [];

  const addMsg = (msg: ChatMsg) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      const newMsgs = [...s.messages, msg];
      const title = s.title === 'New Chat' && msg.role === 'user'
        ? msg.text.slice(0, 32) + (msg.text.length > 32 ? '…' : '') : s.title;
      return { ...s, messages: newMsgs, title };
    }));
  };

  const newChat = () => {
    const s = makeSession();
    setSessions(prev => [s, ...prev]);
    setActiveId(s.id);
    setSidebarOpen(false);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (id === activeId) {
        if (!updated.length) { const fresh = makeSession(); setActiveId(fresh.id); return [fresh]; }
        setActiveId(updated[0].id);
      }
      return updated;
    });
  };

  const handleSend = async (text: string = input, isSystemInit = false) => {
    const t = text.trim(); if (!t && !isSystemInit) return;
    if (!isSystemInit) {
      addMsg({ role: 'user', text: t, type: 'text' });
      setInput(''); 
    }
    setIsTyping(true);
    if (uid && !isSystemInit) saveChatMessage(uid, 'user', t, 'text');
    const lc = t.toLowerCase();
    if (lc.includes('chest pain') || lc.includes('emergency') || lc.includes('breath')) setIsEmergency(true);
    try {
      let timeline_events = [];
      if (uid) {
        try {
          const snap = await getDocs(query(collection(firestoreDb, 'medicalEvents', uid, 'events'), orderBy('date', 'desc'), limit(10)));
          timeline_events = snap.docs.map(d => d.data());
        } catch(e) {}
      }

      const queryText = isSystemInit 
        ? "Please provide a very brief, friendly 2-sentence proactive welcome message acknowledging my current vitals, medications, or any recent timeline events. Do not offer diagnoses." 
        : t;

      const { data } = await apiClient.post('/api/chat/personalized', {
        query: queryText,
        patient_context: profile ? {
          age: profile.age, gender: profile.gender, blood_type: profile.bloodType,
          allergies: profile.allergies, active_medications: profile.activeMedications, recent_vitals: profile.recentVitals,
          timeline_events
        } : undefined,
      });
      if (data.type === 'emergency') setIsEmergency(true);
      if (isSystemInit) {
        setSessions(prev => prev.map(s => {
          if (s.id !== activeId) return s;
          // Replace the static welcome message with the dynamic one
          const newMsgs = [...s.messages];
          if (newMsgs[0]?.text === WELCOME_MSG.text) {
             newMsgs[0] = { role: 'ai', text: data.text, type: data.type || 'text' };
          }
          return { ...s, messages: newMsgs };
        }));
      } else {
        addMsg({ role: 'ai', text: data.text, type: data.type || 'text' });
        if (uid) saveChatMessage(uid, 'ai', data.text, data.type || 'text');
      }
    } catch {
      const off = 'I apologize, but I cannot connect to the AI engine right now. Please ensure the backend is running on port 8000.';
      addMsg({ role: 'ai', text: off, type: 'text' });
      if (uid && !isSystemInit) saveChatMessage(uid, 'ai', off, 'text');
    } finally { setIsTyping(false); }
  };

  useEffect(() => {
    if (activeSession && activeSession.messages.length === 1 && activeSession.messages[0].text === WELCOME_MSG.text && !hasFetchedWelcome) {
      setHasFetchedWelcome(true);
      handleSend('', true);
    }
  }, [activeSession, hasFetchedWelcome]);

  const handleFile = async (file: File) => {
    addMsg({ role: 'user', text: `📎 Uploading "${file.name}"…`, type: 'text' });
    addMsg({ role: 'ai', text: `Analyzing "${file.name}"…`, type: 'status' });
    try {
      if (file.type === 'application/pdf') {
        setSessions(prev => prev.map(s => s.id !== activeId ? s : { ...s, messages: [...s.messages.filter(m => m.type !== 'status'), { role: 'ai', text: 'PDF files need OCR. Please upload a JPG/PNG image of the report for best results.', type: 'text' }] }));
        return;
      }
      const reader = new FileReader();
      const b64 = await new Promise<string>(res => { reader.onloadend = () => res(reader.result as string); reader.readAsDataURL(file); });
      const { data } = await apiClient.post('/api/vision/analyze_xray', { image_base64: b64, patient_id: uid ?? 'unknown' });
      setSessions(prev => prev.map(s => s.id !== activeId ? s : { ...s, messages: [...s.messages.filter(m => m.type !== 'status'), { ...data, role: 'ai' }] }));
    } catch {
      setSessions(prev => prev.map(s => s.id !== activeId ? s : { ...s, messages: [...s.messages.filter(m => m.type !== 'status'), { role: 'ai', text: 'Failed to analyze the file. Please try again.', type: 'text' }] }));
    }
  };

  useEffect(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [messages, isTyping]);

  const quickReplies = ['Analyze my recent X-ray', 'Check my meds for side effects', 'Explain my last blood report', 'Schedule a follow-up'];

  return (
    <div className="flex bg-stone-50 dark:bg-teal-950" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* Sidebar backdrop (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* Chat history sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed md:relative z-30 w-72 h-full bg-stone-100 dark:bg-emerald-900 border-r border-slate-200 dark:border-emerald-800 flex flex-col flex-shrink-0 shadow-2xl"
          >
            <div className="p-4 border-b border-slate-200 dark:border-emerald-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">Chat History</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-slate-600 dark:text-teal-300 hover:text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/5 rounded-lg transition-colors"><X size={16} /></button>
            </div>
            <div className="p-3">
              <button onClick={newChat} className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-500 dark:emerald-400/10 border border-emerald-500 dark:emerald-400/20 rounded-xl text-emerald-500 dark:emerald-400 text-sm font-bold hover:bg-emerald-500 dark:emerald-400/20 transition-all">
                <PlusCircle size={15} /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
              {sessions.map(s => (
                <div key={s.id}
                  onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
                  className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all group ${s.id === activeId ? 'bg-emerald-500 dark:emerald-400/10 border border-emerald-500 dark:emerald-400/20' : 'hover:bg-white/5'}`}>
                  <MessageCircle size={13} className="text-slate-600 dark:text-teal-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-300 truncate">{s.title}</p>
                    <p className="text-[10px] text-slate-600">{new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                    className="p-1 opacity-0 group-hover:opacity-100 text-slate-600 dark:text-teal-300 hover:text-red-400 hover:bg-red-500/10 rounded transition-all">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isEmergency ? 'ring-inset ring-1 ring-red-500/30' : ''}`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/80 backdrop-blur-xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:text-slate-900 dark:text-slate-900 dark:text-white hover:bg-white/5 rounded-xl transition-colors">
              <Menu size={19} />
            </button>
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 dark:emerald-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500 dark:emerald-400/20">
                <Bot className="text-slate-900 dark:text-slate-900 dark:text-white w-5 h-5" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-[#121318] rounded-full ${isEmergency ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-900 dark:text-white text-sm leading-tight">MediBOT Intelligence</h4>
              <p className="text-[10px] text-slate-600 dark:text-teal-300 dark:text-teal-200">Personalised AI Health Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEmergency && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-slate-900 dark:text-slate-900 dark:text-white rounded-xl text-xs font-bold transition-all border border-red-500/20">
                <PhoneCall size={13} /><span className="hidden sm:inline">Emergency</span>
              </button>
            )}
            <button onClick={newChat} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-xl text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:text-emerald-500 dark:emerald-400 hover:border-emerald-500 dark:emerald-400/30 transition-all text-xs font-bold">
              <PlusCircle size={13} /><span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth">
          {/* Welcome state (first message only) */}
          {messages.length <= 1 && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 dark:emerald-400/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-emerald-500 dark:emerald-400/20">
                <BrainCircuit className="text-emerald-500 dark:emerald-400 w-7 h-7" />
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-slate-900 dark:text-white font-bold text-base">MediBOT AI</h3>
                <p className="text-slate-600 dark:text-teal-300 dark:text-teal-200 text-sm mt-1 max-w-xs">Ask me anything about your health — medications, vitals, symptoms, or lab results.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {quickReplies.map((r, i) => (
                  <button key={i} onClick={() => handleSend(r)}
                    className="px-4 py-2 bg-white dark:bg-emerald-900 border border-slate-300 dark:border-teal-700 rounded-full text-xs font-medium text-slate-300 hover:bg-emerald-500 dark:emerald-400/10 hover:border-emerald-500 dark:emerald-400/30 hover:text-emerald-500 dark:emerald-400 transition-all">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] sm:max-w-[72%]">
                {msg.type === 'status' ? (
                  <div className="flex items-center gap-1.5 text-emerald-500 dark:emerald-400 italic text-xs font-bold bg-emerald-500 dark:emerald-400/5 px-4 py-2 rounded-full border border-emerald-500 dark:emerald-400/10">
                    <Loader2 size={11} className="animate-spin" /> {msg.text}
                  </div>
                ) : msg.type === 'vision' || msg.type === 'image_analysis' ? (
                  <div className="bg-white dark:bg-emerald-900 border border-emerald-500 dark:emerald-400/20 rounded-3xl rounded-tl-sm p-5 shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-500 dark:emerald-400/10 rounded-xl"><Microscope className="text-emerald-500 dark:emerald-400 w-4 h-4" /></div>
                      <div><h5 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">Visual Analysis Complete</h5><p className="text-xs text-slate-600 dark:text-teal-300 dark:text-teal-200">AI Medical Imaging</p></div>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{msg.result || msg.text}</p>
                  </div>
                ) : (
                  <div className={`px-5 py-4 rounded-3xl text-sm leading-relaxed shadow-md ${msg.role === 'user'
                    ? 'bg-emerald-500 dark:bg-emerald-400 text-white dark:text-slate-900 rounded-tr-sm'
                    : 'bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 text-slate-600 dark:text-slate-300 rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 px-5 py-4 rounded-3xl rounded-tl-sm flex gap-1.5 shadow-lg">
                {[0, 130, 260].map(d => <span key={d} className="w-2 h-2 bg-emerald-500 dark:emerald-400/70 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </motion.div>
          )}
        </div>

        {/* Input bar */}
        <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-slate-200 dark:border-emerald-800 bg-stone-100 dark:bg-emerald-900/60 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-end gap-2 bg-white dark:bg-emerald-900 px-3 py-2 rounded-2xl border border-slate-300 dark:border-teal-700 focus-within:border-emerald-500 dark:emerald-400/50 focus-within:ring-1 focus-within:ring-emerald-500 dark:emerald-400/20 transition-all">
            <button onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-slate-600 dark:text-teal-300 dark:text-teal-200 hover:text-emerald-500 dark:emerald-400 hover:bg-emerald-500 dark:emerald-400/10 rounded-xl transition-colors flex-shrink-0" title="Upload file for analysis">
              <Paperclip size={17} />
            </button>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask MediBOT anything about your health…"
              className="flex-1 bg-transparent text-slate-900 dark:text-slate-900 dark:text-white px-1 py-2.5 text-sm focus:outline-none resize-none placeholder-slate-500 min-h-[44px] max-h-[130px]"
              rows={1} />
            <button onClick={() => handleSend()} disabled={!input.trim()}
              className="p-2.5 bg-gradient-to-br from-emerald-500 dark:emerald-400 to-indigo-500 text-slate-900 dark:text-slate-900 dark:text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500 dark:emerald-400/25 disabled:opacity-40 transition-all flex-shrink-0">
              <Send size={16} className="translate-x-0.5 -translate-y-0.5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-2">MediBOT may make mistakes. Verify critical medical information with your physician.</p>
        </div>
      </div>
    </div>
  );
};
















// --- Main Dashboard ---

// --- Simulated Live Vitals ---
function useSimulatedVitals(baseHr: number, baseSpo2: number, baseSteps: number) {
  const seedHr = baseHr > 0 ? baseHr : 72;
  const seedSpo2 = baseSpo2 > 0 ? baseSpo2 : 98;
  const seedSteps = baseSteps > 0 ? baseSteps : 4200;

  const [liveHr, setLiveHr] = useState(seedHr);
  const [liveSpo2, setLiveSpo2] = useState(seedSpo2);
  const [liveSteps, setLiveSteps] = useState(seedSteps);

  useEffect(() => {
    // Heart rate and SpO2 fluctuate every 3 seconds
    const vitalInterval = setInterval(() => {
      setLiveHr(prev => {
        const delta = (Math.random() - 0.5) * 4; // ±2 bpm per tick
        return Math.round(Math.min(99, Math.max(58, prev + delta)));
      });
      setLiveSpo2(prev => {
        const delta = (Math.random() - 0.5) * 0.8;
        return Math.round(Math.min(100, Math.max(95, prev + delta)) * 10) / 10;
      });
    }, 3000);

    // Steps increment gradually (approx 1 step per 1.5s while awake)
    const stepInterval = setInterval(() => {
      setLiveSteps(prev => prev + Math.floor(Math.random() * 3));
    }, 1500);

    return () => {
      clearInterval(vitalInterval);
      clearInterval(stepInterval);
    };
  }, []);

  return { liveHr, liveSpo2, liveSteps };
}

const AppointmentModal = ({ uid, onClose }: { uid: string | null, onClose: () => void }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);
  const { profile } = usePatientStore();
  
  const linkedDoctors = (profile as any)?.linkedDoctors || [];

  const handleBook = async () => {
    if (!uid || !date || !time || !reason || !doctorId) { toast.error('Please fill all fields and select a doctor'); return; }
    setSaving(true);
    try {
      await addDoc(collection(firestoreDb, 'appointments'), {
        patientId: uid,
        patientName: profile?.name || 'Unknown Patient',
        doctorId: doctorId,
        date, time, reason,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast.success('Appointment request sent');
      onClose();
    } catch { toast.error('Failed to book appointment'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }} className="bg-white dark:bg-emerald-900 rounded-[2rem] shadow-2xl max-w-sm w-full border border-slate-300 dark:border-teal-700 p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
        <h4 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-4">Book Appointment</h4>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Select Doctor</label>
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50">
              <option value="">-- Choose a doctor --</option>
              {linkedDoctors.map((d: any) => <option key={d.uid} value={d.uid}>{d.name}</option>)}
            </select>
            {linkedDoctors.length === 0 && <p className="text-[10px] text-amber-400 mt-1">Please link a doctor from your profile first.</p>}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-900 dark:text-white text-sm [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Time</label>
            <select value={time} onChange={e => setTime(e.target.value)} className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50">
              <option value="">-- Select Time Slot --</option>
              {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-teal-300 dark:text-teal-200 block mb-1.5">Reason for visit</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-stone-50 dark:bg-teal-950 border border-slate-300 dark:border-teal-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-900 dark:text-white text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:emerald-400/50" placeholder="Briefly describe your symptoms..."></textarea>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleBook} disabled={saving} className="flex-1 py-3 bg-emerald-500 dark:bg-emerald-400 text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-all disabled:opacity-50">
            {saving ? 'Booking...' : 'Submit Request'}
          </button>
          <button onClick={onClose} className="px-5 py-3 bg-stone-50 dark:bg-teal-950 text-slate-600 dark:text-teal-300 dark:text-teal-200 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:text-slate-900 dark:text-white transition-all">Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function PatientDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showProfile, setShowProfile] = useState(false);
  const [showAppt, setShowAppt] = useState(false);
  const { uid, profile } = usePatientStore();

  // Offline detection + delta sync on reconnect
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      if (!uid) return;
      try {
        const { messages, diagnostics, vitals } = await getUnsyncedRecords();

        // Sync chat messages to Firestore
        if (messages.length > 0) {
          for (const m of messages) {
            await addDoc(collection(firestoreDb, 'chatHistory', uid, 'messages'), {
              role: m.role, text: m.text, type: m.type,
              timestamp: m.timestamp, synced: true, createdAt: serverTimestamp(),
            });
          }
          await markAsSynced('chatHistory', messages.map(m => m.id!));
        }

        if (messages.length + diagnostics.length + vitals.length > 0) {
          toast.success(`Synced ${messages.length + diagnostics.length + vitals.length} offline records`);
        }
      } catch (e) {
        console.error('Delta sync failed:', e);
      }
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [uid]);

  const savedHr = profile?.recentVitals?.heartRate ?? 0;
  const savedSpo2 = profile?.recentVitals?.spo2 ?? 0;
  const savedSteps = profile?.recentVitals?.steps ?? 0;
  const { liveHr: hr, liveSpo2: spo2, liveSteps: steps } = useSimulatedVitals(savedHr, savedSpo2, savedSteps);

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-teal-950 text-slate-200 font-sans selection:bg-emerald-500 dark:emerald-400/30 font-sans selection:bg-sky-100 overflow-x-hidden">
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -48 }}
            animate={{ y: 0 }}
            exit={{ y: -48 }}
            className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 text-slate-900 text-xs font-bold py-2.5 shadow-lg"
          >
            <AlertTriangle size={14} />
            You are offline. Changes will sync automatically when your connection returns.
          </motion.div>
        )}
      </AnimatePresence>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          patientName={profile?.name || auth.currentUser?.displayName || 'Patient'}
          uid={uid}
          onMenuClick={() => setIsMenuOpen(true)}
          onProfileClick={() => setShowProfile(true)}
          onApptClick={() => setShowAppt(true)}
        />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && <ErrorBoundary label="Health Overview"><HealthOverview heartRate={hr} spo2={spo2} steps={steps} uid={uid} /></ErrorBoundary>}
              {activeTab === 'timeline' && <ErrorBoundary label="Medical Timeline"><MedicalTimeline uid={uid} /></ErrorBoundary>}
              {activeTab === 'lab' && <ErrorBoundary label="AI Diagnostic Lab"><AIDiagnosticLab uid={uid} /></ErrorBoundary>}
              {activeTab === 'prescriptions' && <ErrorBoundary label="Prescription Manager"><PrescriptionManager uid={uid} /></ErrorBoundary>}
              {activeTab === 'chat' && <ErrorBoundary label="MediBOT Chat"><AIChat uid={uid} /></ErrorBoundary>}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      <AnimatePresence>
        {showProfile && <ProfileEditor onClose={() => setShowProfile(false)} />}
        {showAppt && <AppointmentModal uid={uid} onClose={() => setShowAppt(false)} />}
      </AnimatePresence>
    </div>
  );
}
