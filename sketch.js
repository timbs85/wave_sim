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

    // Create control buttons
    const buttonY = height + 30;
    const button2Y = height + 60;
    const button3Y = height + 90;

    createButton('Trigger Impulse').mousePressed(() => {
        simulation.triggerImpulse();
    });

    // Add decay rate slider
    createSpan('Decay Rate: ').position(10, buttonY);
    let absorptionSlider = createSlider(0, 100, 10);
    absorptionSlider.position(120, buttonY);
    absorptionSlider.input(() => {
        simulation.setDecayRate(absorptionSlider.value() / 100);
    });

    // Add frequency slider
    createSpan('Frequency (Hz): ').position(10, button2Y);
    let freqSlider = createSlider(20, 1000, 440);
    freqSlider.position(120, button2Y);
    freqSlider.input(() => {
        simulation.setFrequency(freqSlider.value());
    });

    // Add resolution control
    createSpan('Resolution: ').position(10, button3Y);
    let resolutionSelect = createSelect();
    resolutionSelect.position(120, button3Y);
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

    // Add visualization mode toggle
    let modeButton = createButton('Toggle Color Mode');
    modeButton.position(300, buttonY);
    modeButton.mousePressed(() => {
        colorMode = colorMode === 'pressure' ? 'intensity' : 'pressure';
    });

    // Add pause button
    let pauseButton = createButton('Pause/Resume');
    pauseButton.position(300, button2Y);
    pauseButton.mousePressed(() => {
        paused = !paused;
    });

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
    ellipse(
        simulation.sourceX * simulation.cellSize,
        simulation.sourceY * simulation.cellSize,
        10,
        10
    );
} 