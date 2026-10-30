import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import {
  RelayClient,
  type ConnectionStatus,
  type RoomStateMessage,
  type ResultProposalMessage,
  type FocusWarningMessage,
  type SeenTerminalEvents,
} from "@avaclash/shared";
import { RELAY_URL, ESCROW_ADDRESS, CHAIN_ID } from "@/config/env";

export interface RelaySessionOptions {
  relayUrl?: string;
  autoConnect?: boolean;
}

export function useRelaySession(
  roomId?: number | bigint,
  options: RelaySessionOptions = {}
) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [roomState, setRoomState] = useState<RoomStateMessage | undefined>(
    undefined
  );
  const [moves, setMoves] = useState<string[]>([]);
  const [whiteMs, setWhiteMs] = useState<number>(300000);
  const [blackMs, setBlackMs] = useState<number>(300000);

  const [seenEvents, setSeenEvents] = useState<SeenTerminalEvents>({});
  const [resultProposal, setResultProposal] =
    useState<ResultProposalMessage | null>(null);
  const [relaySignature, setRelaySignature] = useState<`0x${string}` | null>(
    null
  );
  const [gameFinished, setGameFinished] = useState(false);
  const [focusWarning, setFocusWarning] = useState<FocusWarningMessage | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
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
    time: Date.now(),
    whiteMs: 300000,
    blackMs: 300000,
    turn: "w",
    status: "waiting",
  });

  const parsedRoomId = roomId !== undefined ? Number(roomId) : undefined;
  const relayUrl = options.relayUrl ?? RELAY_URL;
  const autoConnect = options.autoConnect ?? true;

  // Initialize RelayClient instance
  useEffect(() => {
    if (parsedRoomId === undefined) return;

    const WebSocketImpl =
      typeof window !== "undefined" && window.WebSocket
        ? window.WebSocket
        : (globalThis as any).WebSocket;

    const client = new RelayClient({
      url: relayUrl,
      WebSocketImpl,
      signTypedData: async (typedData) => {
        return (await signTypedDataAsync(typedData as any)) as `0x${string}`;
      },
      getAddress: () => {
        if (!address) throw new Error("Wallet not connected");
        return address;
      },
      chainId: CHAIN_ID,
      escrowAddress: ESCROW_ADDRESS,
    });

    clientRef.current = client;

    // Attach typed event listeners
    const unsubs = [
      client.on("connectionStatus", (status) => {
        setConnectionStatus(status);
      }),

      client.on("roomState", (state) => {
        setRoomState(state);
        setMoves(state.moves);
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
      }),

      client.on("move", (move) => {
        setMoves((prev) => {
          const next = [...prev, move.uci];
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

      client.on("resign", () => {
        setSeenEvents((prev) => ({ ...prev, resignSeen: true }));
      }),

      client.on("timeout", () => {
        setSeenEvents((prev) => ({ ...prev, timeoutSeen: true }));
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
        setResultProposal(proposal);
      }),

      client.on("resultSignature", (sig) => {
        setRelaySignature(sig.signature as `0x${string}`);
      }),

      client.on("gameFinished", () => {
        setGameFinished(true);
      }),

      client.on("focusWarning", (warn) => {
        setFocusWarning(warn);
      }),

      client.on("error", (err) => {
        setError(err.message);
      }),
    ];

    if (autoConnect) {
      client.connect(parsedRoomId);
    }

    return () => {
      unsubs.forEach((u) => u());
      client.disconnect();
      clientRef.current = null;
    };
  }, [parsedRoomId, relayUrl, autoConnect, address, signTypedDataAsync]);

  // Local Clock Interpolation between clock_sync ticks
  useEffect(() => {
    const interval = setInterval(() => {
      const sync = lastSyncRef.current;
      if (sync.status !== "active" || connectionStatus !== "connected") return;

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
    if (!roomState || roomState.status !== "active" || !myColor || myColor === "spectator") {
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
    incomingDrawOffer,
    sendMove,
    sendResign,
    sendDrawOffer,
    sendDrawAccept,
    sendDrawDecline,
    sendTimeout,
    requestResult,
    disconnect,
    reconnect,
  };
}
