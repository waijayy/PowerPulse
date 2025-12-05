from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logic_training
import logic_detection
import logic_stats
import forecast_api
import monthly_api

app = FastAPI(title="PowerPulse ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ApplianceItem(BaseModel):
    type: str
    rated_watts: Optional[float] = 0
    quantity: Optional[int] = 1

class DetectionRequest(BaseModel):
    mains_reading: float
    inventory: List[ApplianceItem]

class DisaggregateRequest(BaseModel):
    total_kwh: float
    appliances: List[ApplianceItem]

@app.get("/")
def root():
    return {"status": "ok", "service": "PowerPulse ML Service"}

@app.post("/api/train")
def train_model():
    try:
        profiles = logic_training.train_appliance_models()
        return {"status": "success", "profiles": profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/predict-phantom")
def predict_phantom(request: DetectionRequest):
    try:
        inventory_list = [{"type": item.type, "rated_watts": item.rated_watts} for item in request.inventory]
        result = logic_detection.detect_phantom_sources(
            request.mains_reading, 
            inventory_list
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stats")
@app.get("/api/stats")
def get_usage_stats(inventory: Optional[List[ApplianceItem]] = None):
    try:
        inventory_list = None
        if inventory:
            inventory_list = [{"type": item.type, "rated_watts": item.rated_watts} for item in inventory]
        stats = logic_stats.generate_usage_report(inventory_list)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/disaggregate")
def disaggregate_usage(request: DisaggregateRequest):
    try:
        appliance_list = [
            {"type": a.type, "quantity": a.quantity, "rated_watts": a.rated_watts} 
            for a in request.appliances
        ]
        result = logic_stats.disaggregate_energy(request.total_kwh, appliance_list)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount the forecasting API under /forecast so its routes are accessible
app.mount("/forecast", forecast_api.app)

# Mount the monthly forecasting API under /monthly
app.mount("/monthly", monthly_api.app)

# Explicitly load forecast models since startup events don't fire for mounted apps
@app.on_event("startup")
def load_forecast_models():
    print("\n" + "="*50)
    print("  Loading Forecast API Models")
    print("="*50)
    forecast_api.load_models_and_scalers()
    forecast_api.load_dataset_cache()
    print("="*50 + "\n")
    
    print("="*50)
    print("  Loading Monthly Forecast Model")
    print("="*50)
    monthly_api.load_or_train_model()
    print("="*50 + "\n")

