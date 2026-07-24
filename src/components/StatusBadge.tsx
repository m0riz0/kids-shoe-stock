import { statusLabel, type ShoeStatus } from "@/lib/domain";

const styles: Record<ShoeStatus, string> = {
  in_use: "bg-green-100 text-green-800",
  stock: "bg-blue-100 text-blue-800",
  outgrown: "bg-gray-200 text-gray-500",
};

export default function StatusBadge({ status }: { status: ShoeStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
