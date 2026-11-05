"use client";

import { useEffect, useState } from "react";
import { serverMessageSchema } from "@avaclash/shared";
import { RELAY_URL } from "@/config/env";

type Feed = {
  moves: string[];
  status: "waiting" | "live" | "finished" | "retrying";
};
const initial: Feed = { moves: [], status: "waiting" };

export function useSpectatorMoves(roomId: number) {
  const [feed, setFeed] = useState(initial);
  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout>;
    let socket: WebSocket;

    function reconnect() {
      if (stopped) return;
      setFeed((previous) => ({ ...previous, status: "retrying" }));
      retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 15_000));
    }

    function connect() {
      try {
        socket = new WebSocket(RELAY_URL);
      } catch {
        reconnect();
        return;
      }

      const current = socket;
      let moves: string[] | undefined;
      current.onopen = () => {
        current.send(
          JSON.stringify({ type: "join_room", role: "spectator", roomId }),
        );
      };
      current.onmessage = ({ data }) => {
        if (stopped || current !== socket || typeof data !== "string") return;
        let raw: unknown;
        try {
          raw = JSON.parse(data);
        } catch {
          return;
        }
        const parsed = serverMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        const message = parsed.data;
        if (message.type === "error") {
          current.close();
          return;
        }
        if (!("roomId" in message) || message.roomId !== roomId) return;
        if (message.type === "room_state") {
          attempts = 0;
          moves = message.moves;
          setFeed({
            moves,
            status: message.status === "finished" ? "finished" : "live",
          });
        } else if (message.type === "move" && moves) {
          if (message.seq > moves.length) current.close();
          if (message.seq === moves.length) {
            moves = [...moves, message.uci];
            setFeed({ moves, status: "live" });
          }
        } else if (message.type === "game_finished") {
          moves = message.moves ?? moves ?? [];
          setFeed({ moves, status: "finished" });
        }
      };
      current.onclose = reconnect;
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [roomId]);
  return feed;
}
