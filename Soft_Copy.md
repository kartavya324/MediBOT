# MediBOT: AI-Powered Clinical Intelligence Platform

This document provides a comprehensive overview of the **MediBOT** project, including the software stack, execution instructions, and core code snippets.

---

## 1. Software Used

The MediBOT system is built using a modern, scalable tech stack comprising web technologies, machine learning frameworks, and cloud services.

### **Frontend (Patient & Doctor Portals)**
*   **Framework**: React 19 (TypeScript)
*   **Build Tool**: Vite 6.0
*   **Styling**: Tailwind CSS 4.0
*   **Animations**: Framer Motion
*   **Icons**: Lucide React
*   **Charts**: Recharts (for clinical vitals visualization)
*   **State Management**: Zustand & Dexie.js (for offline-first IndexedDB storage)
*   **Backend Integration**: Axios

### **Backend (AI Core Engine)**
*   **Language**: Python 3.11+
*   **API Framework**: FastAPI
*   **Server**: Uvicorn
*   **Rate Limiting**: SlowAPI
*   **Environment Management**: Python-dotenv

### **Machine Learning & AI**
*   **LLM Pipeline**: LangChain
*   **LLMs**: Google Gemini Flash (via Google Generative AI SDK) & Llama-2 (local GGUF)
*   **Vector Store**: FAISS (Facebook AI Similarity Search)
*   **Embeddings**: HuggingFace (`sentence-transformers/all-MiniLM-L6-v2`)
*   **Computer Vision**: PyTorch (ResNet101 CNN for X-ray analysis)
*   **OCR**: EasyOCR (for medical report scanning)
*   **Data Processing**: NumPy, Pillow (PIL)

### **Cloud & DevOps**
*   **Authentication & Database**: Firebase (Auth & Firestore)
*   **Hosting**: Firebase Hosting
*   **Containerization**: Docker

---

## 2. Instruction to Execute the Code

To run the MediBOT project locally, follow these steps in order.

### **Prerequisites**
*   Node.js (v18+)
*   Python (v3.11+)
*   Git
*   A Google Gemini API Key

### **Step 1: Backend Setup (AI Core Engine)**
1.  Navigate to the project root directory.
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/scripts/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Create a `.env` file in the root directory and add your API key:
    ```env
    GEMINI_API_KEY=your_google_gemini_api_key_here
    CORS_ORIGINS=http://localhost:5173
    ```
5.  Start the FastAPI server:
    ```bash
    python api_bridge.py
    ```
    *The backend will be live at `http://localhost:8000`.*

### **Step 2: Frontend Setup (Web UI)**
1.  Navigate to the `Medibot-UIiiiiiiiiiii` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure environment variables in `.env.local`:
    ```env
    VITE_API_URL=http://localhost:8000
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
    *The frontend will be live at `http://localhost:5173` (or the port shown in your terminal).*

---

## 3. Core Code Snippets

### **A. Backend AI Bridge (`api_bridge.py`)**
This snippet shows the Personalized RAG endpoint which injects patient clinical context into the AI prompt.

```python
@app.post("/api/chat/personalized")
async def personalized_chat(request: Request, request_body: ChatRequest):
    # 1. Retrieve Context from FAISS Vector Store
    docs = db.similarity_search(request_body.query, k=3)
    context_str = "\n".join([d.page_content for d in docs])
    
    # 2. Build Personalized Prompt with Patient Context
    prompt = f"""You are MediBOT, a clinical AI.
    PATIENT CONTEXT: {request_body.patient_context}
    KNOWLEDGE: {context_str}
    QUESTION: {request_body.query}
    """

    # 3. Generate Response via Gemini
    response = gemini_model.generate_content(prompt)
    return {"role": "ai", "text": response.text, "sources": sources}
```

### **B. CNN Lung Disease Prediction (`Lung_Disease_Detection_CNN_Model.py`)**
The core logic for classifying X-ray images using a ResNet101 architecture.

```python
def predict_lung_disease(image, model_path):
    # Load Pre-trained ResNet101
    model = models.resnet101(pretrained=False)
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 5) # 5 Classes: Normal, COVID, Pneumonia, etc.
    
    model.load_state_dict(torch.load(model_path, map_location='cpu'))
    model.eval()
    
    # Image Preprocessing
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    input_tensor = transform(image).unsqueeze(0)
    with torch.no_grad():
        output = model(input_tensor)
        _, predicted = torch.max(output, 1)
    
    return class_names[predicted.item()]
```

### **C. Frontend Clinical Dashboard (`DoctorDashboard.tsx`)**
A snippet showing the integration of Recharts for live patient monitoring.

```tsx
const VitalsChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
      <XAxis dataKey="time" stroke="#9ca3af" />
      <YAxis stroke="#9ca3af" />
      <Tooltip content={<CustomTooltip />} />
      <Area type="monotone" dataKey="heartRate" stroke="#10b981" fillOpacity={1} fill="url(#colorHr)" />
    </AreaChart>
  </ResponsiveContainer>
);
```

---

*This document is generated as a soft copy for project documentation purposes.*
