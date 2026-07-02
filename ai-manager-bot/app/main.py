from __future__ import annotations

from fastapi import FastAPI, HTTPException
from starlette.responses import JSONResponse

from .evaluator import evaluate_cases, evaluate_default_cases
from .inference import predict_payload, process_payload
from .prompt_suggestions import get_prompt_suggestions


class Utf8JSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"


app = FastAPI(
    title="AI Manager Bot",
    version="0.1.0",
    default_response_class=Utf8JSONResponse,
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "ai-manager-bot", "mode": "sandbox"}


@app.post("/predict")
def predict(payload: dict) -> dict:
    try:
        return predict_payload(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/chat")
def chat(payload: dict) -> dict:
    try:
        return process_payload(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/suggestions")
def suggestions(role: str, route: str = "") -> dict:
    try:
        return get_prompt_suggestions(role=role, route=route)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/plan-action")
def plan_action(payload: dict) -> dict:
    try:
        result = process_payload(payload)
        return {
            "intent": result["intent"],
            "label": result["label"],
            "allowed": result["allowed"],
            "action_plan": result["action_plan"],
            "warnings": result["warnings"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/evaluate")
def evaluate(payload: dict) -> dict:
    return evaluate_cases(payload.get("cases") or [])


@app.get("/evaluate/default")
def evaluate_default() -> dict:
    return evaluate_default_cases()
