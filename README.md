# Wave Simulation

Interactive 2D sound wave propagation simulator.

## Features
- Real-time wave propagation
- Adjustable walls and boundaries
- Pressure and intensity visualisations
- Configurable parameters:
  - Frequency
  - Wall absorption
  - Air absorption
  - Resolution

## Demo
[Live demo](https://github.com/timbs85/wave_sim)

## Usage
- **Left click**: Place sound source
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