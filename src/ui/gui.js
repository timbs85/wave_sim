// GUI state
let initialized = false;
let imguiCanvas = null;

// Initialize ImGui
async function initGUI() {
    try {
        console.log('Initializing ImGui...');

        // Create and setup canvas
        imguiCanvas = document.createElement('canvas');
        const container = document.getElementById('controls-container');
        imguiCanvas.width = container.clientWidth;
        imguiCanvas.height = container.clientHeight;
        imguiCanvas.style.position = 'absolute';
        imguiCanvas.style.top = '0';
        imguiCanvas.style.left = '0';
        imguiCanvas.style.width = '100%';
        imguiCanvas.style.height = '100%';
        document.getElementById('imgui-container').appendChild(imguiCanvas);

        // Initialize ImGui
        await ImGui.default();

        // Create context
        const ctx = ImGui.CreateContext();
        ImGui.SetCurrentContext(ctx);

        // Setup style
        ImGui.StyleColorsDark();
        const style = ImGui.GetStyle();
        style.WindowRounding = 0;
        style.WindowBorderSize = 0;
        style.WindowPadding = new ImGui.Vec2(10, 10);

        // Init implementation
        const gl = imguiCanvas.getContext('webgl2', { alpha: true }) ||
            imguiCanvas.getContext('webgl', { alpha: true });
        ImGui_Impl.Init(gl);

        // Handle window resize
        window.addEventListener('resize', () => {
            const container = document.getElementById('controls-container');
            imguiCanvas.width = container.clientWidth;
            imguiCanvas.height = container.clientHeight;
            gl.viewport(0, 0, imguiCanvas.width, imguiCanvas.height);
        });

        // Sync initial state with window variables
        window.contrastValue = Math.pow(2, ((window.params.controls.contrast - 1) / 99) * 4);
        window.lowClipValue = window.params.controls.lowClip / 100;
        window.visualizationMode = window.params.controls.visualizationMode;
        window.paused = window.params.controls.paused;

        // Set initial simulation parameters if simulation exists
        if (window.simulation) {
            window.simulation.setAirAbsorption(window.params.controls.airAbsorption / 100);
            window.simulation.setWallAbsorption(window.params.controls.wallAbsorption / 100);
            window.simulation.setFrequency(window.params.controls.frequency);
        }

        initialized = true;
        console.log('ImGui initialization completed');
    } catch (error) {
        console.error('Error initializing ImGui:', error);
        throw error;
    }
}

