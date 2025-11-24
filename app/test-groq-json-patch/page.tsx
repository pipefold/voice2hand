"use client";

import { useState } from "react";
import { OpenHandHistory } from "@/app/lib/OpenHandHistory";
import { applyPatch, Operation } from "rfc6902";
import { generateHandHistoryPatch } from "./action";

export default function TestGroqJsonPatchPage() {
  // Initialize with a fresh state, using a fixed date to prevent hydration mismatch
  const [history, setHistory] = useState(
    () =>
      new OpenHandHistory({ startDateUTC: "2023-01-01T00:00:00.000Z" }).toJSON()
        .ohh
  );
  const [input, setInput] = useState("5-handed and I'm under the gun");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastPatch, setLastPatch] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // We send a simplified context to the AI to save tokens/complexity
    // For this test, we send the basic table setup info
    const context = {
      table_size: history.table_size,
      players: history.players,
      dealer_seat: history.dealer_seat,
      small_blind_amount: history.small_blind_amount,
      big_blind_amount: history.big_blind_amount,
    };

    const result = await generateHandHistoryPatch(input, transcript, context);

    if (result.success && result.patches) {
      setLastPatch(result.patches);

      // Create a deep clone to apply patch immutably-ish
      const newHistory = JSON.parse(JSON.stringify(history));

      // Apply the patch
      const results = applyPatch(newHistory, result.patches as Operation[]);
      const firstError = results.find((result) => result !== null);

      if (!firstError) {
        // Update state
        setHistory(newHistory);
        setTranscript((prev) => [...prev, input]);
        setInput("");
      } else {
        console.error("Patch failed:", firstError);
        alert("Patch application failed (see console)");
      }
    } else {
      alert("Failed to generate patch");
    }

    setLoading(false);
  };

  const resetState = () => {
    setHistory(new OpenHandHistory().toJSON().ohh);
    setLastPatch(null);
    setTranscript([]);
    setInput("5-handed and I'm under the gun");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6">Groq + RFC 6902 Test</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="space-y-6">
          {transcript.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm space-y-2">
              <h3 className="font-bold text-blue-900">Transcript History</h3>
              <ul className="list-decimal list-inside text-blue-800 space-y-1">
                {transcript.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                User Voice Command (Simulated)
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full p-3 border rounded-lg bg-slate-50 text-slate-900"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Generating Patch..." : "Send to Groq"}
            </button>
          </form>

          <div className="p-4 bg-gray-100 rounded">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm text-gray-700">
                Last Generated Patch
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

        {/* Right Column: Current State */}
        <div>
          <h3 className="font-bold text-sm mb-2 text-gray-700">
            Current Game State (OpenHandHistory)
          </h3>
          <div className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto h-[500px]">
            <pre>{JSON.stringify(history, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
