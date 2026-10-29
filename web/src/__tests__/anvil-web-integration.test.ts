import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { parseEther, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import {
  startAnvil,
  deployContractsOnAnvil,
  isAnvilAvailable,
  ANVIL_ACCOUNTS,
  type AnvilInstance,
} from "../../../packages/relay/tests/helpers/anvil";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";

describe.runIf(isAnvilAvailable())(
  "Web Contract Anvil End-to-End Integration",
  () => {
    let anvil: AnvilInstance;
    let escrowAddress: `0x${string}`;

    const creatorAccount = privateKeyToAccount(ANVIL_ACCOUNTS[4].privateKey);
    const joinerAccount = privateKeyToAccount(ANVIL_ACCOUNTS[5].privateKey);

    beforeAll(async () => {
      anvil = await startAnvil();
      const deployed = await deployContractsOnAnvil(anvil);
      escrowAddress = deployed.escrowAddress;
    });

    afterAll(() => {
      if (anvil) {
        anvil.stop();
      }
    });

    it("Full web contract flow: createRoom, reject self-join, joinRoom, verify status and withdrawal guard", async () => {
      const creatorWallet = createWalletClient({
        account: creatorAccount,
        chain: {
          ...localhost,
          id: 31337,
          rpcUrls: { default: { http: [anvil.rpcUrl] } },
        },
        transport: http(),
      });

      const joinerWallet = createWalletClient({
        account: joinerAccount,
        chain: {
          ...localhost,
          id: 31337,
          rpcUrls: { default: { http: [anvil.rpcUrl] } },
        },
        transport: http(),
      });

      // 1. Initial nextRoomId is 0
      const initialNextRoomId = await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "nextRoomId",
      });
      expect(initialNextRoomId).toBe(0n);

      // 2. Creator creates room #0: 0.05 AVAX, creatorIsWhite = true
      const createTx = await creatorWallet.writeContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "createRoom",
        args: [true],
        value: parseEther("0.05"),
      });
      const createReceipt =
        await anvil.publicClient.waitForTransactionReceipt({ hash: createTx });
      expect(createReceipt.status).toBe("success");

      // 3. Verify nextRoomId incremented to 1
      const nextRoomId = await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "nextRoomId",
      });
      expect(nextRoomId).toBe(1n);

      // 4. Read room #0: Open (status = 0), creator = creatorAccount.address, stake = 0.05 AVAX
      const room0 = (await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "getRoom",
        args: [0n],
      })) as any;

      expect(room0.status).toBe(0); // Open
      expect(room0.playerA.toLowerCase()).toBe(
        creatorAccount.address.toLowerCase()
      );
      expect(room0.stake).toBe(parseEther("0.05"));
      expect(room0.creatorIsWhite).toBe(true);

      // 5. Creator cannot join own room (CannotJoinOwnRoom)
      await expect(
        creatorWallet.writeContract({
          address: escrowAddress,
          abi: CHESS_ESCROW_ABI,
          functionName: "joinRoom",
          args: [0n],
          value: parseEther("0.05"),
        })
      ).rejects.toThrow();

      // 6. Joiner joins room with exact stake 0.05 AVAX
      const joinTx = await joinerWallet.writeContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "joinRoom",
        args: [0n],
        value: parseEther("0.05"),
      });
      const joinReceipt =
        await anvil.publicClient.waitForTransactionReceipt({ hash: joinTx });
      expect(joinReceipt.status).toBe("success");

      // 7. Verify room #0 is now Active (status = 1) with playerB = joinerAccount.address
      const room0Active = (await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "getRoom",
        args: [0n],
      })) as any;

      expect(room0Active.status).toBe(1); // Active
      expect(room0Active.playerB.toLowerCase()).toBe(
        joinerAccount.address.toLowerCase()
      );

      // 8. Pending withdrawals check: initially 0
      const pendingCreator = await anvil.publicClient.readContract({
        address: escrowAddress,
        abi: CHESS_ESCROW_ABI,
        functionName: "pendingWithdrawals",
        args: [creatorAccount.address],
      });
      expect(pendingCreator).toBe(0n);

      // 9. Withdrawing with 0 balance reverts (NothingToWithdraw)
      await expect(
        creatorWallet.writeContract({
          address: escrowAddress,
          abi: CHESS_ESCROW_ABI,
          functionName: "withdraw",
        })
      ).rejects.toThrow();
    });
  }
);
