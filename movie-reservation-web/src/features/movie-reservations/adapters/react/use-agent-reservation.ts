import { useCallback, useState } from "react";

import {
  requestAgentReservation,
  type AgentReservationCallResult,
  type DemoFault,
} from "../../../../platform/api/agent-client";
import type { DemoTraceContext } from "../../../../platform/observability/trace-context";
import { reportFrontendError } from "../errors/user-facing-errors";

export interface AgentPromptPreset {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly seatPreference: string;
  readonly fault: DemoFault;
}

export const agentPromptPresets: readonly AgentPromptPreset[] = [
  {
    id: "happy",
    label: "Happy path",
    prompt: "Find me an exciting platform-themed movie and reserve a good available aisle seat.",
    seatPreference: "aisle",
    fault: "none",
  },
  {
    id: "slow",
    label: "Slow dependency",
    prompt: "Recommend an exciting movie, but trigger the slow recommendation path so we can inspect latency.",
    seatPreference: "aisle",
    fault: "slow-recommendation",
  },
  {
    id: "error",
    label: "Failing dependency",
    prompt: "Try to recommend a movie while the recommendation service is failing, then explain what broke.",
    seatPreference: "aisle",
    fault: "recommendation-error",
  },
];

interface UseAgentReservationInput {
  readonly workflow: DemoTraceContext;
  readonly onCompleted?: (result: AgentReservationCallResult) => void;
}

export interface AgentReservationPanelState {
  readonly prompt: string;
  readonly seatPreference: string;
  readonly fault: DemoFault;
  readonly isRunning: boolean;
  readonly error: string | undefined;
  readonly latestResult: AgentReservationCallResult | undefined;
  readonly recentResults: readonly AgentReservationCallResult[];
  readonly setPrompt: (prompt: string) => void;
  readonly setSeatPreference: (seatPreference: string) => void;
  readonly setFault: (fault: DemoFault) => void;
  readonly applyPreset: (preset: AgentPromptPreset) => void;
  readonly runAgent: () => Promise<void>;
  readonly clearAgentState: () => void;
}

/**
 * React adapter for the local demo agent endpoint.
 */
export function useAgentReservation({
  workflow,
  onCompleted,
}: UseAgentReservationInput): AgentReservationPanelState {
  const [prompt, setPrompt] = useState(agentPromptPresets[0]?.prompt ?? "");
  const [seatPreference, setSeatPreference] = useState(
    agentPromptPresets[0]?.seatPreference ?? "aisle",
  );
  const [fault, setFault] = useState<DemoFault>(
    agentPromptPresets[0]?.fault ?? "none",
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [recentResults, setRecentResults] = useState<
    readonly AgentReservationCallResult[]
  >([]);

  const latestResult = recentResults[0];

  const applyPreset = useCallback((preset: AgentPromptPreset) => {
    setPrompt(preset.prompt);
    setSeatPreference(preset.seatPreference);
    setFault(preset.fault);
    setError(undefined);
  }, []);

  const clearAgentState = useCallback(() => {
    setError(undefined);
    setRecentResults([]);
  }, []);

  const runAgent = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    const trimmedSeatPreference = seatPreference.trim();

    if (trimmedPrompt.length === 0 || trimmedSeatPreference.length === 0) {
      setError("Enter a movie prompt and seat preference before running the agent.");
      return;
    }

    setIsRunning(true);
    setError(undefined);

    try {
      const result = await requestAgentReservation({
        workflow,
        command: {
          moviePreference: trimmedPrompt,
          seatPreference: trimmedSeatPreference,
          fault,
        },
      });

      setRecentResults((currentResults) => [result, ...currentResults].slice(0, 4));
      onCompleted?.(result);
    } catch (agentError) {
      reportFrontendError("Agent request failed", agentError);
      setError(
        agentError instanceof Error
          ? agentError.message
          : "Agent request failed before a structured response was returned.",
      );
    } finally {
      setIsRunning(false);
    }
  }, [fault, onCompleted, prompt, seatPreference, workflow]);

  return {
    prompt,
    seatPreference,
    fault,
    isRunning,
    error,
    latestResult,
    recentResults,
    setPrompt,
    setSeatPreference,
    setFault,
    applyPreset,
    runAgent,
    clearAgentState,
  };
}
