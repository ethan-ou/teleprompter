export type Status = "editing" | "started" | "stopped";
export type Align = "top" | "center" | "bottom";

/**
 * Defines the persistent settings state structure.
 * Note: Non-persistent fields like 'status' and 'timer' are initialized 
 * but are intentionally excluded from the localStorage save/load logic.
 */
export interface NavbarState {
    status: Status;
    mirror: boolean;
    hide: boolean;
    fontSize: number;
    margin: number;
    opacity: number;
    timer: number;
    cast: boolean;
    align: Align;
    collaborate: boolean;
}

// --- Initial Constants and Configuration ---

const LOCAL_STORAGE_KEY = 'teleprompter:settings';

// Define default initial state
const initialState: NavbarState = {
    status: "stopped",
    mirror: false,
    hide: false,
    fontSize: 60,
    margin: 10,
    opacity: 80,
    timer: 0,
    cast: false,
    align: "top",
    collaborate: false,
};

// --- Core Rune Store Function ---

function createNavbarStore() {
    // 1. Define mutable state using $state, initialized with defaults
    const state = $state<NavbarState>({ ...initialState });

    // --- Persistence Logic ---

    /**
     * Loads settings from localStorage into the $state object.
     */
    function loadFromStorage() {
        if (typeof localStorage !== 'undefined') {
            const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (existing) {
                try {
                    const parsed = JSON.parse(existing);
                    // Merge loaded properties into the current state object
                    Object.assign(state, parsed);
                } catch (e) {
                    console.warn(`Failed to load ${LOCAL_STORAGE_KEY} from localStorage:`, e);
                }
            }
        }
    }

    /**
     * Saves only the persistent properties to localStorage.
     * This logic is simplified compared to the old store's update() hook.
     */
    function saveToStorage() {
        if (typeof localStorage !== 'undefined') {
            try {
                // Explicitly select only the properties we want to persist
                const persistedState = {
                    mirror: state.mirror,
                    hide: state.hide,
                    fontSize: state.fontSize,
                    margin: state.margin,
                    opacity: state.opacity,
                    align: state.align,
                };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(persistedState));
            } catch (e) {
                console.error(`Failed to save ${LOCAL_STORAGE_KEY} to localStorage:`, e);
            }
        }
    }

    // Load initial data *before* any effects run
    $effect.pre(() => {
        loadFromStorage();
    });

    // 2. Use $effect to automatically persist changes to specific properties.
    // The effect will rerun any time a dependency (e.g., state.mirror) changes.
    $effect(() => {
        // Dependencies are implicitly tracked here:
        // state.mirror, state.hide, state.fontSize, state.margin, state.opacity, state.align
        state.mirror;
        state.hide;
        state.fontSize;
        state.margin;
        state.opacity;
        state.align;
        
        saveToStorage();
    });

    // --- Actions/Mutators ---
    
    // Actions now directly mutate the shared 'state' object
    const actions = {
        start: () => { state.status = "started"; },
        stop: () => { state.status = "stopped"; },
        toggleEdit: () => { 
            state.status = state.status === "editing" ? "stopped" : "editing";
        },
        toggleMirror: () => { state.mirror = !state.mirror; },
        setHide: (value: boolean) => { state.hide = value; },
        setCast: (value: boolean) => { state.cast = value; },
        setFontSize: (value: number) => { state.fontSize = value; },
        setMargin: (value: number) => { state.margin = value; },
        setOpacity: (value: number) => { state.opacity = value; },
        incrementTimer: () => { state.timer += 1; },
        resetTimer: () => { state.timer = 0; },
        setAlign: (value: Align) => { state.align = value; },
        setCollaborate: (value: boolean) => { state.collaborate = value; },
    };

    // 3. Return the public interface (Runes Store pattern)
    return {
        // Expose state properties via getters for reactive consumption
        get status() { return state.status; },
        get mirror() { return state.mirror; },
        get hide() { return state.hide; },
        get fontSize() { return state.fontSize; },
        get margin() { return state.margin; },
        get opacity() { return state.opacity; },
        get timer() { return state.timer; },
        get cast() { return state.cast; },
        get align() { return state.align; },
        get collaborate() { return state.collaborate; },

        // Expose all actions
        ...actions,
    };
}

export const navbarStore = createNavbarStore();
