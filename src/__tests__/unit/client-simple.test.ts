import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { resolveQueryBaseUrl } from "../../api/client";

describe("Client Error Messages", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = {
      BETTERSTACK_API_TOKEN: process.env.BETTERSTACK_API_TOKEN,
      BETTERSTACK_QUERY_USERNAME: process.env.BETTERSTACK_QUERY_USERNAME,
      BETTERSTACK_QUERY_PASSWORD: process.env.BETTERSTACK_QUERY_PASSWORD,
      BSLOG_QUERY_HOST: process.env.BSLOG_QUERY_HOST,
    };
  });

  afterEach(() => {
    // Restore original environment variables
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe("error message formatting", () => {
    it("should format malformed token error message correctly", () => {
      process.env.BETTERSTACK_API_TOKEN = "test-token";
      delete process.env.BETTERSTACK_QUERY_USERNAME;
      delete process.env.BETTERSTACK_QUERY_PASSWORD;

      const expectedError =
        `Query API authentication failed: Malformed token\n\n` +
        `This usually means your Query API credentials are not set.\n\n` +
        `Current environment:\n` +
        `  BETTERSTACK_API_TOKEN: ✓ Set\n` +
        `  BETTERSTACK_QUERY_USERNAME: ✗ Not set\n` +
        `  BETTERSTACK_QUERY_PASSWORD: ✗ Not set\n\n` +
        `To fix this:\n` +
        `1. Add these to your ~/.zshrc or ~/.bashrc:\n` +
        `   export BETTERSTACK_QUERY_USERNAME="your_username"\n` +
        `   export BETTERSTACK_QUERY_PASSWORD="your_password"\n\n` +
        `2. Reload your shell:\n` +
        `   source ~/.zshrc\n\n` +
        `3. Or set them for this session:\n` +
        `   export BETTERSTACK_QUERY_USERNAME="your_username"\n` +
        `   export BETTERSTACK_QUERY_PASSWORD="your_password"\n\n` +
        `To get Query API credentials:\n` +
        `1. Go to Better Stack > Logs > Dashboards\n` +
        `2. Click "Connect remotely"\n` +
        `3. Create credentials and save them`;

      expect(expectedError).toContain("BETTERSTACK_API_TOKEN: ✓ Set");
      expect(expectedError).toContain("BETTERSTACK_QUERY_USERNAME: ✗ Not set");
      expect(expectedError).toContain("To fix this:");
      expect(expectedError).toContain("Go to Better Stack > Logs > Dashboards");
    });

    it("should format authentication failure message correctly", () => {
      const expectedError =
        `Query API authentication failed.\n\n` +
        `The Query API requires separate credentials from your API token.\n` +
        `To create credentials:\n` +
        `1. Go to Better Stack > Logs > Dashboards\n` +
        `2. Click "Connect remotely"\n` +
        `3. Create credentials and save them\n\n` +
        `Then set them as environment variables:\n` +
        `export BETTERSTACK_QUERY_USERNAME="your_username"\n` +
        `export BETTERSTACK_QUERY_PASSWORD="your_password"\n\n` +
        `Or pass them directly:\n` +
        `bslog tail --username "user" --password "pass"`;

      expect(expectedError).toContain("The Query API requires separate credentials");
      expect(expectedError).toContain("Go to Better Stack > Logs > Dashboards");
      expect(expectedError).toContain('Click "Connect remotely"');
      expect(expectedError).toContain("export BETTERSTACK_QUERY_USERNAME");
    });
  });

  describe("Query API base URL", () => {
    it("returns the default eu-nbg-2 host when BSLOG_QUERY_HOST is unset", () => {
      delete process.env.BSLOG_QUERY_HOST;

      expect(resolveQueryBaseUrl({})).toBe("https://eu-nbg-2-connect.betterstackdata.com");
    });

    it("returns the config URL when BSLOG_QUERY_HOST is unset", () => {
      delete process.env.BSLOG_QUERY_HOST;

      expect(
        resolveQueryBaseUrl({
          queryBaseUrl: "https://us-east-1-connect.betterstackdata.com",
        }),
      ).toBe("https://us-east-1-connect.betterstackdata.com");
    });

    it("lets BSLOG_QUERY_HOST override config", () => {
      process.env.BSLOG_QUERY_HOST = "https://eu-fsn-3-connect.betterstackdata.com";

      expect(
        resolveQueryBaseUrl({
          queryBaseUrl: "https://us-east-1-connect.betterstackdata.com",
        }),
      ).toBe("https://eu-fsn-3-connect.betterstackdata.com");
    });

    it("treats an empty BSLOG_QUERY_HOST as unset and falls back to config", () => {
      process.env.BSLOG_QUERY_HOST = "";

      expect(
        resolveQueryBaseUrl({
          queryBaseUrl: "https://us-east-1-connect.betterstackdata.com",
        }),
      ).toBe("https://us-east-1-connect.betterstackdata.com");
    });
  });
});
