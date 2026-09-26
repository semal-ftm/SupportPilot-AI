import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  BookOpenText,
  House,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  Moon,
  Package,
  Settings,
  Sun,
  Ticket,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { Avatar, Button } from "./ui";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { useHealth, useTickets } from "../lib/queries";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: House },
  { to: "/chat", label: "Test Chat", icon: MessageCircle },
  { to: "/conversations", label: "Conversations", icon: MessagesSquare },
  { to: "/tickets", label: "Tickets", icon: Ticket, badge: true },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/docs", label: "Help Docs", icon: BookOpenText },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AiStatus() {
  const health = useHealth();

  const online = health.isSuccess;
  const ready = online && health.data.ai_configured;

  const label = !online ? "Server offline" : ready ? "AI is online" : "AI key missing";
  const dot = !online ? "bg-bad" : ready ? "bg-good" : "bg-warn";

  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2">
      <span className={clsx("size-2 rounded-full", dot, ready && "live-dot")} />
      {label}
    </div>
  );
}

function Sidebar({ onNavigate, mobile = false }) {
  const { user, logout } = useAuth();
  const tickets = useTickets();
  const openTickets = (tickets.data || []).filter((ticket) => ticket.status === "Open").length;

  return (
    <aside className="flex h-full w-64 flex-col border-e border-line bg-surface">
      <div className="flex h-16 items-center justify-between border-b border-line px-5">
        <Logo />
        {mobile && <Button variant="ghost" size="sm" icon={X} onClick={onNavigate} aria-label="Close menu" />}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                isActive ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )
            }
          >
            <item.icon className="size-5 shrink-0" strokeWidth={1.9} />
            <span className="flex-1">{item.label}</span>
            {item.badge && openTickets > 0 && (
              <span className="rounded-full bg-brand px-2 text-xs leading-5 font-semibold text-white tabular" title={`${openTickets} open tickets`}>
                {openTickets}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-line p-4">
        <Avatar name={user?.name} tone="brand" className="size-9 text-xs" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-ink">{user?.name}</div>
          <div className="truncate text-xs text-muted">{user?.role === "admin" ? "Admin" : "Support agent"}</div>
        </div>
        <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} title="Sign out" aria-label="Sign out" />
      </div>
    </aside>
  );
}

export function Layout() {
  const { resolved, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = NAV_ITEMS.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );

  const fullHeight = ["/chat", "/conversations"].includes(location.pathname);

  return (
    <div className="flex h-full">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="drawer-panel absolute inset-y-0 start-0 [--slide-from:-100%]">
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-page/85 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="sm" icon={Menu} className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" />
          <h1 className="text-lg font-semibold tracking-tight">{current?.label || "SupportPilot"}</h1>

          <div className="ms-auto flex items-center gap-2">
            <AiStatus />
            <Button
              variant="ghost"
              size="sm"
              icon={resolved === "dark" ? Sun : Moon}
              onClick={toggle}
              title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            />
          </div>
        </header>

        <main className={clsx("min-h-0 flex-1", fullHeight ? "overflow-hidden" : "overflow-y-auto")}>
          {fullHeight ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
