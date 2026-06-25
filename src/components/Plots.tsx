/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { WindingLayout, SimSettings, MmfResult, HarmonicItem } from '../types';

interface PlotsProps {
  layout: WindingLayout;
  settings: SimSettings;
  mmf: MmfResult;
  harmonics: HarmonicItem[];
  onToggleFullscreen?: () => void;
}

export const Plots: React.FC<PlotsProps> = ({
  layout,
  settings,
  mmf,
  harmonics,
  onToggleFullscreen,
}) => {
  const [activeTab, setActiveTab] = useState<'spatial' | 'harmonics' | 'currents'>('spatial');

  const S = layout.slots;
  const P = layout.poles;
  const p = P / 2;

  // Chart Dimensions
  const w = 540;
  const h = 260;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  // 1. Spatial MMF Plot computations
  const renderSpatialMmfPlot = () => {
    const yMaxLimit = Math.max(0.5, mmf.mmfMax * 1.25);
    
    // Scale functions
    const xToPx = (angleRad: number) => paddingLeft + (angleRad / (2 * Math.PI)) * chartW;
    const yToPx = (val: number) => paddingTop + chartH / 2 - (val / yMaxLimit) * (chartH / 2);

    // Build Staircase Plot Path
    // The intervals are: s = 0 to S-1. Angle is s * 2pi/S to (s+1)*2pi/S
    const stairPathPts = [];
    const dTheta = (2 * Math.PI) / S;

    for (let s = 0; s < S; s++) {
      const angleStart = s * dTheta;
      const angleEnd = (s + 1) * dTheta;
      const value = mmf.mmf[s];

      const x1 = xToPx(angleStart);
      const x2 = xToPx(angleEnd);
      const y = yToPx(value);

      if (s === 0) {
        stairPathPts.push(`M ${x1} ${y}`);
      } else {
        // Vertical step jump
        const prevValue = mmf.mmf[s - 1];
        stairPathPts.push(`L ${x1} ${yToPx(prevValue)}`);
        stairPathPts.push(`L ${x1} ${y}`);
      }
      stairPathPts.push(`L ${x2} ${y}`);
    }
    
    // Final jump back to first step
    stairPathPts.push(`L ${xToPx(2 * Math.PI)} ${yToPx(mmf.mmf[0])}`);
    const stairPath = stairPathPts.join(' ');

    // Fill underneath the staircase for an elegant glowing effect
    const stairFillPts = [
      `M ${xToPx(0)} ${yToPx(0)}`,
      ...stairPathPts,
      `L ${xToPx(2 * Math.PI)} ${yToPx(0)}`,
      'Z'
    ];
    const stairFillPath = stairFillPts.join(' ');

    // Smooth fundamental path mapping
    const fundPts = [];
    const resolution = 180;
    for (let i = 0; i <= resolution; i++) {
      const theta = (i * 2 * Math.PI) / resolution;
      const val = mmf.fundamentalA * Math.cos(p * theta) + mmf.fundamentalB * Math.sin(p * theta);
      fundPts.push(`${i === 0 ? 'M' : 'L'} ${xToPx(theta)} ${yToPx(val)}`);
    }
    const fundamentalPath = fundPts.join(' ');

    return (
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2 font-mono">
          <span>X: Mechanical Angle (deg)</span>
          <span>Y: Stator MMF (Amp-Turns)</span>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto select-none">
          {/* Grid lines */}
          <line x1={paddingLeft} y1={paddingTop + chartH / 2} x2={paddingLeft + chartW} y2={paddingTop + chartH / 2} stroke="#334155" strokeWidth="1" />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartH} stroke="#1e293b" strokeWidth="1.5" />
          <line x1={paddingLeft + chartW} y1={paddingTop} x2={paddingLeft + chartW} y2={paddingTop + chartH} stroke="#1e293b" strokeWidth="1" />

          {/* Core Y-axis grid ticks */}
          {[-1, -0.5, 0.5, 1].map((ratio) => {
            const vVal = ratio * mmf.mmfMax;
            const yPx = yToPx(vVal);
            return (
              <g key={`y-grid-${ratio}`} className="opacity-40">
                <line x1={paddingLeft} y1={yPx} x2={paddingLeft + chartW} y2={yPx} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={yPx + 3.5} className="fill-gray-400 font-mono text-[9px]" textAnchor="end">
                  {vVal.toFixed(1)}
                </text>
              </g>
            );
          })}
          <text x={paddingLeft - 8} y={yToPx(0) + 3.5} className="fill-gray-400 font-mono text-[9px]" textAnchor="end">0.0</text>

          {/* X-axis ticks (Mechanical degrees: 0, 90, 180, 270, 360) */}
          {[0, 90, 180, 270, 360].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const xPx = xToPx(rad);
            return (
              <g key={`x-tick-${deg}`} className="opacity-90">
                <line x1={xPx} y1={paddingTop + chartH} x2={xPx} y2={paddingTop + chartH + 5} stroke="#334155" strokeWidth="1.2" />
                <text x={xPx} y={paddingTop + chartH + 16} className="fill-gray-400 font-mono text-[9px]" textAnchor="middle">
                  {deg}°
                </text>
              </g>
            );
          })}

          {/* Fill beneath staircase */}
          <path d={stairFillPath} fill="rgba(245, 158, 11, 0.05)" stroke="none" />

          {/* Actual MMF Stair-series path */}
          <path d={stairPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="miter" style={{ filter: 'drop-shadow(0px 0px 3px rgba(245, 158, 11, 0.45))' }} />

          {/* Fundamental sinus sweep */}
          <path d={fundamentalPath} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="5 3" />

          {/* Zero markers */}
          <circle cx={xToPx(0)} cy={yToPx(0)} r="2.5" fill="#f59e0b" />
          <circle cx={xToPx(2 * Math.PI)} cy={yToPx(0)} r="2.5" fill="#f59e0b" />
        </svg>
      </div>
    );
  };

  // 2. Harmonics Spectrum Plot computations
  const renderHarmonicsPlot = () => {
    const barsCount = harmonics.length;
    const barWidth = Math.min(32, chartW / barsCount - 12);
    const spacing = (chartW - barWidth * barsCount) / (barsCount + 1);

    const maxPercent = Math.max(10, ...harmonics.map((h) => h.percentage));
    const doubleMaxLimit = maxPercent * 1.1; // adding buffer

    const hToPx = (pct: number) => paddingTop + chartH - (pct / doubleMaxLimit) * chartH;

    return (
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2 font-mono">
          <span>X: Harmonic Order (h, Electrical)</span>
          <span>Y: Amplitude (% of Fundamental)</span>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto select-none">
          {/* Base Axis lines */}
          <line x1={paddingLeft} y1={paddingTop + chartH} x2={paddingLeft + chartW} y2={paddingTop + chartH} stroke="#334155" strokeWidth="1.5" />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartH} stroke="#1e293b" strokeWidth="1.5" />

          {/* Percent grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const yPx = hToPx(pct);
            if (pct > doubleMaxLimit) return null;
            return (
              <g key={`pct-grid-${pct}`} className="opacity-40">
                <line x1={paddingLeft} y1={yPx} x2={paddingLeft + chartW} y2={yPx} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={yPx + 3.5} className="fill-gray-400 font-mono text-[9px]" textAnchor="end">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {harmonics.map((item, index) => {
            const barX = paddingLeft + spacing + index * (barWidth + spacing);
            const barHeight = (item.percentage / doubleMaxLimit) * chartH;
            const barY = paddingTop + chartH - barHeight;

            // Rotation colors: Red=Backward, Green=Forward, Grey=Stationary/Abserved
            let color = '#94a3b8'; // Slate
            let border = '#cbcbcb';
            if (item.order === 1) {
              color = '#f59e0b'; // Gold for fundamental
              border = '#fbbf24';
            } else if (item.direction === 'Forward') {
              color = '#10b981'; // Emerald Green
              border = '#34d399';
            } else if (item.direction === 'Backward') {
              color = '#ef4444'; // Coral Red
              border = '#fca5a5';
            }

            return (
              <g key={`harmonic-bar-${item.order}`}>
                {/* Visual bar rect */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(2, barHeight)} // Minimum 2px height
                  fill={color}
                  stroke={border}
                  strokeWidth="0.5"
                  rx="2"
                  opacity={item.percentage < 0.05 ? 0.15 : 0.85}
                  className="transition-all duration-300 hover:opacity-100"
                />

                {/* Percentage Text value above the bar */}
                {item.percentage > 0.5 && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 5}
                    className="fill-gray-300 font-mono text-[8px] font-bold"
                    textAnchor="middle"
                  >
                    {item.percentage.toFixed(1)}%
                  </text>
                )}

                {/* Harmonic label under X-axis */}
                <text
                  x={barX + barWidth / 2}
                  y={paddingTop + chartH + 14}
                  className="fill-gray-400 font-mono text-[9px] font-semibold"
                  textAnchor="middle"
                >
                  h{item.order}
                </text>
                {/* Mechanical spacing sub-label (n = h*p) */}
                <text
                  x={barX + barWidth / 2}
                  y={paddingTop + chartH + 24}
                  className="fill-gray-500 font-mono text-[7.5px]"
                  textAnchor="middle"
                >
                  (n={item.mechanicalOrder})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // 3. Time Domain scrolling Oscilloscope Plot computations
  const renderCurrentsPlot = () => {
    // Generate currents over 2 full cycles (720 electrical degrees)
    const cyclesCount = 2;
    const maxAngle = cyclesCount * 360; // 720 deg
    const pointsCount = 180;

    const omega = 2 * Math.PI * settings.frequency;
    const currentThetaRad = (omega * settings.time) % (2 * Math.PI * cyclesCount);

    const cToX = (thetaDeg: number) => paddingLeft + (thetaDeg / maxAngle) * chartW;
    const cToY = (ampVal: number) => paddingTop + chartH / 2 - (ampVal / (settings.amplitude * 1.3)) * (chartH / 2);

    // Generate paths for Phase A, B, C
    const getPhaseY = (thetaRad: number, phaseIdx: number) => {
      const I_m = settings.amplitude;

      switch (settings.excitationMode) {
        case 'BALANCED_ABC':
          return I_m * Math.cos(thetaRad - (phaseIdx * 120 * Math.PI) / 180);

        case 'BALANCED_ACB':
          const swPhaseIdx = phaseIdx === 1 ? 2 : phaseIdx === 2 ? 1 : phaseIdx;
          return I_m * Math.cos(thetaRad - (swPhaseIdx * 120 * Math.PI) / 180);

        case 'SINGLE_PHASE':
          return phaseIdx === 0 ? I_m * Math.cos(thetaRad) : 0;

        case 'CUSTOM': {
          const shiftRad = (phaseIdx === 0 ? settings.phaseA : phaseIdx === 1 ? settings.phaseB : settings.phaseC) * Math.PI / 180;
          const magMult = phaseIdx === 0 ? settings.magA : phaseIdx === 1 ? settings.magB : settings.magC;
          return magMult * I_m * Math.cos(thetaRad + shiftRad);
        }
        default:
          return 0;
      }
    };

    const phasePaths: string[] = ['', '', ''];
    for (let pIdx = 0; pIdx < 3; pIdx++) {
      const pts = [];
      for (let i = 0; i <= pointsCount; i++) {
        const deg = (i * maxAngle) / pointsCount;
        const rad = (deg * Math.PI) / 180;
        const val = getPhaseY(rad, pIdx);
        pts.push(`${i === 0 ? 'M' : 'L'} ${cToX(deg)} ${cToY(val)}`);
      }
      phasePaths[pIdx] = pts.join(' ');
    }

    const phaseColors = ['#ef4444', '#10b981', '#3b82f6'];

    return (
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2 font-mono">
          <span>X: Electrical Time Angle (deg)</span>
          <span>Y: Phase Currents (Amperes)</span>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto select-none">
          {/* Axis lines */}
          <line x1={paddingLeft} y1={paddingTop + chartH / 2} x2={paddingLeft + chartW} y2={paddingTop + chartH / 2} stroke="#334155" strokeWidth="1" />
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartH} stroke="#1e293b" strokeWidth="1.5" />

          {/* Amplitude tags */}
          {[-settings.amplitude, settings.amplitude].map((v) => (
            <g key={`y-grid-cur-${v}`} className="opacity-40">
              <line x1={paddingLeft} y1={cToY(v)} x2={paddingLeft + chartW} y2={cToY(v)} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <text x={paddingLeft - 8} y={cToY(v) + 3.5} className="fill-gray-400 font-mono text-[9px]" textAnchor="end">
                {v.toFixed(1)}A
              </text>
            </g>
          ))}
          <text x={paddingLeft - 8} y={cToY(0) + 3.5} className="fill-gray-400 font-mono text-[9px]" textAnchor="end">0.0A</text>

          {/* Time ticks */}
          {[0, 180, 360, 540, 720].map((tDeg) => {
            const xPx = cToX(tDeg);
            return (
              <g key={`t-tick-${tDeg}`}>
                <line x1={xPx} y1={paddingTop + chartH} x2={xPx} y2={paddingTop + chartH + 5} stroke="#334155" strokeWidth="1.2" />
                <text x={xPx} y={paddingTop + chartH + 16} className="fill-gray-400 font-mono text-[9px]" textAnchor="middle">
                  {tDeg}°
                </text>
              </g>
            );
          })}

          {/* Phase Waves lines */}
          {phasePaths.map((pathD, pIdx) => (
            <path
              key={`phase-path-${pIdx}`}
              d={pathD}
              fill="none"
              stroke={phaseColors[pIdx]}
              strokeWidth="2"
              opacity={settings.excitationMode === 'SINGLE_PHASE' && pIdx > 0 ? 0.05 : 0.85}
              className="transition-all duration-100"
            />
          ))}

          {/* Scrolling Vertical current playhead */}
          {settings.frequency > 0 && (() => {
            const playHeadX = cToX((currentThetaRad * 180) / Math.PI);
            return (
              <g>
                <line
                  x1={playHeadX}
                  y1={paddingTop - 5}
                  x2={playHeadX}
                  y2={paddingTop + chartH + 5}
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  style={{ filter: 'drop-shadow(0px 0px 3px rgba(251, 191, 36, 0.5))' }}
                />
                <polygon points={`${playHeadX},${paddingTop - 4} ${playHeadX - 4},${paddingTop - 10} ${playHeadX + 4},${paddingTop - 10}`} fill="#fbbf24" />
                <text x={playHeadX} y={paddingTop - 14} className="fill-amber-400 text-[8px] font-mono text-center font-bold" textAnchor="middle">
                  ωt={(currentThetaRad * 180 / Math.PI).toFixed(0)}°
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-gray-950 p-5 rounded-2xl border border-gray-800 shadow-2xl h-full justify-between">
      {/* Tab Selectors bar */}
      <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-800 gap-1.5 mb-5 select-none relative z-10 items-center justify-between">
        <div className="flex gap-1.5 flex-1">
          <button
            onClick={() => setActiveTab('spatial')}
            className={`flex-1 py-2 text-center rounded-lg transition-all text-xs font-mono font-bold tracking-tight cursor-pointer ${activeTab === 'spatial' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'}`}
          >
            Spatial F(θ) Wave
          </button>
          <button
            onClick={() => setActiveTab('harmonics')}
            className={`flex-1 py-2 text-center rounded-lg transition-all text-xs font-mono font-bold tracking-tight cursor-pointer ${activeTab === 'harmonics' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'}`}
          >
            Harmonics FFT
          </button>
          <button
            onClick={() => setActiveTab('currents')}
            className={`flex-1 py-2 text-center rounded-lg transition-all text-xs font-mono font-bold tracking-tight cursor-pointer ${activeTab === 'currents' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'}`}
          >
            Phase Currents i(t)
          </button>
        </div>
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="text-[8.5px] font-bold text-amber-500 cursor-pointer border border-amber-500/20 px-2 py-1.5 rounded-lg bg-gray-950 hover:bg-amber-500/10 transition-all uppercase flex items-center gap-1 ml-2 select-none"
            title="Open in Stator MMF Waveform Workspace"
          >
            <Maximize2 className="w-2.5 h-2.5" /> Full Screen
          </button>
        )}
      </div>

      {/* Expanded plot area */}
      <div className="flex-1 min-h-[220px]">
        {activeTab === 'spatial' && renderSpatialMmfPlot()}
        {activeTab === 'harmonics' && renderHarmonicsPlot()}
        {activeTab === 'currents' && renderCurrentsPlot()}
      </div>

      {/* Quick context info details under plots */}
      <div className="mt-4 border-t border-gray-800/80 pt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-gray-500">
        {activeTab === 'spatial' && (
          <>
            <span>Staircase MMF (S={S}, P={P})</span>
            <span>MMF Peak Value: <strong className="text-amber-500">{(mmf.mmfMax).toFixed(2)}</strong> Amp-Turns</span>
          </>
        )}
        {activeTab === 'harmonics' && (
          <>
            <span>Spatial Harmonics: Backward (5,11) | Forward (7,13)</span>
            <span>Spatial THD: <strong className="text-red-400">{(harmonics[0]?.percentage ? Math.sqrt(harmonics.filter(h=>h.order>1).reduce((acc, h) => acc + h.magnitude**2, 0)) / harmonics[0].magnitude * 100 : 0).toFixed(1)}%</strong></span>
          </>
        )}
        {activeTab === 'currents' && (
          <>
            <span>Mode: <strong className="text-gray-300">{settings.excitationMode}</strong></span>
            <span>Frequency: <strong className="text-gray-300">{settings.frequency} Hz</strong> | Period: <strong className="text-gray-300">{(1000/settings.frequency).toFixed(1)}ms</strong></span>
          </>
        )}
      </div>
    </div>
  );
};
