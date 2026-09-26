import { BookOpenText, Ban, LifeBuoy, PackageSearch, ReceiptText, RotateCcw, Wrench } from "lucide-react";

// Plain-language descriptions of what the AI did
export const TOOL_META = {
  get_order_details: { icon: PackageSearch, label: "Looked up the order", doing: "Looking up the order" },
  search_knowledge_base: { icon: BookOpenText, label: "Checked your help documents", doing: "Checking your help documents" },
  create_support_ticket: { icon: LifeBuoy, label: "Created a ticket for your team", doing: "Creating a ticket for your team" },
  cancel_order: { icon: Ban, label: "Cancelled the order", doing: "Cancelling the order" },
  request_refund: { icon: RotateCcw, label: "Requested a refund", doing: "Requesting a refund" },
  check_ticket_status: { icon: ReceiptText, label: "Checked a ticket", doing: "Checking the ticket" },
};

export function toolMeta(name) {
  return TOOL_META[name] || { icon: Wrench, label: name, doing: "Working" };
}

/** The most useful argument to show next to a tool name. */
export function toolArgument(tool) {
  const args = tool.args || {};
  return args.order_number || args.ticket_number || "";
}
