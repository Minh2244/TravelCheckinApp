import { useEffect, useState } from "react";
import UserLayout from "../../layouts/UserLayout";
import aiApi from "../../api/aiApi";
import type { AiChatHistoryItem } from "../../types/user.types";

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
      await aiApi.chat({ prompt: prompt.trim() });
      setPrompt("");
      await fetchHistory();
    } catch {
      setError("Không thể gửi yêu cầu AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout title="Chat AI" activeKey="/user/ai-chat">
      <section className="bg-white rounded-3xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900">Chat AI</h2>
        <p className="text-sm text-gray-500 mt-2">
          Lịch sử chat được lấy từ backend, AI sẽ phản hồi khi dịch vụ sẵn sàng.
        </p>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
              Đang tải...
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 text-center">
              {error}
            </div>
          ) : null}
          {history.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500 text-center">
              Chưa có dữ liệu hội thoại từ hệ thống.
            </div>
          ) : null}
          {history.map((item) => (
            <div
              key={item.history_id}
              className="rounded-2xl border border-gray-100 p-4"
            >
              <p className="text-xs text-gray-500">{item.prompt}</p>
              <p className="text-sm text-gray-900 mt-2">{item.response}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm"
            placeholder="Nhập câu hỏi..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
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
