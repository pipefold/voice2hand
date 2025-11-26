# Voice2Hand

**Voice2Hand** is a voice-driven poker hand history recorder and visualizer. It
allows players to narrate a poker hand in real-time (or post-session) and
instantly converts that speech into a structured **OpenHandHistory (OHH)**
format, visualizing the action on a replay board.

## 🚀 Features

- **🎙️ Voice-to-Code**: Uses **Deepgram** for high-speed, accurate
  speech-to-text transcription.
- **🧠 AI State Management**: Uses **Groq** (LLM) to interpret natural language
  poker actions ("UTG raises to 15", "Button calls") and generate **RFC 6902
  JSON Patches** to update the game state incrementally.
- **🃏 Real-time Replayer**: Visualizes the hand history on a poker table
  component as you speak, handling seat mapping, dealer button logic, and pot
  calculations.
- **📜 OpenHandHistory**: Built around the OpenHandHistory specification for
  interoperable hand data.

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI & Voice**:
  - [Deepgram SDK](https://deepgram.com/) (Speech-to-Text)
  - [Groq](https://groq.com/) (LLM Inference via Vercel AI SDK)
- **State Logic**: Custom Poker State Calculator & JSON Patching (`rfc6902`)

## 📦 Getting Started

### 1. Prerequisites

You will need API keys for:

- **Deepgram**: For voice transcription.
- **Groq**: For fast LLM inference (parsing speech to JSON patches).

### 2. Installation

```bash
git clone https://github.com/your-username/voice2hand.git
cd voice2hand
pnpm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```bash
DEEPGRAM_API_KEY=your_deepgram_key_here
GROQ_API_KEY=your_groq_key_here
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the prototype hub.

## 🧪 Prototypes

The project is structured as a collection of prototypes to test different parts
of the pipeline. You can access them from the main dashboard:

| Path                                | Description                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/prototypes/deepgram-basic`        | Simple test of Deepgram live transcription and endpointing.                                       |
| `/prototypes/groq-json-patcher`     | Manual text input to test the LLM's ability to generate valid JSON patches for game state.        |
| `/prototypes/voice-driven-replayer` | **The Main Demo**. Combines Deepgram + Groq + Replayer UI for a full voice-controlled experience. |
| `/prototypes/open-hand-history`     | Visualizer for static OpenHandHistory data structures.                                            |

## 🧩 Architecture Overview

1. **Input**: Microphone audio is streamed to Deepgram.
2. **Transcription**: Deepgram returns text transcripts.
3. **Processing**:
   - The transcript is sent to a Server Action (`generateHandHistoryPatch`).
   - Groq (LLM) receives the current game state + new transcript.
   - Groq outputs an RFC 6902 JSON Patch (e.g.,
     `{ "op": "add", "path": "/rounds/0/actions/-", "value": { "action": "Raise", "amount": 20 } }`).
4. **State Update**: The frontend applies the patch to the local
   `OpenHandHistory` object.
5. **Visualization**: The `HandReplayer` component reacts to state changes and
   updates the UI (chips, cards, dealer button).
