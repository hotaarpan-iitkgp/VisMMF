/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  RotateCw,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { WindingLayout, SimSettings, MmfResult, SlotCurrents } from '../types';

interface MotorCrossSectionProps {
  layout: WindingLayout;
  settings: SimSettings;
  currents: SlotCurrents;
  mmf: MmfResult;
  isFullscreen?: boolean;
  onToggleFullscreen?: (fullscreen: boolean) => void;
  embedFullscreen?: boolean;
}

export const MotorCrossSection: React.FC<MotorCrossSectionProps> = ({
  layout,
  settings,
  currents,
  mmf,
  isFullscreen: propsIsFullscreen,
  onToggleFullscreen,
  embedFullscreen = false,
}) => {
  const S = layout.slots;
  const P = layout.poles;
  const p = P / 2;

  const [showStator, setShowStator] = useState(true);
  const [showRotor, setShowRotor] = useState(true);
  const [showWinding, setShowWinding] = useState(true);
  const [showMmf, setShowMmf] = useState(true);
  const [showFluxLines, setShowFluxLines] = useState(true);
  const [is3D, setIs3D] = useState(false);

  const [showPhaseA, setShowPhaseA] = useState(true);
  const [showPhaseB, setShowPhaseB] = useState(true);
  const [showPhaseC, setShowPhaseC] = useState(true);

  const isPhaseVisible = (pIndex: number) => {
    if (pIndex === 0) return showPhaseA;
    if (pIndex === 1) return showPhaseB;
    if (pIndex === 2) return showPhaseC;
    return true;
  };

  // Fullscreen, zoom, and pan parameters
  const [internalIsFullscreen, setInternalIsFullscreen] = useState(false);
  const isFullscreen = propsIsFullscreen !== undefined ? propsIsFullscreen : internalIsFullscreen;
  const setIsFullscreen = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isFullscreen) : val;
    if (onToggleFullscreen) {
      onToggleFullscreen(nextVal);
    } else {
      setInternalIsFullscreen(nextVal);
    }
  };
  const [zoomScale, setZoomScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'orbit' | 'pan'>('orbit');
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = React.useRef({ x: 0, y: 0, px: 0, py: 0 });

  const [orbitAngleX, setOrbitAngleX] = useState(58);
  const [orbitAngleZ, setOrbitAngleZ] = useState(-38);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const dragStartRef = React.useRef({ x: 0, y: 0, angX: 58, angZ: -38 });

  const handleResetOrbit = () => {
    setOrbitAngleX(58);
    setOrbitAngleZ(-38);
  };

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(4, prev + 0.25));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = prev - 0.25;
      if (next <= 1) {
        setPanX(0);
        setPanY(0);
        return 1;
      }
      return next;
    });
  };

  const handleResetZoomAndPan = () => {
    setZoomScale(1);
    setPanX(0);
    setPanY(0);
  };

  const applyPreset = (preset: 'full' | 'stator' | 'airgap' | 'rotor' | 'shaft') => {
    switch (preset) {
      case 'full':
        setZoomScale(1);
        setPanX(0);
        setPanY(0);
        break;
      case 'stator':
        setZoomScale(2.2);
        setPanX(0);
        setPanY(135);
        break;
      case 'airgap':
        setZoomScale(3.0);
        setPanX(-115);
        setPanY(115);
        break;
      case 'rotor':
        setZoomScale(2.4);
        setPanX(0);
        setPanY(-45);
        break;
      case 'shaft':
        setZoomScale(2.7);
        setPanX(0);
        setPanY(15);
        break;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (is3D && interactionMode === 'orbit') {
      setIsOrbiting(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        angX: orbitAngleX,
        angZ: orbitAngleZ,
      };
    } else {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        px: panX,
        py: panY,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isOrbiting && is3D) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      let nextZ = dragStartRef.current.angZ - dx * 0.55;
      let nextX = dragStartRef.current.angX + dy * 0.55;
      nextX = Math.max(10, Math.min(85, nextX));
      setOrbitAngleX(nextX);
      setOrbitAngleZ(nextZ);
    } else if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanX(panStartRef.current.px + dx);
      setPanY(panStartRef.current.py + dy);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (is3D && interactionMode === 'orbit') {
      setIsOrbiting(true);
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        angX: orbitAngleX,
        angZ: orbitAngleZ,
      };
    } else {
      setIsPanning(true);
      panStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        px: panX,
        py: panY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (isOrbiting && is3D) {
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      let nextZ = dragStartRef.current.angZ - dx * 0.55;
      let nextX = dragStartRef.current.angX + dy * 0.55;
      nextX = Math.max(10, Math.min(85, nextX));
      setOrbitAngleX(nextX);
      setOrbitAngleZ(nextZ);
    } else if (isPanning) {
      const dx = touch.clientX - panStartRef.current.x;
      const dy = touch.clientY - panStartRef.current.y;
      setPanX(panStartRef.current.px + dx);
      setPanY(panStartRef.current.py + dy);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsOrbiting(false);
    setIsPanning(false);
  };

  // Visual Radii Definitions
  const cx = 250;
  const cy = 250;
  const rOuterFrame = 230;
  const rStatorOuter = 215;
  const rStatorInner = 145;
  const rRotorOuter = 135;
  const rRotorInner = 30; // Shaft radius

  // Conductor Radii
  const rTopCond = 160;   // Top layer conductor radius (closer to airgap)
  const rBotCond = 185;   // Bottom layer conductor radius (further from rotor)
  const rSlotCenter = 172.5;

  // Dynamic slot sizing to prevent overlapping when slot count (S) is high (e.g. S=36, 48, 72)
  const dThetaSlot = (2 * Math.PI) / S;
  const slotPitchArc = rSlotCenter * dThetaSlot;
  // Scaled slot backing radius (fits neatly within the slot pitch arc width limit)
  const rSlotBacking = Math.max(6.5, Math.min(13, slotPitchArc * 0.42));
  // Scaled conductor indicator radius
  const rCondIndicator = Math.max(3.0, Math.min(5.5, slotPitchArc * 0.18));

  // Let's scale MMF values visually
  // Scale so that 2 * amplitude peak MMF covers around 25px in the airgap
  const mmfScaleBase = 90; // The base line of the MMF wave (centered in rotor region)
  const mmfScaleFactor = useMemo(() => {
    if (mmf.mmfMax < 0.1) return 20;
    // Cap at a reasonable scaling to fit between shaft (30) and rotor edge (135)
    // We want the peak mmf to stretch about 35 pixels
    return 35 / Math.max(mmf.mmfMax, 1);
  }, [mmf.mmfMax]);

  // Compute Stator slot coordinates and data
  const slotElements = useMemo(() => {
    const elements = [];
    const maxCurrent = Math.max(1, settings.amplitude * 2);

    for (let s = 0; s < S; s++) {
      // Slot angle (mechanical: starts at 3 o'clock, rotates clockwise)
      const theta = (s * 2 * Math.PI) / S;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Coordinates for conductors
      const xTop = cx + rTopCond * cosT;
      const yTop = cy + rTopCond * sinT;
      const xBot = cx + rBotCond * cosT;
      const yBot = cy + rBotCond * sinT;
      const xSlot = cx + rSlotCenter * cosT;
      const ySlot = cy + rSlotCenter * sinT;

      // Phase & Signs
      const tPhase = layout.topPhase[s];
      const tSign = layout.topSign[s];
      const bPhase = layout.bottomPhase[s];
      const bSign = layout.bottomSign[s];

      // Instantaneous currents
      const phaseCurrentsList = [currents.iA, currents.iB, currents.iC];
      const curTop = tSign * phaseCurrentsList[tPhase];
      const curBot = bSign * phaseCurrentsList[bPhase];

      elements.push({
        slotIndex: s,
        theta,
        xSlot,
        ySlot,
        xTop,
        yTop,
        xBot,
        yBot,
        top: {
          phase: tPhase,
          current: curTop,
          absCur: Math.abs(curTop),
          sign: Math.sign(curTop),
        },
        bottom: {
          phase: bPhase,
          current: curBot,
          absCur: Math.abs(curBot),
          sign: Math.sign(curBot),
        },
      });
    }
    return elements;
  }, [S, layout, currents, settings.amplitude]);

  // Colors mapping for phases
  // Modern premium palette: A=Coral, B=Emerald, C=Indigo
  const phaseColors = ['#ef4444', '#10b981', '#3b82f6'];
  const phaseBeautColors = [
    { name: 'Phase A', border: '#fca5a5', glow: '#ef4444', dark: '#991b1b' },
    { name: 'Phase B', border: '#6ee7b7', glow: '#10b981', dark: '#065f46' },
    { name: 'Phase C', border: '#93c5fd', glow: '#3b82f6', dark: '#1e40af' },
  ];

  // Helper to draw conductor visual details (cross / dot)
  const renderConductorSymbol = (x: number, y: number, current: number, radius: number) => {
    if (Math.abs(current) < 0.05 * settings.amplitude) {
      return null; // Tiny current, no indicator
    }

    if (current > 0) {
      // Coming out (dot) - dynamically scaled radius
      const dotRad = Math.max(0.8, radius * 0.28);
      return (
        <circle cx={x} cy={y} r={dotRad} fill="#ffffff" />
      );
    } else {
      // Going in (cross)
      const len = radius * 0.45;
      return (
        <g stroke="#ffffff" strokeWidth="1" strokeLinecap="round">
          <line x1={x - len} y1={y - len} x2={x + len} y2={y + len} />
          <line x1={x - len} y1={y + len} x2={x + len} y2={y - len} />
        </g>
      );
    }
  };

  // Generate Staircase MMF path
  const MmfStairPath = useMemo(() => {
    if (S === 0) return '';
    const dTheta = (2 * Math.PI) / S;
    const pathPoints = [];

    // Construct staircase coordinates around the stator circular grid
    for (let k = 0; k < S; k++) {
      const thetaStart = k * dTheta;
      const thetaEnd = (k + 1) * dTheta;
      
      const val = mmf.mmf[k];
      const r = mmfScaleBase + val * mmfScaleFactor;

      // Draw arc from thetaStart to thetaEnd
      // Point 1: At thetaStart at radius r
      const x1 = cx + r * Math.cos(thetaStart);
      const y1 = cy + r * Math.sin(thetaStart);
      // Point 2: At thetaEnd at radius r
      const x2 = cx + r * Math.cos(thetaEnd);
      const y2 = cy + r * Math.sin(thetaEnd);

      if (k === 0) {
        pathPoints.push(`M ${x1} ${y1}`);
      } else {
        // Line from slot jump
        pathPoints.push(`L ${x1} ${y1}`);
      }
      
      // Arc segment
      pathPoints.push(`A ${r} ${r} 0 0 1 ${x2} ${y2}`);
    }

    pathPoints.push('Z');
    return pathPoints.join(' ');
  }, [S, mmf.mmf, mmfScaleFactor]);

  // Generate smooth fundamental MMF wave path
  const MmfFundPath = useMemo(() => {
    const pointsCount = 180;
    const pathPoints = [];

    for (let i = 0; i <= pointsCount; i++) {
      const theta = (i * 2 * Math.PI) / pointsCount;
      
      // F_fund(theta) = A_p * cos(p*theta) + B_p * sin(p*theta)
      const val = mmf.fundamentalA * Math.cos(p * theta) + mmf.fundamentalB * Math.sin(p * theta);
      const r = mmfScaleBase + val * mmfScaleFactor;

      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);

      if (i === 0) {
        pathPoints.push(`M ${x} ${y}`);
      } else {
        pathPoints.push(`L ${x} ${y}`);
      }
    }
    return pathPoints.join(' ');
  }, [p, mmf.fundamentalA, mmf.fundamentalB, mmfScaleFactor]);

  // Compute Rotating Magnetic poles pointers (Vectors for maximums)
  const poleVectors = useMemo(() => {
    const vectors = [];
    const amp = mmf.fundamentalAmp;
    if (amp < 0.05) return [];

    // The fundamental is C_p * cos(p*theta - phi_p).
    // North peaks (maximum positive) occur when p*theta - phi_p = 2*m*pi -> theta_N = (phi_p + 2*m*pi)/p
    // South peaks (maximum negative) occur when p*theta - phi_p = (2*m+1)*pi -> theta_S = (phi_p + (2*m+1)*pi)/p
    for (let m = 0; m < p; m++) {
      // North peaks
      const thetaN = mmf.fundamentalPhase + (2 * m * Math.PI) / p;
      // South peaks
      const thetaS = mmf.fundamentalPhase + ((2 * m + 1) * Math.PI) / p;

      // North magnitude and arrow coordinate
      const rN = mmfScaleBase + amp * mmfScaleFactor;
      const xN = cx + rN * Math.cos(thetaN);
      const yN = cy + rN * Math.sin(thetaN);

      // South magnitude and arrow coordinate
      const rS = mmfScaleBase - amp * mmfScaleFactor;
      const xS = cx + rS * Math.cos(thetaS);
      const yS = cy + rS * Math.sin(thetaS);

      vectors.push({
        type: 'North',
        angle: thetaN,
        x: xN,
        y: yN,
        color: '#f87171', // Red arrow for North
        glow: 'rgba(239, 68, 68, 0.4)',
      });

      vectors.push({
        type: 'South',
        angle: thetaS,
        x: cx + (mmfScaleBase + amp * mmfScaleFactor) * Math.cos(thetaS), // Point target outwardly to represent the pole peak
        y: cy + (mmfScaleBase + amp * mmfScaleFactor) * Math.sin(thetaS),
        color: '#60a5fa', // Blue arrow for South
        glow: 'rgba(59, 130, 246, 0.4)',
      });
    }

    return vectors;
  }, [p, mmf.fundamentalPhase, mmf.fundamentalAmp, mmfScaleFactor]);

  // Compute flux line paths flowing from North to South poles
  const fluxPaths = useMemo(() => {
    const paths = [];
    const amp = mmf.fundamentalAmp;
    if (amp < 0.05) return [];

    for (let m = 0; m < p; m++) {
      const thetaN = mmf.fundamentalPhase + (2 * m * Math.PI) / p;
      const thetaS = mmf.fundamentalPhase + ((2 * m + 1) * Math.PI) / p;
      const thetaN2 = mmf.fundamentalPhase + ((2 * m + 2) * Math.PI) / p;

      // Draw quadratic Bezier curves starting from a North pole and ending at a South pole
      const drawFluxCurve = (tN: number, tS: number, rStart: number, rControl: number) => {
        const xStart = cx + rStart * Math.cos(tN);
        const yStart = cy + rStart * Math.sin(tN);
        const xEnd = cx + rStart * Math.cos(tS);
        const yEnd = cy + rStart * Math.sin(tS);

        // Find the correct shortest-path mid-angle
        let diff = tS - tN;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        const tMid = tN + diff / 2;

        const xControl = cx + rControl * Math.cos(tMid);
        const yControl = cy + rControl * Math.sin(tMid);

        return `M ${xStart} ${yStart} Q ${xControl} ${yControl} ${xEnd} ${yEnd}`;
      };

      // Rotor core interior flux lines (inward bowing, rControl < rStart)
      paths.push({ path: drawFluxCurve(thetaN, thetaS, 70, 20), type: 'rotor' });
      paths.push({ path: drawFluxCurve(thetaN, thetaS, 100, 52), type: 'rotor' });
      paths.push({ path: drawFluxCurve(thetaN, thetaS, 126, 88), type: 'rotor' });

      // Stator yoke backiron return flux lines (outward bowing, rControl > rStart)
      paths.push({ path: drawFluxCurve(thetaN, thetaS, 190, 204), type: 'stator' });
      paths.push({ path: drawFluxCurve(thetaN, thetaS, 196, 212), type: 'stator' });

      // Opposite pole direction (Region 2: from thetaN2 to thetaS)
      paths.push({ path: drawFluxCurve(thetaN2, thetaS, 70, 20), type: 'rotor' });
      paths.push({ path: drawFluxCurve(thetaN2, thetaS, 100, 52), type: 'rotor' });
      paths.push({ path: drawFluxCurve(thetaN2, thetaS, 126, 88), type: 'rotor' });

      paths.push({ path: drawFluxCurve(thetaN2, thetaS, 190, 204), type: 'stator' });
      paths.push({ path: drawFluxCurve(thetaN2, thetaS, 196, 212), type: 'stator' });
    }

    return paths;
  }, [p, mmf.fundamentalPhase, mmf.fundamentalAmp]);

  // Compute Animated Rotor Angle
  // Angle: is synchronised with time. Mechanical speed is omega_e / p
  // With slip, actual speed is mechanical speed * (1 - s)
  const rotorAngleDeg = useMemo(() => {
    const omega = 2 * Math.PI * settings.frequency;
    const timeAngle = omega * settings.time; // electrical radians
    const mechAngleRad = (timeAngle / p) * (1 - settings.slip);
    return (mechAngleRad * 180) / Math.PI;
  }, [settings.time, settings.frequency, p, settings.slip]);

  // Generating teeth SVG path for a handsome slotted motor feel
  const statorTeethPath = useMemo(() => {
    const pathArr = [];
    const dTheta = (2 * Math.PI) / S;
    const toothDepthWidthFraction = 0.4; // fraction of slot spacing

    for (let s = 0; s < S; s++) {
      const thetaSlot = s * dTheta;
      const thetaSlotPrev = (s - 0.5) * dTheta;
      const thetaSlotNext = (s + 0.5) * dTheta;

      // Draw teeth bridges
      const innerX_prev = cx + rStatorInner * Math.cos(thetaSlotPrev);
      const innerY_prev = cy + rStatorInner * Math.sin(thetaSlotPrev);
      const innerX_next = cx + rStatorInner * Math.cos(thetaSlotNext);
      const innerY_next = cy + rStatorInner * Math.sin(thetaSlotNext);

      // Deep cavity
      const teethWallAngle1 = thetaSlot - dTheta * toothDepthWidthFraction;
      const teethWallAngle2 = thetaSlot + dTheta * toothDepthWidthFraction;

      const xWall1 = cx + rStatorInner * Math.cos(teethWallAngle1);
      const yWall1 = cy + rStatorInner * Math.sin(teethWallAngle1);
      const xWallBack1 = cx + (rBotCond + 12) * Math.cos(teethWallAngle1);
      const yWallBack1 = cy + (rBotCond + 12) * Math.sin(teethWallAngle1);

      const xWall2 = cx + rStatorInner * Math.cos(teethWallAngle2);
      const yWall2 = cy + rStatorInner * Math.sin(teethWallAngle2);
      const xWallBack2 = cx + (rBotCond + 12) * Math.cos(teethWallAngle2);
      const yWallBack2 = cy + (rBotCond + 12) * Math.sin(teethWallAngle2);

      if (s === 0) {
        pathArr.push(`M ${innerX_prev} ${innerY_prev}`);
      }
      pathArr.push(`L ${xWall1} ${yWall1}`);
      pathArr.push(`L ${xWallBack1} ${yWallBack1}`);
      pathArr.push(`A ${rBotCond + 12} ${rBotCond + 12} 0 0 1 ${xWallBack2} ${yWallBack2}`);
      pathArr.push(`L ${xWall2} ${yWall2}`);
      pathArr.push(`L ${innerX_next} ${innerY_next}`);
    }

    pathArr.push('Z');
    return pathArr.join(' ');
  }, [S, rBotCond]);

  // Generate lap-winding copper end-turns
  const windingEndTurns = useMemo(() => {
    const turns = [];
    const pitchVal = settings.pitch;
    for (let s = 0; s < S; s++) {
      const sNext = (s + pitchVal) % S;
      const elStart = slotElements[s];
      const elEnd = slotElements[sNext];
      if (!elStart || !elEnd) continue;

      const phase = elStart.top.phase;
      const color = phaseColors[phase];

      const midTheta = (elStart.theta + elEnd.theta) / 2;
      const thetaDiff = Math.abs(elStart.theta - elEnd.theta);
      const useTheta = thetaDiff > Math.PI ? midTheta + Math.PI : midTheta;
      // Stagger overhang radius by phase index (0, 1, 2) to prevent overlapping curves crossing
      const rOverhang = rBotCond + 8 + phase * 4.5;
      const xMid = cx + rOverhang * Math.cos(useTheta);
      const yMid = cy + rOverhang * Math.sin(useTheta);

      const path = `M ${elStart.xTop} ${elStart.yTop} Q ${xMid} ${yMid} ${elEnd.xBot} ${elEnd.yBot}`;

      turns.push({
        path,
        color,
        phase,
      });
    }
    return turns;
  }, [S, slotElements, settings.pitch, rBotCond, phaseColors, cx, cy]);

  return (
    <div 
      className={
        embedFullscreen
          ? "w-full h-full flex flex-col lg:flex-row items-stretch justify-center gap-6 select-none text-gray-100 relative min-h-0"
          : isFullscreen 
            ? "fixed inset-0 z-[9999] bg-gray-950 p-6 flex flex-col lg:flex-row items-stretch justify-center gap-8 overflow-auto lg:overflow-hidden select-none text-gray-100"
            : "flex flex-col items-center justify-between bg-gray-950 p-4 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden h-full text-gray-100"
      }
    >
      {/* Decorative cybernetic overlay lines */}
      {(isFullscreen || embedFullscreen) ? (
        <>
          <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-500/25 pointer-events-none" />
          <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-amber-500/25 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-amber-500/25 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-amber-500/25 pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-500/20 rounded-tl-lg pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-500/20 rounded-tr-lg pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-500/20 rounded-bl-lg pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-500/20 rounded-br-lg pointer-events-none" />
        </>
      )}

      {/* Grid Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

      {/* Compact/Full Controls based on fullscreen mode */}
      {(!isFullscreen && !embedFullscreen) ? (
        <div className="w-full flex flex-col items-center z-10 font-mono mb-2">
          {/* Header row */}
          <div className="w-full flex justify-between items-center mb-1.5 border-b border-gray-900 pb-1 z-10">
            <h3 className="text-[11px] font-bold tracking-wider text-amber-500 uppercase flex items-center gap-1">
              Geometry Workspace
            </h3>
            <div className="flex items-center gap-1.5">
              {/* Compact 2D/3D toggle */}
              <div className="flex bg-gray-900/90 border border-gray-800 p-0.5 rounded-md text-[8px] select-none">
                <button
                  type="button"
                  onClick={() => setIs3D(false)}
                  className={`px-1.5 py-0.5 rounded transition bg-transparent text-gray-400 hover:text-white font-mono font-bold cursor-pointer select-none ${
                    !is3D ? '!bg-amber-500 !text-black shadow-[0_0_8px_rgba(245,158,11,0.2)]' : ''
                  }`}
                >
                  2D
                </button>
                <button
                  type="button"
                  onClick={() => setIs3D(true)}
                  className={`px-1.5 py-0.5 rounded transition bg-transparent text-gray-400 hover:text-white font-mono font-bold cursor-pointer select-none ${
                    is3D ? '!bg-amber-500 !text-black shadow-[0_0_8px_rgba(245,158,11,0.2)]' : ''
                  }`}
                >
                  3D
                </button>
              </div>

              {/* Enter fullscreen */}
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                title="Full Screen Mode"
                className="text-[8px] font-bold text-amber-500 cursor-pointer border border-amber-500/20 px-1.5 py-0.5 rounded-md bg-gray-900/40 hover:bg-amber-500/10 transition-all uppercase flex items-center gap-1 select-none"
              >
                <Maximize2 className="w-2 h-2" /> Full Screen
              </button>
            </div>
          </div>

          {/* Layer Visibility Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1 mb-1.5 w-full z-10">
            <button
              onClick={() => setShowStator(!showStator)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8.5px] font-bold transition-all cursor-pointer select-none ${
                showStator 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                  : 'bg-gray-900/30 border-gray-900 text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${showStator ? 'bg-blue-500 animate-pulse' : 'bg-gray-700'}`} />
              Stator
            </button>

            <button
              onClick={() => setShowRotor(!showRotor)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8.5px] font-bold transition-all cursor-pointer select-none ${
                showRotor 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold' 
                  : 'bg-gray-900/30 border-gray-900 text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${showRotor ? 'bg-amber-500 animate-pulse' : 'bg-gray-700'}`} />
              Rotor
            </button>

            <button
              onClick={() => setShowWinding(!showWinding)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8.5px] font-bold transition-all cursor-pointer select-none ${
                showWinding 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold' 
                  : 'bg-gray-900/30 border-gray-900 text-gray-550 hover:text-gray-400'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${showWinding ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
              Windings
            </button>

            <button
              onClick={() => setShowMmf(!showMmf)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8.5px] font-bold transition-all cursor-pointer select-none ${
                showMmf 
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-450' 
                  : 'bg-gray-900/30 border-gray-900 text-gray-555 hover:text-gray-400'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${showMmf ? 'bg-orange-500 animate-pulse' : 'bg-gray-700'}`} />
              MMF
            </button>

            <button
              onClick={() => setShowFluxLines(!showFluxLines)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8.5px] font-bold transition-all cursor-pointer select-none ${
                showFluxLines 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold' 
                  : 'bg-gray-900/30 border-gray-900 text-gray-555 hover:text-gray-400'
              }`}
            >
              <div className={`w-1 h-1 rounded-full ${showFluxLines ? 'bg-amber-500 animate-pulse' : 'bg-gray-700'}`} />
              Flux Lines
            </button>
          </div>

          {/* Phase toggles (shown only if showWinding is true) */}
          {showWinding && (
            <div className="flex items-center justify-center gap-1 mb-1 w-full animate-fadeIn z-10 transition-all">
              <button
                onClick={() => setShowPhaseA(!showPhaseA)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-bold transition-all cursor-pointer select-none ${
                  showPhaseA
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 font-semibold shadow-[0_0_4px_rgba(239,68,68,0.1)]'
                    : 'bg-gray-900/30 border-gray-900 text-gray-500'
                }`}
              >
                <div className={`w-1 h-1 rounded-full ${showPhaseA ? 'bg-red-500 shadow-[0_0_4px_#ef4444]' : 'bg-gray-700'}`} />
                Phase A
              </button>
              <button
                onClick={() => setShowPhaseB(!showPhaseB)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-bold transition-all cursor-pointer select-none ${
                  showPhaseB
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold shadow-[0_0_4px_rgba(16,185,129,0.1)]'
                    : 'bg-gray-900/30 border-gray-900 text-gray-500'
                }`}
              >
                <div className={`w-1 h-1 rounded-full ${showPhaseB ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-gray-700'}`} />
                Phase B
              </button>
              <button
                onClick={() => setShowPhaseC(!showPhaseC)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-bold transition-all cursor-pointer select-none ${
                  showPhaseC
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-semibold shadow-[0_0_4px_rgba(59,130,246,0.1)]'
                    : 'bg-gray-900/30 border-gray-900 text-gray-500'
                }`}
              >
                <div className={`w-1 h-1 rounded-full ${showPhaseC ? 'bg-blue-500 shadow-[0_0_4px_#3b82f6]' : 'bg-gray-700'}`} />
                Phase C
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full lg:w-[350px] bg-gray-900/40 p-5 rounded-2xl border border-gray-800 font-mono flex flex-col gap-4 shrink-0 z-10 max-h-full overflow-y-auto custom-scrollbar shadow-2xl">
          {/* Cybernetic header */}
          <div className="w-full flex justify-between items-center mb-1 border-b border-gray-900 pb-2 z-10 font-mono">
            <h3 className="text-xs font-semibold tracking-wider text-amber-500 uppercase flex items-center gap-1.5">
              Motor Geometry Workspace
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 tracking-widest uppercase">
                WORKSPACE
              </span>
              <span className="text-[8.5px] text-gray-600 tracking-widest uppercase font-bold">
                {is3D ? '3D' : '2D'}
              </span>
            </div>
          </div>

          {/* 2D / 3D Mode Toggle Pill Selector */}
          <div className="flex bg-gray-900 border border-gray-850 p-0.5 rounded-lg mb-2 w-full max-w-[280px] z-10 self-center font-mono">
            <button
              onClick={() => setIs3D(false)}
              className={`flex-1 text-center py-1 rounded-md text-[10.5px] font-semibold cursor-pointer select-none transition-all ${
                !is3D 
                  ? 'bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              2D view
            </button>
            <button
              onClick={() => setIs3D(true)}
              className={`flex-1 text-center py-1 rounded-md text-[10.5px] font-semibold cursor-pointer select-none transition-all ${
                is3D 
                  ? 'bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              3D cylinder
            </button>
          </div>

          {is3D ? (
            <div className="flex items-center justify-between gap-3 mb-2 w-full max-w-[320px] z-10 self-center font-mono text-[9px] text-gray-500 animate-fadeIn select-none">
              <div className="flex bg-gray-900 border border-gray-850 p-0.5 rounded">
                <button
                  onClick={() => setInteractionMode('orbit')}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition-all ${
                    interactionMode === 'orbit' 
                      ? 'bg-amber-500/15 text-amber-400 font-bold' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Orbit
                </button>
                <button
                  onClick={() => setInteractionMode('pan')}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition-all ${
                    interactionMode === 'pan' 
                      ? 'bg-amber-500/15 text-amber-400 font-bold' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Pan
                </button>
              </div>
              <button 
                onClick={handleResetOrbit}
                className="text-amber-500/95 hover:text-amber-400 cursor-pointer border border-amber-500/20 px-1.5 py-0.5 rounded hover:bg-amber-500/10 transition-all uppercase font-bold text-[8.5px]"
              >
                Reset Angle
              </button>
            </div>
          ) : (
            <div className="text-[9px] text-gray-500 font-mono mb-2 uppercase tracking-wide flex items-center justify-center gap-1 select-none w-full">
              <span>✋ Drag with mouse/touch to Pan visual</span>
            </div>
          )}

          {/* Layer Visibility Cyber-Checkboxes */}
          <div className="grid grid-cols-2 gap-1.5 mb-2 w-full z-10">
            <button
              onClick={() => setShowStator(!showStator)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                showStator 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-semibold shadow-[0_0_8px_rgba(59,130,246,0.15)]' 
                  : 'bg-gray-900/30 border-gray-905 text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showStator ? 'bg-blue-500 animate-pulse' : 'bg-gray-700'}`} />
              Stator
            </button>

            <button
              onClick={() => setShowRotor(!showRotor)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                showRotor 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-450 font-semibold shadow-[0_0_8px_rgba(245,158,11,0.15)]' 
                  : 'bg-gray-900/30 border-gray-905 text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showRotor ? 'bg-amber-500 animate-pulse' : 'bg-gray-700'}`} />
              Rotor
            </button>

            <button
              onClick={() => setShowWinding(!showWinding)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                showWinding 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold shadow-[0_0_8px_rgba(16,185,129,0.15)]' 
                  : 'bg-gray-900/30 border-gray-905 text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showWinding ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
              Windings
            </button>

            <button
              onClick={() => setShowMmf(!showMmf)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                showMmf 
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-450 font-semibold shadow-[0_0_8px_rgba(249,115,22,0.15)]' 
                  : 'bg-gray-900/30 border-gray-905 text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showMmf ? 'bg-orange-500 animate-pulse' : 'bg-gray-700'}`} />
              MMF Stair
            </button>

            <button
              onClick={() => setShowFluxLines(!showFluxLines)}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                showFluxLines 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-455 font-semibold shadow-[0_0_8px_rgba(245,158,11,0.15)]' 
                  : 'bg-gray-900/30 border-gray-905 text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showFluxLines ? 'bg-amber-500 animate-pulse' : 'bg-gray-700'}`} />
              Flux Lines
            </button>
          </div>

          {/* Phase Wise Windings Visibility toggles */}
          {showWinding && (
            <div className="flex flex-wrap justify-center gap-1.5 mb-2 w-full z-10 animate-fadeIn">
              <button
                onClick={() => setShowPhaseA(!showPhaseA)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[9px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                  showPhaseA
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 font-semibold shadow-[0_0_4px_rgba(239,68,68,0.2)]'
                    : 'bg-gray-900/30 border-gray-900 text-gray-500 hover:text-gray-455'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${showPhaseA ? 'bg-red-500 shadow-[0_0_4px_#ef4444]' : 'bg-gray-700'}`} />
                Phase A
              </button>
              
              <button
                onClick={() => setShowPhaseB(!showPhaseB)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[9px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                  showPhaseB
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold shadow-[0_0_4px_rgba(16,185,129,0.2)]'
                    : 'bg-gray-900/30 border-gray-900 text-gray-500 hover:text-gray-455'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${showPhaseB ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-gray-700'}`} />
                Phase B
              </button>

              <button
                onClick={() => setShowPhaseC(!showPhaseC)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[9px] font-mono tracking-wide transition-all cursor-pointer select-none ${
                  showPhaseC
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-semibold shadow-[0_0_4px_rgba(59,130,246,0.2)]'
                    : 'bg-gray-900/30 border-gray-900 text-gray-500 hover:text-gray-455'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${showPhaseC ? 'bg-blue-500 shadow-[0_0_4px_#3b82f6]' : 'bg-gray-700'}`} />
                Phase C
              </button>
            </div>
          )}

          {/* Zoom Controllers & Sector Presets */}
          <div className="flex flex-col border border-gray-900 bg-gray-900/40 p-2.5 rounded-xl gap-2 mt-auto">
            <div className="flex items-center justify-between font-mono text-[9px] text-gray-400 font-bold select-none">
              <span>Zoom Navigation</span>
              <span><strong className="text-amber-500">{zoomScale.toFixed(2)}x</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-mono w-full">
              <button 
                type="button"
                onClick={handleZoomOut}
                disabled={zoomScale <= 1}
                className="flex-1 py-1 rounded bg-gray-950 border border-gray-850 text-gray-400 hover:text-white disabled:opacity-35 cursor-pointer select-none flex justify-center text-xs font-bold"
              >
                -
              </button>
              <button 
                type="button"
                onClick={handleZoomIn}
                disabled={zoomScale >= 4}
                className="flex-1 py-1 rounded bg-gray-950 border border-gray-850 text-gray-400 hover:text-white disabled:opacity-35 cursor-pointer select-none flex justify-center text-xs font-bold"
              >
                +
              </button>
              <button
                type="button"
                onClick={handleResetZoomAndPan}
                className="px-2 py-1 text-[8.5px] uppercase border border-amber-500/25 text-amber-500 rounded bg-gray-950 hover:bg-amber-500/10 cursor-pointer font-bold animate-fadeIn"
              >
                Reset
              </button>
            </div>

            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[8px] text-gray-500 font-bold uppercase">Focus Sector Zone</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    applyPreset(e.target.value as any);
                  }
                }}
                className="bg-gray-950 text-gray-300 border border-gray-850 rounded text-[9.5px] px-2 py-1.5 hover:border-gray-700 transition-colors uppercase font-bold outline-none cursor-pointer w-full"
              >
                <option value="" disabled>Select Target Slot Zone</option>
                <option value="full">🌐 Full Motor View</option>
                <option value="stator">🦷 Stator Teeth & Slots</option>
                <option value="airgap">🌀 Air Gap Boundary</option>
                <option value="rotor">🧺 Rotor Winding Bars</option>
                <option value="shaft">❄️ Mechanical Shaft</option>
              </select>
            </div>
          </div>

          {/* Exit Fullscreen button placed neatly at the bottom only in Fullscreen controls column */}
          {!embedFullscreen && (
            <button
              onClick={() => {
                setIsFullscreen(false);
                handleResetZoomAndPan();
              }}
              className="mt-4 py-2.5 w-full bg-red-400/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5 text-xs font-bold font-mono shadow-md"
            >
              <Minimize2 className="w-4 h-4" /> Exit Fullscreen
            </button>
          )}
        </div>
      )}

      {/* Right visualization stage column */}
      <div className={
        (isFullscreen || embedFullscreen)
          ? "flex-1 flex flex-col justify-center items-center relative h-full w-full max-w-none z-10" 
          : "w-full flex-1 flex flex-col items-center justify-center relative mt-1"
      }>
        {/* The 3D Canvas Stage viewport */}
        <div 
          className={`relative w-full aspect-square flex items-center justify-center ${
            (isFullscreen || embedFullscreen)
              ? 'max-w-[min(90vw,70vh)] shadow-[0_0_60px_rgba(0,0,0,0.85)] border-gray-800' 
              : 'max-w-[340px] shadow-[0_0_20px_rgba(0,0,0,0.5)] border-gray-900'
          } ${
            is3D 
              ? (interactionMode === 'pan' ? 'cursor-move' : 'cursor-grab active:cursor-grabbing') 
              : 'cursor-move'
          } select-none overflow-hidden rounded-2xl border bg-black/40`} 
          style={{ perspective: '1200px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
        >
          {/* FLOATING OVERLAYS INSIDE THE VIEWPORT (In both or normal layout mode) */}
          {/* Top-Left: View State Badge */}
          <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none z-25 font-mono select-none">
            <div className="bg-black/65 backdrop-blur-md border border-gray-900/60 rounded px-1.5 py-0.5 text-[8.5px] font-bold text-gray-400 tracking-wide uppercase">
              {is3D ? '3D Cylinder View' : '2D Cross Section'}
            </div>
            <div className="text-[7.5px] text-gray-500 font-medium tracking-wide bg-black/45 backdrop-blur-md rounded px-1 py-0.2 select-none uppercase">
              {is3D ? (interactionMode === 'pan' ? '✋ Tool: Pan' : '🌀 Tool: Orbit') : '✋ Tool: Pan & Drag'}
            </div>
          </div>

          {/* Top-Right: Quick 3D mode controls inside canvas for normal mode */}
          {is3D && !isFullscreen && (
            <div className="absolute top-3 right-3 flex items-center bg-black/85 backdrop-blur-md border border-gray-900/60 rounded-md p-0.5 gap-1 shadow-md z-30 font-mono">
              <button
                onClick={() => setInteractionMode(interactionMode === 'orbit' ? 'pan' : 'orbit')}
                title={interactionMode === 'orbit' ? "Switch to Pan" : "Switch to Orbit"}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition ${
                  interactionMode === 'orbit' ? 'text-amber-500 font-black' : 'text-gray-400'
                }`}
              >
                Orbit
              </button>
              <button
                onClick={() => setInteractionMode(interactionMode === 'pan' ? 'orbit' : 'pan')}
                title={interactionMode === 'pan' ? "Switch to Orbit" : "Switch to Pan"}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition ${
                  interactionMode === 'pan' ? 'text-amber-500 font-black' : 'text-gray-400'
                }`}
              >
                Pan
              </button>
              <button 
                onClick={handleResetOrbit}
                title="Reset Angle to zero"
                className="text-amber-500 text-[8px] font-mono border-l border-gray-900 pl-1.5 hover:text-amber-400 cursor-pointer font-bold"
              >
                Reset
              </button>
            </div>
          )}

          {/* Bottom-Left: custom inside-canvas sector preset dropdown button */}
          {!isFullscreen && (
            <div className="absolute bottom-3 left-3 flex items-center z-30 font-mono">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    applyPreset(e.target.value as any);
                  }
                }}
                className="bg-black/75 hover:bg-black/95 text-gray-300 border border-gray-850/60 hover:border-gray-700 rounded text-[8px] font-bold px-1.5 py-0.5 outline-none cursor-pointer transition-colors max-w-[100px] shadow-lg"
              >
                <option value="" disabled>Focus Zone</option>
                <option value="full">🌐 Full</option>
                <option value="stator">🦷 Slots</option>
                <option value="airgap">🌀 AirGap</option>
                <option value="rotor">🧺 Rotor</option>
                <option value="shaft">❄️ Shaft</option>
              </select>
            </div>
          )}

          {/* Bottom-Right: custom inside-canvas zoom widgets for normal mode */}
          {!isFullscreen && (
            <div className="absolute bottom-3 right-3 flex items-center bg-black/75 border border-gray-850/60 p-0.5 rounded-md gap-1 shadow-lg z-30 font-mono text-[8px] text-gray-400 font-bold">
              <span className="px-1 font-mono">{zoomScale.toFixed(1)}x</span>
              <div className="flex border-l border-gray-900/60 pl-1 gap-0.5">
                <button 
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 1}
                  className="px-1 py-0.2 rounded bg-gray-900 border border-gray-850 text-gray-300 disabled:opacity-30 cursor-pointer flex items-center font-bold"
                >
                  -
                </button>
                <button 
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 4}
                  className="px-1 py-0.2 rounded bg-gray-900 border border-gray-850 text-gray-300 disabled:opacity-30 cursor-pointer flex items-center font-bold"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleResetZoomAndPan}
                  className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/15 text-amber-500 cursor-pointer text-[7px] font-bold"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div
            className="w-full h-full relative"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
              transition: (isOrbiting || isPanning) ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: 'preserve-3d',
                transform: is3D 
                  ? `rotateX(${orbitAngleX}deg) rotateZ(${orbitAngleZ}deg) translateY(-25px) scale(0.85)` 
                  : 'rotateX(0deg) rotateZ(0deg) translateY(0px) scale(1)',
                transition: isOrbiting ? 'none' : 'transform 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {/* DEFINITIONS DEF GRID */}
              <svg className="w-0 h-0 absolute">
                <defs>
                  <radialGradient id="rotorGlow" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="85%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#020617" />
                  </radialGradient>
              
              <radialGradient id="yokeGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="70%" stopColor="#334155" />
                <stop offset="95%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </radialGradient>

              <filter id="glow-wave" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              
              <marker id="arrowRed" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ef4444" />
              </marker>

              <marker id="arrowBlue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
              </marker>
            </defs>
          </svg>

          {/* LAYER 6: REAR STATOR COVER & REAR WINDING END-TURNS (translateZ(-130px)) */}
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              transform: `translate3d(0, 0, ${is3D ? '-130px' : '0px'})`,
              opacity: is3D ? 0.75 : 0,
              pointerEvents: 'none',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Stator backside frame circle */}
            {showStator && (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={rStatorOuter}
                  fill="#090d16"
                  stroke="#1e293b"
                  strokeWidth="2"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={rStatorInner}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
              </>
            )}

            {/* Backlap copper coil end turn loops */}
            {showWinding && windingEndTurns.filter(turn => isPhaseVisible(turn.phase)).map((turn, tIdx) => (
              <path
                key={`end-turn-back-${tIdx}`}
                d={turn.path}
                fill="none"
                stroke={turn.color}
                strokeWidth="2"
                opacity="0.8"
                style={{ filter: `drop-shadow(0px 0px 3.5px ${turn.color})` }}
                strokeDasharray="none"
              />
            ))}
          </svg>

          {/* LAYER 5: REAR ROTOR ENDPLATE (translateZ(-105px)) */}
          {showRotor && (
            <svg
              viewBox="0 0 500 500"
              className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                transform: `translate3d(0, 0, ${is3D ? '-105px' : '0px'})`,
                opacity: is3D ? 0.8 : 0,
                pointerEvents: 'none',
                transformStyle: 'preserve-3d',
              }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={rRotorOuter}
                fill="url(#rotorGlow)"
                stroke="#334155"
                strokeWidth="1.5"
              />
              <g transform={`rotate(${rotorAngleDeg} ${cx} ${cy})`}>
                {/* Central shaft backing */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={rRotorInner}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="2.5"
                />
                <circle cx={cx} cy={cy} r="10" fill="#020617" />
              </g>
            </svg>
          )}

          {/* HOUSING OUTER CASING RIBS (stationary, z from -130px to 0px) */}
          {is3D && showStator && Array.from({ length: 8 }).map((_, idx) => {
            const theta = (idx * 2 * Math.PI) / 8;
            const rx = cx + (rStatorOuter - 1.5) * Math.cos(theta);
            const ry = cy + (rStatorOuter - 1.5) * Math.sin(theta);
            return (
              <div
                key={`outer-rib-${idx}`}
                className="absolute pointer-events-none rounded-sm"
                style={{
                  left: `${(rx / 500) * 100}%`,
                  top: `${(ry / 500) * 100}%`,
                  width: '3.5px',
                  height: '130px',
                  background: 'linear-gradient(to bottom, #1e293b, #475569 50%, #0f172a)',
                  transformOrigin: 'top center',
                  transform: `translate3d(-1.75px, -1.75px, -130px) rotateX(90deg) rotateY(${theta}rad)`,
                  opacity: 0.65,
                  boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                }}
              />
            );
          })}

          {/* STATOR COPPER SLOT WINDING BARS (stationary, z from -130px to 0px) */}
          {is3D && showWinding && slotElements.map((el) => {
            const tPhase = el.top.phase;
            const bPhase = el.bottom.phase;
            const tColor = phaseColors[tPhase];
            const bColor = phaseColors[bPhase];
            const tOpacity = 0.22 + 0.58 * (el.top.absCur / Math.max(0.1, settings.amplitude));
            const bOpacity = 0.22 + 0.58 * (el.bottom.absCur / Math.max(0.1, settings.amplitude));

            return (
              <React.Fragment key={`slot-rods-3d-${el.slotIndex}`}>
                {/* Top Conductor axial rod (near airgap) */}
                {isPhaseVisible(tPhase) && (
                  <div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      left: `${(el.xTop / 500) * 100}%`,
                      top: `${(el.yTop / 500) * 100}%`,
                      width: '2px',
                      height: '130px',
                      background: `linear-gradient(to bottom, ${tColor}, ${tColor}cc 80%, #1e1e1e)`,
                      transformOrigin: 'top center',
                      transform: 'translate3d(-1px, -1px, -130px) rotateX(90deg)',
                      opacity: tOpacity,
                      filter: el.top.absCur > settings.amplitude * 0.7 ? `drop-shadow(0 0 3px ${tColor})` : 'none',
                    }}
                  />
                )}
                {/* Bottom Conductor axial rod (outer slot boundary) */}
                {isPhaseVisible(bPhase) && (
                  <div
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      left: `${(el.xBot / 500) * 100}%`,
                      top: `${(el.yBot / 500) * 100}%`,
                      width: '2px',
                      height: '130px',
                      background: `linear-gradient(to bottom, ${bColor}, ${bColor}cc 80%, #1e1e1e)`,
                      transformOrigin: 'top center',
                      transform: 'translate3d(-1px, -1px, -130px) rotateX(90deg)',
                      opacity: bOpacity,
                      filter: el.bottom.absCur > settings.amplitude * 0.7 ? `drop-shadow(0 0 3px ${bColor})` : 'none',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* ROTATING ROTOR 3D ELEMENTS (z from -105px to 0px, rotating at rotorAngleDeg) */}
          {is3D && showRotor && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateZ(${rotorAngleDeg}deg)`,
              }}
            >
              {/* 1. Rotor squirrel-cage axial copper rods */}
              {Array.from({ length: 18 }).map((_, index) => {
                const rAngle = (index * 2 * Math.PI) / 18;
                const rx = cx + (rRotorOuter - 10) * Math.cos(rAngle);
                const ry = cy + (rRotorOuter - 10) * Math.sin(rAngle);
                return (
                  <div
                    key={`rotor-cage-bar-3d-${index}`}
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      left: `${(rx / 500) * 100}%`,
                      top: `${(ry / 500) * 100}%`,
                      width: '2px',
                      height: '105px',
                      background: 'linear-gradient(to bottom, #f59e0b, #b45309)',
                      transformOrigin: 'top center',
                      transform: 'translate3d(-1px, -1px, -105px) rotateX(90deg)',
                      opacity: 0.75,
                    }}
                  />
                );
              })}

              {/* 2. Central steel shaft cylindrical sleeve ribs */}
              {Array.from({ length: 6 }).map((_, sIdx) => {
                const sAngle = (sIdx * 2 * Math.PI) / 6;
                const sx = cx + (rRotorInner - 0.5) * Math.cos(sAngle);
                const sy = cy + (rRotorInner - 0.5) * Math.sin(sAngle);
                return (
                  <div
                    key={`rotor-shaft-rib-3d-${sIdx}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${(sx / 500) * 100}%`,
                      top: `${(sy / 500) * 100}%`,
                      width: '2.5px',
                      height: '150px',
                      background: 'linear-gradient(to bottom, #475569, #94a3b8 40%, #1e293b)',
                      transformOrigin: 'top center',
                      transform: `translate3d(-1.25px, -1.25px, -125px) rotateX(90deg) rotateY(${sAngle}rad)`,
                      opacity: 0.8,
                    }}
                  />
                );
              })}

              {/* 3. Rear mechanical cooling fan */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: 'translate3d(0, 0, -121px)',
                }}
              >
                {/* Hub */}
                <div 
                  className="absolute w-[44px] h-[44px] rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg"
                  style={{ transform: 'translate3d(0, 0, 1px)' }}
                />
                {/* 6 pitched fan blades */}
                {Array.from({ length: 6 }).map((_, fIdx) => {
                  const fAngle = (fIdx * 360) / 6;
                  return (
                    <div
                      key={`fan-blade-${fIdx}`}
                      className="absolute w-[16px] h-[46px] bg-slate-900 border border-slate-705 rounded-t-xl opacity-90 shadow-md"
                      style={{
                        transformOrigin: 'bottom center',
                        transform: `translateY(-23px) rotateZ(${fAngle}deg) rotateY(28deg)`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* LAYER 4: STATOR & ROTOR INTERMEDIATE LAMINATION CORE STACK SHEETS */}
          {/* Denser 4-sheet stack to create a volumetric continuous cylinder feel */}
          {[1, 2, 3, 4].map((lIdx) => {
            const zRotorDepth = -21 * lIdx; // spacing rotor lamination evenly to -105px
            const zStatorDepth = -26 * lIdx; // spacing stator lamination evenly to -130px
            
            return (
              <React.Fragment key={`lam-bundle-${lIdx}`}>
                {/* Stator stack sheet */}
                {showStator && (
                  <svg
                    viewBox="0 0 500 500"
                    className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      transform: `translate3d(0, 0, ${is3D ? `${zStatorDepth}px` : '0px'})`,
                      opacity: is3D ? 0.28 : 0,
                      pointerEvents: 'none',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <path
                      d={statorTeethPath}
                      fill="#070a12"
                      stroke="#0f172a"
                      strokeWidth="1"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={rStatorInner}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />

                    {/* Windings conductor cores passing through slot laminations */}
                    {showWinding && slotElements.map((el) => {
                      const topP = el.top.phase;
                      const botP = el.bottom.phase;
                      return (
                        <g key={`cond-lam-${lIdx}-${el.slotIndex}`}>
                          {isPhaseVisible(topP) && <circle cx={el.xTop} cy={el.yTop} r="3.5" fill={phaseColors[topP]} opacity="0.4" />}
                          {isPhaseVisible(botP) && <circle cx={el.xBot} cy={el.yBot} r="3.5" fill={phaseColors[botP]} opacity="0.4" />}
                        </g>
                      );
                    })}
                  </svg>
                )}

                {/* Rotor stack sheet */}
                {showRotor && (
                  <svg
                    viewBox="0 0 500 500"
                    className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      transform: `translate3d(0, 0, ${is3D ? `${zRotorDepth}px` : '0px'})`,
                      opacity: is3D ? 0.38 : 0,
                      pointerEvents: 'none',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={rRotorOuter}
                      fill="#0f172a"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    <g transform={`rotate(${rotorAngleDeg} ${cx} ${cy})`}>
                      {/* Ventilation cooling holes stack alignment */}
                      {Array.from({ length: 4 }).map((_, idx) => {
                        const rAngle = (idx * 2 * Math.PI) / 4 + Math.PI / 4;
                        const xd = cx + 55 * Math.cos(rAngle);
                        const yd = cy + 55 * Math.sin(rAngle);
                        return (
                          <circle
                            key={`rotor-duct-lam-${lIdx}-${idx}`}
                            cx={xd}
                            cy={yd}
                            r="6"
                            fill="#020617"
                          />
                        );
                      })}

                      {/* Copper rotor cage rods */}
                      {Array.from({ length: 18 }).map((_, rIdx) => {
                        const rAngle = (rIdx * 2 * Math.PI) / 18;
                        const xb = cx + (rRotorOuter - 10) * Math.cos(rAngle);
                        const yb = cy + (rRotorOuter - 10) * Math.sin(rAngle);
                        return (
                          <circle
                            key={`rotor-bar-lam-${lIdx}-${rIdx}`}
                            cx={xb}
                            cy={yb}
                            r="3.5"
                            fill="#b45309"
                            opacity="0.6"
                          />
                        );
                      })}
                    </g>
                  </svg>
                )}
              </React.Fragment>
            );
          })}

          {/* LAYER 3: ACTIVE 2D FRONT FACE CORE ASSEMBLY (translateZ(0px)) */}
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full select-none absolute inset-0"
            style={{
              transform: 'translate3d(0, 0, 0px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* STATOR CORE COILS BACKGROUND & SOLID IRON SHIELD */}
            {showStator && (
              <g>
                {/* Bracket perimeter dial */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={rOuterFrame}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="3"
                  strokeDasharray="4 8"
                />
                {/* Stator yoke ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={rStatorOuter}
                  fill="url(#yokeGlow)"
                  stroke="#1e293b"
                  strokeWidth="2"
                />
                {/* Slotted teeth paths */}
                <path
                  d={statorTeethPath}
                  fill="#090d16"
                  stroke="#1e293b"
                  strokeWidth="2"
                />
                {/* Bore rim ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={rStatorInner}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2.5"
                />
              </g>
            )}

            {/* WINDING LAYER (Conductors and active cross/dot currents) */}
            {showWinding && (
              <g>
                {/* Front winding loop end turns */}
                {windingEndTurns.filter(turn => isPhaseVisible(turn.phase)).map((turn, tIdx) => (
                  <path
                    key={`end-turn-front-${tIdx}`}
                    d={turn.path}
                    fill="none"
                    stroke={turn.color}
                    strokeWidth="1.8"
                    opacity="0.32"
                    strokeDasharray="2.5 2.5"
                  />
                ))}

                {slotElements.map((el) => {
                  const topOpacity = 0.35 + 0.65 * (el.top.absCur / Math.max(0.1, settings.amplitude));
                  const botOpacity = 0.35 + 0.65 * (el.bottom.absCur / Math.max(0.1, settings.amplitude));

                  const topP = el.top.phase;
                  const botP = el.bottom.phase;

                  return (
                    <g key={`slot-cond-${el.slotIndex}`}>
                      {/* Slot backing */}
                      <circle
                        cx={el.xSlot}
                        cy={el.ySlot}
                        r={rSlotBacking}
                        fill="#030712"
                        stroke="#334155"
                        strokeWidth="1"
                        opacity="0.8"
                      />

                      {/* Top layer conductor */}
                      {isPhaseVisible(topP) && (
                        <>
                          <circle
                            cx={el.xTop}
                            cy={el.yTop}
                            r={rCondIndicator}
                            fill={phaseColors[topP]}
                            stroke={phaseBeautColors[topP].border}
                            strokeWidth="1"
                            opacity={topOpacity}
                            style={{ filter: el.top.absCur > settings.amplitude * 0.7 ? 'drop-shadow(0px 0px 4.5px ' + phaseColors[topP] + ')' : 'none' }}
                          />
                          {renderConductorSymbol(el.xTop, el.yTop, el.top.current, rCondIndicator)}
                        </>
                      )}

                      {/* Bottom layer conductor */}
                      {isPhaseVisible(botP) && (
                        <>
                          <circle
                            cx={el.xBot}
                            cy={el.yBot}
                            r={rCondIndicator}
                            fill={phaseColors[botP]}
                            stroke={phaseBeautColors[botP].border}
                            strokeWidth="1"
                            opacity={botOpacity}
                            style={{ filter: el.bottom.absCur > settings.amplitude * 0.7 ? 'drop-shadow(0px 0px 4.5px ' + phaseColors[botP] + ')' : 'none' }}
                          />
                          {renderConductorSymbol(el.xBot, el.yBot, el.bottom.current, rCondIndicator)}
                        </>
                      )}

                      {/* Peripheral Slot indicators text */}
                      {S <= 18 && (
                        <text
                          x={cx + (rBotCond + 22) * Math.cos(el.theta)}
                          y={cy + (rBotCond + 22) * Math.sin(el.theta) + 3}
                          className="fill-gray-500 font-mono text-[8px]"
                          textAnchor="middle"
                        >
                          S{el.slotIndex + 1}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* AIRGAP INTERMEDIATE REGION */}
            {showStator && showRotor && (
              <rect x={cx - 1} y={cy - rStatorInner} width="2" height={rStatorInner - rRotorOuter} fill="rgba(251,191,36,0.3)" />
            )}

            {/* ROTOR ASSEMBLY FRAME */}
            {showRotor && (
              <g transform={`rotate(${rotorAngleDeg} ${cx} ${cy})`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={rRotorOuter}
                  fill="url(#rotorGlow)"
                  stroke="#334155"
                  strokeWidth="2"
                />

                {/* Rotor bars */}
                {Array.from({ length: 18 }).map((_, index) => {
                  const rAngle = (index * 2 * Math.PI) / 18;
                  const xb = cx + (rRotorOuter - 10) * Math.cos(rAngle);
                  const yb = cy + (rRotorOuter - 10) * Math.sin(rAngle);

                  return (
                    <circle
                      key={`rotor-bar-${index}`}
                      cx={xb}
                      cy={yb}
                      r="4.5"
                      fill="#b45309"
                      stroke="#d97706"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Cooling ducts holes */}
                {Array.from({ length: 4 }).map((_, idx) => {
                  const rAngle = (idx * 2 * Math.PI) / 4 + Math.PI / 4;
                  const xd = cx + 55 * Math.cos(rAngle);
                  const yd = cy + 55 * Math.sin(rAngle);
                  return (
                    <circle
                      key={`rotor-duct-${idx}`}
                      cx={xd}
                      cy={yd}
                      r="7"
                      fill="#020617"
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Central Keyway and shaft */}
                <rect
                  x={cx - 5}
                  y={cy - rRotorInner - 4}
                  width="10"
                  height="10"
                  fill="#475569"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={rRotorInner}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="3.5"
                />
                <circle cx={cx} cy={cy} r="10" fill="#020617" />
              </g>
            )}
          </svg>

          {/* LAYER: FLUX LINES (translateZ(12px)) */}
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              transform: `translate3d(0, 0, ${is3D ? '12px' : '0px'})`,
              opacity: showFluxLines ? 0.8 : 0,
              pointerEvents: 'none',
              transformStyle: 'preserve-3d',
            }}
          >
            {fluxPaths.map((pObj, idx) => (
              <path
                key={`flux-path-${idx}`}
                d={pObj.path}
                fill="none"
                stroke={pObj.type === 'stator' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(245, 158, 11, 0.55)'}
                strokeWidth={pObj.type === 'stator' ? '1.2' : '1.5'}
                strokeDasharray="6 8"
                className="animate-flux"
                style={{
                  filter: pObj.type === 'stator' 
                    ? 'drop-shadow(0px 0px 2px rgba(56, 189, 248, 0.45))' 
                    : 'drop-shadow(0px 0px 2.5px rgba(245, 158, 11, 0.45))'
                }}
              />
            ))}
          </svg>

          {/* LAYER 2: MMF WAVEFORMS (translateZ(25px)) - FLOATS MAJESTICALLY IN space */}
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              transform: `translate3d(0, 0, ${is3D ? '25px' : '0px'})`,
              opacity: showMmf ? 1 : 0,
              pointerEvents: 'none',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base concentric circle */}
            <circle
              cx={cx}
              cy={cy}
              r={mmfScaleBase}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.4"
            />

            {/* MMF Staircase Wave */}
            {showMmf && MmfStairPath && (
              <g>
                <path
                  d={MmfStairPath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  style={{ filter: 'drop-shadow(0px 0px 4.5px rgba(245, 158, 11, 0.65))' }}
                />
                <path
                  d={MmfStairPath}
                  fill="rgba(245, 158, 11, 0.08)"
                  stroke="none"
                />
              </g>
            )}

            {/* Ideal fundamental wave */}
            {showMmf && MmfFundPath && (
              <path
                d={MmfFundPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeDasharray="4 2.5"
                opacity="0.85"
              />
            )}
          </svg>

          {/* LAYER 1: ROTATING MAGNETIC VECTORS & POLES POINTE (translateZ(55px)) */}
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full select-none absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              transform: `translate3d(0, 0, ${is3D ? '55px' : '0px'})`,
              opacity: showStator && (showMmf || showFluxLines) ? 0.95 : 0,
              pointerEvents: 'none',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Definition for marker arrows on this Layer */}
            <defs>
              <marker id="arrowRed3" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ef4444" />
              </marker>
              <marker id="arrowBlue3" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
              </marker>
            </defs>

            {poleVectors.map((vec, idx) => {
              const isNorth = vec.type === 'North';
              
              return (
                <g key={`pole-vec-3d-${idx}`}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={vec.x}
                    y2={vec.y}
                    stroke={vec.color}
                    strokeWidth={isNorth ? '3' : '1.5'}
                    strokeDasharray={isNorth ? 'none' : '2 2'}
                    markerEnd={isNorth ? 'url(#arrowRed3)' : 'url(#arrowBlue3)'}
                    style={{ filter: `drop-shadow(0px 0px 4px ${vec.glow})` }}
                  />
                  
                  {/* Glowing Pole Tags rotating */}
                  <g>
                    <circle
                      cx={cx + (rOuterFrame - 15) * Math.cos(vec.angle)}
                      cy={cy + (rOuterFrame - 15) * Math.sin(vec.angle)}
                      r="10"
                      fill={isNorth ? '#991b1b' : '#1e40af'}
                      stroke={vec.color}
                      strokeWidth="1"
                    />
                    <text
                      x={cx + (rOuterFrame - 15) * Math.cos(vec.angle)}
                      y={cy + (rOuterFrame - 15) * Math.sin(vec.angle) + 3}
                      className="fill-white font-mono text-[9px] font-bold"
                      textAnchor="middle"
                    >
                      {isNorth ? 'N' : 'S'}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
          </div>
        </div>
      </div>

      {/* Legend & Summary Info */}
      <div className="w-full mt-4 bg-gray-900/60 border border-gray-800/80 p-3 rounded-lg flex flex-col md:flex-row items-stretch md:items-center justify-between text-xs gap-3 font-mono">
        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-center md:justify-start">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-[#fca5a5]" />
            <span className="text-gray-300">Phase A</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#10b981] border border-[#6ee7b7]" />
            <span className="text-gray-300">Phase B</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#3b82f6] border border-[#93c5fd]" />
            <span className="text-gray-300">Phase C</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-center md:justify-end text-right border-t md:border-t-0 border-gray-800 pt-2 md:pt-0">
          <div className="flex items-center gap-1.5 opacity-90">
            <span className="w-3 h-0.5 bg-amber-500 inline-block shadow-[0_0_4px_#f59e0b]" />
            <span className="text-amber-400 font-semibold text-[11px]">MMF Staircase</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-90">
            <span className="w-3 h-0.5 border-t border-dashed border-sky-400 inline-block" />
            <span className="text-sky-400 font-semibold text-[11px]">Fundamental (Sine)</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
