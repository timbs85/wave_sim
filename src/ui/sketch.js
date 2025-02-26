let simManager;
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
window.simManager = null;
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
    // Create canvas with fixed simulation dimensions
    const SIMULATION_WIDTH = 800;
    const SIMULATION_HEIGHT = 600;

    // Get the container dimensions
    const container = document.getElementById('simulation-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Create the canvas with container dimensions
    p5Canvas = createCanvas(containerWidth, containerHeight);
    p5Canvas.parent('simulation-container');
    ctx = p5Canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Set drawing modes
    ellipseMode(CENTER);  // Draw circles from their center point
    noSmooth();

    // Initialize color lookup table
    initColorLookup();

    // Initialize simulation with simulation dimensions (internal resolution)
    const simParams = {
        room: {
            width: SIMULATION_WIDTH,
            height: SIMULATION_HEIGHT,
            physicalWidth: window.params.room.physicalWidth,
            physicalHeight: window.params.room.physicalHeight,
            leftRoomRatio: window.params.room.leftRoomRatio,
            roomHeightRatio: window.params.room.roomHeightRatio,
            corridorRatio: window.params.room.corridorRatio,
            marginRatio: window.params.room.marginRatio
        },
        physics: window.params.physics,
        source: window.params.source,
        medium: window.params.medium,
        controls: {
            ...window.params.controls,
            resolution: window.simResolution
        }
    };

    // Create simulation manager
    simManager = new SimulationManager(simParams);
    window.simManager = simManager;  // Make accessible globally
    window.simulation = simManager.simulation;  // Make accessible to GUI

    // Set initial source position
    const initialPos = screenToGrid(SIMULATION_WIDTH * 0.25, SIMULATION_HEIGHT * 0.6);
    simManager.setSource(initialPos.x, initialPos.y);

    // Initialize rendering buffers with simulation grid dimensions
    const imageWidth = simManager.cols * window.simResolution;
    const imageHeight = simManager.rows * window.simResolution;
    imageData = new ImageData(imageWidth, imageHeight);

    // Initialize simulation with default frequency
    simManager.simulation.initialize(440);

    // Start the simulation loop
    simManager.start();

    // Clean up when window unloads
    window.addEventListener('unload', () => {
        if (simManager) {
            simManager.dispose();
        }
    });
}

function windowResized() {
    // Get container dimensions
    const container = document.getElementById('simulation-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Resize the canvas to match container
    resizeCanvas(containerWidth, containerHeight, true);
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
        x: Math.floor((screenX - window.simResolution * 0.5) / window.simResolution),
        y: Math.floor((screenY - window.simResolution * 0.5) / window.simResolution)
    };
}

function gridToScreen(gridX, gridY) {
    return {
        x: (gridX + 0.5) * window.simResolution,
        y: (gridY + 0.5) * window.simResolution
    };
}

// Convert grid coordinates to pressure field sampling coordinates
function gridToPressure(gridX, gridY) {
    return {
        x: (gridX + 0.5) * window.simResolution, // Sample at cell centers
        y: (gridY + 0.5) * window.simResolution
    };
}

// Convert grid index to grid coordinates
function indexToGrid(idx, cols) {
    return {
        x: idx % cols,
        y: Math.floor(idx / cols)
    };
}

// Convert grid coordinates to grid index
function gridToIndex(x, y, cols) {
    return x + y * cols;
}

// Check if grid coordinates are within bounds
function isInBounds(x, y, cols, rows) {
    return x >= 0 && x < cols && y >= 0 && y < rows;
}

