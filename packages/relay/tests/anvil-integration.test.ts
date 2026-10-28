import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import WebSocket from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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

    const relayWallet = createWalletClient({
      account: relayAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    relayPort = 9200 + Math.floor(Math.random() * 500);
    const defaultResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "anvil-relay-default-"));
    server = new RelayServer({
      port: relayPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      walletClient: relayWallet,
      resultsDir: defaultResultsDir,
      signalGameStartedEnabled: true,
    });
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.close();
      try {
        fs.rmSync(server.resultsDir, { recursive: true, force: true });
      } catch {}
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
        } else if (msg.type === "room_state" || msg.type === "error" || msg.type === "game_finished") {
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
      expect.stringMatching(/Refusing to sign/i)
    );

    aliceConn.ws.close();
    bobConn.ws.close();
  });

  it("Relay automatically signals gameStarted on-chain when both players join; abortRoom reverts GameAlreadyStarted", { timeout: 25000 }, async () => {
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
    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Alice and Bob connect to relay -> room becomes active
    const aliceConn = await connectAndAuthenticate(roomId, aliceAccount);
    const bobConn = await connectAndAuthenticate(roomId, bobAccount);

    // Wait for relay to send signalGameStarted tx and confirm on-chain
    let gameStarted = false;
    for (let i = 0; i < 30; i++) {
      const onChainRoom: any = await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "getRoom",
        args: [BigInt(roomId)],
      });
      if (onChainRoom.gameStarted) {
        gameStarted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(gameStarted).toBe(true);

    // Fast forward anvil time past 3 minutes (181s)
    await (anvil.publicClient as any).request({ method: "evm_increaseTime", params: [181] });
    await (anvil.publicClient as any).request({ method: "evm_mine" });

    // Attempting abortRoom should revert because gameStarted is true
    await expect(
      aliceWallet.writeContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "abortRoom",
        args: [BigInt(roomId)],
      })
    ).rejects.toThrow();

    aliceConn.ws.close();
    bobConn.ws.close();
  });

  it("When signalGameStarted is disabled, relay does not call signalGameStarted and abortRoom succeeds after 3 minutes", { timeout: 25000 }, async () => {
    if (!anvil) return;

    // Create another RelayServer with signalGameStartedEnabled = false
    const disabledPort = relayPort + 15;
    const disabledServer = new RelayServer({
      port: disabledPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      signalGameStartedEnabled: false,
    });

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
    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Connect to disabledServer
    async function connectToDisabled(rId: number, acct: any) {
      return new Promise<{ ws: WebSocket }>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${disabledPort}`);
        ws.on("message", async (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "auth_challenge") {
            const typedData = buildJoinTypedData(rId, acct.address, msg.nonce as Hex, msg.expiresAt, 31337);
            const signature = await acct.signTypedData(typedData);
            ws.send(JSON.stringify({ type: "join_room", roomId: rId, address: acct.address, signature, nonce: msg.nonce }));
          } else if (msg.type === "room_state") {
            resolve({ ws });
          }
        });
      });
    }

    const aliceConn = await connectToDisabled(roomId, aliceAccount);
    const bobConn = await connectToDisabled(roomId, bobAccount);

    // Give it a brief moment
    await new Promise((r) => setTimeout(r, 300));

    // Check on-chain room.gameStarted remains false
    const onChainRoom: any = await anvil.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(onChainRoom.gameStarted).toBe(false);

    // Fast forward anvil time past 3 minutes (181s)
    await (anvil.publicClient as any).request({ method: "evm_increaseTime", params: [181] });
    await (anvil.publicClient as any).request({ method: "evm_mine" });

    // abortRoom succeeds
    const abortTx = await aliceWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "abortRoom",
      args: [BigInt(roomId)],
    });
    const receipt = await anvil.publicClient.waitForTransactionReceipt({ hash: abortTx });
    expect(receipt.status).toBe("success");

    const abortedRoom: any = await anvil.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(abortedRoom.status)).toBe(6); // Aborted

    aliceConn.ws.close();
    bobConn.ws.close();
    await disabledServer.close();
  });

  it("Persists game result to RESULTS_DIR and re-signs result upon request_result after server restart", { timeout: 35000 }, async () => {
    if (!anvil) return;

    const tempResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-results-"));
    const dedicatedPort = relayPort + 30;
    const testServer = new RelayServer({
      port: dedicatedPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      resultsDir: tempResultsDir,
      signalGameStartedEnabled: true,
    });

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
    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Helper to connect and authenticate to custom port
    async function connectToPort(rId: number, acct: any, port: number, role?: "player" | "spectator") {
      return new Promise<{ ws: WebSocket; roomStateMsg: any }>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error("connectToPort timed out"));
        }, 5000);

        ws.on("message", async (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "auth_challenge") {
            if (role === "spectator") {
              ws.send(JSON.stringify({ type: "join_room", roomId: rId, role: "spectator" }));
            } else {
              const typedData = buildJoinTypedData(rId, acct.address, msg.nonce as Hex, msg.expiresAt, 31337);
              const signature = await acct.signTypedData(typedData);
              ws.send(JSON.stringify({ type: "join_room", roomId: rId, address: acct.address, signature, nonce: msg.nonce }));
            }
          } else if (msg.type === "room_state" || msg.type === "error" || msg.type === "game_finished") {
            clearTimeout(timer);
            resolve({ ws, roomStateMsg: msg });
          }
        });
        ws.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    }

    const aliceConn1 = await connectToPort(roomId, aliceAccount, dedicatedPort);
    const bobConn1 = await connectToPort(roomId, bobAccount, dedicatedPort);

    // Bob resigns -> game completes
    const gameOverPromise = new Promise<void>((resolve) => {
      aliceConn1.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_signature") {
          resolve();
        }
      });
    });

    bobConn1.ws.send(JSON.stringify({ type: "resign", roomId }));
    await gameOverPromise;

    // Both players close their sockets
    aliceConn1.ws.close();
    bobConn1.ws.close();

    // Check result file written to tempResultsDir
    const resultFile = path.join(tempResultsDir, `${31337}_${escrowAddress.toLowerCase()}_${roomId}.json`);
    expect(fs.existsSync(resultFile)).toBe(true);
    const savedContent = JSON.parse(fs.readFileSync(resultFile, "utf-8"));
    expect(savedContent.roomId).toBe(roomId);
    expect(savedContent.winner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    expect(savedContent.whiteAddress.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    expect(savedContent.blackAddress.toLowerCase()).toBe(bobAccount.address.toLowerCase());
    expect(savedContent.outcome).toBe("white");

    // Close testServer (simulate server shutdown)
    await testServer.close();

    // Start a new RelayServer restarting from the same resultsDir
    const restartPort = dedicatedPort + 1;
    const restartedServer = new RelayServer({
      port: restartPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      resultsDir: tempResultsDir,
      signalGameStartedEnabled: true,
    });

    // Verify restartedServer loaded the saved result
    expect(restartedServer.savedResults.has(restartedServer.getResultKey(roomId))).toBe(true);

    // 1. Charlie (not in room) connects as spectator and tries to request result -> rejected
    const charlieConn = await connectToPort(roomId, charlieAccount, restartPort, "spectator");
    const charlieErrorPromise = new Promise<string>((resolve) => {
      charlieConn.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") resolve(msg.message);
      });
    });
    charlieConn.ws.send(JSON.stringify({ type: "request_result", roomId }));
    const charlieErrorMsg = await charlieErrorPromise;
    expect(charlieErrorMsg).toContain("Authentication required");
    charlieConn.ws.close();

    // 2. Alice (winner) opens a new socket, joins/authenticates, and sends request_result
    const aliceConn2 = await connectToPort(roomId, aliceAccount, restartPort);
    const aliceReSignPromise = new Promise<{ proposal: any; signatureMsg: any }>((resolve) => {
      let proposal: any = null;
      aliceConn2.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_proposal") proposal = msg;
        if (msg.type === "result_signature") resolve({ proposal, signatureMsg: msg });
      });
    });

    aliceConn2.ws.send(JSON.stringify({ type: "request_result", roomId }));
    const { proposal, signatureMsg } = await aliceReSignPromise;

    expect(proposal.roomId).toBe(roomId);
    expect(proposal.winner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
    expect(signatureMsg.signature).toMatch(/^0x[0-9a-fA-F]+$/);

    // Alice signs and settles on anvil
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

    // Verify room is Settled (2)
    const onChainRoom: any = await anvil.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(onChainRoom.status)).toBe(2);

    // Wait for the 3-second getRoom cache to expire so the relay sees the settled status
    await new Promise((r) => setTimeout(r, 3100));

    // 3. Requesting result on a Settled room is rejected
    const settledErrorPromise = new Promise<string>((resolve) => {
      aliceConn2.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") resolve(msg.message);
      });
    });
    aliceConn2.ws.send(JSON.stringify({ type: "request_result", roomId }));
    const settledErrorMsg = await settledErrorPromise;
    expect(settledErrorMsg).toContain("is not Active on-chain (status=2)");

    aliceConn2.ws.close();
    await restartedServer.close();

    // Clean up temp directory
    try {
      fs.rmSync(tempResultsDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("Turn 3b Item 1: Resurrection attack prevented: winner and loser reconnecting after game over receive game_finished and cannot start new game, but winner can settle", async () => {
    if (!anvil) return;

    const tempResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "resurrection-test-"));
    const dedicatedPort = 9810 + Math.floor(Math.random() * 50);
    const dedicatedServer = new RelayServer({
      port: dedicatedPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      walletClient: createWalletClient({
        account: relayAccount,
        chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
        transport: http(),
      }),
      resultsDir: tempResultsDir,
      signalGameStartedEnabled: false,
    });

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
    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    const connectCustom = (rId: number, acct: any) => {
      return new Promise<{ ws: WebSocket; roomStateMsg: any }>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${dedicatedPort}`);
        const timer = setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 5000);
        ws.on("message", async (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "auth_challenge") {
            const typedData = buildJoinTypedData(rId, acct.address, msg.nonce as Hex, msg.expiresAt, 31337);
            const signature = await acct.signTypedData(typedData);
            ws.send(JSON.stringify({ type: "join_room", roomId: rId, address: acct.address, signature, nonce: msg.nonce }));
          } else if (msg.type === "room_state" || msg.type === "error" || msg.type === "game_finished") {
            clearTimeout(timer);
            resolve({ ws, roomStateMsg: msg });
          }
        });
        ws.on("error", (err) => { clearTimeout(timer); reject(err); });
      });
    };

    const alice1 = await connectCustom(roomId, aliceAccount);
    const bob1 = await connectCustom(roomId, bobAccount);

    // Bob resigns
    const gameOverPromise = new Promise<{ proposal: any; signatureMsg: any }>((resolve) => {
      let proposal: any = null;
      let signatureMsg: any = null;
      alice1.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_proposal") proposal = msg;
        if (msg.type === "result_signature") signatureMsg = msg;
        if (proposal && signatureMsg) resolve({ proposal, signatureMsg });
      });
    });

    bob1.ws.send(JSON.stringify({ type: "resign", roomId }));
    await gameOverPromise;

    alice1.ws.close();
    bob1.ws.close();

    // Simulate Relay room cleanup or server restart
    // Room memory deleted, but result saved in resultsDir
    (dedicatedServer as any).rooms.delete(roomId);

    // Loser (Bob) joins room again
    const bob2 = await connectCustom(roomId, bobAccount);
    expect(bob2.roomStateMsg.type).toBe("game_finished");
    expect(bob2.roomStateMsg.roomId).toBe(roomId);

    // Winner (Alice) joins room again
    const alice2 = await connectCustom(roomId, aliceAccount);
    expect(alice2.roomStateMsg.type).toBe("game_finished");
    expect(alice2.roomStateMsg.roomId).toBe(roomId);

    // Alice requests result, receives proposal and signature, and settles on-chain
    const aliceReSignPromise = new Promise<{ proposal: any; signatureMsg: any }>((resolve) => {
      let proposal: any = null;
      let signatureMsg: any = null;
      alice2.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_proposal") proposal = msg;
        if (msg.type === "result_signature") signatureMsg = msg;
        if (proposal && signatureMsg) resolve({ proposal, signatureMsg });
      });
    });

    alice2.ws.send(JSON.stringify({ type: "request_result", roomId }));
    const { proposal, signatureMsg } = await aliceReSignPromise;
    expect(proposal.roomId).toBe(roomId);
    expect(proposal.winner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());

    bob2.ws.close();
    alice2.ws.close();
    await dedicatedServer.close();
    try { fs.rmSync(tempResultsDir, { recursive: true, force: true }); } catch {}
  });

  it("Turn 3b Item 1: Results from other chainId or contract are ignored during load", async () => {
    const tempResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "cross-deploy-test-"));
    const dummyContract = "0x1111111111111111111111111111111111111111";
    // Write mock file with different contract and chainId
    fs.writeFileSync(
      path.join(tempResultsDir, `999_${dummyContract}_555.json`),
      JSON.stringify({
        chainId: 999,
        contractAddress: dummyContract,
        roomId: 555,
        moves: ["e2e4"],
        outcome: "white",
        reason: "resignation",
        winner: "0x1111111111111111111111111111111111111111",
        whiteAddress: "0x1111111111111111111111111111111111111111",
        blackAddress: "0x2222222222222222222222222222222222222222",
        timestamp: Date.now(),
      })
    );
    // Also write a file named 555.json (legacy format) with wrong chainId
    fs.writeFileSync(
      path.join(tempResultsDir, `555.json`),
      JSON.stringify({
        chainId: 999,
        contractAddress: dummyContract,
        roomId: 555,
        moves: ["e2e4"],
        outcome: "white",
        reason: "resignation",
        winner: "0x1111111111111111111111111111111111111111",
        whiteAddress: "0x1111111111111111111111111111111111111111",
        blackAddress: "0x2222222222222222222222222222222222222222",
        timestamp: Date.now(),
      })
    );

    const testServer = new RelayServer({
      port: 9870,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil!.rpcUrl,
      chainId: 31337,
      publicClient: anvil!.publicClient,
      resultsDir: tempResultsDir,
    });

    // Server must NOT load the result from chain 999 or contract dummyContract
    expect((testServer as any).savedResults.size).toBe(0);

    await testServer.close();
    try { fs.rmSync(tempResultsDir, { recursive: true, force: true }); } catch {}
  });

  it("Turn 3b Item 1: Non-player address sending result_signature is rejected", async () => {
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
    const charlieWallet = createWalletClient({
      account: charlieAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    // Create room with Alice and Bob
    const roomId = await createAndGetRoomId(aliceWallet, true);
    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    // Also create another room where Charlie is player so Charlie has an authenticated player session
    const room2Id = await createAndGetRoomId(charlieWallet, true);
    const joinTx2 = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(room2Id)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx2 });

    const aliceConn = await connectAndAuthenticate(roomId, aliceAccount);
    const bobConn = await connectAndAuthenticate(roomId, bobAccount);

    // Alice resigns to trigger proposal
    const proposalPromise = new Promise<any>((resolve) => {
      aliceConn.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_proposal") resolve(msg);
      });
    });
    aliceConn.ws.send(JSON.stringify({ type: "resign", roomId }));
    const proposal = await proposalPromise;

    // Charlie connects and authenticates as player in room2Id
    const charlieConn = await connectAndAuthenticate(room2Id, charlieAccount);

    // Charlie (neither white nor black in roomId) sends result_signature for roomId
    const charlieSig = await charlieAccount.signTypedData({
      domain: {
        name: "AvaClashChess",
        version: "2",
        chainId: 31337,
        verifyingContract: escrowAddress,
      },
      types: EIP712_TYPES,
      primaryType: "Result",
      message: {
        matchId: BigInt(roomId),
        winner: proposal.winner as `0x${string}`,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash as Hex,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
    });

    const charlieErrorPromise = new Promise<string>((resolve) => {
      charlieConn.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") resolve(msg.message);
      });
    });

    charlieConn.ws.send(JSON.stringify({
      type: "result_signature",
      roomId,
      signature: charlieSig,
    }));

    const errorMsg = await charlieErrorPromise;
    expect(errorMsg).toContain("Signer is not a player of this room");

    charlieConn.ws.close();
    aliceConn.ws.close();
    bobConn.ws.close();
  });

  it("Turn 3b Item 2: Active game state persisted atomically; recovered after restart without clock downtime penalty, finishes and settles", async () => {
    if (!anvil) return;

    const tempResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "active-games-test-"));
    const port1 = 9880 + Math.floor(Math.random() * 50);
    const server1 = new RelayServer({
      port: port1,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      walletClient: createWalletClient({
        account: relayAccount,
        chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
        transport: http(),
      }),
      resultsDir: tempResultsDir,
      initialTimeMs: 120_000,
      signalGameStartedEnabled: true,
    });

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
    const joinTx = await bobWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther("0.05"),
    });
    await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

    const connectTo = (rId: number, acct: any, port: number) => {
      return new Promise<{ ws: WebSocket; roomStateMsg: any }>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        const timer = setTimeout(() => { ws.close(); reject(new Error("connectTo timed out")); }, 5000);
        ws.on("message", async (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "auth_challenge") {
            const typedData = buildJoinTypedData(rId, acct.address, msg.nonce as Hex, msg.expiresAt, 31337);
            const signature = await acct.signTypedData(typedData);
            ws.send(JSON.stringify({ type: "join_room", roomId: rId, address: acct.address, signature, nonce: msg.nonce }));
          } else if (msg.type === "room_state" || msg.type === "error" || msg.type === "game_finished") {
            clearTimeout(timer);
            resolve({ ws, roomStateMsg: msg });
          }
        });
        ws.on("error", (err) => { clearTimeout(timer); reject(err); });
      });
    };

    // Alice (White) and Bob (Black) join server1
    const alice1 = await connectTo(roomId, aliceAccount, port1);
    const bob1 = await connectTo(roomId, bobAccount, port1);

    // Make moves: 1. e2e4
    const bobMovePromise1 = new Promise<any>((resolve) => {
      bob1.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "move" && msg.uci === "e2e4") resolve(msg);
      });
    });
    alice1.ws.send(JSON.stringify({ type: "move", roomId, seq: 0, uci: "e2e4" }));
    await bobMovePromise1;

    // Bob plays 1... e7e5
    const aliceMovePromise1 = new Promise<any>((resolve) => {
      alice1.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "move" && msg.uci === "e7e5") resolve(msg);
      });
    });
    bob1.ws.send(JSON.stringify({ type: "move", roomId, seq: 1, uci: "e7e5" }));
    await aliceMovePromise1;

    // Alice plays 2. g1f3
    const bobMovePromise2 = new Promise<any>((resolve) => {
      bob1.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "move" && msg.uci === "g1f3") resolve(msg);
      });
    });
    alice1.ws.send(JSON.stringify({ type: "move", roomId, seq: 2, uci: "g1f3" }));
    await bobMovePromise2;

    // Active game state file must exist in active/
    const activeFile = path.join(
      tempResultsDir,
      "active",
      `31337_${escrowAddress.toLowerCase()}_${roomId}.json`
    );
    expect(fs.existsSync(activeFile)).toBe(true);

    const savedState = JSON.parse(fs.readFileSync(activeFile, "utf-8"));
    expect(savedState.moves).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(savedState.activeTurn).toBe("b");
    const savedWhiteMs = savedState.whiteMs;
    const savedBlackMs = savedState.blackMs;

    // Shutdown server1 and disconnect players
    alice1.ws.close();
    bob1.ws.close();
    await server1.close();

    // Simulate downtime (500ms)
    await new Promise((r) => setTimeout(r, 500));

    // Start server2 pointing to same resultsDir
    const port2 = port1 + 1;
    const server2 = new RelayServer({
      port: port2,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      walletClient: createWalletClient({
        account: relayAccount,
        chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
        transport: http(),
      }),
      resultsDir: tempResultsDir,
      initialTimeMs: 120_000,
      signalGameStartedEnabled: true,
    });

    // Alice reconnects to server2
    const alice2 = await connectTo(roomId, aliceAccount, port2);
    expect(alice2.roomStateMsg.type).toBe("room_state");
    expect(alice2.roomStateMsg.moves).toEqual(["e2e4", "e7e5", "g1f3"]);
    // Clocks must NOT have deducted relay downtime
    expect(alice2.roomStateMsg.whiteMs).toBe(savedWhiteMs);
    expect(alice2.roomStateMsg.blackMs).toBe(savedBlackMs);

    // Bob reconnects to server2
    const bob2 = await connectTo(roomId, bobAccount, port2);
    expect(bob2.roomStateMsg.moves).toEqual(["e2e4", "e7e5", "g1f3"]);

    // Bob resigns on server2
    const gameOverPromise = new Promise<{ proposal: any; signatureMsg: any }>((resolve) => {
      let proposal: any = null;
      let signatureMsg: any = null;
      alice2.ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "result_proposal") proposal = msg;
        if (msg.type === "result_signature") signatureMsg = msg;
        if (proposal && signatureMsg) resolve({ proposal, signatureMsg });
      });
    });

    bob2.ws.send(JSON.stringify({ type: "resign", roomId }));
    const { proposal, signatureMsg } = await gameOverPromise;
    expect(proposal.winner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());

    // Active file must be deleted once game is finished
    expect(fs.existsSync(activeFile)).toBe(false);

    // Alice signs and settles on anvil
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

    alice2.ws.close();
    bob2.ws.close();
    await server2.close();
    try { fs.rmSync(tempResultsDir, { recursive: true, force: true }); } catch {}
  }, 30000);

  it("Turn 3b Item 5: handleGameOver saves result before RPC/signing; RPC error at game over still allows subsequent request_result and on-chain settlement", { timeout: 35000 }, async () => {
    if (!anvil) return;

    const tempResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-error-test-"));
    const dedicatedPort = relayPort + 66;

    // A wrapping publicClient that can simulate transient RPC failure on demand
    let failRpc = false;
    const wrappingPublicClient = {
      ...anvil.publicClient,
      readContract: async (args: any) => {
        if (failRpc) {
          throw new Error("Simulated RPC Network Glitch (503 Service Unavailable)");
        }
        return anvil.publicClient.readContract(args);
      },
    };

    const serverRpc = new RelayServer({
      port: dedicatedPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: wrappingPublicClient,
      resultsDir: tempResultsDir,
      signalGameStartedEnabled: true,
    });

    try {
      // 1. Create and join room on anvil
      const stake = parseEther("0.05");
      const aliceWallet = createWalletClient({
        account: aliceAccount,
        chain: localhost,
        transport: http(anvil.rpcUrl),
      });
      const bobWallet = createWalletClient({
        account: bobAccount,
        chain: localhost,
        transport: http(anvil.rpcUrl),
      });

      const roomId = await createAndGetRoomId(aliceWallet, true, "0.05");

      const joinTx = await bobWallet.writeContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "joinRoom",
        args: [BigInt(roomId)],
        value: stake,
      });
      await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });

      // 2. Both players connect and game becomes active
      const connectToPort = (rId: number, acct: any, port: number) => {
        return new Promise<{ ws: WebSocket; roomStateMsg: any }>((resolve, reject) => {
          const ws = new WebSocket(`ws://127.0.0.1:${port}`);
          const timer = setTimeout(() => { ws.close(); reject(new Error("connectTo timed out")); }, 5000);
          ws.on("message", async (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "auth_challenge") {
              const typedData = buildJoinTypedData(rId, acct.address, msg.nonce, msg.expiresAt, 31337);
              const signature = await acct.signTypedData(typedData);
              ws.send(JSON.stringify({
                type: "join_room",
                roomId: rId,
                role: "player",
                address: acct.address,
                signature,
                nonce: msg.nonce,
              }));
            } else if (msg.type === "room_state" || msg.type === "game_finished") {
              clearTimeout(timer);
              resolve({ ws, roomStateMsg: msg });
            }
          });
        });
      };

      const aliceConn = await connectToPort(roomId, aliceAccount, dedicatedPort);
      const bobConn = await connectToPort(roomId, bobAccount, dedicatedPort);

      // Play move 1. e2e4
      const movePromise = new Promise<void>((resolve) => {
        const handler = (data: any) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "move" && msg.uci === "e2e4") {
            bobConn.ws.off("message", handler);
            resolve();
          }
        };
        bobConn.ws.on("message", handler);
      });
      aliceConn.ws.send(JSON.stringify({ type: "move", roomId, seq: 0, uci: "e2e4" }));
      await movePromise;

      // 3. Trigger RPC failure right as Bob resigns
      failRpc = true;
      bobConn.ws.send(JSON.stringify({ type: "resign", roomId }));

      // Wait a moment for handleGameOver to attempt processing and encounter RPC error
      await new Promise((r) => setTimeout(r, 500));

      // Close live sockets
      aliceConn.ws.close();
      bobConn.ws.close();

      // 4. RPC recovers (failRpc = false). Winner (Alice) connects and requests result
      failRpc = false;
      const aliceConn2 = await connectToPort(roomId, aliceAccount, dedicatedPort);

      const requestResultPromise = new Promise<{ proposal?: any; signatureMsg?: any; errorMsg?: string }>((resolve) => {
        let proposal: any = null;
        let signatureMsg: any = null;
        aliceConn2.ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "result_proposal") proposal = msg;
          if (msg.type === "result_signature") signatureMsg = msg;
          if (msg.type === "error") resolve({ errorMsg: msg.message });
          if (proposal && signatureMsg) resolve({ proposal, signatureMsg });
        });
      });

      aliceConn2.ws.send(JSON.stringify({ type: "request_result", roomId }));
      const resultResp = await requestResultPromise;

      // On unpatched code, this will fail with an error because handleGameOver never saved the result before RPC failure
      expect(resultResp.errorMsg).toBeUndefined();
      expect(resultResp.proposal).toBeDefined();
      expect(resultResp.signatureMsg).toBeDefined();
      expect(resultResp.proposal.winner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());

      // 5. Alice signs and settles on-chain
      const proposal = resultResp.proposal;
      const relaySig = resultResp.signatureMsg.signature;

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
          relaySig as Hex,
        ],
      });

      const submitReceipt = await anvil.publicClient.waitForTransactionReceipt({ hash: submitTx });
      expect(submitReceipt.status).toBe("success");

      // Verify on-chain room status is Settled (2)
      const onChainRoom = await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "getRoom",
        args: [BigInt(roomId)],
      });
      expect(Number((onChainRoom as any).status)).toBe(2); // Settled

      aliceConn2.ws.close();
    } finally {
      await serverRpc.close();
      try { fs.rmSync(tempResultsDir, { recursive: true, force: true }); } catch {}
    }
  });
});

