/** @jest-environment jsdom */

import { graphqlRequest } from "./graphqlClient";

describe("graphqlRequest", () => {
  test("fails before issuing a network request in catalog mode", async () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    window.__DOCS_PROPS__ = {
      mode: "catalog",
    } as any;

    await expect(graphqlRequest("query { tasks { id } }")).rejects.toThrow(
      "GraphQL is unavailable in the exported Runner-Dev catalog."
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    (global as any).fetch = originalFetch;
    delete window.__DOCS_PROPS__;
  });
});
