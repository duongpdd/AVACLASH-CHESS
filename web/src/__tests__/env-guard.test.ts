// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { validateAddressConfig, ZERO_ADDRESS } from "../config/env";
import { useContractBytecodeGuard } from "../hooks/useContractBytecodeGuard";

const mockGetCode = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => ({
    chain: { id: 43113 },
    getCode: mockGetCode,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function TestQueryProvider({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("Env Address Validation", () => {
  it("rejects undefined or empty address", () => {
    const res = validateAddressConfig(undefined);
    expect(res.valid).toBe(false);
  });

  it("rejects invalid format address", () => {
    const res = validateAddressConfig("not-an-address");
    expect(res.valid).toBe(false);
  });

  it("rejects zero address 0x0000000000000000000000000000000000000000", () => {
    const res = validateAddressConfig(ZERO_ADDRESS);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("0x0");
  });

  it("accepts valid non-zero contract address", () => {
    const res = validateAddressConfig(
      "0x54101e4a2d3c9071c775efcf4bbbeea8dc5057a1",
    );
    expect(res.valid).toBe(true);
  });
});

describe("useContractBytecodeGuard", () => {
  const validAddress =
    "0x54101e4a2d3c9071c775efcf4bbbeea8dc5057a1" as `0x${string}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks operations when address is 0x0 placeholder", async () => {
    const { result } = renderHook(
      () => useContractBytecodeGuard(ZERO_ADDRESS),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.hasConfigError).toBe(true);
    expect(result.current.isBlocked).toBe(true);
    expect(result.current.errorMessage).toContain("địa chỉ 0x0");
    expect(mockGetCode).not.toHaveBeenCalled();
  });

  it("blocks operations and flags config error when contract bytecode is empty (0x)", async () => {
    mockGetCode.mockResolvedValue("0x");

    const { result } = renderHook(
      () => useContractBytecodeGuard(validAddress),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasConfigError).toBe(true);
    expect(result.current.isBlocked).toBe(true);
    expect(result.current.errorMessage).toContain("Không tìm thấy bytecode");
  });

  it("allows operations when valid contract bytecode is present", async () => {
    mockGetCode.mockResolvedValue("0x608060405234801561001057600080fd5b50");

    const { result } = renderHook(
      () => useContractBytecodeGuard(validAddress),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasConfigError).toBe(false);
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });
});
