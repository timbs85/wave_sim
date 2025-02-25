let simulation;
// These are now controlled by the GUI
// let visualizationMode = 'pressure'; // 'pressure' or 'intensity'
// let paused = false;
// Make resolution globally accessible for GUI
window.simResolution = 8; // pixels per simulation cell (higher = faster but coarser)
let p5Canvas;
let ctx; // Canvas 2D context
let contrastValue = 1.0; // Default contrast value (1.0 = no change)
let lowClipValue = 0.0; // Default low clip value (0.0 = no clipping)
let buffer; // Pixel buffer for efficient rendering
let colorLookup; // Color lookup table
let imageData; // ImageData for direct pixel manipulation
const PRESSURE_STEPS = 1024; // Number of pre-calculated color values

// Make simulation globally accessible for GUI
window.simulation = null;
window.contrastValue = 1.0;
window.lowClipValue = 0.0;
window.visualizationMode = 'pressure';
window.paused = false;

function initColorLookup() {
    colorLookup = {
        pressure: new Uint8Array(PRESSURE_STEPS * 4),
        intensity: new Uint8Array(PRESSURE_STEPS * 4)
    };

    // Pre-calculate pressure colors
    for (let i = 0; i < PRESSURE_STEPS; i++) {
        // Apply non-linear mapping to pressure range for better visual dynamics
        const normalizedI = i / (PRESSURE_STEPS - 1);
        const pressureRange = 1.0; // Full range of pressure values
        const pressure = (normalizedI * 2 - 1) * pressureRange; // Map to [-range, +range]

        // Apply non-linear contrast curve for better visualization
        const curvedPressure = Math.sign(pressure) * Math.pow(Math.abs(pressure), 0.7);
        const intensity = map(curvedPressure, -1, 1, 0, 1);

        const idx = i * 4;

        // Pressure mode colors
        if (intensity > 0.5) {
            colorLookup.pressure[idx] = Math.floor(map(intensity, 0.5, 1, 0, 255)); // Red
            colorLookup.pressure[idx + 1] = 0;  // Green
            colorLookup.pressure[idx + 2] = 0;  // Blue
        } else {
            colorLookup.pressure[idx] = 0;      // Red
            colorLookup.pressure[idx + 1] = 0;  // Green
            colorLookup.pressure[idx + 2] = Math.floor(map(intensity, 0, 0.5, 255, 0)); // Blue
        }
        colorLookup.pressure[idx + 3] = 255;    // Alpha

        // Intensity mode colors - use curved pressure for better contrast
        const gray = Math.floor(map(Math.abs(curvedPressure), 0, 1, 0, 255));
        colorLookup.intensity[idx] = gray;
        colorLookup.intensity[idx + 1] = gray;
        colorLookup.intensity[idx + 2] = gray;
        colorLookup.intensity[idx + 3] = 255;
    }
}

