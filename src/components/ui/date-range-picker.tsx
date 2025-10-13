import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';

export type DateRangeValue = {
  from: string;
  to: string;
};

export type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  disabled?: boolean;
  className?: string;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (value: number) => value.toString().padStart(2, '0');

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parts = value.split('-').map((part) => Number(part));
  if (parts.length !== 3) {
    return null;
  }

  const [year, month, day] = parts;
  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isBefore = (left: Date, right: Date) => left.getTime() < right.getTime();

const isAfter = (left: Date, right: Date) => left.getTime() > right.getTime();

const buildMonthMatrix = (anchor: Date) => {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startDay = firstOfMonth.getDay();

  const matrix: Array<Array<{ date: Date; inCurrentMonth: boolean }>> = [];
  const current = new Date(firstOfMonth);
  current.setDate(current.getDate() - startDay);

  for (let week = 0; week < 6; week++) {
    const row: Array<{ date: Date; inCurrentMonth: boolean }> = [];
    for (let day = 0; day < 7; day++) {
      row.push({
        date: new Date(current),
        inCurrentMonth: current.getMonth() === anchor.getMonth(),
      });
      current.setDate(current.getDate() + 1);
    }
    matrix.push(row);
  }

  return matrix;
};

const ensureRangeOrder = (from: Date | null, to: Date | null) => {
  if (!from || !to) {
    return { from, to };
  }
  if (isAfter(from, to)) {
    return { from: to, to: from };
  }
  return { from, to };
};

export function DateRangePicker({ value, onChange, disabled, className }: DateRangePickerProps) {
  const fromDate = useMemo(() => parseIsoDate(value.from), [value.from]);
  const toDate = useMemo(() => parseIsoDate(value.to), [value.to]);

  const initialMonth = fromDate ?? toDate ?? new Date();
  const [viewMonth, setViewMonth] = useState(new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const { from: orderedFrom, to: orderedTo } = ensureRangeOrder(fromDate, toDate);

  const handleDaySelect = (date: Date) => {
    if (disabled) {
      return;
    }

    if (!orderedFrom || (orderedFrom && orderedTo)) {
      onChange({ from: toIsoDate(date), to: '' });
      return;
    }

    if (isBefore(date, orderedFrom)) {
      onChange({ from: toIsoDate(date), to: toIsoDate(orderedFrom) });
      return;
    }

    if (isSameDay(date, orderedFrom)) {
      onChange({ from: toIsoDate(date), to: toIsoDate(date) });
      return;
    }

    onChange({ from: toIsoDate(orderedFrom), to: toIsoDate(date) });
  };

  const handleInputChange = (key: keyof DateRangeValue) => (event: ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    const nextValue = event.target.value;
    const next = {
      from: key === 'from' ? nextValue : value.from,
      to: key === 'to' ? nextValue : value.to,
    } as DateRangeValue;
    onChange(next);

    const parsed = parseIsoDate(nextValue);
    if (parsed) {
      setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  const handlePreviousMonth = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const handleClear = () => {
    if (disabled) {
      return;
    }
    onChange({ from: '', to: '' });
  };

  const matrix = useMemo(() => buildMonthMatrix(viewMonth), [viewMonth]);

  const isInRange = (date: Date) => {
    if (!orderedFrom) {
      return false;
    }

    if (orderedFrom && !orderedTo && hoverDate) {
      const { from, to } = ensureRangeOrder(orderedFrom, hoverDate);
      if (!from || !to) {
        return false;
      }
      return date >= from && date <= to;
    }

    if (orderedFrom && orderedTo) {
      return date >= orderedFrom && date <= orderedTo;
    }

    return false;
  };

  const isRangeEdge = (date: Date) => {
    if (!orderedFrom) {
      return false;
    }
    if (orderedTo) {
      return isSameDay(date, orderedFrom) || isSameDay(date, orderedTo);
    }
    if (hoverDate) {
      const { from, to } = ensureRangeOrder(orderedFrom, hoverDate);
      if (!from || !to) {
        return false;
      }
      return isSameDay(date, from) || isSameDay(date, to);
    }
    return isSameDay(date, orderedFrom);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Button variant="ghost" type="button" size="icon" onClick={handlePreviousMonth} disabled={disabled}>
          <span className="sr-only">Previous month</span>
          <span aria-hidden="true">&lt;</span>
        </Button>
        <div className="text-sm font-medium text-slate-700">
          {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <Button variant="ghost" type="button" size="icon" onClick={handleNextMonth} disabled={disabled}>
          <span className="sr-only">Next month</span>
          <span aria-hidden="true">&gt;</span>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {matrix.map((week, weekIndex) =>
          week.map(({ date, inCurrentMonth }) => {
            const iso = toIsoDate(date);
            const highlighted = isInRange(date);
            const edge = isRangeEdge(date);
            const isSelected =
              (orderedFrom && isSameDay(date, orderedFrom)) ||
              (orderedTo && isSameDay(date, orderedTo));

            return (
              <button
                key={`${weekIndex}-${iso}`}
                type="button"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors',
                  !inCurrentMonth && 'text-slate-300',
                  highlighted && 'bg-[#E2F3E1] text-[#1F4B1D]',
                  edge && 'border border-[#3D753A] bg-[#CDEACB] font-semibold',
                  isSelected && 'font-semibold text-[#1F4B1D]',
                  !highlighted && !edge && 'hover:bg-slate-100',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
                onMouseEnter={() => setHoverDate(date)}
                onMouseLeave={() => setHoverDate(null)}
                onClick={() => handleDaySelect(date)}
                disabled={disabled}
              >
                {date.getDate()}
              </button>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From</label>
          <Input type="date" value={value.from} onChange={handleInputChange('from')} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</label>
          <Input type="date" value={value.to} onChange={handleInputChange('to')} disabled={disabled} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" type="button" size="sm" onClick={handleClear} disabled={disabled}>
          Clear range
        </Button>
      </div>
    </div>
  );
}
