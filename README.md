# Glaucoma Screening POC

A full-stack proof-of-concept application for Glaucoma screening using deep learning models (Dense U-Net for segmentation and TransUNet for analysis). Features a premium, medical-grade web interface with real-time AI inference.

## Project Structure

- `frontend/`: Next.js application providing the medical-grade web interface.
- `backend/`: FastAPI application serving the AI model inference.
- `backend/models/`: Pre-trained deep learning models (DenseNet-121, TransUNet).
- `backend/weights/`: Directory containing the `.pth` model weights (tracked with Git LFS).
- `input/` & `output/`: Directories for processing files and storing test data.

---

## Prerequisites

### System Requirements
- **Python**: 3.9 or higher
- **Node.js**: 16.x or higher (with npm)
- **Git LFS**: For downloading model weights
- **Disk Space**: ~2GB for model weights and dependencies
- **RAM**: 8GB minimum (16GB recommended for inference)

### Install Git LFS

Before cloning the repository, install Git LFS:

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install git-lfs
git lfs install
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install git-lfs
git lfs install
```

**macOS:**
```bash
brew install git-lfs
git lfs install
```

**Windows:**
- Download and install from https://git-lfs.com
- Or use: `choco install git-lfs` (if using Chocolatey)

---

## Quick Start Guide

### Step 1: Clone the Repository and Pull LFS Files

```bash
git clone <repository-url>
cd glaucoma-screening-poc
git lfs pull
```

---

## Running the Application

The application requires **two separate terminal sessions**: one for the backend and one for the frontend.

### Linux Setup & Running

#### Terminal 1: Backend Setup & Start

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

The backend API will be available at: **http://localhost:8000**

#### Terminal 2: Frontend Setup & Start

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node.js dependencies (only needed first time)
npm install

# Start the development server
npm run dev
```

**Expected output:**
```
✓ Ready in 1.2s
- Local:   http://localhost:3000
```

The frontend will be available at: **http://localhost:3000** (or next available port like 3001)

---

### Windows Setup & Running

#### PowerShell Terminal 1: Backend Setup & Start

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\Activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
python main.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

#### PowerShell Terminal 2: Frontend Setup & Start

```powershell
# Open a new PowerShell and navigate to frontend directory
cd frontend

# Install Node.js dependencies (only needed first time)
npm install

# Start the development server
npm run dev
```

**Expected output:**
```
✓ Ready in 1.2s
- Local:   http://localhost:3000
```

---

## Accessing the Application

1. Open your browser and go to: **http://localhost:3000** (or the port shown in the frontend terminal)
2. You should see the **GlaucoScan AI** interface with:
   - Upload section for fundus photographs
   - Real-time analysis pipeline status
   - Results dashboard with diagnostic reports

---

## Using the Application

### Step 1: Upload a Fundus Image
- Click **"Upload Fundus Image"** or drag-and-drop a retinal photograph (JPG, PNG)
- Supported formats: JPEG, PNG
- Recommended resolution: 1024×1024 or higher

### Step 2: Run Analysis
- Click **"Run Screening"** to start the AI inference
- Monitor the real-time pipeline status showing:
  - Image preprocessing
  - Segmentation (optic disc/cup detection)
  - Feature extraction
  - Risk assessment
  - Report generation

### Step 3: View Results
The dashboard displays:
- **Diagnosis**: Healthy / Glaucoma Suspicion / Glaucoma
- **Risk Score**: 0-100% probability
- **VCDR (Vertical Cup-to-Disc Ratio)**: Structural parameter
- **Segmentation Mask**: Optic disc and cup boundaries
- **Grad-CAM Heatmap**: Explainability visualization showing decision drivers
- **Risk Band**: Low Risk / Borderline / High Risk

### Step 4: Download Report
- Click **"Download PDF Report"** to export clinical findings

---

## Troubleshooting

### Port Already in Use

**Linux:**
```bash
# Kill process on port 8000 (backend)
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

**Windows (PowerShell):**
```powershell
# Kill process on port 8000
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force

# Kill process on port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

### "Failed to Fetch" Error

This usually means the frontend and backend cannot communicate. Check:
1. **Backend is running**: Visit http://localhost:8000/api/v1/health
2. **Same network**: Both services must be on localhost
3. **CORS settings**: Backend allows frontend port in CORS configuration

### Python Virtual Environment Issues

**Linux:**
```bash
# Remove and recreate venv
rm -rf backend/venv
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

**Windows:**
```powershell
# Remove and recreate venv
Remove-Item -Recurse -Force backend\venv
python -m venv backend\venv
backend\venv\Scripts\Activate
pip install -r backend/requirements.txt
```

### Model Weights Not Loading

Ensure Git LFS files were downloaded:
```bash
git lfs pull
ls -lh backend/weights/
```

Should show:
- `densenet121_latest.pth` (~5MB actual, not Git LFS pointer)
- `transunet_latest.pth` (~200MB actual, not Git LFS pointer)

If showing small files (~100 bytes), LFS didn't pull correctly:
```bash
git lfs install
git lfs pull
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Check backend status |
| POST | `/api/v1/analyze` | Submit fundus image for analysis |

### Health Check
```bash
curl http://localhost:8000/api/v1/health
```

Response:
```json
{
  "status": "online",
  "hardware_accelerator": "cpu"
}
```

### Image Analysis
```bash
curl -X POST -F "file=@fundus_image.jpg" http://localhost:8000/api/v1/analyze
```

---

## Performance Notes

- **First inference**: ~5-10 seconds (model initialization)
- **Subsequent inferences**: ~4-5 seconds (segmentation + classification)
- **GPU acceleration**: Supported via CUDA/MPS (automatic detection)

---

## Git LFS Reference

```bash
# Initialize Git LFS
git lfs install

# Track .pth files
git lfs track "*.pth"

# Check LFS status
git lfs ls-files

# Pull LFS files after cloning
git lfs pull
```
