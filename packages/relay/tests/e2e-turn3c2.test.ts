import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseEther,
  createWalletClient,
  http,
  type Hex,
  type Address,
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
  RelayClient,
  verifyResultProposal,
  buildResultTypedData,
  ZERO_ADDRESS,
  OutcomeCode,
  ReasonCode,
  type ResultProposalMessage,
  type ResultSignatureMessage,
  type ResignMessage,
  type DrawOfferMessage,
} from "@avaclash/shared";

describe("Turn 3c-2 End-to-End RelayClient & Settlement Integration", () => {
  let anvil: AnvilInstance | null = null;
  let server: RelayServer;
  let relayPort: number;
  let escrowAddress: Address;
  let escrowAbi: any;
  let relayAccount: ReturnType<typeof privateKeyToAccount>;
  let playerAAccount: ReturnType<typeof privateKeyToAccount>;
  let playerBAccount: ReturnType<typeof privateKeyToAccount>;
  let playerAWallet: any;
  let playerBWallet: any;
  let relayWallet: any;
  let relayResultsDir: string;
  let relayActiveDir: string;

  beforeAll(async () => {
    if (!isAnvilAvailable()) {
      console.warn("[SKIP] Anvil binary not found in PATH.");
      return;
    }

    anvil = await startAnvil();
    const deployed = await deployContractsOnAnvil(anvil);
    escrowAddress = deployed.escrowAddress;
    escrowAbi = deployed.escrowAbi;
    relayAccount = deployed.relayAccount;

    playerAAccount = privateKeyToAccount(ANVIL_ACCOUNTS[4].privateKey);
    playerBAccount = privateKeyToAccount(ANVIL_ACCOUNTS[5].privateKey);

    playerAWallet = createWalletClient({
      account: playerAAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    playerBWallet = createWalletClient({
      account: playerBAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    relayWallet = createWalletClient({
      account: relayAccount,
      chain: { ...localhost, id: 31337, rpcUrls: { default: { http: [anvil.rpcUrl] } } },
      transport: http(),
    });

    relayPort = 9800 + Math.floor(Math.random() * 150);
    relayResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "turn3c2-results-"));
    relayActiveDir = fs.mkdtempSync(path.join(os.tmpdir(), "turn3c2-active-"));

    server = new RelayServer({
      port: relayPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil.rpcUrl,
      chainId: 31337,
      publicClient: anvil.publicClient,
      walletClient: relayWallet,
      resultsDir: relayResultsDir,
      activeDir: relayActiveDir,
      signalGameStartedEnabled: true,
    });
  }, 45000);

  afterAll(async () => {
    if (server) {
      await server.close();
      try {
        fs.rmSync(relayResultsDir, { recursive: true, force: true });
        fs.rmSync(relayActiveDir, { recursive: true, force: true });
      } catch {}
    }
    if (anvil) {
      anvil.stop();
    }
  });

  async function createOnChainRoom(creatorWallet: any, creatorIsWhite: boolean, stakeEth = "0.1"): Promise<number> {
    const nextId: any = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "nextRoomId",
    });
    const roomId = Number(nextId);
    const tx = await creatorWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "createRoom",
      args: [creatorIsWhite],
      value: parseEther(stakeEth),
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: tx });
    return roomId;
  }

  async function joinOnChainRoom(joinerWallet: any, roomId: number, stakeEth = "0.1"): Promise<void> {
    const tx = await joinerWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "joinRoom",
      args: [BigInt(roomId)],
      value: parseEther(stakeEth),
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: tx });
  }

  function createClientForAccount(account: ReturnType<typeof privateKeyToAccount>, port = relayPort): RelayClient {
    return new RelayClient({
      url: `ws://127.0.0.1:${port}`,
      WebSocketImpl: WebSocket,
      getAddress: () => account.address,
      signTypedData: async (typedData: any) => {
        return await account.signTypedData(typedData);
      },
      chainId: 31337,
      escrowAddress,
    });
  }

  async function waitForEvent<T>(client: RelayClient, event: any, timeoutMs = 8000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for event "${event}" (${timeoutMs}ms)`));
      }, timeoutMs);
      const unbind = client.on(event, (data: any) => {
        clearTimeout(timer);
        unbind();
        resolve(data);
      });
    });
  }

  it("1. Full online checkmate game e2e: creatorIsWhite=true, Black wins, verifies proposal, signs, submits, pendingWithdrawals pot-5%, withdraws", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");

    clientA.connect(roomId);
    clientB.connect(roomId);

    await Promise.all([aReady, bReady]);

    expect(clientA.getMyColor()).toBe("w");
    expect(clientB.getMyColor()).toBe("b");

    // Play Fool's mate: 1. f2f3 e7e5 2. g2g4 d8h4#
    const move1B = waitForEvent(clientB, "move");
    const move1A = waitForEvent(clientA, "move");
    clientA.sendMove("f2f3");
    await Promise.all([move1A, move1B]);

    const move2A = waitForEvent(clientA, "move");
    const move2B = waitForEvent(clientB, "move");
    clientB.sendMove("e7e5");
    await Promise.all([move2A, move2B]);

    const move3B = waitForEvent(clientB, "move");
    const move3A = waitForEvent(clientA, "move");
    clientA.sendMove("g2g4");
    await Promise.all([move3A, move3B]);

    const proposalPromiseB = waitForEvent<ResultProposalMessage>(clientB, "resultProposal");
    const sigPromiseB = waitForEvent<ResultSignatureMessage>(clientB, "resultSignature");

    clientB.sendMove("d8h4");

    const [proposal, relaySigMsg] = await Promise.all([proposalPromiseB, sigPromiseB]);

    // Verify proposal with pure verifyResultProposal
    const verification = verifyResultProposal({
      proposal,
      moves: clientB.getMoves(),
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
    });

    expect(verification.valid).toBe(true);
    expect(proposal.winner.toLowerCase()).toBe(playerBAccount.address.toLowerCase());
    expect(proposal.outcome).toBe(1); // Black wins

    // Black signs Result typed data
    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337
    );
    const playerBSig = await playerBAccount.signTypedData(typedData);

    // Black calls submitResult on ChessEscrow with 2-of-3 signatures: playerBSig + relaySignature
    const submitTx = await playerBWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        proposal.winner,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        playerBSig,
        relaySigMsg.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    // Verify room is Settled
    const roomOnChain: any = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(roomOnChain.status)).toBe(2); // Settled

    // Verify pendingWithdrawals for winner: pot (0.2 ETH) - 5% (0.01 ETH) = 0.19 ETH
    const winnerPending: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerBAccount.address],
    });

    const expectedPayout = parseEther("0.19");
    expect(winnerPending).toBe(expectedPayout);

    // Winner withdraws
    const withdrawTx = await playerBWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    const postWithdrawPending: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerBAccount.address],
    });
    expect(postWithdrawPending).toBe(0n);

    clientA.disconnect();
    clientB.disconnect();
  }, 30000);

  it("2. Full online checkmate game with creatorIsWhite=false: Player A is Black, Player B is White; Black wins", async () => {
    // Player A creates room with creatorIsWhite = false (Player A plays Black, Player B plays White)
    const roomId = await createOnChainRoom(playerAWallet, false, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");

    clientA.connect(roomId);
    clientB.connect(roomId);

    await Promise.all([aReady, bReady]);

    expect(clientA.getMyColor()).toBe("b"); // Player A is Black
    expect(clientB.getMyColor()).toBe("w"); // Player B is White

    // White (Player B) plays 1. f2f3
    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientB.sendMove("f2f3");
    await Promise.all([move1A, move1B]);

    // Black (Player A) plays 1... e7e5
    const move2A = waitForEvent(clientA, "move");
    const move2B = waitForEvent(clientB, "move");
    clientA.sendMove("e7e5");
    await Promise.all([move2A, move2B]);

    // White (Player B) plays 2. g2g4
    const move3A = waitForEvent(clientA, "move");
    const move3B = waitForEvent(clientB, "move");
    clientB.sendMove("g2g4");
    await Promise.all([move3A, move3B]);

    // Black (Player A) plays 2... d8h4#
    const proposalPromiseA = waitForEvent<ResultProposalMessage>(clientA, "resultProposal");
    const sigPromiseA = waitForEvent<ResultSignatureMessage>(clientA, "resultSignature");

    clientA.sendMove("d8h4");

    const [proposal, relaySigMsg] = await Promise.all([proposalPromiseA, sigPromiseA]);

    // Verify proposal: White is Player B, Black is Player A
    const verification = verifyResultProposal({
      proposal,
      moves: clientA.getMoves(),
      whiteAddress: playerBAccount.address,
      blackAddress: playerAAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
    });

    expect(verification.valid).toBe(true);
    expect(proposal.winner.toLowerCase()).toBe(playerAAccount.address.toLowerCase());
    expect(proposal.outcome).toBe(1); // Black wins

    // Player A signs Result typed data
    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337
    );
    const playerASig = await playerAAccount.signTypedData(typedData);

    // Player A submits result on-chain
    const submitTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        proposal.winner,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        playerASig,
        relaySigMsg.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    // Verify room settled
    const roomOnChain: any = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(roomOnChain.status)).toBe(2);

    // Verify Player A pending balance and withdraw
    const pending: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerAAccount.address],
    });
    expect(pending).toBe(parseEther("0.19"));

    const withdrawTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    clientA.disconnect();
    clientB.disconnect();
  }, 30000);

  it("3. Draw agreement: drawOffer and drawAccept, 50/50 pot split with 0 protocol fee, both withdraw", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");

    clientA.connect(roomId);
    clientB.connect(roomId);

    await Promise.all([aReady, bReady]);

    // White (clientA) plays 1. e2e4
    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientA.sendMove("e2e4");
    await Promise.all([move1A, move1B]);

    // White offers draw
    const offerForB = waitForEvent<DrawOfferMessage>(clientB, "drawOffer");
    clientA.sendDrawOffer();
    await offerForB;

    // Black accepts draw
    const proposalPromiseA = waitForEvent<ResultProposalMessage>(clientA, "resultProposal");
    const sigPromiseA = waitForEvent<ResultSignatureMessage>(clientA, "resultSignature");
    clientB.sendDrawAccept();

    const [proposal, relaySigMsg] = await Promise.all([proposalPromiseA, sigPromiseA]);

    // Verify proposal with drawAcceptSeen: true
    const verification = verifyResultProposal({
      proposal,
      moves: clientA.getMoves(),
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
      seenEvents: { drawAcceptSeen: true },
    });

    expect(verification.valid).toBe(true);
    expect(proposal.outcome).toBe(OutcomeCode.Draw);
    expect(proposal.reason).toBe(ReasonCode.Agreement);
    expect(proposal.winner.toLowerCase()).toBe(ZERO_ADDRESS.toLowerCase());

    // Player A signs Result typed data
    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337
    );
    const playerASig = await playerAAccount.signTypedData(typedData);

    // Player A submits result
    const submitTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        proposal.winner,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        playerASig,
        relaySigMsg.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    // On draw: pot (0.2 ETH) split 50/50 -> 0.1 ETH each, 0 protocol fee!
    const pendingA: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerAAccount.address],
    });
    const pendingB: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerBAccount.address],
    });

    expect(pendingA).toBe(parseEther("0.1"));
    expect(pendingB).toBe(parseEther("0.1"));

    // Both withdraw
    const withdrawATx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawATx });

    const withdrawBTx = await playerBWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawBTx });

    clientA.disconnect();
    clientB.disconnect();
  }, 30000);

  it("4. Resignation: player resigns, other player verifies with resignSeen, submits, and withdraws", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");

    clientA.connect(roomId);
    clientB.connect(roomId);

    await Promise.all([aReady, bReady]);

    // White moves 1. e2e4
    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientA.sendMove("e2e4");
    await Promise.all([move1A, move1B]);

    // Black resigns
    const resignForA = waitForEvent<ResignMessage>(clientA, "resign");
    const proposalPromiseA = waitForEvent<ResultProposalMessage>(clientA, "resultProposal");
    const sigPromiseA = waitForEvent<ResultSignatureMessage>(clientA, "resultSignature");

    clientB.sendResign();

    const [resignMsg, proposal, relaySigMsg] = await Promise.all([
      resignForA,
      proposalPromiseA,
      sigPromiseA,
    ]);

    expect(resignMsg.type).toBe("resign");
    expect(resignMsg.roomId).toBe(roomId);

    // Client A verifies proposal with resignSeen: true
    const verification = verifyResultProposal({
      proposal,
      moves: clientA.getMoves(),
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
      seenEvents: { resignSeen: true },
    });

    expect(verification.valid).toBe(true);
    expect(proposal.winner.toLowerCase()).toBe(playerAAccount.address.toLowerCase());
    expect(proposal.outcome).toBe(OutcomeCode.WhiteWin);
    expect(proposal.reason).toBe(ReasonCode.Resign);

    // Player A signs and submits
    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337
    );
    const playerASig = await playerAAccount.signTypedData(typedData);

    const submitTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        proposal.winner,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        playerASig,
        relaySigMsg.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    // Settle verified
    const pending: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerAAccount.address],
    });
    expect(pending).toBe(parseEther("0.19"));

    const withdrawTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    clientA.disconnect();
    clientB.disconnect();
  }, 30000);

  it("5. Relay restarts mid-game: clients reconnect with backoff, match finishes, winner disconnects, reconnects, requests result and settles", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");

    clientA.connect(roomId);
    clientB.connect(roomId);

    await Promise.all([aReady, bReady]);

    // 1. f2f3 e7e5
    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientA.sendMove("f2f3");
    await Promise.all([move1A, move1B]);

    const move2A = waitForEvent(clientA, "move");
    const move2B = waitForEvent(clientB, "move");
    clientB.sendMove("e7e5");
    await Promise.all([move2A, move2B]);

    // Relay restarts abruptly
    await server.close();

    // Start a new RelayServer instance on the same port and persisted dirs
    server = new RelayServer({
      port: relayPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil!.rpcUrl,
      chainId: 31337,
      publicClient: anvil!.publicClient,
      walletClient: relayWallet,
      resultsDir: relayResultsDir,
      activeDir: relayActiveDir,
      signalGameStartedEnabled: true,
    });

    // Both clients auto-reconnect with backoff and re-authenticate
    const aReconnected = waitForEvent(clientA, "roomState");
    const bReconnected = waitForEvent(clientB, "roomState");
    await Promise.all([aReconnected, bReconnected]);

    expect(clientA.getMoves()).toEqual(["f2f3", "e7e5"]);
    expect(clientB.getMoves()).toEqual(["f2f3", "e7e5"]);

    // Game resumes after restart: 2. g2g4 d8h4#
    const move3A = waitForEvent(clientA, "move");
    const move3B = waitForEvent(clientB, "move");
    clientA.sendMove("g2g4");
    await Promise.all([move3A, move3B]);

    const proposalB = waitForEvent<ResultProposalMessage>(clientB, "resultProposal");
    clientB.sendMove("d8h4");
    await proposalB;

    const savedMoves = [...clientB.getMoves()];

    // Simulate winner closing the browser: disconnect clientA and clientB
    clientA.disconnect();
    clientB.disconnect();

    // Winner reopens browser later: creates fresh RelayClient and receives game_finished
    const returningClient = createClientForAccount(playerBAccount);
    const returnReady = waitForEvent(returningClient, "gameFinished");
    returningClient.connect(roomId);
    await returnReady;

    const requestedProposalPromise = waitForEvent<ResultProposalMessage>(returningClient, "resultProposal");
    const requestedSigPromise = waitForEvent<ResultSignatureMessage>(returningClient, "resultSignature");

    returningClient.requestResult(roomId);

    const [reqProposal, reqSig] = await Promise.all([
      requestedProposalPromise,
      requestedSigPromise,
    ]);

    // Verify requested proposal
    const verification = verifyResultProposal({
      proposal: reqProposal,
      moves: savedMoves,
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
    });
    expect(verification.valid).toBe(true);

    // Winner signs and settles
    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: reqProposal.winner,
        outcome: reqProposal.outcome,
        reason: reqProposal.reason,
        moveCount: reqProposal.moveCount,
        movesHash: reqProposal.movesHash,
        nonce: BigInt(reqProposal.nonce),
        deadline: BigInt(reqProposal.deadline),
      },
      31337
    );
    const playerBSig = await playerBAccount.signTypedData(typedData);

    const submitTx = await playerBWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        reqProposal.winner,
        reqProposal.outcome,
        reqProposal.reason,
        reqProposal.moveCount,
        reqProposal.movesHash,
        BigInt(reqProposal.nonce),
        BigInt(reqProposal.deadline),
        playerBSig,
        reqSig.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    const roomOnChain: any = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(roomOnChain.status)).toBe(2);

    returningClient.disconnect();
  }, 35000);

  it("6. Tampered proposal rejection: client verifies proposal, detects mismatch, refuses to sign, and does NOT call submitResult", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");

    clientA.connect(roomId);
    clientB.connect(roomId);

    await Promise.all([aReady, bReady]);

    // Play 1. f2f3 e7e5 2. g2g4 d8h4#
    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientA.sendMove("f2f3");
    await Promise.all([move1A, move1B]);

    const move2A = waitForEvent(clientA, "move");
    const move2B = waitForEvent(clientB, "move");
    clientB.sendMove("e7e5");
    await Promise.all([move2A, move2B]);

    const move3A = waitForEvent(clientA, "move");
    const move3B = waitForEvent(clientB, "move");
    clientA.sendMove("g2g4");
    await Promise.all([move3A, move3B]);

    const proposalPromiseB = waitForEvent<ResultProposalMessage>(clientB, "resultProposal");
    clientB.sendMove("d8h4");
    const realProposal = await proposalPromiseB;

    // Simulate malicious/tampered proposal from a compromised relay:
    // Malicious proposal inverts winner to playerA even though Black checkmated White
    const tamperedProposal: ResultProposalMessage = {
      ...realProposal,
      winner: playerAAccount.address, // Tampered! Black delivered checkmate, but proposal claims White won
      outcome: OutcomeCode.WhiteWin,   // Tampered!
    };

    const verification = verifyResultProposal({
      proposal: tamperedProposal,
      moves: clientB.getMoves(),
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
    });

    // Verification MUST fail
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.error).toContain("Replay indicates black checkmated opponent");
    }

    // Client refuses to sign or submit -> on-chain room remains Active (status = 1)
    const roomOnChain: any = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    });
    expect(Number(roomOnChain.status)).toBe(1); // Still Active!

    clientA.disconnect();
    clientB.disconnect();
  }, 30000);
  it("7. Page reload after Resign: opponent resigns -> winner closes client, opens new client, requests result, verifies with inferred resignSeen, signs, submits, settles", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");
    clientA.connect(roomId);
    clientB.connect(roomId);
    await Promise.all([aReady, bReady]);

    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientA.sendMove("e2e4");
    await Promise.all([move1A, move1B]);

    // Opponent (Black) resigns
    const resignA = waitForEvent<ResignMessage>(clientA, "resign");
    clientB.sendResign();
    await resignA;

    // Both players close tabs / disconnect
    clientA.disconnect();
    clientB.disconnect();

    // Winner reopens browser, creates a brand new client
    const clientA2 = createClientForAccount(playerAAccount);
    const finishedPromise = waitForEvent<any>(clientA2, "gameFinished");
    clientA2.connect(roomId);
    const finishedMsg = await finishedPromise;

    expect(finishedMsg.type).toBe("game_finished");
    expect(clientA2.getFinishedInfo()).toBeDefined();
    expect(clientA2.getSeenTerminalEvents().resignSeen).toBe(true);

    const proposalPromise = waitForEvent<ResultProposalMessage>(clientA2, "resultProposal");
    const sigPromise = waitForEvent<ResultSignatureMessage>(clientA2, "resultSignature");
    clientA2.requestResult(roomId);

    const [proposal, relaySig] = await Promise.all([proposalPromise, sigPromise]);

    const verification = verifyResultProposal({
      proposal,
      moves: ["e2e4"],
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
      seenEvents: clientA2.getSeenTerminalEvents(),
    });

    expect(verification.valid).toBe(true);
    expect(proposal.winner.toLowerCase()).toBe(playerAAccount.address.toLowerCase());

    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337
    );
    const playerASig = await playerAAccount.signTypedData(typedData);

    const submitTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        proposal.winner,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        playerASig,
        relaySig.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    const pending: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerAAccount.address],
    });
    expect(pending).toBe(parseEther("0.19"));

    const withdrawTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    clientA2.disconnect();
  }, 35000);

  it("8. Page reload after Draw Agreement: draw agreement -> player closes client, opens new client, requests result, verifies with inferred drawAcceptSeen, signs, submits, settles", async () => {
    const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
    await joinOnChainRoom(playerBWallet, roomId, "0.1");

    const clientA = createClientForAccount(playerAAccount);
    const clientB = createClientForAccount(playerBAccount);

    const aReady = waitForEvent(clientA, "roomState");
    const bReady = waitForEvent(clientB, "roomState");
    clientA.connect(roomId);
    clientB.connect(roomId);
    await Promise.all([aReady, bReady]);

    const move1A = waitForEvent(clientA, "move");
    const move1B = waitForEvent(clientB, "move");
    clientA.sendMove("e2e4");
    await Promise.all([move1A, move1B]);

    const offerForB = waitForEvent<DrawOfferMessage>(clientB, "drawOffer");
    clientA.sendDrawOffer();
    await offerForB;

    const acceptForA = waitForEvent(clientA, "drawAccept");
    clientB.sendDrawAccept();
    await acceptForA;

    // Disconnect clients
    clientA.disconnect();
    clientB.disconnect();

    // Player A reopens new client
    const clientA2 = createClientForAccount(playerAAccount);
    const finishedPromise = waitForEvent<any>(clientA2, "gameFinished");
    clientA2.connect(roomId);
    await finishedPromise;

    expect(clientA2.getSeenTerminalEvents().drawAcceptSeen).toBe(true);

    const proposalPromise = waitForEvent<ResultProposalMessage>(clientA2, "resultProposal");
    const sigPromise = waitForEvent<ResultSignatureMessage>(clientA2, "resultSignature");
    clientA2.requestResult(roomId);

    const [proposal, relaySig] = await Promise.all([proposalPromise, sigPromise]);

    const verification = verifyResultProposal({
      proposal,
      moves: ["e2e4"],
      whiteAddress: playerAAccount.address,
      blackAddress: playerBAccount.address,
      roomId,
      chainId: 31337,
      escrowAddress,
      now: Math.floor(Date.now() / 1000),
      seenEvents: clientA2.getSeenTerminalEvents(),
    });

    expect(verification.valid).toBe(true);
    expect(proposal.outcome).toBe(OutcomeCode.Draw);

    const typedData = buildResultTypedData(
      escrowAddress,
      {
        matchId: BigInt(roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337
    );
    const playerASig = await playerAAccount.signTypedData(typedData);

    const submitTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "submitResult",
      args: [
        BigInt(roomId),
        proposal.winner,
        proposal.outcome,
        proposal.reason,
        proposal.moveCount,
        proposal.movesHash,
        BigInt(proposal.nonce),
        BigInt(proposal.deadline),
        playerASig,
        relaySig.signature as Hex,
      ],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

    // In draw, each player gets 50% pot without fee
    const pendingA: bigint = await anvil!.publicClient.readContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "pendingWithdrawals",
      args: [playerAAccount.address],
    });
    expect(pendingA).toBe(parseEther("0.1"));

    const withdrawTx = await playerAWallet.writeContract({
      address: escrowAddress,
      abi: escrowAbi,
      functionName: "withdraw",
      args: [],
    });
    await anvil!.publicClient.waitForTransactionReceipt({ hash: withdrawTx });

    clientA2.disconnect();
  }, 35000);

  it("9. Page reload after Timeout: clock runs down on short-timer server -> winner closes client, opens new client, requests result, verifies with inferred timeoutSeen, signs, submits, settles", async () => {
    const shortPort = relayPort + 10;
    const shortResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), "turn3c2-short-results-"));
    const shortActiveDir = fs.mkdtempSync(path.join(os.tmpdir(), "turn3c2-short-active-"));

    const shortServer = new RelayServer({
      port: shortPort,
      relayPrivateKey: ANVIL_ACCOUNTS[1].privateKey,
      contractAddress: escrowAddress,
      rpcUrl: anvil!.rpcUrl,
      chainId: 31337,
      publicClient: anvil!.publicClient,
      walletClient: relayWallet,
      resultsDir: shortResultsDir,
      activeDir: shortActiveDir,
      signalGameStartedEnabled: true,
      initialTimeMs: 3000,
    });

    try {
      const roomId = await createOnChainRoom(playerAWallet, true, "0.1");
      await joinOnChainRoom(playerBWallet, roomId, "0.1");

      const clientA = createClientForAccount(playerAAccount, shortPort);
      const clientB = createClientForAccount(playerBAccount, shortPort);

      const aReady = waitForEvent(clientA, "roomState");
      const bReady = waitForEvent(clientB, "roomState");
      clientA.connect(roomId);
      clientB.connect(roomId);
      await Promise.all([aReady, bReady]);

      // White moves e2e4. Turn becomes Black.
      const move1A = waitForEvent(clientA, "move");
      const move1B = waitForEvent(clientB, "move");
      clientA.sendMove("e2e4");
      await Promise.all([move1A, move1B]);

      // Wait for Black's 3000ms clock to run out
      const timeoutA = waitForEvent<any>(clientA, "timeout", 10000);
      const timeoutMsg = await timeoutA;
      expect(timeoutMsg.type).toBe("timeout");
      expect(timeoutMsg.player).toBe("b");

      // Disconnect
      clientA.disconnect();
      clientB.disconnect();

      // Winner (Player A) reconnects fresh
      const clientA2 = createClientForAccount(playerAAccount, shortPort);
      const finishedPromise = waitForEvent<any>(clientA2, "gameFinished");
      clientA2.connect(roomId);
      await finishedPromise;

      expect(clientA2.getSeenTerminalEvents().timeoutSeen).toBe(true);

      const proposalPromise = waitForEvent<ResultProposalMessage>(clientA2, "resultProposal");
      const sigPromise = waitForEvent<ResultSignatureMessage>(clientA2, "resultSignature");
      clientA2.requestResult(roomId);

      const [proposal, relaySig] = await Promise.all([proposalPromise, sigPromise]);

      const verification = verifyResultProposal({
        proposal,
        moves: ["e2e4"],
        whiteAddress: playerAAccount.address,
        blackAddress: playerBAccount.address,
        roomId,
        chainId: 31337,
        escrowAddress,
        now: Math.floor(Date.now() / 1000),
        seenEvents: clientA2.getSeenTerminalEvents(),
      });

      expect(verification.valid).toBe(true);
      expect(proposal.winner.toLowerCase()).toBe(playerAAccount.address.toLowerCase());
      expect(proposal.reason).toBe(ReasonCode.Timeout);

      const typedData = buildResultTypedData(
        escrowAddress,
        {
          matchId: BigInt(roomId),
          winner: proposal.winner,
          outcome: proposal.outcome,
          reason: proposal.reason,
          moveCount: proposal.moveCount,
          movesHash: proposal.movesHash,
          nonce: BigInt(proposal.nonce),
          deadline: BigInt(proposal.deadline),
        },
        31337
      );
      const playerASig = await playerAAccount.signTypedData(typedData);

      const submitTx = await playerAWallet.writeContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "submitResult",
        args: [
          BigInt(roomId),
          proposal.winner,
          proposal.outcome,
          proposal.reason,
          proposal.moveCount,
          proposal.movesHash,
          BigInt(proposal.nonce),
          BigInt(proposal.deadline),
          playerASig,
          relaySig.signature as Hex,
        ],
      });
      await anvil!.publicClient.waitForTransactionReceipt({ hash: submitTx });

      const pending: bigint = await anvil!.publicClient.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "pendingWithdrawals",
        args: [playerAAccount.address],
      });
      expect(pending).toBe(parseEther("0.19"));

      clientA2.disconnect();
    } finally {
      await shortServer.close();
      try {
        fs.rmSync(shortResultsDir, { recursive: true, force: true });
        fs.rmSync(shortActiveDir, { recursive: true, force: true });
      } catch {}
    }
  }, 45000);
});