// Render GUI
function renderGUI() {
    if (!initialized) return;

    try {
        ImGui_Impl.NewFrame();
        ImGui.NewFrame();

        // Main control window - Set to fill the entire controls container
        const windowFlags = ImGui.WindowFlags.NoCollapse |
            ImGui.WindowFlags.NoMove |
            ImGui.WindowFlags.NoResize |
            ImGui.WindowFlags.NoBringToFrontOnFocus |
            ImGui.WindowFlags.NoTitleBar;  // Remove title bar for full width

        ImGui.SetNextWindowPos(new ImGui.Vec2(0, 0));
        ImGui.SetNextWindowSize(new ImGui.Vec2(imguiCanvas.width, imguiCanvas.height));

        ImGui.Begin("Wave Simulation Controls", null, windowFlags);

        // Add a custom title since we removed the title bar
        ImGui.Text("Wave Simulation Controls");
        ImGui.Separator();

        // Air absorption slider
        const airAbs = [window.params.controls.airAbsorption];
        if (ImGui.SliderFloat("Air Absorption (%)", airAbs, 0.0, 100.0, "%.1f%%")) {
            window.params.controls.airAbsorption = airAbs[0];
            if (window.simulation) {
                window.simulation.setAirAbsorption(window.params.controls.airAbsorption / 100);
            }
        }

        // Wall absorption slider
        const wallAbs = [window.params.controls.wallAbsorption];
        if (ImGui.SliderFloat("Wall Absorption (%)", wallAbs, 0.0, 100.0, "%.1f%%")) {
            window.params.controls.wallAbsorption = wallAbs[0];
            if (window.simulation) {
                window.simulation.setWallAbsorption(window.params.controls.wallAbsorption / 100);
            }
        }

        // Frequency slider
        const freq = [window.params.controls.frequency];
        if (ImGui.SliderFloat("Frequency (Hz)", freq, 20.0, 500.0, "%.1f Hz")) {
            window.params.controls.frequency = freq[0];
            if (window.simulation) {
                window.simulation.setFrequency(window.params.controls.frequency);
            }
        }

        // Contrast slider
        const contrast = [window.params.controls.contrast];
        if (ImGui.SliderFloat("Contrast", contrast, 1.0, 100.0, "%.1f")) {
            window.params.controls.contrast = contrast[0];
            // Map slider value [1,100] to contrast range [1.0, 15.0] with exponential curve
            const normalizedValue = (window.params.controls.contrast - 1) / 99;
            window.contrastValue = Math.pow(2, normalizedValue * 4);
        }

        // Low clip slider
        const lowClip = [window.params.controls.lowClip];
        if (ImGui.SliderFloat("Low Clip (%)", lowClip, 0.0, 100.0, "%.1f%%")) {
            window.params.controls.lowClip = lowClip[0];
            window.lowClipValue = window.params.controls.lowClip / 100;
        }

        ImGui.Separator();

        // Resolution combo
        const resolutions = [
            { label: 'Very Fast (16px)', value: 16 },
            { label: 'Fast (8px)', value: 8 },
            { label: 'Medium (4px)', value: 4 },
            { label: 'Fine (2px)', value: 2 }
        ];

        const currentRes = resolutions.find(r => r.value === window.params.controls.resolution);
        if (ImGui.BeginCombo("Resolution", currentRes.label)) {
            for (const res of resolutions) {
                if (ImGui.Selectable(res.label, res.value === window.params.controls.resolution)) {
                    const oldResolution = window.params.controls.resolution;
                    window.params.controls.resolution = res.value;
                    window.simResolution = window.params.controls.resolution;

                    if (window.simulation) {
                        const oldSimulation = window.simulation;

                        // Calculate normalized source position (0-1 range)
                        const sourceNormalizedX = oldSimulation.source.x / oldSimulation.cols;
                        const sourceNormalizedY = oldSimulation.source.y / oldSimulation.rows;

                        // Dispose old simulation
                        oldSimulation.dispose();

                        // Create new simulation with new resolution
                        window.simulation = new WaveSimulation(
                            window.params.room.width,
                            window.params.room.height,
                            window.params.controls.resolution
                        );

                        // Calculate new source position based on normalized coordinates
                        const newSourceX = Math.floor(sourceNormalizedX * window.simulation.cols);
                        const newSourceY = Math.floor(sourceNormalizedY * window.simulation.rows);

                        // Re-apply all parameters with scaled source position
                        window.simulation.setSource(newSourceX, newSourceY);
                        window.simulation.setAirAbsorption(window.params.controls.airAbsorption / 100);
                        window.simulation.setWallAbsorption(window.params.controls.wallAbsorption / 100);
                        window.simulation.setFrequency(window.params.controls.frequency);
                        window.simulation.triggerImpulse(); // Trigger an impulse to start the new simulation

                        // Update local reference
                        simulation = window.simulation;
                    }
                }
            }
            ImGui.EndCombo();
        }

        ImGui.Separator();

        // Control buttons in a row
        const buttonWidth = ImGui.GetContentRegionAvail().x / 3 - 5;

        if (ImGui.Button("Trigger Impulse", new ImGui.Vec2(buttonWidth, 0))) {
            if (window.simulation) {
                window.simulation.triggerImpulse();
            }
        }

        ImGui.SameLine();
        if (ImGui.Button("Toggle Visualization", new ImGui.Vec2(buttonWidth, 0))) {
            window.params.controls.visualizationMode = window.params.controls.visualizationMode === 'pressure' ? 'intensity' : 'pressure';
            window.visualizationMode = window.params.controls.visualizationMode;
        }

        ImGui.SameLine();
        if (ImGui.Button(window.params.controls.paused ? "Resume" : "Pause", new ImGui.Vec2(buttonWidth, 0))) {
            window.params.controls.paused = !window.params.controls.paused;
            window.paused = window.params.controls.paused;
        }

        ImGui.Separator();

        // Signal Graph
        const graphWidth = ImGui.GetContentRegionAvail().x;
        const graphHeight = 100;
        const graphPos = ImGui.GetCursorScreenPos();
        const drawList = ImGui.GetWindowDrawList();

        // Draw graph background
        drawList.AddRectFilled(
            graphPos,
            new ImGui.Vec2(graphPos.x + graphWidth, graphPos.y + graphHeight),
            ImGui.COL32(30, 30, 30, 255)
        );

        // Draw grid lines
        const gridColor = ImGui.COL32(50, 50, 50, 255);
        const numVerticalLines = 10;
        for (let i = 1; i < numVerticalLines; i++) {
            const x = graphPos.x + (graphWidth * i) / numVerticalLines;
            drawList.AddLine(
                new ImGui.Vec2(x, graphPos.y),
                new ImGui.Vec2(x, graphPos.y + graphHeight),
                gridColor
            );
        }
        for (let i = 1; i < 4; i++) {
            const y = graphPos.y + (graphHeight * i) / 4;
            drawList.AddLine(
                new ImGui.Vec2(graphPos.x, y),
                new ImGui.Vec2(graphPos.x + graphWidth, y),
                gridColor
            );
        }

        // Draw signal waveform
        if (window.simulation && window.simulation.source && window.simulation.source.signal) {
            const signal = window.simulation.source.signal;
            const points = [];
            const numPoints = 100;
            const timeScale = 1 / window.params.controls.frequency; // One period

            // Create a temporary signal for visualization
            const tempSignal = new Signal(signal.type, {
                frequency: signal.frequency,
                amplitude: signal.amplitude,
                phase: signal.phase,
                pulseWidth: signal.pulseWidth,
                harmonics: signal.harmonics
            });

            for (let i = 0; i < numPoints; i++) {
                const t = (i / numPoints) * timeScale;
                const value = tempSignal.getValue(t);
                const x = graphPos.x + (i / numPoints) * graphWidth;
                const y = graphPos.y + (0.5 - value * 0.45) * graphHeight; // Increased vertical scale
                points.push(new ImGui.Vec2(x, y));
            }

            // Draw zero line
            drawList.AddLine(
                new ImGui.Vec2(graphPos.x, graphPos.y + graphHeight * 0.5),
                new ImGui.Vec2(graphPos.x + graphWidth, graphPos.y + graphHeight * 0.5),
                ImGui.COL32(100, 100, 100, 255)
            );

            // Draw the waveform
            for (let i = 0; i < points.length - 1; i++) {
                drawList.AddLine(
                    points[i],
                    points[i + 1],
                    ImGui.COL32(255, 255, 0, 255),
                    1.5
                );
            }
        }

        ImGui.Dummy(new ImGui.Vec2(0, graphHeight + 10)); // Add space after the graph

        ImGui.End();

        // Render
        ImGui.Render();
        ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
    } catch (error) {
        console.error('Error in render:', error);
    }
}

// Initialize GUI
initGUI().catch(console.error);

// Export for p5.js
window.renderGUI = renderGUI; 