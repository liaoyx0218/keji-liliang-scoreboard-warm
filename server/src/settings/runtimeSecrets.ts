import fs from "node:fs";
import path from "node:path";

/** Secret / API key fields editable from teacher desk settings. */
export const RUNTIME_SECRET_KEYS = [
  "ALIYUN_AK_ID",
  "ALIYUN_AK_SECRET",
  "NLS_APP_KEY",
  "ARK_API_KEY",
] as const;

export type RuntimeSecretKey = (typeof RUNTIME_SECRET_KEYS)[number];

export type RuntimeSecrets = Partial<Record<RuntimeSecretKey, string>>;

export type SecretFieldStatus = {
  configured: boolean;
  /** Masked hint only — never full secret */
  hint: string;
};

function isSecretKey(k: string): k is RuntimeSecretKey {
  return (RUNTIME_SECRET_KEYS as readonly string[]).includes(k);
}

export function maskSecret(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 4) return "••••";
  return `…${v.slice(-4)}`;
}

export function statusFromEnv(env: NodeJS.ProcessEnv = process.env): Record<RuntimeSecretKey, SecretFieldStatus> {
  const out = {} as Record<RuntimeSecretKey, SecretFieldStatus>;
  for (const key of RUNTIME_SECRET_KEYS) {
    const raw = (env[key] ?? "").trim();
    out[key] = {
      configured: raw.length > 0,
      hint: raw ? maskSecret(raw) : "",
    };
  }
  return out;
}

export function loadRuntimeSecrets(filePath: string): RuntimeSecrets {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: RuntimeSecrets = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!isSecretKey(k)) continue;
      if (typeof v !== "string") continue;
      const trimmed = v.trim();
      if (trimmed) out[k] = trimmed;
    }
    return out;
  } catch {
    return {};
  }
}

/** Apply secrets into process.env (overwrites). Empty values are skipped. */
export function applyRuntimeSecrets(secrets: RuntimeSecrets, env: NodeJS.ProcessEnv = process.env) {
  for (const key of RUNTIME_SECRET_KEYS) {
    const v = secrets[key]?.trim();
    if (v) env[key] = v;
  }
}

/**
 * Merge patch into stored secrets.
 * - omitted / undefined: leave unchanged
 * - non-empty string: set
 * - empty string: clear key from store and process.env
 */
export function mergeRuntimeSecrets(current: RuntimeSecrets, patch: Record<string, unknown>): RuntimeSecrets {
  const next: RuntimeSecrets = { ...current };
  for (const key of RUNTIME_SECRET_KEYS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) {
      delete next[key];
    } else {
      next[key] = trimmed;
    }
  }
  return next;
}

export function saveRuntimeSecrets(filePath: string, secrets: RuntimeSecrets) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const clean: RuntimeSecrets = {};
  for (const key of RUNTIME_SECRET_KEYS) {
    const v = secrets[key]?.trim();
    if (v) clean[key] = v;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
}

/**
 * Apply a settings form patch: persist merge, then update only patched keys in env.
 * Empty string clears that key from the runtime file and from `env` for this process.
 */
export function applySettingsPatch(
  filePath: string,
  patch: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env
): Record<RuntimeSecretKey, SecretFieldStatus> {
  const current = loadRuntimeSecrets(filePath);
  const next = mergeRuntimeSecrets(current, patch);
  saveRuntimeSecrets(filePath, next);
  for (const key of RUNTIME_SECRET_KEYS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed) env[key] = trimmed;
    else delete env[key];
  }
  return statusFromEnv(env);
}

/** Full replace of managed keys in env from stored secrets (startup helper). */
export function syncEnvFromSecrets(secrets: RuntimeSecrets, env: NodeJS.ProcessEnv = process.env) {
  applyRuntimeSecrets(secrets, env);
}

export function defaultDeskToken(env: NodeJS.ProcessEnv = process.env): string {
  return (env.DESK_TOKEN ?? "kl-open-8f2c").trim() || "kl-open-8f2c";
}
