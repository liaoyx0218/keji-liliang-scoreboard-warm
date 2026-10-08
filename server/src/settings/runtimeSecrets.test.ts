import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyRuntimeSecrets,
  applySettingsPatch,
  loadRuntimeSecrets,
  maskSecret,
  mergeRuntimeSecrets,
  saveRuntimeSecrets,
  statusFromEnv,
} from "./runtimeSecrets.js";

const tmpFiles: string[] = [];

afterEach(() => {
  for (const f of tmpFiles.splice(0)) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
});

function tmpPath() {
  const p = path.join(os.tmpdir(), `kl-secrets-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  tmpFiles.push(p);
  return p;
}

describe("runtimeSecrets", () => {
  it("maskSecret hides middle", () => {
    expect(maskSecret("abcd")).toBe("••••");
    expect(maskSecret("ark-secret-1234")).toBe("…1234");
  });

  it("statusFromEnv reports configured", () => {
    const s = statusFromEnv({ ARK_API_KEY: "key-zzzz" } as NodeJS.ProcessEnv);
    expect(s.ARK_API_KEY.configured).toBe(true);
    expect(s.ARK_API_KEY.hint).toBe("…zzzz");
    expect(s.ALIYUN_AK_ID.configured).toBe(false);
  });

  it("save/load roundtrip", () => {
    const file = tmpPath();
    saveRuntimeSecrets(file, { ARK_API_KEY: " abc ", ALIYUN_AK_ID: "" });
    expect(loadRuntimeSecrets(file)).toEqual({ ARK_API_KEY: "abc" });
  });

  it("merge clears with empty string and updates others", () => {
    const next = mergeRuntimeSecrets(
      { ARK_API_KEY: "old", ALIYUN_AK_ID: "id1" },
      { ARK_API_KEY: "", NLS_APP_KEY: "nls" }
    );
    expect(next).toEqual({ ALIYUN_AK_ID: "id1", NLS_APP_KEY: "nls" });
  });

  it("applyRuntimeSecrets only sets provided keys", () => {
    const env: NodeJS.ProcessEnv = { ARK_API_KEY: "stale" };
    applyRuntimeSecrets({ ALIYUN_AK_ID: "ak" }, env);
    expect(env.ALIYUN_AK_ID).toBe("ak");
    expect(env.ARK_API_KEY).toBe("stale");
  });

  it("applySettingsPatch updates and clears patched keys only", () => {
    const file = tmpPath();
    const env: NodeJS.ProcessEnv = { ARK_API_KEY: "old", NLS_APP_KEY: "keep" };
    saveRuntimeSecrets(file, { ARK_API_KEY: "old" });
    const fields = applySettingsPatch(file, { ARK_API_KEY: "new", ALIYUN_AK_ID: "id" }, env);
    expect(env.ARK_API_KEY).toBe("new");
    expect(env.ALIYUN_AK_ID).toBe("id");
    expect(env.NLS_APP_KEY).toBe("keep");
    expect(fields.ARK_API_KEY.configured).toBe(true);
    applySettingsPatch(file, { ARK_API_KEY: "" }, env);
    expect(env.ARK_API_KEY).toBeUndefined();
    expect(loadRuntimeSecrets(file).ARK_API_KEY).toBeUndefined();
  });
});
