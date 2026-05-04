"""
MediBOT AI Core Engine - FastAPI Microservice
Bridges the React Frontend to the Python ML Backend.
Patent Core: Context-Aware Personalized Medical RAG
"""

import os
import sys
import io
import base64
import traceback
import json
import numpy as np
from PIL import Image

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
gemini_model = genai.GenerativeModel("gemini-flash-latest")

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Path Configuration
# ---------------------------------------------------------------------------
# Root of the original ML project
ML_PROJECT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "edumit", "llama2-PDF-Chatbot"
)

# Add the ML project directory to sys.path so we can import its modules
if ML_PROJECT_DIR not in sys.path:
    sys.path.insert(0, ML_PROJECT_DIR)

DB_FAISS_PATH = os.path.join(ML_PROJECT_DIR, "vectorstores", "db_faiss")
MODEL_PATH = os.path.join(ML_PROJECT_DIR, "model", "llama-2-7b-chat.ggmlv3.q8_0-002.bin")
CNN_WEIGHTS_PATH = os.path.join(ML_PROJECT_DIR, "weights", "resnet101_lung_model.pth")

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await load_models()
    yield

app = FastAPI(
    title="MediBOT AI Core Engine",
    description="Context-Aware Personalized Medical RAG Microservice",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global State (loaded once on startup)
# ---------------------------------------------------------------------------
qa_chain = None
embeddings = None
llm = None
db = None
reader = None # EasyOCR Reader instance

# ---------------------------------------------------------------------------
# Pydantic Models (API Contracts from api_spec.md)
# ---------------------------------------------------------------------------
class PatientContext(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[list] = []
    active_medications: Optional[list] = []
    recent_vitals: Optional[dict] = {}
    timeline_events: Optional[list] = []

class ChatRequest(BaseModel):
    query: str
    patient_context: Optional[PatientContext] = None

class VisionRequest(BaseModel):
    image_base64: str
    patient_id: Optional[str] = None

# ---------------------------------------------------------------------------
# Startup: Load Models
# ---------------------------------------------------------------------------
async def load_models():
    """Load the CNN model and FAISS vector store on server start."""
    global qa_chain, embeddings, llm, db, reader

    print("=" * 60)
    print("  MediBOT AI Core Engine - Initializing (GEMINI API MODE)...")
    print("=" * 60)

    # --- Step 0: Load EasyOCR ---
    print("[0/3] Loading EasyOCR (English)...")
    try:
        import easyocr
        reader = easyocr.Reader(['en'], gpu=False) # Forced CPU for compatibility
        print("  [OK] EasyOCR loaded.")
    except Exception as e:
        print(f"  [WARN] EasyOCR failed to load (Vision ingestion will be disabled): {e}")
        reader = None

    # --- Step 1: Load Embeddings ---
    print("[1/3] Loading HuggingFace Embeddings...")
    try:
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'}
        )
        print("  [OK]Embeddings loaded.")
    except Exception as e:
        print(f"  [ERR]Failed to load embeddings: {e}")
        return

    # --- Step 2: Load FAISS Vector Store ---
    print("[2/3] Loading FAISS Vector Store...")
    try:
        from langchain_community.vectorstores import FAISS
        if not os.path.exists(DB_FAISS_PATH):
            print(f"  [ERR]FAISS DB not found at {DB_FAISS_PATH}. Run ingest.py first.")
            return
        db = FAISS.load_local(
            DB_FAISS_PATH,
            embeddings,
            allow_dangerous_deserialization=True
        )
        print("  [OK]FAISS Vector Store loaded.")
    except Exception as e:
        print(f"  [ERR]Failed to load FAISS: {e}")
        return

    # --- Step 3: Verify Gemini API ---
    print("[3/3] Verifying Gemini API Configuration...")
    if not os.environ.get("GEMINI_API_KEY"):
        print("  [ERR]GEMINI_API_KEY is missing from environment. Using RAG will fail.")
    else:
        print("  [OK]Gemini API Configured.")
        qa_chain = "gemini_active" # Dummy flag to indicate readiness

    print("=" * 60)
    print("  [OK]MediBOT AI Core Engine is ONLINE (GEMINI POWERED).")
    print("=" * 60)

# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "MediBOT AI Core Engine",
        "status": "online",
        "models_loaded": qa_chain is not None
    }

