import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Drawer,
  Input,
  Space,
  Spin,
  Tooltip,
} from "antd";
import {
  BulbOutlined,
  CloseOutlined,
  RobotOutlined,
  SendOutlined,
} from "@ant-design/icons";
import managerAiApi, {
  type ManagerAiRole,
  type ManagerAiSuggestion,
} from "../api/managerAiApi";
import { getErrorMessage } from "../utils/safe";

type StoredUser = {
  role?: string;
};

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  intent?: string;
  riskLevel?: string;
  actionSummary?: string;
  actionPlan?: Record<string, unknown>;
  warnings?: string[];
  commandId?: string;
};

type ExecuteOptions = {
  allowWhileSending?: boolean;
};

const OWNER_ALLOWED_ROUTES = new Set([
  "/owner/dashboard",
  "/owner/bookings",
  "/owner/commissions",
  "/owner/reviews",
  "/owner/vouchers",
]);

const ADMIN_ALLOWED_ROUTES = new Set([
  "/admin/dashboard",
  "/admin/users",
  "/admin/owners",
  "/admin/locations",
  "/admin/owner-services",
  "/admin/reviews",
  "/admin/vouchers",
  "/admin/system-vouchers",
  "/admin/owner-vouchers",
]);

function getStoredRole(): string {
  try {
    const raw = sessionStorage.getItem("user");
    if (!raw) return "";
    const user = JSON.parse(raw) as StoredUser;
    return String(user?.role || "");
  } catch {
    return "";
  }
}

function resolveManagerRole(pathname: string, storedRole: string): ManagerAiRole | null {
  if (storedRole === "owner" && OWNER_ALLOWED_ROUTES.has(pathname)) return "owner";
  if (storedRole === "admin" && ADMIN_ALLOWED_ROUTES.has(pathname)) return "admin";
  return null;
}

function roleTitle(role: ManagerAiRole) {
  return role === "owner" ? "Trợ lý AI Owner" : "Trợ lý AI Admin";
}

function roleSubtitle(role: ManagerAiRole) {
  return role === "owner"
    ? "Hỗ trợ đọc số liệu, đánh giá và gợi ý voucher"
    : "Hỗ trợ đọc số liệu và phân tích hệ thống";
}

function toHistoryPayload(messages: ChatMessage[]) {
  return messages.slice(-8).map((item) => ({
    from: item.from,
    text: item.text,
  }));
}

type ManagerAiBubbleProps = {
  screenContext?: Record<string, unknown>;
};

