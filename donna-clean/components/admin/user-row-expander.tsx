"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

type UserStat = {
  user_id: string;
  username: string;
  business_name: string | null;
  role: string;
  created_at: string;
  last_sign_in: string | null;
  total_entries: number;
  cash_in_count: number;
  cash_out_count: number;
  credit_count: number;
  advance_count: number;
  last_entry_date: string | null;
  total_settlements: number;
  total_parties: number;
  total_ai_chats: number;
  last_ai_chat: string | null;
  active_days_30d: number;
};

function formatDaysSince(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

export function UserRowExpander({ user }: { user: UserStat }) {
  const [expanded, setExpanded] = useState(false);

  const daysSinceEntry = user.last_entry_date
    ? Math.floor(
        (Date.now() - new Date(user.last_entry_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const isActive = daysSinceEntry !== null && daysSinceEntry < 7;
  const isInactive = daysSinceEntry === null || daysSinceEntry > 30;

  const recentAiChat =
    user.last_ai_chat &&
    new Date(user.last_ai_chat) >=
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Active days color
  let activeDaysColor: string;
  if (user.active_days_30d >= 15) {
    activeDaysColor =
      "text-green-400 bg-green-500/10 border-green-500/20";
  } else if (user.active_days_30d >= 5) {
    activeDaysColor =
      "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  } else {
    activeDaysColor = "text-red-400 bg-red-500/10 border-red-500/20";
  }

  return (
    <>
      {/* Main row */}
      <tr
        className="border-t border-purple-500/20 hover:bg-purple-900/10 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Username */}
        <td className="p-4">
          <div className="text-sm font-medium text-white">
            {user.username}
          </div>
          {user.role === "admin" && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
              Admin
            </span>
          )}
          {user.business_name && (
            <div className="text-xs text-white/40">{user.business_name}</div>
          )}
        </td>

        {/* Days Since Signup */}
        <td className="p-4 text-sm text-white/80">
          {formatDaysSince(user.created_at)}
        </td>

        {/* Last Login */}
        <td className="p-4 text-sm">
          {user.last_sign_in ? (
            <div>
              <div className="text-white/80">
                {format(new Date(user.last_sign_in), "MMM dd, HH:mm")}
              </div>
              <div className="text-xs text-white/40">
                {formatDistanceToNow(new Date(user.last_sign_in), {
                  addSuffix: true,
                })}
              </div>
            </div>
          ) : (
            <span className="text-white/40">Never</span>
          )}
        </td>

        {/* Entries */}
        <td className="p-4 text-right">
          <span className="font-semibold text-lg text-white">
            {user.total_entries}
          </span>
        </td>

        {/* Active Days */}
        <td className="p-4 text-center">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${activeDaysColor}`}
          >
            {user.active_days_30d}/30
          </span>
        </td>

        {/* Status */}
        <td className="p-4 text-center">
          {isActive ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              <Activity className="h-3 w-3" />
              Active
            </span>
          ) : isInactive ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="h-3 w-3" />
              Inactive
            </span>
          ) : (
            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              Moderate
            </span>
          )}
        </td>

        {/* Expand toggle */}
        <td className="p-4 text-center">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-white/40" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40" />
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-t border-purple-500/10 bg-purple-900/5">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-7 gap-4 text-xs">
              <div>
                <p className="text-white/50 mb-1">Cash IN</p>
                <p className="text-green-400 font-semibold text-sm">
                  {user.cash_in_count || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-1">Cash OUT</p>
                <p className="text-red-400 font-semibold text-sm">
                  {user.cash_out_count || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-1">Credit</p>
                <p className="text-amber-400 font-semibold text-sm">
                  {user.credit_count || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-1">Advance</p>
                <p className="text-blue-400 font-semibold text-sm">
                  {user.advance_count || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-1">Settlements</p>
                <p className="text-white font-semibold text-sm">
                  {user.total_settlements || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-1">Parties</p>
                <p className="text-white font-semibold text-sm">
                  {user.total_parties || "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-1">AI Chats</p>
                <p className="text-white font-semibold text-sm">
                  {user.total_ai_chats || "\u2014"}
                  {recentAiChat && (
                    <span
                      className="ml-1 inline-block w-2 h-2 rounded-full bg-cyan-400"
                      title="Active in last 7 days"
                    />
                  )}
                </p>
                {user.last_ai_chat && (
                  <p className="text-white/30 mt-0.5">
                    {formatDistanceToNow(new Date(user.last_ai_chat), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
