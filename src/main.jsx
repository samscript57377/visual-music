import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, ChevronUp, Cuboid, FileAudio, Pause, Play, Sparkles, Upload } from "lucide-react";
import * as THREE from "three";
import "./styles.css";

const themes = {
  io: {
    label: "IO Pop",
    colors: ["#4285f4", "#34a853", "#fbbc05", "#ea4335", "#ffffff"],
    background: ["#101828", "#1d2338", "#090b12"],
    accent: "#fbbc05",
    cartoon: ["spark", "ring", "blob", "pill"]
  },
  candy: {
    label: "Candy Toon",
    colors: ["#ff4f9a", "#45f0df", "#ffde59", "#7057ff", "#ffffff"],
    background: ["#241130", "#3f1747", "#111827"],
    accent: "#45f0df",
    cartoon: ["bubble", "star", "blob", "wink"]
  },
  cyber: {
    label: "Cyber Bloom",
    colors: ["#00f5ff", "#b5ff00", "#ff2bd6", "#6c5ce7", "#f8fafc"],
    background: ["#06111f", "#111827", "#020617"],
    accent: "#00f5ff",
    cartoon: ["bolt", "ring", "cube", "comet"]
  },
  lava: {
    label: "Lava Arcade",
    colors: ["#ff3d00", "#ffba08", "#2ec4b6", "#7b2cbf", "#fff8e8"],
    background: ["#1a0b13", "#311018", "#08070a"],
    accent: "#ffba08",
    cartoon: ["flame", "blob", "spark", "pill"]
  },
  ocean: {
    label: "Ocean Glass",
    colors: ["#00b4d8", "#90e0ef", "#48cae4", "#ffd166", "#f8fafc"],
    background: ["#031926", "#053b50", "#071923"],
    accent: "#90e0ef",
    cartoon: ["bubble", "ring", "comet", "blob"]
  },
  garden: {
    label: "Garden Pop",
    colors: ["#52b788", "#d9ed92", "#ffafcc", "#4361ee", "#ffffff"],
    background: ["#071a12", "#16351f", "#0b1020"],
    accent: "#d9ed92",
    cartoon: ["star", "blob", "spark", "pill"]
  },
  mono: {
    label: "Mono Club",
    colors: ["#f8fafc", "#94a3b8", "#111827", "#ef4444", "#22d3ee"],
    background: ["#030712", "#18181b", "#020617"],
    accent: "#ef4444",
    cartoon: ["cube", "ring", "bolt", "pill"]
  },
  sunset: {
    label: "Sunset Jam",
    colors: ["#ff006e", "#fb5607", "#ffbe0b", "#3a86ff", "#f8fafc"],
    background: ["#22092c", "#421b36", "#10051d"],
    accent: "#ffbe0b",
    cartoon: ["flame", "star", "comet", "blob"]
  }
};

// ─── Audio engine ────────────────────────────────────────────────────────────

