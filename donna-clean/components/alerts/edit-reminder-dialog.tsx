"use client";

import { useState, useTransition, useEffect } from "react";
import { updateReminder, deleteReminder } from "@/app/reminders/actions";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  category: string;
  frequency: string;
}

interface EditReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reminder: Reminder | null;
}

export function EditReminderDialog({ isOpen, onClose, onSuccess, reminder }: EditReminderDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    category: "bills",
    frequency: "one_time",
  });

  useEffect(() => {
    if (reminder) {
      setFormData({
        title: reminder.title,
        description: reminder.description || "",
        due_date: reminder.due_date,
        category: reminder.category,
        frequency: reminder.frequency,
      });
    }
  }, [reminder]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reminder) return;

    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await updateReminder(reminder.id, data);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const handleDelete = () => {
    if (!reminder) return;
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    startTransition(async () => {
      const result = await deleteReminder(reminder.id);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  if (!isOpen || !reminder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 backdrop-blur-[10px]" style={{ background: 'rgba(15,15,35,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit Reminder</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="edit-title" className="mb-1 block text-sm font-medium text-white/70">
              Title *
            </label>
            <input
              type="text"
              id="edit-title"
              name="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 bg-white/[0.08] border border-white/[0.15] focus:border-[#8b5cf6]"
              placeholder="e.g., Electricity Bill"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="edit-category" className="mb-1 block text-sm font-medium text-white/70">
              Category *
            </label>
            <select
              id="edit-category"
              name="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 bg-white/[0.08] border border-white/[0.15] focus:border-[#8b5cf6]"
            >
              <option value="bills">Bills</option>
              <option value="task">Task</option>
              <option value="advance_settlement">Advance Settlement</option>
              <option value="others">Others</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="edit-due_date" className="mb-1 block text-sm font-medium text-white/70">
              Due Date *
            </label>
            <input
              type="date"
              id="edit-due_date"
              name="due_date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 bg-white/[0.08] border border-white/[0.15] focus:border-[#8b5cf6]"
              required
            />
          </div>

          {/* Frequency */}
          <div>
            <label htmlFor="edit-frequency" className="mb-1 block text-sm font-medium text-white/70">
              Frequency *
            </label>
            <select
              id="edit-frequency"
              name="frequency"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 bg-white/[0.08] border border-white/[0.15] focus:border-[#8b5cf6]"
            >
              <option value="one_time">One Time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-white/70">
              Description (optional)
            </label>
            <textarea
              id="edit-description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 bg-white/[0.08] border border-white/[0.15] focus:border-[#8b5cf6]"
              rows={3}
              placeholder="Add notes..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-[#ef4444] bg-transparent px-4 py-2 text-[#ef4444] transition-colors hover:bg-[rgba(239,68,68,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-white/[0.08] border border-white/[0.15] px-4 py-2 text-white transition-colors hover:bg-white/[0.12]"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#8b5cf6] px-4 py-2 text-white transition-colors hover:bg-[#7c3aed] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
