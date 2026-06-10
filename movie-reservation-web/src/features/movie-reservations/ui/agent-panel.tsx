import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";

import type {
  AgentReservationCallResult,
  DemoFault,
} from "../../../platform/api/agent-client";
import type { DemoTraceContext } from "../../../platform/observability/trace-context";
import {
  agentPromptPresets,
  useAgentReservation,
} from "../adapters/react/use-agent-reservation";
import { formatDurationMs, formatShortId } from "./formatters";

interface AgentPanelProps {
  readonly workflow: DemoTraceContext;
  readonly onNewWorkflow: () => void;
  readonly onAgentCompleted: (result: AgentReservationCallResult) => void;
}

const faultOptions: readonly {
  readonly value: DemoFault;
  readonly label: string;
}[] = [
  { value: "none", label: "Normal" },
  { value: "slow-recommendation", label: "Slow recommendation" },
  { value: "recommendation-error", label: "Recommendation error" },
];

/**
 * Local demo console for the Python agent workflow.
 */
export function AgentPanel({
  workflow,
  onNewWorkflow,
  onAgentCompleted,
}: AgentPanelProps) {
  const agent = useAgentReservation({
    workflow,
    onCompleted: onAgentCompleted,
  });
  const canRun = !agent.isRunning && agent.prompt.trim().length > 0;

  return (
    <section className="panel agent-panel" aria-labelledby="agent-panel-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agent workflow</p>
          <h2 id="agent-panel-title">Reservation agent</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => {
            agent.clearAgentState();
            onNewWorkflow();
          }}
          aria-label="Start a new correlation boundary"
        >
          <RotateCcw aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="correlation-boundary">
        <div className="correlation-boundary__marker" aria-hidden="true">
          <Activity size={18} />
        </div>
        <div className="correlation-boundary__body">
          <span>Correlation boundary</span>
          <code>{workflow.correlationId}</code>
          <small>Browser to agent to MCP tools to backend services</small>
        </div>
        <CopyButton
          label="correlation id"
          value={workflow.correlationId}
        />
      </div>

      <div className="trace-pair" aria-label="Workflow trace handles">
        <TraceHandle label="Trace" value={workflow.traceId} />
        <TraceHandle label="Frontend span" value={workflow.frontendSpanId} />
      </div>

      <div className="prompt-presets" aria-label="Demo prompt suggestions">
        {agentPromptPresets.map((preset) => (
          <button
            key={preset.id}
            className="prompt-chip"
            type="button"
            onClick={() => agent.applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form
        className="agent-form"
        onSubmit={(event) => {
          event.preventDefault();
          void agent.runAgent();
        }}
      >
        <label className="field-group">
          <span>Prompt</span>
          <textarea
            rows={4}
            value={agent.prompt}
            onChange={(event) => agent.setPrompt(event.currentTarget.value)}
          />
        </label>

        <div className="agent-form__controls">
          <label className="field-group">
            <span>Seat</span>
            <input
              value={agent.seatPreference}
              onChange={(event) =>
                agent.setSeatPreference(event.currentTarget.value)
              }
            />
          </label>
          <label className="field-group">
            <span>Fault</span>
            <select
              value={agent.fault}
              onChange={(event) =>
                agent.setFault(event.currentTarget.value as DemoFault)
              }
            >
              {faultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {agent.error !== undefined ? (
          <div className="error-box" role="alert">
            {agent.error}
          </div>
        ) : null}

        <button className="primary-button" type="submit" disabled={!canRun}>
          {agent.isRunning ? (
            <Loader2 aria-hidden="true" size={18} className="spin" />
          ) : (
            <Send aria-hidden="true" size={18} />
          )}
          Ask agent
        </button>
      </form>

      {agent.isRunning ? (
        <div className="agent-run-card agent-run-card--active" aria-live="polite">
          <Loader2 aria-hidden="true" size={18} className="spin" />
          <div>
            <strong>Agent is calling MCP tools</strong>
            <small>{selectedFaultLabel(agent.fault)}</small>
          </div>
        </div>
      ) : null}

      {agent.latestResult !== undefined ? (
        <AgentResultCard result={agent.latestResult} />
      ) : (
        <div className="empty-state empty-state--compact">
          <Bot aria-hidden="true" size={24} />
          <p>Agent results will appear here after the first run.</p>
        </div>
      )}
    </section>
  );
}

interface AgentResultCardProps {
  readonly result: AgentReservationCallResult;
}

function AgentResultCard({ result }: AgentResultCardProps) {
  if (!result.ok) {
    return (
      <div className="agent-result agent-result--error" role="status">
        <div className="agent-result__heading">
          <AlertTriangle aria-hidden="true" size={18} />
          <strong>{result.error.error}</strong>
        </div>
        <p>{result.error.message}</p>
        <AgentRunMeta result={result} />
      </div>
    );
  }

  return (
    <div className="agent-result agent-result--success" role="status">
      <div className="agent-result__heading">
        <CheckCircle2 aria-hidden="true" size={18} />
        <strong>{result.response.outcome}</strong>
      </div>
      <p>{result.response.finalAnswer}</p>
      <div className="agent-summary-grid">
        <SummaryValue label="Movie" value={readDisplayValue(result.response.movie, "title")} />
        <SummaryValue label="Seat" value={formatAgentSeat(result.response.seat)} />
        <SummaryValue
          label="Request"
          value={
            result.response.reservationRequestId === null
              ? "No request"
              : formatShortId(result.response.reservationRequestId)
          }
        />
        <SummaryValue
          label="Status"
          value={result.response.reservationStatus ?? "No status"}
        />
      </div>
      <div className="tool-result-list" aria-label="Agent tool results">
        {result.response.toolResults.map((toolResult) => (
          <span key={`${toolResult.toolName}-${toolResult.outcome}`}>
            {toolResult.toolName}: {toolResult.outcome}
          </span>
        ))}
      </div>
      <AgentRunMeta result={result} />
    </div>
  );
}

interface AgentRunMetaProps {
  readonly result: AgentReservationCallResult;
}

function AgentRunMeta({ result }: AgentRunMetaProps) {
  const trace = result.ok ? result.response.trace : result.error.trace;
  const workflowId = result.ok
    ? result.response.workflowId
    : result.error.workflowId;

  return (
    <div className="agent-run-meta">
      <span>HTTP {result.statusCode}</span>
      <span>{formatDurationMs(result.durationMs)}</span>
      <span>Workflow {formatShortId(workflowId)}</span>
      <span>Request {formatShortId(trace.requestId)}</span>
    </div>
  );
}

interface SummaryValueProps {
  readonly label: string;
  readonly value: string;
}

function SummaryValue({ label, value }: SummaryValueProps) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface TraceHandleProps {
  readonly label: string;
  readonly value: string;
}

function TraceHandle({ label, value }: TraceHandleProps) {
  return (
    <div className="trace-handle">
      <span>{label}</span>
      <code>{formatShortId(value)}</code>
      <CopyButton label={`${label.toLowerCase()} id`} value={value} />
    </div>
  );
}

interface CopyButtonProps {
  readonly label: string;
  readonly value: string;
}

function CopyButton({ label, value }: CopyButtonProps) {
  return (
    <button
      className="copy-button"
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
      }}
      aria-label={`Copy ${label}`}
    >
      <Copy aria-hidden="true" size={14} />
    </button>
  );
}

function selectedFaultLabel(fault: DemoFault): string {
  return faultOptions.find((option) => option.value === fault)?.label ?? fault;
}

function readDisplayValue(
  record: Record<string, unknown> | null,
  fieldName: string,
): string {
  const value = record?.[fieldName];

  return typeof value === "string" && value.length > 0 ? value : "Not returned";
}

function formatAgentSeat(record: Record<string, unknown> | null): string {
  const row = record?.row;
  const number = record?.number;

  if (typeof row === "string" && (typeof number === "number" || typeof number === "string")) {
    return `${row}${number}`;
  }

  return "Not returned";
}
