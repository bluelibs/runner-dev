/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { graphqlRequest } from "../../utils/graphqlClient";
import { SystemInfoPanel } from "./SystemInfoPanel";

jest.mock("../../utils/graphqlClient", () => ({ graphqlRequest: jest.fn() }));

const request = graphqlRequest as jest.MockedFunction<typeof graphqlRequest>;

describe("SystemInfoPanel", () => {
  afterEach(() => jest.resetAllMocks());

  it("shows host specs and identifies their scope", async () => {
    request.mockResolvedValue({
      live: {
        systemInfo: {
          platform: "Linux",
          architecture: "x64",
          cpuModel: "Example CPU",
          logicalCores: 8,
          totalMemory: 16 * 1024 ** 3,
          nodeVersion: "v22.12.0",
        },
      },
    });
    render(<SystemInfoPanel />);

    expect(await screen.findByText("Example CPU")).toBeTruthy();
    expect(screen.getByText("8 logical cores")).toBeTruthy();
    expect(screen.getByText("16.0 GB")).toBeTruthy();
    expect(screen.getByText("Server machine")).toBeTruthy();
    expect(screen.getByText("v22.12.0")).toBeTruthy();
    expect(request.mock.calls[0][0]).toContain("systemInfo");
  });

  it("keeps the live page usable if host details cannot load", async () => {
    request.mockRejectedValue(new Error("offline"));
    render(<SystemInfoPanel />);
    await waitFor(() =>
      expect(screen.getByText("Host details unavailable")).toBeTruthy()
    );
  });
});