function useAudioEngine() {
  const metricsRef = useRef({
    level: 0, beat: 0, bass: 0, mids: 0, highs: 0, progress: 0, active: 0,
    frequencyData: new Uint8Array(64)
  });
  const [state, setState] = useState({
    ready: false, playing: false, name: "",
    level: 0, beat: 0, bass: 0, mids: 0, highs: 0, progress: 0,
    frequencyData: new Uint8Array(64)
  });
  const refs = useRef({
    audio: null, context: null, source: null, analyser: null,
    data: null, objectUrl: "", raf: 0, prevSpectrum: null,
    fluxMean: 0, fluxVar: 0.002, lastBeatAt: 0, lastFrameAt: 0, lastUiAt: 0
  });

  const loadFile = async (file) => {
    if (!file) return;
    const audio = refs.current.audio ?? new Audio();
    if (refs.current.objectUrl) URL.revokeObjectURL(refs.current.objectUrl);
    refs.current.objectUrl = URL.createObjectURL(file);
    audio.pause();
    audio.src = refs.current.objectUrl;
    audio.currentTime = 0;
    audio.crossOrigin = "anonymous";
    audio.loop = false;
    audio.preload = "auto";
    refs.current.audio = audio;

    if (!refs.current.context) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      refs.current.context = context;
      refs.current.analyser = analyser;
      refs.current.source = source;
      refs.current.data = new Uint8Array(analyser.frequencyBinCount);
    }

    audio.onended = () => setState((c) => ({ ...c, playing: false, progress: 0 }));
    refs.current.prevSpectrum = null;
    refs.current.fluxMean = 0;
    refs.current.fluxVar = 0.002;
    refs.current.lastBeatAt = 0;
    metricsRef.current = {
      level: 0, beat: 0, bass: 0, mids: 0, highs: 0, progress: 0, active: 0,
      frequencyData: new Uint8Array(64)
    };
    setState((c) => ({ ...c, ready: true, playing: false, name: file.name, progress: 0 }));
  };

  const toggle = async () => {
    const { audio, context } = refs.current;
    if (!audio) return;
    if (context?.state === "suspended") await context.resume();
    if (audio.paused) {
      await audio.play();
      metricsRef.current = { ...metricsRef.current, active: 1 };
      setState((c) => ({ ...c, playing: true }));
    } else {
      audio.pause();
      metricsRef.current = { ...metricsRef.current, active: 0, beat: 0 };
      setState((c) => ({ ...c, playing: false }));
    }
  };

  useEffect(() => {
    const tick = () => {
      const { analyser, data, audio, context } = refs.current;
      if (analyser && data && audio) {
        analyser.getByteFrequencyData(data);
        const now = performance.now();
        const delta = Math.max(16, now - (refs.current.lastFrameAt || now));
        refs.current.lastFrameAt = now;

        const sr = context.sampleRate;
        const bands = splitBands(data, sr);
        const { level, bass, mids, highs } = bands;
        const flux = spectralFlux(data, refs.current.prevSpectrum, sr);
        refs.current.prevSpectrum = new Uint8Array(data);

        const diff = flux - refs.current.fluxMean;
        refs.current.fluxMean += diff * 0.045;
        refs.current.fluxVar += (diff * diff - refs.current.fluxVar) * 0.045;
        const threshold = refs.current.fluxMean + Math.max(0.012, Math.sqrt(refs.current.fluxVar) * 1.25);
        const enoughEnergy = bass > 0.16 || (bass + mids) * 0.5 > 0.2;
        const spaced = now - refs.current.lastBeatAt > 210;
        const isBeat = flux > threshold && enoughEnergy && spaced && !audio.paused;
        if (isBeat) refs.current.lastBeatAt = now;

        const decay = Math.pow(0.1, delta / 400);
        const beat = isBeat ? 1 : Math.max(0, metricsRef.current.beat * decay);
        const progress = audio.duration ? audio.currentTime / audio.duration : 0;
        const active = audio.paused ? 0 : 1;

        // Downsample frequency data to 64 bars for waveform display
        const barCount = 64;
        const freqData = new Uint8Array(barCount);
        for (let i = 0; i < barCount; i++) {
          const start = Math.floor((i / barCount) * (data.length * 0.5));
          const end = Math.floor(((i + 1) / barCount) * (data.length * 0.5));
          let sum = 0;
          for (let j = start; j < end; j++) sum += data[j];
          freqData[i] = sum / Math.max(1, end - start);
        }

        metricsRef.current = { level, bass, mids, highs, beat, progress, active, frequencyData: freqData };

        if (now - refs.current.lastUiAt > 80 || isBeat) {
          refs.current.lastUiAt = now;
          setState((c) => ({ ...c, level, bass, mids, highs, beat, progress, frequencyData: freqData }));
        }
      }
      refs.current.raf = requestAnimationFrame(tick);
    };
    refs.current.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(refs.current.raf);
      if (refs.current.objectUrl) URL.revokeObjectURL(refs.current.objectUrl);
    };
  }, []);

  return { audioState: state, metricsRef, loadFile, toggle };
}

function splitBands(data, sampleRate) {
  return {
    bass: bandAverage(data, sampleRate, 35, 160),
    mids: bandAverage(data, sampleRate, 220, 2100),
    highs: bandAverage(data, sampleRate, 2400, 9000),
    level: bandAverage(data, sampleRate, 35, 9000)
  };
}

function bandAverage(data, sampleRate, minHz, maxHz) {
  const nyquist = sampleRate / 2;
  const start = Math.max(0, Math.floor((minHz / nyquist) * data.length));
  const end = Math.min(data.length - 1, Math.ceil((maxHz / nyquist) * data.length));
  let total = 0, count = 0;
  for (let i = start; i <= end; i++) { total += data[i]; count++; }
  return count ? total / count / 255 : 0;
}