function draw() {
    background(0);

    // Safety check for simulation
    if (!simManager || !simManager.simulation || !simManager.pressureField || simManager.pressureField.disposed) {
        return;
    }

    // Calculate scale and offset to center the simulation
    const scaleX = width / simManager.width;
    const scaleY = height / simManager.height;
    const scaleFactor = Math.min(scaleX, scaleY);
    const offsetX = (width - simManager.width * scaleFactor) / 2;
    const offsetY = (height - simManager.height * scaleFactor) / 2;

    // Update source position on mouse click - adjust for scaling
    if (mouseIsPressed && mouseY < height) {
        const gridPos = screenToGrid((mouseX - offsetX) / scaleFactor, (mouseY - offsetY) / scaleFactor);
        if (simManager.setSource(gridPos.x, gridPos.y)) {
            simManager.triggerImpulse();
        }
    }

    // Safety check for simulation and its components
    if (!simManager.geometry || !simManager.geometry.getWalls) {
        return;
    }

    // Get the current color lookup table based on mode
    const currentLookup = colorLookup[window.visualizationMode];
    const pixels = new Uint8Array(imageData.data.buffer);

    // Update pixel buffer
    for (let i = 0; i < simManager.cols; i++) {
        for (let j = 0; j < simManager.rows; j++) {
            const idx = gridToIndex(i, j, simManager.cols);
            const pressurePos = gridToPressure(i, j);

            // If this is a wall cell, fill with appropriate wall color
            const walls = simManager.geometry.getWalls();
            if (walls[idx] > 0) {
                const isAnechoic = walls[idx] === 2;
                const wallColor = isAnechoic ? 32 : 128;
                const wallAlpha = isAnechoic ? 64 : 255;

                const imageWidth = simManager.cols * window.simResolution;
                for (let py = 0; py < window.simResolution; py++) {
                    const rowOffset = ((j * window.simResolution + py) * imageWidth + i * window.simResolution) * 4;
                    for (let px = 0; px < window.simResolution; px++) {
                        const pixelOffset = rowOffset + px * 4;
                        pixels[pixelOffset] = wallColor;
                        pixels[pixelOffset + 1] = wallColor;
                        pixels[pixelOffset + 2] = wallColor;
                        pixels[pixelOffset + 3] = wallAlpha;
                    }
                }
                continue;
            }

            // Get pressure value for current cell
            const pressure = simManager.getPressure(pressurePos.x, pressurePos.y);

            // Get color for pressure value
            const lookupIdx = getPressureColorIndex(pressure);
            const colorOffset = lookupIdx * 4;

            // Fill the pixel region with the same color (no interpolation)
            const imageWidth = simManager.cols * window.simResolution;
            for (let py = 0; py < window.simResolution; py++) {
                const rowOffset = ((j * window.simResolution + py) * imageWidth + i * window.simResolution) * 4;
                for (let px = 0; px < window.simResolution; px++) {
                    const pixelOffset = rowOffset + px * 4;
                    pixels[pixelOffset] = currentLookup[colorOffset];
                    pixels[pixelOffset + 1] = currentLookup[colorOffset + 1];
                    pixels[pixelOffset + 2] = currentLookup[colorOffset + 2];
                    pixels[pixelOffset + 3] = currentLookup[colorOffset + 3];
                }
            }
        }
    }

    // Apply transformation for all drawing
    push();
    translate(offsetX, offsetY);
    scale(scaleFactor, scaleFactor);

    // Create a temporary canvas for scaling
    const tempCanvas = document.createElement('canvas');
    const imageWidth = simManager.cols * window.simResolution;
    const imageHeight = simManager.rows * window.simResolution;
    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    // Clear the main canvas
    clear();

    // Draw the scaled image
    ctx.save();
    ctx.resetTransform();
    ctx.drawImage(
        tempCanvas,
        offsetX, offsetY,
        imageWidth * scaleFactor,
        imageHeight * scaleFactor
    );
    ctx.restore();

    // Draw source position
    noFill();
    stroke(255, 255, 0);
    const screenPos = gridToScreen(simManager.source.x, simManager.source.y);
    const sourceDiameter = Math.max(8, window.simResolution / 2);

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

    pop();

    // Render ImGui
    if (window.renderGUI) {
        window.renderGUI();
    }
} 