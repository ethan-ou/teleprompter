import SpeechRecognizer from "../lib/speech-recognizer";
import {
  createTextRegion,
  getTokensFromText,
  matchText,
  getBoundsStart,
  resetTranscriptWindow,
} from "../lib/speech-matcher";
import { navbarStore } from "@/features/navbar/store.svelte";
import { contentStore } from "@/features/content/store.svelte";

// --- Store Implementation ---

function createRecognizerStore() {
  // State
  let speechRecognizer = $state<SpeechRecognizer | null>(null);
  let isActive = $state<boolean>(false);
  let error = $state<string | null>(null);

  // --- Actions ---

  function startTeleprompter() {
    try {
      if (speechRecognizer !== null) {
        return;
      }

      error = null;
      speechRecognizer = new SpeechRecognizer();

      speechRecognizer.onstart(() => {
        isActive = true;
        const tokens = contentStore.tokens();
        const position = contentStore.position();

        if (position.bounds < 0) {
          const bounds = getBoundsStart(tokens, 0);
          if (bounds !== undefined) {
            contentStore.setPosition({ bounds: bounds });
          }
        }
      });

      speechRecognizer.onresult((finalTranscript: string, interimTranscript: string) => {
        const tokens = contentStore.tokens();
        const position = contentStore.position();

        const textRegion = createTextRegion(tokens, position.search);
        const boundStart = getBoundsStart(tokens, position.search, textRegion);

        if (finalTranscript !== "") {
          const foundMatch = matchText(
            getTokensFromText(finalTranscript),
            textRegion,
            position.search,
            true,
          );

          if (foundMatch) {
            const [, matchEnd] = foundMatch;
            contentStore.setPosition({
              start: matchEnd,
              search: matchEnd,
              end: matchEnd,
              ...(boundStart !== undefined && { bounds: boundStart }),
            });
          } else {
            contentStore.setPosition({
              start: position.end,
              search: position.end,
              end: position.end,
              ...(boundStart !== undefined && { bounds: boundStart }),
            });
          }
        }

        if (interimTranscript !== "") {
          const foundMatch = matchText(
            getTokensFromText(interimTranscript),
            textRegion,
            position.search,
            false,
          );

          if (foundMatch) {
            const [matchStart, matchEnd] = foundMatch;
            contentStore.setPosition({
              search: matchStart,
              end: matchEnd,
              ...(boundStart !== undefined && { bounds: boundStart }),
            });
          }
        }
      });

      speechRecognizer.onend(() => {
        isActive = false;
        navbarStore.stop();
        resetTranscriptWindow();
      });

      speechRecognizer.start();
      navbarStore.start();
    } catch (err) {
      error = `This browser doesn't support speech recognition. Try using Google Chrome to run this app.`;
      isActive = false;
    }
  }

  function stopTeleprompter() {
    if (speechRecognizer !== null) {
      speechRecognizer.stop();
      speechRecognizer = null;
    }
    isActive = false;
    error = null;
  }

  function clearError() {
    error = null;
  }

  // --- Public Interface ---
  return {
    // State getters
    get isActive() { return isActive; },
    get error() { return error; },
    get speechRecognizer() { return speechRecognizer; },

    // Actions
    startTeleprompter,
    stopTeleprompter,
    clearError,
  };
}

export const recognizerStore = createRecognizerStore();