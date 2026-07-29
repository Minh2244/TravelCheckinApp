from __future__ import annotations
from .schemas import BotRequest, BotResponse, ClassificationResult, ActionPlan
from .llm_layer import maybe_analyze_payload
from .action_planner import build_action_plan

def process_payload(payload: dict) -> dict:
    request = BotRequest.from_payload(payload)
    
    # 1. Gọi LLM để phân tích intent
    classification = ClassificationResult(intent="unknown", label="Unknown", confidence=0.0, allowed=True, risk_level="read", reason="")
    
    llm_analysis = maybe_analyze_payload(request, classification, {}, None)
    
    # 2. Xây dựng Action Plan dựa trên Intent LLM trả về
    if llm_analysis and llm_analysis.intent_candidate:
        classification.intent = llm_analysis.intent_candidate
        classification.confidence = llm_analysis.confidence or 0.9
        classification.entities = llm_analysis.entities
        
    action_plan = build_action_plan(request, classification)
    
    if llm_analysis and hasattr(action_plan, "entities"):
        action_plan.entities = llm_analysis.entities

    # 3. Kết quả trả về
    answer = llm_analysis.answer if llm_analysis else "Tôi chưa xử lý được yêu cầu này. Sếp thử nói rõ hơn một chút nhé."
    if action_plan.action_key == "ask_clarification" and action_plan.summary.startswith("Thiếu thông tin bắt buộc"):
        if "time_range" in action_plan.summary or "months" in action_plan.summary:
            answer = "Sếp muốn xem dữ liệu trong khoảng thời gian nào? Ví dụ: hôm nay, tuần này, tháng này hoặc năm nay."
        else:
            if llm_analysis and llm_analysis.answer and len(llm_analysis.answer) > 5:
                answer = llm_analysis.answer
            else:
                missing = action_plan.summary.split(': ')[1]
                answer = f"Để thực hiện, sếp vui lòng cung cấp thêm thông tin: {missing} nhé."

    response = BotResponse(
        intent=classification.intent,
        label=action_plan.summary,
        confidence=classification.confidence,
        risk_level=action_plan.risk_level,
        allowed=True,
        entities=llm_analysis.entities if llm_analysis else {},
        answer=answer,
        action_plan=action_plan,
        warnings=action_plan.warnings,
        llm={
            "enabled": True,
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "used": True,
            "error": llm_analysis.error if llm_analysis else None,
        },
    )
    return response.to_dict()

def predict_payload(payload: dict) -> dict:
    request = BotRequest.from_payload(payload)
    # Lấy nhanh intent
    classification = ClassificationResult(intent="unknown", label="Unknown", confidence=0.0, allowed=True, risk_level="read", reason="")
    llm_analysis = maybe_analyze_payload(request, classification, {}, None)
    
    intent = llm_analysis.intent_candidate if llm_analysis else "unknown"
    confidence = llm_analysis.confidence if llm_analysis else 0.0
    
    return {
        "intent": intent,
        "label": intent,
        "confidence": confidence,
        "allowed": True,
        "risk_level": "read",
        "reason": "",
    }
