import { useState } from "react";
import type { App } from "../App";
import { BandRuler } from "./BandRuler";
import { ScreenFit } from "./ScreenFit";

/**
 * What the device actually reports, rather than what we assume it reports.
 *
 * The status-bar work turns entirely on two numbers — the top safe-area inset
 * and whether the viewport covers the screen — and neither is observable from
 * a desktop browser or from a screenshot. This panel puts them somewhere they
 * can be read off the phone and pasted back.
 */

/** env() has no computed value to read, so measure a probe box instead. */
function inset(side: "top" | "right" | "bottom" | "left"): number {
  const el = document.createElement("div");
  const vert = side === "top" || side === "bottom";
  el.style.cssText =
    "position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;" +
    (vert ? "width:1px;height:" : "height:1px;width:") +
    `env(safe-area-inset-${side},0px)`;
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.remove();
  return Math.round((vert ? r.height : r.width) * 10) / 10;
}

const yn = (b: boolean): string => (b ? "yes" : "no");

function report(): string {
  const d = document.documentElement;
  const vv = window.visualViewport;
  const nav = navigator as Navigator & { standalone?: boolean };
  const root = document.querySelector(".app-root");
  const band = document.querySelector(".status-band");
  // the library is .scroll-screen, every other view is .screen
  const screenEl = document.querySelector(".screen, .scroll-screen");
  const top = (el: Element | null): string =>
    el ? String(Math.round(el.getBoundingClientRect().top)) : "-";
  const h = (el: Element | null): string =>
    el ? String(Math.round(el.getBoundingClientRect().height)) : "-";
  const mm = (q: string): boolean => !!window.matchMedia?.(q).matches;

  const gap =
    Math.max(screen.width, screen.height) -
    Math.max(window.innerWidth, window.innerHeight);

  return [
    `BUILD   ${__BUILD__}`,
    `SW      controlled=${yn(!!navigator.serviceWorker?.controller)}`,
    `MODE    dm-standalone=${yn(mm("(display-mode: standalone)"))} ` +
      `nav.standalone=${nav.standalone === undefined ? "n/a" : yn(!!nav.standalone)} ` +
      `fullscreen=${yn(mm("(display-mode: fullscreen)"))}`,
    `SCREEN  ${screen.width}x${screen.height} avail ${screen.availWidth}x${screen.availHeight} dpr ${window.devicePixelRatio}`,
    `WINDOW  inner ${window.innerWidth}x${window.innerHeight} outer ${window.outerWidth}x${window.outerHeight}`,
    `DOCEL   client ${d.clientWidth}x${d.clientHeight} scroll ${window.scrollX},${window.scrollY}`,
    vv
      ? `VVIEW   ${Math.round(vv.width)}x${Math.round(vv.height)} offset ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)} page ${Math.round(vv.pageLeft)},${Math.round(vv.pageTop)} scale ${vv.scale}`
      : "VVIEW   n/a",
    `INSETS  top=${inset("top")} right=${inset("right")} bottom=${inset("bottom")} left=${inset("left")}`,
    `BAND    top=${d.style.getPropertyValue("--band-top") || "(css)"} ` +
      `fade=${d.style.getPropertyValue("--band-fade") || "(css)"} ` +
      `extra=${d.style.getPropertyValue("--vh-extra") || "(css)"} ` +
      `h=${h(band)} pad=${root ? getComputedStyle(root).paddingTop : "-"}`,
    `BOXES   rootTop=${top(root)} rootH=${h(root)} screenTop=${top(screenEl)}`,
    `GAP     ${gap} ${gap <= 8 ? "(viewport covers the screen — the band is ours to paint)" : "(iOS has inset us by this much and drawn its own band)"}`,
    `UA      ${navigator.userAgent}`,
  ].join("\n");
}

export function Diag({ app }: { app: App }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [ruler, setRuler] = useState(false);
  const [fit, setFit] = useState(false);

  const refresh = (): void => {
    setText(report());
    setCopied(false);
  };

  return (
    <div style={{ marginTop: 2 }}>
      {ruler && <BandRuler app={app} onClose={() => setRuler(false)} />}
      {fit && <ScreenFit app={app} onClose={() => setFit(false)} />}

      <button
        onClick={() => {
          if (!open) refresh();
          setOpen(!open);
        }}
        style={{
          font: "400 11px IBM Plex Mono,monospace",
          letterSpacing: ".08em",
          color: "rgba(236,231,221,.3)",
        }}
      >
        BUILD {__BUILD__} · {open ? "HIDE" : "DIAGNOSTICS"}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <pre
            style={{
              margin: 0,
              padding: "12px 13px",
              background: "#17171c",
              borderRadius: 10,
              font: "400 10px/1.55 IBM Plex Mono,monospace",
              color: "rgba(236,231,221,.72)",
              // long lines wrap rather than forcing the library to scroll sideways
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          >
            {text}
          </pre>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 9,
                background: "#22222a",
                font: "600 10px IBM Plex Mono,monospace",
                letterSpacing: ".08em",
                color: "rgba(236,231,221,.7)",
              }}
            >
              {copied ? "COPIED" : "COPY"}
            </button>
            <button
              onClick={() => setFit(true)}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 9,
                background: "#22222a",
                font: "600 10px IBM Plex Mono,monospace",
                letterSpacing: ".08em",
                color: "rgba(236,231,221,.7)",
              }}
            >
              SCREEN FIT
            </button>
            <button
              onClick={() => setRuler(true)}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 9,
                background: "#22222a",
                font: "600 10px IBM Plex Mono,monospace",
                letterSpacing: ".08em",
                color: "rgba(236,231,221,.7)",
              }}
            >
              BAND RULER
            </button>
            <button
              onClick={refresh}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 9,
                background: "#22222a",
                font: "600 10px IBM Plex Mono,monospace",
                letterSpacing: ".08em",
                color: "rgba(236,231,221,.7)",
              }}
            >
              RE-READ
            </button>
          </div>
          <div
            style={{
              font: "400 10px/1.6 IBM Plex Mono,monospace",
              color: "rgba(236,231,221,.28)",
              marginTop: 8,
            }}
          >
            RE-READ after rotating. BAND RULER measures how far iOS blurs
            down the top; SCREEN FIT whether there is screen below the bottom.
          </div>
        </div>
      )}
    </div>
  );
}
