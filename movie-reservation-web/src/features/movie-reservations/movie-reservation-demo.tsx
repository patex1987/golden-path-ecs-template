import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Film } from 'lucide-react';

import type { GraphqlExchange } from '../../shared/api/graphql-client';
import { createDemoTraceContext, isTerminalReservationStatus } from '../../shared/observability/trace-context';
import { CatalogPanel } from './catalog-panel';
import { DiagnosticsPanel } from './diagnostics-panel';
import {
  fetchCatalog,
  fetchReservationResult,
  fetchReservationStatus,
  requestReservation,
} from './movie-reservation-api';
import { ReservationPanel } from './reservation-panel';
import { ScreeningPanel } from './screening-panel';
import { SeatMap } from './seat-map';
import type { Catalog, Movie, Reservation, ReservationRequest, Screening, Seat } from './types';

type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly catalog: Catalog }
  | { readonly status: 'error'; readonly message: string };

const maxPollAttempts = 24;
const pollDelayMs = 650;

export function MovieReservationDemo() {
  const [workflow, setWorkflow] = useState(() => createDemoTraceContext());
  const [catalogState, setCatalogState] = useState<CatalogState>({ status: 'loading' });
  const [selectedMovieId, setSelectedMovieId] = useState<string>();
  const [selectedScreeningId, setSelectedScreeningId] = useState<string>();
  const [selectedSeatIds, setSelectedSeatIds] = useState<readonly string[]>([]);
  const [reservationRequest, setReservationRequest] = useState<ReservationRequest>();
  const [reservationResult, setReservationResult] = useState<Reservation>();
  const [workflowError, setWorkflowError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [latestExchange, setLatestExchange] = useState<GraphqlExchange>();
  const [exchanges, setExchanges] = useState<readonly GraphqlExchange[]>([]);
  const pollRunIdRef = useRef(0);

  const catalog = catalogState.status === 'success' ? catalogState.catalog : undefined;
  const selectedMovie = useMemo(
    () => catalog?.movies.find((movie) => movie.id === selectedMovieId),
    [catalog?.movies, selectedMovieId],
  );
  const movieScreenings = useMemo(
    () => catalog?.screenings.filter((screening) => screening.movieId === selectedMovieId) ?? [],
    [catalog?.screenings, selectedMovieId],
  );
  const selectedScreening = useMemo(
    () => movieScreenings.find((screening) => screening.id === selectedScreeningId),
    [movieScreenings, selectedScreeningId],
  );
  const selectedSeats = useMemo(
    () => selectedScreening?.seats.filter((seat) => selectedSeatIds.includes(seat.id)) ?? [],
    [selectedScreening?.seats, selectedSeatIds],
  );

  const recordExchange = useCallback((exchange: GraphqlExchange) => {
    setLatestExchange(exchange);
    setExchanges((currentExchanges) => [exchange, ...currentExchanges].slice(0, 8));
  }, []);

  const resetReservationState = useCallback(() => {
    pollRunIdRef.current += 1;
    setSelectedSeatIds([]);
    setReservationRequest(undefined);
    setReservationResult(undefined);
    setWorkflowError(undefined);
    setIsSubmitting(false);
    setIsPolling(false);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogState({ status: 'loading' });
    setWorkflowError(undefined);

    try {
      const loadedCatalog = await fetchCatalog({
        workflow,
        onExchange: recordExchange,
      });

      setCatalogState({ status: 'success', catalog: loadedCatalog });
      setSelectedMovieId((currentMovieId) => currentMovieId ?? loadedCatalog.movies[0]?.id);
      setSelectedScreeningId((currentScreeningId) => {
        if (currentScreeningId !== undefined) {
          return currentScreeningId;
        }

        const firstMovieId = loadedCatalog.movies[0]?.id;
        return loadedCatalog.screenings.find((screening) => screening.movieId === firstMovieId)?.id;
      });
    } catch (error) {
      setCatalogState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Catalog request failed',
      });
    }
  }, [recordExchange, workflow]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleMovieSelect = useCallback(
    (movieId: string) => {
      const nextScreening = catalog?.screenings.find((screening) => screening.movieId === movieId);

      setSelectedMovieId(movieId);
      setSelectedScreeningId(nextScreening?.id);
      resetReservationState();
    },
    [catalog?.screenings, resetReservationState],
  );

  const handleScreeningSelect = useCallback(
    (screeningId: string) => {
      setSelectedScreeningId(screeningId);
      resetReservationState();
    },
    [resetReservationState],
  );

  const handleSeatToggle = useCallback((seat: Seat) => {
    setSelectedSeatIds((currentSeatIds) => {
      if (currentSeatIds.includes(seat.id)) {
        return currentSeatIds.filter((seatId) => seatId !== seat.id);
      }

      return [...currentSeatIds, seat.id];
    });
    setReservationRequest(undefined);
    setReservationResult(undefined);
    setWorkflowError(undefined);
  }, []);

  const pollReservation = useCallback(
    async (requestId: string, runId: number) => {
      setIsPolling(true);

      try {
        for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
          await delay(pollDelayMs);

          if (pollRunIdRef.current !== runId) {
            return;
          }

          const nextRequest = await fetchReservationStatus({
            workflow,
            requestId,
            onExchange: recordExchange,
          });

          if (nextRequest === null) {
            throw new Error(`Reservation request ${requestId} was not found`);
          }

          setReservationRequest(nextRequest);

          if (isTerminalReservationStatus(nextRequest.status)) {
            if (nextRequest.status === 'CONFIRMED') {
              const result = await fetchReservationResult({
                workflow,
                requestId,
                onExchange: recordExchange,
              });

              if (pollRunIdRef.current === runId && result !== null) {
                setReservationResult(result);
              }
            }

            return;
          }
        }

        setWorkflowError('Polling stopped before the request reached a terminal state.');
      } catch (error) {
        if (pollRunIdRef.current === runId) {
          setWorkflowError(error instanceof Error ? error.message : 'Reservation polling failed');
        }
      } finally {
        if (pollRunIdRef.current === runId) {
          setIsPolling(false);
        }
      }
    },
    [recordExchange, workflow],
  );

  const handleSubmitReservation = useCallback(async () => {
    if (selectedScreening === undefined || selectedSeatIds.length === 0) {
      return;
    }

    const runId = pollRunIdRef.current + 1;
    pollRunIdRef.current = runId;
    setIsSubmitting(true);
    setWorkflowError(undefined);
    setReservationRequest(undefined);
    setReservationResult(undefined);

    try {
      const request = await requestReservation({
        workflow,
        screeningId: selectedScreening.id,
        seatIds: selectedSeatIds,
        onExchange: recordExchange,
      });

      if (pollRunIdRef.current !== runId) {
        return;
      }

      setReservationRequest(request);

      if (isTerminalReservationStatus(request.status)) {
        if (request.status === 'CONFIRMED') {
          const result = await fetchReservationResult({
            workflow,
            requestId: request.id,
            onExchange: recordExchange,
          });
          setReservationResult(result ?? undefined);
        }
        return;
      }

      await pollReservation(request.id, runId);
    } catch (error) {
      if (pollRunIdRef.current === runId) {
        setWorkflowError(error instanceof Error ? error.message : 'Reservation request failed');
      }
    } finally {
      if (pollRunIdRef.current === runId) {
        setIsSubmitting(false);
      }
    }
  }, [pollReservation, recordExchange, selectedScreening, selectedSeatIds, workflow]);

  const handleNewWorkflow = useCallback(() => {
    pollRunIdRef.current += 1;
    setWorkflow(createDemoTraceContext());
    setLatestExchange(undefined);
    setExchanges([]);
    setReservationRequest(undefined);
    setReservationResult(undefined);
    setSelectedSeatIds([]);
    setWorkflowError(undefined);
    setIsSubmitting(false);
    setIsPolling(false);
  }, []);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-mark" aria-hidden="true">
          <Film size={24} />
        </div>
        <div>
          <p className="eyebrow">Golden Path Cinema</p>
          <h1>Reservation control room</h1>
        </div>
        <div className="signal-pill">
          <Activity aria-hidden="true" size={16} />
          Observable workflow
        </div>
      </header>

      {catalogState.status === 'error' ? (
        <div className="page-alert" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          {catalogState.message}
        </div>
      ) : null}

      <div className="workspace-grid">
        <CatalogPanel
          catalog={catalog}
          isLoading={catalogState.status === 'loading'}
          selectedMovieId={selectedMovieId}
          onMovieSelect={handleMovieSelect}
          onReload={loadCatalog}
        />

        <div className="center-stack">
          <ScreeningPanel
            movie={selectedMovie}
            screenings={movieScreenings}
            selectedScreeningId={selectedScreeningId}
            onScreeningSelect={handleScreeningSelect}
          />
          <SeatMap screening={selectedScreening} selectedSeatIds={selectedSeatIds} onSeatToggle={handleSeatToggle} />
        </div>

        <div className="right-stack">
          <ReservationPanel
            movie={selectedMovie}
            screening={selectedScreening}
            selectedSeats={selectedSeats}
            reservationRequest={reservationRequest}
            reservationResult={reservationResult}
            isSubmitting={isSubmitting}
            isPolling={isPolling}
            error={workflowError}
            onSubmit={handleSubmitReservation}
            onReset={resetReservationState}
          />
          <DiagnosticsPanel
            workflow={workflow}
            latestExchange={latestExchange}
            exchanges={exchanges}
            reservationRequest={reservationRequest}
            onNewWorkflow={handleNewWorkflow}
          />
        </div>
      </div>
    </main>
  );
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
