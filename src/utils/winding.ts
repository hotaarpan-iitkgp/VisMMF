/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WindingLayout, SimSettings, SlotCurrents, MmfResult, HarmonicItem } from '../types';

/**
 * Generates the double-layer winding layout based on poles, q, and coil pitch.
 *
 * S = 3 * poles * q.
 * Coil Pitch (y) in slots. Full-pitch is y = 3 * q.
 */
export function generateWindingLayout(poles: number, q: number, pitch: number): WindingLayout {
  const slots = 3 * poles * q;
  const topPhase = new Array<number>(slots);
  const topSign = new Array<number>(slots);

  // Generates 60-degree phase belt for a double-layer winding
  // Sequence of 60-degree belts repeat every 360 electrical degrees (which corresponds to 2 poles, or 6q slots)
  // Inside a 2-pole span, we have 6 belts of size q slots each:
  // Belt 0 (0 to q-1): Phase A (+)
  // Belt 1 (q to 2q-1): Phase -C (C negative)
  // Belt 2 (2q to 3q-1): Phase B (+)
  // Belt 3 (3q to 4q-1): Phase -A (A negative)
  // Belt 4 (4q to 5q-1): Phase C (+)
  // Belt 5 (5q to 6q-1): Phase -B (B negative)
  for (let s = 0; s < slots; s++) {
    const beltIndex = Math.floor(s / q);
    const beltType = beltIndex % 6;

    switch (beltType) {
      case 0: // Phase A (+)
        topPhase[s] = 0;
        topSign[s] = 1;
        break;
      case 1: // Phase C (-)
        topPhase[s] = 2;
        topSign[s] = -1;
        break;
      case 2: // Phase B (+)
        topPhase[s] = 1;
        topSign[s] = 1;
        break;
      case 3: // Phase A (-)
        topPhase[s] = 0;
        topSign[s] = -1;
        break;
      case 4: // Phase C (+)
        topPhase[s] = 2;
        topSign[s] = 1;
        break;
      case 5: // Phase B (-)
        topPhase[s] = 1;
        topSign[s] = -1;
        break;
    }
  }

  // Bottom layer of slot s is the return side of the coil that started at "s - pitch" in the top layer.
  // The bottom layer has the opposite polarity of its top layer counterpart.
  const bottomPhase = new Array<number>(slots);
  const bottomSign = new Array<number>(slots);

  for (let s = 0; s < slots; s++) {
    const srcSlot = (s - pitch + slots) % slots;
    bottomPhase[s] = topPhase[srcSlot];
    bottomSign[s] = -topSign[srcSlot];
  }

  return {
    slots,
    poles,
    q,
    pitch,
    topPhase,
    topSign,
    bottomPhase,
    bottomSign,
  };
}

/**
 * Calculates phase currents in Amperes at a given elapsed time.
 */
export function getPhaseCurrents(time: number, settings: SimSettings): { iA: number; iB: number; iC: number } {
  const omega = 2 * Math.PI * settings.frequency;
  const theta = omega * time; // Electrical time angle in radians

  const I_m = settings.amplitude;

  switch (settings.excitationMode) {
    case 'BALANCED_ABC':
      return {
        iA: I_m * Math.cos(theta),
        iB: I_m * Math.cos(theta - (120 * Math.PI) / 180),
        iC: I_m * Math.cos(theta - (240 * Math.PI) / 180),
      };

    case 'BALANCED_ACB':
      // Sweeps phases B and C
      return {
        iA: I_m * Math.cos(theta),
        iB: I_m * Math.cos(theta - (240 * Math.PI) / 180),
        iC: I_m * Math.cos(theta - (120 * Math.PI) / 180),
      };

    case 'SINGLE_PHASE':
      // Pulsating excitation in phase A only
      return {
        iA: I_m * Math.cos(theta),
        iB: 0,
        iC: 0,
      };

    case 'CUSTOM': {
      // User-defined amplitudes and phase shifts
      const rA = (settings.phaseA * Math.PI) / 180;
      const rB = (settings.phaseB * Math.PI) / 180;
      const rC = (settings.phaseC * Math.PI) / 180;

      return {
        iA: settings.magA * I_m * Math.cos(theta + rA),
        iB: settings.magB * I_m * Math.cos(theta + rB),
        iC: settings.magC * I_m * Math.cos(theta + rC),
      };
    }

    default:
      return { iA: 0, iB: 0, iC: 0 };
  }
}

/**
 * Computes instantaneous slot currents from layout and active phase currents.
 */
