/** @jest-environment node */

import {
  getLastInputModality,
  recordInputModality,
  shouldAutofocusTableSearch,
} from "./inputModality";

describe("inputModality", () => {
  it("starts with no signal and remembers the latest modality", () => {
    expect(getLastInputModality()).toBeNull();
    recordInputModality("keyboard");
    expect(getLastInputModality()).toBe("keyboard");
    recordInputModality("pointer");
    expect(getLastInputModality()).toBe("pointer");
  });

  it("autofocuses table search unless the keyboard is driving", () => {
    expect(shouldAutofocusTableSearch(null)).toBe(true);
    expect(shouldAutofocusTableSearch("pointer")).toBe(true);
    expect(shouldAutofocusTableSearch("keyboard")).toBe(false);
  });
});
