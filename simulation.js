/**
 * ============================================================================
 * DIGITAL WINDMILL SIMULATION - ENGINEERING ENGINE
 * Procedural 3D WebGL Wind Farm & Electro-Mechanical Power Simulator
 * ============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. SIMULATION STATE & CONSTANTS
  // --------------------------------------------------------------------------
  const PHYSICS = {
    RHO: 1.225,       // Air density at sea level (kg/m^3)
    SWEPT_AREA: 1.0,  // Standardized rotor swept area (m^2)
    CP: 0.35,         // Betz power coefficient
    POWER_FACTOR: 0.5 * 1.225 * 1.0 * 0.35 // = 0.214375
  };

  const simState = {
    isRunning: true,
    windSpeed: 10.0,       // m/s [0 - 30]
    rotorRpm: 60.0,        // Wind Speed * 6
    powerGenerated: 214.38,// W
    terminalVoltage: 30.0, // V
    outputCurrent: 7.15,   // A
    loadPct: 50,           // % [0 - 100]
    loadPower: 107.19,     // W
    surplusPower: 107.19,  // W
    batteryPct: 50.0,      // % [0 - 100]
    isChargingOn: true,
    rotorAngle: 0,
    anemometerAngle: 0,
    peakPower: 214.38
  };

  // Chart data history buffer
  const chartHistory = {
    maxPoints: 80,
    times: [],
    powers: [],
    startTime: performance.now()
  };

  // --------------------------------------------------------------------------
  // 2. DOM ELEMENT REFERENCES
  // --------------------------------------------------------------------------
  const DOM = {
    // Navigation / Pages
    pageLanding: document.getElementById('landing-page'),
    pageSimulation: document.getElementById('simulation-page'),
    btnOpenSim: document.getElementById('btn-open-simulation'),
    btnOpenSim2: document.getElementById('btn-open-simulation-2'),
    btnBackOverview: document.getElementById('btn-back-overview'),
    btnScrollTop: document.getElementById('btn-scroll-top'),

    // Canvas Containers
    simCanvasContainer: document.getElementById('sim-canvas-container'),
    landingCanvasContainer: document.getElementById('landing-canvas-container'),

    // Status chips
    navSystemStatus: document.getElementById('nav-system-status'),
    navStatusText: document.getElementById('nav-status-text'),
    dispSysStatus: document.getElementById('disp-sys-status'),
    dispChargeState: document.getElementById('disp-charge-state'),
    dispBalanceState: document.getElementById('disp-balance-state'),

    // HUD overlays
    hudWindVal: document.getElementById('hud-wind-val'),
    hudRpmVal: document.getElementById('hud-rpm-val'),
    hudPowerVal: document.getElementById('hud-power-val'),
    hudFlowBanner: document.getElementById('hud-flow-banner'),
    flowStatusDot: document.getElementById('flow-status-dot'),
    flowStatusText: document.getElementById('flow-status-text'),

    // Controls
    btnStartSim: document.getElementById('btn-start-sim'),
    btnStopSim: document.getElementById('btn-stop-sim'),
    btnResetSim: document.getElementById('btn-reset-sim'),
    sliderWindSpeed: document.getElementById('slider-wind-speed'),
    displayWindSpeed: document.getElementById('display-wind-speed'),
    trackWindFill: document.getElementById('track-wind-fill'),
    sliderLoad: document.getElementById('slider-load'),
    displayLoad: document.getElementById('display-load'),
    trackLoadFill: document.getElementById('track-load-fill'),
    toggleCharging: document.getElementById('toggle-charging'),
    displayChargingToggle: document.getElementById('display-charging-toggle'),
    presetChips: document.querySelectorAll('.preset-chip'),

    // Camera preset buttons
    btnCamView1: document.getElementById('btn-cam-view-1'),
    btnCamView2: document.getElementById('btn-cam-view-2'),
    btnCamView3: document.getElementById('btn-cam-view-3'),
    btnCamReset: document.getElementById('btn-cam-reset'),

    // Telemetry Dashboard Readouts
    valWindSpeed: document.getElementById('val-wind-speed'),
    valRotorRpm: document.getElementById('val-rotor-rpm'),
    valGenPower: document.getElementById('val-gen-power'),
    valVoltage: document.getElementById('val-voltage'),
    valCurrent: document.getElementById('val-current'),
    valLoadPct: document.getElementById('val-load-pct'),
    valLoadPower: document.getElementById('val-load-power'),
    valSurplusPower: document.getElementById('val-surplus-power'),
    subSurplusState: document.getElementById('sub-surplus-state'),

    // Battery system
    battChargingStatus: document.getElementById('batt-charging-status'),
    displayBatteryPct: document.getElementById('display-battery-pct'),
    batteryLevelFill: document.getElementById('battery-level-fill'),
    battDetailMsg: document.getElementById('batt-detail-msg'),

    // Chart Canvas & Readouts
    chartCanvas: document.getElementById('live-power-chart'),
    chartCurP: document.getElementById('chart-cur-p'),
    chartPeakP: document.getElementById('chart-peak-p')
  };

  // --------------------------------------------------------------------------
  // 3. PHYSICAL & ELECTRICAL CALCULATIONS
  // --------------------------------------------------------------------------
  function calculatePhysics(dt) {
    if (!simState.isRunning) {
      return;
    }

    const v = simState.windSpeed;

    // Nominal rated turbine power at standard 10 m/s design point (approx 214.38 W)
    const NOMINAL_RATED_POWER = 214.375;

    // Connected Load Demand (W) based on connected consumer load percentage (0 - 100%)
    simState.loadPower = NOMINAL_RATED_POWER * (simState.loadPct / 100.0);

    if (v <= 0) {
      simState.rotorRpm = 0;
      simState.powerGenerated = 0;
      simState.terminalVoltage = 0;
      simState.outputCurrent = 0;
      // When turbine is at 0 m/s, generation is 0 W
      simState.surplusPower = -simState.loadPower;
    } else {
      // RPM = Wind Speed * 6 (Simulation educational approximation)
      simState.rotorRpm = v * 6.0;

      // Power = 0.5 * rho * A * Cp * v^3
      simState.powerGenerated = PHYSICS.POWER_FACTOR * Math.pow(v, 3);

      // Voltage = RPM * 0.5
      simState.terminalVoltage = simState.rotorRpm * 0.5;

      // Current = Power / Voltage (safe non-zero divide)
      if (simState.terminalVoltage > 0.001) {
        simState.outputCurrent = simState.powerGenerated / simState.terminalVoltage;
      } else {
        simState.outputCurrent = 0;
      }

      // Surplus Power = Generated Power - Load Power
      simState.surplusPower = simState.powerGenerated - simState.loadPower;
    }

    // Battery storage calculation
    updateBatteryStorage(dt);

    // Track peak power for chart
    if (simState.powerGenerated > simState.peakPower) {
      simState.peakPower = simState.powerGenerated;
    }

    // Update rotor rotation angle
    if (simState.rotorRpm > 0) {
      const radPerSec = (simState.rotorRpm * 2 * Math.PI) / 60.0;
      simState.rotorAngle += radPerSec * dt;
      simState.anemometerAngle += radPerSec * 1.5 * dt;
    }
  }

  function updateBatteryStorage(dt) {
    // If wind speed is 0, automatic charging must stop
    if (simState.windSpeed <= 0 && simState.isChargingOn) {
      // Automatic safety condition: when wind speed is 0 m/s, charging stops
      // (as specified in requirements)
    }

    if (simState.surplusPower > 0) {
      // Surplus power available: can charge battery if charging is enabled
      if (simState.isChargingOn && simState.windSpeed > 0) {
        // Charging rate proportional to surplus wattage (scaled for responsive demo: 100W adds ~0.25%/s)
        const chargeRate = (simState.surplusPower / 400.0) * dt;
        simState.batteryPct = Math.min(100.0, simState.batteryPct + chargeRate);
      }
    } else if (simState.surplusPower < 0) {
      // Deficit: Load demand exceeds wind generation! Battery discharges to supply load
      const deficit = Math.abs(simState.surplusPower);
      const dischargeRate = (deficit / 400.0) * dt;
      simState.batteryPct = Math.max(0.0, simState.batteryPct - dischargeRate);
    }
  }

  // --------------------------------------------------------------------------
  // 4. UI TELEMETRY & DASHBOARD UPDATES
  // --------------------------------------------------------------------------
  function updateUI() {
    const v = simState.windSpeed;
    const rpm = simState.rotorRpm;
    const pGen = simState.powerGenerated;
    const volt = simState.terminalVoltage;
    const curr = simState.outputCurrent;
    const loadPct = simState.loadPct;
    const pLoad = simState.loadPower;
    const pSurplus = simState.surplusPower;
    const batt = simState.batteryPct;

    // Viewport HUD
    DOM.hudWindVal.textContent = `${v.toFixed(1)} m/s`;
    DOM.hudRpmVal.textContent = `${rpm.toFixed(0)} RPM`;
    DOM.hudPowerVal.textContent = `${pGen.toFixed(1)} W`;

    // Sliders readouts & fill bars
    DOM.displayWindSpeed.textContent = `${v.toFixed(1)} m/s`;
    DOM.trackWindFill.style.width = `${(v / 30.0) * 100}%`;
    DOM.displayLoad.textContent = `${loadPct}%`;
    DOM.trackLoadFill.style.width = `${loadPct}%`;

    // Telemetry Dashboard Boxes
    DOM.valWindSpeed.innerHTML = `${v.toFixed(1)} <span class="unit">m/s</span>`;
    DOM.valRotorRpm.innerHTML = `${rpm.toFixed(1)} <span class="unit">RPM</span>`;
    DOM.valGenPower.innerHTML = `${pGen.toFixed(1)} <span class="unit">W</span>`;
    DOM.valVoltage.innerHTML = `${volt.toFixed(1)} <span class="unit">V</span>`;
    DOM.valCurrent.innerHTML = `${curr.toFixed(2)} <span class="unit">A</span>`;
    DOM.valLoadPct.innerHTML = `${loadPct} <span class="unit">%</span>`;
    DOM.valLoadPower.innerHTML = `${pLoad.toFixed(1)} <span class="unit">W</span>`;

    // Surplus / Deficit styling
    const sign = pSurplus >= 0 ? '+' : '';
    DOM.valSurplusPower.innerHTML = `${sign}${pSurplus.toFixed(1)} <span class="unit">W</span>`;

    // Flow State Banner & Status Badges
    if (!simState.isRunning) {
      DOM.hudFlowBanner.className = 'hud-bottom-banner banner-idle';
      DOM.flowStatusText.textContent = 'Simulation Halted • Readings Frozen';
      DOM.subSurplusState.textContent = 'Standby';
      DOM.dispBalanceState.textContent = 'Halted';
      DOM.dispBalanceState.className = 'sm-val text-red';
    } else if (v === 0) {
      DOM.hudFlowBanner.className = 'hud-bottom-banner banner-idle';
      DOM.flowStatusText.textContent = 'Calm (0 m/s) • Turbine Stationary • No Power';
      DOM.subSurplusState.textContent = 'Zero Input';
      DOM.dispBalanceState.textContent = 'Zero Wind';
      DOM.dispBalanceState.className = 'sm-val text-amber';
    } else if (pSurplus > 0) {
      DOM.hudFlowBanner.className = 'hud-bottom-banner banner-surplus';
      DOM.flowStatusText.textContent = simState.isChargingOn && batt < 100
        ? `Surplus Power Available (+${pSurplus.toFixed(1)} W) — Charging Battery`
        : `Surplus Power Available (+${pSurplus.toFixed(1)} W)`;
      DOM.subSurplusState.textContent = 'Surplus Available';
      DOM.subSurplusState.style.color = '#34d399';
      DOM.dispBalanceState.textContent = 'Surplus (+)';
      DOM.dispBalanceState.className = 'sm-val text-teal';
    } else if (pSurplus < 0) {
      DOM.hudFlowBanner.className = 'hud-bottom-banner banner-deficit';
      DOM.flowStatusText.textContent = `Battery Supplying Power (${Math.abs(pSurplus).toFixed(1)} W Deficit to Load)`;
      DOM.subSurplusState.textContent = 'Battery Supplying Load';
      DOM.subSurplusState.style.color = '#fbbf24';
      DOM.dispBalanceState.textContent = 'Deficit (Discharging)';
      DOM.dispBalanceState.className = 'sm-val text-amber';
    } else {
      DOM.hudFlowBanner.className = 'hud-bottom-banner banner-surplus';
      DOM.flowStatusText.textContent = 'Power Balanced Exactly with Consumer Load';
      DOM.subSurplusState.textContent = 'Balanced';
      DOM.dispBalanceState.textContent = 'Balanced';
      DOM.dispBalanceState.className = 'sm-val text-teal';
    }

    // Battery Indicator Updates
    DOM.displayBatteryPct.textContent = `${batt.toFixed(1)}%`;
    DOM.batteryLevelFill.style.width = `${Math.min(100, Math.max(0, batt))}%`;

    // Dynamic battery color and charging chip
    if (batt >= 99.95) {
      DOM.battChargingStatus.className = 'batt-chip full';
      DOM.battChargingStatus.textContent = 'BATTERY FULL';
      DOM.batteryLevelFill.style.background = 'linear-gradient(90deg, #06b6d4, #38bdf8)';
      DOM.battDetailMsg.textContent = 'Battery at 100% capacity. Excess power regulated.';
    } else if (pSurplus > 0 && simState.isChargingOn && v > 0) {
      DOM.battChargingStatus.className = 'batt-chip charging';
      DOM.battChargingStatus.textContent = 'CHARGING';
      DOM.batteryLevelFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      DOM.battDetailMsg.textContent = `Surplus ${pSurplus.toFixed(1)} W flowing into battery bank`;
    } else if (pSurplus < 0) {
      DOM.battChargingStatus.className = 'batt-chip discharging';
      DOM.battChargingStatus.textContent = 'DISCHARGING';
      DOM.batteryLevelFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      DOM.battDetailMsg.textContent = `Supplying ${Math.abs(pSurplus).toFixed(1)} W to meet load demand`;
    } else {
      DOM.battChargingStatus.className = 'batt-chip standby';
      DOM.battChargingStatus.textContent = 'STANDBY';
      DOM.batteryLevelFill.style.background = 'linear-gradient(90deg, #64748b, #94a3b8)';
      DOM.battDetailMsg.textContent = 'Battery storage idle • No net energy exchange';
    }

    // Charging switch state display
    if (simState.isChargingOn) {
      DOM.displayChargingToggle.textContent = 'ON';
      DOM.displayChargingToggle.className = 'switch-state-text on';
      DOM.dispChargeState.textContent = 'Active (ON)';
      DOM.dispChargeState.className = 'sm-val text-blue';
    } else {
      DOM.displayChargingToggle.textContent = 'OFF';
      DOM.displayChargingToggle.className = 'switch-state-text off';
      DOM.dispChargeState.textContent = 'Disabled (OFF)';
      DOM.dispChargeState.className = 'sm-val text-dim';
    }

    // Chart header readout
    DOM.chartCurP.textContent = `${pGen.toFixed(1)} W`;
    DOM.chartPeakP.textContent = `${simState.peakPower.toFixed(1)} W`;
  }

  // --------------------------------------------------------------------------
  // 5. LIVE CANVAS POWER GRAPH (TIME VS POWER)
  // --------------------------------------------------------------------------
  function initChart() {
    const canvas = DOM.chartCanvas;
    if (!canvas) return;

    // Pre-populate buffer
    const now = performance.now();
    for (let i = chartHistory.maxPoints; i >= 0; i--) {
      chartHistory.times.push(now - i * 150);
      chartHistory.powers.push(simState.powerGenerated);
    }
  }

  function updateChart(now) {
    const canvas = DOM.chartCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas internal buffer if needed to match display size
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * window.devicePixelRatio ||
        canvas.height !== rect.height * window.devicePixelRatio) {
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;

    // Add current sample if running
    if (simState.isRunning) {
      chartHistory.times.push(now);
      chartHistory.powers.push(simState.powerGenerated);

      if (chartHistory.powers.length > chartHistory.maxPoints) {
        chartHistory.powers.shift();
        chartHistory.times.shift();
      }
    }

    // Clear background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Padding
    const padL = 60 * dpr;
    const padR = 24 * dpr;
    const padT = 20 * dpr;
    const padB = 30 * dpr;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Dynamic Y max scale
    let maxP = Math.max(500, simState.peakPower * 1.15);
    // Round to clean ceiling
    maxP = Math.ceil(maxP / 200) * 200;

    // Draw Grid Lines & Y-Axis Labels
    ctx.lineWidth = 1 * dpr;
    ctx.font = `${10 * dpr}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const pVal = (maxP / ySteps) * i;
      const y = padT + plotH - (i / ySteps) * plotH;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(`${pVal.toFixed(0)} W`, padL - 8 * dpr, y);
    }

    // Draw X-Axis Time Markers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xSteps = 5;
    for (let i = 0; i <= xSteps; i++) {
      const x = padL + (i / xSteps) * plotW;
      const timeAgo = ((xSteps - i) * 2.0).toFixed(0);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(`${timeAgo}s ago`, x, padT + plotH + 8 * dpr);
    }

    // Draw Axis lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();

    if (chartHistory.powers.length < 2) return;

    // Coordinates calculation
    const points = [];
    const len = chartHistory.powers.length;
    for (let i = 0; i < len; i++) {
      const x = padL + (i / (chartHistory.maxPoints - 1)) * plotW;
      const val = chartHistory.powers[i];
      const y = padT + plotH - (val / maxP) * plotH;
      points.push({ x, y });
    }

    // Draw Area Fill Gradient
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, padT + plotH);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Line Curve
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw Current Value Head Pulse Point
    const lastPt = points[points.length - 1];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 4 * dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 7 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // 6. PROCEDURAL 3D WIND FARM ENVIRONMENT (THREE.JS)
  // --------------------------------------------------------------------------
  let scene, camera, renderer, controls;
  let rotorAssembly, nacelleMesh, anemometerCups = [];
  let cloudGroup;
  let animationFrameId;
  let lastTimestamp = 0;

  // Mini Landing Page Preview Scene
  let landingScene, landingCamera, landingRenderer, landingRotor;
  let landingAnimId;

  function initMain3D() {
    const container = DOM.simCanvasContainer;
    if (!container) return;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x76b5e0); // Rich sky blue
    scene.fog = new THREE.FogExp2(0xb6dff5, 0.0075); // Soft atmospheric haze blending horizon

    // Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 600);
    camera.position.set(24, 16, 32);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI / 2 - 0.04; // Don't clip under ground
      controls.minDistance = 6;
      controls.maxDistance = 120;
      controls.target.set(0, 13, 0); // Focus on mid-tower / nacelle
      controls.update();
    }

    // Lighting
    setupLighting();

    // Procedural Sky, Sun, Mountains, Terrain, Trees, Clouds
    createProceduralSkyAndSun();
    createProceduralMountains();
    createProceduralTerrainAndPath();
    createProceduralTrees();
    createProceduralClouds();

    // Main 3D Wind Turbine Model
    createWindTurbine();

    // Resize listener
    window.addEventListener('resize', onWindowResize);
  }

  function setupLighting() {
    // Hemisphere Light (Sky ambient + Ground bounce)
    const hemiLight = new THREE.HemisphereLight(0xe8f4f8, 0x3d663d, 0.65);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    // Directional Sunlight with Shadows
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    sunLight.position.set(45, 65, 35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -35;
    sunLight.shadow.camera.right = 35;
    sunLight.shadow.camera.top = 35;
    sunLight.shadow.camera.bottom = -25;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
  }

  function createProceduralSkyAndSun() {
    // Glowing Sun Sphere in sky
    const sunGeo = new THREE.SphereGeometry(4.5, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(90, 130, 70);
    scene.add(sunMesh);

    // Sun Corona Halo
    const haloGeo = new THREE.RingGeometry(4.5, 9.0, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffe89e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.copy(sunMesh.position);
    haloMesh.lookAt(camera.position);
    scene.add(haloMesh);
  }

  function createProceduralMountains() {
    // Distant layered low-poly mountain ranges
    const mountainGroup = new THREE.Group();

    // Far background mountain ridge
    const farMat = new THREE.MeshStandardMaterial({
      color: 0x58778f,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    });

    const midMat = new THREE.MeshStandardMaterial({
      color: 0x46695b,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    // Create a series of mountain peaks using randomized cones
    const peaks = [
      { x: -90, z: -140, r: 40, h: 55, mat: farMat },
      { x: -45, z: -160, r: 50, h: 72, mat: farMat },
      { x: 5, z: -150, r: 45, h: 65, mat: farMat },
      { x: 55, z: -170, r: 55, h: 80, mat: farMat },
      { x: 105, z: -145, r: 42, h: 60, mat: farMat },
      // Mid-distance range
      { x: -75, z: -100, r: 32, h: 38, mat: midMat },
      { x: -25, z: -110, r: 38, h: 44, mat: midMat },
      { x: 30, z: -105, r: 35, h: 40, mat: midMat },
      { x: 80, z: -95, r: 30, h: 35, mat: midMat }
    ];

    peaks.forEach(p => {
      const geo = new THREE.ConeGeometry(p.r, p.h, 7);
      const mesh = new THREE.Mesh(geo, p.mat);
      mesh.position.set(p.x, p.h * 0.45 - 2, p.z);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mountainGroup.add(mesh);
    });

    scene.add(mountainGroup);
  }

  function createProceduralTerrainAndPath() {
    // Main rolling grass terrain
    const terrainGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
    terrainGeo.rotateX(-Math.PI / 2);

    // Apply gentle procedural hills variation
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);

      // Keep center flat for turbine foundation
      const distFromCenter = Math.sqrt(vx * vx + vz * vz);
      let elevation = 0;
      if (distFromCenter > 10) {
        elevation = Math.sin(vx * 0.06) * Math.cos(vz * 0.06) * 1.6 +
                    Math.sin(vx * 0.12 + vz * 0.08) * 0.8;
      }
      pos.setY(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x5a9a4b, // Vibrant lush grass green
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Dirt access road / path leading to the turbine
    const pathGeo = new THREE.PlaneGeometry(5, 55, 12, 12);
    pathGeo.rotateX(-Math.PI / 2);
    pathGeo.rotateY(0.18);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x8c7960, // Natural earth/dirt brown
      roughness: 0.95,
      flatShading: true
    });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.position.set(2, 0.05, 28);
    pathMesh.receiveShadow = true;
    scene.add(pathMesh);
  }

  function createProceduralTrees() {
    const treeGroup = new THREE.Group();

    // Low-poly evergreen tree builder
    function buildTree(x, z, scale) {
      const tree = new THREE.Group();

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.38 * scale, 2.0 * scale, 5);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.0 * scale;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      // Layered conical foliage
      const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x2e6930,
        roughness: 0.8,
        flatShading: true
      });

      const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.6 * scale, 2.2 * scale, 5), foliageMat);
      cone1.position.y = 2.4 * scale;
      cone1.castShadow = true;
      tree.add(cone1);

      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.3 * scale, 1.9 * scale, 5), foliageMat);
      cone2.position.y = 3.5 * scale;
      cone2.castShadow = true;
      tree.add(cone2);

      const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 1.5 * scale, 5), foliageMat);
      cone3.position.y = 4.5 * scale;
      cone3.castShadow = true;
      tree.add(cone3);

      tree.position.set(x, 0, z);
      return tree;
    }

    // Scatter trees naturally at varying depths (avoiding turbine center)
    const treeCoords = [
      { x: -18, z: 12, s: 1.1 },
      { x: -24, z: 8, s: 1.3 },
      { x: -15, z: 22, s: 0.95 },
      { x: 16, z: 16, s: 1.2 },
      { x: 22, z: 10, s: 1.0 },
      { x: 26, z: 20, s: 1.15 },
      { x: -30, z: -25, s: 1.4 },
      { x: -36, z: -15, s: 1.2 },
      { x: 32, z: -20, s: 1.3 },
      { x: 38, z: -12, s: 1.1 },
      { x: -12, z: -35, s: 1.2 },
      { x: 18, z: -38, s: 1.35 },
      { x: -45, z: 28, s: 1.5 },
      { x: 42, z: 32, s: 1.4 }
    ];

    treeCoords.forEach(c => {
      treeGroup.add(buildTree(c.x, c.z, c.s));
    });

    scene.add(treeGroup);
  }

  function createProceduralClouds() {
    cloudGroup = new THREE.Group();

    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });

    // Generate 6 procedural puffy cloud clusters
    const clusterPositions = [
      { x: -50, y: 55, z: -30 },
      { x: 10, y: 62, z: -60 },
      { x: 65, y: 50, z: -20 },
      { x: -20, y: 58, z: 40 },
      { x: 45, y: 64, z: 30 },
      { x: -70, y: 52, z: 10 }
    ];

    clusterPositions.forEach(pos => {
      const cluster = new THREE.Group();
      // Combine 5-7 overlapping spheres for each cloud
      const numSpheres = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numSpheres; i++) {
        const radius = 3.5 + Math.random() * 3.5;
        const sphereGeo = new THREE.SphereGeometry(radius, 7, 7);
        const sphere = new THREE.Mesh(sphereGeo, cloudMat);
        sphere.position.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 8
        );
        cluster.add(sphere);
      }
      cluster.position.set(pos.x, pos.y, pos.z);
      cloudGroup.add(cluster);
    });

    scene.add(cloudGroup);
  }

  // --------------------------------------------------------------------------
  // 7. HIGH-FIDELITY 3D WIND TURBINE MODEL
  // --------------------------------------------------------------------------
  function createWindTurbine() {
    const turbine = new THREE.Group();

    // 1. Concrete Foundation Hexagonal Pad
    const foundationGeo = new THREE.CylinderGeometry(4.2, 4.8, 0.8, 8);
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Concrete slate grey
      roughness: 0.85,
      metalness: 0.1
    });
    const foundation = new THREE.Mesh(foundationGeo, foundationMat);
    foundation.position.y = 0.4;
    foundation.receiveShadow = true;
    foundation.castShadow = true;
    turbine.add(foundation);

    // Foundation Base Collar & Access Door Ring
    const collarGeo = new THREE.CylinderGeometry(2.4, 2.7, 0.5, 24);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 0.9;
    collar.castShadow = true;
    turbine.add(collar);

    // Access Door at tower base
    const doorGeo = new THREE.BoxGeometry(0.6, 1.2, 0.1);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.3, 2.2);
    turbine.add(door);

    // 2. Tall Tapered Tubular Tower
    // Height: 24 units, bottom radius: 2.1, top radius: 1.15
    const towerHeight = 24;
    const towerGeo = new THREE.CylinderGeometry(1.15, 2.1, towerHeight, 32);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Industrial off-white / light grey
      roughness: 0.45,
      metalness: 0.2
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 0.9 + towerHeight / 2;
    tower.castShadow = true;
    tower.receiveShadow = true;
    turbine.add(tower);

    // Red Aviation Warning Stripes near top of tower
    const stripeGeo = new THREE.CylinderGeometry(1.22, 1.28, 0.8, 32);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd93838, roughness: 0.5 });
    const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe1.position.y = towerHeight - 2.5;
    turbine.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe2.position.y = towerHeight - 0.8;
    turbine.add(stripe2);

    // 3. Nacelle / Generator Housing on Top of Tower
    const nacelleY = 0.9 + towerHeight;
    nacelleMesh = new THREE.Group();
    nacelleMesh.position.set(0, nacelleY, 0);

    // Yaw bearing collar
    const yawCollarGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.4, 24);
    const yawCollarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const yawCollar = new THREE.Mesh(yawCollarGeo, yawCollarMat);
    yawCollar.position.y = 0.2;
    nacelleMesh.add(yawCollar);

    // Main Nacelle Body (Aerodynamic pod)
    const nacelleBodyGeo = new THREE.BoxGeometry(2.4, 2.2, 5.8);
    const nacelleBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.25
    });
    const nacelleBody = new THREE.Mesh(nacelleBodyGeo, nacelleBodyMat);
    nacelleBody.position.set(0, 1.3, -0.6);
    nacelleBody.castShadow = true;
    nacelleBody.receiveShadow = true;
    nacelleMesh.add(nacelleBody);

    // Nacelle Top Curved Dome / Cover
    const nacelleRoofGeo = new THREE.CylinderGeometry(1.2, 1.2, 5.6, 24);
    nacelleRoofGeo.rotateX(Math.PI / 2);
    const nacelleRoof = new THREE.Mesh(nacelleRoofGeo, nacelleBodyMat);
    nacelleRoof.position.set(0, 2.3, -0.6);
    nacelleRoof.castShadow = true;
    nacelleMesh.add(nacelleRoof);

    // Rear Cooling Vents / Heat Sink Grate
    const ventGeo = new THREE.BoxGeometry(1.8, 1.2, 0.2);
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const vent = new THREE.Mesh(ventGeo, ventMat);
    vent.position.set(0, 1.3, -3.5);
    nacelleMesh.add(vent);

    // Rear Anemometer Pole and Spinning Sensor
    const anemPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
    const anemPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const anemPole = new THREE.Mesh(anemPoleGeo, anemPoleMat);
    anemPole.position.set(0, 3.0, -2.8);
    nacelleMesh.add(anemPole);

    const anemHead = new THREE.Group();
    anemHead.position.set(0, 3.6, -2.8);

    // 3 mini cups
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.04), anemPoleMat);
      arm.rotation.y = (i * 2 * Math.PI) / 3;
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      cup.position.x = 0.3;
      arm.add(cup);
      anemHead.add(arm);
    }
    nacelleMesh.add(anemHead);
    anemometerCups.push(anemHead);

    // 4. Rotor Hub (Nose Cone) & Blades Assembly
    rotorAssembly = new THREE.Group();
    // Position hub forward on front of nacelle
    rotorAssembly.position.set(0, 1.3, 2.4);

    // Main drive shaft connection
    const shaftGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.8, 24);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.z = -0.3;
    rotorAssembly.add(shaft);

    // Rotor Nose Cone (Bullet / Spinner)
    const hubGeo = new THREE.ConeGeometry(1.2, 2.2, 24);
    hubGeo.rotateX(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.3,
      metalness: 0.3
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.z = 0.6;
    hub.castShadow = true;
    rotorAssembly.add(hub);

    // 5. Three Aerodynamic Turbine Blades (120 degrees apart)
    const bladeLength = 13.5;
    for (let i = 0; i < 3; i++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (i * 2 * Math.PI) / 3;

      const blade = createAerodynamicBlade(bladeLength);
      bladePivot.add(blade);
      rotorAssembly.add(bladePivot);
    }

    nacelleMesh.add(rotorAssembly);
    turbine.add(nacelleMesh);

    scene.add(turbine);
  }

  function createAerodynamicBlade(length) {
    const bladeGroup = new THREE.Group();

    // Cylindrical root connection
    const rootGeo = new THREE.CylinderGeometry(0.32, 0.45, 1.2, 16);
    const rootMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.4 });
    const root = new THREE.Mesh(rootGeo, rootMat);
    root.position.y = 0.6;
    root.castShadow = true;
    bladeGroup.add(root);

    // Main aerofoil blade geometry (tapered & twisted)
    // We construct a custom tapered aerofoil using ExtrudeGeometry with spline cross-section
    const shape = new THREE.Shape();
    // Aerofoil contour (simplified NACA aerofoil)
    shape.moveTo(0, 0.6);
    shape.bezierCurveTo(0.12, 0.5, 0.22, 0.1, 0.24, -0.2);
    shape.bezierCurveTo(0.15, -0.6, 0.0, -0.8, -0.04, -0.85); // trailing edge
    shape.bezierCurveTo(-0.1, -0.5, -0.18, 0.1, -0.15, 0.4);
    shape.bezierCurveTo(-0.1, 0.6, -0.04, 0.65, 0, 0.6);

    const extrudeSettings = {
      steps: 16,
      depth: length,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.05,
      bevelSegments: 3
    };

    const aerofoilGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Orient along Y axis
    aerofoilGeo.rotateX(-Math.PI / 2);
    aerofoilGeo.rotateY(Math.PI / 2);

    // Apply procedural taper & pitch twist along blade span
    const pos = aerofoilGeo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const y = pos.getY(j); // spanwise distance along blade
      if (y > 0) {
        const factor = Math.max(0.18, 1.0 - (y / length) * 0.78);
        const twist = (y / length) * 0.22; // Aerodynamic twist

        let x = pos.getX(j) * factor;
        let z = pos.getZ(j) * factor;

        // Twist around span axis
        const cosT = Math.cos(twist);
        const sinT = Math.sin(twist);
        const tx = x * cosT - z * sinT;
        const tz = x * sinT + z * cosT;

        pos.setX(j, tx);
        pos.setZ(j, tz);
      }
    }
    aerofoilGeo.computeVertexNormals();

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.15
    });

    const bladeMesh = new THREE.Mesh(aerofoilGeo, bladeMat);
    bladeMesh.position.y = 1.0;
    bladeMesh.castShadow = true;
    bladeGroup.add(bladeMesh);

    // Red high-visibility safety wing-tip marker
    const tipGeo = new THREE.BoxGeometry(0.3, 1.2, 0.12);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xd93838, roughness: 0.4 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, length + 0.5, 0);
    bladeGroup.add(tip);

    return bladeGroup;
  }

  // --------------------------------------------------------------------------
  // 8. MINI LANDING PAGE 3D PREVIEW CARD
  // --------------------------------------------------------------------------
  function initLandingPreview3D() {
    const container = DOM.landingCanvasContainer;
    if (!container) return;

    landingScene = new THREE.Scene();
    landingScene.background = new THREE.Color(0x111c30);

    const w = container.clientWidth || 450;
    const h = container.clientHeight || 400;
    landingCamera = new THREE.PerspectiveCamera(40, w / h, 0.5, 200);
    landingCamera.position.set(16, 18, 26);
    landingCamera.lookAt(0, 16, 0);

    landingRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    landingRenderer.setSize(w, h);
    landingRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    landingRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(landingRenderer.domElement);

    // Light
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.85);
    landingScene.add(hemi);

    const dir = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dir.position.set(20, 30, 20);
    landingScene.add(dir);

    // Compact stylized wind turbine
    const miniTurbine = new THREE.Group();

    // Tower
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.3, 18, 24),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 })
    );
    tower.position.y = 9;
    miniTurbine.add(tower);

    // Nacelle
    const nacelle = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.4, 3.6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    nacelle.position.set(0, 18.2, 0);
    miniTurbine.add(nacelle);

    // Rotor
    landingRotor = new THREE.Group();
    landingRotor.position.set(0, 18.2, 1.8);

    const hub = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.4, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
    );
    hub.rotateX(Math.PI / 2);
    hub.position.z = 0.4;
    landingRotor.add(hub);

    // 3 blades
    for (let i = 0; i < 3; i++) {
      const bPivot = new THREE.Group();
      bPivot.rotation.z = (i * 2 * Math.PI) / 3;

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 9.5, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      blade.position.y = 4.8;
      bPivot.add(blade);
      landingRotor.add(bPivot);
    }

    miniTurbine.add(landingRotor);

    // Ground platform ring
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    ground.position.y = -0.2;
    miniTurbine.add(ground);

    landingScene.add(miniTurbine);

    // Mini animation loop
    function animateLanding() {
      landingAnimId = requestAnimationFrame(animateLanding);
      if (landingRotor) {
        landingRotor.rotation.z += 0.035; // Nominal 60 RPM preview rotation
      }
      miniTurbine.rotation.y += 0.003;
      landingRenderer.render(landingScene, landingCamera);
    }
    animateLanding();
  }

  // --------------------------------------------------------------------------
  // 9. ANIMATION LOOP (TARGET 60 FPS)
  // --------------------------------------------------------------------------
  function animate(timestamp) {
    animationFrameId = requestAnimationFrame(animate);

    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000.0, 0.1); // clamp delta
    lastTimestamp = timestamp;

    // Run physics updates
    calculatePhysics(dt);

    // Update 3D Rotor position
    if (rotorAssembly) {
      rotorAssembly.rotation.z = simState.rotorAngle;
    }

    // Spin anemometer cups on nacelle
    if (anemometerCups.length > 0) {
      anemometerCups[0].rotation.y = simState.anemometerAngle;
    }

    // Drift procedural clouds with wind speed
    if (cloudGroup && simState.isRunning) {
      const cloudSpeed = Math.max(0.2, simState.windSpeed * 0.18) * dt;
      cloudGroup.children.forEach(cloud => {
        cloud.position.x += cloudSpeed;
        if (cloud.position.x > 85) {
          cloud.position.x = -85;
        }
      });
    }

    // Update Controls & Render Main Scene
    if (controls) {
      controls.update();
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    // Update Telemetry & UI
    updateUI();

    // Update Live Chart
    updateChart(timestamp);
  }

  // --------------------------------------------------------------------------
  // 10. CAMERA PRESETS & VIEW CONTROLLERS
  // --------------------------------------------------------------------------
  function setCameraView(preset) {
    if (!camera || !controls) return;

    DOM.btnCamView1.classList.remove('active');
    DOM.btnCamView2.classList.remove('active');
    DOM.btnCamView3.classList.remove('active');

    if (preset === 'farm') {
      DOM.btnCamView1.classList.add('active');
      camera.position.set(24, 16, 32);
      controls.target.set(0, 13, 0);
    } else if (preset === 'nacelle') {
      DOM.btnCamView2.classList.add('active');
      camera.position.set(0.5, 27.5, 9.5);
      controls.target.set(0, 26, 0);
    } else if (preset === 'ground') {
      DOM.btnCamView3.classList.add('active');
      camera.position.set(10, 1.2, 12);
      controls.target.set(0, 24, 0);
    }
    controls.update();
  }

  // --------------------------------------------------------------------------
  // 11. EVENT LISTENERS & NAVIGATION
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    // Navigation: Page 1 -> Page 2
    function navigateToSimulation() {
      DOM.pageLanding.classList.remove('active-page');
      DOM.pageSimulation.classList.add('active-page');
      window.scrollTo(0, 0);

      // Trigger canvas resize once visible
      setTimeout(onWindowResize, 50);
    }

    // Navigation: Page 2 -> Page 1
    function navigateToLanding() {
      DOM.pageSimulation.classList.remove('active-page');
      DOM.pageLanding.classList.add('active-page');
      window.scrollTo(0, 0);
    }

    DOM.btnOpenSim.addEventListener('click', navigateToSimulation);
    DOM.btnOpenSim2.addEventListener('click', navigateToSimulation);
    DOM.btnBackOverview.addEventListener('click', navigateToLanding);

    DOM.btnScrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Wind Speed Slider
    DOM.sliderWindSpeed.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setWindSpeed(val);
    });

    // Electrical Load Slider
    DOM.sliderLoad.addEventListener('input', (e) => {
      simState.loadPct = parseInt(e.target.value, 10);
      calculatePhysics(0);
      updateUI();
    });

    // Battery Charging Switch Toggle
    DOM.toggleCharging.addEventListener('change', (e) => {
      simState.isChargingOn = e.target.checked;
      calculatePhysics(0);
      updateUI();
    });

    // Quick Wind Preset Buttons
    DOM.presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const windVal = parseFloat(chip.dataset.wind);
        DOM.sliderWindSpeed.value = windVal;
        setWindSpeed(windVal);

        DOM.presetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // Master Control: Start Simulation
    DOM.btnStartSim.addEventListener('click', () => {
      simState.isRunning = true;
      DOM.btnStartSim.classList.add('active');
      DOM.btnStopSim.classList.remove('active');

      DOM.navSystemStatus.className = 'status-chip status-running';
      DOM.navStatusText.textContent = 'RUNNING';
      DOM.dispSysStatus.textContent = 'Running';
      DOM.dispSysStatus.className = 'sm-val text-green';
    });

    // Master Control: Stop Simulation
    DOM.btnStopSim.addEventListener('click', () => {
      simState.isRunning = false;
      DOM.btnStartSim.classList.remove('active');
      DOM.btnStopSim.classList.add('active');

      DOM.navSystemStatus.className = 'status-chip status-stopped';
      DOM.navStatusText.textContent = 'STOPPED';
      DOM.dispSysStatus.textContent = 'Stopped';
      DOM.dispSysStatus.className = 'sm-val text-red';
    });

    // Master Control: Reset Simulation
    DOM.btnResetSim.addEventListener('click', () => {
      resetSimulation();
    });

    // Camera Presets
    DOM.btnCamView1.addEventListener('click', () => setCameraView('farm'));
    DOM.btnCamView2.addEventListener('click', () => setCameraView('nacelle'));
    DOM.btnCamView3.addEventListener('click', () => setCameraView('ground'));
    DOM.btnCamReset.addEventListener('click', () => setCameraView('farm'));
  }

  function setWindSpeed(val) {
    simState.windSpeed = val;
    calculatePhysics(0);
    updateUI();

    // Sync preset chip active state
    DOM.presetChips.forEach(c => {
      if (parseFloat(c.dataset.wind) === val) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  function resetSimulation() {
    simState.isRunning = true;
    simState.windSpeed = 10.0;
    simState.loadPct = 50;
    simState.batteryPct = 50.0;
    simState.isChargingOn = true;
    simState.rotorAngle = 0;
    simState.peakPower = 214.38;

    // Reset controls in DOM
    DOM.sliderWindSpeed.value = 10;
    DOM.sliderLoad.value = 50;
    DOM.toggleCharging.checked = true;

    DOM.btnStartSim.classList.add('active');
    DOM.btnStopSim.classList.remove('active');

    DOM.navSystemStatus.className = 'status-chip status-running';
    DOM.navStatusText.textContent = 'RUNNING';
    DOM.dispSysStatus.textContent = 'Running';
    DOM.dispSysStatus.className = 'sm-val text-green';

    // Clear chart history
    chartHistory.powers = [];
    chartHistory.times = [];
    const now = performance.now();
    for (let i = chartHistory.maxPoints; i >= 0; i--) {
      chartHistory.times.push(now - i * 150);
      chartHistory.powers.push(214.38);
    }

    setWindSpeed(10.0);
    setCameraView('farm');
  }

  function onWindowResize() {
    // Resize simulation 3D canvas
    if (DOM.simCanvasContainer && camera && renderer) {
      const w = DOM.simCanvasContainer.clientWidth;
      const h = DOM.simCanvasContainer.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }

    // Resize landing mini preview
    if (DOM.landingCanvasContainer && landingCamera && landingRenderer) {
      const lw = DOM.landingCanvasContainer.clientWidth;
      const lh = DOM.landingCanvasContainer.clientHeight;
      if (lw > 0 && lh > 0) {
        landingCamera.aspect = lw / lh;
        landingCamera.updateProjectionMatrix();
        landingRenderer.setSize(lw, lh);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 12. INITIALIZATION ENTRY POINT
  // --------------------------------------------------------------------------
  function init() {
    initChart();
    setupEventListeners();

    // Check Three.js availability
    if (typeof THREE !== 'undefined') {
      initLandingPreview3D();
      initMain3D();
      // Start main simulation loop
      requestAnimationFrame(animate);
    } else {
      console.warn('Three.js library is loading or not detected. Retrying in 100ms...');
      setTimeout(init, 100);
    }
  }

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
