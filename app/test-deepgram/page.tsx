// app/test-deepgram/page.tsx or any component
"use client";

import { useEffect, useRef, useState } from "react";
import {
  useDeepgram,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
} from "@/app/context/DeepgramContextProvider";
import {
  useMicrophone,
  MicrophoneEvents,
  MicrophoneState,
} from "@/app/context/MicrophoneContextProvider";

export default function TestDeepgram() {
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");

  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, microphoneState } =
    useMicrophone();

  const startedRef = useRef(false);

  // Start the flow when the user clicks the button
  const handleStart = async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    setStatus("requesting mic...");
    await setupMicrophone(); // asks for permission

    setStatus("connecting to Deepgram...");
    await connectToDeepgram({
      model: "nova-3",
      interim_results: true,
      smart_format: true,
    });
  };

  // When connection is OPEN, start mic and wire up events
  useEffect(() => {
    if (!microphone || !connection) return;
    if (connectionState !== LiveConnectionState.OPEN) return;

    setStatus("streaming audio...");

    const onData = (e: BlobEvent) => {
      if (e.data.size > 0) {
        connection.send(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const transcript = data.channel.alternatives[0]?.transcript ?? "";
      if (transcript) {
        setText(transcript);
      }
    };

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

  return (
    <div style={{ padding: 24 }}>
      <button onClick={handleStart}>Start Deepgram Test</button>
      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {status} ( mic:{" "}
        {MicrophoneState[microphoneState ?? MicrophoneState.NotSetup]}, conn:{" "}
        {LiveConnectionState[connectionState]})
      </div>
      <div style={{ marginTop: 24 }}>
        <strong>Transcript:</strong>
        <p>{text || "(start speaking…)"} </p>
      </div>
    </div>
  );
}
