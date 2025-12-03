"use client";

export type PeriodType = "all-time" | "this-year" | "this-month" | "custom";

interface PeriodFilterProps {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomDatesChange?: (start: Date, end: Date) => void;
}

export function PeriodFilter({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomDatesChange
}: PeriodFilterProps) {
  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PeriodType)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="all-time">All Time</option>
        <option value="this-year">This Year</option>
        <option value="this-month">This Month</option>
        <option value="custom">Custom Range</option>
      </select>

      {value === "custom" && onCustomDatesChange && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={customStart?.toISOString().split('T')[0] || ''}
            onChange={(e) => {
              const newStart = new Date(e.target.value);
              if (customEnd) onCustomDatesChange(newStart, customEnd);
            }}
            className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="date"
            value={customEnd?.toISOString().split('T')[0] || ''}
            onChange={(e) => {
              const newEnd = new Date(e.target.value);
              if (customStart) onCustomDatesChange(customStart, newEnd);
            }}
            className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}
    </div>
  );
}

export function getDateRangeForPeriod(
  period: PeriodType,
  customStart?: Date,
  customEnd?: Date
): { start: Date | null; end: Date | null } {
  const now = new Date();

  switch (period) {
    case "all-time":
      return { start: null, end: null }; // No filtering

    case "this-year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59)
      };

    case "this-month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      };

    case "custom":
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
      }
      return { start: null, end: null };
  }
}
