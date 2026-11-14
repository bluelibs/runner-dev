import { act, renderHook, waitFor } from "@testing-library/react";
import { usePollingFeed } from "./usePollingFeed";

afterEach(() => jest.useRealTimers());
test("retains successful data on failure and clears only its own error after retry", async () => {
  const load = jest
    .fn()
    .mockResolvedValueOnce(["saved"])
    .mockRejectedValueOnce(new Error("Disconnected"))
    .mockResolvedValue(["new"]);
  const onError = jest.fn();
  const { result } = renderHook(() =>
    usePollingFeed(load, [], true, onError, null)
  );
  await waitFor(() => expect(result.current.data).toEqual(["saved"]));
  const updatedAt = result.current.updatedAt;
  await act(async () => result.current.refresh());
  expect(result.current.data).toEqual(["saved"]);
  expect(result.current.error).toBe("Disconnected");
  expect(result.current.updatedAt).toBe(updatedAt);
  await act(async () => result.current.refresh());
  expect(result.current.data).toEqual(["new"]);
  expect(result.current.error).toBe("");
});
test("shares slow in-flight reads, stops polling when inactive, and ignores unmounted responses", async () => {
  jest.useFakeTimers();
  let finish!: (value: string[]) => void;
  const load = jest.fn(
    () =>
      new Promise<string[]>((resolve) => {
        finish = resolve;
      })
  );
  const onError = jest.fn();
  const { result, rerender, unmount } = renderHook(
    ({ enabled }) => usePollingFeed(load, [], enabled, onError),
    { initialProps: { enabled: true } }
  );
  act(() => {
    void result.current.refresh();
    jest.advanceTimersByTime(10000);
  });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => finish(["one"]));
  rerender({ enabled: false });
  act(() => jest.advanceTimersByTime(10000));
  expect(load).toHaveBeenCalledTimes(1);
  act(() => {
    void result.current.refresh();
  });
  unmount();
  await act(async () => finish(["late"]));
  expect(onError).not.toHaveBeenCalled();
});
