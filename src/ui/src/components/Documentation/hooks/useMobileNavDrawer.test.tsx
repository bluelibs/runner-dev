import { act, renderHook } from "@testing-library/react";
import { useMobileNavDrawer } from "./useMobileNavDrawer";

describe("useMobileNavDrawer", () => {
  it("starts closed and toggles open and shut", () => {
    const { result } = renderHook(() => useMobileNavDrawer());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it("closes when the reader navigates to another hash", () => {
    const { result } = renderHook(() => useMobileNavDrawer());
    act(() => result.current.open());

    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("closes on Escape but ignores other keys", () => {
    const { result } = renderHook(() => useMobileNavDrawer());
    act(() => result.current.open());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("stops listening once closed", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const { result } = renderHook(() => useMobileNavDrawer());
    act(() => result.current.open());
    act(() => result.current.close());

    expect(removeSpy).toHaveBeenCalledWith("hashchange", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
