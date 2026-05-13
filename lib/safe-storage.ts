import { isQuotaExceededError } from "./utils";

export function getJsonItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Could not read ${key} from localStorage:`, error);
    throw new Error(
      `The saved data for "${key}" is damaged and could not be opened.`
    );
  }
}

export function setJsonItem(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new Error(
        "The iPad storage is full. Please download existing PDFs or remove old rentals/photos, then try again."
      );
    }
    throw error;
  }
}

export function setTextItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new Error(
        "The iPad storage is full. Please shorten the saved text or remove old rentals/photos, then try again."
      );
    }
    throw error;
  }
}
