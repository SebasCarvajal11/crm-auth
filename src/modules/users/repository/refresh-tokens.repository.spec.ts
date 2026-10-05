import { describe, expect, it, vi } from "vitest";
import { createRefreshTokensRepository } from "./refresh-tokens.repository";
import { refreshTokens } from "../../../db/schema";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("refresh-tokens.repository and schema", () => {
  it("defines unique index on token_hash for O(1) session lookups (FIND-DB-02)", () => {
    const tableConfig = getTableConfig(refreshTokens);
    const uniqueIndex = tableConfig.indexes.find(
      (idx) => idx.config.name === "refresh_tokens_token_hash_uq"
    );

    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.config.unique).toBe(true);
  });

  it("queries refresh token by tokenHash via findRefreshToken", async () => {
    const mockLimit = vi.fn().mockResolvedValue([{ id: "tok-1", tokenHash: "hash-123" }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    const mockConn: any = {
      select: mockSelect,
    };

    const repo = createRefreshTokensRepository(mockConn);
    const token = await repo.findRefreshToken("hash-123");

    expect(token).toEqual({ id: "tok-1", tokenHash: "hash-123" });
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith(refreshTokens);
    expect(mockWhere).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(1);
  });
});
