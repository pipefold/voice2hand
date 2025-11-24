"use client";

import { useState } from "react";
import { useVoiceHandHistory } from "@/app/hooks/useVoiceHandHistory";

export default function TestGroqJsonPatchPage() {
  const {
    history,
    patchHistory,
    transcript,
    isProcessing,
    processCommand,
    resetState,
  } = useVoiceHandHistory();

  const [input, setInput] = useState("5-handed and I'm under the gun");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    setInput("");
  };

  const lastPatch = patchHistory[0]?.patches;

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
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? "Generating Patch..." : "Send to Groq"}
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
