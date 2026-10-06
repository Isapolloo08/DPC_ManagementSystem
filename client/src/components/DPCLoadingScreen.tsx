import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChurchLogo } from "./common/ChurchLogo";
import ParticleText from "./ParticleText/ParticleText";
import { StartupShootingStar } from "./StartupShootingStar";
import "./DPCLoadingScreen.css";

const TITLE = "DPC Church Management System";
const FONT_FAMILY = '"Barlow Condensed", system-ui, sans-serif';
const SCATTER_HOLD_MS = 2000;
const GATHER_MS = 1600;
const STAGGER_MS = 420;
const METEOR_DELAY_MS = 450;
const METEOR_MS = 1200;
const LOGO_REVEAL_MS = 650;
const HOLD_MS = 650;
const EXIT_MS = 600;
const canvasStyle: CSSProperties = { height: "100%", minHeight: 0 };

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function hasAlreadySeenIntro(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(sessionStorage.getItem("dpc_intro_shown"));
  } catch {
    return false;
  }
}

function markIntroAsShown(): void {
  try {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("dpc_intro_shown", "true");
    }
  } catch {}
}

/** Auth prepares in parallel; the workspace mounts as the original intro exits. */
export function DPCLoadingScreen({ children, ready }: {
  children: ReactNode | ((showWorkspace: boolean) => ReactNode);
  ready: boolean;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const compact = useMediaQuery("(max-width: 640px)");
  const [phase, setPhase] = useState<"intro" | "exiting" | "complete">(() =>
    hasAlreadySeenIntro() ? "complete" : "intro"
  );
  const [titleMode, setTitleMode] = useState<"waiting" | "particles" | "static">("waiting");
  const [particlesFormed, setParticlesFormed] = useState(false);
  const [meteorVisible, setMeteorVisible] = useState(false);
  const [logoRevealed, setLogoRevealed] = useState(false);
  const [titleFinished, setTitleFinished] = useState(false);
  const [readinessTimedOut, setReadinessTimedOut] = useState(false);
  const compositionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "intro") return;
    if (reducedMotion) {
      setTitleMode("static");
      return;
    }

    let cancelled = false;
    let stageReady = false;
    let fontsReady = false;
    const start = () => {
      if (cancelled || !stageReady || !fontsReady) return;
      window.clearTimeout(fallbackTimer);
      setTitleMode("particles");
    };
    const stageTimer = window.setTimeout(() => {
      stageReady = true;
      start();
    }, 350);
    // The upstream component waits for fonts before sampling its canvas. Prepare
    // the bundled font first, so the hold timer cannot outrun a font download.
    const fallbackTimer = window.setTimeout(() => {
      cancelled = true;
      setTitleMode("static");
    }, 2000);
    const prepareFonts = async () => {
      try {
        await document.fonts.load(`800 64px ${FONT_FAMILY}`);
        await document.fonts.ready;
        if (!cancelled) {
          fontsReady = true;
          start();
        }
      } catch {
        if (!cancelled) {
          cancelled = true;
          window.clearTimeout(fallbackTimer);
          setTitleMode("static");
        }
      }
    };
    void prepareFonts();

    return () => {
      cancelled = true;
      window.clearTimeout(stageTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "intro" || titleMode === "waiting") return;
    let formedTimer: number;
    const restartHold = () => {
      window.clearTimeout(formedTimer);
      setParticlesFormed(false);
      setMeteorVisible(false);
      setLogoRevealed(false);
      setTitleFinished(false);
      // React Bits has no completion callback. Include its maximum stagger and
      // a small settling allowance; resizing rebuilds the upstream particles.
      const gatherTime = titleMode === "particles" ? SCATTER_HOLD_MS + GATHER_MS + STAGGER_MS + 120 : 0;
      formedTimer = window.setTimeout(() => setParticlesFormed(true), gatherTime);
    };
    restartHold();
    const observer = new ResizeObserver(restartHold);
    if (compositionRef.current) observer.observe(compositionRef.current);
    return () => {
      window.clearTimeout(formedTimer);
      observer.disconnect();
    };
  }, [phase, titleMode, compact]);

  useEffect(() => {
    if (phase !== "intro" || !particlesFormed) return;
    if (titleMode === "static") {
      setLogoRevealed(true);
      const finishTimer = window.setTimeout(() => setTitleFinished(true), HOLD_MS);
      return () => window.clearTimeout(finishTimer);
    }

    // Let the completed words settle, then use one understated streak to
    // introduce the logo. Exit only after its reveal and the final hold.
    const meteorTimer = window.setTimeout(() => setMeteorVisible(true), METEOR_DELAY_MS);
    const meteorEndTimer = window.setTimeout(() => setMeteorVisible(false), METEOR_DELAY_MS + METEOR_MS);
    const revealAt = METEOR_DELAY_MS + METEOR_MS - 120;
    const revealTimer = window.setTimeout(() => setLogoRevealed(true), revealAt);
    const finishTimer = window.setTimeout(() => setTitleFinished(true), revealAt + LOGO_REVEAL_MS + HOLD_MS);
    return () => {
      window.clearTimeout(meteorTimer);
      window.clearTimeout(meteorEndTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, [phase, particlesFormed, titleMode]);

  useEffect(() => {
    // A stalled server must not permanently hide the existing recovery UI.
    const timer = window.setTimeout(() => setReadinessTimedOut(true), 10000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "intro" && titleFinished && (ready || readinessTimedOut)) {
      setPhase("exiting");
    }
  }, [phase, titleFinished, ready, readinessTimedOut]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = window.setTimeout(() => {
      setPhase("complete");
      markIntroAsShown();
    }, reducedMotion ? 150 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  const showing = phase !== "complete";
  useEffect(() => {
    if (!showing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("dpc-startup-active");
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("dpc-startup-active");
    };
  }, [showing]);

  return (
    <>
      <div
        className={showing ? "dpc-startup__app" : undefined}
        data-startup-phase={phase}
        inert={showing}
        aria-hidden={showing || undefined}
      >
        {typeof children === "function" ? children(phase !== "intro") : children}
      </div>
      {showing && (
        <div
          className="dpc-startup fixed inset-0 z-[9999] h-screen w-screen overflow-hidden bg-[#08111f]"
          data-phase={phase}
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading {TITLE}</span>
          <div ref={compositionRef} className="dpc-startup__composition" aria-hidden="true">
            <div className="dpc-startup__brand">
              {titleMode === "particles" && !reducedMotion && <StartupShootingStar active={meteorVisible} duration={METEOR_MS} />}
              <ChurchLogo
                variant="plain"
                alt=""
                className={`dpc-startup__logo${logoRevealed ? " dpc-startup__logo--revealed" : ""}`}
              />
            </div>
            {titleMode === "static" ? (
              <div className="dpc-startup__static-title">
                {compact ? <><span>DPC Church</span><span>Management System</span></> : TITLE}
              </div>
            ) : titleMode === "particles" && (
              (compact ? ["DPC Church", "Management System"] : [TITLE]).map((text, index) => (
                <div
                  key={text}
                  className={`dpc-startup__line${compact ? ` dpc-startup__line--${index + 1}` : ""}${particlesFormed && !meteorVisible ? " dpc-startup__line--interactive" : ""}`}
                >
                  <ParticleText
                    text={text}
                    particleSize={compact ? 1 : 2}
                    density={compact ? 2 : 3}
                    color="#d7b66e"
                    highlightColor="#fff0c4"
                    scatter={220}
                    initialSpread="viewport"
                    gatherDelay={SCATTER_HOLD_MS}
                    fieldDrift={10}
                    ambientStars={compact ? 360 : 1000}
                    starVariation
                    pauseAfterGather
                    gatherDuration={GATHER_MS}
                    stagger={STAGGER_MS}
                    pointerRepel={14}
                    repelRadius={100}
                    idleDrift={0.5}
                    trigger="mount"
                    fontSize={compact ? "clamp(2rem, 8vw, 3.25rem)" : "clamp(2rem, 7vw, 6.5rem)"}
                    fontWeight={800}
                    fontFamily={FONT_FAMILY}
                    glow
                    style={canvasStyle}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
