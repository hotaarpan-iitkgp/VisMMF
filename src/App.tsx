/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Zap,
  Activity,
  Info,
  RefreshCw,
  Smartphone,
  CheckCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { SimSettings } from './types';
import {
  generateWindingLayout,
  getPhaseCurrents,
  getSlotCurrents,
  computeMmf,
  getMmfHarmonics,
} from './utils/winding';
import { MotorCrossSection } from './components/MotorCrossSection';
import { WindingDiagram } from './components/WindingDiagram';
import { Plots } from './components/Plots';
import { TheorySection } from './components/TheorySection';

export default function App() {
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsAppInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // 1. Initial State for Simulation Control
  const [settings, setSettings] = useState<SimSettings>({
    poles: 4,
    q: 2,
    pitch: 5, // 5/6 short pitch (tau_P = 3q = 6 slots)
    frequency: 1.5, // 1.5 Hz visual frame tracking
    amplitude: 8.0, // 8.0 Amperes
    excitationMode: 'BALANCED_ABC',
    slip: 0.12, // 12% slip
    time: 0,
    speedMult: 1.0,
    magA: 1.0,
    magB: 1.0,
    magC: 1.0,
    phaseA: 0,
    phaseB: -120,
    phaseC: -240,
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isAppFullscreen, setIsAppFullscreen] = useState<boolean>(false);
  const [activeWorkspace, setActiveWorkspace] = useState<'geometry' | 'mmf' | 'unrolled' | 'phase_belt'>('geometry');

  // Time-tracker refs for animation loop
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  // Synchronise pitch limits when Poles or q changes
  const maxPitch = 3 * settings.q;

  const handlePolesChange = (poles: number) => {
    // Avoid layout mismatches: reset pitch to maximum full pitch (3 * q)
    setSettings((prev) => ({
      ...prev,
      poles,
      pitch: 3 * prev.q,
    }));
  };

  const handleQChange = (q: number) => {
    setSettings((prev) => ({
      ...prev,
      q,
      pitch: 3 * q,
    }));
  };

  // Reset clock to 0 electrical degrees
  const handleResetTime = () => {
    setSettings((prev) => ({ ...prev, time: 0 }));
  };

  // 2. Continuous Animation requestAnimationFrame Loop
  useEffect(() => {
    const animate = (timeMs: number) => {
      if (previousTimeRef.current !== null) {
        const deltaTimeSec = (timeMs - previousTimeRef.current) / 1000;

        if (isPlaying) {
          setSettings((prev) => {
            // Speed factor multiplies the physical simulation time clock
            const walk = prev.speedMult * deltaTimeSec;
            return {
              ...prev,
              time: prev.time + walk,
            };
          });
        }
      }
      previousTimeRef.current = timeMs;
      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      previousTimeRef.current = null;
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  // 3. Computed Physical derived variables (The core pipeline)
  const layout = useMemo(() => {
    return generateWindingLayout(settings.poles, settings.q, settings.pitch);
  }, [settings.poles, settings.q, settings.pitch]);

  const phaseCurrents = useMemo(() => {
    return getPhaseCurrents(settings.time, settings);
  }, [settings.time, settings]);

  const slotCurrents = useMemo(() => {
    return getSlotCurrents(layout, phaseCurrents);
  }, [layout, phaseCurrents]);

  const mmfResult = useMemo(() => {
    return computeMmf(layout, slotCurrents);
  }, [layout, slotCurrents]);

  const harmonics = useMemo(() => {
    return getMmfHarmonics(layout, mmfResult.mmf);
  }, [layout, mmfResult.mmf]);

  // Speeds (visual model RPMs)
  const syncSpeedRpm = useMemo(() => {
    if (settings.frequency === 0) return 0;
    return (120 * settings.frequency) / settings.poles;
  }, [settings.frequency, settings.poles]);

  const rotorSpeedRpm = useMemo(() => {
    return syncSpeedRpm * (1 - settings.slip);
  }, [syncSpeedRpm, settings.slip]);

  // Human descriptive text for current pitch fraction
  const coilSpanString = useMemo(() => {
    const polePitch = 3 * settings.q;
    if (settings.pitch === polePitch) {
      return '1.0 (Full Pitch)';
    }
    return `${settings.pitch}/${polePitch} (${((settings.pitch / polePitch) * 100).toFixed(0)}% Pitch)`;
  }, [settings.pitch, settings.q]);

  return (
    <>
      {isAppFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-gray-950 p-6 flex flex-col lg:flex-row items-stretch justify-center gap-6 overflow-hidden select-none text-gray-100">
          
          {/* LEFT COLUMN: CONTROL CONFIGURATION */}
          <div className="w-full lg:w-[360px] bg-gray-900/60 p-5 rounded-2xl border border-gray-800 font-mono flex flex-col justify-between shrink-0 z-10 max-h-full overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="space-y-4">
              {/* Title / Logo */}
              <div className="flex items-center gap-2 border-b border-gray-900 pb-3">
                <span className="p-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Zap className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold tracking-wider text-amber-500 uppercase">
                  MMF Simulation Control
                </span>
              </div>

              {/* Quick stats in sidebar */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-black/40 p-2 rounded-lg border border-gray-850">
                <div>
                  <span className="text-gray-500">Slots (S):</span> <strong className="text-amber-500">{layout.slots}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Poles (P):</span> <strong className="text-amber-500">{settings.poles}</strong>
                </div>
                <div className="col-span-2 border-t border-gray-850 mt-1 pt-1">
                  <span className="text-gray-500">Sync:</span> <strong className="text-amber-500">{syncSpeedRpm.toFixed(0)} RPM</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Rotor:</span> <strong className="text-sky-400">{rotorSpeedRpm.toFixed(0)} RPM</strong>
                </div>
              </div>

              {/* STATOR DESIGN */}
              <div className="space-y-3.5 border-b border-gray-900 pb-3.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Stator Design</span>
                
                {/* Poles */}
                <div>
                  <label className="text-[9px] text-gray-400 flex justify-between mb-1">
                    <span>MAGNETIC POLES (P)</span>
                    <span className="text-white font-bold">{settings.poles} Poles</span>
                  </label>
                  <div className="grid grid-cols-3 bg-gray-950 p-0.5 rounded-lg border border-gray-850 divide-x divide-gray-850 text-[10px]">
                    {[2, 4, 6].map((pVal) => (
                      <button
                        key={`fs-pole-sel-${pVal}`}
                        onClick={() => handlePolesChange(pVal)}
                        className={`text-center py-1 rounded transition-colors cursor-pointer font-bold ${settings.poles === pVal ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
                      >
                        {pVal}P
                      </button>
                    ))}
                  </div>
                </div>

                {/* q */}
                <div>
                  <label className="text-[9px] text-gray-400 flex justify-between mb-1">
                    <span>SLOTS/POLE/PHASE (q)</span>
                    <span className="text-white font-bold">q = {settings.q}</span>
                  </label>
                  <div className="grid grid-cols-4 bg-gray-950 p-0.5 rounded-lg border border-gray-850 divide-x divide-gray-850 text-[10px]">
                    {[1, 2, 3, 4].map((qVal) => (
                      <button
                        key={`fs-q-sel-${qVal}`}
                        onClick={() => handleQChange(qVal)}
                        className={`text-center py-1 rounded transition-colors cursor-pointer font-bold ${settings.q === qVal ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
                      >
                        {qVal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pitch */}
                <div>
                  <div className="text-[9px] text-gray-400 flex justify-between mb-0.5">
                    <span>COIL PITCH (y slots)</span>
                    <span className="text-amber-500 font-bold">{coilSpanString}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={maxPitch}
                    value={settings.pitch}
                    onChange={(e) => setSettings((prev) => ({ ...prev, pitch: parseInt(e.target.value) }))}
                    className="w-full accent-amber-500 bg-gray-950 h-1 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* SIMULATION EXCITATION */}
              <div className="space-y-3.5 border-b border-gray-900 pb-3.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Simulation Excitation</span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex-1 py-1.5 flex items-center justify-center gap-1 rounded-lg text-[10px] font-semibold cursor-pointer border transition-all ${isPlaying ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-emerald-500 text-black border-transparent font-bold'}`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3 h-3 fill-red-400" /> Stop
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-black" /> Run
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleResetTime}
                    title="Reset Angle Clock to θ=0"
                    className="px-2.5 bg-gray-950 hover:bg-gray-900 text-gray-300 border border-gray-850 rounded-lg cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                {/* Angle scrubber */}
                <div>
                  <div className="text-[9px] text-gray-400 flex justify-between mb-0.5">
                    <span>TIME ANGLE (ωt)</span>
                    <span className="text-amber-500 font-bold">
                      {((settings.time * 2 * Math.PI * settings.frequency * 180) / Math.PI % 360).toFixed(0)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={((settings.time * 2 * Math.PI * settings.frequency * 180) / Math.PI % 360).toFixed(0)}
                    onChange={(e) => {
                      setIsPlaying(false);
                      const angleRad = (parseFloat(e.target.value) * Math.PI) / 180;
                      if (settings.frequency > 0) {
                        setSettings((prev) => ({
                          ...prev,
                          time: angleRad / (2 * Math.PI * prev.frequency),
                        }));
                      }
                    }}
                    className="w-full accent-amber-500 bg-gray-950 h-1 rounded cursor-pointer"
                  />
                </div>

                {/* Frequency */}
                <div>
                  <div className="text-[9px] text-gray-400 flex justify-between mb-0.5">
                    <span>FREQUENCY</span>
                    <span className="text-white font-bold">{settings.frequency.toFixed(1)} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5.0"
                    step="0.1"
                    value={settings.frequency}
                    onChange={(e) => setSettings((prev) => ({ ...prev, frequency: parseFloat(e.target.value) }))}
                    className="w-full accent-amber-500 bg-gray-950 h-1 rounded cursor-pointer"
                  />
                </div>

                {/* Slip */}
                <div>
                  <div className="text-[9px] text-gray-400 flex justify-between mb-0.5">
                    <span>ROTOR SLIP (s)</span>
                    <span className="text-sky-400 font-bold">{(settings.slip * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.01"
                    value={settings.slip}
                    onChange={(e) => setSettings((prev) => ({ ...prev, slip: parseFloat(e.target.value) }))}
                    className="w-full accent-amber-500 bg-gray-950 h-1 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* PHASE EXCITATION MODE */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Phase Excitation Mode</span>
                <div className="space-y-1.5 text-[9.5px]">
                  {[
                    { mode: 'BALANCED_ABC', label: 'Balanced (ABC)' },
                    { mode: 'BALANCED_ACB', label: 'Reversed (ACB)' },
                    { mode: 'SINGLE_PHASE', label: 'Single-Phase' },
                    { mode: 'CUSTOM', label: 'Custom' },
                  ].map((item) => (
                    <label
                      key={`fs-mode-label-${item.mode}`}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer select-none transition-all ${settings.excitationMode === item.mode ? 'bg-amber-500/5 border-amber-500/40 text-amber-500' : 'bg-gray-950/60 border-gray-850 text-gray-300 hover:bg-gray-900/60'}`}
                    >
                      <input
                        type="radio"
                        name="fsExcitationMode"
                        checked={settings.excitationMode === item.mode}
                        onChange={() => setSettings((prev) => ({ ...prev, excitationMode: item.mode as any }))}
                        className="accent-amber-500"
                      />
                      <span className="font-bold">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* EXIT FULLSCREEN BUTTON AT SIDEBAR BOTTOM */}
            <button
              onClick={() => {
                setIsAppFullscreen(false);
              }}
              className="mt-4 py-2 w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5 text-xs font-bold"
            >
              <Minimize2 className="w-4 h-4" /> Exit Full Screen
            </button>
          </div>

          {/* RIGHT COLUMN: WORKSPACE SWITCHER + ACTIVE WORKSPACE */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
            {/* WORKSPACE SWITCHER TABS BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/40 p-2 rounded-2xl border border-gray-800 shrink-0">
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'geometry', label: 'Geometry Workspace', icon: Zap },
                  { id: 'mmf', label: 'Stator MMF Waveform', icon: Activity },
                  { id: 'unrolled', label: 'Unrolled Stator', icon: SlidersHorizontal },
                  { id: 'phase_belt', label: 'Phase Belt Diagram', icon: RefreshCw },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeWorkspace === tab.id;
                  return (
                    <button
                      key={`fs-tab-${tab.id}`}
                      onClick={() => setActiveWorkspace(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] text-gray-500 font-mono tracking-wide uppercase pr-3 select-none hidden sm:block">
                ACTIVE WORKSPACE
              </div>
            </div>

            {/* ACTIVE WORKSPACE CONTAINER VIEWPORT */}
            <div className="flex-1 bg-gray-950/60 rounded-2xl border border-gray-800 p-4 relative overflow-y-auto custom-scrollbar flex flex-col justify-stretch items-stretch min-h-0">
              {activeWorkspace === 'geometry' && (
                <div className="w-full h-full flex-1 min-h-0">
                  <MotorCrossSection
                    layout={layout}
                    settings={settings}
                    currents={slotCurrents}
                    mmf={mmfResult}
                    isFullscreen={false}
                    embedFullscreen={true}
                    onToggleFullscreen={(val) => {
                      if (!val) {
                        setIsAppFullscreen(false);
                      }
                    }}
                  />
                </div>
              )}

              {activeWorkspace === 'mmf' && (
                <div className="w-full h-full flex-1 min-h-0">
                  <Plots
                    layout={layout}
                    settings={settings}
                    mmf={mmfResult}
                    harmonics={harmonics}
                  />
                </div>
              )}

              {activeWorkspace === 'unrolled' && (
                <div className="w-full h-full flex-1 min-h-0">
                  <WindingDiagram
                    layout={layout}
                    settings={settings}
                    currents={slotCurrents}
                    forceDiagramMode="crossSection"
                  />
                </div>
              )}

              {activeWorkspace === 'phase_belt' && (
                <div className="w-full h-full flex-1 min-h-0">
                  <WindingDiagram
                    layout={layout}
                    settings={settings}
                    currents={slotCurrents}
                    forceDiagramMode="lapWinding"
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* HEADER SECTION */}
      <header className="border-b border-gray-900 bg-gray-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Zap className="w-5 h-5" />
              </span>
              <h1 className="text-lg font-mono font-bold tracking-tight text-white uppercase">
                VISMMF: Three-Phase Motor MMF Visualizer
              </h1>
            </div>
            <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">
              Analyze the spatial distribution of the Magnetomotive Force (MMF) waveform
              in induction motors under multiple stator slots, winding layout, and electrical phase imbalances. Developed by Prof. Arpan Hota (EE-IITKGP).
            </p>
          </div>

          {/* Quick Stats Banner */}
          <div className="flex flex-wrap gap-2 text-xs font-mono select-none items-center">
            {deferredPrompt && (
              <button
                onClick={handleInstallPwa}
                title="Install app on your device for fast offline access!"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <Smartphone className="w-3.5 h-3.5" /> Install App
              </button>
            )}
            {isAppInstalled && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>OFFLINE APP ACTIVE</span>
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
              <span className="text-gray-500">Stator Slots (S):</span>{' '}
              <strong className="text-amber-500">{layout.slots}</strong>
            </div>
            <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
              <span className="text-gray-500">Sync Speed (N<sub>s</sub>):</span>{' '}
              <strong className="text-amber-500">{syncSpeedRpm.toFixed(1)} RPM</strong>
            </div>
            <div className="bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg animate-pulse">
              <span className="text-gray-500">Rotor (1-s)N<sub>s</sub>:</span>{' '}
              <strong className="text-sky-400">{rotorSpeedRpm.toFixed(1)} RPM</strong>
            </div>
          </div>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* UPPER PRIMARY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* COLUMN 1: MOTOR CROSS SECTION (5cols) */}
          <div className="lg:col-span-5 h-full">
            <MotorCrossSection
              layout={layout}
              settings={settings}
              currents={slotCurrents}
              mmf={mmfResult}
              isFullscreen={false}
              onToggleFullscreen={(val) => {
                if (val) {
                  setIsAppFullscreen(true);
                  setActiveWorkspace('geometry');
                }
              }}
            />
          </div>

          {/* COLUMN 2: TABBED CHARTS PLOTS (7cols) */}
          <div className="lg:col-span-7 h-full">
            <Plots
              layout={layout}
              settings={settings}
              mmf={mmfResult}
              harmonics={harmonics}
              onToggleFullscreen={() => {
                setIsAppFullscreen(true);
                setActiveWorkspace('mmf');
              }}
            />
          </div>

        </div>

        {/* LOWER SECONDARY GRID: CONTROL PANEL & DIAGRAM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* INTERACTIVE CONTROLS COLUMN (1col) */}
          <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 shadow-2xl space-y-5 lg:col-span-1">
            <h3 className="text-xs font-semibold tracking-wider text-amber-500 uppercase font-mono flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4" /> Control Configuration
            </h3>

            {/* Part 1: Stator Design */}
            <div className="space-y-4 border-b border-gray-900 pb-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase font-mono tracking-wider flex items-center gap-1">
                <span>Stator Design</span>
              </div>

              {/* Number of Poles Selector */}
              <div>
                <label className="text-[10px] text-gray-400 font-mono flex justify-between mb-1.5">
                  <span>MAGNETIC POLES (P)</span>
                  <span className="text-white font-bold">{settings.poles} Poles</span>
                </label>
                <div className="grid grid-cols-3 bg-gray-900/80 p-1 rounded-lg border border-gray-800 divide-x divide-gray-800 font-mono text-xs select-none">
                  {[2, 4, 6].map((pVal) => (
                    <button
                      key={`pole-sel-${pVal}`}
                      onClick={() => handlePolesChange(pVal)}
                      className={`text-center py-1 rounded-md transition-colors cursor-pointer text-[10.5px] font-bold ${settings.poles === pVal ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      {pVal}P
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots per pole per phase (q) selector */}
              <div>
                <label className="text-[10px] text-gray-400 font-mono flex justify-between mb-1.5">
                  <span>SLOTS/POLE/PHASE (q)</span>
                  <span className="text-white font-bold">q = {settings.q}</span>
                </label>
                <div className="grid grid-cols-4 bg-gray-900/80 p-1 rounded-lg border border-gray-800 divide-x divide-gray-800 font-mono text-xs select-none">
                  {[1, 2, 3, 4].map((qVal) => (
                    <button
                      key={`q-sel-${qVal}`}
                      onClick={() => handleQChange(qVal)}
                      className={`text-center py-1 rounded-md transition-colors cursor-pointer text-[10.5px] font-bold ${settings.q === qVal ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      {qVal} slot
                    </button>
                  ))}
                </div>
              </div>

              {/* Coil span pitching slider */}
              <div>
                <div className="text-[10px] text-gray-400 font-mono flex justify-between mb-1">
                  <span>COIL PITCH (y slots)</span>
                  <span className="text-amber-500 font-bold">{coilSpanString}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={maxPitch}
                  value={settings.pitch}
                  onChange={(e) => setSettings((prev) => ({ ...prev, pitch: parseInt(e.target.value) }))}
                  className="w-full accent-amber-500 select-none bg-gray-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-gray-500 font-mono mt-0.5 select-none">
                  <span>Short Pitch y=1</span>
                  <span>Full Pitch y={maxPitch}</span>
                </div>
              </div>
            </div>

            {/* Part 2: Dynamic Wave Control & Simulation clock */}
            <div className="space-y-4 border-b border-gray-900 pb-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                Simulation Excitation
              </div>

              {/* Play Pause State buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold cursor-pointer border select-none transition-all ${isPlaying ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-emerald-500 text-black border-transparent font-bold hover:scale-102'}`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-red-400" /> Stop Simulation
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black" /> Run Simulation
                    </>
                  )}
                </button>

                <button
                  onClick={handleResetTime}
                  title="Reset Angle Clock to θ=0"
                  className="px-3.5 bg-gray-900 hover:bg-gray-850 text-gray-300 border border-gray-850 rounded-xl cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Angle Scrubber */}
              <div>
                <div className="text-[10px] text-gray-400 font-mono flex justify-between mb-1 select-none">
                  <span>TIME ANGLE PLOT (ωt)</span>
                  <span className="text-amber-500 font-bold">
                    {((settings.time * 2 * Math.PI * settings.frequency * 180) / Math.PI % 360).toFixed(0)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={((settings.time * 2 * Math.PI * settings.frequency * 180) / Math.PI % 360).toFixed(0)}
                  onChange={(e) => {
                    setIsPlaying(false);
                    const angleRad = (parseFloat(e.target.value) * Math.PI) / 180;
                    if (settings.frequency > 0) {
                      setSettings((prev) => ({
                        ...prev,
                        time: angleRad / (2 * Math.PI * prev.frequency),
                      }));
                    }
                  }}
                  className="w-full accent-amber-500 select-none bg-gray-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Visual Frequency (Hz) slider */}
              <div>
                <div className="text-[10px] text-gray-400 font-mono flex justify-between mb-1 select-none">
                  <span>VISUAL OSCILLATION FREQUENCY</span>
                  <span className="text-white font-bold">{settings.frequency.toFixed(1)} Hz</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5.0"
                  step="0.1"
                  value={settings.frequency}
                  onChange={(e) => setSettings((prev) => ({ ...prev, frequency: parseFloat(e.target.value) }))}
                  className="w-full accent-amber-500 select-none bg-gray-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Rotor Slip Slider */}
              <div>
                <div className="text-[10px] text-gray-400 font-mono flex justify-between mb-1 select-none">
                  <span>ROTOR ELECTRICAL SLIP (s)</span>
                  <span className="text-sky-400 font-bold">{(settings.slip * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.01"
                  value={settings.slip}
                  onChange={(e) => setSettings((prev) => ({ ...prev, slip: parseFloat(e.target.value) }))}
                  className="w-full accent-amber-500 select-none bg-gray-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-gray-500 font-mono select-none">
                  <span>Locked (s=1.0)</span>
                  <span>Sync Speed (s=0)</span>
                </div>
              </div>
            </div>

            {/* Part 3: Phase Modes & Excitation Unbalanced */}
            <div className="space-y-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase font-mono tracking-wider">
                Phase Excitation Mode
              </div>

              <div className="space-y-2 select-none">
                {[
                  { mode: 'BALANCED_ABC', label: '3-Ph Balanced (ABC)', desc: 'Standard rotating MMF direction' },
                  { mode: 'BALANCED_ACB', label: '3-Ph Reversed (ACB)', desc: 'Swaps B & C phase sequence' },
                  { mode: 'SINGLE_PHASE', label: 'Single-Phase (A-only)', desc: 'Pulsating wave (does not rotate)' },
                  { mode: 'CUSTOM', label: 'Custom Phase Shifter', desc: 'Symmetrical phase/magnitude distortion' },
                ].map((item) => (
                  <label
                    key={`mode-label-${item.mode}`}
                    className={`flex flex-col p-2.5 rounded-xl border cursor-pointer select-none transition-all ${settings.excitationMode === item.mode ? 'bg-amber-500/5 border-amber-500/45 text-amber-500' : 'bg-gray-900/40 border-gray-900 text-gray-300 hover:bg-gray-900/60'}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="excitationMode"
                        checked={settings.excitationMode === item.mode}
                        onChange={() => setSettings((prev) => ({ ...prev, excitationMode: item.mode as any }))}
                        className="accent-amber-500"
                      />
                      <span className="font-bold text-xs">{item.label}</span>
                    </div>
                    <span className="text-[9.5px] text-gray-500 mt-1 pl-5 font-sans leading-none">
                      {item.desc}
                    </span>
                  </label>
                ))}
              </div>

              {/* Custom sliders configuration displayed when Custom Mode is selected */}
              {settings.excitationMode === 'CUSTOM' && (
                <div className="bg-gray-900/40 border border-gray-800 p-3.5 rounded-xl space-y-4 animate-fadeIn font-mono text-[9px]">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-1 mr-[-2px]">
                    <span className="text-gray-400 font-bold uppercase select-none">Custom Parameters</span>
                    <button
                      onClick={() => setSettings((prev) => ({
                        ...prev,
                        magA: 1.0, magB: 1.0, magC: 1.0,
                        phaseA: 0, phaseB: -120, phaseC: -240
                      }))}
                      className="text-amber-500 text-[8px] border border-amber-500/30 px-1.5 py-0.5 rounded italic cursor-pointer hover:bg-amber-500/10"
                    >
                      Reset Balances
                    </button>
                  </div>

                  {/* Magnitude slider sliders */}
                  <div className="space-y-2.5">
                    <span className="text-gray-500 uppercase font-bold text-[8px] block">Relative Amplitudes</span>
                    
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-red-400">Phase A Mag:</span>
                        <span className="text-white">{(settings.magA).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range" min="0" max="1.5" step="0.05" value={settings.magA}
                        onChange={(e) => setSettings((prev) => ({ ...prev, magA: parseFloat(e.target.value) }))}
                        className="w-full accent-red-400 select-none h-1"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-emerald-400">Phase B Mag:</span>
                        <span className="text-white">{(settings.magB).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range" min="0" max="1.5" step="0.05" value={settings.magB}
                        onChange={(e) => setSettings((prev) => ({ ...prev, magB: parseFloat(e.target.value) }))}
                        className="w-full accent-emerald-400 select-none h-1"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-sky-400">Phase C Mag:</span>
                        <span className="text-white">{(settings.magC).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range" min="0" max="1.5" step="0.05" value={settings.magC}
                        onChange={(e) => setSettings((prev) => ({ ...prev, magC: parseFloat(e.target.value) }))}
                        className="w-full accent-sky-400 select-none h-1"
                      />
                    </div>
                  </div>

                  {/* Phase shift slider sliders */}
                  <div className="space-y-2.5 pt-2 border-t border-gray-800/80">
                    <span className="text-gray-500 uppercase font-bold text-[8px] block">Phase Shift Offsets (deg)</span>

                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-red-400">Phase A Shift:</span>
                        <span className="text-white">{settings.phaseA}°</span>
                      </div>
                      <input
                        type="range" min="-180" max="180" step="5" value={settings.phaseA}
                        onChange={(e) => setSettings((prev) => ({ ...prev, phaseA: parseInt(e.target.value) }))}
                        className="w-full accent-red-400 select-none h-1"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-emerald-400">Phase B Shift:</span>
                        <span className="text-white">{settings.phaseB}°</span>
                      </div>
                      <input
                        type="range" min="-180" max="180" step="5" value={settings.phaseB}
                        onChange={(e) => setSettings((prev) => ({ ...prev, phaseB: parseInt(e.target.value) }))}
                        className="w-full accent-emerald-400 select-none h-1"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-sky-400">Phase C Shift:</span>
                        <span className="text-white">{settings.phaseC}°</span>
                      </div>
                      <input
                        type="range" min="-180" max="180" step="5" value={settings.phaseC}
                        onChange={(e) => setSettings((prev) => ({ ...prev, phaseC: parseInt(e.target.value) }))}
                        className="w-full accent-sky-400 select-none h-1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LINEAR WINDING WINDING DIAGRAM COLUMN (2cols span equivalent) */}
          <div className="lg:col-span-2 space-y-6">
            <WindingDiagram
              layout={layout}
              settings={settings}
              currents={slotCurrents}
              onToggleFullscreen={(mode) => {
                setIsAppFullscreen(true);
                setActiveWorkspace(mode);
              }}
            />
            
            {/* INFORMATIVE EXPLANATORY NOTE */}
            <div className="bg-sky-950/15 border border-sky-900/30 p-4 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-450 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-300 leading-relaxed font-sans">
                <strong className="text-white block font-mono text-[11px] uppercase tracking-wide mb-1">
                  Did you know?
                </strong>
                Suppressed spatial harmonics represent unwanted rotor heating, friction, and noise. Distributed stator windings behave like physical spatial filter banks, smoothing the jagged magnetic field steps into a clean fundamental torque wave.
              </div>
            </div>
          </div>

        </div>

        {/* THEORY REFERENCE MANUAL WRAPPER */}
        <TheorySection
          poles={settings.poles}
          q={settings.q}
          pitch={settings.pitch}
        />

      </main>

      {/* FOOTER SECTION */}
      <footer className="border-t border-gray-900 bg-gray-950/40 py-4 px-6 text-center text-[10px] text-gray-500 font-mono select-none mt-auto">
        <p>Three-Phase Induction Motor Spatial MMF Visualizer &middot; Built with High-Fidelity React Physics Solvers</p>
      </footer>
    </div>
  </>
  );
}
