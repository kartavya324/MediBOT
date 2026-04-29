import React, { useState } from 'react';
import { X, Plus, Loader2, User, Droplets, AlertTriangle, Pill, Activity, Phone, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { usePatientStore } from '../store/usePatientStore';
import { savePatient } from '../lib/patientService';
import { useThemeStore } from '../store/useThemeStore';

interface ProfileEditorProps {
  onClose: () => void;
  isFirstTime?: boolean;
}

function calcAge(dob: string): number {
  if (!dob) return 0;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function ProfileEditor({ onClose, isFirstTime = false }: ProfileEditorProps) {
  const { uid, profile, setProfile } = usePatientStore();
  const { isDarkMode } = useThemeStore();

  const [form, setForm] = useState({
    name: profile?.name || '',
    dob: (profile as any)?.dob || '',
    gender: profile?.gender || '',
    bloodType: profile?.bloodType || '',
    weight: (profile as any)?.weight || '',
    height: (profile as any)?.height || '',
    emergencyContact: (profile as any)?.emergencyContact || '',
    allergies: profile?.allergies || [] as string[],
    activeMedications: profile?.activeMedications || [] as string[],
    recentVitals: {
      heartRate: profile?.recentVitals?.heartRate || 0,
      spo2: profile?.recentVitals?.spo2 || 0,
      steps: profile?.recentVitals?.steps || 0,
    },
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [medInput, setMedInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addTag = (field: 'allergies' | 'activeMedications', value: string) => {
    const v = value.trim();
    if (!v || form[field].includes(v)) return;
    setForm(f => ({ ...f, [field]: [...f[field], v] }));
    if (field === 'allergies') setAllergyInput('');
    else setMedInput('');
  };

  const removeTag = (field: 'allergies' | 'activeMedications', idx: number) =>
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!uid) { toast.error('Not authenticated'); return; }
    if (!form.name.trim()) { toast.error('Please enter your full name'); return; }
    if (isFirstTime && !form.dob) { toast.error('Please enter your date of birth'); return; }

    setSaving(true);
    try {
      const age = form.dob ? calcAge(form.dob) : (profile?.age ?? 0);
      const dobDate = form.dob ? new Date(form.dob).toISOString().split('T')[0] : null;

      const patientData = {
        name: form.name.trim(),
        dob: dobDate,
        age,
        gender: form.gender,
        bloodType: form.bloodType,
        weight: form.weight ? Number(form.weight) : null,
        height: form.height ? Number(form.height) : null,
        emergencyContact: form.emergencyContact,
        allergies: form.allergies,
        activeMedications: form.activeMedications,
        recentVitals: { ...form.recentVitals, timestamp: new Date().toISOString() },
      };

      await setDoc(doc(db, 'users', uid), {
        email: auth.currentUser?.email || '',
        displayName: form.name.trim(),
        hasCompletedSetup: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await savePatient(uid, patientData);

      if (isFirstTime && dobDate) {
        try {
          const { addDoc, collection } = await import('firebase/firestore');
          await addDoc(collection(db, 'medicalEvents', uid, 'events'), {
            date: dobDate,
            title: 'Date of Birth',
            desc: `Patient born on ${new Date(dobDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
            type: 'checkup',
            createdAt: serverTimestamp(),
          });
        } catch { /* non-critical */ }
      }

      setProfile({ ...profile!, ...patientData } as any);
      setSaved(true);
      toast.success(isFirstTime ? '🎉 Profile created! Welcome to MediBOT.' : 'Profile updated successfully.');
      setTimeout(onClose, 900);
    } catch (err: any) {
      console.error('Profile save failed:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:focus:ring-emerald-400/50 placeholder-slate-400 dark:placeholder-slate-600";
  const labelCls = "text-xs font-bold text-slate-600 dark:text-teal-300 block mb-1.5";
  const sectionTitle = (icon: React.ReactNode, label: string) => (
    <h4 className="text-[10px] font-bold text-slate-500 dark:text-teal-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">{icon}{label}</h4>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={e => !isFirstTime && e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 rounded-[2rem] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 rounded-t-[2rem]" />

        <div className="p-5 border-b border-slate-200 dark:border-emerald-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-emerald-900/80 backdrop-blur-xl z-10 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl flex items-center justify-center">
              <User className="text-emerald-500 dark:text-emerald-400 w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isFirstTime ? '👋 Welcome — Set Up Your Health Profile' : 'Edit Health Profile'}
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-teal-300">
                {isFirstTime ? 'Complete your profile so MediBOT can personalise your care.' : 'Update your medical information.'}
              </p>
            </div>
          </div>
          {!isFirstTime && (
            <button onClick={onClose} className="p-2 text-slate-500 dark:text-teal-300 hover:text-slate-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/5 rounded-xl transition-colors"><X size={18} /></button>
          )}
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-stone-50 dark:bg-teal-950/50 rounded-2xl p-4 border border-slate-200 dark:border-emerald-800">
            {sectionTitle(<User size={11} className="text-emerald-500 dark:text-emerald-400" />, 'Basic Information')}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="Your full name" />
              </div>
              <div>
                <label className={labelCls}>Date of Birth {isFirstTime && '*'}</label>
                <input type="date" value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className={inputCls + " [color-scheme:light] dark:[color-scheme:dark]"} />
                {form.dob && <p className="text-[10px] text-slate-500 mt-1">{calcAge(form.dob)} years old</p>}
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select...</option>
                  {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}><span className="flex items-center gap-1"><Droplets size={10} className="text-red-500" /> Blood Type</span></label>
                <select value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select...</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Weight (kg)</label>
                <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  className={inputCls} placeholder="70" min={1} max={500} />
              </div>
              <div>
                <label className={labelCls}>Height (cm)</label>
                <input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                  className={inputCls} placeholder="175" min={1} max={300} />
              </div>
            </div>
          </div>

          <div className="bg-stone-50 dark:bg-teal-950/50 rounded-2xl p-4 border border-slate-200 dark:border-emerald-800">
            {sectionTitle(<Phone size={11} className="text-amber-500" />, 'Emergency Contact')}
            <input value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))}
              className={inputCls} placeholder="e.g. +91 98765 43210 — Parent / Spouse" />
          </div>

          <div className="bg-stone-50 dark:bg-teal-950/50 rounded-2xl p-4 border border-slate-200 dark:border-emerald-800">
            {sectionTitle(<AlertTriangle size={11} className="text-amber-500" />, 'Known Allergies')}
            <div className="flex gap-2 mb-3">
              <input value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('allergies', allergyInput))}
                className={inputCls + " flex-1"} placeholder="e.g. Penicillin, NSAIDs... (press Enter)" />
              <button onClick={() => addTag('allergies', allergyInput)}
                className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-colors">
                <Plus size={15} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.allergies.map((a, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-full text-xs font-bold">
                  {a}<button onClick={() => removeTag('allergies', i)} className="hover:text-red-400"><X size={11} /></button>
                </span>
              ))}
              {!form.allergies.length && <p className="text-xs text-slate-500 dark:text-teal-300 italic">No allergies recorded — type above and press Enter.</p>}
            </div>
          </div>

          <div className="bg-stone-50 dark:bg-teal-950/50 rounded-2xl p-4 border border-slate-200 dark:border-emerald-800">
            {sectionTitle(<Pill size={11} className="text-emerald-500 dark:text-emerald-400" />, 'Active Medications')}
            <div className="flex gap-2 mb-3">
              <input value={medInput} onChange={e => setMedInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('activeMedications', medInput))}
                className={inputCls + " flex-1"} placeholder="e.g. Warfarin 5mg, Lisinopril 10mg... (press Enter)" />
              <button onClick={() => addTag('activeMedications', medInput)}
                className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-colors">
                <Plus size={15} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.activeMedications.map((m, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold">
                  {m}<button onClick={() => removeTag('activeMedications', i)} className="hover:text-emerald-400"><X size={11} /></button>
                </span>
              ))}
              {!form.activeMedications.length && <p className="text-xs text-slate-500 dark:text-teal-300 italic">No medications recorded.</p>}
            </div>
          </div>

          <div className="bg-stone-50 dark:bg-teal-950/50 rounded-2xl p-4 border border-slate-200 dark:border-emerald-800">
            {sectionTitle(<Activity size={11} className="text-emerald-500 dark:text-emerald-400" />, 'Baseline Vitals (Optional)')}
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'heartRate', label: 'Heart Rate (bpm)', placeholder: '72', max: 300 },
                { key: 'spo2', label: 'SpO₂ (%)', placeholder: '98', max: 100 },
                { key: 'steps', label: 'Daily Steps', placeholder: '4500', max: 100000 },
              ].map(({ key, label, placeholder, max }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input type="number" min={0} max={max} placeholder={placeholder}
                    value={(form.recentVitals as any)[key] || ''}
                    onChange={e => setForm(f => ({ ...f, recentVitals: { ...f.recentVitals, [key]: parseInt(e.target.value) || 0 } }))}
                    className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-emerald-800 flex gap-3 sticky bottom-0 bg-white dark:bg-emerald-900 rounded-b-[2rem]">
          {!isFirstTime && (
            <button onClick={onClose}
              className="flex-1 py-3 bg-stone-100 dark:bg-teal-950 text-slate-600 dark:text-teal-300 border border-slate-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
            >Cancel</button>
          )}
          <button onClick={handleSave} disabled={saving || saved}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="animate-spin w-4 h-4" /> Saving your MediBOT Profile...</>
              : saved
              ? '✓ Profile Saved!'
              : isFirstTime ? 'Complete Setup & Enter MediBOT' : 'Save Profile'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
