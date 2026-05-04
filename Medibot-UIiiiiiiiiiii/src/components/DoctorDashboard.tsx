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
const Sidebar = ({ activeTab, setActiveTab, onLogout, doctorName, initials, navItems, isOpen, setIsOpen }: {
  activeTab: DoctorTab; 
  setActiveTab: (t: DoctorTab) => void; 
  onLogout: () => void; 
  doctorName: string;
  initials: string;
  navItems: { id: DoctorTab; label: string; icon: any }[];
  isOpen: boolean; 
  setIsOpen: (o: boolean) => void;
}) => {
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-[#0B1412]/80 backdrop-blur-md z-40 lg:hidden" />
        )}
      </AnimatePresence>
      <div className={`fixed lg:relative lg:translate-x-0 w-80 h-full bg-[#0F1F1B] border-r border-white/5 z-50 transition-all duration-500 flex flex-col shadow-2xl lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#22C55E] rounded-xl flex items-center justify-center text-[#0B1412] shadow-xl shadow-[#22C55E]/20"><ShieldCheck size={24} /></div>
            <span className="text-xl font-black text-[#E6F1ED] tracking-tighter uppercase">Medi<span className="text-[#22C55E]">BOT</span></span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-[#6B8077] hover:text-[#E6F1ED] transition-colors"><X size={20}/></button>
        </div>

        <div className="px-6 mb-8">
           <div className="p-5 bg-[#132823] rounded-[2rem] border border-white/5 group hover:border-[#22C55E]/30 transition-all shadow-inner">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-[#22C55E] flex items-center justify-center text-[#0B1412] shadow-lg shadow-[#22C55E]/20 text-sm font-black">{initials}</div>
                 <div className="min-w-0">
                    <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest mb-0.5">Practitioner</p>
                    <p className="text-sm font-black text-[#E6F1ED] truncate uppercase tracking-tight">{doctorName || 'MD Doctor'}</p>
                 </div>
              </div>
           </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black tracking-widest transition-all uppercase relative group ${
                activeTab === item.id 
                  ? 'bg-[#132823] text-[#22C55E] shadow-inner' 
                  : 'text-[#6B8077] hover:bg-[#132823]/50 hover:text-[#9FB3AA]'
              }`}
            >
              {activeTab === item.id && <motion.div layoutId="activeNav" className="absolute left-2 w-1.5 h-6 bg-[#22C55E] rounded-full" />}
              <item.icon size={18} className={activeTab === item.id ? 'text-[#22C55E]' : 'text-[#6B8077] group-hover:text-[#9FB3AA]'} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 space-y-4">
          <button onClick={() => useThemeStore.getState().toggleTheme()} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#132823] text-[#9FB3AA] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:text-[#E6F1ED] transition-all border border-white/5">
             {useThemeStore.getState().isDarkMode ? <><Sun size={16} /> Day Mode</> : <><Moon size={16} /> Night Mode</>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 px-6 py-4 text-[#EF4444] font-black tracking-[0.3em] hover:bg-[#EF4444]/10 rounded-2xl transition-all uppercase text-[10px]">
            <LogOut size={16} /> System Offline
          </button>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// TAB 1: Command Center — Patient List
// ---------------------------------------------------------------------------
const PatientList = ({ patients, activeId, onSelect, isMobileView }: { patients: any[]; activeId: string; onSelect: (id: string) => void; isMobileView?: boolean }) => {
  const [search, setSearch] = useState('');
  const filtered = patients.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className={`${isMobileView ? 'w-full' : 'w-72 hidden lg:flex'} border-r border-white/5 bg-[#0F1F1B] flex flex-col h-full flex-shrink-0 transition-all`}>
      <div className="p-6 border-b border-white/5 bg-[#132823]/50">
        <h3 className="text-[11px] font-black text-[#9FB3AA] uppercase tracking-widest mb-4 flex items-center justify-between">
          <span>Patient Queue</span>
          <span className="bg-[#0B1412] px-2 py-0.5 rounded-md text-[10px] text-[#6B8077]">
            {patients.length} Active
          </span>
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8077]" size={14} />
          <input type="text" placeholder="Filter patients..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#0B1412] border border-white/5 focus:border-[#22C55E]/50 rounded-xl text-sm text-[#E6F1ED] outline-none transition-all placeholder:text-[#6B8077]" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#6B8077] text-xs font-bold uppercase tracking-widest">No patients found</div>
        ) : (
          filtered.map(p => (
            <button key={p.id} onClick={() => onSelect(p.id)}
              className={`w-full text-left p-5 rounded-xl transition-all border-2 ${
                activeId === p.id 
                  ? 'bg-[#132823] border-[#22C55E]/40 shadow-xl' 
                  : 'bg-[#132823]/30 border-transparent hover:bg-[#132823]/60 hover:border-white/5 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.priority === 'red' ? 'bg-[#EF4444] animate-pulse' : p.priority === 'yellow' ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'}`} />
                  <span className="font-bold text-[#E6F1ED] text-sm truncate uppercase tracking-tight">{p.name || 'Unnamed'}</span>
                </div>
                <span className="text-[9px] font-black text-[#6B8077] uppercase tabular-nums tracking-widest flex-shrink-0">#{p.id.slice(0,4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                  p.priority === 'red' ? 'bg-[#EF4444]/10 text-[#EF4444]' : p.priority === 'yellow' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#22C55E]/10 text-[#22C55E]'
                }`}>{p.status}</span>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-[#9FB3AA] uppercase">
                  <Heart size={10} className="text-[#EF4444]" /> {p.vitals.hr}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB 1: Active Patient Profile
// ---------------------------------------------------------------------------
const ActivePatientProfile = ({ patient, onBack }: { patient: any; onBack?: () => void }) => {
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
    <div className="flex-1 flex flex-col bg-[#0B1412] overflow-y-auto min-w-0 transition-all duration-300">
      <div className={`p-8 border-b transition-all duration-300 ${isAlert ? 'border-[#EF4444]/20 bg-[#EF4444]/5' : 'border-white/5'}`}>
        <div className="flex items-center gap-4 mb-8 lg:hidden">
          <button onClick={onBack} className="p-2.5 -ml-2 text-[#9FB3AA] hover:bg-[#132823] rounded-xl transition-all">
            <X size={20} />
          </button>
          <span className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.2em]">Patient Chart</span>
        </div>
        
        {isAlert && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-8 px-5 py-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl"
          >
            <div className="w-8 h-8 rounded-lg bg-[#EF4444]/20 flex items-center justify-center text-[#EF4444]"><AlertTriangle size={18} /></div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-[#EF4444] uppercase tracking-widest">Critical Diagnostic Alert</p>
              <p className="text-sm font-bold text-[#E6F1ED] tracking-tight">{patient.vitals.hr > 100 ? `Tachycardia Detected (HR ${patient.vitals.hr} bpm)` : `Hypoxia Detected (SpO₂ ${patient.vitals.spo2}%)`}</p>
            </div>
            <div className="w-2 h-2 bg-[#EF4444] rounded-full animate-ping" />
          </motion.div>
        )}

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 ${isAlert ? 'bg-[#EF4444]/20 ring-4 ring-[#EF4444]/10' : 'bg-[#132823] ring-4 ring-white/5'}`}>
              <User size={36} className={isAlert ? 'text-[#EF4444]' : 'text-[#22C55E]'} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-3xl font-black text-[#E6F1ED] tracking-tighter uppercase">{patient.name}</h2>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-[#132823] border border-white/5 rounded-md text-[10px] font-black text-[#9FB3AA] uppercase tracking-widest">{patient.gender}, {patient.age}y</span>
                  <span className="px-3 py-1 bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-md text-[10px] font-black text-[#22C55E] uppercase tracking-widest">{patient.bloodType}</span>
                </div>
              </div>
              <p className="text-[#6B8077] text-xs flex items-center gap-2 mt-2 font-black uppercase tracking-widest">
                <ShieldCheck size={14} className="text-[#22C55E]" /> MediBOT ID: <span className="text-[#9FB3AA] tabular-nums tracking-widest">#{patient.id.slice(0,12)}</span>
              </p>
            </div>
          </div>
          <button onClick={handleAiBrief} disabled={summarizing}
            className="px-8 py-4 bg-[#22C55E] text-white text-xs font-black rounded-xl hover:bg-[#1DA851] transition-all disabled:opacity-50 shadow-xl shadow-[#22C55E]/10 active:scale-95 uppercase tracking-widest flex items-center justify-center gap-3"
          >
            {summarizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} GENERATE CLINICAL BRIEF
          </button>
        </div>

        {(patient.allergies?.length > 0 || patient.activeMedications?.length > 0) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {patient.allergies?.map((a: string, i: number) => <span key={i} className="px-3 py-1.5 bg-[#EF4444]/5 border border-[#EF4444]/20 text-[#EF4444] text-[10px] font-black rounded-lg uppercase tracking-widest flex items-center gap-2"><X size={12}/> Allergy: {a}</span>)}
            {patient.activeMedications?.map((m: string, i: number) => <span key={i} className="px-3 py-1.5 bg-[#132823] border border-white/5 text-[#9FB3AA] text-[10px] font-black rounded-lg uppercase tracking-widest flex items-center gap-2"><Pill size={12}/> Medication: {m}</span>)}
          </div>
        )}
      </div>

      <div className="p-8 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[
            { icon: Heart, label: 'Heart Rate', val: `${patient.vitals.hr} bpm`, data: patient.hrData, color: isAlert && patient.vitals.hr > 100 ? '#EF4444' : '#22C55E', alert: isAlert && patient.vitals.hr > 100 },
            { icon: Activity, label: 'Oxygen Saturation', val: `${patient.vitals.spo2}%`, data: patient.spo2Data, color: isAlert && patient.vitals.spo2 < 94 ? '#EF4444' : '#3B82F6', alert: isAlert && patient.vitals.spo2 < 94 },
          ].map(({ icon: Icon, label, val, data, color, alert }) => (
            <div key={label} className={`p-6 rounded-2xl border-2 transition-all duration-500 ${alert ? 'bg-[#EF4444]/5 border-[#EF4444]/20 shadow-2xl' : 'bg-[#0F1F1B] border-white/5 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${alert ? 'bg-[#EF4444]/20' : 'bg-[#132823] border border-white/5'}`}>
                    <Icon size={18} className={alert ? 'text-[#EF4444]' : 'text-[#6B8077]'} />
                  </div>
                  <span className="text-[11px] font-black text-[#9FB3AA] uppercase tracking-widest">{label}</span>
                </div>
                <span className={`text-2xl font-black tabular-nums tracking-tight ${alert ? 'text-[#EF4444]' : 'text-[#E6F1ED]'}`}>{val}</span>
              </div>
              <div className="h-16 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={true} />
                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#0F1F1B] p-8 rounded-2xl border border-white/5 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#22C55E]/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          <h4 className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.2em] mb-8 flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 bg-[#22C55E] rounded-xl flex items-center justify-center text-white shadow-xl shadow-[#22C55E]/10"><History size={18} /></div>
            Clinical Timeline Analytics
          </h4>
          
          {patient.history.length === 0 ? (
            <div className="text-center text-[#6B8077] text-xs py-16 font-black uppercase tracking-widest border-2 border-dashed border-white/5 rounded-2xl">No clinical history records</div>
          ) : (
            <div className="relative pl-10 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
              {patient.history.map((ev: any, i: number) => {
                const isSelected = selectedEvent === ev.id;
                return (
                <div key={i} className="relative">
                  <div className={`absolute -left-[32px] top-2 w-6 h-6 rounded-lg border-4 border-[#0F1F1B] shadow-2xl transition-all duration-300 flex items-center justify-center ${isSelected ? 'scale-125 ring-4 ring-[#22C55E]/20' : ''} ${ev.type === 'surgery' ? 'bg-[#EF4444]' : ev.type === 'med' ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'}`}>
                    <Clock size={10} className="text-white" />
                  </div>
                  <div onClick={() => setSelectedEvent(isSelected ? null : ev.id)} 
                    className={`p-6 rounded-xl border transition-all duration-300 cursor-pointer group ${
                      isSelected 
                        ? 'bg-[#132823] border-[#22C55E]/40 shadow-2xl' 
                        : 'bg-[#132823]/30 border-white/5 hover:bg-[#132823]/60'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] tabular-nums group-hover:text-[#9FB3AA] transition-colors">{ev.date}</span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                        ev.type === 'surgery' ? 'bg-[#EF4444]/10 text-[#EF4444]' : ev.type === 'med' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#22C55E]/10 text-[#22C55E]'
                      }`}>{ev.type}</span>
                    </div>
                    <h5 className="font-bold text-[#E6F1ED] text-base tracking-tight uppercase">{ev.title}</h5>
                    {ev.desc && <p className={`text-sm text-[#9FB3AA] mt-3 font-medium leading-relaxed ${isSelected ? '' : 'line-clamp-2'}`}>{ev.desc}</p>}
                    <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between gap-6 flex-wrap">
                        {ev.doctor && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#0B1412] border border-white/5 flex items-center justify-center text-[10px] font-black text-[#6B8077]">MD</div>
                            <p className="text-[11px] font-black text-[#9FB3AA] uppercase tracking-widest">Attending: <span className="text-[#E6F1ED]">{ev.doctor}</span></p>
                          </div>
                        )}
                        {ev.fileUrl && (
                          <button onClick={(e) => { e.stopPropagation(); window.open(ev.fileUrl, '_blank'); }} 
                            className="px-5 py-2.5 bg-[#E6F1ED] text-[#0B1412] text-[10px] font-black rounded-lg hover:bg-[#9FB3AA] transition-all flex items-center gap-2 uppercase tracking-widest"
                          >
                            <FileText size={14} /> View Report
                          </button>
                        )}
                      </motion.div>
                    )}
                    </AnimatePresence>
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


const AssistantTab = ({ patient, patients, selectPatient }: { patient: any; patients: any[]; selectPatient: (id: string) => void }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#0B1412] text-[#E6F1ED]">
      <BrainCircuit size={64} className="text-[#22C55E] mb-6 animate-pulse" />
      <h2 className="text-2xl font-black uppercase tracking-widest">AI Clinical Assistant</h2>
      <p className="text-[#6B8077] font-black uppercase tracking-widest mt-4">Interface Initializing...</p>
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
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 transition-all duration-300">
      <div className="p-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Patient Registry</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage and access comprehensive records for all {patients.length} assigned cases.</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search by name or clinical ID..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 dark:focus:border-emerald-400 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none transition-all shadow-sm" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Patients', val: stats.total, color: 'emerald', icon: Users },
              { label: 'Critical', val: stats.critical, color: 'red', icon: AlertCircle },
              { label: 'Monitor', val: stats.monitor, color: 'amber', icon: Clock },
              { label: 'Stable', val: stats.stable, color: 'sky', icon: CheckCircle },
            ].map(({ label, val, color, icon: Icon }) => (
              <div key={label} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
                  <div className={`p-2.5 bg-${color}-500/10 rounded-xl`}><Icon size={18} className={`text-${color}-500`} /></div>
                </div>
                <div className={`text-3xl font-black text-slate-900 dark:text-white tabular-nums`}>{val}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
             <div className="flex gap-2 flex-wrap">
              {(['all', 'red', 'yellow', 'green'] as const).map(f => (
                <button key={f} onClick={() => setFilterPriority(f)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${filterPriority === f ? 'bg-slate-900 dark:bg-emerald-500 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600'}`}
                >{f === 'all' ? 'ALL CASES' : f === 'red' ? 'CRITICAL' : f === 'yellow' ? 'MONITOR' : 'STABLE'}</button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="priority">Priority</option>
                <option value="name">Patient Name</option>
                <option value="age">Age Range</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Users size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
              <h3 className="text-lg font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">No matching records found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
              {filtered.map(p => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => onSelectPatient(p.id)}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-500" />
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                      <User size={24} />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.priority === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-500/20' : p.priority === 'yellow' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20'}`}>{p.priority} Priority</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">{p.name}</h3>
                  <div className="flex items-center gap-2 mt-1 mb-6">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Clinical ID: <span className="text-slate-600 dark:text-slate-300">#{p.id.slice(0,12)}</span></span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Heart Rate</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5"><Heart size={14} className="text-red-500" /> {p.vitals.hr} <span className="text-[10px] text-slate-400">BPM</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SpO₂ Level</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5"><Activity size={14} className="text-emerald-500" /> {p.vitals.spo2} <span className="text-[10px] text-slate-400">%</span></p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Age: {p.age}y</span>
                    <button className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-emerald-500 rounded-xl transition-colors"><ChevronRight size={18} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
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
    } catch { toast.error('Failed to save to timeline'); }
    finally { setSavingReview(false); }
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950 transition-all duration-300">
      {/* Main Analysis Area */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Imaging Lab</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Next-gen AI diagnostics for clinical radiology analysis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}
              className="px-5 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-black text-slate-700 dark:text-white outline-none focus:border-emerald-500 transition-all cursor-pointer min-w-[200px]"
            >
              {patients.map(p => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>)}
            </select>
            <button onClick={() => setOverlay(!overlay)} disabled={!scanResult}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all disabled:opacity-40 shadow-sm ${overlay ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
            ><Layers size={16} /> AI VISION OVERLAY {overlay ? 'ACTIVE' : 'INACTIVE'}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Scan Viewer */}
          <div className="lg:col-span-8 space-y-6">
            <div className="relative bg-slate-900 rounded-[3rem] overflow-hidden border-4 border-slate-200 dark:border-slate-800 shadow-2xl group aspect-[4/3] w-full">
              {scanImageUrl ? <img src={scanImageUrl} alt="Medical scan" className="w-full h-full object-contain" /> : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 gap-6">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-slate-800 flex items-center justify-center border-2 border-slate-700 shadow-inner"><Microscope size={48} className="text-slate-500" /></div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-black text-slate-400 uppercase tracking-widest">No Active Scan</p>
                    <p className="text-sm font-bold text-slate-600">Upload radiology imagery for AI-assisted clinical review</p>
                  </div>
                </div>
              )}

              {overlay && overlayRegions.length > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {overlayRegions.map((r, i) => (
                    <g key={i}>
                      <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.8)" strokeWidth="0.8" className="animate-pulse" />
                      <rect x={r.cx - (r.label.length * 1.5)} y={r.cy - r.ry - 6} width={r.label.length * 3} height="4" rx="1" fill="rgba(239,68,68,0.9)" />
                      <text x={r.cx} y={r.cy - r.ry - 3} textAnchor="middle" fontSize="2.5" fill="white" fontWeight="black" className="uppercase tracking-tighter">{r.label}</text>
                    </g>
                  ))}
                  <text x="4" y="8" fontSize="2.5" fill="rgba(255,255,255,0.4)" fontWeight="black" className="uppercase tracking-[0.2em]">MediBOT AI Clinical Detection Engine</text>
                </svg>
              )}

              {analyzing && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-emerald-500/20 rounded-full animate-ping absolute inset-0" />
                    <Loader2 className="animate-spin text-emerald-500" size={80} strokeWidth={1} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xl font-black text-white uppercase tracking-widest">Neural Processing</p>
                    <p className="text-emerald-500 text-xs font-black tracking-[0.3em]">RESNET-101 CLINICAL MODEL V2.0</p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-8 right-8">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-3 px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm hover:bg-emerald-600 transition-all shadow-2xl shadow-emerald-500/30 active:scale-95 uppercase tracking-widest"
                ><Upload size={18} /> Load Imagery</button>
              </div>
            </div>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleScan(e.target.files[0])} />
          </div>

          {/* Diagnosis & Review */}
          <div className="lg:col-span-4 space-y-6">
            <AnimatePresence>
            {scanResult && scanResult.predicted_class !== 'Error' ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className={`p-8 rounded-[2.5rem] border-2 transition-all shadow-xl ${scanResult.predicted_class === 'Normal' ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-900/50' : 'bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-900/50'}`}
              >
                <div className="flex items-center justify-between mb-8">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${scanResult.predicted_class === 'Normal' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{scanResult.severity} RISK</span>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{scanResult.confidence}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">AI Confidence</p>
                  </div>
                </div>
                
                <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">{scanResult.predicted_class}</h3>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-8">{scanResult.recommendation}</p>

                <div className="space-y-4 pt-8 border-t border-slate-200/50 dark:border-slate-800">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Clinician Verification Note</label>
                  <textarea placeholder="Document findings or override AI assessment..." value={doctorReview} onChange={e => setDoctorReview(e.target.value)}
                    className="w-full p-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[1.5rem] text-sm text-slate-900 dark:text-white font-medium focus:border-emerald-500 outline-none transition-all resize-none h-32"
                  />
                  <button onClick={handleSaveToTimeline} disabled={savingReview}
                    className="w-full py-4 bg-slate-900 dark:bg-emerald-500 text-white rounded-2xl text-xs font-black tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase"
                  >
                    {savingReview ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Save to Clinical Chart
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center space-y-4 h-full min-h-[400px]">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700"><Sparkles size={32} /></div>
                <div>
                  <p className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Diagnostic Output</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-600 px-6">Analysis results will appear here after image processing.</p>
                </div>
              </div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Historical Activity */}
      <div className="xl:w-80 border-l-2 border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-900 flex flex-col flex-shrink-0 transition-all">
        <div className="p-8 border-b-2 border-slate-50 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><History size={16}/></div>
             Session Logs
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">Live tracking of analyzed cases</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {scanHistory.length === 0 && (
             <div className="text-center py-20 space-y-4 opacity-40">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full mx-auto flex items-center justify-center text-slate-300"><Clock size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No scans logged</p>
             </div>
          )}
          {scanHistory.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 shadow-lg">
                  {s.imageUrl && <img src={s.imageUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{s.patientName}</p>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 tabular-nums">{s.time}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest truncate">{s.predicted_class}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${s.predicted_class === 'Normal' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{s.severity}</span>
              </div>
            </motion.div>
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
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#0B1412]">
      <div className="w-full lg:w-[450px] border-r border-white/5 bg-[#0F1F1B] flex flex-col h-full flex-shrink-0 shadow-2xl z-10">
        <div className="p-8 border-b border-white/5 bg-[#132823]/50">
          <h2 className="text-2xl font-black text-[#E6F1ED] tracking-tighter uppercase flex items-center gap-3"><Pill className="text-[#22C55E]" size={24}/> E-Prescribe Hub</h2>
          <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] mt-2">Authenticated Digital RX Issuance</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest flex items-center gap-2"><User size={14}/> Active Chart</label>
            <select value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}
              className="w-full p-5 bg-[#0B1412] border border-white/5 rounded-2xl text-sm font-black text-[#E6F1ED] outline-none focus:border-[#22C55E]/50 transition-all uppercase tracking-tight"
            >
              {patients.map(p => <option key={p.id} value={p.id} className="bg-[#0F1F1B]">{p.name || 'Unnamed'}</option>)}
            </select>
          </div>

          {selectedPatient && selectedPatient.activeMedications?.length > 0 && (
            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="p-6 bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-2xl">
              <p className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14}/> Concurrent Medications</p>
              <div className="flex flex-wrap gap-2">
                {selectedPatient.activeMedications.map((m: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-[#0B1412] border border-white/5 text-[#9FB3AA] text-[10px] font-black rounded-lg uppercase tracking-widest">{m}</span>
                ))}
              </div>
            </motion.div>
          )}

          <div className="space-y-6 bg-[#132823]/30 p-8 rounded-3xl border border-white/5 shadow-inner">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest ml-1">Medication Specification</label>
              <input type="text" placeholder="e.g. Lisinopril 10mg" value={prescForm.name}
                onChange={e => { setPrescForm(f => ({ ...f, name: e.target.value })); setInteractionWarning(e.target.value && selectedPatient?.activeMedications?.length ? checkInteractions(e.target.value, selectedPatient.activeMedications) : null); }}
                className="w-full p-4 bg-[#0B1412] border border-white/5 focus:border-[#22C55E]/50 rounded-xl text-sm text-[#E6F1ED] font-bold outline-none transition-all placeholder:text-[#6B8077]" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest ml-1">Dosage</label>
                <input type="text" placeholder="500mg" value={prescForm.dosage} onChange={e => setPrescForm(f => ({ ...f, dosage: e.target.value }))} className="w-full p-4 bg-[#0B1412] border border-white/5 focus:border-[#22C55E]/50 rounded-xl text-sm text-[#E6F1ED] font-bold outline-none transition-all placeholder:text-[#6B8077]" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest ml-1">Cycle</label>
                <input type="text" placeholder="q.d. / b.i.d." value={prescForm.freq} onChange={e => setPrescForm(f => ({ ...f, freq: e.target.value }))} className="w-full p-4 bg-[#0B1412] border border-white/5 focus:border-[#22C55E]/50 rounded-xl text-sm text-[#E6F1ED] font-bold outline-none transition-all placeholder:text-[#6B8077]" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest ml-1">Regimen Duration</label>
              <input type="text" placeholder="14 Days" value={prescForm.duration} onChange={e => setPrescForm(f => ({ ...f, duration: e.target.value }))} className="w-full p-4 bg-[#0B1412] border border-white/5 focus:border-[#22C55E]/50 rounded-xl text-sm text-[#E6F1ED] font-bold outline-none transition-all placeholder:text-[#6B8077]" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest ml-1">Clinical Notes</label>
              <textarea placeholder="Instructional directives..." value={prescForm.notes} onChange={e => setPrescForm(f => ({ ...f, notes: e.target.value }))} className="w-full p-4 bg-[#0B1412] border border-white/5 focus:border-[#22C55E]/50 rounded-xl text-sm text-[#E6F1ED] font-medium outline-none transition-all resize-none h-24 placeholder:text-[#6B8077]" />
            </div>
          </div>

          <AnimatePresence>{interactionWarning && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-5 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-2xl flex gap-4">
              <AlertTriangle className="text-[#EF4444] flex-shrink-0 mt-0.5" size={20} />
              <p className="text-[11px] font-black text-[#EF4444] leading-relaxed uppercase tracking-widest">{interactionWarning}</p>
            </motion.div>
          )}</AnimatePresence>

          <button onClick={triggerSign} disabled={signing || !prescForm.name}
            className="w-full py-5 bg-[#22C55E] text-white rounded-2xl text-xs font-black tracking-[0.2em] hover:bg-[#1DA851] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl shadow-[#22C55E]/20 active:scale-[0.98] uppercase"
          >
            {signing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />} 
            AUTHORIZE E-PRESCRIPTION
          </button>

          <AnimatePresence>{qrPayload && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-[#132823] p-8 rounded-3xl border border-[#22C55E]/40 shadow-2xl relative overflow-hidden mt-8">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#22C55E]" />
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest">Encrypted RX Payload</span>
                <button onClick={() => setQrPayload(null)} className="p-2 bg-[#0B1412] border border-white/5 rounded-xl text-[#6B8077] hover:text-[#E6F1ED] transition-colors"><X size={16} /></button>
              </div>
              <div className="flex justify-center p-8 bg-white rounded-2xl shadow-inner mb-6">
                <QRCodeSVG value={qrPayload} size={160} level="H" includeMargin />
              </div>
              <p className="text-[10px] text-[#6B8077] text-center font-black uppercase tracking-widest px-4">Patient can authenticate at any digital pharmacy terminal.</p>
            </motion.div>
          )}</AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 bg-[#0B1412] relative h-full">
        <div className="max-w-4xl mx-auto space-y-10 pb-24">
          <div className="sticky top-0 z-10 bg-[#0B1412]/80 backdrop-blur-xl py-6 border-b border-white/5 mb-10 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-[#E6F1ED] tracking-tighter uppercase">Clinical RX Archive</h2>
              <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] mt-2">{selectedPatient?.name ? `Historical Records for ${selectedPatient.name}` : 'Awaiting chart selection'}</p>
            </div>
            <div className="px-5 py-2.5 bg-[#0F1F1B] rounded-xl border border-white/5 shadow-sm">
              <span className="text-[10px] font-black text-[#9FB3AA] uppercase tracking-widest flex items-center gap-2 tabular-nums">
                <History size={14} className="text-[#22C55E]" /> ISSUED: {rxHistory.length}
              </span>
            </div>
          </div>

          {loadingRx ? (
            <div className="flex justify-center py-40"><Loader2 size={48} className="animate-spin text-[#22C55E]/50" /></div>
          ) : rxHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-30">
              <div className="w-24 h-24 rounded-full bg-[#132823] border-2 border-dashed border-white/10 flex items-center justify-center shadow-inner text-[#6B8077]">
                <FileText size={48} />
              </div>
              <p className="text-[#9FB3AA] font-black text-xs uppercase tracking-[0.3em]">No Digital Records Found</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {rxHistory.map((rx, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-[#0F1F1B] p-8 rounded-3xl border border-white/5 shadow-sm hover:border-[#22C55E]/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-[4px] h-full bg-[#22C55E] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-[#132823] text-[#22C55E] flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner">
                        <Pill size={32} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-4 mb-3">
                          <h4 className="text-xl font-black text-[#E6F1ED] uppercase tracking-tight">{rx.medications?.[0]?.name || rx.medication}</h4>
                          <span className="px-3 py-1 bg-[#132823] text-[#9FB3AA] text-[10px] font-black rounded-md border border-white/5 uppercase tracking-widest">{rx.medications?.[0]?.dosage || rx.dosage}</span>
                          <span className="px-3 py-1 bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-black rounded-md border border-[#22C55E]/20 uppercase tracking-widest">{rx.status || 'Active'}</span>
                        </div>
                        <p className="text-sm font-bold text-[#9FB3AA] uppercase tracking-widest">{rx.medications?.[0]?.frequency || rx.frequency} <span className="mx-3 text-[#6B8077] opacity-30">•</span> {rx.medications?.[0]?.duration || rx.duration}</p>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[9px] font-black text-[#6B8077] uppercase tracking-[0.2em] mb-1">Authorization Date</p>
                      <p className="text-sm font-black text-[#E6F1ED] tracking-widest uppercase tabular-nums">{new Date(rx.timestamp || rx.issuedAt || Date.now()).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</p>
                    </div>
                  </div>
                  {rx.notes && (
                    <div className="mt-8 p-6 bg-[#0B1412] rounded-2xl border border-white/5 text-[13px] text-[#9FB3AA] font-medium leading-relaxed flex items-start gap-4">
                      <FileText size={18} className="text-[#6B8077] flex-shrink-0 mt-0.5" />
                      <p>{rx.notes}</p>
                    </div>
                  )}
                  <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/5">
                    <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] flex items-center gap-2"><Stethoscope size={14} className="text-[#22C55E]"/> MD: {rx.prescribedBy}</p>
                    <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] flex items-center gap-2"><User size={14}/> PATIENT: {rx.patientName}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDDIModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#0B1412]/90 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#0F1F1B] rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#EF4444]/5 rounded-full blur-[60px]" />
              <div className="w-24 h-24 rounded-[2rem] bg-[#EF4444]/10 border-2 border-[#EF4444]/20 flex items-center justify-center mb-8 mx-auto shadow-inner">
                <AlertTriangle className="w-12 h-12 text-[#EF4444]" />
              </div>
              <h3 className="text-3xl font-black text-[#E6F1ED] text-center mb-3 uppercase tracking-tighter">Safety Protocol Warning</h3>
              <p className="text-xs font-black text-[#EF4444] text-center mb-8 px-6 uppercase tracking-widest leading-relaxed">Potentially hazardous pharmacological interaction detected with patient's active regimen.</p>
              
              <div className="p-6 bg-[#0B1412] border border-[#EF4444]/20 rounded-2xl mb-10 shadow-inner">
                <p className="text-sm text-[#E6F1ED] font-bold text-center leading-relaxed italic">{interactionWarning}</p>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowDDIModal(false)} className="flex-1 py-5 bg-[#132823] border border-white/5 text-[#9FB3AA] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-[#E6F1ED] transition-all active:scale-95">Abort Authorization</button>
                <button onClick={executeSign} className="flex-1 py-5 bg-[#EF4444] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#D93030] transition-all shadow-xl shadow-[#EF4444]/20 active:scale-95">Clinical Override</button>
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
      } catch (e) { toast.error('Failed to load clinical schedule'); }
      finally { setLoading(false); }
    };
    fetchAppts();
  }, []);

  const handleAction = async (id: string, status: string) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'appointments', id), { status });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      toast.success(`Request status updated: ${status.toUpperCase()}`);
    } catch { toast.error('State synchronization failed'); }
  };

  return (
    <div className="flex-1 p-10 overflow-y-auto space-y-10 bg-[#0B1412]">
      <div className="flex items-end justify-between border-b border-white/5 pb-8">
        <div>
          <h2 className="text-3xl font-black text-[#E6F1ED] tracking-tighter uppercase">Clinical Appointments</h2>
          <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] mt-2">Authenticated Consultation Queue</p>
        </div>
        <div className="px-5 py-2.5 bg-[#0F1F1B] rounded-xl border border-white/5">
          <span className="text-[10px] font-black text-[#9FB3AA] uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} className="text-[#22C55E]" /> QUEUE: {appointments.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-40"><Loader2 size={48} className="animate-spin text-[#22C55E]/50" /></div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-30">
          <div className="w-24 h-24 rounded-full bg-[#132823] border-2 border-dashed border-white/10 flex items-center justify-center shadow-inner text-[#6B8077]">
             <Calendar size={48} />
          </div>
          <p className="text-[#9FB3AA] font-black text-xs uppercase tracking-[0.3em]">No Pending Encounters</p>
        </div>
      ) : (
        <div className="grid gap-6 max-w-6xl">
          {appointments.map(a => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#0F1F1B] p-8 rounded-3xl border border-white/5 shadow-sm hover:border-[#22C55E]/30 transition-all group relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8"
            >
              <div className="absolute top-0 left-0 w-[4px] h-full bg-[#22C55E] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#132823] flex items-center justify-center text-[#E6F1ED] font-black border border-white/5">
                    {a.patientName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-[#E6F1ED] uppercase tracking-tight">{a.patientName}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> {a.date}</p>
                      <p className="text-[10px] font-black text-[#9FB3AA] uppercase tracking-widest flex items-center gap-1.5"><Clock size={12}/> {a.time}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[#0B1412] rounded-xl border border-white/5 text-[13px] text-[#9FB3AA] font-medium leading-relaxed italic">
                  "{a.reason || 'Clinical evaluation requested.'}"
                </div>
              </div>
              
              <div className="flex flex-row md:flex-col gap-3 min-w-[160px] w-full md:w-auto">
                {a.status === 'pending' ? (
                  <>
                    <button onClick={() => handleAction(a.id, 'confirmed')} 
                      className="flex-1 py-3.5 px-6 text-[10px] font-black bg-[#22C55E] text-white rounded-xl uppercase tracking-widest hover:bg-[#1DA851] transition-all shadow-lg shadow-[#22C55E]/10"
                    >Confirm</button>
                    <button onClick={() => handleAction(a.id, 'rescheduled')} 
                      className="flex-1 py-3.5 px-6 text-[10px] font-black bg-[#132823] text-[#9FB3AA] rounded-xl border border-white/5 uppercase tracking-widest hover:text-[#E6F1ED] hover:bg-[#1C3A33] transition-all"
                    >Reschedule</button>
                  </>
                ) : (
                  <div className={`text-center py-4 px-6 text-[10px] font-black rounded-xl uppercase tracking-[0.2em] border ${a.status === 'confirmed' ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' : 'bg-[#132823] text-[#6B8077] border-white/5'}`}>
                    {a.status}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB: Appointments
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
    { name: 'Stable', value: stable, color: '#22C55E' },
  ].filter(d => d.value > 0);

  const weeklyTrend = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
    day, heartRate: avgHr + Math.round((Math.random() - 0.5) * 10), spo2: avgSpo2 + Math.round((Math.random() - 0.5) * 2),
  }));

  const bloodTypes = patients.reduce((acc: Record<string, number>, p) => { if (p.bloodType) acc[p.bloodType] = (acc[p.bloodType] || 0) + 1; return acc; }, {});
  const bloodTypeData = Object.entries(bloodTypes).map(([type, count]) => ({ type, count }));

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-[#0B1412]">
      <div>
        <h2 className="text-3xl font-black text-[#E6F1ED] tracking-tighter uppercase">Clinical Intelligence Dashboard</h2>
        <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-[0.2em] mt-2">Cohort-Wide Analytics & Risk Profiling</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Cohort', val: total, sub: 'Assigned Patients', icon: Users, color: '#22C55E' },
          { label: 'BPM Baseline', val: `${avgHr} bpm`, sub: avgHr > 90 ? 'Tachycardia Risk' : 'Optimal HR Range', icon: Heart, color: avgHr > 90 ? '#EF4444' : '#22C55E' },
          { label: 'SpO₂ Baseline', val: `${avgSpo2}%`, sub: avgSpo2 < 95 ? 'Hypoxic Risk' : 'Saturated', icon: Activity, color: avgSpo2 < 95 ? '#F59E0B' : '#3B82F6' },
          { label: 'Mean Age', val: `${avgAge}y`, sub: 'Demographic Mean', icon: User, color: '#9FB3AA' },
        ].map(({ label, val, sub, icon: Icon, color }) => (
          <div key={label} className="bg-[#0F1F1B] p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-[40px] -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest">{label}</span>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-3xl font-black text-[#E6F1ED] tracking-tight relative z-10">{val}</p>
            <p className="text-[10px] font-black uppercase tracking-widest mt-2 relative z-10" style={{ color: color + 'CC' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-[#0F1F1B] p-8 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><BarChart3 size={15} className="text-[#22C55E]" /> Risk Stratification</h3>
          {total === 0 ? <div className="text-[#6B8077] text-[10px] font-black uppercase tracking-widest text-center py-16 border-2 border-dashed border-white/5 rounded-xl">No Analytics Data</div> : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={5}>
                      {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#132823', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', fontWeight: '900', color: '#E6F1ED' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-6">
                {priorityData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-[10px] font-black text-[#9FB3AA] uppercase tracking-widest">{d.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-[#0F1F1B] p-8 rounded-2xl border border-white/5 shadow-sm col-span-2">
          <h3 className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.2em] mb-2 flex items-center gap-3"><TrendingUp size={15} className="text-[#22C55E]" /> Cohort Vital Trends</h3>
          <p className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest mb-8">Aggregated 7-Day Vitals Baseline</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend}>
                <XAxis dataKey="day" stroke="#6B8077" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#132823', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', color: '#E6F1ED' }} />
                <Line type="monotone" dataKey="heartRate" stroke="#EF4444" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="spo2" stroke="#3B82F6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#EF4444]" /><span className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest">Mean HR</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3B82F6]" /><span className="text-[10px] font-black text-[#6B8077] uppercase tracking-widest">Mean SpO₂</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#0F1F1B] p-8 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><Zap size={15} className="text-[#22C55E]" /> Hematological Metrics</h3>
          {bloodTypeData.length === 0 ? <div className="text-[#6B8077] text-[10px] font-black text-center py-12 uppercase tracking-widest">No Blood Type Data</div> : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bloodTypeData}>
                  <XAxis dataKey="type" stroke="#6B8077" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#132823', border: 'none', borderRadius: '8px', color: '#E6F1ED' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-[#0F1F1B] p-8 rounded-2xl border border-white/5 shadow-sm">
          <h3 className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><ShieldCheck size={15} className="text-[#22C55E]" /> Critical Alert Summary</h3>
          <div className="space-y-4">
            {[
              { label: 'Tachycardia Cases (HR > 100)', count: patients.filter(p => p.vitals.hr > 100).length, color: '#EF4444' },
              { label: 'Hypoxia Incidents (SpO₂ < 94%)', count: patients.filter(p => p.vitals.spo2 < 94).length, color: '#EF4444' },
              { label: 'Sub-Optimal Vitals Monitoring', count: patients.filter(p => (p.vitals.hr > 90 && p.vitals.hr <= 100) || (p.vitals.spo2 < 97 && p.vitals.spo2 >= 94)).length, color: '#F59E0B' },
              { label: 'Stable Pathological States', count: patients.filter(p => p.vitals.hr <= 90 && p.vitals.spo2 >= 97).length, color: '#22C55E' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between p-4 bg-[#0B1412] rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-black text-[#9FB3AA] uppercase tracking-widest">{label}</span>
                </div>
                <span className="text-sm font-black tabular-nums" style={{ color }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB: AI Assistant
// ---------------------------------------------------------------------------
export default function DoctorDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<DoctorTab>('command');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { patients, activePatientId, setPatients, selectPatient, updatePatientHistory, activePatient } = useDoctorStore();
  const [loading, setLoading] = useState(true);
  const [realDoctorName, setRealDoctorName] = useState(auth.currentUser?.displayName || '');

  useEffect(() => {
    const doctorUid = auth.currentUser?.uid;
    if (!doctorUid) { setLoading(false); return; }

    const fetchDocName = async () => {
      if (!auth.currentUser?.displayName) {
        try {
          const docSnap = await getDoc(doc(db, 'users', doctorUid));
          if (docSnap.exists() && docSnap.data().name) { setRealDoctorName(docSnap.data().name); } 
          else { setRealDoctorName('Doctor'); }
        } catch {}
      } else { setRealDoctorName(auth.currentUser.displayName); }
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
            const evQ = query(collection(db, 'medicalEvents', p.id, 'events'), orderBy('date', 'desc'), limit(15));
            const evSnap = await getDocs(evQ);
            updatePatientHistory(p.id, evSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]);
          } catch {}
        }));
      } catch { toast.error('Registry synchronization failed'); } 
      finally { setLoading(false); }
    };
    fetchPatients();
  }, []);

  const patient = activePatient();
  const initials = realDoctorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hasAlert = patient ? (patient.vitals.hr > 100 || patient.vitals.spo2 < 94) : patients.some(p => p.priority === 'red');

  const navItems: { id: DoctorTab; label: string; icon: any }[] = [
    { id: 'registry', label: 'Patient Registry', icon: Users },
    { id: 'command', label: 'Clinical Command', icon: Activity },
    { id: 'imaging', label: 'Imaging Lab', icon: Microscope },
    { id: 'pharmacy', label: 'Pharmacy Hub', icon: Pill },
    { id: 'insights', label: 'Cohort Insights', icon: BarChart3 },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'assistant', label: 'Personal AI', icon: BrainCircuit },
  ];

  if (loading) return <div className="min-h-screen bg-[#0B1412] flex items-center justify-center flex-col gap-8"><div className="w-24 h-24 bg-[#0F1F1B] rounded-[2rem] border border-white/5 flex items-center justify-center text-[#22C55E] shadow-2xl animate-pulse"><Activity size={48} /></div><p className="text-[11px] font-black text-[#E6F1ED] uppercase tracking-[0.5em] animate-pulse">Initializing Command Interface...</p></div>;

  return (
    <div className="flex h-screen bg-[#0B1412] text-[#E6F1ED] overflow-hidden font-sans selection:bg-[#22C55E]/30">
      <Sidebar 
        activeTab={activeTab} setActiveTab={setActiveTab} 
        onLogout={onLogout} doctorName={realDoctorName} 
        initials={initials} navItems={navItems} 
        isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} 
      />

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 flex items-center justify-between px-8 bg-[#0F1F1B]/80 backdrop-blur-xl border-b border-white/5 z-20 lg:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-[#9FB3AA] hover:text-[#E6F1ED] transition-colors"><Menu size={24} /></button>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-[#22C55E] rounded-lg flex items-center justify-center text-[#0B1412] font-black text-xs">{initials}</div>
             <span className="text-[10px] font-black uppercase tracking-widest text-[#E6F1ED]">{activeTab}</span>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden h-full">
              {activeTab === 'registry' && <PatientList patients={patients} onSelect={(id) => { selectPatient(id); setActiveTab('command'); }} />}
              {activeTab === 'command' && <ActivePatientProfile patient={patient} onBack={() => setActiveTab('registry')} onPrescriptionSaved={() => {}} />}
              {activeTab === 'imaging' && <ImagingLabTab patients={patients} />}
              {activeTab === 'pharmacy' && <PharmacyHubTab patients={patients} />}
              {activeTab === 'insights' && <AIInsightsTab patients={patients} />}
              {activeTab === 'appointments' && <AppointmentsTab />}
              {activeTab === 'assistant' && <AssistantTab patient={patient} patients={patients} selectPatient={selectPatient} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {hasAlert && activeTab !== 'command' && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-10 right-10 z-50">
            <div className="bg-[#EF4444] text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border-2 border-white/10 backdrop-blur-md cursor-pointer hover:scale-105 transition-all group" onClick={() => setActiveTab('command')}>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse"><AlertTriangle size={20} /></div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest">Critical Alert Detected</p>
                <p className="text-[10px] opacity-80 font-black uppercase tracking-tighter">Vital instability in active cohort</p>
              </div>
              <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        )}
      </main>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#132823', color: '#E6F1ED', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' } }} />
    </div>
  );
}



