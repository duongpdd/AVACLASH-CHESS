// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render";
import { afterEach, expect, it, vi } from "vitest";
import {
  createConfig,
  http,
  mock,
  ProviderNotFoundError,
  useDisconnect,
  WagmiProvider,
} from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import WalletGate from "../components/wallet-gate";
import { AuthProvider } from "@/providers/auth-provider";
import { LoginView } from "../views/login/login-view";
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/vi.json";

const route = vi.hoisted(() => ({
  pathname: "/profile",
  next: "",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => route,
  useSearchParams: () => new URLSearchParams({ next: route.next }),
}));
vi.mock("wagmi", async (importOriginal) => {
  const wagmi = await importOriginal<typeof import("wagmi")>();
  return {
    ...wagmi,
    useSignMessage: () => ({ signMessageAsync: async () => "0x1234" }),
  };
});
vi.mock("@/components/app-header", () => ({ default: () => null }));

const actions = vi.hoisted(() => ({
  address: "0x0000000000000000000000000000000000000001" as const,
  start: vi.fn(),
  finish: vi.fn(),
  restore: vi.fn(),
  end: vi.fn(),
}));
vi.mock("@/auth/actions", () => ({
  startWalletLogin: actions.start,
  finishWalletLogin: actions.finish,
  restoreWalletSession: actions.restore,
  endWalletSession: actions.end,
}));

function testSession() {
  return {
    token: "test-session",
    user: { address: actions.address },
    expiresAt: Date.now() + 60_000,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  route.replace.mockClear();
  window.history.replaceState(null, "", "/");
  route.pathname = "/profile";
  route.next = "";
  localStorage.clear();
  vi.clearAllMocks();
});

function PageContent({ title }: { title: string }) {
  const { disconnect } = useDisconnect();
  return (
    <>
      <h1>{title}</h1>
      <button type="button" onClick={() => disconnect()}>
        Ngắt ví
      </button>
    </>
  );
}

function renderRoute(
  login = false,
  previouslyConnected = false,
  connectError?: Error,
) {
  const session = testSession();
  actions.start.mockResolvedValue({ message: "Sign in to AvaClash" });
  actions.finish.mockResolvedValue({ session });
  actions.restore.mockResolvedValue(session);
  actions.end.mockResolvedValue(undefined);
  if (previouslyConnected)
    localStorage.setItem("avaclash.session", JSON.stringify(session));
  const config = createConfig({
    chains: [avalancheFuji],
    connectors: [
      mock({
        accounts: [actions.address],
        features: {
          reconnect: true,
          defaultConnected: previouslyConnected,
          connectError,
        },
      }),
    ],
    transports: { [avalancheFuji.id]: http() },
    ssr: true,
  });

  const queryClient = new QueryClient();
  render(
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="vi" messages={messages}>
          <AuthProvider>
            {login ? (
              <LoginView />
            ) : (
              <WalletGate
                serverAddress={
                  previouslyConnected ? actions.address : undefined
                }
              >
                <PageContent title="Hồ sơ" />
              </WalletGate>
            )}
          </AuthProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    </WagmiProvider>,
  );
}

it("redirects a disconnected workspace visitor and preserves its query and fragment", async () => {
  route.pathname = "/tournaments/play";
  window.history.replaceState(null, "", "/tournaments/play?id=0&room=3#match");
  renderRoute();
  expect(screen.queryByRole("heading", { name: "Hồ sơ" })).toBeNull();
  await waitFor(() =>
    expect(route.replace).toHaveBeenCalledWith(
      "/login?next=%2Ftournaments%2Fplay%3Fid%3D0%26room%3D3%23match",
    ),
  );
});

it("returns to a workspace deep link after connecting on the login page", async () => {
  route.next = "/tournaments/play?id=0&room=3";
  renderRoute(true);
  expect(
    screen
      .getByRole("link", { name: "Chơi cùng thiết bị" })
      .getAttribute("href"),
  ).toBe("/hotseat");
  expect(
    screen.getByRole("link", { name: "Giải thế cờ" }).getAttribute("href"),
  ).toBe("/practice");
  const connect = screen.getByRole<HTMLButtonElement>("button", {
    name: "Kết nối Mock Connector",
  });
  await waitFor(() => expect(connect.disabled).toBe(false));
  fireEvent.click(connect);
  const sign = await screen.findByRole("button", { name: "Ký để đăng nhập" });
  expect(route.replace).not.toHaveBeenCalled();
  fireEvent.click(sign);
  await waitFor(() => expect(route.replace).toHaveBeenCalledWith(route.next));
  expect(actions.finish).toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("avaclash.session")!)).toMatchObject({
    token: "test-session",
    user: { address: actions.address },
  });
});

it("returns to Play when a supplied destination is external", async () => {
  route.next = "//example.com";
  renderRoute(true, true);
  await waitFor(() => expect(route.replace).toHaveBeenCalledWith("/"));
});

it("admits a reconnected wallet and leaves the workspace on disconnect", async () => {
  renderRoute(false, true);
  await screen.findByRole("heading", { name: "Hồ sơ" });
  expect(route.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ngắt ví" }));
  await waitFor(() =>
    expect(route.replace).toHaveBeenCalledWith("/login?next=%2Fprofile"),
  );
  expect(localStorage.getItem("avaclash.session")).toBeNull();
});

it("offers wallet setup and preserves the full invite URL when copying", async () => {
  route.next = "/tournaments/play?id=0&room=3#match";
  window.history.replaceState(
    null,
    "",
    `/login?next=${encodeURIComponent(route.next)}`,
  );
  const copy = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValueOnce(new Error("Clipboard unavailable"))
    .mockResolvedValue(undefined);
  renderRoute(true, false, new ProviderNotFoundError());

  const connect = screen.getByRole<HTMLButtonElement>("button", {
    name: "Kết nối Mock Connector",
  });
  await waitFor(() => expect(connect.disabled).toBe(false));
  fireEvent.click(connect);
  await screen.findByRole("alert");
  expect(screen.getByRole("link", { name: "Tải MetaMask" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Cách cài Core" })).toBeTruthy();

  const copyLink = screen.getByRole("button", { name: "Sao chép liên kết" });
  fireEvent.click(copyLink);
  await screen.findByText(/sao chép liên kết từ thanh địa chỉ/i);
  fireEvent.click(copyLink);
  await screen.findByText(/Đã sao chép/);
  expect(copy).toHaveBeenLastCalledWith(
    new URL(route.next, window.location.origin).href,
  );
});
