/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, HelpCircle, RefreshCw, Zap, Sliders, Hash } from 'lucide-react';
import { getWindingFactors } from '../utils/winding';

interface TheorySectionProps {
  poles: number;
  q: number;
  pitch: number;
}

export const TheorySection: React.FC<TheorySectionProps> = ({ poles, q, pitch }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Compute winding factors for 1st, 5th, and 7th harmonics to show live on theory board
  const fundFactors = getWindingFactors(q, pitch, poles, 1);
  const fifthFactors = getWindingFactors(q, pitch, poles, 5);
  const seventhFactors = getWindingFactors(q, pitch, poles, 7);

  const tau_P = 3 * q; // Pole pitch in slots
  const pitchFractionString = `${pitch}/${tau_P}`;
  const pitchFrc = pitch / tau_P;

  return (
    <div className="bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl p-6 font-mono text-xs text-gray-300">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none group"
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-gray-100 group-hover:text-amber-400 transition-colors">
              Physical & Mathematical Winding Theory
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Interact with the stator settings above to see winding factors update in real-time.
            </p>
          </div>
        </div>
        <button className="px-3 py-1 bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-white rounded-lg border border-gray-800 transition-all cursor-pointer">
          {isOpen ? 'Collapse' : 'Expand Manual'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 border-t border-gray-800/80 pt-5 space-y-6 animate-fadeIn font-sans leading-relaxed text-gray-300 text-sm">
          {/* Real-time calculated statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl font-mono text-xs">
              <div className="flex items-center gap-2 mb-2 text-amber-500">
                <Hash className="w-4 h-4" />
                <span className="font-bold tracking-wider">Winding Spacing</span>
              </div>
              <ul className="space-y-1 text-gray-400">
                <li>Total Slots (S): <strong className="text-white">{3 * poles * q}</strong></li>
                <li>Poles (P): <strong className="text-white">{poles}</strong></li>
                <li>Pole Pitch (<strong className="italic">τ<sub>p</sub></strong>): <strong className="text-white">{tau_P} slots</strong></li>
                <li>Coil Pitch (<strong className="italic">y</strong>): <strong className="text-white">{pitch} slots</strong></li>
                <li>Pitch Ratio: <strong className="text-amber-400">{(pitchFrc * 100).toFixed(1)}% ({pitchFractionString})</strong></li>
              </ul>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl font-mono text-xs">
              <div className="flex items-center gap-2 mb-2 text-emerald-500">
                <Sliders className="w-4 h-4" />
                <span className="font-bold tracking-wider">Fundamental Factors (h=1)</span>
              </div>
              <ul className="space-y-1 text-gray-400">
                <li>Distribution (<strong className="italic">k<sub>d1</sub></strong>): <strong className="text-white">{fundFactors.kd}</strong></li>
                <li>Pitch Factor (<strong className="italic">k<sub>p1</sub></strong>): <strong className="text-white">{fundFactors.kp}</strong></li>
                <li>Winding Factor (<strong className="italic">k<sub>w1</sub></strong>): <strong className="text-emerald-400 font-bold">{fundFactors.kw}</strong></li>
              </ul>
            </div>

            <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl font-mono text-xs">
              <div className="flex items-center gap-2 mb-2 text-rose-500">
                <RefreshCw className="w-4 h-4" />
                <span className="font-bold tracking-wider">Harmonic Factors</span>
              </div>
              <ul className="space-y-1 text-gray-400">
                <li>5th Harmonic Winding Factor (<strong className="italic">k<sub>w5</sub></strong>): <strong className="text-white">{fifthFactors.kw}</strong></li>
                <li>7th Harmonic Winding Factor (<strong className="italic">k<sub>w7</sub></strong>): <strong className="text-white">{seventhFactors.kw}</strong></li>
                <li className="text-[10px] text-gray-500 mt-2">
                  *Short pitching to 5/6 reduces the 5th and 7th harmonics.
                </li>
              </ul>
            </div>
          </div>

          {/* Educational columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <h4 className="flex items-center gap-2 font-mono font-bold text-xs text-amber-500 mb-2.5 uppercase">
                <Zap className="w-4 h-4" /> How the MMF Rotates (RMF)
              </h4>
              <p className="text-xs text-gray-400 mb-3 block">
                According to <strong>Tesla's rotating magnetic field</strong> formulation, feeding symmetrical 3-phase currents, shifted by 120° electrical in time, into physical windings spaced 120° electrical apart in space produces a uniform rotating wave in the airgap.
              </p>
              <div className="bg-gray-900 p-3 rounded-lg font-mono text-[11px] border border-gray-800 text-gray-300">
                <div className="text-amber-400 text-center mb-1">Synchronous Rotor Speed Formula</div>
                <div className="text-center font-bold text-white text-md">N<sub>s</sub> = 120 · f / P (RPM)</div>
                <div className="text-center text-gray-500 mt-1 text-[10px]">
                  F = 60 Hz, P = 4 Poles ➔ N<sub>s</sub> = 1800 RPM
                </div>
              </div>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-mono font-bold text-xs text-amber-500 mb-2.5 uppercase">
                <HelpCircle className="w-4 h-4" /> Winding Distribution & Pitching
              </h4>
              <p className="text-xs text-gray-400 mb-3 block">
                Since magnets take discrete slots rather than infinite smooth sheets, the raw spatial magnetic field contains stepped ridges (harmonics). Two methods are used in motor windings to filter these out:
              </p>
              <ul className="text-xs space-y-2 text-gray-400">
                <li>
                  <span className="text-gray-200 font-semibold font-mono">1. Distribution (<strong className="italic">k<sub>d</sub></strong>):</span> Placing a phase coil over multiple slots (<strong className="italic">q &gt; 1</strong>) spreads the physical MMF. High-frequency stair-waves cancel out, acting as a structural spatial low-pass filter.
                </li>
                <li>
                  <span className="text-gray-200 font-semibold font-mono">2. Short-Pitching (<strong className="italic">k<sub>p</sub></strong>):</span> Making individual coils span less than a full pole pitch (<strong className="italic">y &lt; τ<sub>p</sub></strong>) creates a phase shift between coil sides. Designing the coil offset around 5/6 (83%) suppresses parasitics like the 5th and 7th spatial harmonics.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
