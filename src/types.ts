/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WindingLayout {
  slots: number;
  poles: number;
  q: number; // Slots/pole/phase
  pitch: number; // Coil pitch in slots
  topPhase: number[]; // 0=A, 1=B, 2=C for each slot
  topSign: number[]; // +1 or -1 for each slot
  bottomPhase: number[];
  bottomSign: number[];
}

export type ExcitationMode = 'BALANCED_ABC' | 'BALANCED_ACB' | 'SINGLE_PHASE' | 'CUSTOM';

export interface SimSettings {
  poles: number;
  q: number;
  pitch: number;
  frequency: number;
  amplitude: number;
  excitationMode: ExcitationMode;
  slip: number; // 0 to 1
  time: number; // in seconds
  speedMult: number; // Animation speed coefficient
  
  // Custom excitation magnitudes and phases
  magA: number; // 0 to 1.5
  magB: number; // 0 to 1.5
  magC: number; // 0 to 1.5
  phaseA: number; // in degrees
  phaseB: number; // in degrees
  phaseC: number; // in degrees
}

export interface SlotCurrents {
  iA: number;
  iB: number;
  iC: number;
  slotCurrents: number[]; // Net current in each slot, index 0 to S-1
}

export interface MmfResult {
  angles: number[];       // S angles (or S+1)
  rawMmf: number[];       // S raw values or higher resolution
  mmf: number[];          // Physical balanced MMF values in intervals
  mmfMax: number;         // Peak MMF
  fundamentalA: number;   // Fundamental sine coefficient (mechanical)
  fundamentalB: number;   // Fundamental cosine coefficient (mechanical)
  fundamentalPhase: number; // Rotor angle where peak occurs (radians)
  fundamentalAmp: number;   // Peak amplitude of fundamental
}

export interface HarmonicItem {
  order: number;        // Harmonic order h (electrical)
  mechanicalOrder: number; // Mechanical order n
  magnitude: number;    // Peak amplitude of the harmonic
  percentage: number;   // % of fundamental
  direction: 'Forward' | 'Backward' | 'None';
}
