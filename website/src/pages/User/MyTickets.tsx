import { useSearchParams } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import TicketCart from "./TicketCart";
import TableBookingPass from "./TableBookingPass";
import RoomBookingPass from "./RoomBookingPass";

type TabKey = "tour" | "food" | "hotel";

const tabs: { key: TabKey; label: string }[] = [
  { key: "tour", label: "Du lịch" },
  { key: "food", label: "Ăn uống" },
  { key: "hotel", label: "Khách sạn" },
];

export default function MyTickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) || "tour";

  return (
    <UserLayout title="Vé của tôi" activeKey="/user/tickets">
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => setSearchParams({ tab: tab.key })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "tour" && <TicketCart isEmbedded />}
      {activeTab === "food" && <TableBookingPass isEmbedded />}
      {activeTab === "hotel" && <RoomBookingPass isEmbedded />}
    </UserLayout>
  );
}
