import { useEffect, useState } from "react";
import {
  CalendarOutlined,
  CustomerServiceOutlined,
  DownOutlined,
  EnvironmentOutlined,
  DollarCircleOutlined,
  LeftOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SearchOutlined,
  UpOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import authApi from "../api/authApi";

type SupportSettings = {
  support_hotline?: string;
  support_email?: string;
  support_zalo?: string;
};

const DEFAULT_HOTLINE = "0869378427";
const DEFAULT_EMAIL = "minhmap3367@gmail.com";

const FAQS = [
  {
    question: "Làm sao để đổi thông tin cá nhân?",
    answer:
      "Bạn quay lại trang Hồ sơ, cập nhật thông tin cần thay đổi rồi chọn Lưu thay đổi.",
  },
  {
    question: "Cách tạo lịch trình mới như thế nào?",
    answer:
      "Tại trang chủ, chọn Tạo lịch trình hoặc mở mục Lịch trình để thêm các địa điểm theo ngày.",
  },
  {
    question: "Ứng dụng có thu phí không?",
    answer:
      "Travel Check-in miễn phí cho các tính năng khám phá và quản lý hành trình. Chi phí dịch vụ tại địa điểm được hiển thị riêng khi đặt.",
  },
];

const FEEDBACK_BODY = `Xin chào đội ngũ Travel Check-in,

Tôi có một vài góp ý/phản hồi như sau:
1. 
2. 

Mong ứng dụng ngày càng phát triển.
Xin cảm ơn!`;

const SUPPORT_BODY = `Xin chào đội ngũ Travel Check-in,

Tôi đang gặp vấn đề cần hỗ trợ:
- Vấn đề gặp phải: 
- Mức độ ưu tiên: 
- Chi tiết: 

Mong nhận được sự trợ giúp sớm nhất từ các bạn.
Xin cảm ơn!`;

export default function SupportCenter({ backPath }: { backPath: string }) {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [settings, setSettings] = useState<SupportSettings>({});

  useEffect(() => {
    let active = true;
    authApi
      .getPublicSettings()
      .then((response) => {
        if (active && response?.success) setSettings(response.data || {});
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const hotline = settings.support_hotline || DEFAULT_HOTLINE;
  const email = settings.support_email || DEFAULT_EMAIL;
  const faqIcons = [
    <CalendarOutlined key="profile" />,
    <EnvironmentOutlined key="itinerary" />,
    <DollarCircleOutlined key="pricing" />,
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-6">
      <section className="relative min-h-[250px] overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 px-6 py-6 text-white shadow-lg shadow-emerald-950/10 sm:px-8">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.28)_0,transparent_34%),repeating-linear-gradient(125deg,transparent_0,transparent_18px,rgba(255,255,255,.08)_19px,transparent_20px)]" />
        <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-emerald-400/15" />

        <div className="relative z-10 max-w-[650px] lg:max-w-[62%]">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-white/90 transition hover:bg-white/20"
            >
              <LeftOutlined /> Hồ sơ
            </button>
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-semibold text-white/90">
              <SearchOutlined /> Chúng tôi luôn sẵn sàng hỗ trợ bạn
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight">Trợ giúp</h1>
          <p className="mt-1.5 text-[15px] font-medium text-white/80">
            Chúng tôi có thể giúp gì cho bạn hôm nay?
          </p>

          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent("Góp ý & Phản hồi Travel Check-in")}&body=${encodeURIComponent(FEEDBACK_BODY)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex min-h-[68px] items-center gap-3 rounded-2xl bg-white px-4 py-3 text-slate-800 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
              <MessageOutlined />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold">Góp ý &amp; Phản hồi</span>
              <span className="mt-0.5 block text-xs font-medium text-slate-500">
                Giúp chúng tôi cải thiện hệ thống
              </span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <RightOutlined />
            </span>
          </a>
        </div>

        <div className="absolute bottom-4 right-8 hidden h-[220px] w-[32%] items-center justify-center lg:flex">
          <div className="absolute bottom-1 h-8 w-48 rounded-[50%] bg-emerald-950/35 blur-sm" />
          <div className="absolute bottom-5 h-14 w-52 rounded-[50%] border border-emerald-300/30 bg-emerald-600/80" />
          <div className="relative z-10 flex h-36 w-36 items-center justify-center rounded-full border-[10px] border-emerald-300/30 bg-emerald-700/80 shadow-2xl">
            <CustomerServiceOutlined className="text-[88px] text-emerald-100" />
          </div>
          <span className="absolute left-2 top-8 flex h-12 w-14 items-center justify-center rounded-2xl bg-white text-xl text-emerald-700 shadow-lg">
            <MessageOutlined />
          </span>
          <span className="absolute right-2 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-emerald-700 shadow-lg">
            <QuestionCircleOutlined />
          </span>
          <span className="absolute right-0 top-24 flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg">
            <UserOutlined />
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2.5 text-xl font-black text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-sm text-white">
            <QuestionCircleOutlined />
          </span>
          Câu hỏi thường gặp
        </h2>

        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {FAQS.map((faq, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <div key={faq.question} className={index ? "border-t border-slate-100" : ""}>
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : index)}
                    className="flex min-h-[62px] w-full items-center gap-3 px-4 text-left transition hover:bg-emerald-50/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-base text-emerald-600">
                      {faqIcons[index]}
                    </span>
                    <span className="flex-1 text-sm font-extrabold text-slate-800 sm:text-[15px]">
                      {faq.question}
                    </span>
                    {isExpanded ? (
                      <UpOutlined className="text-emerald-600" />
                    ) : (
                      <DownOutlined className="text-emerald-600" />
                    )}
                  </button>
                  {isExpanded ? (
                    <p className="bg-slate-50/70 px-16 py-3 text-sm leading-6 text-slate-600">
                      {faq.answer}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <aside className="relative hidden overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm lg:flex lg:flex-col lg:justify-end">
            <div className="absolute inset-x-0 top-3 flex justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-700">
                <CustomerServiceOutlined />
                <span className="absolute -left-5 top-1 rounded-xl bg-emerald-600 px-2 py-1 text-[11px] font-black text-white shadow">24/7</span>
                <span className="absolute -right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-rose-400 shadow">♥</span>
              </div>
            </div>
            <div className="relative rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="text-sm font-extrabold text-slate-800">Chúng tôi luôn sẵn sàng!</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Đội ngũ hỗ trợ hoạt động 24/7 để giải đáp mọi thắc mắc của bạn.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2.5 text-xl font-black text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-sm text-white">
            <PhoneOutlined />
          </span>
          Liên hệ trực tiếp
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <a
            href={`tel:${hotline}`}
            className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
              <PhoneOutlined />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-extrabold text-slate-800">
                Gọi Hotline
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">24/7</span>
              </span>
              <span className="mt-1 block text-sm font-semibold text-slate-500">{hotline}</span>
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-500">
              <RightOutlined />
            </span>
          </a>

          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent("Yêu cầu hỗ trợ từ Travel Check-in")}&body=${encodeURIComponent(SUPPORT_BODY)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[78px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-2xl text-violet-600">
              <MailOutlined />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-slate-800">Gửi Email</span>
              <span className="mt-1 block truncate text-sm font-semibold text-slate-500">{email}</span>
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-500">
              <RightOutlined />
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
