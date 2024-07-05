type SubscriberFunction = (final_transcript: string, interim_transcript: string) => void;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition)
  alert(
    `This browser doesn't support speech recognition. Try using Google Chrome to run this app.`
  );

export default class SpeechRecognizer {
  private recognizer: SpeechRecognition;
  private subscribers: SubscriberFunction[] = [];

  private running: boolean;
  private startedAt: number;
  private restartCount: number;

  constructor() {
    this.recognizer = new SpeechRecognition();

    this.recognizer.lang = "en-US";
    this.recognizer.continuous = true;
    this.recognizer.interimResults = true;

    this.running = false;
    this.startedAt = new Date().getTime();
    this.restartCount = 0;

    this.recognizer.onresult = (e) => {
      let final_transcript = "";
      let interim_transcript = "";

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        const result = e.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          final_transcript += transcript;
        } else {
          interim_transcript += transcript;
        }
      }

      for (let subscriber of this.subscribers) {
        subscriber(final_transcript, interim_transcript);
      }
    };

    this.recognizer.onerror = (e) => {
      this.running = false;
      if (e.error == "no-speech") {
        try {
          this.recognizer.stop();
        } catch (e) {}
        alert("No speech detected. Check your microphone or try again.");
      }
      if (e.error == "audio-capture") {
        try {
          this.recognizer.stop();
        } catch (e) {}
        alert("No microphone found.");
      }
      if (e.error == "not-allowed") {
        try {
          this.recognizer.stop();
        } catch (e) {}
        alert("Permission denied for microphone access.");
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
        if (this.restartCount > 10000) {
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
}
