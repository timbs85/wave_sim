let p5Canvas;
let ctx; // Canvas 2D context
let colorLookup; // Color lookup table
let imageData; // ImageData for direct pixel manipulation
const PRESSURE_STEPS = 1024; // Number of pre-calculated color values
let setupComplete = false; // Flag to track when setup is complete

// Global application state
window.simResolution = 8; // pixels per simulation cell (higher = faster but coarser)
window.simManager = null;
window.simulation = null;
window.contrastValue = 1.0;
window.lowClipValue = 0.0;
window.visualizationMode = 'pressure';
window.paused = false;
window.gui = null;
window.appManager = null;

// p5.js preload function - runs before setup
function preload() {
    // Initialize color lookup table early
    initColorLookup();

    // Disable automatic looping - we'll manually control when drawing starts
    p5.disableFriendlyErrors = true; // For performance
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

async function setup() {
    // Create canvas
    const container = document.getElementById('simulation-container');
    p5Canvas = createCanvas(container.clientWidth, container.clientHeight);
    p5Canvas.parent('simulation-container');
    ctx = p5Canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Basic p5.js setup
    ellipseMode(CENTER);
    noSmooth();

    // Completely stop the draw loop until initialization is complete
    noLoop();

    console.log('Setting up application...');

    try {
        // Initialize the application using the AppManager
        window.appManager = new AppManager();
        await window.appManager.initialize();

        console.log('Application initialized. Checking simulation state:');
        console.log('simManager:', window.simManager);
        console.log('simulation:', window.simulation);

        if (window.simManager) {
            console.log('simManager.pressureField:', window.simManager.pressureField);
            console.log('simManager.geometry:', window.simManager.geometry);
            console.log('simManager.cols:', window.simManager.cols);
            console.log('simManager.rows:', window.simManager.rows);
        }

        // Initialize rendering buffers after simulation is ready
        if (window.simManager) {
            const imageWidth = window.simManager.cols * window.simResolution;
            const imageHeight = window.simManager.rows * window.simResolution;
            imageData = new ImageData(imageWidth, imageHeight);
            console.log(`Initialized imageData with dimensions: ${imageWidth}x${imageHeight}`);

            // Force a resize to ensure correct scaling after initialization
            windowResized();
        } else {
            console.warn('Simulation manager not available after initialization');
        }

        // Cleanup handler
        window.addEventListener('unload', () => {
            if (window.appManager) {
                window.appManager.dispose();
            }
        });

        setupComplete = true;

        // Now that everything is initialized, start the draw loop
        console.log('Setup complete, starting draw loop');
        loop();
    } catch (error) {
        console.error('Error during setup:', error);
        // Even if there's an error, try to start the draw loop
        loop();
    }
}

function windowResized() {
    const container = document.getElementById('simulation-container');
    resizeCanvas(container.clientWidth, container.clientHeight, true);

    // Only recreate image buffer if simulation dimensions have changed
    if (window.simManager && imageData) {
        const imageWidth = window.simManager.cols * window.simResolution;
        const imageHeight = window.simManager.rows * window.simResolution;
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
    if (!window.simManager) return 1;

    // Calculate the simulation's actual dimensions in pixels
    const simWidth = window.simManager.cols * window.simResolution;
    const simHeight = window.simManager.rows * window.simResolution;

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
    if (!window.simManager) return { x: 0, y: 0 };

    const scaleFactor = getDisplayScale();
    const simWidth = window.simManager.cols * window.simResolution;
    const simHeight = window.simManager.rows * window.simResolution;
    return {
        x: (width - simWidth * scaleFactor) / 2,
        y: (height - simHeight * scaleFactor) / 2
    };
}

// Convert screen coordinates to simulation grid coordinates
function screenToSimulation(screenX, screenY) {
    if (!window.simManager) return { x: -1, y: -1 };

    const { x: offsetX, y: offsetY } = getDisplayOffset();
    const scaleFactor = getDisplayScale();
    return {
        x: Math.floor((screenX - offsetX) / (window.simResolution * scaleFactor)),
        y: Math.floor((screenY - offsetY) / (window.simResolution * scaleFactor))
    };
}

function draw() {
    // Check if setup is complete
    if (!setupComplete) {
        console.warn('draw: setup is not complete');
        return;
    }

    // Check if simulation and imageData are properly initialized
    if (!window.simManager?.pressureField ||
        window.simManager.pressureField.disposed ||
        !imageData) {

        // Debug why we're not rendering
        if (!window.simManager) {
            console.warn('draw: simManager is not available');
        } else if (!window.simManager.pressureField) {
            console.warn('draw: pressureField is not available');
        } else if (window.simManager.pressureField.disposed) {
            console.warn('draw: pressureField is disposed');
        } else if (!imageData) {
            console.warn('draw: imageData is not initialized');
        }

        return;
    }

    background(0);

    // Get display parameters using helper functions
    const scaleFactor = getDisplayScale();
    const { x: offsetX, y: offsetY } = getDisplayOffset();

    // Handle mouse input
    if (mouseIsPressed && mouseY < height) {
        const simPos = screenToSimulation(mouseX, mouseY);
        if (simPos.x >= 0 && simPos.x < window.simManager.cols &&
            simPos.y >= 0 && simPos.y < window.simManager.rows) {
            if (window.simManager.setSource(simPos.x, simPos.y)) {
                window.simManager.triggerImpulse();
            }
        }
    }

    // Ensure imageData is properly sized for the current simulation
    const imageWidth = window.simManager.cols * window.simResolution;
    const imageHeight = window.simManager.rows * window.simResolution;
    if (!imageData || imageData.width !== imageWidth || imageData.height !== imageHeight) {
        imageData = new ImageData(imageWidth, imageHeight);
    }

    // Render the simulation
    const currentLookup = colorLookup[window.visualizationMode];
    const pixels = new Uint8Array(imageData.data.buffer);

    // Update pixel buffer - working directly in simulation grid coordinates
    for (let gridY = 0; gridY < window.simManager.rows; gridY++) {
        for (let gridX = 0; gridX < window.simManager.cols; gridX++) {
            const idx = gridX + gridY * window.simManager.cols;
            const walls = window.simManager.geometry.getWalls();

            // Determine cell color
            let r, g, b, a;
            if (walls[idx] > 0) {
                // Wall cell
                const isAnechoic = walls[idx] === 2;
                r = g = b = isAnechoic ? 32 : 128;
                a = isAnechoic ? 64 : 255;
            } else {
                // Pressure cell - use same grid coordinates for pressure sampling
                const pressure = window.simManager.getPressure(gridX, gridY);
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
    tempCanvas.height = window.simManager.rows * window.simResolution;
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
        window.simManager.rows * window.simResolution * scaleFactor
    );
    ctx.restore();

    // Draw source indicator
    push();
    translate(offsetX, offsetY);
    scale(scaleFactor);
    noFill();
    stroke(255, 255, 0);
    const sourceX = (window.simManager.source.x + 0.5) * window.simResolution;
    const sourceY = (window.simManager.source.y + 0.5) * window.simResolution;
    const sourceDiameter = Math.max(8, window.simResolution / 2);
    ellipse(sourceX, sourceY, sourceDiameter, sourceDiameter);
    pop();

    // Render GUI
    if (window.renderGUI) {
        window.renderGUI();
    }
}