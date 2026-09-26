import { CheckCircle2, Circle, CircleDot, Flame } from "lucide-react";
import { Badge } from "./ui";

const STATUS = {
  Open: { tone: "info", icon: Circle, label: "Open" },
  "In Progress": { tone: "warn", icon: CircleDot, label: "In progress" },
  Resolved: { tone: "good", icon: CheckCircle2, label: "Resolved" },
};

export function StatusBadge({ status }) {
  const config = STATUS[status] || STATUS.Open;
  return (
    <Badge tone={config.tone} icon={config.icon}>
      {config.label}
    </Badge>
  );
}

/** Only urgent tickets get a badge, so the list stays calm. */
export function UrgentBadge({ priority }) {
  if (priority !== "High") return null;
  return (
    <Badge tone="bad" icon={Flame}>
      Urgent
    </Badge>
  );
}

const ORDER_STATUS_TONE = {
  Processing: "info",
  Shipped: "brand",
  "Out for Delivery": "brand",
  Delivered: "good",
  Cancelled: "neutral",
  "Refund Requested": "warn",
};

export function OrderStatusBadge({ status }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status] || "neutral"} dot>
      {status}
    </Badge>
  );
}
