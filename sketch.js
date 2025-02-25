let simulation;
let colorMode = 'pressure'; // 'pressure' or 'intensity'
let paused = false;
let simResolution = 8; // pixels per simulation cell (higher = faster but coarser)
let canvas;
let ctx; // Canvas 2D context
let contrastValue = 1.0; // Default contrast value (1.0 = no change)
let buffer; // Pixel buffer for efficient rendering
let colorLookup; // Color lookup table
let imageData; // ImageData for direct pixel manipulation
const PRESSURE_STEPS = 1024; // Number of pre-calculated color values
let wavelengthCircleOpacity = 0; // Opacity for the wavelength circle
let wavelengthCircleTimeout = 0; // Timeout for the wavelength circle

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
            colorLookup.pressure[idx] = map(intensity, 0.5, 1, 0, 255); // Red
            colorLookup.pressure[idx + 1] = 0;  // Green
            colorLookup.pressure[idx + 2] = 0;  // Blue
        } else {
            colorLookup.pressure[idx] = 0;      // Red
            colorLookup.pressure[idx + 1] = 0;  // Green
            colorLookup.pressure[idx + 2] = map(intensity, 0, 0.5, 255, 0); // Blue
        }
        colorLookup.pressure[idx + 3] = 255;    // Alpha

        // Intensity mode colors - use curved pressure for better contrast
        const gray = map(abs(curvedPressure), 0, 1, 0, 255);
        colorLookup.intensity[idx] = gray;
        colorLookup.intensity[idx + 1] = gray;
        colorLookup.intensity[idx + 2] = gray;
        colorLookup.intensity[idx + 3] = 255;
    }
}

function setup() {
    // Create canvas with willReadFrequently attribute
    canvas = createCanvas(1200, 800);
    ctx = canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Initialize simulation
    simulation = new WaveSimulation(width, height, simResolution);

    // Initialize rendering buffers
    imageData = new ImageData(width, height);
    initColorLookup();

    // Layout configuration
    const margin = 20;
    const sliderWidth = 150;
    const spacing = 10;

    // Create container div for controls
    let controlsDiv = createDiv('');
    controlsDiv.style('padding', margin + 'px');
    controlsDiv.style('background-color', '#f0f0f0');
    controlsDiv.style('border-radius', '5px');
    controlsDiv.style('margin-top', '10px');
    controlsDiv.style('display', 'grid');
    controlsDiv.style('grid-template-columns', 'repeat(2, 1fr)');
    controlsDiv.style('gap', '10px');
    controlsDiv.style('width', width + 'px');

    // Left column controls
    let leftDiv = createDiv('');

    // Air absorption control
    let airDiv = createDiv('');
    createSpan('Air Absorption: ').parent(airDiv);
    let airSlider = createSlider(0, 100, 80);  // Start with high air absorption (80%)
    airSlider.style('width', sliderWidth + 'px');
    airSlider.parent(airDiv);
    let airReadout = createSpan('80%').parent(airDiv);
    airSlider.input(() => {
        const value = airSlider.value();
        airReadout.html(value + '%');
        simulation.setAirAbsorption(value / 100);
    });
    airDiv.parent(leftDiv);

    // Wall absorption control
    let absorbDiv = createDiv('');
    absorbDiv.style('margin-top', spacing + 'px');
    createSpan('Wall Absorption: ').parent(absorbDiv);
    let absorptionSlider = createSlider(0, 100, 90);  // Start with high wall absorption (90%)
    absorptionSlider.style('width', sliderWidth + 'px');
    absorptionSlider.parent(absorbDiv);
    let wallReadout = createSpan('90%').parent(absorbDiv);
    absorptionSlider.input(() => {
        const value = absorptionSlider.value();
        wallReadout.html(value + '%');
        simulation.setWallAbsorption(value / 100);
    });
    absorbDiv.parent(leftDiv);

    // Frequency control
    let freqDiv = createDiv('');
    freqDiv.style('margin-top', spacing + 'px');
    createSpan('Frequency (Hz): ').parent(freqDiv);
    let freqSlider = createSlider(20, 500, 440);  // Default to 440 Hz (concert A)
    freqSlider.style('width', sliderWidth + 'px');
    freqSlider.parent(freqDiv);
    let freqReadout = createSpan('440 Hz').parent(freqDiv);
    freqSlider.input(() => {
        const value = freqSlider.value();
        freqReadout.html(value + ' Hz');
        simulation.setFrequency(value);
    });
    // Set initial frequency
    simulation.setFrequency(440);
    freqDiv.parent(leftDiv);

    // Contrast control
    let contrastDiv = createDiv('');
    contrastDiv.style('margin-top', spacing + 'px');
    createSpan('Contrast: ').parent(contrastDiv);
    let contrastSlider = createSlider(1, 100, 50);  // Linear range, default to middle
    contrastSlider.style('width', sliderWidth + 'px');
    contrastSlider.parent(contrastDiv);

    // Calculate initial contrast value
    const initialNormalizedValue = (50 - 1) / 99;
    contrastValue = Math.pow(2, initialNormalizedValue * 4);
    let contrastReadout = createSpan('50').parent(contrastDiv);

    contrastSlider.input(() => {
        // Map slider value [1,100] to contrast range [1.0, 15.0] with exponential curve
        const normalizedValue = (contrastSlider.value() - 1) / 99; // Map to [0,1]
        contrastValue = Math.pow(2, normalizedValue * 4); // Maps to [1.0, 16.0]
        contrastReadout.html(contrastSlider.value());
    });
    contrastDiv.parent(leftDiv);

    leftDiv.parent(controlsDiv);

    // Right column controls
    let rightDiv = createDiv('');

    // Resolution control
    let resDiv = createDiv('');
    createSpan('Resolution: ').parent(resDiv);
    let resolutionSelect = createSelect();
    resolutionSelect.style('width', sliderWidth + 'px');
    resolutionSelect.option('Ultra Fast (32px)', 32);
    resolutionSelect.option('Very Fast (16px)', 16);
    resolutionSelect.option('Fast (8px)', 8);
    resolutionSelect.option('Medium (4px)', 4);
    resolutionSelect.option('Fine (2px)', 2);
    resolutionSelect.selected(simResolution);
    resolutionSelect.changed(() => {
        simResolution = parseInt(resolutionSelect.value());
        if (simulation) {
            simulation.dispose();  // Clean up old simulation
        }
        simulation = new WaveSimulation(width, height, simResolution);
    });
    resolutionSelect.parent(resDiv);
    resDiv.parent(rightDiv);

    // Button controls
    let buttonDiv = createDiv('');
    buttonDiv.style('margin-top', spacing + 'px');

    let triggerButton = createButton('Trigger Impulse');
    triggerButton.style('margin-right', spacing + 'px');
    triggerButton.mousePressed(() => {
        simulation.triggerImpulse();
    });
    triggerButton.parent(buttonDiv);

    let modeButton = createButton('Toggle Color Mode');
    modeButton.style('margin-right', spacing + 'px');
    modeButton.mousePressed(() => {
        colorMode = colorMode === 'pressure' ? 'intensity' : 'pressure';
    });
    modeButton.parent(buttonDiv);

    let pauseButton = createButton('Pause/Resume');
    pauseButton.mousePressed(() => {
        paused = !paused;
    });
    pauseButton.parent(buttonDiv);

    buttonDiv.parent(rightDiv);
    rightDiv.parent(controlsDiv);

    // Disable smoothing for sharper visualization
    noSmooth();
}

