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

async function initializeSimulation() {
    const SIMULATION_WIDTH = 800;
    const SIMULATION_HEIGHT = 600;

    // Initialize simulation with dimensions
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

    // Create and initialize simulation manager
    simManager = new SimulationManager(simParams);
    await simManager.initialize(simParams);  // Wait for initialization to complete

    window.simManager = simManager;
    window.simulation = simManager.simulation;

    // Initialize rendering buffers
    const imageWidth = simManager.cols * window.simResolution;
    const imageHeight = simManager.rows * window.simResolution;
    imageData = new ImageData(imageWidth, imageHeight);

    // Force a resize to ensure correct scaling after initialization
    windowResized();
}

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
    // Create canvas
    const container = document.getElementById('simulation-container');
    p5Canvas = createCanvas(container.clientWidth, container.clientHeight);
    p5Canvas.parent('simulation-container');
    ctx = p5Canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Basic p5.js setup
    ellipseMode(CENTER);
    noSmooth();

    // Initialize color lookup table
    initColorLookup();

    // Start async initialization
    initializeSimulation().catch(console.error);

    // Cleanup handler
    window.addEventListener('unload', () => {
        if (simManager) {
            simManager.dispose();
        }
    });
}

function windowResized() {
    const container = document.getElementById('simulation-container');
    resizeCanvas(container.clientWidth, container.clientHeight, true);

    // Only recreate image buffer if simulation dimensions have changed
    if (simManager?.simulation) {
        const imageWidth = simManager.cols * window.simResolution;
        const imageHeight = simManager.rows * window.simResolution;
        if (imageData.width !== imageWidth || imageData.height !== imageHeight) {
            imageData = new ImageData(imageWidth, imageHeight);
        }
    }
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

// Scaling and coordinate helpers
function getDisplayScale() {
    if (!simManager?.simulation) return 1;

    // Calculate the simulation's actual dimensions in pixels
    const simWidth = simManager.cols * window.simResolution;
    const simHeight = simManager.rows * window.simResolution;

    // Calculate scale factors while preserving aspect ratio
    const containerAspect = width / height;
    const simAspect = simWidth / simHeight;

    if (containerAspect > simAspect) {
        // Container is wider than simulation - fit to height
        return height / simHeight;
    } else {
        // Container is taller than simulation - fit to width
        return width / simWidth;
    }
}

function getDisplayOffset() {
    const scaleFactor = getDisplayScale();
    const simWidth = simManager.cols * window.simResolution;
    const simHeight = simManager.rows * window.simResolution;
    return {
        x: (width - simWidth * scaleFactor) / 2,
        y: (height - simHeight * scaleFactor) / 2
    };
}

// Convert screen coordinates to simulation grid coordinates
function screenToSimulation(screenX, screenY) {
    const { x: offsetX, y: offsetY } = getDisplayOffset();
    const scaleFactor = getDisplayScale();
    return {
        x: Math.floor((screenX - offsetX) / (window.simResolution * scaleFactor)),
        y: Math.floor((screenY - offsetY) / (window.simResolution * scaleFactor))
    };
}

function draw() {
    if (!simManager?.simulation?.pressureField || simManager.pressureField.disposed) {
        return;
    }

    background(0);

    // Get display parameters using helper functions
    const scaleFactor = getDisplayScale();
    const { x: offsetX, y: offsetY } = getDisplayOffset();

    // Handle mouse input
    if (mouseIsPressed && mouseY < height) {
        const simPos = screenToSimulation(mouseX, mouseY);
        if (simPos.x >= 0 && simPos.x < simManager.cols &&
            simPos.y >= 0 && simPos.y < simManager.rows) {
            if (simManager.setSource(simPos.x, simPos.y)) {
                simManager.triggerImpulse();
            }
        }
    }

    // Render the simulation
    const currentLookup = colorLookup[window.visualizationMode];
    const pixels = new Uint8Array(imageData.data.buffer);
    const imageWidth = simManager.cols * window.simResolution;

    // Update pixel buffer - working directly in simulation grid coordinates
    for (let gridY = 0; gridY < simManager.rows; gridY++) {
        for (let gridX = 0; gridX < simManager.cols; gridX++) {
            const idx = gridX + gridY * simManager.cols;
            const walls = simManager.geometry.getWalls();

            // Determine cell color
            let r, g, b, a;
            if (walls[idx] > 0) {
                // Wall cell
                const isAnechoic = walls[idx] === 2;
                r = g = b = isAnechoic ? 32 : 128;
                a = isAnechoic ? 64 : 255;
            } else {
                // Pressure cell - use same grid coordinates for pressure sampling
                const pressure = simManager.getPressure(gridX, gridY);
                const lookupIdx = getPressureColorIndex(pressure) * 4;
                r = currentLookup[lookupIdx];
                g = currentLookup[lookupIdx + 1];
                b = currentLookup[lookupIdx + 2];
                a = currentLookup[lookupIdx + 3];
            }

            // Fill the cell's pixels
            const cellStartX = gridX * window.simResolution;
            const cellStartY = gridY * window.simResolution;
            for (let py = 0; py < window.simResolution; py++) {
                const rowOffset = ((cellStartY + py) * imageWidth + cellStartX) * 4;
                for (let px = 0; px < window.simResolution; px++) {
                    const pixelOffset = rowOffset + px * 4;
                    pixels[pixelOffset] = r;
                    pixels[pixelOffset + 1] = g;
                    pixels[pixelOffset + 2] = b;
                    pixels[pixelOffset + 3] = a;
                }
            }
        }
    }

    // Draw the simulation
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageWidth;
    tempCanvas.height = simManager.rows * window.simResolution;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    // Clear and draw scaled image
    clear();
    ctx.save();
    ctx.resetTransform();
    ctx.drawImage(
        tempCanvas,
        offsetX, offsetY,
        imageWidth * scaleFactor,
        simManager.rows * window.simResolution * scaleFactor
    );
    ctx.restore();

    // Draw source indicator
    push();
    translate(offsetX, offsetY);
    scale(scaleFactor);
    noFill();
    stroke(255, 255, 0);
    const sourceX = (simManager.source.x + 0.5) * window.simResolution;
    const sourceY = (simManager.source.y + 0.5) * window.simResolution;
    const sourceDiameter = Math.max(8, window.simResolution / 2);
    ellipse(sourceX, sourceY, sourceDiameter, sourceDiameter);
    pop();

    // Render GUI
    if (window.renderGUI) {
        window.renderGUI();
    }
} 