export function getSlotCurrents(layout: WindingLayout, currents: { iA: number; iB: number; iC: number }): SlotCurrents {
  const { slots, topPhase, topSign, bottomPhase, bottomSign } = layout;
  const slotCurrents = new Array<number>(slots);

  const phases = [currents.iA, currents.iB, currents.iC];

  for (let s = 0; s < slots; s++) {
    const iTop = topSign[s] * phases[topPhase[s]];
    const iBottom = bottomSign[s] * phases[bottomPhase[s]];
    slotCurrents[s] = iTop + iBottom;
  }

  return {
    ...currents,
    slotCurrents,
  };
}

/**
 * Calculates the spatial staircase MMF waveform F(θ).
 *
 * For S slots, the slots are at angles θ_k = k * 2π/S.
 * MMF(θ) is calculated as a cumulative sum of slot currents,
 * adjusted by subtracting the average value so that its mean is 0.
 */
export function computeMmf(layout: WindingLayout, currents: SlotCurrents): MmfResult {
  const S = layout.slots;
  const slotCurrents = currents.slotCurrents;

  // Let slot 0 be at mechanical angle 0
  const angles = new Array<number>(S);
  const rawMmf = new Array<number>(S);

  // MMF(θ) steps up by slotCurrents[k] at slot position k * 2π/S
  // Let's compute the staircase values in each slot interval:
  // Interval k is [k * 2π/S, (k+1) * 2π/S)
  let currentSum = 0;
  for (let k = 0; k < S; k++) {
    angles[k] = (k * 2 * Math.PI) / S;
    currentSum += slotCurrents[k];
    rawMmf[k] = currentSum;
  }

  // Calculate average of the staircase raw MMF
  let sumRaw = 0;
  for (let k = 0; k < S; k++) {
    sumRaw += rawMmf[k];
  }
  const averageMmf = sumRaw / S;

  // Actual balanced MMF is rawMmf minus the mean
  const mmf = new Array<number>(S);
  let mmfMax = 0;
  for (let k = 0; k < S; k++) {
    mmf[k] = rawMmf[k] - averageMmf;
    const absVal = Math.abs(mmf[k]);
    if (absVal > mmfMax) {
      mmfMax = absVal;
    }
  }

  // Find Fundamental Spatial Waveform components
  // Fundamental spatial order mechanical is p = poles / 2
  const p = layout.poles / 2;
  const { A_n, B_n } = computeFourierCoefficients(mmf, S, p);

  const fundamentalAmp = Math.sqrt(A_n * A_n + B_n * B_n);

  // The wave is A_n * cos(p*theta) + B_n * sin(p*theta) = C_p * cos(p*theta - phi_p)
  // where phi_p = atan2(B_n, A_n).
  // Under standard CW rotation with balanced 3-phase, this angle drifts smoothly.
  let phi = Math.atan2(B_n, A_n);
  if (phi < 0) {
    phi += 2 * Math.PI;
  }
  
  // Peak angle is mechanical: theta_peak = phi_p / p
  const fundamentalPhase = phi / p;

  return {
    angles,
    rawMmf,
    mmf,
    mmfMax,
    fundamentalA: A_n,
    fundamentalB: B_n,
    fundamentalPhase,
    fundamentalAmp,
  };
}

/**
 * Analytical Fourier coefficients calculation for a staircase function value inside equal intervals.
 *
 * Interval k: [k * dθ, (k+1) * dθ) has value mmf[k], where dθ = 2π / S.
 *
 * A_n = 1/π \sum_{k=0}^{S-1} mmf[k] \int_{θ_k}^{θ_{k+1}} \cos(nθ) dθ
 *     = 1/(πn) \sum_{k=0}^{S-1} mmf[k] [ \sin(nθ_{k+1}) - \sin(nθ_k) ]
 *
 * B_n = 1/π \sum_{k=0}^{S-1} mmf[k] \int_{θ_k}^{θ_{k+1}} \sin(nθ) dθ
 *     = 1/(πn) \sum_{k=0}^{S-1} mmf[k] [ \cos(nθ_k) - \cos(nθ_{k+1}) ]
 */
