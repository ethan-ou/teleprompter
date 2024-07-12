import SpeechRecognizer from "../lib/speech-recognizer";
import {
  createTextRegion,
  getTokensFromText,
  matchText,
  getBoundsStart,
  resetTranscriptMemory,
} from "../lib/speech-matcher";
import { useNavbarStore } from "@/features/navbar/store";
import { useContentStore } from "@/features/content/store";
import { resetMovingAverage } from "@/lib/moving-average";

let speechRecognizer: SpeechRecognizer | null = null;

export const startTeleprompter = () => {
  try {
    if (speechRecognizer !== null) {
      return;
    }

    speechRecognizer = new SpeechRecognizer();

    speechRecognizer.onstart(() => {
      const { textElements, bounds, setBounds } = useContentStore.getState();

      if (bounds === -1) {
        const bounds = getBoundsStart(textElements, 0);
        if (bounds !== undefined) {
          setBounds(bounds);
        }
      }
    });

    speechRecognizer.onresult((final_transcript: string, interim_transcript: string) => {
      const { textElements, search, end, setStart, setSearch, setEnd, setBounds } =
        useContentStore.getState();

      if (final_transcript !== "") {
        const textRegion = createTextRegion(textElements, search);
        const foundMatch = matchText(getTokensFromText(final_transcript), textRegion, true);

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

        const boundStart = textRegion.at(-1);
        if (boundStart) {
          setBounds(boundStart.index);
        }
      }

      if (interim_transcript !== "") {
        const textRegion = createTextRegion(textElements, search);
        const foundMatch = matchText(
          getTokensFromText(interim_transcript),
          createTextRegion(textElements, search),
          false,
        );

        if (foundMatch) {
          const [matchStart, matchEnd] = foundMatch;
          setSearch(matchStart);
          setEnd(matchEnd);
        }

        const boundStart = textRegion.at(-1);
        if (boundStart) {
          setBounds(boundStart.index);
        }
      }
    });

    speechRecognizer.onend(() => {
      const { stop } = useNavbarStore.getState();
      stop();
      resetMovingAverage();
      resetTranscriptMemory();
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
