// Small per-browser memory for the "Getting started" checklist.

export function readFlag(name) {
  try {
    return localStorage.getItem(`sp_flag_${name}`) === "1";
  } catch {
    return false;
  }
}

export function setFlag(name) {
  try {
    localStorage.setItem(`sp_flag_${name}`, "1");
  } catch {
    // Checklist just won't remember this step
  }
}
