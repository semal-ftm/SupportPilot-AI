import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { AlertTriangle, Check, Eye, Lock, MessageCircle, Package, Search, Store, X } from "lucide-react";
import { Button, Card, Drawer, EmptyState, Input, PageIntro, Skeleton } from "../components/ui";
import { OrderStatusBadge, StatusBadge } from "../components/badges";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency } from "../lib/format";
import { useOrders } from "../lib/queries";

const STAGES = ["Processing", "Shipped", "Out for Delivery", "Delivered"];

function Progress({ status }) {
  const current = STAGES.indexOf(status);

  if (current < 0) {
    return <OrderStatusBadge status={status} />;
  }

  return (
    <ol className="flex items-start">
      {STAGES.map((stage, index) => {
        const done = index <= current;
        return (
          <li key={stage} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 && <span className={clsx("absolute end-1/2 top-3.5 h-0.5 w-full", done ? "bg-brand" : "bg-line")} />}
            <span className={clsx("relative grid size-7 place-items-center rounded-full border-2", done ? "border-brand bg-brand text-white" : "border-line bg-surface")}>
              {done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className={clsx("mt-2 px-1 text-xs leading-tight", done ? "font-medium text-ink" : "text-muted")}>{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderDetails({ orderNumber, onClose }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [revealed, setRevealed] = useState(null);

  const order = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => api(`/orders/${encodeURIComponent(orderNumber)}`),
    enabled: Boolean(orderNumber),
  });

  const reveal = useMutation({
    mutationFn: () => api(`/customers/${order.data.customer_id}/reveal`, { method: "POST" }),
    onSuccess: setRevealed,
    onError: (error) => toast.error(error.message),
  });

  const data = order.data;

  return (
    <Drawer open={Boolean(orderNumber)} onClose={onClose} width="max-w-lg">
      <div className="flex items-start gap-3 border-b border-line px-6 py-5">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">Order {orderNumber}</div>
          <h2 className="text-xl font-semibold">{data?.product || "…"}</h2>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {order.isLoading && <Skeleton className="h-48" />}
        {data && (
          <>
            <Progress status={data.status} />

            <dl className="divide-y divide-line rounded-xl border border-line">
              {[
                ["Price", formatCurrency(data.amount, data.currency)],
                ["Delivery company", data.carrier || "Not shipped yet"],
                ["Tracking number", data.tracking_number || "Not shipped yet"],
                ["Expected delivery", data.expected_delivery || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Customer</span>
                {!revealed && (
                  <span className="inline-flex items-center gap-1 text-xs text-good">
                    <Lock className="size-3" /> Partly hidden for privacy
                  </span>
                )}
              </div>
              <div className="mt-2 font-medium">{revealed?.name || data.customer?.name}</div>
              <div className="text-sm text-muted">{revealed?.email || data.customer?.email}</div>
              {isAdmin && !revealed && data.customer_id && (
                <Button size="xs" variant="ghost" icon={Eye} className="-ms-2 mt-2" loading={reveal.isPending} onClick={() => reveal.mutate()}>
                  Show full details
                </Button>
              )}
              {revealed && <p className="mt-2 text-xs text-muted">This was recorded in the privacy log.</p>}
            </div>

            {data.tickets.length > 0 && (
              <div>
                <div className="mb-2 font-medium">Tickets for this order</div>
                <div className="space-y-2">
                  {data.tickets.map((ticket) => (
                    <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-brand/40">
                      <span className="min-w-0 flex-1 truncate">{ticket.title}</span>
                      <StatusBadge status={ticket.status} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-line p-4">
        <Button
          variant="soft"
          icon={MessageCircle}
          className="w-full"
          onClick={() => navigate(`/chat?prompt=${encodeURIComponent(`What is the status of order ${orderNumber}?`)}`)}
        >
          Ask the AI about this order
        </Button>
      </div>
    </Drawer>
  );
}

export default function Orders() {
  const orders = useOrders();
  const source = useQuery({ queryKey: ["order-source"], queryFn: () => api("/orders/source") });
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const term = search.trim().toLowerCase();
  const visible = (orders.data || []).filter(
    (order) => !term || `${order.order_number} ${order.product} ${order.tracking_number || ""}`.toLowerCase().includes(term)
  );

  return (
    <>
      <PageIntro>These are the orders your AI can look up for customers. Click an order to see its details.</PageIntro>

      {source.data && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Store className="size-4 text-brand" />
          {source.data.provider === "demo" ? (
            <span>
              Showing <span className="font-medium">demo orders</span>. Connect your real store in{" "}
              <Link to="/settings?tab=store" className="font-medium text-brand hover:underline">
                Settings → Store
              </Link>
              .
            </span>
          ) : (
            <span>
              Showing recent orders from your <span className="font-medium">{source.data.name}</span> store.
            </span>
          )}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line p-3">
          <Input icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by order number or product…" className="w-full sm:w-80" />
        </div>

        {orders.isError ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load orders from your store" description={orders.error.message} />
        ) : orders.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState icon={Package} title="No orders found" description={term ? "Try a different search." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-sm text-muted">
                  {["Order", "Product", "Customer", "Price", "Status"].map((column) => (
                    <th key={column} className="px-5 py-3 text-start font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.order_number} onClick={() => setParams({ open: order.order_number })} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-4 font-medium whitespace-nowrap">{order.order_number}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{order.product}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-ink-2">{order.customer?.name}</td>
                    <td className="px-5 py-4 whitespace-nowrap tabular">{formatCurrency(order.amount, order.currency)}</td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OrderDetails orderNumber={params.get("open")} onClose={() => setParams({})} />
    </>
  );
}
