"use client";

// Proposal §16.1 "Login / Role Selection". For the MVP we don't have auth —
// this is a hardcoded role badge stored in localStorage so the demo can switch
// between customer-service and manager perspectives without backend changes.
// The Decision Panel reads from this to enable/disable manager-only actions.

import { useEffect, useState } from "react";

export type Role = "customer_service" | "manager";

const STORAGE_KEY = "returnguard.role";

const LABELS: Record<Role, string> = {
  customer_service: "Customer service",
  manager: "Manager",
};

export function getRole(): Role {
  if (typeof window === "undefined") return "customer_service";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "manager" ? "manager" : "customer_service";
}

export function RoleSwitcher() {
  const [role, setRole] = useState<Role>("customer_service");

  useEffect(() => {
    setRole(getRole());
  }, []);

  function update(next: Role) {
    setRole(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    // Notify other tabs / dependents.
    window.dispatchEvent(new Event("returnguard:role"));
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">role:</span>
      <select
        value={role}
        onChange={(e) => update(e.target.value as Role)}
        className="h-7 rounded border border-input bg-background px-1.5"
        aria-label="Switch demo role"
      >
        <option value="customer_service">{LABELS.customer_service}</option>
        <option value="manager">{LABELS.manager}</option>
      </select>
    </div>
  );
}
