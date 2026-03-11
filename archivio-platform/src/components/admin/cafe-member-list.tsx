"use client";

import { useState } from "react";
import type { UserRole } from "@/types";
import { toast } from "sonner";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: number;
}

interface Props {
  cafeId: string;
  members: Member[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  cafe_admin: "Admin",
  cafe_operator: "Operator",
};

export function CafeMemberList({ cafeId, members: initial }: Props) {
  const [members, setMembers] = useState(initial);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("cafe_operator");
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      const res = await fetch(`/api/cafes/${cafeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setMembers((prev) => [...prev, data.data]);
      setInviteEmail("");
      setShowInvite(false);
      toast.success("Member added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    try {
      const res = await fetch(`/api/cafes/${cafeId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      toast.success("Role updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const res = await fetch(`/api/cafes/${cafeId}/members/${memberId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove member"
      );
    }
  };

  return (
    <section className="rounded-lg border bg-background p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Team Members
        </h2>
        <button
          onClick={() => setShowInvite((p) => !p)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showInvite ? "Cancel" : "Add Member"}
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="invite-email" className="text-xs text-muted-foreground">Email</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@email.com"
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="invite-role" className="text-xs text-muted-foreground">Role</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="rounded-md border px-3 py-2 text-sm outline-none"
            >
              <option value="cafe_operator">Operator</option>
              <option value="cafe_admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inviting ? "..." : "Add"}
          </button>
        </form>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No team members yet. Add one above.
        </p>
      ) : (
        <div className="divide-y">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.role === "super_admin" ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
                    Super Admin
                  </span>
                ) : (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      handleRoleChange(m.id, e.target.value as UserRole)
                    }
                    className="rounded-md border px-2 py-1 text-xs outline-none"
                  >
                    <option value="cafe_operator">Operator</option>
                    <option value="cafe_admin">Admin</option>
                  </select>
                )}
                {m.role !== "super_admin" && (
                  confirmRemove === m.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          handleRemove(m.id);
                          setConfirmRemove(null);
                        }}
                        className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(m.id)}
                      className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
