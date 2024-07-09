import SpeechRecognizer from "../lib/speech-recognizer";
import { computeSpeechRecognitionTokenIndex } from "../lib/speech-matcher";
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
        const {
          textElements,
          finalTranscriptIndex: lastFinalTranscriptIndex,
          setInterimTranscriptIndex,
          setFinalTranscriptIndex,
        } = useContentStore.getState();

        if (final_transcript !== "") {
          const finalTranscriptIndex = computeSpeechRecognitionTokenIndex(
            final_transcript,
            textElements,
            lastFinalTranscriptIndex,
          );
          setFinalTranscriptIndex(finalTranscriptIndex);
        }

        if (interim_transcript !== "") {
          const interimTranscriptIndex = computeSpeechRecognitionTokenIndex(
            interim_transcript,
            textElements,
            lastFinalTranscriptIndex,
          );
          setInterimTranscriptIndex(interimTranscriptIndex);
        }
      },
    );

    speechRecognizer.onerror((running) => {
      if (!running) {
        const { stop } = useNavbarStore.getState();
        stop();
      }
    });

    speechRecognizer.onend(() => {
      const { stop } = useNavbarStore.getState();
      stop();
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
