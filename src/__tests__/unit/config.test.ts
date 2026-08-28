import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Config suite isolation", () => {
  it.each([
    [false, undefined],
    [true, ""],
    [true, "custom"],
  ] as const)(
    "leaves home config untouched (existing: %p, inherited override: %p)",
    (existing, override) => {
      const root = mkdtempSync(join(tmpdir(), "bslog-config-suite-"));
      const homeDir = join(root, "home");
      const homeConfigDir = join(homeDir, ".bslog");
      const inheritedConfigDir = join(root, "inherited-config");
      const sentinel = '{"defaultSource":"do-not-touch","defaultLimit":9876}\n';

      try {
        mkdirSync(homeDir);
        mkdirSync(inheritedConfigDir);
        writeFileSync(join(inheritedConfigDir, "config.json"), sentinel);
        if (existing) {
          mkdirSync(homeConfigDir);
          writeFileSync(join(homeConfigDir, "config.json"), sentinel);
          writeFileSync(join(homeConfigDir, "keep.txt"), "unrelated user data\n");
        }

        // A fresh process avoids other suites' module mocks. Even a broken cleanup
        // can only damage this disposable home, never the developer's directory.
        const result = spawnSync(
          process.execPath,
          ["test", "--max-concurrency=1", "./src/__tests__/fixtures/config-suite.ts"],
          {
            cwd: join(import.meta.dir, "../../.."),
            env: {
              ...process.env,
              HOME: homeDir,
              USERPROFILE: homeDir,
              BSLOG_CONFIG_DIR: override === "custom" ? inheritedConfigDir : override,
            },
            encoding: "utf8",
            timeout: 60_000,
          },
        );

        expect(result.error, result.stdout + result.stderr).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(existsSync(homeConfigDir)).toBe(existing);
        if (existing) {
          expect(readdirSync(homeConfigDir).sort()).toEqual(["config.json", "keep.txt"]);
          expect(readFileSync(join(homeConfigDir, "config.json"), "utf8")).toBe(sentinel);
          expect(readFileSync(join(homeConfigDir, "keep.txt"), "utf8")).toBe(
            "unrelated user data\n",
          );
        }
        expect(readdirSync(inheritedConfigDir)).toEqual(["config.json"]);
        expect(readFileSync(join(inheritedConfigDir, "config.json"), "utf8")).toBe(sentinel);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    65_000,
  );
});
