import SpeechRecognizer from "../lib/speech-recognizer";
import {
  createTextRegion,
  getTokensFromText,
  matchText,
} from "../lib/speech-matcher";
import { useNavbarStore } from "@/features/navbar/store";
import { useContentStore } from "@/features/content/store";
import { resetPositions } from "@/lib/average-position";

let speechRecognizer: SpeechRecognizer | null = null;

export const startTeleprompter = () => {
  try {
    if (speechRecognizer !== null) {
      return;
    }

    speechRecognizer = new SpeechRecognizer();

    speechRecognizer.onresult(
      (final_transcript: string, interim_transcript: string) => {
        const {
          textElements,
          search,
          start,
          end,
          setStart,
          setSearch,
          setEnd,
        } = useContentStore.getState();

        if (final_transcript !== "") {
          const foundMatch = matchText(
            getTokensFromText(final_transcript),
            createTextRegion(textElements, search),
            true,
          );

          if (foundMatch) {
            const [matchStart, matchEnd] = foundMatch;
            setStart(matchEnd);
            setSearch(matchEnd);
            setEnd(matchEnd);
          } else {
            setStart(end);
            setSearch(end);
            setEnd(end);
          }
        }

        if (interim_transcript !== "") {
          const foundMatch = matchText(
            getTokensFromText(interim_transcript),
            createTextRegion(textElements, search),
            false,
          );

          if (foundMatch) {
            const [matchStart, matchEnd] = foundMatch;
            if (matchStart < start) {
              setStart(matchStart);
            }

            setSearch(matchStart);
            setEnd(matchEnd);
          }
        }
      },
    );

    speechRecognizer.onerror((running) => {
      if (!running) {
        const { stop } = useNavbarStore.getState();
        stop();
        resetPositions();
      }
    });

    speechRecognizer.onend(() => {
      const { stop } = useNavbarStore.getState();
      stop();
      resetPositions();
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
