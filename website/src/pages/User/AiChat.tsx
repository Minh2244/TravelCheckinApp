import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import aiApi from "../../api/aiApi";
import type { AiChatHistoryItem } from "../../types/user.types";
import { getAiLocationContext } from "../../utils/aiLocationContext";

const AiChat = () => {
  const [history, setHistory] = useState<AiChatHistoryItem[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiApi.getHistory();
      setHistory(response.data ?? []);
    } catch {
      setError("Không thể tải lịch sử chat AI");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const context = await getAiLocationContext();
      await aiApi.chat({ prompt: prompt.trim(), context });
      setPrompt("");
      const response = await aiApi.getHistory();
      setHistory(response.data ?? []);
    } catch {
      setError("Không thể gửi yêu cầu AI");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện với AI?")) return;
    setLoading(true);
    setError(null);
    try {
      await aiApi.clearHistory();
      setHistory([]);
    } catch {
      setError("Không thể xóa lịch sử AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout title="Chat AI" activeKey="/user/ai-chat">
      <section className="user-section p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Trò chuyện với AI để được gợi ý địa điểm, lập kế hoạch du lịch và tư vấn chuyến đi.
          </p>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={loading || history.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa lịch sử
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-6 text-sm text-gray-500 text-center">
              Đang tải...
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 text-center">
              {error}
            </div>
          ) : null}
          {history.length === 0 && !loading ? (
            <div className="rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white p-6 text-sm text-gray-500 text-center">
              Chưa có dữ liệu hội thoại từ hệ thống.
            </div>
          ) : null}
          {history.map((item) => (
            <div
              key={item.history_id}
              className="user-sub-card p-4 card-lift"
            >
              <p className="text-xs text-gray-500">{item.prompt}</p>
              <p className="text-sm text-gray-900 mt-2 whitespace-pre-line break-words">{item.response}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
            placeholder="Nhập câu hỏi..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors duration-200 shadow-lg shadow-teal-500/25"
            onClick={handleSend}
            disabled={loading}
          >
            Gửi
          </button>
        </div>
      </section>
    </UserLayout>
  );
};

export default AiChat;