const ManagerAiBubble = ({ screenContext }: ManagerAiBubbleProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [storedRole, setStoredRole] = useState(() => getStoredRole());
  const role = useMemo(
    () => resolveManagerRole(pathname, storedRole),
    [pathname, storedRole],
  );

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ManagerAiSuggestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(`managerAiMessages_${getStoredRole()}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (storedRole) {
      sessionStorage.setItem(`managerAiMessages_${storedRole}`, JSON.stringify(messages));
    }
  }, [messages, storedRole]);
  const [input, setInput] = useState("");
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsConsumed, setSuggestionsConsumed] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStoredRole(getStoredRole());
  }, [pathname]);

  useEffect(() => {
    if (!role) {
      setOpen(false);
      return;
    }
    setSuggestions([]);
    setInput("");
    setError(null);
    setSuggestionsConsumed(false);
  }, [role, pathname]);

  useEffect(() => {
    if (!open || !role) return;

    let cancelled = false;
    setLoadingSuggestions(true);
    setError(null);

    managerAiApi
      .getSuggestions(role, pathname)
      .then((res) => {
        if (cancelled) return;
        setSuggestions(Array.isArray(res.suggestions) ? res.suggestions : []);
        if (res.disabled_reason) {
          setError(res.message || "AI không hoạt động trên màn này.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "Không tải được gợi ý AI."));
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, role, pathname]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  if (!role) return null;

  const sendMessage = async (rawText?: string) => {
    if (sending) return;
    const text = String(rawText ?? input).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      from: "user",
      text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setSending(true);
    setSuggestionsConsumed(true);

    try {
      const res = await managerAiApi.chat(role, {
        route: pathname,
        message: text,
        screen_context: screenContext,
        chat_history: toHistoryPayload(nextMessages),
      });

      const actionPlan = res.action_plan;
      const commandId = actionPlan?.command_id || `cmd-${Date.now()}`;
      const ignoredKeys = new Set(["ask_clarification", "general_chat", "unknown_intent", "unknown"]);
      const shouldAutoExecute =
        Boolean(actionPlan?.action_key) &&
        !actionPlan?.requires_confirmation &&
        !ignoredKeys.has(String(actionPlan?.action_key));

      if (!shouldAutoExecute) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            from: "bot",
            text:
              res.answer ||
              res.message ||
              "Mình đã nhận yêu cầu, nhưng bot chưa có nội dung trả lời.",
            intent: res.intent,
            riskLevel: res.risk_level || actionPlan?.risk_level,
            actionSummary: actionPlan?.summary,
            actionPlan: actionPlan,
            commandId: commandId,
            warnings: Array.isArray(actionPlan?.warnings)
              ? actionPlan?.warnings
              : Array.isArray(res.warnings)
                ? res.warnings
                : [],
          },
        ]);
      }

      if (shouldAutoExecute && actionPlan) {
        await executeAction(commandId, actionPlan, { allowWhileSending: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Không gửi được tin nhắn cho AI."));
    } finally {
      setSending(false);
    }
  };

  const executeAction = async (
    commandId: string,
    actionPlan: Record<string, unknown>,
    options?: ExecuteOptions,
  ) => {
    if (sending && !options?.allowWhileSending) return;
    setSending(true);
    setError(null);
    try {
      const res = await managerAiApi.executeAction(role, pathname, {
        command_id: commandId,
        action_key: String(actionPlan.action_key || ""),
        action_plan: actionPlan,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-exec-${Date.now()}`,
          from: "bot",
          text: res.message || "Đã thực thi yêu cầu thành công.",
        },
      ]);

      const clientAction = res.client_action as { type: string; path?: string; event_name?: string; data?: any } | undefined;
      if (clientAction) {
        if (clientAction.type === "navigate" && clientAction.path) {
          setTimeout(() => {
            navigate(clientAction.path!);
          }, 1000);
          setOpen(false);
        } else if (clientAction.type === "event" && clientAction.event_name) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(clientAction.event_name!, { detail: clientAction.data }));
          }, 500);
        }
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err, "Thực thi thất bại.");
      setError(errorMsg);
      // Thêm tin nhắn bot vào chat để user thấy rõ lỗi (không chỉ hiện error bar)
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          from: "bot",
          text: `⚠️ Xin lỗi Sếp, hệ thống gặp lỗi khi thực thi: ${errorMsg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const visibleSuggestions = suggestionsConsumed ? [] : suggestions;

  return (
    <>
      <Tooltip title={roleTitle(role)} placement="left">
        <button
          type="button"
          aria-label={roleTitle(role)}
          onClick={() => setOpen(true)}
          className="fixed bottom-8 right-8 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-2xl shadow-violet-500/30 transition-all hover:-translate-y-0.5 hover:scale-105"
        >
          <RobotOutlined className="text-2xl" />
        </button>
      </Tooltip>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <div className="flex h-full flex-col bg-slate-50">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                  <RobotOutlined className="text-2xl" />
                </div>
                <div>
                  <div className="text-base font-bold">{roleTitle(role)}</div>
                  <div className="text-xs text-white/80">{roleSubtitle(role)}</div>
                </div>
              </div>
              <Button
                type="text"
                shape="circle"
                icon={<CloseOutlined />}
                onClick={() => setOpen(false)}
                className="text-white hover:!bg-white/10 hover:!text-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {error ? (
              <Alert
                type="warning"
                showIcon
                className="mb-3 rounded-xl"
                message={error}
              />
            ) : null}

            {loadingSuggestions ? (
              <div className="py-4 text-center text-slate-500">
                <Spin size="small" /> <span className="ml-2">Đang lấy gợi ý...</span>
              </div>
            ) : visibleSuggestions.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <BulbOutlined className="text-violet-500" />
                  Câu hỏi nhanh
                </div>
                <Space size={[8, 8]} wrap>
                  {visibleSuggestions.map((item) => (
                    <Button
                      key={item.id}
                      size="small"
                      className="rounded-full"
                      disabled={sending}
                      onClick={() => void sendMessage(item.prompt)}
                    >
                      {item.title}
                    </Button>
                  ))}
                </Space>
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
                Mình chỉ hỗ trợ trong phạm vi màn này. Các thao tác chọn vị trí trên bản đồ,
                vận hành trực tiếp và chuyển tiền sẽ không được AI xử lý.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${item.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                        item.from === "user"
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{item.text}</div>
                      {item.from === "bot" && item.actionPlan?.requires_confirmation && item.commandId ? (
                        <div className="mt-3 flex gap-2 justify-end">
                          <Button
                            size="small"
                            disabled={sending}
                            onClick={() => {
                              setMessages(prev => prev.filter(m => m.id !== item.id));
                            }}
                            className="rounded-lg"
                          >
                            Hủy
                          </Button>
                          <Button 
                            type="primary" 
                            size="small" 
                            disabled={sending}
                            onClick={() => void executeAction(item.commandId!, item.actionPlan!)}
                            className="rounded-lg bg-emerald-500 border-emerald-500 hover:bg-emerald-600"
                          >
                            ✅ Đồng ý & Thực thi
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {sending ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                      <Spin size="small" /> <span className="ml-2">AI đang xử lý...</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <Space.Compact className="w-full">
              <Input.TextArea
                value={input}
                autoSize={{ minRows: 1, maxRows: 4 }}
                placeholder="Nhập câu hỏi cho AI..."
                disabled={sending}
                onChange={(event) => setInput(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={sending || !input.trim()}
                onClick={() => void sendMessage()}
                className="h-auto"
              >
                Gửi
              </Button>
            </Space.Compact>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default ManagerAiBubble;
