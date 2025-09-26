import { localStore } from "@/app/local-store.svelte";

export type Status = "editing" | "started" | "stopped";
export type Align = "top" | "center" | "bottom";

// Define the shape of the persistent state
interface PersistentNavbarState {
  mirror: boolean;
  hide: boolean;
  fontSize: number;
  margin: number;
  opacity: number;
  align: Align;
}

const LOCAL_STORAGE_KEY = 'teleprompter:settings';

// Define the default persistent state
const defaultPersistentState: PersistentNavbarState = {
  mirror: false,
  hide: false,
  fontSize: 60,
  margin: 10,
  opacity: 80,
  align: "top",
};

// --- Core Rune Store Function ---

function createNavbarStore() {
  // Use localStore to handle the persistent state automatically
  const settings = localStore(LOCAL_STORAGE_KEY, defaultPersistentState);

  // Define the non-persistent state separately
  let status = $state<Status>("stopped");
  let timer = $state<number>(0);
  let cast = $state<boolean>(false);
  let collaborate = $state<boolean>(false);

  // --- Actions/Mutators ---
  
  const actions = {
    start: () => { status = "started"; },
    stop: () => { status = "stopped"; },
    toggleEdit: () => { 
      status = status === "editing" ? "stopped" : "editing";
    },
    toggleMirror: () => { settings.value.mirror = !settings.value.mirror; },
    setHide: (value: boolean) => { settings.value.hide = value; },
    setCast: (value: boolean) => { cast = value; },
    setFontSize: (value: number) => { settings.value.fontSize = value; },
    setMargin: (value: number) => { settings.value.margin = value; },
    setOpacity: (value: number) => { settings.value.opacity = value; },
    incrementTimer: () => { timer += 1; },
    resetTimer: () => { timer = 0; },
    setAlign: (value: Align) => { settings.value.align = value; },
    setCollaborate: (value: boolean) => { collaborate = value; },
  };

  // --- Public Interface (Runes Store pattern) ---
  return {
    // Expose non-persistent state via getters
    get status() { return status; },
    get timer() { return timer; },
    get cast() { return cast; },
    get collaborate() { return collaborate; },

    // Expose persistent state from the localStore instance
    get mirror() { return settings.value.mirror; },
    get hide() { return settings.value.hide; },
    get fontSize() { return settings.value.fontSize; },
    get margin() { return settings.value.margin; },
    get opacity() { return settings.value.opacity; },
    get align() { return settings.value.align; },

    // Expose all actions
    ...actions,
  };
}

export const navbarStore = createNavbarStore();