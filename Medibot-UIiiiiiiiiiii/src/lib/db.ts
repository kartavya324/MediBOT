/**
 * MediBOT Local Database (IndexedDB via Dexie.js)
 * 
 * PURPOSE: Offline-First Data Persistence
 * This module provides a local database for storing patient data,
 * chat history, and AI responses so the app works without internet.
 * 
 * PATENT RELEVANCE: This is the "Offline Guardian" — ensuring clinical
 * intelligence is available even in zero-connectivity environments.
 */

import Dexie, { type Table } from 'dexie';

// ----- Data Interfaces -----

export interface PatientRecord {
  id?: number;
  patientId: string;
  name: string;
  age: number;
  gender: string;
  bloodType: string;
  allergies: string[];
  activeMedications: string[];
  recentVitals: {
    heartRate?: number;
    spo2?: number;
    steps?: number;
    timestamp?: string;
  };
  lastSyncedAt?: string;
}

export interface ChatMessage {
  id?: number;
  patientId: string;
  role: 'user' | 'ai';
  text: string;
  type: 'text' | 'emergency' | 'vision' | 'status';
  timestamp: string;
  synced: boolean;
}

export interface DiagnosticResult {
  id?: number;
  patientId: string;
  imageHash: string;
  predictedClass: string;
  severity: string;
  confidence: string;
  recommendation: string;
  timestamp: string;
  synced: boolean;
}

export interface VitalsSnapshot {
  id?: number;
  patientId: string;
  heartRate: number;
  spo2: number;
  steps: number;
  timestamp: string;
  source: 'smartwatch' | 'manual' | 'imported';
  synced: boolean;
}

// ----- Database Class -----

class MediBotDB extends Dexie {
  patients!: Table<PatientRecord>;
  chatHistory!: Table<ChatMessage>;
  diagnostics!: Table<DiagnosticResult>;
  vitals!: Table<VitalsSnapshot>;

  constructor() {
    super('MediBotOfflineDB');

    this.version(1).stores({
      patients: '++id, patientId, name',
      chatHistory: '++id, patientId, timestamp, synced',
      diagnostics: '++id, patientId, timestamp, synced',
      vitals: '++id, patientId, timestamp, synced'
    });
  }
}

// ----- Singleton Instance -----
export const db = new MediBotDB();

// ----- Helper Functions -----

/**
 * Save a chat message locally for offline access.
 */
export async function saveChatMessage(
  patientId: string,
  role: 'user' | 'ai',
  text: string,
  type: 'text' | 'emergency' | 'vision' | 'status' = 'text'
): Promise<number> {
  return await db.chatHistory.add({
    patientId,
    role,
    text,
    type,
    timestamp: new Date().toISOString(),
    synced: false
  });
}

/**
 * Get all chat messages for a patient, ordered by time.
 */
export async function getChatHistory(patientId: string): Promise<ChatMessage[]> {
  return await db.chatHistory
    .where('patientId')
    .equals(patientId)
    .sortBy('timestamp');
}

/**
 * Save a diagnostic result locally.
 */
export async function saveDiagnosticResult(
  patientId: string,
  result: Omit<DiagnosticResult, 'id' | 'patientId' | 'timestamp' | 'synced'>
): Promise<number> {
  return await db.diagnostics.add({
    ...result,
    patientId,
    timestamp: new Date().toISOString(),
    synced: false
  });
}

/**
 * Save a vitals snapshot locally.
 */
export async function saveVitalsSnapshot(
  patientId: string,
  heartRate: number,
  spo2: number,
  steps: number,
  source: 'smartwatch' | 'manual' | 'imported' = 'manual'
): Promise<number> {
  return await db.vitals.add({
    patientId,
    heartRate,
    spo2,
    steps,
    source,
    timestamp: new Date().toISOString(),
    synced: false
  });
}

/**
 * Get all unsynced records (for delta-sync when connection returns).
 */
export async function getUnsyncedRecords() {
  const [messages, diagnostics, vitals] = await Promise.all([
    db.chatHistory.where('synced').equals(0).toArray(),
    db.diagnostics.where('synced').equals(0).toArray(),
    db.vitals.where('synced').equals(0).toArray()
  ]);

  return { messages, diagnostics, vitals };
}

/**
 * Mark records as synced after successful upload.
 */
export async function markAsSynced(
  table: 'chatHistory' | 'diagnostics' | 'vitals',
  ids: number[]
): Promise<void> {
  if (table === 'chatHistory') {
    await db.chatHistory.where('id').anyOf(ids).modify({ synced: true });
  } else if (table === 'diagnostics') {
    await db.diagnostics.where('id').anyOf(ids).modify({ synced: true });
  } else {
    await db.vitals.where('id').anyOf(ids).modify({ synced: true });
  }
}
