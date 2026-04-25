import SpeechRecognizer from "../lib/speech-recognizer";
import { useNavbarStore } from "@/features/navbar/store";
import { useTrackerStore } from "@/features/tracker/store";

let speechRecognizer: SpeechRecognizer | null = null;

export const startTeleprompter = () => {
  try {
    if (speechRecognizer !== null) {
      return;
    }

    speechRecognizer = new SpeechRecognizer();

    speechRecognizer.onresult((finalTranscript: string, interimTranscript: string) => {
      const { onSpeechResult } = useTrackerStore.getState();

      if (finalTranscript !== "") {
        onSpeechResult(finalTranscript.trim().split(/\s+/).filter(Boolean), true);
      }
      if (interimTranscript !== "") {
        onSpeechResult(interimTranscript.trim().split(/\s+/).filter(Boolean), false);
      }
    });

    speechRecognizer.onend(() => {
      useNavbarStore.getState().stop();
      // Beam persists across API resets — no reset needed here.
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
