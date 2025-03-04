# Wave Simulation

Interactive 2D sound wave propagation simulator.

## Features
- Real-time wave propagation
- Adjustable walls and boundaries
- Pressure and intensity visualisations
- Multiple sound sources with distinct colours
- Configurable parameters:
  - Frequency
  - Wall absorption
  - Air absorption
  - Resolution

## Demo
Live demo currently unavailable - run locally using the setup instructions below.

## Usage
- **Left click on a source**: Select and drag source
- **Shift+click**: Add a new sound source
- **Space**: Pause/resume
- **I**: Trigger impulse
- **C**: Reset
- **V**: Toggle visualisation mode

## Setup
```bash
git clone https://github.com/timbs85/wave_sim.git
cd wave_sim
python -m http.server
```
Visit `http://localhost:8000`

## Technical
Built with custom JavaScript implementation using FDTD (Finite-Difference Time-Domain) calculations and Tweakpane for the interface.