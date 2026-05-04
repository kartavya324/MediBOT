"""
Main script to expand the MediBOT project report.
Reads the existing .docx, inserts expanded content within existing sections,
and writes the enhanced report.
"""
import copy
import re
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

from expand_report_part1 import *
from expand_report_part2 import *

INPUT_PATH = r"Report\PROJECT REPORT FINAL VERSION v2.docx"
OUTPUT_PATH = r"Report\PROJECT REPORT FINAL VERSION v2 - EXPANDED.docx"


def get_normal_style(doc):
    """Get the Normal style from the document."""
    return doc.styles['Normal']


def find_paragraph_index(doc, text_fragment, start_from=0):
    """Find the index of the first paragraph containing the given text."""
    for i in range(start_from, len(doc.paragraphs)):
        if text_fragment in doc.paragraphs[i].text:
            return i
    return -1


def find_last_paragraph_before_next_heading(doc, start_idx):
    """Find the last content paragraph before the next section heading or chapter."""
    for i in range(start_idx + 1, len(doc.paragraphs)):
        text = doc.paragraphs[i].text.strip()
        style = doc.paragraphs[i].style.name if doc.paragraphs[i].style else ""
        # Stop at chapter markers or known section headings
        if text.startswith("CHAPTER ") or text.startswith("APPENDIX"):
            return i - 1
        if re.match(r'^\d+\.\d+', text) and style == "Normal":
            # This is a subsection heading like "1.2 Problem Statement"
            return i - 1
    return len(doc.paragraphs) - 1


def clone_paragraph_format(source_para):
    """Extract formatting info from a source paragraph."""
    fmt = {}
    if source_para.runs:
        run = source_para.runs[0]
        fmt['font_name'] = run.font.name
        fmt['font_size'] = run.font.size
        fmt['bold'] = run.font.bold
        fmt['italic'] = run.font.italic
        fmt['color'] = run.font.color.rgb if run.font.color and run.font.color.rgb else None
    fmt['alignment'] = source_para.alignment
    fmt['style_name'] = source_para.style.name if source_para.style else 'Normal'
    # Get paragraph spacing
    pf = source_para.paragraph_format
    fmt['space_before'] = pf.space_before
    fmt['space_after'] = pf.space_after
    fmt['line_spacing'] = pf.line_spacing
    fmt['first_line_indent'] = pf.first_line_indent
    return fmt


def insert_paragraphs_after(doc, after_idx, text_block, ref_format=None):
    """
    Insert paragraphs after a given paragraph index.
    text_block: a multi-paragraph string (split by double newline).
    ref_format: formatting dict from clone_paragraph_format.
    Returns: number of paragraphs inserted.
    """
    paragraphs_text = [p.strip() for p in text_block.strip().split('\n\n') if p.strip()]
    
    # Get the XML parent element
    parent = doc.paragraphs[after_idx]._element.getparent()
    ref_element = doc.paragraphs[after_idx]._element
    
    inserted = 0
    for para_text in paragraphs_text:
        # Create a new paragraph element
        new_p = copy.deepcopy(doc.paragraphs[after_idx]._element)
        # Clear all existing runs
        for r in new_p.findall(qn('w:r')):
            new_p.remove(r)
        
        # Create a new run with the text
        new_r = copy.deepcopy(doc.paragraphs[after_idx]._element.findall(qn('w:r'))[0]) if doc.paragraphs[after_idx]._element.findall(qn('w:r')) else None
        
        if new_r is not None:
            # Clear the text in the cloned run
            for t in new_r.findall(qn('w:t')):
                new_r.remove(t)
            # Add new text
            t_elem = new_r.makeelement(qn('w:t'), {})
            t_elem.text = para_text
            t_elem.set(qn('xml:space'), 'preserve')
            new_r.append(t_elem)
            
            # Make sure it's not bold (body text shouldn't be bold)
            rPr = new_r.find(qn('w:rPr'))
            if rPr is not None:
                bold = rPr.find(qn('w:b'))
                if bold is not None:
                    rPr.remove(bold)
            
            new_p.append(new_r)
        else:
            # Fallback: create run from scratch using OxmlElement
            from docx.oxml import OxmlElement
            new_r = OxmlElement('w:r')
            rPr = OxmlElement('w:rPr')
            if ref_format and ref_format.get('font_name'):
                rFonts = OxmlElement('w:rFonts')
                rFonts.set(qn('w:ascii'), ref_format['font_name'])
                rFonts.set(qn('w:hAnsi'), ref_format['font_name'])
                rPr.append(rFonts)
            if ref_format and ref_format.get('font_size'):
                sz = OxmlElement('w:sz')
                sz.set(qn('w:val'), str(int(ref_format['font_size'].pt * 2)))
                rPr.append(sz)
            new_r.append(rPr)
            t_elem = OxmlElement('w:t')
            t_elem.text = para_text
            t_elem.set(qn('xml:space'), 'preserve')
            new_r.append(t_elem)
            new_p.append(new_r)
        
        # Insert after the reference element
        ref_element.addnext(new_p)
        ref_element = new_p  # Next insertion goes after this one
        inserted += 1
    
    return inserted


