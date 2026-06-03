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

function useAudioEngine() {
  const metricsRef = useRef({
    level: 0,
    beat: 0,
    bass: 0,
    mids: 0,
    highs: 0,
    progress: 0,
    active: 0
  });
  const [state, setState] = useState({
    ready: false,
    playing: false,
    name: "",
    level: 0,
    beat: 0,
    bass: 0,
    mids: 0,
    highs: 0,
    progress: 0
  });
  const refs = useRef({
    audio: null,
    context: null,
    source: null,
    analyser: null,
    data: null,
    objectUrl: "",
    raf: 0,
    prevSpectrum: null,
    fluxMean: 0,
    fluxVar: 0.002,
    lastBeatAt: 0,
    lastFrameAt: 0,
    lastUiAt: 0
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
      analyser.smoothingTimeConstant = 0.58;
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);
      refs.current.context = context;
      refs.current.analyser = analyser;
      refs.current.source = source;
      refs.current.data = new Uint8Array(analyser.frequencyBinCount);
    }

    audio.onended = () => setState((current) => ({ ...current, playing: false, progress: 0 }));
    refs.current.prevSpectrum = null;
    refs.current.fluxMean = 0;
    refs.current.fluxVar = 0.002;
    refs.current.lastBeatAt = 0;
    metricsRef.current = { level: 0, beat: 0, bass: 0, mids: 0, highs: 0, progress: 0, active: 0 };
    setState((current) => ({
      ...current,
      ready: true,
      playing: false,
      name: file.name,
      progress: 0
    }));
  };

  const toggle = async () => {
    const { audio, context } = refs.current;
    if (!audio) return;
    if (context?.state === "suspended") await context.resume();
    if (audio.paused) {
      await audio.play();
      metricsRef.current = { ...metricsRef.current, active: 1 };
      setState((current) => ({ ...current, playing: true }));
    } else {
      audio.pause();
      metricsRef.current = { ...metricsRef.current, active: 0, beat: 0 };
      setState((current) => ({ ...current, playing: false }));
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
        const bands = splitBands(data, context.sampleRate);
        const level = bands.level;
        const bass = bands.bass;
        const mids = bands.mids;
        const highs = bands.highs;
        const flux = spectralFlux(data, refs.current.prevSpectrum, context.sampleRate);
        refs.current.prevSpectrum = new Uint8Array(data);
        const diff = flux - refs.current.fluxMean;
        refs.current.fluxMean += diff * 0.045;
        refs.current.fluxVar += (diff * diff - refs.current.fluxVar) * 0.045;
        const threshold = refs.current.fluxMean + Math.max(0.012, Math.sqrt(refs.current.fluxVar) * 1.25);
        const enoughEnergy = bass > 0.16 || (bass + mids) * 0.5 > 0.2;
        const spaced = now - refs.current.lastBeatAt > 210;
        const isBeat = flux > threshold && enoughEnergy && spaced && !audio.paused;
        if (isBeat) refs.current.lastBeatAt = now;
        const decay = Math.pow(0.1, delta / 420);
        const beat = isBeat ? 1 : Math.max(0, metricsRef.current.beat * decay);
        const progress = audio.duration ? audio.currentTime / audio.duration : 0;
        const active = audio.paused ? 0 : 1;
        metricsRef.current = { level, bass, mids, highs, beat, progress, active };
        if (now - refs.current.lastUiAt > 120 || isBeat) {
          refs.current.lastUiAt = now;
          setState((current) => ({ ...current, level, bass, mids, highs, beat, progress }));
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
  let total = 0;
  let count = 0;
  for (let index = start; index <= end; index += 1) {
    total += data[index];
    count += 1;
  }
  return count ? total / count / 255 : 0;
}

function spectralFlux(data, previous, sampleRate) {
  if (!previous) return 0;
  const nyquist = sampleRate / 2;
  const start = Math.max(0, Math.floor((35 / nyquist) * data.length));
  const end = Math.min(data.length - 1, Math.ceil((1850 / nyquist) * data.length));
  let flux = 0;
  let count = 0;
  for (let index = start; index <= end; index += 1) {
    const rise = data[index] - previous[index];
    if (rise > 0) flux += rise;
    count += 1;
  }
  return count ? flux / count / 255 : 0;
}

function VisualStage({ theme, metricsRef }) {
  const mountRef = useRef(null);
  const engineRef = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    camera.position.set(0, 0, 10);
    const group = new THREE.Group();
    scene.add(group);

    const light = new THREE.PointLight(0xffffff, 160);
    light.position.set(2, 4, 8);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));

    const geometries = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.TorusKnotGeometry(0.72, 0.22, 48, 10),
      new THREE.BoxGeometry(1.3, 1.3, 1.3),
      new THREE.ConeGeometry(0.8, 1.5, 5),
      new THREE.TorusGeometry(0.78, 0.18, 10, 32)
    ];

    const objectCount = window.matchMedia("(max-width: 700px)").matches ? 22 : 30;
    const objects = Array.from({ length: objectCount }, (_, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.colors[index % theme.colors.length]),
        roughness: 0.36,
        metalness: 0.18,
        emissive: new THREE.Color(theme.colors[(index + 2) % theme.colors.length]),
        emissiveIntensity: 0.05
      });
      const mesh = new THREE.Mesh(geometries[index % geometries.length], material);
      const lane = index % 5;
      mesh.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, -lane * 1.2);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const size = 0.35 + Math.random() * 0.9;
      mesh.scale.setScalar(size);
      group.add(mesh);
      return {
        mesh,
        base: size,
        speed: 0.4 + Math.random() * 1.2,
        drift: Math.random() * 6.28,
        lane,
        homeX: mesh.position.x,
        homeY: mesh.position.y,
        homeZ: mesh.position.z
      };
    });

    engineRef.current = { renderer, scene, camera, group, objects, light, clock: new THREE.Clock() };

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      mount.removeChild(renderer.domElement);
      geometries.forEach((geometry) => geometry.dispose());
      objects.forEach(({ mesh }) => mesh.material.dispose());
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine.objects) return;
    engine.objects.forEach(({ mesh }, index) => {
      mesh.material.color.set(theme.colors[index % theme.colors.length]);
      mesh.material.emissive.set(theme.colors[(index + 2) % theme.colors.length]);
    });
  }, [theme]);

  useEffect(() => {
    let raf = 0;
    const render = () => {
      const engine = engineRef.current;
      if (engine.renderer) {
        const time = engine.clock.getElapsedTime();
        const values = metricsRef.current;
        const active = values.active;
        const pulse = (values.beat * 0.35 + values.level * 0.26) * active;
        engine.camera.position.x = Math.sin(time * 0.18) * (0.12 + values.mids * 0.2 * active);
        engine.camera.position.y = Math.cos(time * 0.16) * (0.08 + values.highs * 0.12 * active);
        engine.camera.position.z = 10.4 - values.beat * 0.1 * active + Math.sin(time * 0.1) * 0.08;
        engine.camera.lookAt(0, 0, 0);
        engine.group.rotation.y = time * (0.03 + values.bass * 0.03 * active) + values.mids * 0.08 * active;
        engine.group.rotation.x = Math.sin(time * 0.16) * 0.05 + values.highs * 0.035 * active;
        engine.light.intensity = 95 + values.highs * 90 * active + values.beat * 120 * active;
        engine.objects.forEach(({ mesh, base, speed, drift, lane, homeX, homeY, homeZ }, index) => {
          const idle = active ? 1 : 0.28;
          mesh.rotation.x += (0.0018 * speed + values.highs * 0.004 * active) * idle;
          mesh.rotation.y += (0.0022 * speed + values.bass * 0.005 * active) * idle;
          mesh.rotation.z += values.beat * 0.004 * active * (index % 2 ? -1 : 1);
          mesh.position.x = homeX + Math.cos(time * (0.18 + speed * 0.08) + drift) * (0.08 + values.mids * 0.14 * active);
          mesh.position.y = homeY + Math.sin(time * speed * 0.38 + drift) * (0.1 + values.highs * 0.13 * active) + values.beat * active * (lane - 2) * 0.025;
          mesh.position.z = homeZ + Math.sin(time * 0.24 + drift) * (0.14 + values.bass * 0.22 * active);
          mesh.scale.setScalar(base * (1 + pulse * (index % 3 === 0 ? 0.42 : 0.2)));
        });
        engine.renderer.render(engine.scene, engine.camera);
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div className="stage-3d" ref={mountRef} aria-hidden="true" />;
}

function CartoonLayer({ theme }) {
  const shapes = useMemo(
    () =>
      Array.from({ length: window.matchMedia("(max-width: 700px)").matches ? 26 : 36 }, (_, index) => ({
        id: index,
        kind: theme.cartoon[index % theme.cartoon.length],
        color: theme.colors[index % theme.colors.length],
        left: `${(index * 17) % 101}%`,
        top: `${(index * 29) % 92}%`,
        size: 18 + ((index * 11) % 54),
        delay: `${-(index * 0.19).toFixed(2)}s`
      })),
    [theme]
  );
  return (
    <div className="cartoon-layer">
      {shapes.map((shape) => (
        <i
          className={`toon toon-${shape.kind}`}
          key={`${theme.label}-${shape.id}`}
          style={{
            "--shape-color": shape.color,
            "--size": `${shape.size}px`,
            "--left": shape.left,
            "--top": shape.top,
            "--delay": shape.delay
          }}
        />
      ))}
    </div>
  );
}

function MotionLayer({ theme }) {
  const streaks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        color: theme.colors[index % theme.colors.length],
        top: `${6 + ((index * 11) % 86)}%`,
        width: `${90 + ((index * 23) % 180)}px`,
        delay: `${-(index * 0.22).toFixed(2)}s`,
        speed: `${3.6 + (index % 5) * 0.45}s`
      })),
    [theme]
  );

  return (
    <div className="motion-layer" aria-hidden="true">
      {streaks.map((streak) => (
        <i
          className="streak"
          key={`${theme.label}-${streak.id}`}
          style={{
            "--streak-color": streak.color,
            "--streak-top": streak.top,
            "--streak-width": streak.width,
            "--streak-delay": streak.delay,
            "--streak-speed": streak.speed
          }}
        />
      ))}
    </div>
  );
}

