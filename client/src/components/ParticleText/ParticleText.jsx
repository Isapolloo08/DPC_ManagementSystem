'use client';

import { useEffect, useRef, useState } from 'react';
const hexToRgb = hex => {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
};

const mixRgb = (from, to, amount) => ({
  r: Math.round(from.r + (to.r - from.r) * amount),
  g: Math.round(from.g + (to.g - from.g) * amount),
  b: Math.round(from.b + (to.b - from.b) * amount)
});

const rgbToCss = rgb => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const fraction = value => value - Math.floor(value);
const scatteredPosition = value => fraction(Math.sin(value) * 43758.5453);

const resolveFontSize = (value, container, fontWeight, fontFamily) => {
  if (typeof value === 'number') return value;

  const probe = document.createElement('span');
  probe.textContent = 'M';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.fontSize = value;
  probe.style.fontWeight = String(fontWeight);
  probe.style.fontFamily = fontFamily;
  container.appendChild(probe);
  const size = parseFloat(window.getComputedStyle(probe).fontSize) || 96;
  probe.remove();
  return size;
};

const waitForFonts = async font => {
  if (!('fonts' in document)) return;

  try {
    await document.fonts.load(font);
  } catch {}

  await document.fonts.ready;
};

// One GPU batch for the existing particle sprites. The 2D renderer remains
// available on machines where Chromium cannot create a WebGL context.
const createGpuRenderer = canvas => {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  gl.shaderSource(vertex, `
    attribute vec3 a_position;
    attribute vec2 a_sprite;
    uniform vec2 u_resolution;
    uniform float u_size;
    varying vec2 v_sprite;
    varying float v_alpha;
    void main() {
      gl_Position = vec4(a_position.x / u_resolution.x * 2.0 - 1.0, 1.0 - a_position.y / u_resolution.y * 2.0, 0.0, 1.0);
      gl_PointSize = u_size;
      v_sprite = a_sprite;
      v_alpha = a_position.z;
    }
  `);
  gl.shaderSource(fragment, `
    precision mediump float;
    uniform sampler2D u_atlas;
    uniform vec2 u_cell;
    varying vec2 v_sprite;
    varying float v_alpha;
    void main() {
      gl_FragColor = texture2D(u_atlas, v_sprite + gl_PointCoord * u_cell) * v_alpha;
    }
  `);
  gl.compileShader(vertex);
  gl.compileShader(fragment);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  const positions = gl.createBuffer();
  const sprites = gl.createBuffer();
  const texture = gl.createTexture();
  if (!positions || !sprites || !texture) {
    if (positions) gl.deleteBuffer(positions);
    if (sprites) gl.deleteBuffer(sprites);
    if (texture) gl.deleteTexture(texture);
    gl.deleteProgram(program);
    return null;
  }
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const spriteLocation = gl.getAttribLocation(program, 'a_sprite');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const sizeLocation = gl.getUniformLocation(program, 'u_size');
  const cellLocation = gl.getUniformLocation(program, 'u_cell');
  let frameData = new Float32Array(0);
  let count = 0;
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  return {
    prepare(atlas, cell, particles, width, height) {
      count = particles.length;
      frameData = new Float32Array(count * 3);
      const coordinates = new Float32Array(count * 2);
      particles.forEach((particle, index) => {
        coordinates[index * 2] = particle.sprite.x / atlas.width;
        coordinates[index * 2 + 1] = particle.sprite.y / atlas.height;
      });
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform1f(sizeLocation, cell);
      gl.uniform2f(cellLocation, cell / atlas.width, cell / atlas.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.bindBuffer(gl.ARRAY_BUFFER, sprites);
      gl.bufferData(gl.ARRAY_BUFFER, coordinates, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(spriteLocation);
      gl.vertexAttribPointer(spriteLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, positions);
      gl.bufferData(gl.ARRAY_BUFFER, frameData.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    },
    particle(index, particle, alpha) {
      frameData[index * 3] = particle.x;
      frameData[index * 3 + 1] = particle.y;
      frameData[index * 3 + 2] = alpha;
    },
    draw() {
      if (gl.isContextLost()) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, frameData);
      gl.drawArrays(gl.POINTS, 0, count);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(positions);
      gl.deleteBuffer(sprites);
      gl.deleteProgram(program);
    }
  };
};

const ParticleText = ({
  text = 'React Bits',
  particleSize = 2,
  density = 4,
  color = '#ffffff',
  highlightColor = '#8b5cf6',
  scatter = 180,
  initialSpread = 'text',
  gatherDelay = 0,
  fieldDrift = 0,
  ambientStars = 0,
  starVariation = false,
  pauseAfterGather = false,
  gatherDuration = 1600,
  stagger = 420,
  pointerRepel = 40,
  repelRadius = 120,
  idleDrift = 0.7,
  trigger = 'mount',
  fontSize = 'clamp(3rem, 12vw, 8rem)',
  fontWeight = 800,
  fontFamily = 'inherit',
  glow = true,
  className = '',
  style
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [gpuEnabled, setGpuEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    let gpu = gpuEnabled ? createGpuRenderer(canvas) : null;
    const ctx = gpu ? null : canvas.getContext('2d');
    if (!ctx && !gpu) {
      // A failed shader has already claimed the canvas as WebGL. Recreate the
      // element before asking for a 2D context; a context type cannot be changed.
      if (gpuEnabled) setGpuEnabled(false);
      return undefined;
    }

    let particles = [];
    let animationFrame = null;
    let resizeFrame = null;
    let gatherTimer = null;
    let buildId = 0;
    let gathering = false;
    let waitingToGather = false;
    let fieldStart = 0;
    let gatherStart = 0;
    let gatherCompletedAt = 0;
    let pointerMoveAt = 0;
    let pointerLeaveAt = 0;
    let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let spriteAtlas = null;
    let spriteCell = 0;
    let lastFrameAt = 0;

    const pointer = {
      active: false,
      x: 0,
      y: 0,
      smoothX: 0,
      smoothY: 0
    };

    const startGather = (fromScatter = true) => {
      if (!particles.length) return;

      const now = performance.now();
      const spread = reducedMotion ? 0 : scatter;

      particles.forEach(particle => {
        if (particle.ambient) return;
        if (fromScatter) {
          const angle = particle.seed * Math.PI * 2;
          const distance = spread * (0.35 + particle.depth * 0.75);
          particle.x = particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * spread * 0.55;
          particle.y = particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * spread * 0.55;
        }

        particle.startX = particle.x;
        particle.startY = particle.y;
        particle.delay = reducedMotion ? 0 : particle.seed * stagger;
      });

      gatherStart = now;
      gatherCompletedAt = 0;
      gathering = true;
    };

    // Rasterize each distinct dot and its original glow once. Reusing these
    // sprites avoids thousands of shadow filters and paths on every frame.
    const prepareSprites = () => {
      const sprites = new Map();
      particles.forEach(particle => {
        const key = particle.color + ':' + particle.size;
        if (!sprites.has(key)) sprites.set(key, { size: particle.size, color: particle.color });
        particle.sprite = sprites.get(key);
      });
      const blur = glow && !reducedMotion ? particleSize * 3 : 0;
      const maxSize = Math.max(particleSize * 1.2, 2.1);
      // Canvas shadows use backing pixels; their blur does not scale with the
      // transform. Keep only enough transparent padding for the same glow.
      spriteCell = Math.ceil(maxSize * dpr + blur * 4 + 4);
      const columns = Math.min(sprites.size, Math.max(1, Math.floor(2048 / spriteCell)));
      const atlas = document.createElement('canvas');
      atlas.width = columns * spriteCell;
      atlas.height = Math.ceil(sprites.size / columns) * spriteCell;
      const atlasCtx = atlas.getContext('2d');
      if (!atlasCtx) {
        spriteAtlas = null;
        return;
      }
      atlasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      atlasCtx.shadowBlur = blur;
      atlasCtx.shadowColor = highlightColor;
      let index = 0;
      sprites.forEach(sprite => {
        sprite.x = (index % columns) * spriteCell;
        sprite.y = Math.floor(index / columns) * spriteCell;
        const centerX = (sprite.x + spriteCell / 2) / dpr;
        const centerY = (sprite.y + spriteCell / 2) / dpr;
        atlasCtx.fillStyle = sprite.color;
        if (sprite.size <= 2.1) {
          atlasCtx.fillRect(centerX - sprite.size / 2, centerY - sprite.size / 2, sprite.size, sprite.size);
        } else {
          atlasCtx.beginPath();
          atlasCtx.arc(centerX, centerY, sprite.size / 2, 0, Math.PI * 2);
          atlasCtx.fill();
        }
        index += 1;
      });
      spriteAtlas = atlas;
      gpu?.prepare(atlas, spriteCell, particles, width, height);
    };

    const drawParticle = particle => {
      if (spriteAtlas) {
        const size = spriteCell / dpr;
        ctx.drawImage(spriteAtlas, particle.sprite.x, particle.sprite.y, spriteCell, spriteCell,
          particle.x - size / 2, particle.y - size / 2, size, size);
        return;
      }
      // Preserve the original renderer if a sprite context is unavailable.
      const size = particle.size;
      ctx.fillStyle = particle.color;

      if (size <= 2.1) {
        ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
        return;
      }

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = now => {
      ctx?.clearRect(0, 0, width, height);

      if (ctx && !spriteAtlas && glow && !reducedMotion) {
        ctx.shadowBlur = particleSize * 3;
        ctx.shadowColor = highlightColor;
      } else if (ctx) {
        ctx.shadowBlur = 0;
      }

      // Follow elapsed time, so skipped frames do not stretch the gathering
      // sequence on slower machines. At 60 Hz these match the original values.
      const frameScale = lastFrameAt ? Math.min(6, (now - lastFrameAt) / (1000 / 60)) : 1;
      lastFrameAt = now;
      const pointerFollow = 1 - Math.pow(0.82, frameScale);
      const follow = reducedMotion ? 1 : 1 - Math.pow(0.78, frameScale);
      pointer.smoothX += (pointer.x - pointer.smoothX) * pointerFollow;
      pointer.smoothY += (pointer.y - pointer.smoothY) * pointerFollow;

      let complete = true;

      particles.forEach((particle, index) => {
        let baseX = particle.ambient ? particle.startX : particle.targetX;
        let baseY = particle.ambient ? particle.startY : particle.targetY;
        let progress = 1;

        if (waitingToGather || particle.ambient) {
          if (fieldDrift > 0 && !reducedMotion) {
            const elapsed = particle.ambient && !waitingToGather ? gatherStart - fieldStart : now - fieldStart;
            const seconds = Math.max(0, elapsed) / 1000;
            baseX = particle.startX + particle.velocityX * seconds;
            baseY = particle.startY + particle.velocityY * seconds;
          } else {
            const driftTime = now * 0.001;
            baseX = particle.startX + Math.sin(driftTime * 0.9 + particle.seed * 10) * idleDrift * particle.depth;
            baseY = particle.startY + Math.cos(driftTime * 0.75 + particle.depth * 10) * idleDrift * particle.depth;
          }
        } else if (gathering) {
          const local = (now - gatherStart - particle.delay) / Math.max(1, reducedMotion ? 1 : gatherDuration);
          progress = clamp(local, 0, 1);
          const eased = easeOutCubic(progress);
          baseX = particle.startX + (particle.targetX - particle.startX) * eased;
          baseY = particle.startY + (particle.targetY - particle.startY) * eased;
          if (progress < 1) complete = false;
        } else if (!reducedMotion && idleDrift > 0) {
          const driftTime = now * 0.001;
          baseX += Math.sin(driftTime * 0.9 + particle.seed * 10) * idleDrift * particle.depth;
          baseY += Math.cos(driftTime * 0.75 + particle.depth * 10) * idleDrift * particle.depth;
        }

        if (pointer.active && !reducedMotion && pointerRepel > 0 && repelRadius > 0) {
          const dx = baseX - pointer.smoothX;
          const dy = baseY - pointer.smoothY;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > 0 && distanceSquared < repelRadius * repelRadius) {
            const distance = Math.sqrt(distanceSquared);
            const force = Math.pow(1 - distance / repelRadius, 2) * pointerRepel;
            baseX += (dx / distance) * force;
            baseY += (dy / distance) * force;
          }
        }

        particle.x += (baseX - particle.x) * follow;
        particle.y += (baseY - particle.y) * follow;

        const brightness = waitingToGather
          ? particle.skyBrightness
          : gathering
            ? particle.skyBrightness + (particle.brightness - particle.skyBrightness) * progress
            : particle.brightness;
        const alpha = particle.ambient
          ? particle.brightness
          : clamp(0.35 + progress * 0.65, 0, 1) * brightness;
        if (gpu) gpu.particle(index, particle, alpha);
        else {
          ctx.globalAlpha = alpha;
          drawParticle(particle);
        }
      });

      if (gpu) gpu.draw();
      else {
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      if (gathering && complete) {
        gathering = false;
        gatherCompletedAt = now;
      }

      if (!pauseAfterGather || gathering || waitingToGather || (gatherCompletedAt > 0 && now - gatherCompletedAt < 250) || (pointer.active && now - pointerMoveAt < 350) || (pointerLeaveAt > 0 && now - pointerLeaveAt < 400)) {
        animationFrame = window.requestAnimationFrame(render);
      } else {
        animationFrame = null;
      }
    };

    const ensureRenderLoop = () => {
      if (animationFrame === null && !document.hidden) {
        lastFrameAt = 0;
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const sampleText = async () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      lastFrameAt = 0;
      if (gatherTimer !== null) window.clearTimeout(gatherTimer);
      gatherTimer = null;
      const currentBuild = ++buildId;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);

      if (width <= 0 || height <= 0) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

      const computed = window.getComputedStyle(container);
      const resolvedFamily = fontFamily === 'inherit' ? computed.fontFamily || 'sans-serif' : fontFamily;
      let resolvedSize = resolveFontSize(fontSize, container, fontWeight, resolvedFamily);
      let font = `${fontWeight} ${resolvedSize}px ${resolvedFamily}`;

      await waitForFonts(font);
      if (currentBuild !== buildId) return;

      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      const content = String(text || ' ');
      const maxTextWidth = width * 0.92;
      offCtx.font = font;
      let metrics = offCtx.measureText(content);
      const measuredWidth = Math.max(1, metrics.width);
      if (measuredWidth > maxTextWidth) {
        resolvedSize = Math.max(18, resolvedSize * (maxTextWidth / measuredWidth));
        font = `${fontWeight} ${resolvedSize}px ${resolvedFamily}`;
        await waitForFonts(font);
        if (currentBuild !== buildId) return;
        offCtx.font = font;
        metrics = offCtx.measureText(content);
      }

      const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
      const padding = Math.max(12, Math.ceil(resolvedSize * 0.08));
      const textWidth = Math.max(1, left + right);
      const textHeight = Math.max(1, ascent + descent);

      offscreen.width = textWidth + padding * 2;
      offscreen.height = textHeight + padding * 2;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offCtx.font = font;
      offCtx.textAlign = 'left';
      offCtx.textBaseline = 'alphabetic';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillText(content, padding - left, padding + ascent);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const targets = [];
      const step = Math.max(2, Math.floor(density));

      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
          if (alpha > 40) {
            targets.push({
              x: width / 2 - offscreen.width / 2 + x,
              y: height / 2 - offscreen.height / 2 + y,
              alpha: alpha / 255
            });
          }
        }
      }

      const maxParticles = Math.max(900, Math.min(5200, Math.floor((width * height) / 90)));
      const stride = Math.max(1, Math.ceil(targets.length / maxParticles));
      const baseRgb = hexToRgb(color);
      const highlightRgb = hexToRgb(highlightColor);
      const selected = targets.filter((_, index) => index % stride === 0);

      particles = selected.map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const blend = baseRgb && highlightRgb ? clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
        const particleColor = baseRgb && highlightRgb ? rgbToCss(mixRgb(baseRgb, highlightRgb, blend)) : color;
        const angle = seed * Math.PI * 2;
        const distance = (reducedMotion ? 0 : scatter) * (0.35 + depth * 0.75);
        const viewportMarginX = Math.min(24, width * 0.05);
        const viewportMarginY = Math.min(24, height * 0.05);
        const startX = initialSpread === 'viewport' && !reducedMotion
          ? viewportMarginX + scatteredPosition((index + 1) * 127.1) * (width - viewportMarginX * 2)
          : target.x + Math.cos(angle) * distance + (seed - 0.5) * scatter * 0.45;
        const startY = initialSpread === 'viewport' && !reducedMotion
          ? viewportMarginY + scatteredPosition((index + 1) * 311.7) * (height - viewportMarginY * 2)
          : target.y + Math.sin(angle) * distance + (depth - 0.9) * scatter * 0.45;

        return {
          x: reducedMotion ? target.x : startX,
          y: reducedMotion ? target.y : startY,
          startX,
          startY,
          targetX: target.x,
          targetY: target.y,
          size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)),
          color: particleColor,
          brightness: starVariation ? 0.78 + scatteredPosition((index + 1) * 47.3) * 0.22 : 1,
          skyBrightness: starVariation
            ? (scatteredPosition((index + 1) * 91.3) > 0.93 ? 0.88 : 0.38 + seed * 0.38)
            : 1,
          seed,
          depth,
          delay: seed * stagger
        };
      });

      // A small, separate layer remains in the sky as the people-shaped
      // particles gather into the church name. It never takes dots from text.
      if (ambientStars > 0) {
        const count = Math.min(1200, Math.max(0, Math.floor(ambientStars)));
        for (let index = 0; index < count; index += 1) {
          const seed = scatteredPosition((index + 1) * 83.7);
          const startX = width * scatteredPosition((index + 1) * 127.1);
          const startY = height * scatteredPosition((index + 1) * 311.7);
          const nearTitle = Math.abs(startX - width / 2) < textWidth * 0.57
            && Math.abs(startY - height / 2) < Math.max(52, textHeight * 1.7);
          const bright = scatteredPosition((index + 1) * 61.9) > 0.95;
          const brightness = (bright ? 0.72 + seed * 0.2 : 0.18 + seed * 0.37)
            * (nearTitle ? 0.4 : 1);
          particles.push({
            x: startX,
            y: startY,
            startX,
            startY,
            targetX: startX,
            targetY: startY,
            size: Math.max(0.65, particleSize * (bright ? 1.05 : 0.75)),
            color: baseRgb && highlightRgb ? rgbToCss(mixRgb(baseRgb, highlightRgb, seed)) : color,
            brightness,
            skyBrightness: brightness,
            seed,
            depth: 0.45 + seed * 0.9,
            delay: 0,
            ambient: true
          });
        }
      }

      particles.forEach(particle => {
        const direction = particle.seed * Math.PI * 2;
        const speed = fieldDrift * (0.6 + particle.depth * 0.4);
        particle.velocityX = Math.cos(direction) * speed;
        particle.velocityY = Math.sin(direction) * speed;
      });
      prepareSprites();

      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.smoothX = pointer.x;
      pointer.smoothY = pointer.y;

      if (reducedMotion) {
        particles.forEach(particle => {
          if (particle.ambient) return;
          particle.x = particle.targetX;
          particle.y = particle.targetY;
          particle.startX = particle.targetX;
          particle.startY = particle.targetY;
          particle.delay = 0;
        });
        gathering = false;
      } else {
        waitingToGather = trigger === 'mount' && gatherDelay > 0;
        if (waitingToGather) {
          fieldStart = performance.now();
          gatherTimer = window.setTimeout(() => {
            waitingToGather = false;
            startGather(false);
            gatherTimer = null;
          }, gatherDelay);
        } else {
          startGather(false);
        }
      }

      ensureRenderLoop();
    };

    const queueSample = () => {
      const rect = container.getBoundingClientRect();
      if (Math.floor(rect.width) === width && Math.floor(rect.height) === height
        && Math.min(window.devicePixelRatio || 1, 2) === dpr) return;
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(sampleText);
    };

    const handlePointerMove = event => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      pointerMoveAt = performance.now();
      pointerLeaveAt = 0;
      ensureRenderLoop();
    };

    const handlePointerLeave = () => {
      pointer.active = false;
      pointerLeaveAt = performance.now();
      ensureRenderLoop();
    };

    const handlePointerEnter = event => {
      handlePointerMove(event);
      pointer.smoothX = pointer.x;
      pointer.smoothY = pointer.y;
      if (trigger === 'hover') {
        startGather(true);
        ensureRenderLoop();
      }
    };

    const handleClick = () => {
      if (trigger === 'click') {
        startGather(true);
        ensureRenderLoop();
      }
    };

    const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleReduceMotionChange = event => {
      reducedMotion = event.matches;
      sampleText();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      } else {
        ensureRenderLoop();
      }
    };

    const handleContextLost = event => {
      event.preventDefault();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };
    const handleContextRestored = () => {
      gpu?.dispose();
      gpu = createGpuRenderer(canvas);
      if (gpu && spriteAtlas) {
        gpu.prepare(spriteAtlas, spriteCell, particles, width, height);
        ensureRenderLoop();
      } else if (!gpu) setGpuEnabled(false);
    };

    reduceMotionQuery?.addEventListener('change', handleReduceMotionChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    canvas.addEventListener('pointerenter', handlePointerEnter);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('click', handleClick);

    const resizeObserver = new ResizeObserver(queueSample);
    resizeObserver.observe(container);
    sampleText();

    return () => {
      buildId += 1;
      resizeObserver.disconnect();
      reduceMotionQuery?.removeEventListener('change', handleReduceMotionChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      canvas.removeEventListener('pointerenter', handlePointerEnter);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);

      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      if (gatherTimer !== null) window.clearTimeout(gatherTimer);
      spriteAtlas = null;
      gpu?.dispose();
    };
  }, [
    text,
    particleSize,
    density,
    color,
    highlightColor,
    scatter,
    initialSpread,
    gatherDelay,
    fieldDrift,
    ambientStars,
    starVariation,
    pauseAfterGather,
    gatherDuration,
    stagger,
    pointerRepel,
    repelRadius,
    idleDrift,
    trigger,
    fontSize,
    fontWeight,
    fontFamily,
    glow,
    gpuEnabled
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative block h-full min-h-[240px] w-full overflow-hidden touch-none ${className}`}
      style={style}
      aria-label={text}
    >
      <canvas key={gpuEnabled ? 'gpu' : 'cpu'} ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </div>
  );
};

export default ParticleText;
