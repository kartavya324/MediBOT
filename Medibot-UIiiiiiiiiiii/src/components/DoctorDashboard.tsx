/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Doctor Dashboard — Full Clinical Command Center
 * All 5 tabs: Command Center, Patient Registry, Imaging Lab, Pharmacy Hub, AI Insights
 */

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  Stethoscope, Search, Activity, ShieldCheck, BrainCircuit, Loader2,
  LayoutDashboard, History, Microscope, Pill, LogOut, Heart,
  AlertTriangle, Layers, FileText, User, Clock, Upload, Sparkles, X,
  Users, FlaskConical, TrendingUp, CheckCircle, AlertCircle, ChevronRight,
  BarChart3, Zap, Menu, MessageSquare, Calendar, Sun, Moon
} from 'lucide-react';
import { checkInteractions } from '../utils/drugSafetyData';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, ResponsiveContainer, YAxis, BarChart, Bar, XAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useDoctorStore, deriveDisplayFields } from '../store/useDoctorStore';
import apiClient from '../lib/apiClient';
import { useThemeStore } from '../store/useThemeStore';

type DoctorTab = 'command' | 'registry' | 'imaging' | 'pharmacy' | 'insights' | 'assistant' | 'appointments';

const OVERLAY_REGIONS: Record<string, { cx: number; cy: number; rx: number; ry: number; label: string }[]> = {
  Pneumonia:    [{ cx: 55, cy: 65, rx: 22, ry: 18, label: 'Infiltrate' }],
  COVID:        [{ cx: 38, cy: 60, rx: 20, ry: 15, label: 'Ground-glass' }, { cx: 65, cy: 58, rx: 18, ry: 14, label: 'Ground-glass' }],
  Tuberculosis: [{ cx: 50, cy: 25, rx: 18, ry: 12, label: 'Upper-lobe lesion' }],
  Pneumothorax: [{ cx: 72, cy: 40, rx: 14, ry: 28, label: 'Air pocket' }],
  Normal: [],
};

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------
const Sparkline = ({ data, color }: { data: { value: number }[]; color: string }) => (
  <div className="h-10 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const Sidebar = ({ activeTab, setActiveTab, onLogout, isOpen, setIsOpen }: {
  activeTab: DoctorTab; setActiveTab: (t: DoctorTab) => void; onLogout: () => void; isOpen: boolean; setIsOpen: (o: boolean) => void;
}) => {
  const tabs = [
    { id: 'command' as DoctorTab, icon: LayoutDashboard, label: 'Command Center' },
    { id: 'registry' as DoctorTab, icon: Users, label: 'Patient Registry' },
    { id: 'imaging' as DoctorTab, icon: Microscope, label: 'Imaging Lab' },
    { id: 'pharmacy' as DoctorTab, icon: Pill, label: 'Pharmacy Hub' },
    { id: 'insights' as DoctorTab, icon: BrainCircuit, label: 'Insights' },
    { id: 'assistant' as DoctorTab, icon: MessageSquare, label: 'AI Assistant' },
    { id: 'appointments' as DoctorTab, icon: Calendar, label: 'Appointments' },
  ];
  return (
    <>
      <div className={`fixed inset-0 bg-slate-900/50 z-20 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)} />
      <div className={`fixed lg:static top-0 left-0 h-full w-64 bg-stone-100 dark:bg-teal-950 flex flex-col z-30 transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex-shrink-0`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-800 dark:border-emerald-800 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 dark:emerald-400 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-500/10 flex-shrink-0">
              <Stethoscope className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Medi<span className="text-emerald-500 dark:emerald-400">BOT</span></span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 dark:text-teal-300 dark:text-teal-300 hover:text-slate-900 dark:text-white dark:hover:text-white"><X size={20} /></button>
        </div>
      <nav className="flex-1 p-4 space-y-1 mt-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border-l-4 ${
              activeTab === tab.id ? 'border-emerald-500 bg-emerald-500 text-white dark:bg-emerald-400/10 dark:text-emerald-400 shadow-sm' : 'border-transparent text-slate-500 dark:text-teal-200 dark:text-teal-200 hover:bg-stone-50 dark:hover:bg-teal-900 hover:text-slate-900 dark:text-white dark:hover:text-white'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 dark:border-emerald-800 dark:border-emerald-800">
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-teal-200 dark:text-teal-200 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={18} /><span>Sign Out</span>
        </button>
      </div>
    </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// TAB 1: Command Center — Patient List
// ---------------------------------------------------------------------------
const PatientList = ({ patients, activeId, onSelect }: { patients: any[]; activeId: string; onSelect: (id: string) => void }) => {
  const [search, setSearch] = useState('');
  const filtered = patients.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="w-72 border-r border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-stone-50 dark:bg-teal-950 flex flex-col h-full flex-shrink-0">
      <div className="p-5 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-white dark:bg-emerald-900 dark:bg-emerald-900">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-3">Patient Queue <span className="text-slate-400 dark:text-teal-300 dark:text-teal-300 font-normal">({patients.length})</span></h3>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-teal-300 dark:text-teal-300" size={13} />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-900 dark:text-white dark:text-white focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20 outline-none" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map(p => (
          <button key={p.id} onClick={() => onSelect(p.id)}
            className={`w-full text-left p-3.5 rounded-xl transition-all border ${activeId === p.id ? 'bg-white dark:bg-emerald-900 dark:bg-emerald-900 border-emerald-500 dark:emerald-400 shadow ring-1 ring-emerald-500 dark:emerald-400/10' : 'bg-white dark:bg-emerald-900 dark:bg-emerald-900/60 border-slate-200 dark:border-emerald-800 dark:border-emerald-800 hover:border-sky-300 hover:bg-white dark:bg-emerald-900 dark:bg-emerald-900'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.priority === 'red' ? 'bg-red-500 animate-pulse' : p.priority === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="font-bold text-slate-900 dark:text-white dark:text-white text-sm truncate">{p.name || 'Unnamed'}</span>
              </div>
              <span className="text-[9px] text-slate-400 dark:text-teal-300 dark:text-teal-300">#{p.id.slice(0,6)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.priority === 'red' ? 'bg-red-50 text-red-600' : p.priority === 'yellow' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{p.status}</span>
              <span className="text-[10px] text-slate-400 dark:text-teal-300 dark:text-teal-300">{p.vitals.hr} bpm</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 1: Active Patient Profile
// ---------------------------------------------------------------------------
const ActivePatientProfile = ({ patient }: { patient: any }) => {
  const isAlert = patient.vitals.hr > 100 || patient.vitals.spo2 < 94;
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const handleAiBrief = async () => {
    if (!patient.history.length) { toast.error('No timeline events to summarize.'); return; }
    setSummarizing(true); setAiSummary(null);
    try {
      const { data } = await apiClient.post('/api/doctor/summarize', { patient_name: patient.name, patient_age: patient.age || 0, timeline_events: patient.history.slice(0, 5) });
      setAiSummary(data.summary);
      await addDoc(collection(db, 'medicalEvents', patient.id, 'events'), { date: new Date().toISOString().split('T')[0], title: 'AI Clinical Brief', desc: data.summary, type: 'checkup', createdAt: serverTimestamp() });
      toast.success('AI Brief saved to timeline');
    } catch { toast.error('Failed to generate AI summary'); }
    finally { setSummarizing(false); }
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-emerald-900 dark:bg-emerald-900 overflow-y-auto min-w-0">
      <div className={`p-6 border-b ${isAlert ? 'border-red-200 bg-red-50/30' : 'border-slate-100 dark:border-emerald-800 dark:border-emerald-800'}`}>
        {isAlert && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            <AlertTriangle size={13} className="text-red-600" />
            <span className="text-xs font-bold text-red-700">VITALS ALERT — {patient.vitals.hr > 100 ? `HR ${patient.vitals.hr} bpm (Tachycardia)` : `SpO₂ ${patient.vitals.spo2}% (Hypoxia)`}</span>
          </motion.div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAlert ? 'bg-red-100' : 'bg-slate-100'}`}><User size={28} className={isAlert ? 'text-red-400' : 'text-slate-300'} /></div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">{patient.name}</h2>
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200">{patient.gender}, {patient.age}y</span>
                <span className="px-2 py-0.5 bg-emerald-50 dark:teal-900 rounded-full text-xs font-bold text-emerald-600 dark:emerald-500">{patient.bloodType}</span>
              </div>
              <p className="text-slate-400 dark:text-teal-300 dark:text-teal-300 text-xs flex items-center gap-1 mt-0.5"><ShieldCheck size={11} className="text-emerald-500" /> MediBOT Verified</p>
            </div>
          </div>
          <button onClick={handleAiBrief} disabled={summarizing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 dark:emerald-400 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 dark:emerald-500 transition-all disabled:opacity-60 shadow-lg shadow-emerald-200 dark:teal-700"
          >
            {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} AI Brief
          </button>
        </div>
        {(patient.allergies?.length > 0 || patient.activeMedications?.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {patient.allergies?.map((a: string, i: number) => <span key={i} className="px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold rounded-full">⚠ {a}</span>)}
            {patient.activeMedications?.map((m: string, i: number) => <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:text-teal-100 dark:text-teal-100 text-[10px] font-bold rounded-full">💊 {m}</span>)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {aiSummary && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-5 mt-4 p-4 bg-emerald-50 dark:teal-900 border border-emerald-200 dark:teal-700 rounded-2xl"
          >
            <div className="flex items-center gap-2 mb-2"><Sparkles size={13} className="text-emerald-500 dark:emerald-400" /><span className="text-xs font-bold text-emerald-700 dark:emerald-300 uppercase">AI Clinical Brief</span>
              <button onClick={() => setAiSummary(null)} className="ml-auto text-slate-400 dark:text-teal-300 dark:text-teal-300 hover:text-slate-600 dark:text-teal-100 dark:text-teal-100"><X size={13} /></button>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-slate-200 leading-relaxed">{aiSummary}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Heart, label: 'Heart Rate', val: `${patient.vitals.hr} bpm`, data: patient.hrData, color: isAlert && patient.vitals.hr > 100 ? '#EF4444' : '#94A3B8', alert: isAlert && patient.vitals.hr > 100 },
            { icon: Activity, label: 'SpO₂', val: `${patient.vitals.spo2}%`, data: patient.spo2Data, color: isAlert && patient.vitals.spo2 < 94 ? '#EF4444' : '#0EA5E9', alert: isAlert && patient.vitals.spo2 < 94 },
          ].map(({ icon: Icon, label, val, data, color, alert }) => (
            <div key={label} className={`p-4 rounded-2xl border ${alert ? 'bg-red-50 border-red-200' : 'bg-stone-50 dark:bg-teal-950 border-slate-100 dark:border-emerald-800 dark:border-emerald-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5"><Icon size={14} className={alert ? 'text-red-600' : 'text-slate-500 dark:text-teal-200 dark:text-teal-200'} /><span className="text-[10px] font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase">{label}</span></div>
                <span className={`text-lg font-bold ${alert ? 'text-red-600' : 'text-slate-900 dark:text-white dark:text-white'}`}>{val}</span>
              </div>
              <Sparkline data={data} color={color} />
            </div>
          ))}
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase mb-3 flex items-center gap-2"><History size={13} className="text-emerald-500 dark:emerald-400" /> Clinical Timeline</h4>
          {patient.history.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-teal-300 dark:text-teal-300 text-sm py-6 bg-stone-50 dark:bg-teal-950 rounded-xl">No recorded events yet.</div>
          ) : (
            <div className="relative pl-5 space-y-3 before:absolute before:left-[6px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {patient.history.map((ev: any, i: number) => {
                const isSelected = selectedEvent === ev.id;
                return (
                <div key={i} className="relative">
                  <div className={`absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${ev.type === 'surgery' ? 'bg-red-500' : ev.type === 'med' ? 'bg-emerald-500 dark:emerald-400' : 'bg-emerald-500'}`} />
                  <div onClick={() => setSelectedEvent(isSelected ? null : ev.id)} className={`bg-stone-50 dark:bg-teal-950 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'border-sky-300 bg-emerald-50 dark:teal-900/50' : 'border-slate-100 dark:border-emerald-800 dark:border-emerald-800 hover:border-slate-300'}`}>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-teal-300 dark:text-teal-300">{ev.date}</span>
                    <h5 className="font-bold text-slate-800 dark:text-slate-100 dark:text-slate-100 text-xs mt-0.5">{ev.title}</h5>
                    {ev.desc && <p className={`text-[11px] text-slate-500 dark:text-teal-200 dark:text-teal-200 mt-0.5 ${isSelected ? '' : 'line-clamp-1'}`}>{ev.desc}</p>}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-emerald-800 dark:border-emerald-800/60 flex items-center justify-between gap-2 flex-wrap">
                        {ev.doctor && <p className="text-[10px] text-slate-600 dark:text-teal-100 dark:text-teal-100"><strong className="text-slate-700 dark:text-slate-200 dark:text-slate-200">Provider:</strong> {ev.doctor}</p>}
                        {ev.fileUrl && (
                          <button onClick={(e) => { e.stopPropagation(); window.open(ev.fileUrl, '_blank'); }} className="text-[10px] bg-emerald-100 dark:teal-800 text-emerald-700 dark:emerald-300 font-bold px-2 py-1 rounded-md hover:bg-emerald-200 dark:teal-700 transition-colors inline-flex items-center gap-1 ml-auto"><FileText size={10} /> View Document</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 1: AI Diagnostic Panel (Command Center right panel)
// ---------------------------------------------------------------------------
const AIDiagnosticPanel = ({ patient, onPrescriptionSaved }: { patient: any; onPrescriptionSaved: (rx: any) => void }) => {
  const [overlay, setOverlay] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prescForm, setPrescForm] = useState({ name: '', dosage: '', freq: '', duration: '', notes: '' });
  const [interactionWarning, setInteractionWarning] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  const handleScan = async (file: File) => {
    setAnalyzing(true); setScanResult(null); setOverlay(false);
    setScanImageUrl(URL.createObjectURL(file));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>(res => { reader.onloadend = () => res(reader.result as string); reader.readAsDataURL(file); });
      const { data } = await apiClient.post('/api/vision/analyze_xray', { image_base64: base64, patient_id: patient?.id ?? 'unknown' });
      setScanResult(data); toast.success(`Analysis: ${data.predicted_class}`);
    } catch { toast.error('X-ray analysis failed'); setScanResult({ predicted_class: 'Error', severity: '—', confidence: '—', recommendation: 'Could not connect to AI engine.' }); }
    finally { setAnalyzing(false); }
  };

  const handleSign = async () => {
    if (!prescForm.name || !patient) { toast.error('Fill in medication name'); return; }
    if (interactionWarning && !window.confirm('Drug interaction warning exists. Proceed anyway?')) return;
    setSigning(true);
    try {
      const doctorName = auth.currentUser?.displayName ?? 'Doctor';
      const payload = { medication: prescForm.name, dosage: prescForm.dosage, frequency: prescForm.freq, duration: prescForm.duration, notes: prescForm.notes, prescribedBy: doctorName, patientId: patient.id, patientName: patient.name, issuedAt: new Date().toISOString(), status: 'Active' };
      await addDoc(collection(db, 'prescriptions', patient.id, 'items'), { ...payload, createdAt: serverTimestamp() });
      await addDoc(collection(db, 'medicalEvents', patient.id, 'events'), { date: new Date().toISOString().split('T')[0], title: `Prescribed: ${prescForm.name} ${prescForm.dosage}`, desc: `${prescForm.freq}. ${prescForm.duration}. By Dr. ${doctorName}.`, type: 'med', doctor: doctorName, createdAt: serverTimestamp() });
      setQrPayload(JSON.stringify(payload));
      onPrescriptionSaved(payload);
      toast.success('Prescription signed & saved!');
      setPrescForm({ name: '', dosage: '', freq: '', duration: '', notes: '' });
      setInteractionWarning(null);
    } catch { toast.error('Failed to save prescription'); }
    finally { setSigning(false); }
  };

  const overlayRegions = scanResult ? (OVERLAY_REGIONS[scanResult.predicted_class] ?? []) : [];

  return (
    <div className="w-88 border-l border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-stone-50 dark:bg-teal-950 flex flex-col h-full overflow-y-auto flex-shrink-0" style={{ width: '22rem' }}>
      <div className="p-4 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-white dark:bg-emerald-900 dark:bg-emerald-900 sticky top-0 z-10">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white flex items-center gap-2"><BrainCircuit className="text-emerald-500 dark:emerald-400" size={16} /> AI Diagnostic Panel</h3>
      </div>
      <div className="p-4 space-y-5">
        {/* Radiology mini-viewer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider">Quick Scan</span>
            <button onClick={() => setOverlay(!overlay)} disabled={!scanResult}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all disabled:opacity-30 ${overlay ? 'bg-emerald-500 dark:emerald-400 text-white' : 'bg-slate-200 text-slate-500 dark:text-teal-200 dark:text-teal-200'}`}
            ><Layers size={9} /> Overlay {overlay ? 'ON' : 'OFF'}</button>
          </div>
          <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-white shadow-lg">
            {scanImageUrl ? <img src={scanImageUrl} alt="Scan" className="w-full h-full object-cover opacity-90" /> : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 dark:text-teal-100 dark:text-teal-100 gap-1"><Microscope size={22} /><span className="text-xs">Upload a scan below</span></div>
            )}
            {overlay && overlayRegions.length > 0 && (
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {overlayRegions.map((r, i) => (
                  <g key={i}>
                    <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.8)" strokeWidth="0.6" className="animate-pulse" />
                    <text x={r.cx} y={r.cy + r.ry + 5} textAnchor="middle" fontSize="4" fill="rgba(239,68,68,0.9)" fontWeight="bold">{r.label}</text>
                  </g>
                ))}
              </svg>
            )}
            {analyzing && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={24} /></div>}
          </div>
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full mt-2 py-2 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 hover:bg-slate-200 hover:border-emerald-500 dark:emerald-400 hover:text-emerald-600 dark:emerald-500 transition-all"
          ><Upload size={13} /> Upload X-ray / CT Scan</button>
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleScan(e.target.files[0])} />
          {scanResult && scanResult.predicted_class !== 'Error' && (
            <div className={`mt-2 p-3 rounded-xl border text-xs ${scanResult.predicted_class === 'Normal' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex justify-between mb-1"><span className="font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200">{scanResult.predicted_class}</span><span className={`font-bold ${scanResult.predicted_class === 'Normal' ? 'text-emerald-600' : 'text-red-600'}`}>{scanResult.severity} · {scanResult.confidence}</span></div>
              <p className="text-slate-600 dark:text-teal-100 dark:text-teal-100 text-[11px]">{scanResult.recommendation}</p>
            </div>
          )}
        </div>

        {/* Prescription Form */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5"><Pill size={11} className="text-emerald-500 dark:emerald-400" /> e-Prescription</h4>
          <div className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-4 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm space-y-2.5">
            {!patient ? <p className="text-xs text-slate-400 dark:text-teal-300 dark:text-teal-300 text-center py-2">Select a patient first</p> : (
              <>
                <input type="text" placeholder="Medication name..." value={prescForm.name}
                  onChange={e => { setPrescForm(f => ({ ...f, name: e.target.value })); setInteractionWarning(e.target.value && patient?.activeMedications?.length ? checkInteractions(e.target.value, patient.activeMedications) : null); }}
                  className="w-full p-2.5 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Dosage" value={prescForm.dosage} onChange={e => setPrescForm(f => ({ ...f, dosage: e.target.value }))} className="p-2.5 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20" />
                  <input type="text" placeholder="Frequency" value={prescForm.freq} onChange={e => setPrescForm(f => ({ ...f, freq: e.target.value }))} className="p-2.5 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20" />
                </div>
                <input type="text" placeholder="Duration (e.g. 7 days)" value={prescForm.duration} onChange={e => setPrescForm(f => ({ ...f, duration: e.target.value }))} className="w-full p-2.5 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20" />
                <AnimatePresence>{interactionWarning && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex gap-2">
                    <AlertTriangle className="text-red-600 flex-shrink-0" size={13} />
                    <p className="text-[10px] font-bold text-red-700 leading-tight">{interactionWarning}</p>
                  </motion.div>
                )}</AnimatePresence>
                <button onClick={handleSign} disabled={signing || !prescForm.name}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >{signing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Sign & Generate QR</button>
              </>
            )}
          </div>
        </div>

        <AnimatePresence>{qrPayload && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-4 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200">Pharmacy QR</span><button onClick={() => setQrPayload(null)} className="text-slate-400 dark:text-teal-300 dark:text-teal-300 hover:text-slate-600 dark:text-teal-100 dark:text-teal-100"><X size={13} /></button></div>
            <div className="flex justify-center p-3 bg-white dark:bg-emerald-900 dark:bg-emerald-900 rounded-xl border border-slate-100 dark:border-emerald-800 dark:border-emerald-800"><QRCodeSVG value={qrPayload} size={130} level="M" /></div>
          </motion.div>
        )}</AnimatePresence>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 2: Patient Registry
// ---------------------------------------------------------------------------
const PatientRegistryTab = ({ patients, onSelectPatient }: { patients: any[]; onSelectPatient: (id: string) => void }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'age'>('priority');
  const [filterPriority, setFilterPriority] = useState<'all' | 'red' | 'yellow' | 'green'>('all');

  const priorityOrder = { red: 0, yellow: 1, green: 2 };

  const filtered = patients
    .filter(p => filterPriority === 'all' || p.priority === filterPriority)
    .filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'priority') return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'age') return (a.age || 0) - (b.age || 0);
      return 0;
    });

  const stats = { total: patients.length, critical: patients.filter(p => p.priority === 'red').length, monitor: patients.filter(p => p.priority === 'yellow').length, stable: patients.filter(p => p.priority === 'green').length };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">Patient Registry</h2><p className="text-sm text-slate-400 dark:text-teal-300 dark:text-teal-300 mt-0.5">All patients assigned to your care</p></div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', val: stats.total, color: 'sky', icon: Users },
          { label: 'Critical', val: stats.critical, color: 'red', icon: AlertCircle },
          { label: 'Monitor', val: stats.monitor, color: 'amber', icon: Clock },
          { label: 'Stable', val: stats.stable, color: 'emerald', icon: CheckCircle },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} className={`bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase">{label}</span>
              <div className={`p-2 bg-${color}-50 rounded-xl`}><Icon size={16} className={`text-${color}-500`} /></div>
            </div>
            <div className={`text-3xl font-bold text-${color}-600`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-teal-300 dark:text-teal-300" size={14} />
          <input type="text" placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-sm text-slate-900 dark:text-white dark:text-white focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20 outline-none" />
        </div>
        <div className="flex gap-2">
          {(['all', 'red', 'yellow', 'green'] as const).map(f => (
            <button key={f} onClick={() => setFilterPriority(f)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterPriority === f ? 'bg-slate-900 text-white' : 'bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 text-slate-500 dark:text-teal-200 dark:text-teal-200 hover:border-slate-400'}`}
            >{f === 'all' ? 'All' : f === 'red' ? '🔴 Critical' : f === 'yellow' ? '🟡 Monitor' : '🟢 Stable'}</button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2.5 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-sm font-medium text-slate-600 dark:text-teal-100 dark:text-teal-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20"
        >
          <option value="priority">Sort: Priority</option>
          <option value="name">Sort: Name</option>
          <option value="age">Sort: Age</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 bg-stone-50 dark:bg-teal-950 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800 text-[10px] font-bold text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase tracking-wider">
          <div className="col-span-1">Status</div><div className="col-span-3">Patient</div><div className="col-span-1">Age</div>
          <div className="col-span-1">Blood</div><div className="col-span-2">Heart Rate</div><div className="col-span-2">SpO₂</div>
          <div className="col-span-1">Meds</div><div className="col-span-1">Action</div>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && <div className="py-12 text-center text-slate-400 dark:text-teal-300 dark:text-teal-300 text-sm">No patients match your filters</div>}
          {filtered.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-12 px-5 py-4 items-center hover:bg-stone-50 dark:bg-teal-950 transition-colors group"
            >
              <div className="col-span-1">
                <div className={`w-2.5 h-2.5 rounded-full ${p.priority === 'red' ? 'bg-red-500 animate-pulse' : p.priority === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              </div>
              <div className="col-span-3">
                <div className="font-bold text-slate-900 dark:text-white dark:text-white text-sm">{p.name}</div>
                <div className="text-[10px] text-slate-400 dark:text-teal-300 dark:text-teal-300">#{p.id.slice(0,8)}</div>
              </div>
              <div className="col-span-1 text-sm text-slate-600 dark:text-teal-100 dark:text-teal-100 font-medium">{p.age}y</div>
              <div className="col-span-1"><span className="px-2 py-0.5 bg-emerald-50 dark:teal-900 text-emerald-700 dark:emerald-300 text-[10px] font-bold rounded-full">{p.bloodType || '—'}</span></div>
              <div className="col-span-2">
                <span className={`text-sm font-bold ${p.vitals.hr > 100 ? 'text-red-600' : 'text-slate-900 dark:text-white dark:text-white'}`}>{p.vitals.hr} <span className="text-[10px] font-normal text-slate-400 dark:text-teal-300 dark:text-teal-300">bpm</span></span>
              </div>
              <div className="col-span-2">
                <span className={`text-sm font-bold ${p.vitals.spo2 < 94 ? 'text-red-600' : 'text-slate-900 dark:text-white dark:text-white'}`}>{p.vitals.spo2}<span className="text-[10px] font-normal text-slate-400 dark:text-teal-300 dark:text-teal-300">%</span></span>
              </div>
              <div className="col-span-1 text-xs text-slate-500 dark:text-teal-200 dark:text-teal-200">{p.activeMedications?.length ?? 0}</div>
              <div className="col-span-1">
                <button onClick={() => onSelectPatient(p.id)}
                  className="px-3 py-1.5 bg-emerald-500 dark:emerald-400 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 dark:emerald-500 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                ><ChevronRight size={11} /> View</button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 3: Imaging Lab
// ---------------------------------------------------------------------------
const ImagingLabTab = ({ patients }: { patients: any[] }) => {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? '');
  const [scanResult, setScanResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [doctorReview, setDoctorReview] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handleScan = async (file: File) => {
    setAnalyzing(true); setScanResult(null); setOverlay(false);
    setScanImageUrl(URL.createObjectURL(file));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>(res => { reader.onloadend = () => res(reader.result as string); reader.readAsDataURL(file); });
      const { data } = await apiClient.post('/api/vision/analyze_xray', { image_base64: base64, patient_id: selectedPatientId });
      setScanResult(data);
      setScanHistory(prev => [{ ...data, patientName: selectedPatient?.name ?? '—', time: new Date().toLocaleTimeString(), imageUrl: URL.createObjectURL(file) }, ...prev].slice(0, 10));

      toast.success(`Analysis complete: ${data.predicted_class}`);
    } catch { toast.error('Analysis failed — check backend connection'); }
    finally { setAnalyzing(false); }
  };

  const overlayRegions = scanResult ? (OVERLAY_REGIONS[scanResult.predicted_class] ?? []) : [];

  const handleSaveToTimeline = async () => {
    if (!scanResult || !selectedPatientId || scanResult.predicted_class === 'Error') return;
    setSavingReview(true);
    try {
      const doctorName = auth.currentUser?.displayName || 'Doctor';
      await addDoc(collection(db, 'medicalEvents', selectedPatientId, 'events'), { 
        date: new Date().toISOString().split('T')[0], 
        title: `Imaging Scan: ${scanResult.predicted_class}`, 
        desc: `Severity: ${scanResult.severity}. ${scanResult.recommendation} ${doctorReview ? `| Doctor's Note: ${doctorReview}` : ''}`, 
        type: 'lab', 
        doctor: doctorName, 
        createdAt: serverTimestamp() 
      });
      toast.success('Saved to patient timeline!');
      setDoctorReview('');
    } catch {
      toast.error('Failed to save to timeline');
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Viewer */}
      <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div><h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">Imaging Lab</h2><p className="text-sm text-slate-400 dark:text-teal-300 dark:text-teal-300">AI-powered radiology analysis</p></div>
          <div className="flex items-center gap-3">
            <select value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20"
            >
              {patients.map(p => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>)}
            </select>
            <button onClick={() => setOverlay(!overlay)} disabled={!scanResult}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${overlay ? 'bg-emerald-500 dark:emerald-400 text-white shadow-lg shadow-emerald-200 dark:teal-700' : 'bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 text-slate-600 dark:text-teal-100 dark:text-teal-100'}`}
            ><Layers size={13} /> AI Overlay {overlay ? 'ON' : 'OFF'}</button>
          </div>
        </div>

        {/* Main scan viewer */}
        <div className="relative bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl" style={{ aspectRatio: '4/3' }}>
          {scanImageUrl ? <img src={scanImageUrl} alt="Medical scan" className="w-full h-full object-contain" /> : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 dark:text-teal-100 dark:text-teal-100 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center"><Microscope size={32} className="text-slate-500 dark:text-teal-200 dark:text-teal-200" /></div>
              <div className="text-center"><p className="text-sm font-semibold text-slate-400 dark:text-teal-300 dark:text-teal-300">No scan loaded</p><p className="text-xs text-slate-600 dark:text-teal-100 dark:text-teal-100">Upload an X-ray, CT, or MRI image</p></div>
            </div>
          )}

          {overlay && overlayRegions.length > 0 && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {overlayRegions.map((r, i) => (
                <g key={i}>
                  <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.9)" strokeWidth="0.5" className="animate-pulse" />
                  <text x={r.cx} y={r.cy - r.ry - 2} textAnchor="middle" fontSize="3.5" fill="rgba(239,68,68,0.9)" fontWeight="bold">{r.label}</text>
                </g>
              ))}
              <text x="2" y="6" fontSize="3" fill="rgba(239,68,68,0.8)">MediBOT AI Detection</text>
            </svg>
          )}

          {analyzing && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-emerald-500 dark:emerald-400" size={40} />
              <p className="text-white text-sm font-semibold">Analyzing scan...</p>
              <p className="text-slate-400 dark:text-teal-300 dark:text-teal-300 text-xs">ResNet101 Medical Imaging Model</p>
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-emerald-900 dark:bg-emerald-900/20 backdrop-blur-md rounded-xl text-white text-xs font-bold hover:bg-white dark:bg-emerald-900 dark:bg-emerald-900/30 transition-all border border-white/20"
            ><Upload size={13} /> Upload Scan</button>
          </div>
          {scanResult && <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-bold text-white">{selectedPatient?.name} — {new Date().toLocaleDateString()}</div>}
        </div>
        <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleScan(e.target.files[0])} />

        {/* Result Card */}
        {scanResult && scanResult.predicted_class !== 'Error' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-2xl border ${scanResult.predicted_class === 'Normal' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} space-y-4`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">{scanResult.predicted_class}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${scanResult.predicted_class === 'Normal' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{scanResult.severity} Severity</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-teal-100 dark:text-teal-100">{scanResult.recommendation}</p>
              </div>
              <div className="text-right"><p className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">{scanResult.confidence}</p><p className="text-xs text-slate-400 dark:text-teal-300 dark:text-teal-300">Confidence</p></div>
            </div>

            {/* Doctor Review and Save Option */}
            <div className="pt-4 border-t border-slate-200 dark:border-emerald-800 dark:border-emerald-800/60 flex flex-col gap-3">
              <textarea placeholder="Add doctor's review or clinical notes (optional)..." value={doctorReview} onChange={e => setDoctorReview(e.target.value)}
                className="w-full p-3 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-sm text-slate-900 dark:text-white dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20 resize-none h-16"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500 dark:text-teal-200 dark:text-teal-200 font-medium flex items-center gap-2"><User size={13}/> Will be saved to <strong className="text-slate-700 dark:text-slate-200 dark:text-slate-200">{selectedPatient?.name}'s</strong> medical timeline.</p>
                <button onClick={handleSaveToTimeline} disabled={savingReview}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {savingReview ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Save to Timeline
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Right: Scan History */}
      <div className="w-72 border-l border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-stone-50 dark:bg-teal-950 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-white dark:bg-emerald-900 dark:bg-emerald-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white">Session History</h3>
          <p className="text-[10px] text-slate-400 dark:text-teal-300 dark:text-teal-300">Scans analyzed this session</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {scanHistory.length === 0 && <div className="text-center text-slate-400 dark:text-teal-300 dark:text-teal-300 text-xs py-8">No scans yet this session</div>}
          {scanHistory.map((s, i) => (
            <div key={i} className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-3 rounded-xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0">
                  {s.imageUrl && <img src={s.imageUrl} alt="" className="w-full h-full object-cover opacity-80" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white dark:text-white truncate">{s.patientName}</p>
                  <p className="text-[10px] text-slate-400 dark:text-teal-300 dark:text-teal-300">{s.time}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200">{s.predicted_class}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.predicted_class === 'Normal' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{s.severity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 4: Pharmacy Hub
// ---------------------------------------------------------------------------
const PharmacyHubTab = ({ patients }: { patients: any[] }) => {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? '');
  const [prescForm, setPrescForm] = useState({ name: '', dosage: '', freq: '', duration: '', notes: '' });
  const [interactionWarning, setInteractionWarning] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [rxHistory, setRxHistory] = useState<any[]>([]);
  const [loadingRx, setLoadingRx] = useState(false);
  const [showDDIModal, setShowDDIModal] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  useEffect(() => {
    if (!selectedPatientId) { setRxHistory([]); return; }
    setLoadingRx(true);
    const fetchRx = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'prescriptions'), where('patientId', '==', selectedPatientId)));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setRxHistory(docs);
      } catch (e) { console.error(e); }
      finally { setLoadingRx(false); }
    };
    fetchRx();
  }, [selectedPatientId]);

  const triggerSign = () => {
    if (!prescForm.name || !selectedPatient) { toast.error('Fill in medication name'); return; }
    if (interactionWarning) {
      setShowDDIModal(true);
    } else {
      executeSign();
    }
  };

  const executeSign = async () => {
    setSigning(true);
    setShowDDIModal(false);
    try {
      const doctorName = auth.currentUser?.displayName ?? 'Doctor';
      const doctorId = auth.currentUser?.uid ?? 'unknown';
      const timestamp = new Date().toISOString();
      const payload = {
        patientId: selectedPatient.id,
        doctorId: doctorId,
        medications: [{ name: prescForm.name, dosage: prescForm.dosage, frequency: prescForm.freq, duration: prescForm.duration }],
        status: 'active',
        timestamp: timestamp
      };
      
      const qrData = JSON.stringify(payload);
      const finalPayload = { ...payload, qrCodeData: qrData, patientName: selectedPatient.name, prescribedBy: doctorName, notes: prescForm.notes, createdAt: serverTimestamp() };
      
      await addDoc(collection(db, 'prescriptions'), finalPayload);
      
      setQrPayload(qrData);
      setRxHistory(prev => [finalPayload, ...prev]);
      toast.success('Prescription signed & saved!');
      setPrescForm({ name: '', dosage: '', freq: '', duration: '', notes: '' });
      setInteractionWarning(null);
    } catch { toast.error('Failed to save prescription'); }
    finally { setSigning(false); }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-stone-50 dark:bg-teal-950">
      {/* Left: Write Prescription */}
      <div className="w-full lg:w-[450px] border-r border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-white dark:bg-emerald-900 dark:bg-emerald-900 flex flex-col h-full flex-shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6 border-b border-slate-100 dark:border-emerald-800 dark:border-emerald-800 bg-white dark:bg-emerald-900 dark:bg-emerald-900">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white dark:text-white tracking-tight flex items-center gap-2"><Pill className="text-emerald-500 dark:emerald-400" size={24}/> E-Prescribe</h2>
          <p className="text-sm text-slate-500 dark:text-teal-200 dark:text-teal-200 mt-1 font-medium">Issue digital medications securely</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50 dark:bg-teal-950/50">
          {/* Patient Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider flex items-center gap-2"><User size={14}/> Select Patient</label>
            <select value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}
              className="w-full p-4 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 dark:text-slate-100 focus:outline-none focus:border-emerald-500 dark:emerald-400 focus:ring-4 focus:ring-emerald-500 dark:emerald-400/10 transition-all shadow-sm"
            >
              {patients.map(p => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>)}
            </select>
          </div>

          {selectedPatient && selectedPatient.activeMedications?.length > 0 && (
            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl shadow-inner">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={14}/> Active Medications</p>
              <div className="flex flex-wrap gap-2">
                {selectedPatient.activeMedications.map((m: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-white dark:bg-emerald-900 dark:bg-emerald-900/80 border border-amber-200/80 text-amber-900 text-xs font-bold rounded-xl shadow-sm backdrop-blur-sm">{m}</span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Form */}
          <div className="space-y-5 bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-[2rem] border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider">Medication Name</label>
              <input type="text" placeholder="e.g. Amoxicillin" value={prescForm.name}
                onChange={e => { setPrescForm(f => ({ ...f, name: e.target.value })); setInteractionWarning(e.target.value && selectedPatient?.activeMedications?.length ? checkInteractions(e.target.value, selectedPatient.activeMedications) : null); }}
                className="w-full p-4 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl text-sm text-slate-900 dark:text-white dark:text-white font-bold focus:outline-none focus:border-emerald-500 dark:emerald-400 focus:ring-4 focus:ring-emerald-500 dark:emerald-400/10 transition-all placeholder:font-medium" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider">Dosage</label>
                <input type="text" placeholder="500mg" value={prescForm.dosage} onChange={e => setPrescForm(f => ({ ...f, dosage: e.target.value }))} className="w-full p-4 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl text-sm text-slate-900 dark:text-white dark:text-white font-bold focus:outline-none focus:border-emerald-500 dark:emerald-400 focus:ring-4 focus:ring-emerald-500 dark:emerald-400/10 transition-all placeholder:font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider">Frequency</label>
                <input type="text" placeholder="Twice daily" value={prescForm.freq} onChange={e => setPrescForm(f => ({ ...f, freq: e.target.value }))} className="w-full p-4 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl text-sm text-slate-900 dark:text-white dark:text-white font-bold focus:outline-none focus:border-emerald-500 dark:emerald-400 focus:ring-4 focus:ring-emerald-500 dark:emerald-400/10 transition-all placeholder:font-medium" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider">Duration</label>
              <input type="text" placeholder="7 days" value={prescForm.duration} onChange={e => setPrescForm(f => ({ ...f, duration: e.target.value }))} className="w-full p-4 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl text-sm text-slate-900 dark:text-white dark:text-white font-bold focus:outline-none focus:border-emerald-500 dark:emerald-400 focus:ring-4 focus:ring-emerald-500 dark:emerald-400/10 transition-all placeholder:font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-wider">Clinical Notes</label>
              <textarea placeholder="Take with food..." value={prescForm.notes} onChange={e => setPrescForm(f => ({ ...f, notes: e.target.value }))} className="w-full p-4 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl text-sm text-slate-900 dark:text-white dark:text-white font-medium focus:outline-none focus:border-emerald-500 dark:emerald-400 focus:ring-4 focus:ring-emerald-500 dark:emerald-400/10 transition-all resize-none h-24" />
            </div>
          </div>

          <AnimatePresence>{interactionWarning && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex gap-3 shadow-sm">
              <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm font-bold text-red-700 leading-relaxed">{interactionWarning}</p>
            </motion.div>
          )}</AnimatePresence>

          <button onClick={triggerSign} disabled={signing || !prescForm.name}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 dark:emerald-400 to-indigo-600 text-white rounded-2xl text-sm font-black tracking-widest hover:from-emerald-500 dark:emerald-400 hover:to-indigo-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-emerald-500 dark:emerald-400/20 active:scale-[0.98]"
          >
            {signing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />} 
            AUTHORIZE & GENERATE
          </button>

          <AnimatePresence>{qrPayload && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-[2rem] border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-2xl relative overflow-hidden mt-8">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500 dark:emerald-400" />
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-black text-slate-800 dark:text-slate-100 dark:text-slate-100 uppercase tracking-widest">E-Prescription QR</span>
                <button onClick={() => setQrPayload(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 dark:text-teal-300 dark:text-teal-300 hover:text-slate-700 dark:text-slate-200 dark:text-slate-200 hover:bg-slate-200 transition-colors"><X size={16} /></button>
              </div>
              <div className="flex justify-center p-4 bg-white dark:bg-emerald-900 dark:bg-emerald-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-emerald-800 dark:border-emerald-800 mb-4">
                <QRCodeSVG value={qrPayload} size={160} level="M" />
              </div>
              <p className="text-xs text-slate-500 dark:text-teal-200 dark:text-teal-200 text-center font-semibold px-4">Patient can scan this code at any registered MediBOT pharmacy.</p>
            </motion.div>
          )}</AnimatePresence>
        </div>
      </div>

      {/* Right: Prescription History */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-stone-50 dark:bg-teal-950 relative h-full">
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
          <div className="sticky top-0 z-10 bg-stone-50 dark:bg-teal-950/90 backdrop-blur-xl py-4 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800/50 mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white dark:text-white tracking-tight">Rx History</h2>
              <p className="text-sm text-slate-500 dark:text-teal-200 dark:text-teal-200 font-medium mt-1">{selectedPatient?.name ? `Records for ${selectedPatient.name}` : 'Select a patient'}</p>
            </div>
            <div className="px-4 py-2 bg-white dark:bg-emerald-900 dark:bg-emerald-900 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
              <span className="text-xs font-black text-slate-500 dark:text-teal-200 dark:text-teal-200 uppercase tracking-widest flex items-center gap-2">
                <History size={14} /> Issued: {rxHistory.length}
              </span>
            </div>
          </div>

          {loadingRx ? (
            <div className="flex justify-center py-32"><Loader2 size={40} className="animate-spin text-emerald-500 dark:emerald-400/50" /></div>
          ) : rxHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400 dark:text-teal-300 dark:text-teal-300">
              <div className="w-24 h-24 rounded-full bg-white dark:bg-emerald-900 dark:bg-emerald-900 border-2 border-dashed border-slate-200 dark:border-emerald-800 dark:border-emerald-800 flex items-center justify-center shadow-sm">
                <FileText size={40} className="text-slate-300" />
              </div>
              <p className="text-slate-500 dark:text-teal-200 dark:text-teal-200 font-bold text-lg">No prescription records found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rxHistory.map((rx, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                  className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-[2rem] border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 dark:emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:teal-900 text-emerald-600 dark:emerald-500 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:teal-800 shadow-inner">
                        <Pill size={28} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h4 className="text-lg font-black text-slate-900 dark:text-white dark:text-white">{rx.medications?.[0]?.name || rx.medication}</h4>
                          <span className="px-3 py-1 bg-slate-100 text-slate-700 dark:text-slate-200 dark:text-slate-200 text-xs font-black rounded-xl">{rx.medications?.[0]?.dosage || rx.dosage}</span>
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-xl border border-emerald-200/50 uppercase tracking-widest">{rx.status || 'Active'}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-teal-200 dark:text-teal-200">{rx.medications?.[0]?.frequency || rx.frequency} <span className="mx-2 text-slate-300">•</span> {rx.medications?.[0]?.duration || rx.duration}</p>
                      </div>
                    </div>
                    <div className="text-left md:text-right md:min-w-[120px]">
                      <p className="text-[10px] font-black text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase tracking-widest mb-1">Date Issued</p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100 dark:text-slate-100">{new Date(rx.timestamp || rx.issuedAt || Date.now()).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</p>
                    </div>
                  </div>
                  {rx.notes && (
                    <div className="mt-5 p-4 bg-stone-50 dark:bg-teal-950 rounded-2xl border border-slate-100 dark:border-emerald-800 dark:border-emerald-800 text-sm text-slate-600 dark:text-teal-100 dark:text-teal-100 font-medium flex items-start gap-3">
                      <FileText size={16} className="text-slate-400 dark:text-teal-300 dark:text-teal-300 flex-shrink-0 mt-0.5" />
                      <p>{rx.notes}</p>
                    </div>
                  )}
                  <div className="mt-5 flex items-center justify-between pt-5 border-t border-slate-100 dark:border-emerald-800 dark:border-emerald-800">
                    <p className="text-[10px] font-black text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase tracking-widest flex items-center gap-2"><Stethoscope size={14}/> Dr. {rx.prescribedBy}</p>
                    <p className="text-[10px] font-black text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase tracking-widest flex items-center gap-2"><User size={14}/> {rx.patientName}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDDIModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800">
              <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center mb-6 mx-auto shadow-inner">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white dark:text-white text-center mb-2">Safety Warning</h3>
              <p className="text-sm font-bold text-red-600 text-center mb-6 px-4">Potential dangerous interaction detected with patient's active chart.</p>
              
              <div className="p-5 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-2xl mb-8 shadow-inner">
                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-slate-200 font-bold text-center leading-relaxed">{interactionWarning}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowDDIModal(false)} className="flex-1 py-4 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border-2 border-slate-200 dark:border-emerald-800 dark:border-emerald-800 text-slate-700 dark:text-slate-200 dark:text-slate-200 rounded-2xl text-sm font-black hover:bg-stone-50 dark:bg-teal-950 transition-all active:scale-95">Cancel</button>
                <button onClick={executeSign} className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-sm font-black hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 active:scale-95">Override & Proceed</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 5: AI Insights
// ---------------------------------------------------------------------------
const AIInsightsTab = ({ patients }: { patients: any[] }) => {
  const total = patients.length;
  const critical = patients.filter(p => p.priority === 'red').length;
  const monitor = patients.filter(p => p.priority === 'yellow').length;
  const stable = patients.filter(p => p.priority === 'green').length;

  const avgHr = total > 0 ? Math.round(patients.reduce((s, p) => s + p.vitals.hr, 0) / total) : 0;
  const avgSpo2 = total > 0 ? Math.round(patients.reduce((s, p) => s + p.vitals.spo2, 0) / total) : 0;
  const avgAge = total > 0 ? Math.round(patients.reduce((s, p) => s + (p.age || 0), 0) / total) : 0;

  const priorityData = [
    { name: 'Critical', value: critical, color: '#EF4444' },
    { name: 'Monitor', value: monitor, color: '#F59E0B' },
    { name: 'Stable', value: stable, color: '#10B981' },
  ].filter(d => d.value > 0);

  // Simulated weekly vitals trend for demo
  const weeklyTrend = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
    day, heartRate: avgHr + Math.round((Math.random() - 0.5) * 10), spo2: avgSpo2 + Math.round((Math.random() - 0.5) * 2),
  }));

  // Blood type distribution
  const bloodTypes = patients.reduce((acc: Record<string, number>, p) => { if (p.bloodType) acc[p.bloodType] = (acc[p.bloodType] || 0) + 1; return acc; }, {});
  const bloodTypeData = Object.entries(bloodTypes).map(([type, count]) => ({ type, count }));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div><h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">Insights</h2><p className="text-sm text-slate-400 dark:text-teal-300 dark:text-teal-300 mt-0.5">Aggregate analytics across your patient cohort</p></div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', val: total, sub: 'Assigned to you', color: 'sky', icon: Users },
          { label: 'Avg Heart Rate', val: `${avgHr} bpm`, sub: avgHr > 90 ? 'Above normal range' : 'Within normal range', color: avgHr > 90 ? 'red' : 'emerald', icon: Heart },
          { label: 'Avg SpO₂', val: `${avgSpo2}%`, sub: avgSpo2 < 95 ? 'Monitor closely' : 'Good oxygenation', color: avgSpo2 < 95 ? 'amber' : 'emerald', icon: Activity },
          { label: 'Avg Patient Age', val: `${avgAge}y`, sub: 'Mean cohort age', color: 'indigo', icon: User },
        ].map(({ label, val, sub, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase tracking-wider">{label}</span>
              <Icon size={16} className="text-slate-400 dark:text-teal-300 dark:text-teal-300" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">{val}</p>
            <p className="text-xs text-slate-400 dark:text-teal-300 dark:text-teal-300 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Distribution (Pie) */}
        <div className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-emerald-500 dark:emerald-400" /> Patient Priority</h3>
          {total === 0 ? <div className="text-slate-400 dark:text-teal-300 dark:text-teal-300 text-sm text-center py-8">No patients loaded</div> : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                      {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(val: any, name: any) => [`${val} patients`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {priorityData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs text-slate-600 dark:text-teal-100 dark:text-teal-100 font-medium">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Weekly HR Trend */}
        <div className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm col-span-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-1 flex items-center gap-2"><TrendingUp size={15} className="text-emerald-500 dark:emerald-400" /> Avg Cohort Vitals — This Week</h3>
          <p className="text-xs text-slate-400 dark:text-teal-300 dark:text-teal-300 mb-4">Simulated trend based on current vitals baseline</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Line type="monotone" dataKey="heartRate" stroke="#EF4444" strokeWidth={2} dot={false} name="Heart Rate (bpm)" />
                <Line type="monotone" dataKey="spo2" stroke="#0EA5E9" strokeWidth={2} dot={false} name="SpO₂ (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-red-500" /><span className="text-xs text-slate-500 dark:text-teal-200 dark:text-teal-200">Heart Rate</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 dark:emerald-400" /><span className="text-xs text-slate-500 dark:text-teal-200 dark:text-teal-200">SpO₂</span></div>
          </div>
        </div>
      </div>

      {/* Blood Type + Medication Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-4 flex items-center gap-2"><Zap size={15} className="text-emerald-500 dark:emerald-400" /> Blood Type Distribution</h3>
          {bloodTypeData.length === 0 ? <div className="text-slate-400 dark:text-teal-300 dark:text-teal-300 text-sm text-center py-6">No blood type data available</div> : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bloodTypeData} barCategoryGap="30%">
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(val: any) => [`${val} patients`]} />
                  <Bar dataKey="count" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-6 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-4 flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-500 dark:emerald-400" /> Clinical Alerts Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Tachycardia (HR > 100)', count: patients.filter(p => p.vitals.hr > 100).length, color: 'red' },
              { label: 'Hypoxia (SpO₂ < 94%)', count: patients.filter(p => p.vitals.spo2 < 94).length, color: 'red' },
              { label: 'Elevated HR (> 90)', count: patients.filter(p => p.vitals.hr > 90 && p.vitals.hr <= 100).length, color: 'amber' },
              { label: 'SpO₂ Below Optimal (<97%)', count: patients.filter(p => p.vitals.spo2 < 97 && p.vitals.spo2 >= 94).length, color: 'amber' },
              { label: 'All Vitals Normal', count: patients.filter(p => p.vitals.hr <= 90 && p.vitals.spo2 >= 97).length, color: 'emerald' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-${color}-500`} />
                  <span className="text-xs text-slate-600 dark:text-teal-100 dark:text-teal-100">{label}</span>
                </div>
                <span className={`text-sm font-bold text-${color}-600`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB: Appointments
// ---------------------------------------------------------------------------
const AppointmentsTab = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const doctorUid = auth.currentUser?.uid;
    if (!doctorUid) return;
    const fetchAppts = async () => {
      try {
        const q = query(collection(db, 'appointments'), where('doctorId', '==', doctorUid));
        const snap = await getDocs(q);
        const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        appts.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAppointments(appts);
      } catch (e) { toast.error('Failed to load appointments'); }
      finally { setLoading(false); }
    };
    fetchAppts();
  }, []);

  const handleAction = async (id: string, status: string) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'appointments', id), { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      toast.success(`Appointment ${status}`);
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-white dark:bg-emerald-900 dark:bg-emerald-900">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">Incoming Appointment Requests</h2>
      {loading ? <div className="text-slate-500 dark:text-teal-200 dark:text-teal-200 text-sm">Loading...</div> : appointments.length === 0 ? <div className="text-slate-500 dark:text-teal-200 dark:text-teal-200 text-sm">No requests found.</div> : (
        <div className="space-y-3 max-w-4xl">
          {appointments.map(a => (
            <div key={a.id} className="bg-white dark:bg-emerald-900 dark:bg-emerald-900 p-5 rounded-2xl border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 flex justify-between items-center shadow-sm">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white dark:text-white text-base">{a.patientName}</h4>
                <p className="text-xs text-slate-500 dark:text-teal-200 dark:text-teal-200 mt-1"><span className="font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200">{a.date}</span> at <span className="font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200">{a.time}</span></p>
                <p className="text-sm text-slate-600 dark:text-teal-100 dark:text-teal-100 mt-2 bg-stone-50 dark:bg-teal-950 p-2 rounded-lg inline-block border border-slate-100 dark:border-emerald-800 dark:border-emerald-800">{a.reason}</p>
              </div>
              <div className="flex flex-col gap-2 min-w-[120px]">
                {a.status === 'pending' ? (
                  <>
                    <button onClick={() => handleAction(a.id, 'confirmed')} className="py-2 text-xs font-bold bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200">Confirm</button>
                    <button onClick={() => handleAction(a.id, 'rescheduled')} className="py-2 text-xs font-bold bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200">Reschedule</button>
                  </>
                ) : (
                  <div className={`text-center py-2 text-xs font-bold rounded-lg ${a.status === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:text-teal-200 dark:text-teal-200'}`}>
                    {a.status.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB: AI Assistant
// ---------------------------------------------------------------------------
const AssistantTab = ({ patient, patients, selectPatient }: { patient: any, patients: any[], selectPatient: (id: string) => void }) => {
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [patientIdLoaded, setPatientIdLoaded] = useState('');

  // Clear messages and fetch proactive summary when patient changes
  useEffect(() => {
    if (patient?.id && patient.id !== patientIdLoaded) {
      setMessages([]);
      setPatientIdLoaded(patient.id);
      
      const fetchInitial = async () => {
        setLoading(true);
        try {
          const { data } = await apiClient.post('/api/chat/personalized', {
            query: "Please provide a very brief, 2-sentence proactive clinical overview of this patient based on their vitals, medications, and timeline.",
            patient_context: {
              age: patient.age, gender: patient.gender,
              allergies: patient.allergies, active_medications: patient.activeMedications,
              recent_vitals: patient.vitals, timeline_events: patient.history.slice(0, 10)
            }
          });
          setMessages([{ role: 'ai', text: data.text }]);
        } catch {
          // Silent fail for proactive fetch
        } finally {
          setLoading(false);
        }
      };
      fetchInitial();
    } else if (!patient) {
      setMessages([]);
      setPatientIdLoaded('');
    }
  }, [patient?.id]);

  const handleSend = async () => {
    if (!input.trim() || !patient) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/chat/personalized', {
        query: userMsg,
        patient_context: {
          age: patient.age, gender: patient.gender,
          allergies: patient.allergies, active_medications: patient.activeMedications,
          recent_vitals: patient.vitals, timeline_events: patient.history.slice(0, 10)
        }
      });
      setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error connecting to AI. Make sure backend is running.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 dark:bg-teal-950">
      <div className="p-4 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800 bg-white dark:bg-emerald-900 dark:bg-emerald-900 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white flex items-center gap-2"><MessageSquare size={18} className="text-emerald-500 dark:emerald-400"/> Clinical Assistant</h2>
          <p className="text-sm text-slate-500 dark:text-teal-200 dark:text-teal-200">Discuss specific cases with MediBOT AI</p>
        </div>
        <div>
          <select value={patient?.id || ''} onChange={e => selectPatient(e.target.value)}
            className="p-2 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-lg text-sm bg-stone-50 dark:bg-teal-950 text-slate-700 dark:text-slate-200 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20 font-bold cursor-pointer min-w-[200px]">
            <option value="" disabled>-- Select a Patient --</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && patient && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-teal-300 dark:text-teal-300 gap-3">
            <MessageSquare size={40} className="text-slate-300" />
            <p className="text-sm">Start discussing {patient.name}'s file.</p>
          </div>
        )}
        {!patient && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-teal-300 dark:text-teal-300 gap-3">
            <Users size={40} className="text-slate-300" />
            <p className="text-sm">Please select a patient from the dropdown above to begin.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-emerald-500 dark:emerald-400 text-white rounded-br-sm' : 'bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 text-slate-700 dark:text-slate-200 dark:text-slate-200 rounded-bl-sm shadow-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="text-slate-400 dark:text-teal-300 dark:text-teal-300 text-sm italic bg-white dark:bg-emerald-900 dark:bg-emerald-900 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 px-3 py-2 rounded-2xl rounded-bl-sm">Thinking...</div></div>}
      </div>
      <div className="p-4 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border-t border-slate-200 dark:border-emerald-800 dark:border-emerald-800">
        <div className="flex items-center gap-2">
          <input disabled={!patient} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={patient ? "Ask about current patient's chart..." : "Select a patient to start..."}
            className="flex-1 p-3 bg-stone-50 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 rounded-xl text-slate-900 dark:text-white dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:emerald-400/20 disabled:opacity-50" />
          <button disabled={!patient || loading} onClick={handleSend} className="p-3 bg-emerald-500 dark:emerald-400 text-white rounded-xl hover:bg-emerald-600 dark:emerald-500 disabled:opacity-50 font-bold text-sm px-5 transition-colors">Send</button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export default function DoctorDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<DoctorTab>('command');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { patients, activePatientId, setPatients, selectPatient, updatePatientHistory, activePatient } = useDoctorStore();
  const [loading, setLoading] = useState(true);
  const [sessionPrescriptions, setSessionPrescriptions] = useState<any[]>([]);
  const [realDoctorName, setRealDoctorName] = useState(auth.currentUser?.displayName || '');

  useEffect(() => {
    const doctorUid = auth.currentUser?.uid;
    if (!doctorUid) { setLoading(false); return; }

    const fetchDocName = async () => {
      if (!auth.currentUser?.displayName) {
        try {
          const docSnap = await getDoc(doc(db, 'users', doctorUid));
          if (docSnap.exists() && docSnap.data().name) {
            setRealDoctorName(docSnap.data().name);
          } else {
            setRealDoctorName('Doctor');
          }
        } catch {}
      } else {
        setRealDoctorName(auth.currentUser.displayName);
      }
    };
    fetchDocName();
    const fetchPatients = async () => {
      try {
        const q = query(collection(db, 'patients'), where('doctorUid', '==', doctorUid));
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => deriveDisplayFields(d.id, d.data() as any));
        setPatients(loaded);
        await Promise.all(loaded.map(async p => {
          try {
            const evQ = query(collection(db, 'medicalEvents', p.id, 'events'), orderBy('date', 'desc'), limit(10));
            const evSnap = await getDocs(evQ);
            updatePatientHistory(p.id, evSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]);
          } catch { }
        }));
      } catch { toast.error('Failed to load patients'); }
      finally { setLoading(false); }
    };
    fetchPatients();
  }, []);

  const patient = activePatient();
  const initials = realDoctorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hasAlert = patient ? (patient.vitals.hr > 100 || patient.vitals.spo2 < 94) : patients.some(p => p.priority === 'red');

  const handleSelectFromRegistry = (id: string) => {
    selectPatient(id);
    setActiveTab('command');
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white dark:bg-emerald-900 dark:bg-emerald-900 border-b border-slate-200 dark:border-emerald-800 dark:border-emerald-800 px-6 flex items-center justify-between z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-400 dark:text-teal-300 dark:text-teal-300 hover:bg-stone-50 dark:hover:bg-teal-950 rounded-lg">
              <Menu size={20} />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-white dark:text-white hidden sm:block">
              {activeTab === 'command' ? 'Clinical Command Center' : activeTab === 'registry' ? 'Patient Registry' : activeTab === 'imaging' ? 'Imaging Lab' : activeTab === 'pharmacy' ? 'Pharmacy Hub' : 'AI Insights'}
            </h1>
            {hasAlert ? (
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-50 rounded-full border border-red-200"
              >
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">VITALS ALERT</span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">All Normal</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => useThemeStore.getState().toggleTheme()} className="p-2 rounded-full bg-stone-100 dark:bg-teal-950 border border-slate-200 dark:border-emerald-800 dark:border-emerald-800 text-slate-600 dark:text-teal-100 dark:text-teal-300 hover:bg-stone-200 dark:hover:bg-teal-800 transition-colors">
              {useThemeStore.getState().isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-3 cursor-pointer hover:bg-stone-50 dark:hover:bg-teal-950 p-1.5 rounded-2xl transition-colors border border-transparent hover:border-slate-200 dark:border-emerald-800 dark:hover:border-teal-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-white dark:text-white">{realDoctorName || 'Loading...'}</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-teal-300 dark:text-teal-300 uppercase">Attending Physician</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 dark:from-emerald-400 to-emerald-600 dark:to-emerald-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-emerald-500/30 border-2 border-white ring-2 ring-slate-100 dark:border-teal-900 dark:ring-teal-950">
                {initials || <User size={16} />}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><div className="text-center"><Loader2 className="animate-spin text-emerald-500 dark:emerald-400 mx-auto mb-3" size={32} /><p className="text-slate-500 dark:text-teal-200 dark:text-teal-200 text-sm">Loading patient data...</p></div></div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 flex overflow-hidden">
                {activeTab === 'command' && (
                  patients.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-teal-300 dark:text-teal-300">
                      <User size={48} className="text-slate-200" />
                      <p className="text-lg font-semibold">No patients assigned yet</p>
                      <p className="text-sm text-center max-w-xs">Patients who select you as their doctor from the Patient Portal will appear here.</p>
                    </div>
                  ) : (
                    <>
                      <PatientList patients={patients} activeId={activePatientId ?? ''} onSelect={selectPatient} />
                      {patient ? (
                        <ActivePatientProfile patient={patient} />
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-teal-300 dark:text-teal-300 text-sm">Select a patient from the queue</div>
                      )}
                    </>
                  )
                )}
                {activeTab === 'registry' && <PatientRegistryTab patients={patients} onSelectPatient={handleSelectFromRegistry} />}
                {activeTab === 'imaging' && <ImagingLabTab patients={patients} />}
                {activeTab === 'pharmacy' && <PharmacyHubTab patients={patients} />}
                {activeTab === 'insights' && <AIInsightsTab patients={patients} />}
                {activeTab === 'assistant' && <AssistantTab patient={patient} patients={patients} selectPatient={selectPatient} />}
                {activeTab === 'appointments' && <AppointmentsTab />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
