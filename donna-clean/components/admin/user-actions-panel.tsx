"use client";

import { useState, useTransition } from "react";
import {
  deactivateUser,
  reactivateUser,
  resetUserPassword,
} from "@/app/admin/user-actions";

interface UserInfo {
  id: string;
  email: string;
  username?: string;
  banned_until?: string | null;
}

interface UserActionsPanelProps {
  users: UserInfo[];
}

export function UserActionsPanel({ users }: UserActionsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate" | "reactivate" | "reset";
    userId: string;
    email: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase())
  );

  const isBanned = (user: UserInfo) => {
    if (!user.banned_until) return false;
    return new Date(user.banned_until) > new Date();
  };

  const handleAction = () => {
    if (!confirmAction) return;
    setActionTarget(confirmAction.userId);
    setFeedback(null);

    startTransition(async () => {
      let result;
      switch (confirmAction.type) {
        case "deactivate":
          result = await deactivateUser(confirmAction.userId);
          break;
        case "reactivate":
          result = await reactivateUser(confirmAction.userId);
          break;
        case "reset":
          result = await resetUserPassword(confirmAction.email);
          break;
      }

      if (result.success) {
        setFeedback({
          type: "success",
          message:
            confirmAction.type === "deactivate"
              ? `${confirmAction.email} has been deactivated`
              : confirmAction.type === "reactivate"
                ? `${confirmAction.email} has been reactivated`
                : `Password reset link generated for ${confirmAction.email}`,
        });
      } else {
        setFeedback({
          type: "error",
          message: result.error || "Action failed",
        });
      }

      setConfirmAction(null);
      setActionTarget(null);
    });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by username, email, or user ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-purple-500/30 bg-purple-900/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm ${
            feedback.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Users Table */}
      <div className="border border-purple-500/30 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/20">
              <tr>
                <th className="text-left p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
                  User
                </th>
                <th className="text-center p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
                  Status
                </th>
                <th className="text-right p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="p-8 text-center text-sm text-white/50"
                  >
                    {search ? "No users match your search" : "No users found"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const banned = isBanned(user);
                  return (
                    <tr
                      key={user.id}
                      className="border-t border-purple-500/20 hover:bg-purple-900/10"
                    >
                      {/* User */}
                      <td className="p-3 md:p-4">
                        <div className="text-sm font-medium text-white">
                          {user.username || user.email}
                        </div>
                        <div className="text-[10px] md:text-xs text-white/40 truncate max-w-[200px] md:max-w-none">
                          {user.email}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3 md:p-4 text-center">
                        {banned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            Deactivated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 md:p-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {banned ? (
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  type: "reactivate",
                                  userId: user.id,
                                  email: user.email!,
                                })
                              }
                              disabled={isPending && actionTarget === user.id}
                              className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-medium rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  type: "deactivate",
                                  userId: user.id,
                                  email: user.email!,
                                })
                              }
                              disabled={isPending && actionTarget === user.id}
                              className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-medium rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: "reset",
                                userId: user.id,
                                email: user.email!,
                              })
                            }
                            disabled={isPending && actionTarget === user.id}
                            className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-medium rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-white/40 text-right">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">
              {confirmAction.type === "deactivate"
                ? "Deactivate User"
                : confirmAction.type === "reactivate"
                  ? "Reactivate User"
                  : "Reset Password"}
            </h3>
            <p className="text-sm text-white/70 mb-1">
              {confirmAction.type === "deactivate"
                ? "This will permanently block the user from logging in."
                : confirmAction.type === "reactivate"
                  ? "This will restore the user's access to their account."
                  : "This will generate a password recovery link for the user."}
            </p>
            <p className="text-sm text-white/50 mb-6">
              User: <strong className="text-white">{confirmAction.email}</strong>
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={isPending}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  confirmAction.type === "deactivate"
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : confirmAction.type === "reactivate"
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                }`}
              >
                {isPending ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
