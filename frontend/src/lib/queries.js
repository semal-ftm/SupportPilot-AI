import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api("/health", { auth: false }),
    refetchInterval: 30_000,
    retry: false,
  });
}

export function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => api("/tickets"),
    refetchInterval: 15_000,
  });
}

export function useSessions(view = "all", options = {}) {
  const params = new URLSearchParams({ channel: "widget" });
  if (view && view !== "all") params.set("view", view);

  return useQuery({
    queryKey: ["sessions", view],
    queryFn: () => api(`/sessions?${params}`),
    refetchInterval: 5_000,
    ...options,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api("/users"),
    staleTime: 5 * 60_000,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => api("/orders"),
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: () => api("/knowledge/documents"),
  });
}
