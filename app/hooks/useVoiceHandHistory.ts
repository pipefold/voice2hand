import { useState, useEffect, useCallback } from "react";
import { OpenHandHistory } from "@/app/lib/OpenHandHistory";
import { generateHandHistoryPatch } from "@/app/actions/generate-hand-history-patch";
import { applyPatch, Operation } from "rfc6902";

export function useVoiceHandHistory() {
  const [history, setHistory] = useState(
    () =>
      new OpenHandHistory({ startDateUTC: "2023-01-01T00:00:00.000Z" }).toJSON()
        .ohh
  );
  const [patchHistory, setPatchHistory] = useState<
    {
      command: string;
      patches: any;
      timestamp: string;
      error?: any;
    }[]
  >([]);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Queue watcher
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing || processingQueue.length === 0) return;

      setIsProcessing(true);
      const command = processingQueue[0];

      try {
        const context = {
          table_size: history.table_size,
          players: history.players,
          dealer_seat: history.dealer_seat,
          rounds: history.rounds,
        };

        const result = await generateHandHistoryPatch(
          command,
          transcript,
          context
        );

        if (result.success && result.patches) {
          // Apply patch
          const tempHistory = JSON.parse(JSON.stringify(history));
          const results = applyPatch(
            tempHistory,
            result.patches as Operation[]
          );
          const firstError = results.find((r) => r !== null);

          setPatchHistory((prev) => [
            {
              command,
              patches: result.patches,
              timestamp: new Date().toLocaleTimeString(),
              error: firstError,
            },
            ...prev,
          ]);

          // Always update transcript so context is preserved, even if patch failed
          setTranscript((prev) => [...prev, command]);

          if (firstError) {
            console.error("Patch failed:", firstError);
          } else {
            setHistory(tempHistory);
          }
        } else {
          console.warn("Failed to generate patch for:", command);

          // Track generation failures
          setPatchHistory((prev) => [
            {
              command,
              patches: null,
              timestamp: new Date().toLocaleTimeString(),
              error: result.error || "Failed to generate patch",
            },
            ...prev,
          ]);

          // Keep command in transcript so we have context
          setTranscript((prev) => [...prev, command]);
        }
      } catch (e) {
        console.error("Error processing command:", e);
      } finally {
        // Remove the processed item from queue
        setProcessingQueue((prev) => prev.slice(1));
        setIsProcessing(false);
      }
    };

    processQueue();
  }, [processingQueue, isProcessing, history, transcript]);

  const resetState = useCallback(() => {
    setHistory(new OpenHandHistory().toJSON().ohh);
    setPatchHistory([]);
    setProcessingQueue([]);
    setTranscript([]);
  }, []);

  const processCommand = useCallback((command: string) => {
    setProcessingQueue((prev) => [...prev, command]);
  }, []);

  return {
    history,
    setHistory, // Exposing this if manual override is needed, though resetState handles most
    patchHistory,
    transcript,
    isProcessing,
    resetState,
    processCommand,
  };
}

