# Glaucoma Screening POC

This repository contains a full-stack proof-of-concept application for Glaucoma screening using deep learning models (Dense U-Net for segmentation and TransUNet for analysis).

## Project Structure

- `frontend/`: A Next.js application providing a premium, medical-grade web interface.
- `backend/`: A FastAPI application serving the AI model inference.
- `input/` & `output/`: Directories for processing files and storing test data. 
- `backend/weights/`: Directory containing the `.pth` model weights. **Note: Weights are tracked using Git LFS.**

---

## How to Run the Application

To run the full application, you need to start both the backend server and the frontend development server.

### 1. Starting the Backend (FastAPI)

Open a terminal and follow these steps:

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment (if not already done)
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# 3. Install the dependencies
pip install -r requirements.txt

# 4. Start the server
python main.py
```
The backend server will run on `http://localhost:8000`.

### 2. Starting the Frontend (Next.js)

Open a **new** terminal window and follow these steps:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install Node.js dependencies
npm install

# 3. Start the development server
npm run dev
```
The frontend application will be available at `http://localhost:3000`.

---

## Git LFS Note

This project uses Git Large File Storage (LFS) to track large model weight files (`.pth`, `.pt`). Ensure you have Git LFS installed on your system to properly clone and push these files.

```bash
# To install Git LFS
git lfs install

# To pull the LFS files after cloning
git lfs pull
```
