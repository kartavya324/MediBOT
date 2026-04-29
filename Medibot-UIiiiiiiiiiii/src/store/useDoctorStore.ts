import { create } from 'zustand';
import type { PatientProfile } from './usePatientStore';

export interface FirestorePatient extends PatientProfile {
  id: string;
  priority: 'red' | 'yellow' | 'green';
  status: string;
  vitals: { hr: number; spo2: number; temp: number };
  history: { id: string; date: string; title: string; desc: string; type: string }[];
  hrData: { value: number }[];
  spo2Data: { value: number }[];
}

interface DoctorStore {
  patients: FirestorePatient[];
  activePatientId: string | null;
  setPatients: (p: FirestorePatient[]) => void;
  selectPatient: (id: string) => void;
  updatePatientHistory: (patientId: string, history: FirestorePatient['history']) => void;
  activePatient: () => FirestorePatient | null;
}

export const useDoctorStore = create<DoctorStore>((set, get) => ({
  patients: [],
  activePatientId: null,

  setPatients: (patients) => set({
    patients,
    activePatientId: patients.length > 0 ? patients[0].id : null,
  }),

  selectPatient: (id) => set({ activePatientId: id }),

  updatePatientHistory: (patientId, history) => set(state => ({
    patients: state.patients.map(p =>
      p.id === patientId ? { ...p, history } : p
    ),
  })),

  activePatient: () => {
    const { patients, activePatientId } = get();
    return patients.find(p => p.id === activePatientId) ?? null;
  },
}));

export function deriveDisplayFields(uid: string, p: PatientProfile): FirestorePatient {
  const hr = p.recentVitals?.heartRate ?? 72;
  const spo2 = p.recentVitals?.spo2 ?? 98;
  const priority: 'red' | 'yellow' | 'green' =
    hr > 100 || spo2 < 94 ? 'red' : hr > 90 || spo2 < 97 ? 'yellow' : 'green';
  return {
    ...p,
    id: uid,
    priority,
    status: priority === 'red' ? 'High Vitals' : priority === 'yellow' ? 'Monitor' : 'Stable',
    vitals: { hr, spo2, temp: 98.6 },
    history: [],
    hrData: Array.from({ length: 20 }, () => ({ value: hr + Math.random() * 10 - 5 })),
    spo2Data: Array.from({ length: 20 }, () => ({ value: spo2 + Math.random() * 2 - 1 })),
  };
}
