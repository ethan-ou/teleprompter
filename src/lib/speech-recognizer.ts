type SubscriberFunction = (final_transcript: string, interim_transcript: string) => void;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition)
  alert(
    `This browser doesn't support speech recognition. Try using Google Chrome to run this app.`
  );

export default class SpeechRecognizer {
  private recognizer: SpeechRecognition;
  private subscribers: SubscriberFunction[] = [];

  constructor() {
    this.recognizer = new SpeechRecognition();

    this.recognizer.lang = "en-US";
    this.recognizer.continuous = true;
    this.recognizer.interimResults = true;

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
      alert(`Speech recognition error found: ${e.error}.${e.message && ` Message: ${e.message}`}`);
    };
  }

  start(): void {
    this.recognizer.start();
  }

  stop(): void {
    this.recognizer.stop();
  }

  onresult(subscriber: SubscriberFunction): void {
    this.subscribers.push(subscriber);
  }
}
