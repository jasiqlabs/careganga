export const AFTER_FIRST_UNLOCK = 1;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 2;
export const ALWAYS = 3;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 4;
export const ALWAYS_THIS_DEVICE_ONLY = 5;
export const WHEN_UNLOCKED = 6;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 7;

export async function isAvailableAsync(): Promise<boolean> {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function getItemAsync(key: string, _options?: unknown): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string, _options?: unknown): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

export async function deleteItemAsync(key: string, _options?: unknown): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

export function getItem(key: string, _options?: unknown): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string, _options?: unknown): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

export function deleteItem(key: string, _options?: unknown): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

const secureStoreWeb = {
  AFTER_FIRST_UNLOCK,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  ALWAYS,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  ALWAYS_THIS_DEVICE_ONLY,
  WHEN_UNLOCKED,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  isAvailableAsync,
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  getItem,
  setItem,
  deleteItem
};

export default secureStoreWeb;
