import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import WebSocket from "ws";
import {
  parseEther,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import { RelayServer } from "../src/RelayServer.js";
import {
  startAnvil,
  isAnvilAvailable,
  deployContractsOnAnvil,
  ANVIL_ACCOUNTS,
  type AnvilInstance,
} from "./helpers/anvil.js";
import {
  EIP712_TYPES,
  buildJoinTypedData,
  OutcomeCode,
} from "@avaclash/shared";

describe("RelayServer Anvil End-to-End Integration", () => {
  let anvil: AnvilInstance | null = null;
  let server: RelayServer;
  let relayPort: number;
  let escrowAddress: `0x${string}`;
  let escrowAbi: any;
  let relayAccount: ReturnType<typeof privateKeyToAccount>;
  let aliceAccount: ReturnType<typeof privateKeyToAccount>;
  let bobAccount: ReturnType<typeof privateKeyToAccount>;
  let charlieAccount: ReturnType<typeof privateKeyToAccount>;
  let activeRoomId: number = 0;

  beforeAll(async () => {
    if (!isAnvilAvailable()) {
      console.warn("[SKIP] Anvil binary not found in PATH. Skipping anvil integration tests.");
      return;
    }

    anvil = await startAnvil();
    const deployed = await deployContractsOnAnvil(anvil);
    escrowAddress = deployed.escrowAddress;
    escrowAbi = deployed.escrowAbi;
    relayAccount = deployed.relayAccount;

    aliceAccount = privateKeyToAccount(ANVIL_ACCOUNTS[4].privateKey);
    bobAccount = privateKeyToAccount(ANVIL_ACCOUNTS[5].privateKey);
    charlieAccount = privateKeyToAccount(ANVIL_ACCOUNTS[6].privateKey);

    relayPort = 9200 + Math.floor(Math.random() * 500);
    server = new RelayServer({
      port: relayPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
    });
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.close();
    }
    if (anvil) {
      anvil.stop();
    }
  });

  async function createAndGetRoomId(
    wallet: any,
    creatorIsWhite: boolean,
    stake = "0.05"
  ): Promise<number> {
    const currentNextId: any = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "nextRoomId",
    });
    const roomId = Number(currentNextId);
    const tx = await wallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "createRoom",
      args: [creatorIsWhite],
      value: parseEther(stake),
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: tx });
    return roomId;
  }

  async function connectAndAuthenticate(
    roomId: number,
    account: ReturnType<typeof privateKeyToAccount>,
    role?: "player" | "spectator"
  ): Promise<{ ws: WebSocket; roomStateMsg: any; authChallenge: any }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${relayPort}`);
      let authChallenge: any = null;

      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("connectAndAuthenticate timed out"));
      }, 5000);

      ws.on("open", () => {});

      ws.on("message", async (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_challenge") {
          authChallenge = msg;
          if (role === "spectator") {
            ws.send(JSON.stringify({ type: "join_room", roomId, role: "spectator" }));
          } else {
            const typedData = buildJoinTypedData(
              roomId,
              account.address,
              msg.nonce as Hex,
              msg.expiresAt,
              31337
            );
            const signature = await account.signTypedData(typedData);

            ws.send(
              JSON.stringify({
                type: "join_room",
                roomId,
                address: account.address,
                signature,
                nonce: msg.nonce,
              })
            );
          }
        } else if (msg.type === "room_state" || msg.type === "error") {
          clearTimeout(timer);
          resolve({ ws, roomStateMsg: msg, authChallenge });
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  it("Room 1: creatorIsWhite=true assigns White to Alice and Black to Bob", async () => {
    if (!anvil) return;

    const aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });
    const bobWallet = createWalletClient({
      account: bobAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    const roomId = await createAndGetRoomId(aliceWallet, true);
    activeRoomId = roomId;

    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Alice connects -> receives White
    const aliceConn = await connectAndAuthenticate(roomId, aliceAccount);
    expect(aliceConn.roomStateMsg.type).toBe("room_state");
    expect(aliceConn.roomStateMsg.white.toLowerCase()).toBe(aliceAccount.address.toLowerCase());

    // Bob connects -> receives Black
    const bobConn = await connectAndAuthenticate(roomId, bobAccount);
    expect(bobConn.roomStateMsg.type).toBe("room_state");
    expect(bobConn.roomStateMsg.black.toLowerCase()).toBe(bobAccount.address.toLowerCase());

    aliceConn.ws.close();
    bobConn.ws.close();
  });

  it("Room 2: creatorIsWhite=false assigns Black to Alice and White to Bob", async () => {
    if (!anvil) return;

    const aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });
    const bobWallet = createWalletClient({
      account: bobAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    const roomId = await createAndGetRoomId(aliceWallet, false);

    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Alice connects -> receives Black
    const aliceConn = await connectAndAuthenticate(roomId, aliceAccount);
    expect(aliceConn.roomStateMsg.type).toBe("room_state");
    expect(aliceConn.roomStateMsg.black.toLowerCase()).toBe(aliceAccount.address.toLowerCase());

    // Bob connects -> receives White
    const bobConn = await connectAndAuthenticate(roomId, bobAccount);
    expect(bobConn.roomStateMsg.type).toBe("room_state");
    expect(bobConn.roomStateMsg.white.toLowerCase()).toBe(bobAccount.address.toLowerCase());

    aliceConn.ws.close();
    bobConn.ws.close();
  });

  it("Rejects player joining a room that is still Open (not Active)", async () => {
    if (!anvil) return;

    const aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    // Create room on chain but do NOT join
    const openRoomId = await createAndGetRoomId(aliceWallet, true);

    // Alice tries to join WebSocket before opponent stakes on chain
    const aliceConn = await connectAndAuthenticate(openRoomId, aliceAccount);
    expect(aliceConn.roomStateMsg.type).toBe("error");
    expect(aliceConn.roomStateMsg.message).toContain("Room is not Active on-chain");

    aliceConn.ws.close();
  });

  it("Non-player wallet can only join as spectator", async () => {
    if (!anvil) return;

    // Use activeRoomId (which is active)
    const roomId = activeRoomId;

    // Charlie tries to join as player
    const charliePlayerConn = await connectAndAuthenticate(roomId, charlieAccount, "player");
    expect(charliePlayerConn.roomStateMsg.type).toBe("error");
    expect(charliePlayerConn.roomStateMsg.message).toContain("Address is not a player of this room");
    charliePlayerConn.ws.close();

    // Charlie joins as spectator
    const charlieSpectatorConn = await connectAndAuthenticate(roomId, charlieAccount, "spectator");
    expect(charlieSpectatorConn.roomStateMsg.type).toBe("room_state");
    charlieSpectatorConn.ws.close();
  });

  it("Co-signing end-to-end: Relay co-signs result, players sign, submitResult on anvil settles contract", { timeout: 20000 }, async () => {
    if (!anvil) return;

    const aliceWallet = createWalletClient({
      account: aliceAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });
    const bobWallet = createWalletClient({
      account: bobAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    // Create a new room: Alice is White, Bob is Black
    const roomId = await createAndGetRoomId(aliceWallet, true);

    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Both players connect
    const aliceConn = await connectAndAuthenticate(roomId, aliceAccount);
    const bobConn = await connectAndAuthenticate(roomId, bobAccount);

    // Relay room is now active
    const room = server.getRoom(roomId);
    expect(room).toBeDefined();

    // Bob resigns on WebSocket
    const proposalPromise = new Promise<{ proposal: any; signatureMsg: any }>((resolve) => {
      let proposal: any = null;
      aliceConn.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_proposal") {
          proposal = msg;
        } else if (msg.type === "result_signature") {
          resolve({ proposal, signatureMsg: msg });
        }
      });
    });

    bobConn.ws.send(JSON.stringify({ type: "resign", roomId }));
    const { proposal, signatureMsg } = await proposalPromise;

    expect(proposal.outcome).toBe(OutcomeCode.WhiteWin);
    expect(proposal.winner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    expect(signatureMsg.signature).toMatch(/^0x[0-9a-fA-F]+$/);

    // Alice signs the result as winner
    const aliceSig = await aliceAccount.signTypedData({
      domain: {
        name: "AvaClashChess",
        version: "2",
        chainId: 31337,
        verifyingContract: escrowAddress,
      },
      types: EIP712_TYPES,
      primaryType: "Result",
      message: {
        matchId: BigInt(proposal.roomId),
        winner: proposal.winner as `0x${string}`,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash as Hex,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
    });

    // Alice submits result to on-chain Escrow with (AliceSig, RelaySig)
    const submitTx = await aliceWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(proposal.roomId),
        proposal.winner as `0x${string}`,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash as Hex,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        aliceSig,
        signatureMsg.signature as Hex,
      ],
    });
    const receipt = await anvil.publicClient.waitForTransactionReceipt({ hash: submitTx });
    expect(receipt.status).toBe("success");

    // Verify on-chain room status is Settled (2)
    const onChainRoom: any = await anvil.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(onChainRoom.status)).toBe(2); // Settled

    // Now test that if handleGameOver is called on settled room, Relay refuses to sign
    const consoleWarnSpy = vi.spyOn(console, "warn");
    await server.handleGameOver(room!, "w", "resign", aliceAccount.address);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("is no longer Active on-chain (status=2). Refusing to sign.")
    );

    aliceConn.ws.close();
    bobConn.ws.close();
  });
});
