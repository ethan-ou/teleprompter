import SpeechRecognizer from "../lib/speech-recognizer";
import {
  createTextSearchRegion,
  createTranscriptTokens,
  match,
  match2,
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
          console.log("final:", final_transcript);
          const foundMatch = match2(
            createTranscriptTokens(final_transcript),
            createTextSearchRegion(textElements, start),
            true,
          );

          if (foundMatch) {
            const [start, end] = foundMatch;
            setStart(start);
            setEnd(end);
          }
        }

        if (interim_transcript !== "") {
          console.log("interim:", interim_transcript);

          const foundMatch = match2(
            createTranscriptTokens(interim_transcript),
            createTextSearchRegion(textElements, start),
            false,
          );

          if (foundMatch) {
            const [start, end] = foundMatch;
            setStart(start);
            setEnd(end);
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
