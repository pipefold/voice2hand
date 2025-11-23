"use client";

import {
  LiveConnectionState,
  LiveTranscriptionEvents,
  useDeepgram,
  type LiveTranscriptionEvent,
} from "@/app/context/DeepgramContextProvider";
import {
  MicrophoneEvents,
  useMicrophone,
} from "@/app/context/MicrophoneContextProvider";
import { OpenHandHistory } from "@/app/lib/OpenHandHistory";
import { generateHandHistoryPatch } from "@/app/test-groq-json-patch/action";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyPatch, Operation } from "rfc6902";

const ENDPOINTING_MS = 500;
const UTTERANCE_END_MS = 1200;

export default function TestDeepgramGroqIntegration() {
  // --- Groq / Game State ---
  const [history, setHistory] = useState(
    () =>
      new OpenHandHistory({ startDateUTC: "2023-01-01T00:00:00.000Z" }).toJSON()
        .ohh
  );
  const [lastPatch, setLastPatch] = useState<any>(null);
  const [processingQueue, setProcessingQueue] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Deepgram / Audio State ---
  const [status, setStatus] = useState<string>("idle");
  const [transcriptText, setTranscriptText] = useState<string>("");

  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, microphoneState } =
    useMicrophone();

  const startedRef = useRef(false);
  const lastEndpointedChunkRef = useRef<string | null>(null);

  // --- Command Processing Logic ---

  const processCommand = useCallback(async (commandText: string) => {
    console.log("Processing command:", commandText);

    // We use the functional update to ensure we get the absolute latest state
    // However, we need the state *value* to pass to the AI.
    // Since this is async and queued, we rely on the 'history' state being up to date
    // when this function executes.
    // NOTE: In a real queue system, we'd need to be careful about state closure staleness.
    // Here, we will trust React's state if we manage the queue sequentially.

    // To avoid closure staleness, we might need to use a ref for the current history
    // or pass it in if we were chaining.
    // Let's use a Ref for history to be safe for the async operations

    // Actually, let's just use the current 'history' from the render scope.
    // But wait, 'processCommand' is created once? No, we need it to access latest history.
    // The useEffect handling the queue will need to depend on 'history'.
  }, []); // We'll implement the actual logic inside the effect that watches the queue

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
        };

        const result = await generateHandHistoryPatch(command, context);

        if (result.success && result.patches) {
          setLastPatch(result.patches);

          // Apply patch
          // Note: We read 'history' again here or use the functional update
          // Ideally we patch the latest state.

          setHistory((prevHistory: any) => {
            const newHistory = JSON.parse(JSON.stringify(prevHistory));
            const results = applyPatch(
              newHistory,
              result.patches as Operation[]
            );
            const firstError = results.find((r) => r !== null);
            if (firstError) {
              console.error("Patch failed:", firstError);
              return prevHistory; // Revert/Ignore if failed
            }
            return newHistory;
          });
        } else {
          console.warn("Failed to generate patch for:", command);
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
  }, [processingQueue, isProcessing, history]);

  // --- Deepgram Setup ---

  const handleStart = async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    setTranscriptText("");
    setStatus("requesting mic...");
    await setupMicrophone();

    setStatus("connecting to Deepgram...");
    await connectToDeepgram({
      model: "nova-3",
      interim_results: true,
      smart_format: true,
      endpointing: ENDPOINTING_MS,
      utterance_end_ms: UTTERANCE_END_MS,
      vad_events: true,
    });
  };

  // Event Listeners
  useEffect(() => {
    if (!microphone || !connection) return;
    if (connectionState !== LiveConnectionState.OPEN) return;

    setStatus("streaming audio...");

    const onData = (e: BlobEvent) => {
      if (e.data.size > 0) connection.send(e.data);
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const transcript = data.channel.alternatives[0]?.transcript ?? "";
      if (transcript) {
        setTranscriptText(transcript);
      }

      const hasEndpointSignal =
        (typeof data.speech_final === "boolean" && data.speech_final) ||
        (typeof data.is_final === "boolean" && data.is_final);

      if (!hasEndpointSignal) return;

      const finalLine = transcript.trim();
      if (finalLine.length === 0) return;

      const chunkKey = `${data.start}-${data.duration}-${finalLine}`;
      if (chunkKey === lastEndpointedChunkRef.current) return;

      lastEndpointedChunkRef.current = chunkKey;

      // Add to processing queue
      console.log("Endpoint detected, queuing:", finalLine);
      setProcessingQueue((prev) => [...prev, finalLine]);
    };

    // We can also listen to UtteranceEnd if we want to capture things that didn't trigger speech_final
    // but for now let's stick to speech_final/is_final from the transcript which usually carries the text.
    // UtteranceEnd often comes *after* without text payload, just a signal.

    microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);
    connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);

    startMicrophone();

    return () => {
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      connection.removeListener(
        LiveTranscriptionEvents.Transcript,
        onTranscript
      );
    };
  }, [microphone, connection, connectionState, startMicrophone]);

  const resetState = () => {
    setHistory(new OpenHandHistory().toJSON().ohh);
    setLastPatch(null);
    setProcessingQueue([]);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6">
        Deepgram Voice → Groq JSON Patch
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Voice Control & Status */}
        <div className="space-y-6">
          <div className="p-6 bg-white border rounded-lg shadow-sm">
            <button
              onClick={handleStart}
              disabled={connectionState === LiveConnectionState.OPEN}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                connectionState === LiveConnectionState.OPEN
                  ? "bg-green-600 cursor-default"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {connectionState === LiveConnectionState.OPEN
                ? "Listening..."
                : "Start Microphone"}
            </button>

            <div className="mt-4 text-sm text-gray-600">
              <p>
                Status: <span className="font-semibold">{status}</span>
              </p>
            </div>
          </div>

          {/* Live Transcript */}
          <div className="p-4 bg-slate-50 border rounded-lg">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">
              Live Transcript
            </h3>
            <p className="text-lg text-slate-800 min-h-[3rem]">
              {transcriptText || (
                <span className="text-gray-400 italic">(speak now...)</span>
              )}
            </p>
          </div>

          {/* Queue Status */}
          <div className="p-4 bg-slate-50 border rounded-lg">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">
              Processing Queue
            </h3>
            {processingQueue.length === 0 && !isProcessing ? (
              <p className="text-sm text-gray-400">(empty)</p>
            ) : (
              <ul className="space-y-2">
                {isProcessing && (
                  <li className="text-sm text-blue-600 flex items-center animate-pulse">
                    <span className="mr-2">➤</span> Processing: "
                    {processingQueue[0]}"...
                  </li>
                )}
                {processingQueue.slice(isProcessing ? 1 : 0).map((cmd, i) => (
                  <li key={i} className="text-sm text-gray-600">
                    • {cmd}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Last Patch */}
          <div className="p-4 bg-gray-100 rounded">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm text-gray-700">
                Last Applied Patch
              </h3>
              <button
                onClick={resetState}
                className="text-xs text-red-600 underline"
              >
                Reset State
              </button>
            </div>
            <pre className="text-xs overflow-auto max-h-40 bg-white p-2 border text-gray-900">
              {lastPatch
                ? JSON.stringify(lastPatch, null, 2)
                : "(No patches applied yet)"}
            </pre>
          </div>
        </div>

        {/* Right Column: Game State */}
        <div>
          <h3 className="font-bold text-sm mb-2 text-gray-700">
            Current Game State (OpenHandHistory)
          </h3>
          <div className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto h-[600px] shadow-inner">
            <pre>{JSON.stringify(history, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