function setup() {
    // Create canvas with willReadFrequently attribute and place it in the simulation container
    const container = document.getElementById('simulation-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    p5Canvas = createCanvas(containerWidth, containerHeight);
    p5Canvas.parent('simulation-container');
    ctx = p5Canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Set drawing modes
    ellipseMode(CENTER);  // Draw circles from their center point
    noSmooth();

    // Initialize color lookup table
    initColorLookup();

    // Initialize simulation
    simulation = new WaveSimulation(width, height, window.simResolution);
    window.simulation = simulation;  // Make accessible to GUI

    // Set initial source position and trigger an impulse
    const initialPos = screenToGrid(width * 0.25, height * 0.6);
    simulation.setSource(initialPos.x, initialPos.y);
    simulation.triggerImpulse();

    // Initialize rendering buffers
    imageData = new ImageData(width, height);

    // Set initial frequency
    simulation.setFrequency(440);

    // Handle window resizing
    window.addEventListener('resize', windowResized);
}

// Add window resize handler
function windowResized() {
    const container = document.getElementById('simulation-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    resizeCanvas(containerWidth, containerHeight);

    // Reinitialize simulation with new dimensions
    const oldSimulation = simulation;
    const sourceNormalizedX = oldSimulation.source.x / oldSimulation.cols;
    const sourceNormalizedY = oldSimulation.source.y / oldSimulation.rows;

    simulation = new WaveSimulation(width, height, window.simResolution);
    window.simulation = simulation;

    // Restore simulation parameters
    const newSourceX = Math.floor(sourceNormalizedX * simulation.cols);
    const newSourceY = Math.floor(sourceNormalizedY * simulation.rows);
    simulation.setSource(newSourceX, newSourceY);
    simulation.setFrequency(oldSimulation.source.frequency);
    simulation.setAirAbsorption(oldSimulation.airAbsorption);
    simulation.setWallAbsorption(oldSimulation.wallAbsorption);

    // Update image data buffer
    imageData = new ImageData(width, height);
}

function getPressureColorIndex(pressure) {
    // Apply contrast to the pressure value
    const contrastedPressure = pressure * window.contrastValue;

    // Apply low clip - if absolute pressure is below threshold, set to zero
    const clippedPressure = Math.abs(contrastedPressure) < window.lowClipValue ? 0 : contrastedPressure;

    // Map pressure to lookup table index with clamping
    const normalizedPressure = (clippedPressure + 1.0) / 2.0; // Map from [-1,1] to [0,1]
    const clampedPressure = Math.max(0, Math.min(1, normalizedPressure));
    return Math.floor(clampedPressure * (PRESSURE_STEPS - 1));
}

// Coordinate conversion helpers
function screenToGrid(screenX, screenY) {
    return {
        x: Math.floor(screenX / window.simResolution),
        y: Math.floor(screenY / window.simResolution)
    };
}

function gridToScreen(gridX, gridY) {
    return {
        x: gridX * window.simResolution,  // Sample at grid points
        y: gridY * window.simResolution   // Sample at grid points
    };
}

function draw() {
    background(0);

    // Safety check for simulation
    if (!simulation || !simulation.getPressure) {
        return;
    }

    // Update simulation if not paused
    if (!window.paused) {
        simulation.update();
    }

    // Update source position on mouse click
    if (mouseIsPressed && mouseY < height) {
        const gridPos = screenToGrid(mouseX, mouseY);
        simulation.setSource(gridPos.x, gridPos.y);
    }

    // Safety check for simulation and its components
    if (!simulation.geometry || !simulation.geometry.getWalls) {
        return;
    }

    // Get the current color lookup table based on mode
    const currentLookup = colorLookup[window.visualizationMode];
    const pixels = new Uint8Array(imageData.data.buffer);

    // Update pixel buffer
    for (let i = 0; i < simulation.cols; i++) {
        for (let j = 0; j < simulation.rows; j++) {
            const idx = i + j * simulation.cols;
            const screenPos = gridToScreen(i, j);

            // If this is a wall cell, fill with appropriate wall color
            const walls = simulation.geometry.getWalls();
            if (walls[idx] > 0) {
                const isAnechoic = walls[idx] === 2;
                const wallColor = isAnechoic ? 32 : 128; // Much darker for anechoic surfaces
                const wallAlpha = isAnechoic ? 64 : 255; // Semi-transparent for anechoic

                for (let py = 0; py < window.simResolution; py++) {
                    const rowOffset = ((j * window.simResolution + py) * width + i * window.simResolution) * 4;
                    for (let px = 0; px < window.simResolution; px++) {
                        const pixelOffset = rowOffset + px * 4;
                        pixels[pixelOffset] = wallColor;     // Wall color
                        pixels[pixelOffset + 1] = wallColor;
                        pixels[pixelOffset + 2] = wallColor;
                        pixels[pixelOffset + 3] = wallAlpha; // Make anechoic walls semi-transparent
                    }
                }
                continue;  // Skip interpolation for wall cells
            }

            // Get pressure values for current cell and neighbors
            const p00 = simulation.getPressure(screenPos.x, screenPos.y);

            // Get neighbor positions in screen space
            const rightPos = gridToScreen(i + 1, j);
            const bottomPos = gridToScreen(i, j + 1);
            const bottomRightPos = gridToScreen(i + 1, j + 1);

            const p10 = (i < simulation.cols - 1 && walls[idx + 1] !== 1) ?
                simulation.getPressure(rightPos.x, rightPos.y) : p00;
            const p01 = (j < simulation.rows - 1 && walls[idx + simulation.cols] !== 1) ?
                simulation.getPressure(bottomPos.x, bottomPos.y) : p00;
            const p11 = (i < simulation.cols - 1 && j < simulation.rows - 1 &&
                walls[idx + simulation.cols + 1] !== 1) ?
                simulation.getPressure(bottomRightPos.x, bottomRightPos.y) : p00;

            // Fill the pixel region with interpolation
            for (let py = 0; py < window.simResolution; py++) {
                const v = py / window.simResolution;
                const rowOffset = ((j * window.simResolution + py) * width + i * window.simResolution) * 4;

                for (let px = 0; px < window.simResolution; px++) {
                    const u = px / window.simResolution;

                    // Bilinear interpolation
                    const pressure = (1 - u) * (1 - v) * p00 +
                        u * (1 - v) * p10 +
                        (1 - u) * v * p01 +
                        u * v * p11;

                    // Get color for interpolated pressure
                    const lookupIdx = getPressureColorIndex(pressure);
                    const colorOffset = lookupIdx * 4;

                    const pixelOffset = rowOffset + px * 4;
                    pixels[pixelOffset] = currentLookup[colorOffset];
                    pixels[pixelOffset + 1] = currentLookup[colorOffset + 1];
                    pixels[pixelOffset + 2] = currentLookup[colorOffset + 2];
                    pixels[pixelOffset + 3] = currentLookup[colorOffset + 3];
                }
            }
        }
    }

    // Update the canvas with the new image data
    ctx.putImageData(imageData, 0, 0);

    // Draw source position
    noFill();
    stroke(255, 255, 0);
    const screenPos = gridToScreen(simulation.source.x, simulation.source.y);
    const sourceDiameter = Math.max(8, window.simResolution / 2); // Scale source indicator with resolution

    // Draw source indicator
    push();
    strokeWeight(1);
    ellipse(
        screenPos.x,
        screenPos.y,
        sourceDiameter,
        sourceDiameter
    );
    pop();

    // Render ImGui
    if (window.renderGUI) {
        window.renderGUI();
    }
} 