import SpeechRecognizer from "../lib/speech-recognizer";
import {
  createTextRegion,
  getTokensFromText,
  matchText,
  getBoundsStart,
  resetTranscriptWindow,
} from "../lib/speech-matcher";
import { useNavbarStore } from "@/features/navbar/store";
import { useContentStore } from "@/features/content/store";

let speechRecognizer: SpeechRecognizer | null = null;

export const startTeleprompter = () => {
  try {
    if (speechRecognizer !== null) {
      return;
    }

    speechRecognizer = new SpeechRecognizer();

    speechRecognizer.onstart(() => {
      const { tokens, position, setPosition } = useContentStore.getState();

      if (position.bounds < 0) {
        const bounds = getBoundsStart(tokens, 0);
        if (bounds !== undefined) {
          setPosition({ bounds: bounds });
        }
      }
    });

    speechRecognizer.onresult((finalTranscript: string, interimTranscript: string) => {
      const { tokens, position, setPosition } = useContentStore.getState();

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
          setPosition({
            start: matchEnd,
            search: matchEnd,
            end: matchEnd,
            ...(boundStart !== undefined && { bounds: boundStart }),
          });
        } else {
          setPosition({
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
          setPosition({
            search: matchStart,
            end: matchEnd,
            ...(boundStart !== undefined && { bounds: boundStart }),
          });
        }
      }
    });

    speechRecognizer.onend(() => {
      const { stop } = useNavbarStore.getState();
      stop();
      resetTranscriptWindow();
    });

    const { start } = useNavbarStore.getState();

    speechRecognizer.start();
    start();
  } catch (error) {
    alert(
      `This browser doesn't support speech recognition. Try using Google Chrome to run this app.`,
    );
  }
};

export const stopTeleprompter = () => {
  if (speechRecognizer !== null) {
    speechRecognizer.stop();
    speechRecognizer = null;
  }
};
