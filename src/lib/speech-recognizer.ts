import { mobileAndTabletCheck } from "./device";

type SubscriberFunction = (final_transcript: string, interim_transcript: string) => void;
type ErrorSubscriberFunction = (running: boolean, error: SpeechRecognitionErrorEvent) => void;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition)
  alert(
    `This browser doesn't support speech recognition. Try using Google Chrome to run this app.`
  );

export default class SpeechRecognizer {
  private recognizer: SpeechRecognition;
  private subscribers: SubscriberFunction[] = [];
  private errorSubscribers: ErrorSubscriberFunction[] = [];

  private running: boolean = false;
  private startedAt: number = new Date().getTime();
  private restartCount: number = 0;

  constructor() {
    this.recognizer = new SpeechRecognition();

    this.recognizer.lang = "en-US";
    this.recognizer.continuous = true;
    this.recognizer.interimResults = true;

    this.recognizer.onresult = (e) => {
      this.restartCount = 0;
      let isMobileOrTablet = mobileAndTabletCheck();

      let final_transcript = "";
      let interim_transcript = "";

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const result = e.results[i];

        if (result.isFinal && result[0].confidence !== 0) {
          final_transcript = (isMobileOrTablet ? "" : final_transcript) + result[0].transcript;
        } else {
          interim_transcript = (isMobileOrTablet ? "" : interim_transcript) + result[0].transcript;
        }
      }

      for (let subscriber of this.subscribers) {
        subscriber(final_transcript, interim_transcript);
      }
    };

    this.recognizer.onerror = (e) => {
      switch (e.error) {
        case "network":
          // Network dropouts are usually not an issue!
          break;
        case "audio-capture":
          this.stop();
          alert("No microphone found. Check your microphone settings and try again.");
          break;
        case "not-allowed":
        case "service-not-allowed":
          this.stop();
          alert(
            "Permission to use microphone has been denied. Check your microphone settings and try again."
          );
      }

      for (let subscriber of this.errorSubscribers) {
        subscriber(this.running, e);
      }
    };

    this.recognizer.onend = (e) => {
      /*
        Speech recognition automatically stops after a while.
        Add restarts if the recognition stops.
      */
      if (this.running) {
        const timeSinceStart = new Date().getTime() - this.startedAt;
        this.restartCount++;
        // If multiple speech recogntion tabs are being used,
        // the service may go into an infinite loop.
        // See: https://stackoverflow.com/a/30007684
        if (this.restartCount > 50) {
          alert(
            "Speech recognition is repeatedly stopping. Close any other browser tabs and reload the page."
          );
        } else {
          if (timeSinceStart < 1000) {
            setTimeout(() => {
              this.recognizer.start();
            }, 1000 - timeSinceStart);
          } else {
            this.recognizer.start();
          }
        }
      }
    };
  }

  start(): void {
    this.recognizer.start();
    this.running = true;
    this.startedAt = new Date().getTime();
    this.restartCount = 0;
  }

  stop(): void {
    // Make sure running is set to false before calling stop.
    // Otherwise, the recognizer will continue restarting.
    this.running = false;
    this.recognizer.stop();
  }

  onresult(subscriber: SubscriberFunction): void {
    this.subscribers.push(subscriber);
  }

  onerror(subscriber: ErrorSubscriberFunction): void {
    this.errorSubscribers.push(subscriber);
  }
}
