// @vitest-environment happy-dom
import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RoomLobbyWidget from "../components/RoomLobbyWidget";
const state = vi.hoisted(() => ({
  connected: true,
  createStep: "success",
  joinStep: "success",
  rooms: [] as {
    id: bigint;
    playerA: string;
    stakeFormatted: string;
    creatorIsWhite: boolean;
  }[],
  roomError: null as string | null,
  create: vi.fn(),
  join: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: state.connected }),
  useChainId: () => 43113,
}));
vi.mock("../config/wagmi", () => ({ targetChain: { id: 43113 } }));
vi.mock("../hooks/useClientMounted", () => ({ useClientMounted: () => true }));
vi.mock("../components/WalletAction", () => ({
  default: () => <button>Nối ví để tiếp tục</button>,
}));
vi.mock("../hooks/useContractBytecodeGuard", () => ({
  useContractBytecodeGuard: () => ({ isBlocked: false }),
}));
vi.mock("../hooks/useCreateRoom", () => ({
  useCreateRoom: () => ({
    step: state.createStep,
    createdRoomId: 6n,
    minStake: "0.01",
    uiMaxStake: "0.1",
    createRoom: state.create,
    reset: vi.fn(),
  }),
}));
vi.mock("../hooks/useJoinRoom", () => ({
  useJoinRoom: () => ({
    step: state.joinStep,
    joinRoom: state.join,
    reset: vi.fn(),
    room: {
      playerA: "0x1111111111111111111111111111111111111111",
      creatorIsWhite: true,
      status: 0,
    },
    exists: true,
    joinable: true,
    joinerColor: "Black",
    stakeFormatted: "0.01",
    isOpen: true,
  }),
}));
vi.mock("../hooks/useRoom", () => ({ useRoom: () => ({}) }));
vi.mock("../hooks/useOpenRooms", () => ({
  useOpenRooms: () => ({
    openRooms: state.rooms,
    errorMessage: state.roomError,
    refetch: vi.fn(),
  }),
}));
vi.mock("../hooks/useWithdraw", () => ({
  useWithdraw: () => ({ pendingBalance: 0n, step: "idle" }),
}));
beforeEach(() => {
  state.connected = true;
  state.createStep = "success";
  state.joinStep = "success";
  state.rooms = [];
  state.roomError = null;
  state.create.mockReset();
  state.join.mockReset();
});
afterEach(cleanup);
describe("Lobby room navigation", () => {
  it("links the creator to a URL understood by the game page", () => {
    render(<RoomLobbyWidget />);
    const href = screen
      .getByRole("link", { name: /Vào bàn chờ/ })
      .getAttribute("href");
    expect(href).toBe("/game?room=6");
  });
  it("links the joiner to the selected room using the same parameter", () => {
    render(<RoomLobbyWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Vào phòng/ }));
    fireEvent.change(screen.getByLabelText("Mã phòng từ bạn bè"), {
      target: { value: "6" },
    });
    expect(
      screen
        .getByRole("link", { name: /Vào bàn cờ ngay/ })
        .getAttribute("href"),
    ).toBe("/game?room=6");
  });
  it("previews room zero from the open list and waits for explicit confirmation before staking", () => {
    state.createStep = "idle";
    state.joinStep = "idle";
    state.rooms = [
      {
        id: 0n,
        playerA: "0x1111111111111111111111111111111111111111",
        stakeFormatted: "0.01",
        creatorIsWhite: true,
      },
    ];
    render(<RoomLobbyWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Chọn phòng #0" }));
    expect(
      (screen.getByLabelText("Mã phòng từ bạn bè") as HTMLInputElement).value,
    ).toBe("0");
    expect(screen.getByText("Đen · Đi sau")).toBeDefined();
    expect(state.join).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận vào phòng/ }));
    expect(state.join).toHaveBeenCalledWith(0n);
  });
  it("puts connection ahead of staking and identifies the current step", () => {
    state.connected = false;
    state.createStep = "idle";
    state.joinStep = "idle";
    render(<RoomLobbyWidget />);
    expect(
      screen.getByRole("button", { name: "Nối ví để tiếp tục" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /Tạo phòng ·/ })).toBeNull();
    expect(
      screen
        .getByText("Nối ví đúng mạng")
        .closest("li")
        ?.getAttribute("aria-current"),
    ).toBe("step");
    expect(state.create).not.toHaveBeenCalled();
  });
  it("does not label an RPC failure as an empty lobby", () => {
    state.roomError = "RPC unavailable";
    render(<RoomLobbyWidget />);
    expect(screen.getByText("Chưa tải được phòng")).toBeDefined();
    expect(screen.queryByText("Chưa có ai ngồi vào bàn")).toBeNull();
  });
  it("supports keyboard switching between create and join", () => {
    render(<RoomLobbyWidget />);
    const create = screen.getByRole("tab", { name: /Tạo phòng/ });
    create.focus();
    fireEvent.keyDown(create, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("tab", { name: /Vào phòng/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: /Vào phòng/ }),
    );
  });
});
