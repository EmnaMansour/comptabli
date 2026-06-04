@echo off
echo Starting Comptabli ML Service...
call venv\Scripts\activate.bat
set PYTHONIOENCODING=utf-8
python -m uvicorn app:app --host 0.0.0.0 --port 5001 --reload
