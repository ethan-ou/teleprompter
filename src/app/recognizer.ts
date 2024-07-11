import SpeechRecognizer from "../lib/speech-recognizer";
import {
  createTextSearchRegion,
  createTranscriptTokens,
  match,
  reset,
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

    speechRecognizer.onresult(
      (final_transcript: string, interim_transcript: string) => {
        const { textElements, start, end, setStart, setEnd } =
          useContentStore.getState();

        if (final_transcript !== "") {
          const foundMatch = match(
            createTranscriptTokens(final_transcript),
            true,
            createTextSearchRegion(textElements, end),
          );
          if (foundMatch && foundMatch.textMatch.length > 0) {
            setStart(foundMatch.textMatch[0].index);
            setEnd(foundMatch.textMatch.at(-1)!.index);
          }
        }

        if (interim_transcript !== "") {
          const foundMatch = match(
            createTranscriptTokens(interim_transcript),
            false,
            createTextSearchRegion(textElements, start),
          );

          if (foundMatch && foundMatch.textMatch.length > 0) {
            setStart(foundMatch.textMatch[0].index);
            setEnd(foundMatch.textMatch.at(-1)!.index);
          }
        }
      },
    );

    speechRecognizer.onerror((running) => {
      if (!running) {
        const { stop } = useNavbarStore.getState();
        stop();
        reset();
      }
    });

    speechRecognizer.onend(() => {
      const { stop } = useNavbarStore.getState();
      stop();
      reset();
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
