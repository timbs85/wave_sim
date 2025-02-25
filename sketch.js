let simulation;
let colorMode = 'pressure'; // 'pressure' or 'intensity'
let paused = false;
let simResolution = 8; // pixels per simulation cell (higher = faster but coarser)
let canvas;
let contrastValue = 0.1; // Default contrast value (smaller = higher contrast)
let buffer; // Pixel buffer for efficient rendering

function setup() {
    // Create canvas with willReadFrequently attribute
    canvas = createCanvas(1200, 800);
    let ctx = canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Initialize simulation
    simulation = new WaveSimulation(width, height, simResolution);

    // Create pixel buffer for rendering
    buffer = createImage(width, height);
    buffer.loadPixels();

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
    airSlider.input(() => {
        simulation.setAirAbsorption(airSlider.value() / 100);
    });
    airDiv.parent(leftDiv);

    // Wall absorption control
    let absorbDiv = createDiv('');
    absorbDiv.style('margin-top', spacing + 'px');
    createSpan('Wall Absorption: ').parent(absorbDiv);
    let absorptionSlider = createSlider(0, 100, 90);  // Start with high wall absorption (90%)
    absorptionSlider.style('width', sliderWidth + 'px');
    absorptionSlider.parent(absorbDiv);
    absorptionSlider.input(() => {
        simulation.setWallAbsorption(absorptionSlider.value() / 100);
    });
    absorbDiv.parent(leftDiv);

    // Frequency control
    let freqDiv = createDiv('');
    freqDiv.style('margin-top', spacing + 'px');
    createSpan('Frequency (Hz): ').parent(freqDiv);
    let freqSlider = createSlider(20, 500, 200);  // Lower max frequency and default for better visualization
    freqSlider.style('width', sliderWidth + 'px');
    freqSlider.parent(freqDiv);
    freqSlider.input(() => {
        simulation.setFrequency(freqSlider.value());
    });
    freqDiv.parent(leftDiv);

    // Contrast control
    let contrastDiv = createDiv('');
    contrastDiv.style('margin-top', spacing + 'px');
    createSpan('Contrast: ').parent(contrastDiv);
    let contrastSlider = createSlider(1, 100, 70);  // Higher value = higher contrast
    contrastSlider.style('width', sliderWidth + 'px');
    contrastSlider.parent(contrastDiv);
    contrastSlider.input(() => {
        // Exponential curve that bunches high contrast (small values) at the high end
        const normalizedValue = (100 - contrastSlider.value()) / 100;  // Invert slider value
        contrastValue = 0.01 + 0.39 * Math.pow(normalizedValue, 0.3);  // Will range from ~0.4 to ~0.01
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

function getPressureColor(pressure) {
    // Use contrastValue for pressure range mapping
    const intensity = map(pressure, -contrastValue, contrastValue, 0, 1);
    if (colorMode === 'pressure') {
        // Improved color mapping for pressure visualization
        if (intensity > 0.5) {
            // Pure red for positive pressure (no blue blending)
            return [
                map(intensity, 0.5, 1, 0, 255), // Red
                0,                              // Green
                0,                              // Blue
                255                             // Alpha
            ];
        } else {
            // Pure blue for negative pressure (no red blending)
            return [
                0,                              // Red
                0,                              // Green
                map(intensity, 0, 0.5, 255, 0), // Blue
                255                             // Alpha
            ];
        }
    } else {
        // Intensity visualization (grayscale with enhanced contrast)
        const gray = map(abs(pressure), 0, contrastValue, 0, 255);
        return [gray, gray, gray, 255];
    }
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
    }

    // Update pixel buffer
    buffer.loadPixels();
    for (let i = 0; i < simulation.cols; i++) {
        for (let j = 0; j < simulation.rows; j++) {
            const idx = i + j * simulation.cols;

            // Calculate the pixel region for this cell
            const x = i * simResolution;
            const y = j * simResolution;

            // Get color for this cell
            let cellColor;
            if (simulation.walls[idx] === 1) {
                cellColor = [100, 100, 100, 255]; // Gray for walls
            } else {
                const pressure = simulation.getPressure(x, y);
                cellColor = getPressureColor(pressure);
            }

            // Fill the pixel region for this cell
            for (let px = 0; px < simResolution; px++) {
                for (let py = 0; py < simResolution; py++) {
                    const pixelIndex = ((y + py) * width + (x + px)) * 4;
                    buffer.pixels[pixelIndex] = cellColor[0];     // R
                    buffer.pixels[pixelIndex + 1] = cellColor[1]; // G
                    buffer.pixels[pixelIndex + 2] = cellColor[2]; // B
                    buffer.pixels[pixelIndex + 3] = cellColor[3]; // A
                }
            }
        }
    }
    buffer.updatePixels();

    // Draw the buffer to the screen
    image(buffer, 0, 0);

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