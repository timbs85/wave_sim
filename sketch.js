let simulation;
let colorMode = 'pressure'; // 'pressure' or 'intensity'
let paused = false;
let simResolution = 8; // pixels per simulation cell (higher = faster but coarser)
let canvas;

function setup() {
    // Create canvas with willReadFrequently attribute
    canvas = createCanvas(800, 600);
    let ctx = canvas.elt.getContext('2d', { willReadFrequently: true });
    pixelDensity(1);

    // Initialize simulation
    simulation = new WaveSimulation(width, height, simResolution);

    // Layout configuration
    const margin = 20;
    const controlWidth = 200;
    const sliderWidth = 150;
    const buttonHeight = 30;
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
    let airSlider = createSlider(0, 100, 20);  // Start with low air absorption
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
    let absorptionSlider = createSlider(0, 100, 30);
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
    let freqSlider = createSlider(20, 1000, 440);
    freqSlider.style('width', sliderWidth + 'px');
    freqSlider.parent(freqDiv);
    freqSlider.input(() => {
        simulation.setFrequency(freqSlider.value());
    });
    freqDiv.parent(leftDiv);

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
    const intensity = map(pressure, -0.5, 0.5, 0, 1);
    if (colorMode === 'pressure') {
        // Improved color mapping for pressure visualization
        if (intensity > 0.5) {
            // Pure red for positive pressure (no blue blending)
            return color(
                map(intensity, 0.5, 1, 0, 255), // Red
                0,                              // Green
                0                               // Blue
            );
        } else {
            // Pure blue for negative pressure (no red blending)
            return color(
                0,                              // Red
                0,                              // Green
                map(intensity, 0, 0.5, 255, 0)  // Blue
            );
        }
    } else {
        // Intensity visualization (grayscale with enhanced contrast)
        const gray = map(abs(pressure), 0, 0.5, 0, 255);
        return color(gray);
    }
}

function draw() {
    background(0);

    // Update simulation if not paused
    if (!paused) {
        simulation.update();
    }

    // Update source position on mouse click
    if (mouseIsPressed && mouseY < height) {
        simulation.setSource(mouseX, mouseY);
    }

    // Visualize the wave field using rectangles
    noStroke();
    for (let i = 0; i < simulation.cols; i++) {
        for (let j = 0; j < simulation.rows; j++) {
            const pressure = simulation.getPressure(i * simResolution, j * simResolution);
            fill(getPressureColor(pressure));
            rect(
                i * simResolution,
                j * simResolution,
                simResolution,
                simResolution
            );
        }
    }

    // Draw source position
    noFill();
    stroke(255, 255, 0);
    const centerX = (simulation.sourceX + 0.5) * simResolution;
    const centerY = (simulation.sourceY + 0.5) * simResolution;
    ellipse(
        centerX,
        centerY,
        simResolution * 0.8,  // Make circle size relative to cell size
        simResolution * 0.8
    );
} 