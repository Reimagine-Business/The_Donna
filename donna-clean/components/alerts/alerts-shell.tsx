"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { markReminderDone } from "@/app/reminders/actions";
import { EditReminderDialog } from "./edit-reminder-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { filterByDateRange, filterByCustomDateRange, type DateRange } from "@/lib/date-utils";

type FilterOption = "all" | "due_soon" | "overdue" | "completed";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  category: string;
  frequency: string;
}

interface AlertsShellProps {
  initialReminders: Reminder[];
  onAddClick?: () => void;
  onDataChange?: () => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`;
  } else if (diffDays === 0) {
    return "Due today";
  } else if (diffDays === 1) {
    return "Due tomorrow";
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getDueDateColor = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "#f87171";      // overdue = red
  if (diffDays <= 1) return "#fbbf24";      // due today/tomorrow = amber
  return "#94a3b8";                          // future = slate
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "bills":
      return "📦";
    case "task":
      return "✓";
    case "advance_settlement":
      return "💸";
    case "others":
      return "📌";
    default:
      return "📌";
  }
};

export function AlertsShell({ initialReminders, onAddClick, onDataChange }: AlertsShellProps) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>("due_soon");
  const [isPending, startTransition] = useTransition();
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("this-month");
  const [showCustomDatePickers, setShowCustomDatePickers] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<Date>();
  const [customToDate, setCustomToDate] = useState<Date>();
  const [editingId, setEditingId] = useState<string | null>(null); // Track which reminder is being edited

  // Local state for optimistic updates
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);

  // Sync when parent passes new data (e.g. React Query refetch)
  useEffect(() => {
    setReminders(initialReminders);
  }, [initialReminders]);

  // Filter reminders based on date range AND status filter
  const filteredReminders = useMemo(() => {
    // First, filter by date range
    let dateFiltered: Reminder[];
    if (dateFilter === "customize" && customFromDate && customToDate) {
      dateFiltered = filterByCustomDateRange(reminders, customFromDate, customToDate, "due_date");
    } else if (dateFilter !== "customize") {
      dateFiltered = filterByDateRange(reminders, dateFilter as DateRange, "due_date");
    } else {
      dateFiltered = reminders;
    }

    // Then, filter by status
    return dateFiltered.filter((reminder) => {
      const dueDate = new Date(reminder.due_date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (activeFilter) {
        case "all":
          return true;
        case "due_soon":
          return reminder.status === "pending" && diffDays >= 0 && diffDays <= 30;
        case "overdue":
        return reminder.status === "pending" && diffDays < 0;
      case "completed":
        return reminder.status === "completed";
      default:
        return true;
    }
    });
  }, [reminders, dateFilter, activeFilter, customFromDate, customToDate]);

  const handleMarkDone = (reminderId: string) => {
    // Optimistically update local state immediately
    setReminders((prev) =>
      prev.map((r) =>
        r.id === reminderId ? { ...r, status: "completed" } : r
      )
    );

    startTransition(async () => {
      const result = await markReminderDone(reminderId);
      if (result?.error) {
        // Revert on failure
        setReminders(initialReminders);
      } else {
        onDataChange?.();
      }
    });
  };

  const handleEdit = (reminder: Reminder) => {
    // Prevent double-clicks by checking if already editing
    if (editingId) return;

    setEditingId(reminder.id);
    setEditingReminder(reminder);
    setIsEditDialogOpen(true);

    // Clear loading state after dialog opens (instant for modal)
    setTimeout(() => setEditingId(null), 100);
  };

  const handleEditSuccess = () => {
    onDataChange?.();
  };

  return (
    <>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between mt-2 mb-3">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Need your Attention
          </h1>

          {/* Add Button */}
          <button
            onClick={onAddClick}
            className="flex items-center gap-2 text-white font-semibold transition-colors hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
            }}
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Add Reminder</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Tabs and Date Range Selector */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {(["all", "due_soon", "overdue", "completed"] as FilterOption[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className="px-2 md:px-4 py-1 md:py-2 font-medium text-[10px] md:text-sm transition-colors"
                style={
                  activeFilter === filter
                    ? {
                        background: 'rgba(168,85,247,0.15)',
                        border: '1px solid rgba(168,85,247,0.3)',
                        color: '#a855f7',
                        borderRadius: '8px',
                      }
                    : {
                        background: 'rgba(148,163,184,0.05)',
                        border: '1px solid rgba(148,163,184,0.15)',
                        color: '#94a3b8',
                        borderRadius: '8px',
                      }
                }
              >
                {filter === "all" ? "All" : filter === "due_soon" ? "Due Soon" : filter === "overdue" ? "Overdue" : "Completed"}
              </button>
            ))}
          </div>

          {/* Date Range Selector */}
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <span className="text-[10px] md:text-sm text-muted-foreground">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setShowCustomDatePickers(e.target.value === "customize");
              }}
              className="px-2 md:px-3 py-1 md:py-2 border border-border bg-secondary rounded-lg text-[10px] md:text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="this-month">📅 This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-year">This Year</option>
              <option value="last-year">Last Year</option>
              <option value="all-time">All Time</option>
              <option value="customize">Customize</option>
            </select>

            {/* Show calendar pickers when Customize is selected */}
            {showCustomDatePickers && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="px-2 md:px-3 py-1 md:py-2 border border-border bg-secondary rounded-lg text-[10px] md:text-sm text-white hover:bg-primary/80 focus:border-purple-500 focus:outline-none">
                      {customFromDate ? format(customFromDate, "MMM dd, yyyy") : "From Date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFromDate}
                      onSelect={setCustomFromDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-[10px] md:text-sm text-muted-foreground">to</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="px-2 md:px-3 py-1 md:py-2 border border-border bg-secondary rounded-lg text-[10px] md:text-sm text-white hover:bg-primary/80 focus:border-purple-500 focus:outline-none">
                      {customToDate ? format(customToDate, "MMM dd, yyyy") : "To Date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customToDate}
                      onSelect={setCustomToDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>

        {/* Reminders List */}
        <div className="space-y-2 md:space-y-3">
          {filteredReminders.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-card/50 p-4 md:p-8 text-center">
              <p className="text-xs md:text-sm text-muted-foreground">No reminders found</p>
            </div>
          ) : (
            filteredReminders.map((reminder) => (
              <div
                key={reminder.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))',
                  border: '1px solid rgba(192,132,252,0.15)',
                  borderRadius: '16px',
                  opacity: reminder.status === "completed" ? 0.6 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  {/* LEFT: dot + name + due date */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Purple dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: '#a855f7',
                        boxShadow: '0 0 6px #a855f7',
                      }}
                    />

                    {/* Name + due date stacked */}
                    <div className="flex flex-col min-w-0">
                      <span
                        className={cn(
                          "font-semibold text-sm truncate leading-tight",
                          reminder.status === "completed"
                            ? "text-muted-foreground line-through"
                            : "text-[#e9d5ff]"
                        )}
                      >
                        {reminder.title}
                      </span>
                      <span
                        className="text-xs mt-0.5"
                        style={{ color: getDueDateColor(reminder.due_date) }}
                      >
                        {formatDate(reminder.due_date)}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: action buttons */}
                  {reminder.status !== "completed" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Mark Done button */}
                      <button
                        onClick={() => handleMarkDone(reminder.id)}
                        disabled={isPending}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-[#4ade80] transition-colors hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(74,222,128,0.1)',
                          border: '1px solid rgba(74,222,128,0.3)',
                        }}
                      >
                        Done
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => handleEdit(reminder)}
                        disabled={isPending || editingId === reminder.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-[#94a3b8] transition-colors hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        style={{
                          background: 'rgba(148,163,184,0.1)',
                          border: '1px solid rgba(148,163,184,0.2)',
                        }}
                      >
                        {editingId === reminder.id ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </>
                        ) : (
                          "Edit"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <EditReminderDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingReminder(null);
        }}
        onSuccess={handleEditSuccess}
        reminder={editingReminder}
      />
    </>
  );
}
