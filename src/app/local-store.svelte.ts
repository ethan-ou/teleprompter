// The version of the stored data structure
const DATA_VERSION = 0;

interface VersionedData<T> {
  state: T;
  version: number;
}

export class LocalStore<T> {
  value = $state<T>() as T;
  key = '';

  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
    
    const item = localStorage.getItem(key);
    if (item) {
      try {
        const parsed: VersionedData<T> = this.deserialize(item);
        if (parsed.version === DATA_VERSION) {
          this.value = parsed.state;
        } else {
          console.warn(`Data version mismatch for key "${key}". Loaded version: ${parsed.version}, current version: ${DATA_VERSION}. Using default value.`);
        }
      } catch (e) {
        console.warn(`Failed to parse stored item for key "${key}"`, e);
        this.value = value;
      }
    }

    $effect.root(() => {
      $effect(() => {
        const dataToStore: VersionedData<T> = {
          state: this.value,
          version: DATA_VERSION,
        };
        localStorage.setItem(this.key, this.serialize(dataToStore));
      });
      // A cleanup function is optional for this use case, but can be added here
      // if you had a more complex effect that needed to be cleaned up.
      return () => {};
    });
  }

  serialize(data: VersionedData<T>): string {
    return JSON.stringify(data);
  }

  deserialize(item: string): VersionedData<T> {
    return JSON.parse(item);
  }
}

export function localStore<T>(key: string, value: T) {
  return new LocalStore(key, value);
}