function spectralFlux(data, previous, sampleRate) {
  if (!previous) return 0;
  const nyquist = sampleRate / 2;
  const start = Math.max(0, Math.floor((35 / nyquist) * data.length));
  const end = Math.min(data.length - 1, Math.ceil((1850 / nyquist) * data.length));
  let flux = 0, count = 0;
  for (let i = start; i <= end; i++) {
    const rise = data[i] - previous[i];
    if (rise > 0) flux += rise;
    count++;
  }
  return count ? flux / count / 255 : 0;
}

// ─── 3D stage (enhanced) ─────────────────────────────────────────────────────

function VisualStage({ theme, metricsRef }) {
  const mountRef = useRef(null);
  const engineRef = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(56, mount.clientWidth / mount.clientHeight, 0.1, 120);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    camera.position.set(0, 0, 10);

    const group = new THREE.Group();
    scene.add(group);

    // Richer lighting setup
    const keyLight = new THREE.PointLight(0xffffff, 180);
    keyLight.position.set(3, 5, 8);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x8080ff, 60);
    fillLight.position.set(-5, -3, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xff8040, 40);
    rimLight.position.set(0, -6, -3);
    scene.add(rimLight);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const geometries = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.TorusKnotGeometry(0.72, 0.22, 52, 10),
      new THREE.BoxGeometry(1.3, 1.3, 1.3),
      new THREE.ConeGeometry(0.8, 1.5, 5),
      new THREE.TorusGeometry(0.78, 0.18, 10, 32),
      new THREE.OctahedronGeometry(0.9, 0),
      new THREE.TetrahedronGeometry(0.95, 0)
    ];

    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    const objectCount = isMobile ? 20 : 28;

    const objects = Array.from({ length: objectCount }, (_, i) => {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.colors[i % theme.colors.length]),
        roughness: 0.3,
        metalness: 0.28,
        emissive: new THREE.Color(theme.colors[(i + 2) % theme.colors.length]),
        emissiveIntensity: 0.08
      });
      const mesh = new THREE.Mesh(geometries[i % geometries.length], material);
      const lane = i % 5;
      mesh.position.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 9,
        -lane * 1.4
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const size = 0.3 + Math.random() * 0.95;
      mesh.scale.setScalar(size);
      group.add(mesh);
      return {
        mesh, base: size,
        speed: 0.4 + Math.random() * 1.3,
        drift: Math.random() * 6.28,
        driftY: Math.random() * 6.28,
        lane,
        homeX: mesh.position.x,
        homeY: mesh.position.y,
        homeZ: mesh.position.z
      };
    });

    // Particle system
    const particleCount = isMobile ? 400 : 700;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3]     = (Math.random() - 0.5) * 28;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: new THREE.Color(theme.colors[0]),
      size: 0.04,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    engineRef.current = {
      renderer, scene, camera, group, objects,
      keyLight, fillLight, rimLight,
      particles, pPositions, particleCount,
      clock: new THREE.Clock()
    };

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      mount.removeChild(renderer.domElement);
      geometries.forEach((g) => g.dispose());
      objects.forEach(({ mesh }) => mesh.material.dispose());
      pGeo.dispose();
      pMat.dispose();
      renderer.dispose();
    };
  }, []);

  // Re-tint on theme change
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine.objects) return;
    engine.objects.forEach(({ mesh }, i) => {
      mesh.material.color.set(theme.colors[i % theme.colors.length]);
      mesh.material.emissive.set(theme.colors[(i + 2) % theme.colors.length]);
    });
    if (engine.particles) {
      engine.particles.material.color.set(theme.colors[0]);
    }
  }, [theme]);

  useEffect(() => {
    let raf = 0;
    const render = () => {
      const engine = engineRef.current;
      if (engine.renderer) {
        const time = engine.clock.getElapsedTime();
        const v = metricsRef.current;
        const active = v.active;
        const pulse = (v.beat * 0.38 + v.level * 0.28) * active;

        // Camera drift
        engine.camera.position.x = Math.sin(time * 0.17) * (0.1 + v.mids * 0.22 * active);
        engine.camera.position.y = Math.cos(time * 0.14) * (0.07 + v.highs * 0.14 * active);
        engine.camera.position.z = 10.5 - v.beat * 0.14 * active + Math.sin(time * 0.09) * 0.1;
        engine.camera.lookAt(0, 0, 0);

        // Group rotation
        engine.group.rotation.y = time * (0.025 + v.bass * 0.035 * active) + v.mids * 0.09 * active;
        engine.group.rotation.x = Math.sin(time * 0.14) * 0.06 + v.highs * 0.04 * active;

        // Lights
        engine.keyLight.intensity = 110 + v.highs * 100 * active + v.beat * 140 * active;
        engine.fillLight.intensity = 50 + v.bass * 60 * active;
        engine.rimLight.intensity = 30 + v.mids * 50 * active;

        // Objects
        engine.objects.forEach(({ mesh, base, speed, drift, driftY, lane, homeX, homeY, homeZ }, i) => {
          const idle = active ? 1 : 0.25;
          mesh.rotation.x += (0.0016 * speed + v.highs * 0.005 * active) * idle;
          mesh.rotation.y += (0.0020 * speed + v.bass * 0.006 * active) * idle;
          mesh.rotation.z += v.beat * 0.005 * active * (i % 2 ? -1 : 1);

          mesh.position.x = homeX + Math.cos(time * (0.16 + speed * 0.07) + drift) * (0.06 + v.mids * 0.16 * active);
          mesh.position.y = homeY + Math.sin(time * speed * 0.36 + driftY) * (0.08 + v.highs * 0.14 * active) + v.beat * active * (lane - 2) * 0.028;
          mesh.position.z = homeZ + Math.sin(time * 0.22 + drift) * (0.12 + v.bass * 0.24 * active);

          // Beat-triggered emissive flash
          mesh.material.emissiveIntensity = 0.06 + v.beat * 0.45 * active * (i % 3 === 0 ? 1 : 0.5);
          mesh.scale.setScalar(base * (1 + pulse * (i % 3 === 0 ? 0.45 : 0.22)));
        });

        // Particles drift
        if (engine.particles) {
          engine.particles.rotation.y = time * 0.018;
          engine.particles.rotation.x = Math.sin(time * 0.011) * 0.06;
          engine.particles.material.opacity = 0.3 + v.level * 0.5 * active + v.beat * 0.3 * active;
          engine.particles.material.size = 0.04 + v.beat * 0.06 * active;
        }

        engine.renderer.render(engine.scene, engine.camera);
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div className="stage-3d" ref={mountRef} aria-hidden="true" />;
}

// ─── Layers ──────────────────────────────────────────────────────────────────

function PlasmaLayer() {
  return <div className="plasma-layer" aria-hidden="true" />;
}

function CartoonLayer({ theme }) {
  const shapes = useMemo(
    () => Array.from({ length: window.matchMedia("(max-width: 700px)").matches ? 22 : 32 }, (_, i) => ({
      id: i,
      kind: theme.cartoon[i % theme.cartoon.length],
      color: theme.colors[i % theme.colors.length],
      left: `${(i * 17) % 101}%`,
      top: `${(i * 29) % 92}%`,
      size: 16 + ((i * 11) % 58),
      delay: `${-(i * 0.19).toFixed(2)}s`
    })),
    [theme]
  );
  return (
    <div className="cartoon-layer">
      {shapes.map((s) => (
        <i
          className={`toon toon-${s.kind}`}
          key={`${theme.label}-${s.id}`}
          style={{
            "--shape-color": s.color,
            "--size": `${s.size}px`,
            "--left": s.left,
            "--top": s.top,
            "--delay": s.delay
          }}
        />
      ))}
    </div>
  );
}

function MotionLayer({ theme }) {
  const streaks = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      id: i,
      color: theme.colors[i % theme.colors.length],
      top: `${4 + ((i * 11) % 90)}%`,
      width: `${80 + ((i * 23) % 200)}px`,
      delay: `${-(i * 0.21).toFixed(2)}s`,
      speed: `${3.2 + (i % 5) * 0.5}s`
    })),
    [theme]
  );

  return (
    <div className="motion-layer" aria-hidden="true">
      {streaks.map((s) => (
        <i
          className="streak"
          key={`${theme.label}-${s.id}`}
          style={{
            "--streak-color": s.color,
            "--streak-top": s.top,
            "--streak-width": s.width,
            "--streak-delay": s.delay,
            "--streak-speed": s.speed
          }}
        />
      ))}
    </div>
  );
}

