import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An interactive Prisma transaction (`withAuthenticatedUser(async (tx, ...) => ...)`)
 * owns exactly ONE pg connection. Issuing several queries concurrently on that
 * transaction client (Promise.all / Promise.allSettled whose arguments touch `tx`)
 * relies on pg's deprecated internal queueing and breaks in pg@9:
 * "Calling client.query() when the client is already executing a query is deprecated".
 *
 * This guard fails if any lib/ source (excluding generated code and tests) issues
 * transaction-client queries concurrently. Serialize them with sequential awaits instead.
 */
const LIB_DIR = join(__dirname, "..");

function listSourceFiles(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "generated") continue; // Prisma client output
      entries.push(...listSourceFiles(fullPath));
    } else if (name.name.endsWith(".ts") && !name.name.endsWith(".test.ts")) {
      entries.push(fullPath);
    }
  }
  return entries;
}

/** Returns the argument text of the call whose "(" sits at `openParenIndex`. */
function extractCallArguments(source: string, openParenIndex: number): string {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    const char = source[i];
    if (char === "(") depth++;
    else if (char === ")") {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex, openParenIndex + 500);
}

describe("transaction query concurrency guard", () => {
  it("forbids Promise.all / Promise.allSettled over a transaction client", () => {
    const offenders: string[] = [];

    for (const filePath of listSourceFiles(LIB_DIR)) {
      const source = readFileSync(filePath, "utf8");
      const callPattern = /Promise\.all(Settled)?\(/g;
      let match: RegExpExecArray | null;
      while ((match = callPattern.exec(source)) !== null) {
        const args = extractCallArguments(source, match.index + match[0].length - 1);
        const touchesTx = /tx\.|\(tx,|\(tx\)/.test(args);
        if (touchesTx) {
          const relative = filePath.replace(/\\/g, "/");
          const line = source.slice(0, match.index).split("\n").length;
          offenders.push(`${relative}:${line}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