function RhythmLayer({ theme }) {
  const tiles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        color: theme.colors[(index + 1) % theme.colors.length],
        left: `${3 + ((index * 13) % 94)}%`,
        top: `${8 + ((index * 19) % 84)}%`,
        delay: `${-(index * 0.11).toFixed(2)}s`
      })),
    [theme]
  );

  return (
    <div className="rhythm-layer" aria-hidden="true">
      {tiles.map((tile) => (
        <i
          className="rhythm-tile"
          key={`${theme.label}-${tile.id}`}
          style={{
            "--tile-color": tile.color,
            "--tile-left": tile.left,
            "--tile-top": tile.top,
            "--tile-delay": tile.delay
          }}
        />
      ))}
    </div>
  );
}

function App() {
  const [themeKey, setThemeKey] = useState("io");
  const [panelMinimized, setPanelMinimized] = useState(false);
  const appRef = useRef(null);
  const theme = themes[themeKey];
  const { audioState, metricsRef, loadFile, toggle } = useAudioEngine();

  useEffect(() => {
    let raf = 0;
    const syncCssVars = () => {
      const root = appRef.current;
      if (root) {
        const values = metricsRef.current;
        root.style.setProperty("--pulse", values.beat.toFixed(3));
        root.style.setProperty("--beat", values.beat.toFixed(3));
        root.style.setProperty("--energy", values.level.toFixed(3));
        root.style.setProperty("--active", values.active.toFixed(3));
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
        "--pulse": 0,
        "--beat": 0,
        "--energy": 0,
        "--active": 0
      }}
    >
      <VisualStage theme={theme} metricsRef={metricsRef} />
      <RhythmLayer theme={theme} />
      <CartoonLayer theme={theme} />
      <MotionLayer theme={theme} />
      <div className="gradient-field" aria-hidden="true" />

      <section className={panelMinimized ? "control-panel minimized" : "control-panel"} aria-label="Music visualizer controls">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <div>
            <h1>Visual Music</h1>
            <p>{audioState.name || "Drop in an MP3 and let the stage wake up."}</p>
          </div>
          <button
            className="panel-toggle"
            type="button"
            onClick={() => setPanelMinimized((value) => !value)}
            aria-label={panelMinimized ? "Restore controls" : "Minimize controls"}
            title={panelMinimized ? "Restore controls" : "Minimize controls"}
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
                <input type="file" accept=".mp3,audio/mpeg" onChange={(event) => loadFile(event.target.files?.[0])} />
              </label>
              <button className="play-button" onClick={toggle} disabled={!audioState.ready}>
                {audioState.playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
            </div>

            <div className="theme-grid" aria-label="Theme">
              {Object.entries(themes).map(([key, item]) => (
                <button className={key === themeKey ? "theme-chip active" : "theme-chip"} key={key} onClick={() => setThemeKey(key)}>
                  <Cuboid size={15} />
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
      <span className="meter-bar"><i style={{ width: `${Math.max(3, value * 100)}%` }} /></span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
