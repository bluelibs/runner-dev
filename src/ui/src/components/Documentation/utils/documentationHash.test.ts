import { getHashScrollTargetId } from "./documentationHash";

describe("documentationHash", () => {
  it("scrolls to the topology section only for the plain topology anchor", () => {
    expect(getHashScrollTargetId("#topology")).toBe("topology");
    expect(getHashScrollTargetId("#topology/resource/app")).toBeNull();
    expect(getHashScrollTargetId("#topology?view=mindmap")).toBeNull();
  });

  it("returns regular section and element ids unchanged", () => {
    expect(getHashScrollTargetId("#overview")).toBe("overview");
    expect(getHashScrollTargetId("#element-task.build")).toBe(
      "element-task.build"
    );
  });

  it("ignores empty hashes", () => {
    expect(getHashScrollTargetId("")).toBeNull();
    expect(getHashScrollTargetId("#")).toBeNull();
    expect(getHashScrollTargetId(null)).toBeNull();
  });
});
