from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ALTER EGO backend is alive"}