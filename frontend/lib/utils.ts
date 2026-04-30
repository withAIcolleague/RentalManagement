import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatKRW(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR") + "원";
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function expiryBadge(days: number | null): { label: string; cls: string } {
  if (days === null) return { label: "-", cls: "bg-gray-100 text-gray-500" };
  if (days < 0) return { label: "만료", cls: "bg-red-100 text-red-700" };
  if (days <= 30) return { label: `D-${days}`, cls: "bg-red-100 text-red-700" };
  if (days <= 60) return { label: `D-${days}`, cls: "bg-orange-100 text-orange-700" };
  if (days <= 90) return { label: `D-${days}`, cls: "bg-yellow-100 text-yellow-700" };
  return { label: `D-${days}`, cls: "bg-green-100 text-green-700" };
}