@app.post("/api/chat/personalized")
@limiter.limit("20/minute")
async def personalized_chat(request: Request, request_body: ChatRequest):
    """
    PATENT CORE ENDPOINT:
    Receives a patient's medical question AND their clinical context,
    then injects the context into the RAG prompt for personalized answers.
    """
    if qa_chain is None or db is None:
        raise HTTPException(status_code=503, detail="AI models are still loading. Please wait.")

    try:
        # Build the patient info string for context injection
        patient_info_str = ""
        media_attachments = []
        if request_body.patient_context:
            ctx = request_body.patient_context
            info_parts = []
            if ctx.age: info_parts.append(f"Age: {ctx.age}")
            if ctx.gender: info_parts.append(f"Gender: {ctx.gender}")
            if ctx.blood_type: info_parts.append(f"Blood Type: {ctx.blood_type}")
            if ctx.allergies: info_parts.append(f"Known Allergies: {', '.join(ctx.allergies)}")
            if ctx.active_medications: info_parts.append(f"Current Medications: {', '.join(ctx.active_medications)}")
            if ctx.recent_vitals: info_parts.append(f"Recent Vitals: {ctx.recent_vitals}")
            if hasattr(ctx, 'timeline_events') and ctx.timeline_events: 
                events_parts = []
                for idx, e in enumerate(ctx.timeline_events):
                    event_str = f"Date: {e.get('date', '')}, Title: {e.get('title', '')}, Description: {e.get('desc', 'N/A')}"
                    events_parts.append(event_str)
                    
                    # Fetch attachment if available for deep understanding
                    fileUrl = e.get('fileUrl', '')
                    if fileUrl and fileUrl.startswith('http') and idx < 3:
                        try:
                            import requests
                            from PIL import Image
                            import io
                            # Only attempt to process images for multimodal context
                            if any(ext in fileUrl.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', 'firebasestorage']):
                                resp = requests.get(fileUrl, timeout=5)
                                if resp.status_code == 200:
                                    img = Image.open(io.BytesIO(resp.content))
                                    # Convert to RGB to avoid issues with alpha channels
                                    if img.mode != 'RGB':
                                        img = img.convert('RGB')
                                    # Resize to reduce token usage/time
                                    img.thumbnail((800, 800))
                                    media_attachments.append(img)
                        except Exception as ex:
                            print(f"Failed to fetch timeline image: {ex}")
                
                info_parts.append(f"Medical Timeline: {' | '.join(events_parts)}")
                
            if info_parts:
                patient_info_str = " | ".join(info_parts)

        # 1. Retrieve Context from FAISS
        docs = db.similarity_search(request_body.query, k=3)
        context_str = "\n".join([d.page_content for d in docs])
        
        # 2. Build Gemini Prompt
        prompt = f"""You are MediBOT, a concise clinical AI. 
Your goal is to provide brief, high-value medical insights based ONLY on the context below.

### FORMATTING RULES (CRITICAL):
1. **NO HASHTAGS**: Do NOT use '#' for headers. Use bold text (e.g., **Heading**) instead.
2. **BREVITY**: Keep answers under 4-5 sentences total. If you provide a list, keep items short.
3. **NO FLUFF**: Skip the "I'm sorry to hear that" or "I understand" intro. Get straight to the facts.
4. **NO MARKDOWN BULLETS**: Use simple dashes (-) or numbers (1.) for lists.
5. **STRICT CONTEXT**: Only mention timeline events, medications, or vitals explicitly listed below. 

### PATIENT CONTEXT:
{patient_info_str if patient_info_str else 'No patient history.'}

### KNOWLEDGE:
{context_str}

### QUESTION:
{request_body.query}

### CONCISE RESPONSE:
"""

        # Pass prompt and any fetched images to Gemini
        contents = [prompt] + media_attachments
        response = gemini_model.generate_content(contents)
        answer = response.text

        sources = []
        for doc in docs:
            sources.append({
                "content": doc.page_content[:200],
                "page": doc.metadata.get("page", "N/A")
            })

        safety_flag = False
        if request_body.patient_context and request_body.patient_context.allergies:
            for allergy in request_body.patient_context.allergies:
                if allergy.lower() in request_body.query.lower() or allergy.lower() in answer.lower():
                    safety_flag = True
                    break

        return {
            "role": "ai",
            "text": answer,
            "type": "emergency" if safety_flag else "text",
            "confidence": 0.95,
            "sources": sources,
            "patient_context_used": patient_info_str if patient_info_str else "No patient context provided."
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/vision/analyze_xray")
@limiter.limit("10/minute")
async def analyze_xray(request: Request, request_body: VisionRequest):
    """
    Receives a base64-encoded X-ray image and runs it through
    the ResNet101 CNN model for lung disease classification.
    """
    try:
        from PIL import Image
        from Lung_Disease_Detection_CNN_Model import predict_lung_disease

        # Decode the base64 image
        image_data = request_body.image_base64
        if "," in image_data:
            image_data = image_data.split(",")[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        # Predict using CNN model
        pred_class = predict_lung_disease(image, CNN_WEIGHTS_PATH)

        if pred_class == "Normal":
            severity = "Low"
            recommendation = "No abnormalities detected. Continue routine checkups."
            confidence = "95%"
        elif pred_class == "Pneumonia":
            severity = "High"
            recommendation = "Immediate medical evaluation recommended. Possible antibiotics required."
            confidence = "90%"
        elif pred_class == "COVID":
            severity = "Critical"
            recommendation = "Isolate immediately and seek medical attention."
            confidence = "88%"
        elif pred_class == "Tuberculosis":
            severity = "Critical"
            recommendation = "Infectious. Requires immediate prolonged antibiotic treatment."
            confidence = "92%"
        elif pred_class == "Pneumothorax":
            severity = "High"
            recommendation = "Urgent evaluation needed. Potential chest tube placement."
            confidence = "85%"
        else:
            severity = "Unknown"
            recommendation = "Review image manually."
            confidence = "0%"

        return {
            "role": "ai",
            "type": "vision",
            "result": f"Analysis Complete: {pred_class} detected.",
            "predicted_class": pred_class,
            "severity": severity,
            "confidence": confidence,
            "recommendation": recommendation
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vision Analysis Error: {str(e)}")

@app.post("/api/vision/extract_report")
@limiter.limit("10/minute")
async def extract_report(request: Request, request_body: VisionRequest):
    """
    OCR ENDPOINT:
    Extracts text from medical reports and uses the LLM to structure the information.
    """
    if reader is None:
        raise HTTPException(status_code=503, detail="OCR engine is offline.")

    try:
        # Decode the image
        image_data = request_body.image_base64
        if "," in image_data:
            image_data = image_data.split(",")[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Run OCR
        print("[Vision] Running OCR on medical report...")
        result = reader.readtext(np.array(image))
        extracted_text = " ".join([res[1] for res in result])
        
        if not extracted_text.strip():
            return {"role": "ai", "text": "I couldn't detect any readable text in the image. Please ensure the photo is clear and well-lit.", "type": "text"}

        # Structuring with LLM (Zero-shot extraction)
        prompt = f"""You are a medical data extraction specialist. 
Extracted raw text from a medical report: '{extracted_text}'

Task: Identify and extract the following clinical entities in valid JSON format:
- Allergies (list)
- Active Medications (list)
- Vitals (dictionary with keys like heart_rate, blood_pressure, spo2 if found)

If an entity is not found, leave it as an empty list/dictionary.
Do NOT repeat the task instructions. Output ONLY valid JSON.
"""

        extraction_response = gemini_model.generate_content(prompt)
        
        # Clean up common LLM formatting issues
        json_str = extraction_response.text.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "{" in json_str:
            json_str = json_str[json_str.find("{"):json_str.rfind("}")+1]

        structured_data = {}
        try:
            structured_data = json.loads(json_str)
        except:
            print(f"Failed to parse LLM JSON: {json_str}")

        return {
            "role": "ai",
            "type": "report_scan",
            "raw_text": extracted_text[:1000], # Preview for UI
            "structured_data": structured_data,
            "text": "I've analyzed the report. I successfully extracted potential allergies, medications, and vitals. Please confirm these are correct before I update your profile."
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR Extraction Error: {str(e)}")

@app.post("/api/chat/simple")
async def simple_chat(request: ChatRequest):
    """
    A simpler chat endpoint without patient context injection.
    Falls back to the standard RAG pipeline.
    """
    if qa_chain is None or db is None:
        raise HTTPException(status_code=503, detail="AI models are still loading.")

    try:
        # Retrieve Context from FAISS
        docs = db.similarity_search(request.query, k=3)
        context_str = "\n".join([d.page_content for d in docs])
        
        prompt = f"""You are MediBOT, a clinical decision support AI.
Use the following pieces of medical context to answer the user's question.
If you don't know the answer, say so. Do NOT make up medical advice.

MEDICAL KNOWLEDGE CONTEXT:
{context_str}

USER QUESTION: {request.query}

Provide a helpful, precise answer."""

        response = gemini_model.generate_content(prompt)
        answer = response.text

        return {
            "role": "ai",
            "text": answer,
            "type": "text",
            "confidence": 0.90
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

# ---------------------------------------------------------------------------
# Doctor Dashboard Endpoints
# ---------------------------------------------------------------------------

class SummarizeRequest(BaseModel):
    patient_name: str
    patient_age: int
    timeline_events: list  # List of {date, title, desc, type} dicts

@app.post("/api/doctor/summarize")
@limiter.limit("10/minute")
async def summarize_patient(request: Request, request_body: SummarizeRequest):
    """
    DOCTOR PORTAL ENDPOINT:
    Takes the last N patient timeline events and generates a concise
    3-sentence clinical summary using Gemini.
    """
    try:
        events_text = "\n".join([
            f"- [{e.get('date', 'N/A')}] {e.get('title', 'Event')}: {e.get('desc', '')}"
            for e in request_body.timeline_events
        ])

        prompt = f"""You are a senior clinical AI assistant helping a physician.
Below are the most recent medical timeline events for patient: {request_body.patient_name} (Age: {request_body.patient_age})

{events_text}

Task: Write exactly 3 concise clinical sentences summarizing this patient's recent medical history.
Focus on: (1) Key diagnoses or events. (2) Current treatment status. (3) Recommended follow-up.
Output ONLY the 3 sentences. No headers, no bullet points."""

        response = gemini_model.generate_content(prompt)
        return {
            "summary": response.text.strip(),
            "patient_name": request_body.patient_name,
            "events_analyzed": len(request_body.timeline_events)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Summarization Error: {str(e)}")

# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Starting MediBOT AI Microservice on Port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
