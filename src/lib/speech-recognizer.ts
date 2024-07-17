import { isMobileOrTablet } from "./device";

type SubscriberFunction = (finalTranscript: string, interimTranscript: string) => void;
type ErrorSubscriberFunction = (error: SpeechRecognitionErrorEvent) => void;
type EmptySubscriberFunction = () => void;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition)
  alert(
    `This browser doesn't support speech recognition. Try using Google Chrome to run this app.`,
  );

// Assume a restart amount of once per second is an infinite loop.
const RESTART_TIME_WINDOW = 60 * 1000;
const RESTART_QUANTITY = 60;

export default class SpeechRecognizer {
  private recognizer: SpeechRecognition;

  private startSubscribers: EmptySubscriberFunction[] = [];
  private subscribers: SubscriberFunction[] = [];
  private errorSubscribers: ErrorSubscriberFunction[] = [];
  private endSubscribers: EmptySubscriberFunction[] = [];

  private running: boolean = false;
  private startedAt: number = new Date().getTime();
  private mobileOrTablet: boolean = isMobileOrTablet();
  private previousRestarts: number[] = [];

  constructor() {
    this.recognizer = new SpeechRecognition();

    this.recognizer.lang = "en-US";
    this.recognizer.continuous = true;
    this.recognizer.interimResults = true;
    this.mobileOrTablet = isMobileOrTablet();

    this.recognizer.onstart = (e) => {
      for (let subscriber of this.startSubscribers) {
        subscriber();
      }
    };

    this.recognizer.onresult = (e) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const result = e.results[i];

        // Speech Recognition requires a different setup on mobile
        // https://stackoverflow.com/questions/75272972/speech-recognition-result-double-in-mobile/77046406#77046406
        if (result.isFinal && result[0].confidence !== 0) {
          finalTranscript = (this.mobileOrTablet ? "" : finalTranscript) + result[0].transcript;
        } else {
          interimTranscript = (this.mobileOrTablet ? "" : interimTranscript) + result[0].transcript;
        }
      }

      for (let subscriber of this.subscribers) {
        subscriber(finalTranscript, interimTranscript);
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
            "Permission to use microphone has been denied. Check your microphone settings and try again.",
          );
      }

      for (let subscriber of this.errorSubscribers) {
        subscriber(e);
      }
    };

    this.recognizer.onend = (e) => {
      /*
        Speech recognition automatically stops after a while.
        Add restarts if the recognition stops.
      */
      if (this.running) {
        const now = Date.now();
        this.previousRestarts.push(now);
        this.previousRestarts = this.previousRestarts.filter(
          (restart) => restart > now - RESTART_TIME_WINDOW,
        );
        const timeSinceStart = now - this.startedAt;

        // If multiple speech recogntion tabs are being used,
        // the service may go into an infinite loop.
        // See: https://stackoverflow.com/a/30007684
        if (this.previousRestarts.length > RESTART_QUANTITY) {
          alert(
            "Speech recognition is repeatedly stopping. Close any other browser tabs and reload the page.",
          );
          for (let subscriber of this.endSubscribers) {
            subscriber();
          }
        } else {
          if (timeSinceStart < 1000) {
            setTimeout(() => {
              this.recognizer.start();
            }, 1000 - timeSinceStart);
          } else {
            this.recognizer.start();
          }
        }
      } else {
        for (let subscriber of this.endSubscribers) {
          subscriber();
        }
      }
    };
  }

  start(): void {
    this.recognizer.start();
    this.running = true;
    this.startedAt = new Date().getTime();
    this.previousRestarts = [];
  }

  stop(): void {
    // Make sure running is set to false before calling stop.
    // Otherwise, the recognizer will continue restarting.
    this.recognizer.stop();
    this.running = false;
    this.previousRestarts = [];
  }

  onstart(subscriber: EmptySubscriberFunction): void {
    this.startSubscribers.push(subscriber);
  }

  onresult(subscriber: SubscriberFunction): void {
    this.subscribers.push(subscriber);
  }

  onerror(subscriber: ErrorSubscriberFunction): void {
    this.errorSubscribers.push(subscriber);
  }

  onend(subscriber: EmptySubscriberFunction): void {
    this.endSubscribers.push(subscriber);
  }
}