def find_content_end(doc, section_text, next_section_texts):
    """Find the last paragraph of a section (before any of the next_section_texts appear)."""
    start = find_paragraph_index(doc, section_text)
    if start == -1:
        return -1
    
    for i in range(start + 1, len(doc.paragraphs)):
        text = doc.paragraphs[i].text.strip()
        for ns in next_section_texts:
            if ns in text:
                # Return the paragraph just before this next section
                # Skip backwards past any empty paragraphs
                j = i - 1
                while j > start and not doc.paragraphs[j].text.strip():
                    j -= 1
                return j
    
    return len(doc.paragraphs) - 1


def main():
    print("Loading document...")
    doc = Document(INPUT_PATH)
    
    total_inserted = 0
    
    # ── CHAPTER 1 ─────────────────────────────────────────────────────
    print("Expanding Chapter 1...")
    
    # 1.1 Introduction to Project
    idx = find_content_end(doc, "1.1 Introduction to Project", ["1.2 Problem Statement"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH1_INTRO_EXTRA)
        total_inserted += n
        print(f"  1.1 Introduction: +{n} paragraphs")
    
    # Re-parse indices since we inserted content
    # 1.2 Problem Statement
    idx = find_content_end(doc, "1.2 Problem Statement", ["1.3 Motivation"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH1_PROBLEM_EXTRA)
        total_inserted += n
        print(f"  1.2 Problem Statement: +{n} paragraphs")
    
    # 1.3 Motivation
    idx = find_content_end(doc, "1.3 Motivation", ["1.4 Sustainable Development Goal"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH1_MOTIVATION_EXTRA)
        total_inserted += n
        print(f"  1.3 Motivation: +{n} paragraphs")
    
    # 1.4 SDG
    idx = find_content_end(doc, "1.4 Sustainable Development Goal", ["CHAPTER 2"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH1_SDG_EXTRA)
        total_inserted += n
        print(f"  1.4 SDG: +{n} paragraphs")
    
    # ── CHAPTER 2 ─────────────────────────────────────────────────────
    print("Expanding Chapter 2...")
    
    # 2.1 Overview
    idx = find_content_end(doc, "2.1  Overview of the Research Area", ["Table 2.1", "2.2 Existing"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH2_OVERVIEW_EXTRA)
        total_inserted += n
        print(f"  2.1 Overview: +{n} paragraphs")
    
    # 2.2 Existing Models - after the last model description
    idx = find_content_end(doc, "6. Offline Health Apps", ["Table 2.2", "2.3 Limitations"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH2_MODELS_EXTRA)
        total_inserted += n
        print(f"  2.2 Existing Models: +{n} paragraphs")
    
    # 2.3 Limitations
    idx = find_content_end(doc, "10. Scalability Concerns", ["2.4 Research Objectives"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH2_LIMITATIONS_EXTRA)
        total_inserted += n
        print(f"  2.3 Limitations: +{n} paragraphs")
    
    # 2.4 Research Objectives
    idx = find_content_end(doc, "To develop a scalable three-tier", ["2.5 Product Backlog"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH2_OBJECTIVES_EXTRA)
        total_inserted += n
        print(f"  2.4 Research Objectives: +{n} paragraphs")
    
    # 2.5 Product Backlog - add description after figure caption
    idx = find_paragraph_index(doc, "Fig 2.5: Product Backlog")
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH2_BACKLOG_EXTRA)
        total_inserted += n
        print(f"  2.5 Product Backlog: +{n} paragraphs")
    
    # 2.6 Plan of Action - add description after figure caption
    idx = find_paragraph_index(doc, "Fig 2.6: Release Plan")
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH2_PLAN_EXTRA)
        total_inserted += n
        print(f"  2.6 Plan of Action: +{n} paragraphs")
    
    # ── CHAPTER 3 ─────────────────────────────────────────────────────
    print("Expanding Chapter 3...")
    
    # 3.1.2 Functional Document - after assumptions
    idx = find_content_end(doc, "Firebase project is configured", ["3.1.3 Architecture Diagram"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH3_SPRINT1_FUNC_EXTRA)
        total_inserted += n
        print(f"  3.1.2 Functional Document: +{n} paragraphs")
    
    # 3.1.3 Architecture Diagram figure description
    idx = find_paragraph_index(doc, "Fig 3.1.3: Architecture Diagram")
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH3_SPRINT1_ARCH_EXTRA)
        total_inserted += n
        print(f"  3.1.3 Architecture Diagram: +{n} paragraphs")
    
    # 3.1.4 Outcome - table description
    idx = find_paragraph_index(doc, "Table 3.1.4: Outcome of Objectives")
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH3_SPRINT1_OUTCOME_EXTRA)
        total_inserted += n
        print(f"  3.1.4 Outcome: +{n} paragraphs")
    
    # 3.1.5 Sprint Retrospective figure description
    idx = find_paragraph_index(doc, "Fig 3.1.5: Sprint Retrospective")
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH3_SPRINT1_RETRO_EXTRA)
        total_inserted += n
        print(f"  3.1.5 Sprint Retrospective: +{n} paragraphs")
    
    # 3.2.2 Functional Document - after model saving
    idx = find_content_end(doc, "Model Saving Functionality", ["5. Outcome and Impact", "3.2.3 Outcome"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH3_SPRINT2_FUNC_EXTRA)
        total_inserted += n
        print(f"  3.2.2 Functional Document: +{n} paragraphs")
    
    # 3.2.3 Outcome of Objectives
    idx = find_content_end(doc, "delta-sync mechanism", ["CHAPTER 4"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH3_SPRINT2_OUTCOME_EXTRA)
        total_inserted += n
        print(f"  3.2.3 Outcome: +{n} paragraphs")
    
    # ── CHAPTER 4 ─────────────────────────────────────────────────────
    print("Expanding Chapter 4...")
    
    # 4.1 Performance Evaluation
    idx = find_content_end(doc, "OCR Accuracy:", ["2. Comparisons with Previous"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH4_PERFORMANCE_EXTRA)
        total_inserted += n
        print(f"  4.1 Performance: +{n} paragraphs")
    
    # 4.1.2 Comparisons
    idx = find_content_end(doc, "key differences", ["3. Testing Results"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH4_COMPARISON_EXTRA)
        total_inserted += n
        print(f"  4.1 Comparisons: +{n} paragraphs")
    
    # 4.1.3 Testing Results
    idx = find_content_end(doc, "simulated connectivity disruptions", ["Fig 4.1"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH4_TESTING_EXTRA)
        total_inserted += n
        print(f"  4.1 Testing: +{n} paragraphs")
    
    # Figure descriptions for Chapter 4
    for fig_key, fig_desc in CH4_FIGURES_EXTRA.items():
        fig_label = fig_key.replace("Fig ", "Fig ")
        idx = find_paragraph_index(doc, fig_label + ":")
        if idx > 0:
            n = insert_paragraphs_after(doc, idx, fig_desc)
            total_inserted += n
            print(f"  {fig_key} description: +{n} paragraphs")
    
    # ── CHAPTER 5 ─────────────────────────────────────────────────────
    print("Expanding Chapter 5...")
    
    # Conclusion
    idx = find_content_end(doc, "clinically deployable support tool", ["Future Enhancement"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH5_CONCLUSION_EXTRA)
        total_inserted += n
        print(f"  5 Conclusion: +{n} paragraphs")
    
    # Future Enhancement
    idx = find_content_end(doc, "Video Consultation", ["Table 5.1", "Execution Methods"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH5_FUTURE_EXTRA)
        total_inserted += n
        print(f"  5 Future Enhancement: +{n} paragraphs")
    
    # Execution Methods
    idx = find_content_end(doc, "Delta-sync mechanism validated", ["Fig 5.1", "REFERENCES"])
    if idx > 0:
        n = insert_paragraphs_after(doc, idx, CH5_EXECUTION_EXTRA)
        total_inserted += n
        print(f"  5 Execution Methods: +{n} paragraphs")
    
    # Figure descriptions for Chapter 5
    for fig_key, fig_desc in CH5_FIGURES_EXTRA.items():
        fig_label = fig_key.replace("Fig ", "Fig ")
        idx = find_paragraph_index(doc, fig_label + ":")
        if idx > 0:
            n = insert_paragraphs_after(doc, idx, fig_desc)
            total_inserted += n
            print(f"  {fig_key} description: +{n} paragraphs")
    
    # ── APPENDIX A (Code Expansion) ──────────────────────────────────
    print("Expanding Appendix A...")
    
    appendix_code_extra = """5. Offline Database Schema – IndexedDB via Dexie.js (Key Excerpt)

The following code defines the local offline database schema using Dexie.js, a wrapper around the browser's IndexedDB API. This module enables offline-first data persistence for patient records, chat history, diagnostic results, and vital signs. Each table includes a synced boolean field that drives the delta-sync mechanism for cloud reconciliation.

import Dexie, { type Table } from 'dexie';
export interface PatientRecord {
  id?: number;
  patientId: string;
  name: string; age: number; gender: string;
  bloodType: string;
  allergies: string[];
  activeMedications: string[];
  recentVitals: { heartRate?: number; spo2?: number; steps?: number; };
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
export const db = new MediBotDB();

6. Document Ingestion Pipeline – FAISS Vector Store Builder (Key Excerpt)

This script handles the ingestion of medical PDF textbooks into the FAISS vector store. The PDF is loaded using PyPDFLoader, split into overlapping chunks using RecursiveCharacterTextSplitter, and embedded using the all-MiniLM-L6-v2 sentence transformer model. The resulting vector embeddings are stored locally for efficient similarity search during inference.

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
DATA_PATH = "data/Medical_book.pdf"
DB_FAISS_PATH = "vectorstores/db_faiss"
def create_vector_db():
    loader = PyPDFLoader(DATA_PATH)
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=600, chunk_overlap=50)
    texts = text_splitter.split_documents(documents)
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'})
    db = FAISS.from_documents(texts, embeddings)
    db.save_local(DB_FAISS_PATH)

7. Zustand Global State Management – Patient Store (Key Excerpt)

The Zustand-based global state store manages patient profile data across all React components, eliminating prop-drilling and ensuring that patient context is consistently available for API request injection.

import { create } from 'zustand';
export interface PatientProfile {
  name: string; age: number; gender: string;
  bloodType: string; allergies: string[];
  activeMedications: string[];
  recentVitals: { heartRate?: number; spo2?: number; };
  doctorUid?: string | null;
}
export const usePatientStore = create((set, get) => ({
  uid: null, profile: null,
  setUid: (uid) => set({ uid }),
  setProfile: (profile) => set({ profile }),
  updateProfile: (partial) => {
    const current = get().profile;
    if (current) set({ profile: { ...current, ...partial }});
  },
  clearStore: () => set({ uid: null, profile: null }),
}));

8. Firebase Security Rules – Role-Based Access Control (Key Excerpt)

The Firestore security rules implement granular access control that ensures patients can only access their own data while allowing linked doctors read access to their patients' records. The rules use Firebase Authentication tokens for identity verification and Firestore document references for establishing doctor-patient relationships. This ensures HIPAA-compliant data isolation between patients while enabling the necessary data sharing for clinical workflows.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users: read/write own document only
    match /users/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid;
    }
    // Patients: own full access; linked doctor gets read
    match /patients/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid;
      allow read: if request.auth != null
        && resource.data.doctorUid == request.auth.uid;
      // Subcollections inherit parent access rules
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null
          && request.auth.uid == uid;
        allow read: if request.auth != null
          && get(/databases/$(database)/documents/patients/$(uid))
             .data.doctorUid == request.auth.uid;
      }
    }
    // Diagnostics subcollection
    match /diagnostics/{uid}/results/{resultId} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid;
    }
    // Medical events - doctor can also write
    match /medicalEvents/{uid}/events/{eventId} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid;
      allow read, write: if request.auth != null
        && get(/databases/$(database)/documents/patients/$(uid))
           .data.doctorUid == request.auth.uid;
    }
  }
}

9. OCR Report Extraction Endpoint – FastAPI (Key Excerpt)

This endpoint receives a base64-encoded image of a paper medical report, runs OCR text extraction using EasyOCR, and then uses the language model with a zero-shot extraction prompt to convert the raw text into structured JSON containing allergies, medications, and vital signs. The structured data can then be committed to the patient profile for downstream personalization in subsequent chat interactions.

@app.post("/api/vision/extract_report")
@limiter.limit("10/minute")
async def extract_report(request: Request,
                         request_body: VisionRequest):
    if reader is None:
        raise HTTPException(status_code=503,
            detail="OCR engine is offline.")
    # Decode the base64 image
    image_data = request_body.image_base64
    if "," in image_data:
        image_data = image_data.split(",")[1]
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    # Run EasyOCR text extraction
    result = reader.readtext(np.array(image))
    extracted_text = " ".join([r[1] for r in result])
    if not extracted_text.strip():
        return {"role": "ai",
                "text": "No readable text detected.",
                "type": "text"}
    # Zero-shot clinical entity extraction via LLM
    prompt = f\"\"\"You are a medical data extraction specialist.
    Extracted raw text: '{extracted_text}'
    Task: Extract Allergies, Medications, Vitals as JSON.\"\"\"
    response = gemini_model.generate_content(prompt)
    structured_data = json.loads(response.text)
    return {
        "raw_text": extracted_text[:1000],
        "structured_data": structured_data,
        "text": "Report analyzed successfully."
    }

10. API Client Configuration – Axios with Environment Variables (Key Excerpt)

The centralized API client ensures all frontend HTTP requests target the correct backend URL, with a configurable timeout to accommodate the variable inference latency of the language model. Environment variables allow seamless switching between development and production backend URLs without code changes.

import axios from 'axios';
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    || 'http://localhost:8000',
  timeout: 120_000, // 2 minutes for LLM inference
  headers: { 'Content-Type': 'application/json' },
});
export default apiClient;"""

    # Insert appendix code after the last existing code snippet
    idx = find_content_end(doc, "4. Frontend", ["APPENDIX B"])
    if idx > 0:
        # Find actual end of code section 4
        end_idx = find_content_end(doc, "getPatientContext", ["APPENDIX B"])
        if end_idx > 0:
            idx = end_idx
        n = insert_paragraphs_after(doc, idx, appendix_code_extra)
        total_inserted += n
        print(f"  Appendix A Code: +{n} paragraphs")
    
    # ── Save ──────────────────────────────────────────────────────────
    print(f"\nTotal paragraphs inserted: {total_inserted}")
    print(f"Saving to {OUTPUT_PATH}...")
    doc.save(OUTPUT_PATH)
    print("Done! Report saved successfully.")
    
    # Count approximate pages (rough estimate: ~3 paragraphs per page for body text)
    total_paras = len(doc.paragraphs)
    print(f"Total paragraphs in document: {total_paras}")


if __name__ == "__main__":
    main()