function RhythmLayer({ theme }) {
  const tiles = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({
      id: i,
      color: theme.colors[(i + 1) % theme.colors.length],
      left: `${3 + ((i * 13) % 94)}%`,
      top: `${8 + ((i * 19) % 84)}%`,
      delay: `${-(i * 0.11).toFixed(2)}s`
    })),
    [theme]
  );

  return (
    <div className="rhythm-layer" aria-hidden="true">
      {tiles.map((t) => (
        <i
          className="rhythm-tile"
          key={`${theme.label}-${t.id}`}
          style={{
            "--tile-color": t.color,
            "--tile-left": t.left,
            "--tile-top": t.top,
            "--tile-delay": t.delay
          }}
        />
      ))}
    </div>
  );
}

// ─── Waveform bars ────────────────────────────────────────────────────────────

function Waveform({ frequencyData, playing }) {
  const bars = 48;
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const dataIndex = Math.floor((i / bars) * frequencyData.length);
        const raw = frequencyData[dataIndex] ?? 0;
        const height = playing ? Math.max(6, (raw / 255) * 100) : 6;
        return (
          <div
            key={i}
            className="waveform-bar"
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [themeKey, setThemeKey] = useState("io");
  const [panelMinimized, setPanelMinimized] = useState(false);
  const appRef = useRef(null);
  const theme = themes[themeKey];
  const { audioState, metricsRef, loadFile, toggle } = useAudioEngine();

  // Sync CSS vars every frame
  useEffect(() => {
    let raf = 0;
    const syncCssVars = () => {
      const root = appRef.current;
      if (root) {
        const v = metricsRef.current;
        root.style.setProperty("--pulse", v.beat.toFixed(3));
        root.style.setProperty("--beat", v.beat.toFixed(3));
        root.style.setProperty("--energy", v.level.toFixed(3));
        root.style.setProperty("--active", v.active.toFixed(3));
      }
      raf = requestAnimationFrame(syncCssVars);
    };
    raf = requestAnimationFrame(syncCssVars);
    return () => cancelAnimationFrame(raf);
  }, [metricsRef]);

  return (
    <main
      ref={appRef}
      className={audioState.playing ? "app is-playing" : "app is-idle"}
      style={{
        "--bg-a": theme.background[0],
        "--bg-b": theme.background[1],
        "--bg-c": theme.background[2],
        "--accent": theme.accent,
        "--pulse": 0, "--beat": 0, "--energy": 0, "--active": 0
      }}
    >
      <VisualStage theme={theme} metricsRef={metricsRef} />
      <PlasmaLayer />
      <RhythmLayer theme={theme} />
      <CartoonLayer theme={theme} />
      <MotionLayer theme={theme} />
      <div className="gradient-field" aria-hidden="true" />

      <section
        className={panelMinimized ? "control-panel minimized" : "control-panel"}
        aria-label="Music visualizer controls"
      >
        <div className="brand">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <div>
            <h1>Visual Music</h1>
            <p>{audioState.name || "Drop in an MP3 and let the stage wake up."}</p>
          </div>
          <button
            className="panel-toggle"
            type="button"
            onClick={() => setPanelMinimized((v) => !v)}
            aria-label={panelMinimized ? "Restore controls" : "Minimize controls"}
          >
            {panelMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {!panelMinimized && (
          <>
            <div className="controls-row">
              <label className="upload-button">
                <Upload size={18} />
                <span>Upload MP3</span>
                <input
                  type="file"
                  accept=".mp3,audio/mpeg"
                  onChange={(e) => loadFile(e.target.files?.[0])}
                />
              </label>
              <button className="play-button" onClick={toggle} disabled={!audioState.ready}>
                {audioState.playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
            </div>

            <Waveform frequencyData={audioState.frequencyData} playing={audioState.playing} />

            <div className="theme-grid" aria-label="Theme">
              {Object.entries(themes).map(([key, item]) => (
                <button
                  className={key === themeKey ? "theme-chip active" : "theme-chip"}
                  key={key}
                  onClick={() => setThemeKey(key)}
                >
                  <Cuboid size={14} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="meters" aria-label="Audio response">
              <Meter label="Bass" value={audioState.bass} />
              <Meter label="Mids" value={audioState.mids} />
              <Meter label="Highs" value={audioState.highs} />
            </div>
          </>
        )}

        <div className="trackline">
          <FileAudio size={16} />
          <span style={{ width: `${Math.max(2, audioState.progress * 100)}%` }} />
        </div>
      </section>
    </main>
  );
}

function Meter({ label, value }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <b>{Math.round(value * 100)}</b>
      </div>
      <span className="meter-bar">
        <i style={{ width: `${Math.max(3, value * 100)}%` }} />
      </span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);