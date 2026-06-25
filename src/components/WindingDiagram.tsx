/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Activity, Maximize2 } from 'lucide-react';
import { WindingLayout, SimSettings, SlotCurrents } from '../types';

interface WindingDiagramProps {
  layout: WindingLayout;
  settings: SimSettings;
  currents: SlotCurrents;
  forceDiagramMode?: 'crossSection' | 'lapWinding';
  onToggleFullscreen?: (mode: 'unrolled' | 'phase_belt') => void;
}

export const WindingDiagram: React.FC<WindingDiagramProps> = ({
  layout,
  settings,
  currents,
  forceDiagramMode,
  onToggleFullscreen,
}) => {
  const S = layout.slots;
  const pitch = layout.pitch;

  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [internalDiagramMode, setInternalDiagramMode] = useState<'crossSection' | 'lapWinding'>('crossSection');
  const diagramMode = forceDiagramMode || internalDiagramMode;
  const setDiagramMode = forceDiagramMode ? () => {} : setInternalDiagramMode;
  const [activePhases, setActivePhases] = useState<boolean[]>([true, true, true]);
  const [showFlow, setShowFlow] = useState<boolean>(true);

  const [terminalConnection, setTerminalConnection] = useState<'individual' | 'star'>('star');
  const [pathStyle, setPathStyle] = useState<'triangular' | 'orthogonal'>('triangular');

  // MMF Magnetic Field visualizer state variables
  const [showFieldVisualizer, setShowFieldVisualizer] = useState<boolean>(true);
  const [fieldDisplayStyle, setFieldDisplayStyle] = useState<'vectors' | 'staircase' | 'both'>('both');
  const [visibleFields, setVisibleFields] = useState<{ A: boolean, B: boolean, C: boolean, Resultant: boolean }>({
    A: true,
    B: true,
    C: true,
    Resultant: true
  });

  // Layout sizing
  const marginX = 25;
  const width = 800; // Fixed width ensures no horizontal scroll/zoom but perfect fit
  // Increase vertical size when lapWinding is selected
  const height = diagramMode === 'lapWinding' ? 500 : 150;
  const slotWidth = (width - 2 * marginX) / S;

  const yTopLayer = diagramMode === 'lapWinding' ? 130 : 45;
  const yBotLayer = diagramMode === 'lapWinding' ? 180 : 95;

  const phaseColors = ['#ef4444', '#10b981', '#3b82f6'];
  const phaseNames = ['Phase A', 'Phase B', 'Phase C'];

  // Slot helper data
  const slotData = [];
  const pCurrents = [currents.iA, currents.iB, currents.iC];

  for (let s = 0; s < S; s++) {
    const tPhase = layout.topPhase[s];
    const tSign = layout.topSign[s];
    const bPhase = layout.bottomPhase[s];
    const bSign = layout.bottomSign[s];

    const curTop = tSign * pCurrents[tPhase];
    const curBot = bSign * pCurrents[bPhase];

    slotData.push({
      slotIdx: s,
      x: marginX + s * slotWidth + slotWidth / 2,
      top: {
        phase: tPhase,
        sign: tSign,
        current: curTop,
      },
      bottom: {
        phase: bPhase,
        sign: bSign,
        current: curBot,
      },
    });
  }

  // 1. Compute Individual Phase MMFs
  const phaseFieldMmf = useMemo(() => {
    // Compute slot currents and MMF for each phase separately
    const mmfByPhase = [0, 1, 2].map((p) => {
      const I_p = pCurrents[p];
      const slotCurrentsP = new Array<number>(S).fill(0);
      
      for (let s = 0; s < S; s++) {
        const topContrib = layout.topPhase[s] === p ? layout.topSign[s] * I_p : 0;
        const bottomContrib = layout.bottomPhase[s] === p ? layout.bottomSign[s] * I_p : 0;
        slotCurrentsP[s] = topContrib + bottomContrib;
      }
      
      // Cumulative sum of slotCurrentsP to obtain Phase P's raw MMF staircase
      const rawMmfP = new Array<number>(S).fill(0);
      let sum = 0;
      for (let s = 0; s < S; s++) {
        sum += slotCurrentsP[s];
        rawMmfP[s] = sum;
      }
      
      // Balanced MMF is rawMmfP minus average value of rawMmfP
      const avgP = rawMmfP.reduce((a, b) => a + b, 0) / S;
      const mmfP = rawMmfP.map(val => val - avgP);
      
      return mmfP;
    });
    
    return {
      mmfA: mmfByPhase[0],
      mmfB: mmfByPhase[1],
      mmfC: mmfByPhase[2]
    };
  }, [layout, currents, S, pCurrents]);

  // Compute the exact resultant MMF (the linear sum of phase A, B, and C fields)
  const mmfResult = useMemo(() => {
    const rawMmf = new Array<number>(S).fill(0);
    let sum = 0;
    for (let s = 0; s < S; s++) {
      sum += currents.slotCurrents[s];
      rawMmf[s] = sum;
    }
    const avg = rawMmf.reduce((a, b) => a + b, 0) / S;
    const mmf = rawMmf.map(val => val - avg);
    return { mmf };
  }, [currents.slotCurrents, S]);

  // Stable scale amplitude based on maximum absolute value observed at current frame
  const { maxOverall, yScale } = useMemo(() => {
    let maxVal = 1.0;
    for (let s = 0; s < S; s++) {
      maxVal = Math.max(maxVal, Math.abs(phaseFieldMmf.mmfA[s]));
      maxVal = Math.max(maxVal, Math.abs(phaseFieldMmf.mmfB[s]));
      maxVal = Math.max(maxVal, Math.abs(phaseFieldMmf.mmfC[s]));
      maxVal = Math.max(maxVal, Math.abs(mmfResult.mmf[s]));
    }
    
    // Scale factor to map MMF values up to height limit of 84 pixels (doubled from 42)
    const clampMax = Math.max(1.0, maxVal);
    const scale = 84 / clampMax;
    return { maxOverall: maxVal, yScale: scale };
  }, [phaseFieldMmf, mmfResult.mmf, S]);

  const yBaseline = 130; // vertical center line of height 260 SVG container (doubled from 65)

  const getStairpath = (mmfArray: number[]) => {
    const pts = [];
    for (let s = 0; s < S; s++) {
      const x1 = marginX + s * slotWidth;
      const x2 = marginX + (s + 1) * slotWidth;
      const yStr = (yBaseline - mmfArray[s] * yScale).toFixed(1);
      
      if (s === 0) {
        pts.push(`M ${x1.toFixed(1)} ${yStr}`);
      } else {
        const prevYStr = (yBaseline - mmfArray[s - 1] * yScale).toFixed(1);
        pts.push(`L ${x1.toFixed(1)} ${prevYStr}`);
        pts.push(`L ${x1.toFixed(1)} ${yStr}`);
      }
      pts.push(`L ${x2.toFixed(1)} ${yStr}`);
    }
    return pts.join(' ');
  };

  const getStairFillPath = (mmfArray: number[]) => {
    const pts = [];
    const xStart = marginX;
    const xEnd = marginX + S * slotWidth;
    
    // Start at baseline on the left
    pts.push(`M ${xStart.toFixed(1)} ${yBaseline.toFixed(1)}`);
    
    for (let s = 0; s < S; s++) {
      const x1 = marginX + s * slotWidth;
      const x2 = marginX + (s + 1) * slotWidth;
      const yStr = (yBaseline - mmfArray[s] * yScale).toFixed(1);
      
      const prevYStr = s === 0 ? yBaseline.toFixed(1) : (yBaseline - mmfArray[s - 1] * yScale).toFixed(1);
      pts.push(`L ${x1.toFixed(1)} ${prevYStr}`);
      pts.push(`L ${x1.toFixed(1)} ${yStr}`);
      pts.push(`L ${x2.toFixed(1)} ${yStr}`);
    }
    
    // Connect to baseline on the right and close the path
    pts.push(`L ${xEnd.toFixed(1)} ${yBaseline.toFixed(1)}`);
    pts.push('Z');
    
    return pts.join(' ');
  };

  // Draw arrow inside conductor block
  const renderArrow = (current: number, r: number) => {
    if (Math.abs(current) < 0.05 * settings.amplitude) return null;
    const fontSize = Math.max(6, Math.min(10, r * 0.9));
    const dy = fontSize * 0.35;
    return current > 0 ? (
      <text style={{ fontSize: `${fontSize}px` }} className="fill-white font-bold select-none" textAnchor="middle" y={dy}>
        ▲
      </text>
    ) : (
      <text style={{ fontSize: `${fontSize}px` }} className="fill-white font-bold select-none" textAnchor="middle" y={dy}>
        ▼
      </text>
    );
  };

  return (
    <div className="bg-gray-950 p-5 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden font-mono text-xs">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-4 gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-amber-500 uppercase font-mono">
            Unrolled Stator Winding & Phase Belt Diagram
          </h3>
          <p className="text-gray-400 text-[11px] mt-1 font-sans">
            {diagramMode === 'crossSection'
              ? `Hover over any slot to inspect the coil span bridging from top to bottom layers (pitch = ${pitch} slots).`
              : `Interactive full-lap winding connections. Glow and dash velocity reflect instantaneous 3-phase currents.`}
          </p>
        </div>

        {/* Action Controls & Legend */}
        <div className="flex flex-wrap items-center gap-3 self-end md:self-center">
          {/* View Mode Toggle */}
          {!forceDiagramMode && (
            <div className="flex items-center gap-1 bg-gray-900/80 p-0.5 rounded-xl border border-gray-800">
              <button
                id="btn-winding-cross-section"
                onClick={() => setDiagramMode('crossSection')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                  diagramMode === 'crossSection'
                    ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Cross-Section View
              </button>
              <button
                id="btn-winding-full-lap"
                onClick={() => setDiagramMode('lapWinding')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                  diagramMode === 'lapWinding'
                    ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Full Lap Winding
              </button>
            </div>
          )}

          {/* Phase Active Toggles */}
          <div className="flex items-center gap-1 bg-gray-900/80 p-0.5 rounded-xl border border-gray-800">
            <span className="text-[9px] text-gray-500 px-2 font-bold tracking-wider uppercase font-sans select-none">Show:</span>
            {[0, 1, 2].map((p) => {
              const pLabel = p === 0 ? 'U' : p === 1 ? 'V' : 'W';
              const pName = p === 0 ? 'Phase U (A)' : p === 1 ? 'Phase V (B)' : 'Phase W (C)';
              const isActive = activePhases[p];
              return (
                <button
                  key={`phase-toggle-${p}`}
                  id={`btn-toggle-phase-${pLabel.toLowerCase()}`}
                  onClick={() => {
                    setActivePhases(prev => {
                      const next = [...prev];
                      next[p] = !next[p];
                      return next;
                    });
                  }}
                  title={`Toggle ${pName}`}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 border ${
                    isActive
                      ? 'bg-gray-850/80 text-white font-bold'
                      : 'text-gray-500 hover:text-gray-300 opacity-50 border-transparent'
                  }`}
                  style={{
                    borderColor: isActive ? `${phaseColors[p]}50` : 'transparent',
                    boxShadow: isActive ? `0 0 6px ${phaseColors[p]}25` : 'none',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block transition-transform duration-200"
                    style={{
                      backgroundColor: isActive ? phaseColors[p] : '#4b5563',
                      transform: isActive ? 'scale(1.2)' : 'none'
                    }}
                  />
                  {pLabel}
                </button>
              );
            })}
          </div>

          {/* Connection Mode Toggle (Lap Winding only) */}
          {diagramMode === 'lapWinding' && (
            <div className="flex items-center gap-1 bg-gray-900/80 p-0.5 rounded-xl border border-gray-800">
              <span className="text-[9px] text-gray-500 px-2 font-bold tracking-wider uppercase font-sans select-none">Connection:</span>
              <button
                id="btn-connection-individual"
                onClick={() => setTerminalConnection('individual')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                  terminalConnection === 'individual'
                    ? 'bg-gray-850/80 text-white font-bold'
                    : 'text-gray-500 hover:text-gray-300 opacity-50'
                }`}
              >
                Individual
              </button>
              <button
                id="btn-connection-star"
                onClick={() => setTerminalConnection('star')}
                title="Connect exit leads into a Star (Wye) neutral junction point"
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                  terminalConnection === 'star'
                    ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10'
                    : 'text-gray-500 hover:text-gray-300 opacity-50'
                }`}
              >
                Star (N)
              </button>
            </div>
          )}

          {/* Path Style Toggle (Lap Winding only) */}
          {diagramMode === 'lapWinding' && (
            <div className="flex items-center gap-1 bg-gray-900/80 p-0.5 rounded-xl border border-gray-800">
              <span className="text-[9px] text-gray-500 px-2 font-bold tracking-wider uppercase font-sans select-none">Path Style:</span>
              <button
                id="btn-style-triangular"
                onClick={() => setPathStyle('triangular')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                  pathStyle === 'triangular'
                    ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10'
                    : 'text-gray-500 hover:text-gray-300 opacity-50'
                }`}
              >
                Triangular
              </button>
              <button
                id="btn-style-orthogonal"
                onClick={() => setPathStyle('orthogonal')}
                title="Use fully orthogonal 90-degree square paths for coil ends"
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                  pathStyle === 'orthogonal'
                    ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10'
                    : 'text-gray-500 hover:text-gray-300 opacity-50'
                }`}
              >
                Orthogonal
              </button>
            </div>
          )}

          {/* Flow Toggle button */}
          <div className="flex items-center bg-gray-900/80 p-0.5 rounded-xl border border-gray-800">
            <button
              id="btn-toggle-flow"
              onClick={() => setShowFlow(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-transparent ${
                showFlow
                  ? 'bg-gray-800/80 text-amber-500 font-bold'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block transition-transform duration-200 ${
                  showFlow ? 'bg-amber-400 scale-125' : 'bg-gray-600'
                }`}
              />
              Flow: {showFlow ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Full Screen Button */}
          {onToggleFullscreen && (
            <button
              onClick={() => onToggleFullscreen(diagramMode === 'crossSection' ? 'unrolled' : 'phase_belt')}
              className="text-[10px] font-bold text-amber-500 cursor-pointer border border-amber-500/20 px-3 py-1.5 rounded-lg bg-gray-950 hover:bg-amber-500/10 transition-all uppercase flex items-center gap-1 select-none"
              title="Open in Workspace Full Screen"
            >
              <Maximize2 className="w-3 h-3" /> Full Screen
            </button>
          )}

          {/* Legend */}
          <div className="flex gap-4 text-[10px] bg-gray-900/30 px-3 py-1.5 rounded-xl border border-gray-900 bg-gray-900/50">
            <div className="flex items-center gap-1">
              <span className="text-white font-bold">▲</span>
              <span className="text-gray-400">Out</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white font-bold">▼</span>
              <span className="text-gray-400">In</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAGNETIC FIELD CONTROL SUB-BAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between mb-4 mt-2 p-3 bg-gray-900/40 rounded-xl border border-gray-800/60 gap-3 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
          </span>
          <div>
            <span className="font-bold text-gray-200 uppercase tracking-wider text-xs">MMF Magnetic Field Visualizer</span>
            <p className="text-[10px] text-gray-400 font-sans mt-0.5">Show individual winding fields as pulsating vectors/waves or the resultant traveling MMF.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Master Toggle */}
          <button
            id="btn-toggle-field-visualizer"
            onClick={() => setShowFieldVisualizer(!showFieldVisualizer)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer border ${
              showFieldVisualizer
                ? 'bg-amber-500 text-black border-amber-400 font-semibold shadow-md shadow-amber-500/10'
                : 'bg-gray-850 text-gray-400 border-transparent hover:text-white hover:bg-gray-800'
            }`}
          >
            MMF Overlay: {showFieldVisualizer ? 'ENABLED' : 'DISABLED'}
          </button>

          {showFieldVisualizer && (
            <>
              {/* Field Display Style Selector */}
              <div className="flex items-center bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                <button
                  id="btn-field-style-vectors"
                  onClick={() => setFieldDisplayStyle('vectors')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    fieldDisplayStyle === 'vectors'
                      ? 'bg-gray-800 text-amber-500 font-extrabold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Vectors
                </button>
                <button
                  id="btn-field-style-staircase"
                  onClick={() => setFieldDisplayStyle('staircase')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    fieldDisplayStyle === 'staircase'
                      ? 'bg-gray-800 text-amber-500 font-extrabold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Waves
                </button>
                <button
                  id="btn-field-style-both"
                  onClick={() => setFieldDisplayStyle('both')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    fieldDisplayStyle === 'both'
                      ? 'bg-gray-800 text-amber-500 font-extrabold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Both
                </button>
              </div>

              {/* Individual Phase + Resultant Toggles */}
              <div className="flex items-center bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                {([
                  { key: 'A', label: 'Phase A', color: phaseColors[0] },
                  { key: 'B', label: 'Phase B', color: phaseColors[1] },
                  { key: 'C', label: 'Phase C', color: phaseColors[2] },
                  { key: 'Resultant', label: 'Resultant', color: '#f59e0b' }
                ] as const).map((item) => {
                  const isActive = visibleFields[item.key];
                  return (
                    <button
                      key={`field-vis-${item.key}`}
                      id={`btn-toggle-field-${item.key.toLowerCase()}`}
                      onClick={() => setVisibleFields(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                        isActive
                          ? 'bg-gray-800 text-white font-extrabold'
                          : 'text-gray-550 hover:text-gray-300 border-transparent opacity-50'
                      }`}
                      style={{
                        borderColor: isActive ? `${item.color}50` : 'transparent',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ backgroundColor: isActive ? item.color : '#4b5563' }}
                      />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        {showFieldVisualizer && (
          <div className="mb-3 bg-gray-950/20 rounded-xl border border-gray-900 overflow-hidden">
            <svg
              viewBox="0 0 800 260"
              className="w-full min-w-[750px] h-auto select-none"
            >
              {/* Background Grid Lines for slot alignment */}
              {slotData.map((slot) => (
                <line
                  key={`field-slot-grid-${slot.slotIdx}`}
                  x1={slot.x}
                  y1={0}
                  x2={slot.x}
                  y2={260}
                  stroke="#1e293b"
                  strokeWidth="0.5"
                  strokeDasharray="2 3"
                  opacity={hoveredSlot === slot.slotIdx ? 1 : 0.4}
                />
              ))}

              {/* Zero Phase MMF Baseline */}
              <line
                x1={marginX}
                y1={yBaseline}
                x2={width - marginX}
                y2={yBaseline}
                stroke="#334155"
                strokeWidth="1.2"
                opacity="0.8"
              />
              {/* Legend reference labels */}
              <text x={marginX - 13} y={yBaseline + 3} className="fill-gray-500 font-mono text-[8px]" textAnchor="end">0</text>
              <text x={marginX - 13} y={40} className="fill-gray-500 font-mono text-[8px]" textAnchor="end">+B</text>
              <text x={marginX - 13} y={220} className="fill-gray-500 font-mono text-[8px]" textAnchor="end">-B</text>

              {/* Render Wave Staircases underneath */}
              {(fieldDisplayStyle === 'staircase' || fieldDisplayStyle === 'both') && (
                <g>
                  {/* Phase C Field Staircase */}
                  {visibleFields.C && (
                    <g>
                      <path
                        d={getStairFillPath(phaseFieldMmf.mmfC)}
                        fill="rgba(59, 130, 246, 0.08)"
                        stroke="none"
                        opacity={visibleFields.Resultant ? 0.6 : 0.95}
                      />
                      <path
                        d={getStairpath(phaseFieldMmf.mmfC)}
                        fill="none"
                        stroke={phaseColors[2]}
                        strokeWidth="1.5"
                        strokeLinejoin="miter"
                        opacity={visibleFields.Resultant ? 0.6 : 0.95}
                      />
                    </g>
                  )}
                  {/* Phase B Field Staircase */}
                  {visibleFields.B && (
                    <g>
                      <path
                        d={getStairFillPath(phaseFieldMmf.mmfB)}
                        fill="rgba(16, 185, 129, 0.08)"
                        stroke="none"
                        opacity={visibleFields.Resultant ? 0.6 : 0.95}
                      />
                      <path
                        d={getStairpath(phaseFieldMmf.mmfB)}
                        fill="none"
                        stroke={phaseColors[1]}
                        strokeWidth="1.5"
                        strokeLinejoin="miter"
                        opacity={visibleFields.Resultant ? 0.6 : 0.95}
                      />
                    </g>
                  )}
                  {/* Phase A Field Staircase */}
                  {visibleFields.A && (
                    <g>
                      <path
                        d={getStairFillPath(phaseFieldMmf.mmfA)}
                        fill="rgba(239, 68, 68, 0.08)"
                        stroke="none"
                        opacity={visibleFields.Resultant ? 0.6 : 0.95}
                      />
                      <path
                        d={getStairpath(phaseFieldMmf.mmfA)}
                        fill="none"
                        stroke={phaseColors[0]}
                        strokeWidth="1.5"
                        strokeLinejoin="miter"
                        opacity={visibleFields.Resultant ? 0.6 : 0.95}
                      />
                    </g>
                  )}
                  {/* Resultant Field Staircase (Thick & Glowing) */}
                  {visibleFields.Resultant && (
                    <g>
                      <path
                        d={getStairFillPath(mmfResult.mmf)}
                        fill="rgba(245, 158, 11, 0.05)"
                        stroke="none"
                      />
                      <path
                        d={getStairpath(mmfResult.mmf)}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.8"
                        strokeLinejoin="miter"
                        style={{ filter: 'drop-shadow(0px 0px 3.5px rgba(245, 158, 11, 0.35))' }}
                      />
                      <path
                        d={getStairpath(mmfResult.mmf)}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="0.8"
                        strokeLinejoin="miter"
                        opacity="0.35"
                      />
                    </g>
                  )}
                </g>
              )}

              {/* Render Vector Arrows on top if visible */}
              {(fieldDisplayStyle === 'vectors' || fieldDisplayStyle === 'both') && (
                <g>
                  {slotData.map((slot) => {
                    const s = slot.slotIdx;
                    const slotCenterX = slot.x;
                    const staggerWidth = slotWidth * 0.22;
                    
                    const arrows = [];
                    
                    if (visibleFields.A) {
                      arrows.push({
                        x: slotCenterX - staggerWidth,
                        val: phaseFieldMmf.mmfA[s],
                        color: phaseColors[0],
                        width: 2.0,
                        size: 3.2
                      });
                    }
                    if (visibleFields.B) {
                      arrows.push({
                        x: slotCenterX,
                        val: phaseFieldMmf.mmfB[s],
                        color: phaseColors[1],
                        width: 2.0,
                        size: 3.2
                      });
                    }
                    if (visibleFields.C) {
                      arrows.push({
                        x: slotCenterX + staggerWidth,
                        val: phaseFieldMmf.mmfC[s],
                        color: phaseColors[2],
                        width: 2.0,
                        size: 3.2
                      });
                    }
                    if (visibleFields.Resultant) {
                      arrows.push({
                        x: slotCenterX,
                        val: mmfResult.mmf[s],
                        color: '#f59e0b',
                        width: 3.2,
                        size: 4.8,
                        glow: true
                      });
                    }

                    return (
                      <g key={`slot-arrows-${s}`}>
                        {arrows.map((arr, arrIdx) => {
                          const dy = -arr.val * yScale;
                          if (Math.abs(dy) < 1.0) return null;
                          
                          const yVal = yBaseline + dy;
                          const sign = Math.sign(dy); // -1 is UP (dy < 0), 1 is DOWN (dy > 0)
                          const tipX = arr.x;
                          const tipY = yVal;
                          const headSize = arr.size;
                          
                          const arrowPoints = sign < 0
                            ? `${tipX},${tipY} ${tipX - headSize},${tipY + headSize * 1.6} ${tipX + headSize},${tipY + headSize * 1.6}`
                            : `${tipX},${tipY} ${tipX - headSize},${tipY - headSize * 1.6} ${tipX + headSize},${tipY - headSize * 1.6}`;

                          return (
                            <g key={`arrow-${s}-${arrIdx}`} opacity={arr.glow ? 1 : 0.85}>
                              {arr.glow && (
                                <line
                                  x1={arr.x}
                                  y1={yBaseline}
                                  x2={arr.x}
                                  y2={yVal}
                                  stroke={arr.color}
                                  strokeWidth={arr.width + 2}
                                  strokeLinecap="round"
                                  opacity="0.3"
                                  style={{ filter: 'blur(1.5px)' }}
                                />
                              )}
                              <line
                                x1={arr.x}
                                y1={yBaseline}
                                x2={arr.x}
                                y2={yVal}
                                stroke={arr.color}
                                strokeWidth={arr.width}
                                strokeLinecap="round"
                              />
                              <polygon
                                points={arrowPoints}
                                fill={arr.color}
                                stroke="none"
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Hover information bubble inside Field Visualizer */}
              {hoveredSlot !== null && (() => {
                const s = hoveredSlot;
                const slotCenterX = slotData[s].x;
                
                const valA = phaseFieldMmf.mmfA[s];
                const valB = phaseFieldMmf.mmfB[s];
                const valC = phaseFieldMmf.mmfC[s];
                const valRes = mmfResult.mmf[s];

                const tooltipW = 210;
                const tooltipH = 50;
                const alignLeft = slotCenterX > width / 2;
                const toolX = alignLeft ? Math.max(marginX, slotCenterX - tooltipW - 10) : Math.min(width - marginX - tooltipW, slotCenterX + 10);

                return (
                  <g className="pointer-events-none">
                    <rect
                      x={toolX}
                      y={10}
                      width={tooltipW}
                      height={tooltipH}
                      fill="#030712"
                      stroke="#4b5563"
                      strokeWidth="1"
                      rx="4"
                      opacity="0.95"
                    />
                    <text
                      x={toolX + 10}
                      y={23}
                      className="fill-gray-300 text-[8.5px] font-mono"
                    >
                      Slot {s + 1} Local MMF (Amp-Turns):
                    </text>
                    <text
                      x={toolX + 10}
                      y={36}
                      className="fill-gray-300 text-[8.5px] font-mono"
                    >
                      <tspan fill={phaseColors[0]}>A: {valA.toFixed(1)}</tspan> |{' '}
                      <tspan fill={phaseColors[1]}>B: {valB.toFixed(1)}</tspan> |{' '}
                      <tspan fill={phaseColors[2]}>C: {valC.toFixed(1)}</tspan>
                    </text>
                    <text
                      x={toolX + 10}
                      y={49}
                      className="fill-amber-400 text-[8.5px] font-mono font-bold"
                    >
                      Resultant MMF: {valRes.toFixed(1)} AT
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        )}

        <div className="transition-all duration-300 ease-in-out">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[750px] h-auto select-none transition-all duration-300 ease-in-out"
          >
            {diagramMode === 'crossSection' ? (
              // ORIGINAL CROSS SECTION VIEW
              <g>
                {slotData.map((slot) => (
                  <g
                    key={`tooth-${slot.slotIdx}`}
                    onMouseEnter={() => setHoveredSlot(slot.slotIdx)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    className="cursor-pointer"
                  >
                    {/* Highlight active hovered column */}
                    <rect
                      x={marginX + slot.slotIdx * slotWidth}
                      y={10}
                      width={slotWidth}
                      height={130}
                      fill={hoveredSlot === slot.slotIdx ? 'rgba(30, 41, 59, 0.45)' : 'transparent'}
                      stroke={hoveredSlot === slot.slotIdx ? 'rgba(245, 158, 11, 0.15)' : 'none'}
                      rx="4"
                    />

                    {/* Slot core box */}
                    {(() => {
                      const padX = Math.max(1.2, Math.min(4.0, slotWidth * 0.12));
                      return (
                        <rect
                          x={marginX + slot.slotIdx * slotWidth + padX}
                          y={30}
                          width={slotWidth - 2 * padX}
                          height={80}
                          fill="#030712"
                          stroke="#1e293b"
                          strokeWidth="1.5"
                          rx="3"
                        />
                      );
                    })()}

                    {/* Top Layer slot circle */}
                    {(() => {
                      const rVal = Math.min(11, slotWidth * 0.38);
                      return (
                        <>
                          <g transform={`translate(${slot.x}, ${yTopLayer})`}>
                            <circle
                              r={rVal}
                              fill={activePhases[slot.top.phase] ? phaseColors[slot.top.phase] : '#1e293b'}
                              opacity={activePhases[slot.top.phase] ? (0.35 + 0.65 * (Math.abs(slot.top.current) / Math.max(0.1, settings.amplitude))) : 0.08}
                              stroke="#ffffff"
                              strokeWidth={hoveredSlot === slot.slotIdx && activePhases[slot.top.phase] ? '1.5' : '0.5'}
                            />
                            {activePhases[slot.top.phase] && renderArrow(slot.top.current, rVal)}
                          </g>
       
                          {/* Bottom Layer slot circle */}
                          <g transform={`translate(${slot.x}, ${yBotLayer})`}>
                            <circle
                              r={rVal}
                              fill={activePhases[slot.bottom.phase] ? phaseColors[slot.bottom.phase] : '#1e293b'}
                              opacity={activePhases[slot.bottom.phase] ? (0.35 + 0.65 * (Math.abs(slot.bottom.current) / Math.max(0.1, settings.amplitude))) : 0.08}
                              stroke="#ffffff"
                              strokeWidth="0.5"
                            />
                            {activePhases[slot.bottom.phase] && renderArrow(slot.bottom.current, rVal)}
                          </g>
                        </>
                      );
                    })()}

                    {/* Slot Number Label */}
                    <text
                      x={slot.x}
                      y={124}
                      className="fill-gray-400 font-mono text-[9px] font-semibold"
                      textAnchor="middle"
                    >
                      {slot.slotIdx + 1}
                    </text>
                  </g>
                ))}

                {/* LAYER LABELS */}
                <text x={8} y={yTopLayer + 3} className="fill-gray-500 font-mono text-[9px] font-bold" textAnchor="start">T</text>
                <text x={8} y={yBotLayer + 3} className="fill-gray-500 font-mono text-[9px] font-bold" textAnchor="start">B</text>

                {/* DYNAMIC COIL WIRE BRIDGE */}
                {hoveredSlot !== null && (() => {
                  const startX = slotData[hoveredSlot].x;
                  const targetSlotIdx = (hoveredSlot + pitch) % S;
                  const endX = slotData[targetSlotIdx].x;

                  const tPhase = slotData[hoveredSlot].top.phase;
                  if (!activePhases[tPhase]) return null;
                  const color = phaseColors[tPhase];
                  const isWrapping = targetSlotIdx < hoveredSlot;

                  let pathD = '';
                  if (!isWrapping) {
                    pathD = `M ${startX} ${yTopLayer} C ${startX} ${yTopLayer - 32}, ${endX} ${yBotLayer - 82}, ${endX} ${yBotLayer}`;
                  } else {
                    const borderLeftX = marginX;
                    const borderRightX = width - marginX;
                    pathD = `
                      M ${startX} ${yTopLayer} C ${startX} ${yTopLayer - 32}, ${borderRightX} ${yTopLayer - 32}, ${borderRightX} ${yTopLayer - 12}
                      M ${borderLeftX} ${yBotLayer - 12} C ${borderLeftX} ${yBotLayer - 32}, ${endX} ${yBotLayer - 32}, ${endX} ${yBotLayer}
                    `;
                  }

                  return (
                    <g>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        opacity="0.9"
                        className="animate-pulse"
                        style={{ filter: 'drop-shadow(0px 0px 4px ' + color + ')' }}
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1"
                        strokeLinecap="round"
                        opacity="1"
                      />

                      <rect
                        x={Math.max(marginX, (startX + endX) / 2 - 50)}
                        y={13}
                        width="100"
                        height="14"
                        fill="#090d16"
                        stroke={color}
                        strokeWidth="1"
                        rx="3"
                      />
                      <text
                        x={(startX + endX) / 2}
                        y={23}
                        className="fill-white text-[8px] font-sans text-center font-bold"
                        textAnchor="middle"
                      >
                        {phaseNames[tPhase]} Coil: {hoveredSlot + 1} ➔ {targetSlotIdx + 1}
                      </text>
                    </g>
                  );
                })()}
              </g>
            ) : (
              // HIGHLY ACCURATE INTERACTIVE THREE-PHASE CONTINUOUS LAP WINDING
              <g>
                {/* 1. Stator core backplate representing horizontal cylinder unrolled */}
                <rect
                  x={marginX - 10}
                  y={yTopLayer + 10}
                  width={width - 2 * marginX + 20}
                  height={yBotLayer - yTopLayer + 40}
                  fill="#0e1322"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                  rx="6"
                />

                {/* 2. Tooth slots cavities with interactive hover and indicator dots */}
                {slotData.map((slot) => {
                  const padX = Math.max(1.0, Math.min(3.0, slotWidth * 0.1));
                  return (
                    <rect
                      key={`slot-bg-${slot.slotIdx}`}
                      x={marginX + slot.slotIdx * slotWidth + padX}
                      y={yTopLayer + 15}
                      width={slotWidth - 2 * padX}
                      height={yBotLayer - yTopLayer + 30}
                      fill="#030712"
                      stroke={hoveredSlot === slot.slotIdx ? 'rgba(247, 185, 34, 0.45)' : '#1e293b'}
                      strokeWidth={hoveredSlot === slot.slotIdx ? '1.5' : '1'}
                      rx="3"
                      onMouseEnter={() => setHoveredSlot(slot.slotIdx)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      className="cursor-pointer transition-all duration-150"
                    />
                  );
                })}

                {/* 3. Slot copper conductor background visual indicators (thick cylinders) */}
                {slotData.map((slot) => {
                  const s = slot.slotIdx;
                  const slotCenterX = marginX + s * slotWidth + slotWidth / 2;
                  const dxOff = Math.max(1.8, Math.min(6.0, slotWidth * 0.18));
                  const x_top = slotCenterX - dxOff;
                  const x_bot = slotCenterX + dxOff;

                  const isTopActive = activePhases[slot.top.phase];
                  const isBotActive = activePhases[slot.bottom.phase];
                  const condStrokeWidth = Math.max(1.5, Math.min(3.5, slotWidth * 0.14));

                  return (
                    <g key={`static-cond-${s}`} opacity="0.15" className="pointer-events-none">
                      {isTopActive && (
                        <line
                          x1={x_top}
                          y1={yTopLayer + 15}
                          x2={x_top}
                          y2={yBotLayer + 45}
                          stroke={phaseColors[slot.top.phase]}
                          strokeWidth={condStrokeWidth}
                          strokeLinecap="round"
                        />
                      )}
                      {isBotActive && (
                        <line
                          x1={x_bot}
                          y1={yTopLayer + 15}
                          x2={x_bot}
                          y2={yBotLayer + 45}
                          stroke={phaseColors[slot.bottom.phase]}
                          strokeWidth={condStrokeWidth}
                          strokeLinecap="round"
                        />
                      )}
                    </g>
                  );
                })}

                {/* 4. Continuous Winding Curves and Dash current particles */}
                {(() => {
                  const Y_slotTop = yTopLayer + 15;
                  const Y_slotBottom = yBotLayer + 45;
                  const Y_bendTop = Y_slotTop - 12;
                  const Y_bendBottom = Y_slotBottom + 12;
                  const circumference = width - 2 * marginX;

                  const getConductorX = (s: number, layer: 'top' | 'bottom') => {
                    const slotCenterX = marginX + s * slotWidth + slotWidth / 2;
                    const dxOff = Math.max(1.8, Math.min(6.0, slotWidth * 0.18));
                    return layer === 'top' ? slotCenterX - dxOff : slotCenterX + dxOff;
                  };

                  // Precompute terminals for active phases
                  const terminals = [0, 1, 2].map((p) => {
                    const S_p: number[] = [];
                    for (let s = 0; s < S; s++) {
                      if (layout.topPhase[s] === p) S_p.push(s);
                    }
                    const belts: number[][] = [];
                    const q_slots = layout.q;
                    for (let i = 0; i < S_p.length; i += q_slots) {
                      belts.push(S_p.slice(i, i + q_slots));
                    }
                    if (belts.length === 0) return null;

                    const firstBelt = belts[0];
                    const firstSign = layout.topSign[firstBelt[0]];
                    const entryX = firstSign === 1
                      ? getConductorX(firstBelt[0], 'top')
                      : getConductorX((firstBelt[q_slots - 1] + pitch) % S, 'bottom');

                    const lastBelt = belts[belts.length - 1];
                    const lastSign = layout.topSign[lastBelt[0]];
                    const exitX = lastSign === 1
                      ? getConductorX((lastBelt[q_slots - 1] + pitch) % S, 'bottom')
                      : getConductorX(lastBelt[0], 'top');

                    return { p, entryX, exitX, active: activePhases[p] };
                  }).filter((t): t is { p: number; entryX: number; exitX: number; active: boolean } => t !== null);

                  interface Segment {
                    x1: number;
                    y1: number;
                    x2: number;
                    y2: number;
                  }

                  function clipSegmentSingle(
                    xa: number,
                    ya: number,
                    xb: number,
                    yb: number,
                    xMin: number,
                    xMax: number
                  ): Segment | null {
                    if ((xa < xMin && xb < xMin) || (xa > xMax && xb > xMax)) return null;
                    let x1 = xa;
                    let y1 = ya;
                    let x2 = xb;
                    let y2 = yb;
                    if (x1 < xMin) {
                      y1 = y1 + ((y2 - y1) * (xMin - x1)) / (x2 - x1);
                      x1 = xMin;
                    } else if (x1 > xMax) {
                      y1 = y1 + ((y2 - y1) * (xMax - x1)) / (x2 - x1);
                      x1 = xMax;
                    }
                    if (x2 < xMin) {
                      y2 = y1 + ((y2 - y1) * (xMin - x1)) / (x2 - x1);
                      x2 = xMin;
                    } else if (x2 > xMax) {
                      y2 = y1 + ((y2 - y1) * (xMax - x1)) / (x2 - x1);
                      x2 = xMax;
                    }
                    return { x1, y1, x2, y2 };
                  }

                  function getClippedPeakPath(
                    xa: number,
                    ya: number,
                    xPeak: number,
                    yPeak: number,
                    xc: number,
                    yc: number,
                    xMin: number,
                    xMax: number,
                    W_circ: number,
                    isWrapping: boolean
                  ): string {
                    if (pathStyle === 'orthogonal') {
                      if (!isWrapping) {
                        return `L ${xa.toFixed(1)} ${yPeak.toFixed(1)} L ${xc.toFixed(1)} ${yPeak.toFixed(1)} L ${xc.toFixed(1)} ${yc.toFixed(1)}`;
                      } else {
                        // Wrapping orthogonal paths
                        let x_left = xa;
                        let x_right = xc;
                        let y_left = ya;
                        let y_right = yc;
                        let isForward = true;
                        if (xa > xc) {
                          x_left = xc;
                          x_right = xa;
                          y_left = yc;
                          y_right = ya;
                          isForward = false;
                        }
                        if (isForward) {
                          return `L ${x_left.toFixed(1)} ${yPeak.toFixed(1)} L ${xMin.toFixed(1)} ${yPeak.toFixed(1)} M ${xMax.toFixed(1)} ${yPeak.toFixed(1)} L ${x_right.toFixed(1)} ${yPeak.toFixed(1)} L ${x_right.toFixed(1)} ${y_right.toFixed(1)}`;
                        } else {
                          return `L ${x_right.toFixed(1)} ${yPeak.toFixed(1)} L ${xMax.toFixed(1)} ${yPeak.toFixed(1)} M ${xMin.toFixed(1)} ${yPeak.toFixed(1)} L ${x_left.toFixed(1)} ${yPeak.toFixed(1)} L ${x_left.toFixed(1)} ${y_left.toFixed(1)}`;
                        }
                      }
                    }

                    if (!isWrapping) {
                      return `L ${xa} ${ya} L ${xPeak} ${yPeak} L ${xc} ${yc}`;
                    } else {
                      // Wrapping peak
                      let x_left = xa;
                      let x_right = xc;
                      let y_left = ya;
                      let y_right = yc;
                      let isForward = true;
                      if (xa > xc) {
                        x_left = xc;
                        x_right = xa;
                        y_left = yc;
                        y_right = ya;
                        isForward = false;
                      }

                      const x_left_virt = x_left + W_circ;
                      const xPeak_virt = (x_right + x_left_virt) / 2;

                      const seg_right = clipSegmentSingle(x_right, y_right, xPeak_virt, yPeak, xMin, xMax);
                      const seg_left_virt = clipSegmentSingle(xPeak_virt, yPeak, x_left_virt, y_left, xMin, xMax);

                      const x_right_shifted = x_right - W_circ;
                      const xPeak_shifted = xPeak_virt - W_circ;
                      const seg_right_shifted = clipSegmentSingle(x_right_shifted, y_right, xPeak_shifted, yPeak, xMin, xMax);
                      const seg_left = clipSegmentSingle(xPeak_shifted, yPeak, x_left, y_left, xMin, xMax);

                      let path = '';
                      if (isForward) {
                        if (seg_right) path += `L ${seg_right.x1} ${seg_right.y1} L ${seg_right.x2} ${seg_right.y2} `;
                        if (seg_left_virt) path += `L ${seg_left_virt.x2} ${seg_left_virt.y2} `;
                        if (seg_right_shifted) {
                          path += `M ${seg_right_shifted.x1} ${seg_right_shifted.y1} L ${seg_right_shifted.x2} ${seg_right_shifted.y2} `;
                        } else if (seg_left) {
                          path += `M ${seg_left.x1} ${seg_left.y1} `;
                        }
                        if (seg_left) path += `L ${seg_left.x2} ${seg_left.y2} `;
                      } else {
                        if (seg_left) path += `L ${seg_left.x2} ${seg_left.y2} L ${seg_left.x1} ${seg_left.y1} `;
                        if (seg_right_shifted) path += `L ${seg_right_shifted.x1} ${seg_right_shifted.y1} `;
                        if (seg_left_virt) {
                          path += `M ${seg_left_virt.x2} ${seg_left_virt.y2} L ${seg_left_virt.x1} ${seg_left_virt.y1} `;
                        } else if (seg_right) {
                          path += `M ${seg_right.x2} ${seg_right.y2} `;
                        }
                        if (seg_right) path += `L ${seg_right.x1} ${seg_right.y1} `;
                      }
                      return path;
                    }
                  }

                  const isPhaseActive = (p: number) => {
                    if (!activePhases[p]) return false;
                    if (hoveredSlot === null) return true;
                    return layout.topPhase[hoveredSlot] === p || layout.bottomPhase[hoveredSlot] === p;
                  };

                  const windingPhaseLines = [0, 1, 2].map((p) => {
                    if (!activePhases[p]) return null;
                    const color = phaseColors[p];
                    const I_p = pCurrents[p];
                    const isActive = isPhaseActive(p);
                    const showParticles = showFlow && Math.abs(I_p) > 0.05 * settings.amplitude;

                    // Compute dynamic opacity
                    const opacity = hoveredSlot === null
                      ? (0.25 + 0.75 * (Math.abs(I_p) / Math.max(0.1, settings.amplitude)))
                      : (isActive ? 1.0 : 0.08);

                    const strokeWidth = isActive ? 2.5 : 1.25;

                    // Let's generate the continuous series path
                    const S_p: number[] = [];
                    for (let s = 0; s < S; s++) {
                      if (layout.topPhase[s] === p) {
                        S_p.push(s);
                      }
                    }

                    const belts: number[][] = [];
                    const q_slots = layout.q;
                    const numCoils = S_p.length;
                    const coilStep = Math.max(1.5, Math.min(4.5, 30.0 / (numCoils || 1)));
                    const phaseStep = (numCoils * coilStep) + 6;

                    for (let i = 0; i < S_p.length; i += q_slots) {
                      belts.push(S_p.slice(i, i + q_slots));
                    }

                    if (belts.length === 0) return null;

                    const jumperStep = Math.max(2.5, Math.min(6.0, 50.0 / belts.length));

                    let d = '';

                    // Traverse belts in series
                    for (let j = 0; j < belts.length; j++) {
                      const B_j = belts[j];
                      const sign = layout.topSign[B_j[0]];

                      if (sign === 1) {
                        for (let i = 0; i < B_j.length; i++) {
                          const s = B_j[i];
                          const s_prime = (s + pitch) % S;
                          const x_top = getConductorX(s, 'top');
                          const x_bot = getConductorX(s_prime, 'bottom');

                          if (i === 0 && j === 0) {
                            d += `M ${x_top.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                          } else if (i === 0) {
                            d += `L ${x_top.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                          }

                          // Conductor UP
                          d += `L ${x_top.toFixed(1)} ${Y_slotTop.toFixed(1)} `;
                          // Neck UP
                          d += `L ${x_top.toFixed(1)} ${Y_bendTop.toFixed(1)} `;

                          // Top Peak
                          const isWrap = (s + pitch) >= S;
                          const x_bot_virt = isWrap ? x_bot + circumference : x_bot;
                          const xPeak = (x_top + x_bot_virt) / 2;
                          const k_coil = S_p.indexOf(s);
                          const yPeak = Y_slotTop - 25 - p * phaseStep - k_coil * coilStep;

                          d += getClippedPeakPath(
                            x_top,
                            Y_bendTop,
                            xPeak,
                            yPeak,
                            x_bot,
                            Y_bendTop,
                            marginX,
                            width - marginX,
                            circumference,
                            isWrap
                          ) + ' ';

                          // Down Neck
                          d += `L ${x_bot.toFixed(1)} ${Y_slotTop.toFixed(1)} `;
                          // Conductor DOWN
                          d += `L ${x_bot.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;

                          // Connect to next slot in belt if any
                          if (i < B_j.length - 1) {
                            const s_next = B_j[i + 1];
                            const x_next_top = getConductorX(s_next, 'top');

                            // Neck DOWN
                            d += `L ${x_bot.toFixed(1)} ${Y_bendBottom.toFixed(1)} `;

                            const isBottomWrap = Math.abs(s_prime - s_next) > S / 2;
                            const x_bot_virt = isBottomWrap ? x_bot + circumference : x_bot;
                            const xPeakBot = (x_next_top + x_bot_virt) / 2;
                            const yPeakBot = Y_slotBottom + 40 + p * phaseStep + i * coilStep;

                            d += getClippedPeakPath(
                              x_bot,
                              Y_bendBottom,
                              xPeakBot,
                              yPeakBot,
                              x_next_top,
                              Y_bendBottom,
                              marginX,
                              width - marginX,
                              circumference,
                              isBottomWrap
                            ) + ' ';

                            d += `L ${x_next_top.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                          }
                        }
                      } else {
                        // Reverse belt: index q_slots-1 down to 0
                        for (let i = B_j.length - 1; i >= 0; i--) {
                          const s = B_j[i];
                          const s_prime = (s + pitch) % S;
                          const x_top = getConductorX(s, 'top');
                          const x_bot = getConductorX(s_prime, 'bottom');

                          if (i === B_j.length - 1 && j === 0) {
                            d += `M ${x_bot.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                          } else if (i === B_j.length - 1) {
                            d += `L ${x_bot.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                          }

                          // Conductor UP
                          d += `L ${x_bot.toFixed(1)} ${Y_slotTop.toFixed(1)} `;
                          // Neck UP
                          d += `L ${x_bot.toFixed(1)} ${Y_bendTop.toFixed(1)} `;

                          // Top Peak
                          const isWrap = (s + pitch) >= S;
                          const x_bot_virt = isWrap ? x_bot + circumference : x_bot;
                          const xPeak = (x_top + x_bot_virt) / 2;
                          const k_coil = S_p.indexOf(s);
                          const yPeak = Y_slotTop - 25 - p * phaseStep - k_coil * coilStep;

                          d += getClippedPeakPath(
                            x_bot,
                            Y_bendTop,
                            xPeak,
                            yPeak,
                            x_top,
                            Y_bendTop,
                            marginX,
                            width - marginX,
                            circumference,
                            isWrap
                          ) + ' ';

                          // Down Neck
                          d += `L ${x_top.toFixed(1)} ${Y_slotTop.toFixed(1)} `;
                          // Conductor DOWN
                          d += `L ${x_top.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;

                          // Connect to next reverse slot in belt
                          if (i > 0) {
                            const s_next = B_j[i - 1];
                            const s_prime_next = (s_next + pitch) % S;
                            const x_prime_next_bot = getConductorX(s_prime_next, 'bottom');

                            // Neck DOWN
                            d += `L ${x_top.toFixed(1)} ${Y_bendBottom.toFixed(1)} `;

                            const isBottomWrap = Math.abs(s - s_prime_next) > S / 2;
                            const x_prime_next_bot_virt = isBottomWrap ? x_prime_next_bot + circumference : x_prime_next_bot;
                            const xPeakBot = (x_top + x_prime_next_bot_virt) / 2;
                            const yPeakBot = Y_slotBottom + 40 + p * phaseStep + i * coilStep;

                            d += getClippedPeakPath(
                              x_top,
                              Y_bendBottom,
                              xPeakBot,
                              yPeakBot,
                              x_prime_next_bot,
                              Y_bendBottom,
                              marginX,
                              width - marginX,
                              circumference,
                              isBottomWrap
                            ) + ' ';

                            d += `L ${x_prime_next_bot.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                          }
                        }
                      }

                      // Staggered bottom Jumper to next pole group belt
                      if (j < belts.length - 1) {
                        const next_B = belts[j + 1];
                        const next_sign = layout.topSign[next_B[0]];

                        const x_exit = sign === 1
                          ? getConductorX((B_j[B_j.length - 1] + pitch) % S, 'bottom')
                          : getConductorX(B_j[0], 'top');

                        const x_entry = next_sign === 1
                          ? getConductorX(next_B[0], 'top')
                          : getConductorX((next_B[next_B.length - 1] + pitch) % S, 'bottom');

                        const y_jumper = Y_slotBottom + 110 + j * jumperStep;

                        d += `L ${x_exit.toFixed(1)} ${y_jumper.toFixed(1)} L ${x_entry.toFixed(1)} ${y_jumper.toFixed(1)} L ${x_entry.toFixed(1)} ${Y_slotBottom.toFixed(1)} `;
                      }
                    }

                    // Terminal entries and exits straight leads down
                    const firstBelt = belts[0];
                    const firstSign = layout.topSign[firstBelt[0]];
                    const entryX = firstSign === 1
                      ? getConductorX(firstBelt[0], 'top')
                      : getConductorX((firstBelt[q_slots - 1] + pitch) % S, 'bottom');

                    const lastBelt = belts[belts.length - 1];
                    const lastSign = layout.topSign[lastBelt[0]];
                    const exitX = lastSign === 1
                      ? getConductorX((lastBelt[q_slots - 1] + pitch) % S, 'bottom')
                      : getConductorX(lastBelt[0], 'top');

                    const isStar = terminalConnection === 'star';
                    const exitY = isStar ? Y_slotBottom + 175 : Y_slotBottom + 210;
                    const terminalY = Y_slotBottom + 210;

                    const pathTerminals = `
                      M ${entryX.toFixed(1)} ${Y_slotBottom.toFixed(1)} L ${entryX.toFixed(1)} ${terminalY.toFixed(1)}
                      M ${exitX.toFixed(1)} ${Y_slotBottom.toFixed(1)} L ${exitX.toFixed(1)} ${exitY.toFixed(1)}
                    `;

                    const phaseLabelStart = p === 0 ? 'U1' : p === 1 ? 'V1' : 'W1';
                    const phaseLabelEnd = p === 0 ? 'U2' : p === 1 ? 'V2' : 'W2';

                    // Particle velocity offset
                    const flowVelocity = -settings.time * 50 * Math.sign(I_p);

                    return (
                      <g key={`phase-continuous-${p}`} opacity={opacity} className="transition-all duration-300">
                        {/* Glow outline underlay */}
                        {isActive && (
                          <path
                            d={d}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth + 3}
                            strokeLinecap="round"
                            opacity={0.35}
                            style={{ filter: 'blur(3px)' }}
                          />
                        )}

                        {/* Sturdy backbone copper line */}
                        <path
                          d={d}
                          fill="none"
                          stroke={color}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                        />

                        {/* Inner highlight core */}
                        <path
                          d={d}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={strokeWidth * 0.4}
                          strokeLinecap="round"
                          opacity={0.6}
                        />

                        {/* Terminal Lead Wires */}
                        <path
                          d={pathTerminals}
                          fill="none"
                          stroke={color}
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                        />
                        <path
                          d={pathTerminals}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={strokeWidth * 0.4}
                          strokeLinecap="round"
                          opacity={0.6}
                        />

                        {/* Animated Current Particle Dots */}
                        {showParticles && (
                          <g>
                            <path
                              d={d}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={strokeWidth * 1.5}
                              strokeDasharray="5, 30"
                              strokeDashoffset={flowVelocity}
                              strokeLinecap="round"
                              opacity="0.75"
                            />
                            <path
                              d={pathTerminals}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={strokeWidth * 1.5}
                              strokeDasharray="5, 30"
                              strokeDashoffset={flowVelocity}
                              strokeLinecap="round"
                              opacity="0.75"
                            />
                          </g>
                        )}

                        {/* Terminal nodes circle and text tags */}
                        {/* Start Terminal */}
                        <g transform={`translate(${entryX}, ${terminalY})`}>
                          <circle r="4.5" fill={color} stroke="#ffffff" strokeWidth="1" />
                          <circle r="1.5" fill="#ffffff" />
                          <text
                            y="16"
                            className="fill-white font-mono text-[9px] font-bold select-none text-center"
                            textAnchor="middle"
                          >
                            {phaseLabelStart}
                          </text>
                        </g>

                        {/* End Terminal */}
                        {!isStar && (
                          <g transform={`translate(${exitX}, ${terminalY})`}>
                            <circle r="4.5" fill={color} stroke="#ffffff" strokeWidth="1" />
                            <circle r="1.5" fill="#ffffff" />
                            <text
                              y="16"
                              className="fill-white font-mono text-[9px] font-bold select-none text-center"
                              textAnchor="middle"
                            >
                              {phaseLabelEnd}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  });

                  return (
                    <>
                      {windingPhaseLines}
                      {diagramMode === 'lapWinding' && terminalConnection === 'star' && (() => {
                        const activeTerms = terminals.filter((t) => t.active);
                        if (activeTerms.length === 0) return null;

                        const neutralY = Y_slotBottom + 175;
                        const terminalY = Y_slotBottom + 210;
                        const neutralX = width / 2;

                        const exitXs = activeTerms.map((t) => t.exitX);
                        const minX = Math.min(...exitXs);
                        const maxX = Math.max(...exitXs);

                        // Average current for flow in neutral wire
                        const activePhaseIndices = activeTerms.map((t) => t.p);
                        const sumCurrent = activePhaseIndices.reduce((sum, pIdx) => sum + pCurrents[pIdx], 0);

                        const flowVelocityNeutral = -settings.time * 50 * Math.sign(sumCurrent);
                        const showNeutralFlow = showFlow && Math.abs(sumCurrent) > 0.05 * settings.amplitude;

                        // Paths
                        const pathBusBar = `M ${minX.toFixed(1)} ${neutralY.toFixed(1)} L ${maxX.toFixed(1)} ${neutralY.toFixed(1)}`;
                        const pathNeutralLead = `M ${neutralX.toFixed(1)} ${neutralY.toFixed(1)} L ${neutralX.toFixed(1)} ${terminalY.toFixed(1)}`;

                        return (
                          <g key="neutral-connection-system" className="transition-all duration-300">
                            {/* Glow background */}
                            <path
                              d={pathBusBar}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="5"
                              strokeLinecap="round"
                              opacity="0.2"
                              style={{ filter: 'blur(3.2px)' }}
                            />
                            <path
                              d={pathNeutralLead}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="5"
                              strokeLinecap="round"
                              opacity="0.2"
                              style={{ filter: 'blur(3.2px)' }}
                            />

                            {/* Actual lines */}
                            <path
                              d={pathBusBar}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <path
                              d={pathNeutralLead}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />

                            {/* White core highlight */}
                            <path
                              d={pathBusBar}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="1"
                              strokeLinecap="round"
                              opacity="0.5"
                            />
                            <path
                              d={pathNeutralLead}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="1"
                              strokeLinecap="round"
                              opacity="0.5"
                            />

                            {/* Junction Dots where phase exit leads tap into the neutral bus bar */}
                            {activeTerms.map((t) => (
                              <circle
                                key={`tap-${t.p}`}
                                cx={t.exitX}
                                cy={neutralY}
                                r="4"
                                fill={phaseColors[t.p]}
                                stroke="#ffffff"
                                strokeWidth="1"
                                title={`Short-circuit node for ${phaseNames[t.p]}`}
                              />
                            ))}

                            {/* Animated Flow in neutral line */}
                            {showNeutralFlow && (
                              <g>
                                <path
                                  d={pathBusBar}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeWidth="3.5"
                                  strokeDasharray="5, 25"
                                  strokeDashoffset={flowVelocityNeutral}
                                  strokeLinecap="round"
                                  opacity="0.8"
                                />
                                <path
                                  d={pathNeutralLead}
                                  fill="none"
                                  stroke="#ffffff"
                                  strokeWidth="3.5"
                                  strokeDasharray="5, 25"
                                  strokeDashoffset={flowVelocityNeutral}
                                  strokeLinecap="round"
                                  opacity="0.8"
                                />
                              </g>
                            )}

                            {/* Common Neutral node circle */}
                            <g transform={`translate(${neutralX}, ${terminalY})`}>
                              <circle r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" className="animate-pulse" />
                              <circle r="2" fill="#ffffff" />
                              <text
                                y="18"
                                className="fill-amber-400 font-mono text-[9px] font-extrabold select-none text-center"
                                textAnchor="middle"
                              >
                                N (Neutral Star Point)
                              </text>
                            </g>
                          </g>
                        );
                      })()}
                    </>
                  );
                })()}

                {/* 5. Slot numbering text labels */}
                {slotData.map((slot) => {
                  const s = slot.slotIdx;
                  return (
                    <text
                      key={`slot-num-${s}`}
                      x={slot.x}
                      y={yTopLayer - 8}
                      className="fill-gray-400 font-mono text-[9px] font-semibold"
                      textAnchor="middle"
                    >
                      {s + 1}
                    </text>
                  );
                })}

                {/* 6. Active conductor layer tags */}
                <g opacity="0.6">
                  <rect x={2} y={yTopLayer + 22} width={15} height={16} fill="#0d0e12" rx="3" className="stroke-gray-800 stroke-[0.5]" />
                  <text x={9} y={yTopLayer + 33} className="fill-gray-400 font-mono text-[8.5px] font-bold" textAnchor="middle">T</text>

                  <rect x={2} y={yBotLayer + 22} width={15} height={16} fill="#0d0e12" rx="3" className="stroke-gray-800 stroke-[0.5]" />
                  <text x={9} y={yBotLayer + 33} className="fill-gray-400 font-mono text-[8.5px] font-bold" textAnchor="middle">B</text>
                </g>

                {/* 7. Hover informative connection bubble tag */}
                {hoveredSlot !== null && (() => {
                  const targetSlotIdx = (hoveredSlot + pitch) % S;
                  const tPhase = slotData[hoveredSlot].top.phase;
                  const color = phaseColors[tPhase];

                  return (
                    <g className="pointer-events-none">
                      <rect
                        x={25}
                        y={14}
                        width={210}
                        height={24}
                        fill="#030712"
                        stroke={color}
                        strokeWidth="1"
                        rx="4"
                      />
                      <text
                        x={35}
                        y={29}
                        className="fill-gray-200 text-[9px] font-sans font-medium"
                      >
                        Active Coil: <tspan className="fill-white font-bold" style={{ fill: color }}>{phaseNames[tPhase]}</tspan> (Slot {hoveredSlot + 1} ➔ {targetSlotIdx + 1})
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

