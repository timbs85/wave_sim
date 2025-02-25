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
let wavelengthCircleOpacity = 0; // Opacity for the wavelength circle
let wavelengthCircleTimeout = 0; // Timeout for the wavelength circle

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
    // Create canvas with willReadFrequently attribute
    p5Canvas = createCanvas(1200, 800);
    ctx = p5Canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Initialize color lookup table
    initColorLookup();

    // Initialize simulation
    simulation = new WaveSimulation(width, height, window.simResolution);
    window.simulation = simulation;  // Make accessible to GUI

    // Set initial source position and trigger an impulse
    console.log('Setting initial source position...');
    simulation.setSource(width * 0.25, height * 0.6);  // Position source at 25% from left, 60% from top
    console.log('Source position set, triggering impulse...');
    simulation.triggerImpulse();  // Initial impulse to see if simulation is working
    console.log('Initial impulse triggered');

    // Initialize rendering buffers
    imageData = new ImageData(width, height);

    // Set initial frequency
    simulation.setFrequency(440);

    // Disable smoothing for sharper visualization
    noSmooth();
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

function draw() {
    background(0);

    // Safety check for simulation
    if (!simulation || !simulation.getPressure) {
        return;
    }

    // Update simulation if not paused
    if (!window.paused) {
        simulation.update();
        simulation.updateWarning();

        // Debug: Check if pressure field has any non-zero values
        let hasActivity = false;
        for (let i = 0; i < simulation.cols; i++) {
            for (let j = 0; j < simulation.rows; j++) {
                if (Math.abs(simulation.getPressure(i * window.simResolution, j * window.simResolution)) > 0.001) {
                    hasActivity = true;
                    break;
                }
            }
            if (hasActivity) break;
        }
        if (!hasActivity) {
            console.log('No pressure activity detected');
        }
    }

    // Update source position on mouse click - only if ImGui is not capturing mouse
    if (mouseIsPressed && mouseY < height && ImGui && !ImGui.GetIO().WantCaptureMouse) {
        simulation.setSource(mouseX, mouseY);
        // Show wavelength circle for 3 seconds when source is moved
        wavelengthCircleOpacity = 255;
        wavelengthCircleTimeout = 3;
    }

    // Update wavelength circle opacity
    if (wavelengthCircleTimeout > 0) {
        wavelengthCircleTimeout -= simulation.dt;
        if (wavelengthCircleTimeout <= 0) {
            wavelengthCircleOpacity = 0;
        } else if (wavelengthCircleTimeout < 1) {
            wavelengthCircleOpacity = Math.floor(255 * wavelengthCircleTimeout);
        }
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
            const x = i * window.simResolution;
            const y = j * window.simResolution;

            // If this is a wall cell, fill with wall color
            const walls = simulation.geometry.getWalls();
            if (walls[idx] === 1) {
                const colorOffset = (PRESSURE_STEPS - 1) * 4;  // Use last color in lookup for walls
                for (let py = 0; py < window.simResolution; py++) {
                    const rowOffset = ((y + py) * width + x) * 4;
                    for (let px = 0; px < window.simResolution; px++) {
                        const pixelOffset = rowOffset + px * 4;
                        pixels[pixelOffset] = 128;     // Gray color for walls
                        pixels[pixelOffset + 1] = 128;
                        pixels[pixelOffset + 2] = 128;
                        pixels[pixelOffset + 3] = 255;
                    }
                }
                continue;  // Skip interpolation for wall cells
            }

            // Get pressure values for current cell and neighbors
            const p00 = simulation.getPressure(x, y);
            const p10 = (i < simulation.cols - 1 && walls[idx + 1] !== 1) ?
                simulation.getPressure(x + window.simResolution, y) : p00;
            const p01 = (j < simulation.rows - 1 && walls[idx + simulation.cols] !== 1) ?
                simulation.getPressure(x, y + window.simResolution) : p00;
            const p11 = (i < simulation.cols - 1 && j < simulation.rows - 1 &&
                walls[idx + simulation.cols + 1] !== 1) ?
                simulation.getPressure(x + window.simResolution, y + window.simResolution) : p00;

            // Fill the pixel region with interpolation
            for (let py = 0; py < window.simResolution; py++) {
                const v = py / window.simResolution;
                const rowOffset = ((y + py) * width + x) * 4;

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
    const sourceX = simulation.source.x * window.simResolution;
    const sourceY = simulation.source.y * window.simResolution;
    const sourceDiameter = 8; // Fixed 8-pixel diameter for source circle
    ellipse(
        sourceX,
        sourceY,
        sourceDiameter,
        sourceDiameter
    );

    // Draw wavelength circle (if visible)
    if (wavelengthCircleOpacity > 0) {
        const wavelengthCells = simulation.c / (simulation.source.frequency * simulation.dx);
        const radius = wavelengthCells * window.simResolution;

        // Draw dotted circle
        push();
        noFill();
        stroke(255, 255, 0, wavelengthCircleOpacity);
        strokeWeight(1);
        drawingContext.setLineDash([5, 5]); // Create dotted line
        ellipse(
            sourceX,
            sourceY,
            radius * 2,
            radius * 2
        );
        drawingContext.setLineDash([]); // Reset line style
        pop();
    }

    // Draw warning message if exists
    if (simulation.warningMessage) {
        // Set up warning message style
        textAlign(CENTER);
        textSize(16);
        const padding = 10;
        const messageWidth = textWidth(simulation.warningMessage.text) + padding * 2;
        const messageHeight = 30;

        // Draw warning background in center of screen
        fill(255, 50, 50, 200);  // Semi-transparent red
        noStroke();
        rect(
            (width - messageWidth) / 2,
            (height - messageHeight) / 2,
            messageWidth,
            messageHeight,
            5  // Rounded corners
        );

        // Draw warning text
        fill(255);  // White text
        text(
            simulation.warningMessage.text,
            width / 2,
            height / 2
        );
    }

    // Render ImGui
    if (window.renderGUI) {
        window.renderGUI();
    }
} 