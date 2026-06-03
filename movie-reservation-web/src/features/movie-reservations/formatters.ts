import type { Seat } from './types';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  day: 'numeric',
});

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function formatScreeningTime(startsAt: string): string {
  return dateTimeFormatter.format(new Date(startsAt));
}

export function formatShortId(id: string): string {
  if (id.length <= 12) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function formatSeatLabel(seat: Seat): string {
  return `${seat.row}${seat.number}`;
}

export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function groupSeatsByRow(seats: readonly Seat[]): readonly [string, readonly Seat[]][] {
  const rows = new Map<string, Seat[]>();

  for (const seat of seats) {
    rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);
  }

  return Array.from(rows.entries()).map(([row, rowSeats]) => [
    row,
    [...rowSeats].sort((firstSeat, secondSeat) => firstSeat.number - secondSeat.number),
  ]);
}