function getPressureColorIndex(pressure) {
    // Apply contrast to the pressure value
    const contrastedPressure = pressure * contrastValue;
    // Map pressure to lookup table index with clamping
    const normalizedPressure = (contrastedPressure + 1.0) / 2.0; // Map from [-1,1] to [0,1]
    const clampedPressure = Math.max(0, Math.min(1, normalizedPressure));
    return Math.floor(clampedPressure * (PRESSURE_STEPS - 1));
}

function draw() {
    background(0);

    // Update simulation if not paused
    if (!paused) {
        simulation.update();
        simulation.updateWarning();
    }

    // Update source position on mouse click
    if (mouseIsPressed && mouseY < height) {
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

    // Get the current color lookup table based on mode
    const currentLookup = colorLookup[colorMode];
    const pixels = new Uint8Array(imageData.data.buffer);

    // Update pixel buffer
    for (let i = 0; i < simulation.cols; i++) {
        for (let j = 0; j < simulation.rows; j++) {
            const idx = i + j * simulation.cols;
            const x = i * simResolution;
            const y = j * simResolution;

            // If this is a wall cell, fill with wall color
            if (simulation.walls[idx] === 1) {
                const colorOffset = (PRESSURE_STEPS - 1) * 4;  // Use last color in lookup for walls
                for (let py = 0; py < simResolution; py++) {
                    const rowOffset = ((y + py) * width + x) * 4;
                    for (let px = 0; px < simResolution; px++) {
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
            const p10 = (i < simulation.cols - 1 && simulation.walls[idx + 1] !== 1) ?
                simulation.getPressure(x + simResolution, y) : p00;
            const p01 = (j < simulation.rows - 1 && simulation.walls[idx + simulation.cols] !== 1) ?
                simulation.getPressure(x, y + simResolution) : p00;
            const p11 = (i < simulation.cols - 1 && j < simulation.rows - 1 &&
                simulation.walls[idx + simulation.cols + 1] !== 1) ?
                simulation.getPressure(x + simResolution, y + simResolution) : p00;

            // Fill the pixel region with interpolation
            for (let py = 0; py < simResolution; py++) {
                const v = py / simResolution;
                const rowOffset = ((y + py) * width + x) * 4;

                for (let px = 0; px < simResolution; px++) {
                    const u = px / simResolution;

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

    // Draw wavelength circle (if visible)
    if (wavelengthCircleOpacity > 0) {
        const wavelengthCells = simulation.c / (simulation.frequency * simulation.dx);
        const radius = wavelengthCells * simResolution;

        // Draw dotted circle
        push();
        noFill();
        stroke(255, 255, 0, wavelengthCircleOpacity);
        strokeWeight(1);
        drawingContext.setLineDash([5, 5]); // Create dotted line
        ellipse(
            (simulation.sourceX + 0.5) * simResolution,
            (simulation.sourceY + 0.5) * simResolution,
            radius * 2,
            radius * 2
        );
        drawingContext.setLineDash([]); // Reset line style
        pop();
    }

    // Draw source position
    noFill();
    stroke(255, 255, 0);
    const centerX = (simulation.sourceX + 0.5) * simResolution;
    const centerY = (simulation.sourceY + 0.5) * simResolution;
    ellipse(
        centerX,
        centerY,
        simResolution * 0.8,
        simResolution * 0.8
    );

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
} 