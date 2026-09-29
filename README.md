# Digital Windmill Simulation
## Interactive Wind Energy & Power Generation Engineering Demonstration

A realistic, interactive **3D Digital Windmill Simulation** college engineering project built with vanilla **HTML5, CSS3, JavaScript, and Three.js**.

---

## 🌟 Key Features

### 1. Two-Screen Architecture
* **Screen 1 — Simulation Landing Page**:
  * Title: **“Digital Windmill Simulation”**
  * Subtitle: **“Interactive Wind Energy & Power Generation Demonstration”**
  * Interactive 3D procedural preview card showcasing the turbine.
  * Subsystem cards covering **Wind Energy**, **Rotor & Shaft**, **Generator**, **Electrical Output**, and **Battery Storage**.
  * Prominent **“Open Simulation”** CTA button navigating smoothly to the simulation bench.
* **Screen 2 — 3D Windmill Simulation**:
  * Procedural 3D WebGL wind farm environment with atmospheric sky, glowing sun with halo, layered mountains, rolling green grass terrain, dirt access road, scattered low-poly trees, and drifting clouds.
  * Fully articulated 3-blade wind turbine with tapered tubular tower, access door, red aviation warning bands, nacelle with cooling vents, spinning anemometer, rotor hub, and aerodynamic aerofoil blades.
  * OrbitControls (drag to rotate, scroll to zoom, right-click to pan) + Quick Camera Presets (**Farm View**, **Nacelle Close-up**, **Ground Upward View**, and **Reset Cam**).
  * **“← Back to Overview”** button returning to the landing page.

---

## ⚡ Mathematical & Physics Models

### 1. Aerodynamic Power Equation
$$P = 0.5 \times \rho \times A \times C_p \times v^3$$
* $\rho$ (Air density) $= 1.225 \text{ kg/m}^3$
* $A$ (Rotor swept area) $= 1.0 \text{ m}^2$
* $C_p$ (Power coefficient) $= 0.35$ (Betz limit fraction)
* $v$ (Wind speed) in $\text{m/s}$
* Power constant: $0.5 \times 1.225 \times 1.0 \times 0.35 = 0.214375$

### 2. Rotor RPM Calculation
$$\text{RPM} = \text{Wind Speed} \times 6$$
* Clearly labeled: **“Rotor RPM — Simulation Approximation”**
* At $0 \text{ m/s}$: $\text{RPM} = 0$, rotor halts completely.
* At $10 \text{ m/s}$: $\text{RPM} = 60$.
* At $20 \text{ m/s}$: $\text{RPM} = 120$.
* At $30 \text{ m/s}$: $\text{RPM} = 180$.

### 3. Terminal Voltage & Output Current
$$\text{Voltage} = \text{RPM} \times 0.5$$
$$\text{Current} = \frac{\text{Power}}{\text{Voltage}}$$
* Zero-voltage safe division handled without `NaN`, `Infinity`, or `undefined`.

### 4. Electrical Load & Battery System
* **Connected Load**: $0\% - 100\%$ (default $50\%$)
* **Load Power** $= P_{\text{nominal}} \times (\text{Load } \% / 100)$
* **Surplus Power** $= P_{\text{generated}} - P_{\text{load}}$
* When $P_{\text{generated}} > P_{\text{load}}$:
  * Status: **“Surplus Power Available”**
  * When Charging is **ON**, the battery percentage gradually charges towards $100\%$ (**“Battery Full”**).
* When $P_{\text{load}} > P_{\text{generated}}$:
  * Status: **“Battery Supplying Power”**
  * Battery discharges smoothly to maintain consumer load demand.
* When Wind Speed $= 0 \text{ m/s}$, automatic charging halts.

---

## 📊 Live Canvas Chart
* Real-time scrolling HTML5 Canvas graph tracking **Time vs Generated Power**.
* Visualizes dynamic responses when the student adjusts wind velocity in real time.

---

## 📁 File Structure

```
├── index.html            # Main SPA containing Landing Page and 3D Simulation
├── styles.css            # Modern engineering dark theme, cards, HUD, and responsive layout
├── simulation.js         # Three.js 3D environment, physics engine, live chart, and UI controller
├── lib/
│   ├── three.min.js      # Standalone local Three.js (r128 UMD)
│   └── OrbitControls.js  # Standalone local OrbitControls
└── README.md             # Project documentation and engineering guide
```

---

## 🚀 How to Run Locally

You can run this project with any local HTTP server:

```bash
# Using Python:
python -m http.server 8080

# Or using Node:
npx serve .
```

Then open your browser at:
`http://localhost:8080/index.html`
