import { useEffect, useId, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { DESK_TOKEN } from "../App";
import {
  ApiError,
  createSession,
  fetchSettings,
  saveSettings,
  type SettingsFields,
} from "../api";
import { TechBackdrop } from "../components/TechBackdrop";

const SETTINGS_FIELDS: {
  key: keyof SettingsFields;
  label: string;
  hint: string;
}[] = [
  { key: "ALIYUN_AK_ID", label: "阿里云 AccessKey ID", hint: "智能语音" },
  { key: "ALIYUN_AK_SECRET", label: "阿里云 AccessKey Secret", hint: "智能语音" },
  { key: "NLS_APP_KEY", label: "NLS AppKey", hint: "听写项目" },
  { key: "ARK_API_KEY", label: "火山方舟 API Key", hint: "手抄报生图" },
];

export function CreatePage() {
  const [info, setInfo] = useState<{ sessionId: string; studentUrl: string; teacherUrl: string } | null>(
    null
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  async function onCreate() {
    try {
      setErr("");
      setCopyFeedback("");
      setBusy(true);
      const data = await createSession();
      const origin = window.location.origin;
      setInfo({
        sessionId: data.sessionId,
        studentUrl: `${origin}${data.studentPath}`,
        teacherUrl: `${origin}${data.teacherPath}`,
      });
    } catch {
      setErr("创建失败");
    } finally {
      setBusy(false);
    }
  }

  function downloadQrPng(blob: Blob) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "学生端二维码.png";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyQrCode() {
    setCopyFeedback("");
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) {
      setCopyFeedback("请先创建本场");
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) {
      setCopyFeedback("生成失败");
      return;
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyFeedback("已复制");
      return;
    } catch {
      /* HTTP / permission — fall through to download */
    }

    downloadQrPng(blob);
    setCopyFeedback("已下载二维码");
  }

  return (
    <main className="page create-page">
      <TechBackdrop />
      <button
        type="button"
        className="create-settings-btn"
        aria-label="API 密钥设置"
        onClick={() => setSettingsOpen(true)}
      >
        设置
      </button>
      <span className="status-kicker">开赛准备</span>
      <h1>科技力量大</h1>
      <div className="create-actions">
        <button type="button" onClick={() => void onCreate()} disabled={busy} aria-busy={busy}>
          {busy ? "创建中…" : "创建本场"}
        </button>
      </div>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {info && (
        <section className="panel" aria-label="本场入口">
          <p className="panel-label">学生端</p>
          <code>{info.studentUrl}</code>
          <div className="qr-wrap" ref={qrWrapRef}>
            <QRCodeCanvas value={info.studentUrl} size={256} includeMargin />
          </div>
          <div className="panel-links">
            <button type="button" onClick={() => void copyQrCode()}>
              复制二维码
            </button>
            <a href={info.teacherUrl} target="_blank" rel="noreferrer">
              打开大屏
            </a>
          </div>
          {copyFeedback && (
            <p className="copy-feedback" role="status">
              {copyFeedback}
            </p>
          )}
        </section>
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [fields, setFields] = useState<SettingsFields | null>(null);
  const [draft, setDraft] = useState<Record<keyof SettingsFields, string>>({
    ALIYUN_AK_ID: "",
    ALIYUN_AK_SECRET: "",
    NLS_APP_KEY: "",
    ARK_API_KEY: "",
  });
  const [loadErr, setLoadErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchSettings(DESK_TOKEN);
        if (cancelled) return;
        setFields(data.fields);
        setLoadErr("");
      } catch (e) {
        if (cancelled) return;
        setLoadErr(e instanceof ApiError && e.code === "DESK_FORBIDDEN" ? "无权访问设置" : "加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const patch: Partial<Record<keyof SettingsFields, string>> = {};
      for (const { key } of SETTINGS_FIELDS) {
        if (draft[key].trim()) patch[key] = draft[key].trim();
      }
      if (Object.keys(patch).length === 0) {
        setSaveMsg("请先填写要更新的项");
        return;
      }
      const data = await saveSettings(DESK_TOKEN, patch);
      setFields(data.fields);
      setDraft({
        ALIYUN_AK_ID: "",
        ALIYUN_AK_SECRET: "",
        NLS_APP_KEY: "",
        ARK_API_KEY: "",
      });
      setSaveMsg("已保存");
    } catch {
      setSaveMsg("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onClear(key: keyof SettingsFields) {
    setSaving(true);
    setSaveMsg("");
    try {
      const data = await saveSettings(DESK_TOKEN, { [key]: "" });
      setFields(data.fields);
      setDraft((d) => ({ ...d, [key]: "" }));
      setSaveMsg("已清除该项");
    } catch {
      setSaveMsg("清除失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-overlay" role="presentation" onClick={onClose}>
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-dialog__head">
          <h2 id={titleId}>API 密钥设置</h2>
          <button type="button" className="settings-dialog__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="settings-dialog__lead">
          仅写入本机运行时配置（不进 git）。留空表示不改；点「清除」会删掉当前进程中的该项。
        </p>
        {loadErr && (
          <p className="error" role="alert">
            {loadErr}
          </p>
        )}
        {!loadErr && !fields && <p className="settings-dialog__loading">加载中…</p>}
        {fields && (
          <ul className="settings-fields">
            {SETTINGS_FIELDS.map(({ key, label, hint }) => (
              <li key={key}>
                <label className="settings-field">
                  <span className="settings-field__label">
                    {label}
                    <span className="settings-field__meta">
                      {hint}
                      {fields[key].configured
                        ? ` · 已配置 ${fields[key].hint}`
                        : " · 未配置"}
                    </span>
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={fields[key].configured ? "输入新值以覆盖" : "粘贴密钥"}
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </label>
                {fields[key].configured && (
                  <button
                    type="button"
                    className="settings-field__clear"
                    disabled={saving}
                    onClick={() => void onClear(key)}
                  >
                    清除
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="settings-dialog__actions">
          <button type="button" onClick={onClose}>
            关闭
          </button>
          <button type="button" disabled={saving || !fields} onClick={() => void onSave()}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
        {saveMsg && (
          <p className="copy-feedback" role="status">
            {saveMsg}
          </p>
        )}
      </div>
    </div>
  );
}
