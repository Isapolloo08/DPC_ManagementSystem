import { useEffect, useRef, useState } from "react";
import type { WebGLRenderer, CanvasTexture, PlaneGeometry, MeshBasicMaterial } from "three";

type Animation = { play: () => void; stop: () => void };
const PADDING = 24;
const HEAD_X = 16;
const SPRITE_HEIGHT = 48;
const ANGLE = Math.PI / 9;

/** One textured quad, prepared while the title gathers; no React work per frame. */
export function StartupShootingStar({ active, duration }: { active: boolean; duration: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const activeRef = useRef(active);
  const durationRef = useRef(duration);
  const [fallback, setFallback] = useState(false);
  activeRef.current = active;
  durationRef.current = duration;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let cancelled = false;
    let renderer: WebGLRenderer | undefined;
    let texture: CanvasTexture | undefined;
    let geometry: PlaneGeometry | undefined;
    let material: MeshBasicMaterial | undefined;
    let observer: ResizeObserver | undefined;
    let visibilityListener: (() => void) | undefined;
    const dispose = () => {
      renderer?.setAnimationLoop(null);
      observer?.disconnect();
      if (visibilityListener) document.removeEventListener("visibilitychange", visibilityListener);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      renderer?.dispose();
      // Release this short-lived context rather than keeping it through navigation.
      renderer?.forceContextLoss();
    };
    const prepare = async () => {
      try {
        const { WebGLRenderer: Renderer, CanvasTexture: Texture, PlaneGeometry: Plane,
          MeshBasicMaterial: Material, Mesh, Scene, OrthographicCamera, SRGBColorSpace, LinearFilter } = await import("three");
        if (cancelled) return;
        const context = canvas.getContext("webgl2", {
          alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power",
        });
        if (!context) { setFallback(true); return; }
        renderer = new Renderer({ canvas, context, alpha: true, antialias: false, depth: false, stencil: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        renderer.setClearColor(0x000000, 0);

        const tailLength = Math.min(134, Math.max(88, window.innerWidth * 0.1));
        const sprite = document.createElement("canvas");
        sprite.width = Math.ceil(tailLength + 48);
        sprite.height = SPRITE_HEIGHT;
        const ink = sprite.getContext("2d");
        if (!ink) throw new Error("Comet texture unavailable");
        const trail = ink.createLinearGradient(HEAD_X, 0, HEAD_X + tailLength, 0);
        trail.addColorStop(0, "rgba(255,246,213,0.92)");
        trail.addColorStop(0.45, "rgba(221,182,103,0.35)");
        trail.addColorStop(1, "rgba(221,182,103,0)");
        ink.fillStyle = trail;
        ink.shadowColor = "rgba(227,190,113,0.38)";
        ink.shadowBlur = 12;
        ink.fillRect(HEAD_X, SPRITE_HEIGHT / 2 - 1.5, tailLength, 3);
        ink.fillStyle = "#fff2d2";
        ink.shadowColor = "rgba(234,199,131,0.7)";
        ink.shadowBlur = 10;
        ink.beginPath();
        ink.arc(HEAD_X, SPRITE_HEIGHT / 2, 3, 0, Math.PI * 2);
        ink.fill();
        texture = new Texture(sprite);
        texture.colorSpace = SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter;
        geometry = new Plane(sprite.width, SPRITE_HEIGHT);
        material = new Material({ map: texture, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
        const meteor = new Mesh(geometry, material);
        meteor.rotation.z = ANGLE;
        const scene = new Scene();
        scene.add(meteor);
        const camera = new OrthographicCamera(0, 1, 1, 0, 0.1, 10);
        camera.position.z = 1;
        let width = 1;
        let height = 1;
        let flightDistance = 1;
        let tailScale = 1;
        let startedAt = 0;
        let playing = false;
        const draw = (now: number) => {
          const progress = Math.min(1, Math.max(0, (now - startedAt) / durationRef.current));
          const eased = progress * progress * (3 - 2 * progress);
          const scale = (0.9 - 0.3 * eased) * tailScale;
          const offset = (sprite.width / 2 - HEAD_X) * scale;
          const headX = PADDING + flightDistance * (1 - eased);
          const headY = PADDING + 138.5 * eased;
          meteor.position.set(headX + offset * Math.cos(ANGLE), height - headY + offset * Math.sin(ANGLE), 0);
          meteor.scale.x = scale;
          material!.opacity = progress < 0.15 ? progress / 0.15 * 0.9
            : progress < 0.8 ? 0.9 - (progress - 0.15) / 0.65 * 0.1 : (1 - progress) / 0.2 * 0.8;
          renderer!.render(scene, camera);
          if (progress >= 1) { playing = false; renderer!.setAnimationLoop(null); }
        };
        const resize = () => {
          const bounds = host.getBoundingClientRect();
          width = Math.max(1, Math.round(bounds.width));
          height = Math.max(1, Math.round(bounds.height));
          flightDistance = window.innerWidth / 2 - 20;
          tailScale = Math.min(134, Math.max(88, window.innerWidth * 0.1)) / tailLength;
          renderer!.setSize(width, height, false);
          camera.right = width;
          camera.top = height;
          camera.updateProjectionMatrix();
          if (playing) draw(performance.now());
        };
        resize();
        // Compile/upload before the comet is shown, so its first frame is ready.
        renderer.render(scene, camera);
        canvas.dataset.renderer = "three";
        const animation: Animation = {
          play: () => {
            startedAt = performance.now();
            playing = true;
            if (!document.hidden) renderer!.setAnimationLoop(draw);
          },
          stop: () => { playing = false; renderer!.setAnimationLoop(null); },
        };
        animationRef.current = animation;
        observer = new ResizeObserver(resize);
        observer.observe(host);
        visibilityListener = () => {
          renderer!.setAnimationLoop(null);
          if (!document.hidden && playing) renderer!.setAnimationLoop(draw);
        };
        document.addEventListener("visibilitychange", visibilityListener);
        canvas.addEventListener("webglcontextlost", () => {
          if (!cancelled) { animation.stop(); setFallback(true); }
        }, { once: true });
        if (activeRef.current) animation.play();
      } catch {
        dispose();
        if (!cancelled) setFallback(true);
      }
    };
    void prepare();
    return () => {
      cancelled = true;
      animationRef.current = null;
      dispose();
    };
  }, []);

  useEffect(() => {
    if (active) animationRef.current?.play();
    else animationRef.current?.stop();
  }, [active]);

  return <>
    <div ref={hostRef} className="dpc-startup__meteor-layer" data-active={active && !fallback} aria-hidden="true">
      <canvas ref={canvasRef} className={active && !fallback ? "dpc-startup__meteor" : undefined} />
    </div>
    {active && fallback && <span className="dpc-startup__meteor dpc-startup__meteor--fallback" style={{ animationDuration: `${duration}ms` }} />}
  </>;
}