function computeFourierCoefficients(mmf: number[], S: number, n: number): { A_n: number; B_n: number } {
  const dTheta = (2 * Math.PI) / S;
  let sumCos = 0;
  let sumSin = 0;

  for (let k = 0; k < S; k++) {
    const thetaK = k * dTheta;
    const thetaK1 = (k + 1) * dTheta;

    sumCos += mmf[k] * (Math.sin(n * thetaK1) - Math.sin(n * thetaK));
    sumSin += mmf[k] * (Math.cos(n * thetaK) - Math.cos(n * thetaK1));
  }

  const denom = Math.PI * n;
  return {
    A_n: sumCos / denom,
    B_n: sumSin / denom,
  };
}

/**
 * Computes spatial electrical harmonics of the MMF waveform.
 *
 * Electrical harmonic order h corresponds to mechanical order n = h * p.
 * We calculate h = 1, 3, 5, 7, 11, 13, 17, 19.
 */
export function getMmfHarmonics(layout: WindingLayout, mmf: number[]): HarmonicItem[] {
  const S = layout.slots;
  const p = layout.poles / 2;

  const targetElectricalHarmonics = [1, 3, 5, 7, 11, 13, 17, 19];
  const list: HarmonicItem[] = [];

  // Find fundamental first to compute percentages
  const { A_n: A_1, B_n: B_1 } = computeFourierCoefficients(mmf, S, p);
  const fundAmp = Math.sqrt(A_1 * A_1 + B_1 * B_1);

  for (const h of targetElectricalHarmonics) {
    const n = h * p;
    // Fourier analysis requires n < S/2 to prevent grid aliasing issues
    let magnitude = 0;
    if (n < S) {
      const { A_n, B_n } = computeFourierCoefficients(mmf, S, n);
      magnitude = Math.sqrt(A_n * A_n + B_n * B_n);
    }

    const percentage = fundAmp > 1e-4 ? (magnitude / fundAmp) * 100 : 0;

    // Direct harmonic rotating field:
    // h = 1: Forward
    // h = 3, 9, 15... (Triplen): None (cancel or homopolar in balanced systems)
    // h = 5, 11, 17... (6k-1): Backward
    // h = 7, 13, 19... (6k+1): Forward
    let direction: 'Forward' | 'Backward' | 'None' = 'None';
    if (h % 3 === 0) {
      direction = 'None';
    } else if ((h + 1) % 6 === 0) {
      direction = 'Backward';
    } else if ((h - 1) % 6 === 0) {
      direction = 'Forward';
    }

    list.push({
      order: h,
      mechanicalOrder: n,
      magnitude,
      percentage,
      direction,
    });
  }

  return list;
}

/**
 * Computes the theoretical distribution factor (kd), pitch factor (kp), and winding factor (kw).
 *
 * For a given electrical harmonic order h.
 * Slots/pole/phase q.
 * Pole pitch is tau_p = 3q slots.
 * Coil pitch is y slots.
 */
export function getWindingFactors(
  q: number,
  pitch: number,
  poles: number,
  h: number
): { kd: number; kp: number; kw: number } {
  const tau_P = 3 * q; // Pole pitch in slots (corresponds to 180 electrical deg)
  const gammaRad = Math.PI / (3 * q); // Slot angular distance in electrical radians (180deg / tau_P)

  // Distribution factor kp_h:
  // kd_h = sin(q * h * gamma / 2) / (q * sin(h * gamma / 2))
  const denomSin = Math.sin((h * gammaRad) / 2);
  let kd = 1;
  if (Math.abs(denomSin) > 1e-6) {
    kd = Math.sin((q * h * gammaRad) / 2) / (q * denomSin);
  } else {
    // L'Hopital rule for limit
    kd = 1;
  }

  // Pitch factor kp_h:
  // kp_h = sin(h * epsilon / 2) where epsilon is electrical coil span = pitch * gamma
  const coilSpanElecRad = pitch * gammaRad;
  const kp = Math.sin((h * coilSpanElecRad) / 2);

  return {
    kd: Number(kd.toFixed(4)),
    kp: Number(kp.toFixed(4)),
    kw: Number((kd * kp).toFixed(4)),
  };
}

/**
 * Calculates the Total Harmonic Distortion (THD) of the spatial MMF waveform.
 * Formulated as \sqrt{\sum_{h > 1} C_h^2} / C_1
 */
export function computeThd(harmonics: HarmonicItem[]): number {
  const fundamental = harmonics.find((h) => h.order === 1);
  if (!fundamental || fundamental.magnitude < 1e-4) return 0;

  let sumSquares = 0;
  for (const h of harmonics) {
    if (h.order > 1) {
      sumSquares += h.magnitude * h.magnitude;
    }
  }

  return (Math.sqrt(sumSquares) / fundamental.magnitude) * 100;
}
