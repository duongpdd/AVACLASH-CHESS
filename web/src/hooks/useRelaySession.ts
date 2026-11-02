import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import {
  RelayClient,
  type ConnectionStatus,
  type RoomStateMessage,
  type ResultProposalMessage,
  type FocusWarningMessage,
  type SeenTerminalEvents,
  type GameFinishedMessage,
  buildBoundJoinTypedData,
  ReasonCode,
} from "@avaclash/shared";
import { RELAY_URL, ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";

export interface RelaySessionOptions {
  relayUrl?: string;
  autoConnect?: boolean;
}

export function useRelaySession(
  roomId?: number | bigint,
  options: RelaySessionOptions = {},
) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [roomState, setRoomState] = useState<RoomStateMessage | undefined>(
    undefined,
  );
  const [moves, setMoves] = useState<string[]>([]);
  const [whiteMs, setWhiteMs] = useState<number>(300000);
  const [blackMs, setBlackMs] = useState<number>(300000);

  const [seenEvents, setSeenEvents] = useState<SeenTerminalEvents>({});
  const [resultProposal, setResultProposal] =
    useState<ResultProposalMessage | null>(null);
  const [relaySignature, setRelaySignature] = useState<`0x${string}` | null>(
    null,
  );
  const [gameFinished, setGameFinished] = useState(false);
  const [focusWarning, setFocusWarning] = useState<FocusWarningMessage | null>(
    null,
  );
  const [error, setError] = useState<{ message: string; id: number } | null>(
    null,
  );
  const errorIdRef = useRef(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);
  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);

  const clientRef = useRef<RelayClient | null>(null);

  // Sync clock anchors for interpolation
  const lastSyncRef = useRef<{
    time: number;
    whiteMs: number;
    blackMs: number;
    turn: "w" | "b";
    status: string;
  }>({
    time: 0,
    whiteMs: 300000,
    blackMs: 300000,
    turn: "w",
    status: "waiting",
  });

  const signTypedDataAsyncRef = useRef(signTypedDataAsync);
  useEffect(() => {
    signTypedDataAsyncRef.current = signTypedDataAsync;
  }, [signTypedDataAsync]);

  const parsedRoomId = roomId !== undefined ? Number(roomId) : undefined;
  const relayUrl = options.relayUrl ?? RELAY_URL;
  const autoConnect = options.autoConnect ?? true;

  // Initialize RelayClient instance
  useEffect(() => {
    // A wallet/room change starts an independent external session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoomState(undefined);
    setMoves([]);
    setWhiteMs(300000);
    setBlackMs(300000);
    setSeenEvents({});
    setResultProposal(null);
    setRelaySignature(null);
    setGameFinished(false);
    setFocusWarning(null);
    setIncomingDrawOffer(false);
    setError(null);
    setConnectionStatus("idle");
    lastSyncRef.current = {
      time: 0,
      whiteMs: 300000,
      blackMs: 300000,
      turn: "w",
      status: "waiting",
    };
    if (
      parsedRoomId === undefined ||
      !Number.isSafeInteger(parsedRoomId) ||
      parsedRoomId < 0 ||
      !address
    )
      return;
    const storageKey = `avaclash:moves:${CHAIN_ID}:${ESCROW_ADDRESS.toLowerCase()}:${parsedRoomId}:${address.toLowerCase()}`;
    const persistMoves = (confirmedMoves: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(confirmedMoves));
      } catch {
        /* Storage is optional. */
      }
    };
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      );
      if (
        Array.isArray(saved) &&
        saved.every(
          (move: unknown) =>
            typeof move === "string" &&
            /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move),
        )
      ) {
        setMoves(saved);
      }
    } catch {
      /* Relay state remains authoritative when storage is unavailable. */
    }

    const WebSocketImpl =
      typeof window !== "undefined" && window.WebSocket
        ? window.WebSocket
        : globalThis.WebSocket;

    const client = new RelayClient({
      url: relayUrl,
      WebSocketImpl,
      signTypedData: async (typedData) => {
        if (!signTypedDataAsyncRef.current)
          throw new Error("Wallet signer not available");
        return signTypedDataAsyncRef.current(
          typedData as ReturnType<typeof buildBoundJoinTypedData>,
        );
      },
      getAddress: () => {
        if (!address) throw new Error("Wallet not connected");
        return address;
      },
      chainId: CHAIN_ID,
      escrowAddress: ESCROW_ADDRESS,
    });

    clientRef.current = client;

    const syncSeenFromClient = (
      customRoomState?: RoomStateMessage,
      gameFinishedMsg?: GameFinishedMessage,
    ) => {
      const clientSeen = client.getSeenTerminalEvents?.() ?? {};
      const finished = gameFinishedMsg || client.getFinishedInfo?.();
      const currentRoomState = customRoomState || client.getRoomState?.();

      if (finished?.moves && Array.isArray(finished.moves)) {
        const finishedMoves = finished.moves;
        setMoves((prev) => (prev.length === 0 ? finishedMoves : prev));
      } else if (typeof client.getMoves === "function") {
        const clientMoves = client.getMoves();
        if (clientMoves && clientMoves.length > 0) {
          setMoves((prev) => (prev.length === 0 ? clientMoves : prev));
        }
      }

      setSeenEvents((prev) => {
        const merged: SeenTerminalEvents = { ...prev, ...clientSeen };
        if (finished) {
          const r =
            typeof finished.reason === "string"
              ? finished.reason.toLowerCase()
              : "";
          if (r === "resign" || finished.reason === ReasonCode.Resign) {
            merged.resignSeen = true;
            if (!merged.resignerColor && finished.winner && currentRoomState) {
              const w = finished.winner.toLowerCase();
              if (currentRoomState.white.toLowerCase() === w) {
                merged.resignerColor = "b";
              } else if (currentRoomState.black?.toLowerCase() === w) {
                merged.resignerColor = "w";
              }
            }
          } else if (
            r === "timeout" ||
            finished.reason === ReasonCode.Timeout
          ) {
            merged.timeoutSeen = true;
            if (!merged.timeoutPlayer && finished.winner && currentRoomState) {
              const w = finished.winner.toLowerCase();
              if (currentRoomState.white.toLowerCase() === w) {
                merged.timeoutPlayer = "b";
              } else if (currentRoomState.black?.toLowerCase() === w) {
                merged.timeoutPlayer = "w";
              }
            }
          } else if (
            r === "agreement" ||
            r === "draw_agreed" ||
            finished.reason === ReasonCode.Agreement
          ) {
            merged.drawAcceptSeen = true;
          }
        }
        return merged;
      });
    };

    // Attach typed event listeners
    const unsubs = [
      client.on("connectionStatus", (status) => {
        setConnectionStatus(status);
      }),

      client.on("roomState", (state) => {
        setRoomState(state);
        setMoves(state.moves);
        persistMoves(state.moves);
        setWhiteMs(state.whiteMs);
        setBlackMs(state.blackMs);
        const turn = state.moves.length % 2 === 0 ? "w" : "b";
        lastSyncRef.current = {
          time: Date.now(),
          whiteMs: state.whiteMs,
          blackMs: state.blackMs,
          turn,
          status: state.status,
        };
        if (state.status === "finished") {
          setGameFinished(true);
        }
        syncSeenFromClient(state);
      }),

      client.on("move", (move) => {
        setIncomingDrawOffer(false);
        setMoves((prev) => {
          const next = [...prev, move.uci];
          persistMoves(next);
          const turn = next.length % 2 === 0 ? "w" : "b";
          lastSyncRef.current.turn = turn;
          lastSyncRef.current.time = Date.now();
          return next;
        });
      }),

      client.on("clockSync", (clock) => {
        setWhiteMs(clock.whiteMs);
        setBlackMs(clock.blackMs);
        lastSyncRef.current.whiteMs = clock.whiteMs;
        lastSyncRef.current.blackMs = clock.blackMs;
        lastSyncRef.current.time = Date.now();
      }),

      client.on("resign", (msg) => {
        setSeenEvents((prev) => ({
          ...prev,
          resignSeen: true,
          resignerColor: msg.player ?? prev.resignerColor,
        }));
      }),

      client.on("timeout", (msg) => {
        setSeenEvents((prev) => ({
          ...prev,
          timeoutSeen: true,
          timeoutPlayer: msg.player ?? prev.timeoutPlayer,
        }));
      }),

      client.on("drawOffer", () => {
        setIncomingDrawOffer(true);
      }),

      client.on("drawAccept", () => {
        setIncomingDrawOffer(false);
        setSeenEvents((prev) => ({ ...prev, drawAcceptSeen: true }));
      }),

      client.on("drawDecline", () => {
        setIncomingDrawOffer(false);
      }),

      client.on("resultProposal", (proposal) => {
        setRelaySignature(null);
        setResultProposal(proposal);
      }),

      client.on("resultSignature", (sig) => {
        setRelaySignature(sig.signature as `0x${string}`);
      }),

      client.on("gameFinished", (msg) => {
        setGameFinished(true);
        setIncomingDrawOffer(false);
        lastSyncRef.current.status = "finished";
        setRoomState((prev) => (prev ? { ...prev, status: "finished" } : prev));
        if (msg.moves && Array.isArray(msg.moves)) {
          setMoves(msg.moves);
          persistMoves(msg.moves);
        }
        syncSeenFromClient(undefined, msg);
      }),

      client.on("focusWarning", (warn) => {
        setFocusWarning(warn);
      }),

      client.on("error", (err) => {
        errorIdRef.current += 1;
        setError({ message: err.message, id: errorIdRef.current });
      }),
    ];

    // Initial sync from client if reconnecting or reloading page
    syncSeenFromClient();

    if (autoConnect) {
      client.connect(parsedRoomId);
    }

    return () => {
      unsubs.forEach((u) => u());
      client.disconnect();
      clientRef.current = null;
    };
  }, [parsedRoomId, relayUrl, autoConnect, address]);

  // Local Clock Interpolation between clock_sync ticks
  useEffect(() => {
    const interval = setInterval(() => {
      const sync = lastSyncRef.current;
      if (
        sync.status !== "active" ||
        connectionStatus === "idle" ||
        connectionStatus === "disconnected"
      )
        return;

      const elapsed = Date.now() - sync.time;
      if (sync.turn === "w") {
        setWhiteMs(Math.max(0, sync.whiteMs - elapsed));
        setBlackMs(sync.blackMs);
      } else {
        setWhiteMs(sync.whiteMs);
        setBlackMs(Math.max(0, sync.blackMs - elapsed));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Determine user's color in the room
  const myColor: "w" | "b" | "spectator" | undefined = (() => {
    if (!roomState || !address) return undefined;
    const lower = address.toLowerCase();
    if (roomState.white.toLowerCase() === lower) return "w";
    if (roomState.black && roomState.black.toLowerCase() === lower) return "b";
    return "spectator";
  })();

  const isMyTurn = (() => {
    if (
      gameFinished ||
      connectionStatus !== "connected" ||
      !roomState ||
      roomState.status !== "active" ||
      !myColor ||
      myColor === "spectator"
    ) {
      return false;
    }
    const currentTurn = moves.length % 2 === 0 ? "w" : "b";
    return myColor === currentTurn;
  })();

  const sendMove = useCallback((uci: string) => {
    if (!clientRef.current) throw new Error("RelayClient not connected");
    clientRef.current.sendMove(uci);
  }, []);

  const sendResign = useCallback(() => {
    clientRef.current?.sendResign();
  }, []);

  const sendDrawOffer = useCallback(() => {
    clientRef.current?.sendDrawOffer();
  }, []);

  const sendDrawAccept = useCallback(() => {
    clientRef.current?.sendDrawAccept();
    setIncomingDrawOffer(false);
  }, []);

  const sendDrawDecline = useCallback(() => {
    clientRef.current?.sendDrawDecline();
    setIncomingDrawOffer(false);
  }, []);

  const sendTimeout = useCallback(() => {
    clientRef.current?.sendTimeout();
  }, []);

  const sendFocusWarning = useCallback(
    (warningCount = 1) => {
      if (!clientRef.current) return;
      const color = myColor === "w" || myColor === "b" ? myColor : undefined;
      if (color) {
        clientRef.current.sendFocusWarning(color, warningCount, 0);
      }
    },
    [myColor],
  );

  const requestResult = useCallback(() => {
    clientRef.current?.requestResult();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    if (parsedRoomId !== undefined && clientRef.current) {
      clientRef.current.connect(parsedRoomId);
    }
  }, [parsedRoomId]);

  return {
    connectionStatus,
    isConnected: connectionStatus === "connected",
    isReconnecting: connectionStatus === "reconnecting",
    isDisconnected: connectionStatus === "disconnected",
    roomState,
    moves,
    whiteMs,
    blackMs,
    myColor,
    isMyTurn,
    seenEvents,
    resultProposal,
    relaySignature,
    gameFinished,
    focusWarning,
    error,
    clearError,
    incomingDrawOffer,
    sendMove,
    sendResign,
    sendDrawOffer,
    sendDrawAccept,
    sendDrawDecline,
    sendTimeout,
    sendFocusWarning,
    requestResult,
    disconnect,
    reconnect,
  };
}
