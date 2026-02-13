import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getPusherServer } from "@/lib/pusher-server";
import {
  getGameState,
  getClientGameState,
  resetGameState,
} from "@/lib/game-state";

const CHANNEL = "game-channel";

async function broadcastState() {
  const pusher = getPusherServer();
  const state = getClientGameState();
  await pusher.trigger(CHANNEL, "game-update", state);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const state = getGameState();

    switch (action) {
      case "join": {
        const { playerId, playerName } = body;
        if (!playerId || !playerName) {
          return NextResponse.json(
            { error: "Missing player info" },
            { status: 400 }
          );
        }
        if (!state.players.find((p) => p.id === playerId)) {
          state.players.push({ id: playerId, name: playerName });
        }
        await broadcastState();
        return NextResponse.json({ ok: true, state: getClientGameState() });
      }

      case "start": {
        state.status = "active";
        state.buzzedPlayerId = null;
        state.lastGuesserId = null;
        state.guessedLetters = [];
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "buzz": {
        const { playerId } = body;
        if (state.status !== "active") {
          return NextResponse.json(
            { error: "Game not active" },
            { status: 400 }
          );
        }
        // Cooldown (when enabled): last guesser cannot buzz this turn
        if (state.skipTurnAfterGuess && state.lastGuesserId === playerId) {
          return NextResponse.json(
            { error: "You must wait — another player goes first" },
            { status: 403 }
          );
        }
        if (state.buzzedPlayerId === null) {
          state.buzzedPlayerId = playerId;
          await broadcastState();

          const buzzerName =
            state.players.find((p) => p.id === playerId)?.name ?? "Unknown";
          const pusher = getPusherServer();
          await pusher.trigger(CHANNEL, "buzz-event", {
            playerId,
            playerName: buzzerName,
          });
        }
        return NextResponse.json({
          ok: true,
          buzzedPlayerId: state.buzzedPlayerId,
        });
      }

      case "guess_letter": {
        const { letter, playerId: guesserId } = body;
        if (state.status !== "active") {
          return NextResponse.json(
            { error: "Game not active" },
            { status: 400 }
          );
        }
        if (state.buzzedPlayerId !== guesserId) {
          return NextResponse.json(
            { error: "Not your turn" },
            { status: 403 }
          );
        }
        const upperLetter = (letter as string).toUpperCase();
        if (!state.guessedLetters.includes(upperLetter)) {
          state.guessedLetters.push(upperLetter);
        }
        state.lastGuesserId = guesserId; // Cooldown: they can't buzz next turn
        state.buzzedPlayerId = null;
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "clear_buzzer": {
        state.buzzedPlayerId = null;
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "clear_cooldown": {
        state.lastGuesserId = null;
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "remove_player": {
        const { playerId: toRemove } = body;
        if (!toRemove) {
          return NextResponse.json(
            { error: "Missing player ID" },
            { status: 400 }
          );
        }
        state.players = state.players.filter((p) => p.id !== toRemove);
        if (state.buzzedPlayerId === toRemove) state.buzzedPlayerId = null;
        if (state.lastGuesserId === toRemove) state.lastGuesserId = null;
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "reveal_letter": {
        const letter = (body.letter as string)?.toUpperCase?.();
        if (!letter || !/^[A-Z]$/.test(letter)) {
          return NextResponse.json(
            { error: "Invalid letter" },
            { status: 400 }
          );
        }
        if (state.status !== "active") {
          return NextResponse.json(
            { error: "Game not active" },
            { status: 400 }
          );
        }
        if (!state.guessedLetters.includes(letter)) {
          state.guessedLetters.push(letter);
        }
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "reveal": {
        state.status = "revealed";
        state.buzzedPlayerId = null;
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "reset": {
        resetGameState();
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "get_state": {
        return NextResponse.json({ ok: true, state: getClientGameState() });
      }

      case "get_host_state": {
        const clientState = getClientGameState();
        return NextResponse.json({
          ok: true,
          state: { ...clientState, targetPhrase: state.targetPhrase },
        });
      }

      case "set_winner_photo": {
        const dataUrl = body.winnerPhotoDataUrl as string;
        if (!dataUrl || typeof dataUrl !== "string") {
          return NextResponse.json(
            { error: "Missing or invalid winnerPhotoDataUrl" },
            { status: 400 }
          );
        }
        if (!dataUrl.startsWith("data:image/")) {
          return NextResponse.json(
            { error: "Must be an image data URL" },
            { status: 400 }
          );
        }

        // On Vercel with Blob storage: upload and store persistent URL
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          try {
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64, "base64");
            const match = dataUrl.match(/data:image\/(\w+)/);
            const ext = match?.[1] ?? "jpeg";
            const contentType = `image/${ext}`;
            const blob = await put("unicorn-game/winner-photo", buffer, {
              access: "public",
              contentType,
            });
            state.winnerPhotoDataUrl = blob.url;
          } catch (err) {
            console.error("Blob upload failed:", err);
            return NextResponse.json(
              { error: "Failed to upload photo" },
              { status: 500 }
            );
          }
        } else {
          // Local dev: store data URL in memory (ephemeral)
          state.winnerPhotoDataUrl = dataUrl;
        }

        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "set_skip_turn": {
        const enabled = body.skipTurnAfterGuess;
        if (typeof enabled !== "boolean") {
          return NextResponse.json(
            { error: "skipTurnAfterGuess must be boolean" },
            { status: 400 }
          );
        }
        state.skipTurnAfterGuess = enabled;
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      case "set_phrase": {
        const phrase = (body.phrase as string)?.trim?.();
        if (!phrase) {
          return NextResponse.json(
            { error: "Phrase cannot be empty" },
            { status: 400 }
          );
        }
        if (state.status !== "waiting") {
          return NextResponse.json(
            { error: "Can only set phrase before game starts" },
            { status: 400 }
          );
        }
        state.targetPhrase = phrase.toUpperCase();
        await broadcastState();
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("Game action error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
