export function read(key, fallback) {
  try {
    const v = localStorage.getItem(`absensiswa:${key}`);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
export function write(key, value) {
  try {
    localStorage.setItem(`absensiswa:${key}`, JSON.stringify(value));
  } catch {
    throw new Error(
      "Unable to save locally. Free device storage or enable browser storage, then try again.",
    );
  }
}
