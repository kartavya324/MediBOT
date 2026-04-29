/**
 * DoctorProfileEditor — First-time setup gatekeeper for doctor accounts.
 * Collects professional credentials and writes to both users/{uid} and doctors/{uid}.
 */

import React, { useState } from 'react';
import {
  X, Plus, Loader2, Stethoscope, Building2, Award, Phone,
  GraduationCap, Clock, FileText, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface DoctorProfileEditorProps {
  onClose: () => void;
  isFirstTime?: boolean;
}

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Pulmonologist', 'Neurologist',
  'Orthopedic Surgeon', 'Radiologist', 'Oncologist', 'Pediatrician',
  'Dermatologist', 'Gastroenterologist', 'Endocrinologist', 'Psychiatrist',
  'Ophthalmologist', 'ENT Specialist', 'Urologist', 'Nephrologist',
  'Rheumatologist', 'Anesthesiologist', 'Pathologist', 'Emergency Medicine',
];

const QUALIFICATIONS = [
  'MBBS', 'MD', 'MS', 'DM', 'MCh', 'DNB', 'MRCP', 'FRCS',
  'MBBS + MD', 'MBBS + MS', 'PhD (Medical)', 'Other',
];

export default function DoctorProfileEditor({ onClose, isFirstTime = false }: DoctorProfileEditorProps) {
  const uid = auth.currentUser?.uid;
  const [form, setForm] = useState({
    name: auth.currentUser?.displayName || '',
    specialization: '',
    qualification: '',
    licenseNumber: '',
    yearsOfExperience: '',
    hospital: '',
    department: '',
    phone: '',
    consultationFee: '',
    bio: '',
    languages: [] as string[],
  });
  const [langInput, setLangInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addLanguage = (val: string) => {
    const v = val.trim();
    if (!v || form.languages.includes(v)) return;
    setForm(f => ({ ...f, languages: [...f.languages, v] }));
    setLangInput('');
  };

  const handleSave = async () => {
    if (!uid) { toast.error('Not authenticated'); return; }
    if (!form.name.trim()) { toast.error('Please enter your full name'); return; }
    if (isFirstTime && !form.licenseNumber.trim()) { toast.error('Medical License Number is required'); return; }
    if (isFirstTime && !form.specialization) { toast.error('Please select your specialization'); return; }

    setSaving(true);
    try {
      const doctorData = {
        name: form.name.trim(),
        specialization: form.specialization,
        qualification: form.qualification,
        licenseNumber: form.licenseNumber.trim(),
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        hospital: form.hospital.trim(),
        department: form.department.trim(),
        phone: form.phone.trim(),
        consultationFee: form.consultationFee ? Number(form.consultationFee) : null,
        bio: form.bio.trim(),
        languages: form.languages,
        role: 'doctor',
        email: auth.currentUser?.email || '',
      };

      // Step 1: Update users/{uid}
      await setDoc(doc(db, 'users', uid), {
        email: auth.currentUser?.email || '',
        displayName: form.name.trim(),
        role: 'doctor',
        hasCompletedSetup: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Step 2: Write to doctors/{uid}
      await setDoc(doc(db, 'doctors', uid), {
        ...doctorData,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSaved(true);
      toast.success(isFirstTime ? '🩺 Doctor profile created! Welcome to MediBOT.' : 'Profile updated successfully.');
      setTimeout(onClose, 900);
    } catch (err: any) {
      console.error('Doctor profile save failed:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#0F1015] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 placeholder-slate-600";
  const labelCls = "text-xs font-bold text-slate-400 block mb-1.5";
  const section = (icon: React.ReactNode, label: string) => (
    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">{icon} {label}</h4>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={e => !isFirstTime && e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-[#1A1C23] border border-white/8 rounded-[2rem] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl relative"
      >
        {/* Top gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-sky-500 rounded-t-[2rem]" />

        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#1A1C23] z-10 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-500/10 ring-1 ring-sky-500/20 rounded-xl flex items-center justify-center">
              <Stethoscope className="text-sky-400 w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isFirstTime ? '🩺 Welcome Doctor — Complete Your Profile' : 'Edit Doctor Profile'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isFirstTime
                  ? 'Set up your credentials so patients can find and trust you.'
                  : 'Update your professional information.'}
              </p>
            </div>
          </div>
          {!isFirstTime && (
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-5 space-y-5">

          {/* Personal Info */}
          <div className="bg-[#0F1015]/50 rounded-2xl p-4 border border-white/5">
            {section(<User size={11} className="text-sky-400" />, 'Personal Information')}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Full Name (with title) *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="Dr. Rajesh Kumar" />
              </div>
              <div>
                <label className={labelCls}>Phone / Clinic Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputCls + " pl-9"} placeholder="+91 98765 43210" type="tel" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Consultation Fee (₹)</label>
                <input type="number" value={form.consultationFee}
                  onChange={e => setForm(f => ({ ...f, consultationFee: e.target.value }))}
                  className={inputCls} placeholder="500" min={0} />
              </div>
            </div>
          </div>

          {/* Professional Credentials */}
          <div className="bg-[#0F1015]/50 rounded-2xl p-4 border border-white/5">
            {section(<Award size={11} className="text-amber-400" />, 'Professional Credentials')}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Medical License No. *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                  <input value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                    className={inputCls + " pl-9"} placeholder="MH-2019-XXXXX" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Highest Qualification</label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                  <select value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}
                    className={inputCls + " pl-9"}>
                    <option value="">Select...</option>
                    {QUALIFICATIONS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Specialization *</label>
                <select value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                  className={inputCls}>
                  <option value="">Select specialization...</option>
                  {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Years of Experience</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                  <input type="number" value={form.yearsOfExperience}
                    onChange={e => setForm(f => ({ ...f, yearsOfExperience: e.target.value }))}
                    className={inputCls + " pl-9"} placeholder="5" min={0} max={70} />
                </div>
              </div>
            </div>
          </div>

          {/* Hospital / Clinic */}
          <div className="bg-[#0F1015]/50 rounded-2xl p-4 border border-white/5">
            {section(<Building2 size={11} className="text-indigo-400" />, 'Hospital / Clinic')}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Hospital / Clinic Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                  <input value={form.hospital} onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))}
                    className={inputCls + " pl-9"} placeholder="Apollo Hospitals, Mumbai" />
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Department</label>
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className={inputCls} placeholder="Cardiology / ICU / OPD, etc." />
              </div>
            </div>
          </div>

          {/* Languages */}
          <div className="bg-[#0F1015]/50 rounded-2xl p-4 border border-white/5">
            {section(<GraduationCap size={11} className="text-emerald-400" />, 'Languages Spoken')}
            <div className="flex gap-2 mb-3">
              <input value={langInput} onChange={e => setLangInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLanguage(langInput))}
                className={inputCls + " flex-1"} placeholder="e.g. English, Hindi, Marathi... (press Enter)" />
              <button onClick={() => addLanguage(langInput)}
                className="px-3 py-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl hover:bg-sky-500/20 transition-colors">
                <Plus size={15} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.languages.map((l, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">
                  {l}
                  <button onClick={() => setForm(f => ({ ...f, languages: f.languages.filter((_, j) => j !== i) }))}
                    className="hover:text-emerald-300"><X size={11} /></button>
                </span>
              ))}
              {!form.languages.length && <p className="text-xs text-slate-600 italic">Add languages you consult in.</p>}
            </div>
          </div>

          {/* Professional Bio */}
          <div className="bg-[#0F1015]/50 rounded-2xl p-4 border border-white/5">
            {section(<FileText size={11} className="text-sky-400" />, 'Professional Bio (Optional)')}
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              className={inputCls + " resize-none h-20"}
              placeholder="Brief description of your expertise, research interests, or clinical focus area..." />
            <p className="text-[10px] text-slate-600 mt-1 text-right">{form.bio.length}/300 chars</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex gap-3 sticky bottom-0 bg-[#1A1C23] rounded-b-[2rem]">
          {!isFirstTime && (
            <button onClick={onClose}
              className="flex-1 py-3 bg-[#0F1015] text-slate-400 border border-white/5 rounded-xl text-sm font-bold hover:text-white transition-colors">
              Cancel
            </button>
          )}
          <button onClick={handleSave} disabled={saving || saved}
            className="flex-1 py-3 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 className="animate-spin w-4 h-4" /> Saving Doctor Profile...</>
              : saved
              ? '✓ Profile Saved!'
              : isFirstTime ? 'Complete Setup & Enter Dashboard' : 'Save Profile'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
