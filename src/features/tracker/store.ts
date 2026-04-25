import { create } from "zustand";
import { type MatchState, type ScriptToken, initMatch, parseScript, seekMatch, updateMatch } from "@/lib/tracker";
import { useContentStore } from "@/features/content/store";

type TrackerState = {
  match: MatchState;
  scriptTokens: ScriptToken[];
  currentPosition: number;
};

type TrackerActions = {
  initScript: (text: string) => void;
  onSpeechResult: (words: string[], isFinal: boolean) => void;
  seek: (fullSeqIndex: number) => void;
};

export const useTrackerStore = create<TrackerState & TrackerActions>()((set, get) => ({
  match: initMatch(),
  scriptTokens: parseScript(useContentStore.getState().text),
  currentPosition: -1,

  initScript: (text) =>
    set({ scriptTokens: parseScript(text), match: initMatch(), currentPosition: -1 }),

  onSpeechResult: (words, isFinal) => {
    const { match, scriptTokens } = get();
    const result = updateMatch(match, words, scriptTokens, isFinal);
    set({ match: result.state, currentPosition: result.position });

    if (result.state.confirmedIndex !== match.confirmedIndex) {
      useContentStore.getState().setPosition({ confirmedIndex: result.state.confirmedIndex });
    }
  },

  seek: (fullSeqIndex) => {
    const { scriptTokens } = get();
    set({ match: seekMatch(fullSeqIndex, scriptTokens), currentPosition: fullSeqIndex });
    useContentStore.getState().setPosition({ confirmedIndex: fullSeqIndex });
  },
}));

useContentStore.subscribe((state, prevState) => {
  if (state.text !== prevState.text) {
    useTrackerStore.getState().initScript(state.text);
  }
});
