from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {
        "message": "Thambili AI backend is running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }