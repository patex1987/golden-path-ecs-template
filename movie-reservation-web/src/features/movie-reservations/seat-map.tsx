import { Armchair, Monitor } from 'lucide-react';

import { formatSeatLabel, groupSeatsByRow } from './formatters';
import type { Screening, Seat } from './types';

interface SeatMapProps {
  readonly screening: Screening | undefined;
  readonly selectedSeatIds: readonly string[];
  readonly onSeatToggle: (seat: Seat) => void;
}

export function SeatMap({ screening, selectedSeatIds, onSeatToggle }: SeatMapProps) {
  return (
    <section className="panel seat-panel" aria-labelledby="seat-map-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Seat map</p>
          <h2 id="seat-map-title">Reserve seats</h2>
        </div>
        <Armchair aria-hidden="true" className="panel-icon" size={22} />
      </div>

      {screening === undefined ? (
        <div className="empty-state">
          <Armchair aria-hidden="true" size={28} />
          <p>Select a screening to view seats.</p>
        </div>
      ) : (
        <>
          <div className="screen">
            <Monitor aria-hidden="true" size={18} />
            Screen
          </div>

          <div className="seat-grid" aria-label="Auditorium seats">
            {groupSeatsByRow(screening.seats).map(([row, seats]) => (
              <div className="seat-row" key={row}>
                <span className="seat-row__label" aria-hidden="true">
                  {row}
                </span>
                <div className="seat-row__seats">
                  {seats.map((seat) => {
                    const isSelected = selectedSeatIds.includes(seat.id);

                    return (
                      <button
                        key={seat.id}
                        className={`seat-button ${isSelected ? 'seat-button--selected' : ''}`}
                        type="button"
                        onClick={() => onSeatToggle(seat)}
                        aria-pressed={isSelected}
                        aria-label={`Seat ${formatSeatLabel(seat)}`}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
