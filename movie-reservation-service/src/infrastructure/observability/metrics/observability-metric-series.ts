import { initializeGraphqlOperationMetricSeries } from './graphql-operation-metrics';
import { initializeReservationProcessorMetricSeries } from './reservation-processor-metrics';

let metricSeriesInitialized = false;

/**
 * Initializes bounded metric series that should appear before first traffic.
 */
export function initializeObservabilityMetricSeries(): void {
  if (metricSeriesInitialized) {
    return;
  }

  metricSeriesInitialized = true;
  initializeGraphqlOperationMetricSeries();
  initializeReservationProcessorMetricSeries();
}
