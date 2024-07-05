import SpeechRecognizer from "../lib/speech-recognizer";
import { computeSpeechRecognitionTokenIndex } from "../lib/speech-matcher";
import { useNavbarStore } from "@/features/navbar/store";
import { useContentStore } from "@/features/content/store";

let speechRecognizer: SpeechRecognizer | null = null;

export const startTeleprompter = () => {
  const { start } = useNavbarStore.getState();
  start();

  speechRecognizer = new SpeechRecognizer();

  speechRecognizer.onresult((final_transcript: string, interim_transcript: string) => {
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
        lastFinalTranscriptIndex
      );
      setFinalTranscriptIndex(finalTranscriptIndex);
    }

    if (interim_transcript !== "") {
      const interimTranscriptIndex = computeSpeechRecognitionTokenIndex(
        interim_transcript,
        textElements,
        lastFinalTranscriptIndex
      );
      setInterimTranscriptIndex(interimTranscriptIndex);
    }
  });

  speechRecognizer.start();
};

export const stopTeleprompter = () => {
  const { stop } = useNavbarStore.getState();

  if (speechRecognizer !== null) {
    speechRecognizer.stop();
    speechRecognizer = null;
  }

  stop();
};
