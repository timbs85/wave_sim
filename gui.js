// GUI state
let initialized = false;
let imguiCanvas = null;

// Simulation parameters
const params = {
    airAbsorption: 80,  // Start with 80%
    wallAbsorption: 90, // Start with 90%
    frequency: 440,     // Default to 440 Hz (concert A)
    contrast: 50,       // Default contrast
    lowClip: 0,        // Default low clip
    resolution: 8,      // Default resolution (Fast)
    visualizationMode: 'pressure', // Default visualization mode
    paused: false      // Default running state
};

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
        window.contrastValue = Math.pow(2, ((params.contrast - 1) / 99) * 4);
        window.lowClipValue = params.lowClip / 100;
        window.visualizationMode = params.visualizationMode;
        window.paused = params.paused;

        // Set initial simulation parameters if simulation exists
        if (window.simulation) {
            window.simulation.setAirAbsorption(params.airAbsorption / 100);
            window.simulation.setWallAbsorption(params.wallAbsorption / 100);
            window.simulation.setFrequency(params.frequency);
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
        const airAbs = [params.airAbsorption];
        if (ImGui.SliderFloat("Air Absorption (%)", airAbs, 0.0, 100.0, "%.1f%%")) {
            params.airAbsorption = airAbs[0];
            if (window.simulation) {
                window.simulation.setAirAbsorption(params.airAbsorption / 100);
            }
        }

        // Wall absorption slider
        const wallAbs = [params.wallAbsorption];
        if (ImGui.SliderFloat("Wall Absorption (%)", wallAbs, 0.0, 100.0, "%.1f%%")) {
            params.wallAbsorption = wallAbs[0];
            if (window.simulation) {
                window.simulation.setWallAbsorption(params.wallAbsorption / 100);
            }
        }

        // Frequency slider
        const freq = [params.frequency];
        if (ImGui.SliderFloat("Frequency (Hz)", freq, 20.0, 500.0, "%.1f Hz")) {
            params.frequency = freq[0];
            if (window.simulation) {
                window.simulation.setFrequency(params.frequency);
            }
        }

        // Contrast slider
        const contrast = [params.contrast];
        if (ImGui.SliderFloat("Contrast", contrast, 1.0, 100.0, "%.1f")) {
            params.contrast = contrast[0];
            // Map slider value [1,100] to contrast range [1.0, 15.0] with exponential curve
            const normalizedValue = (params.contrast - 1) / 99;
            window.contrastValue = Math.pow(2, normalizedValue * 4);
        }

        // Low clip slider
        const lowClip = [params.lowClip];
        if (ImGui.SliderFloat("Low Clip (%)", lowClip, 0.0, 100.0, "%.1f%%")) {
            params.lowClip = lowClip[0];
            window.lowClipValue = params.lowClip / 100;
        }

        ImGui.Separator();

        // Resolution combo
        const resolutions = [
            { label: 'Very Fast (16px)', value: 16 },
            { label: 'Fast (8px)', value: 8 },
            { label: 'Medium (4px)', value: 4 },
            { label: 'Fine (2px)', value: 2 }
        ];

        const currentRes = resolutions.find(r => r.value === params.resolution);
        if (ImGui.BeginCombo("Resolution", currentRes.label)) {
            for (const res of resolutions) {
                if (ImGui.Selectable(res.label, res.value === params.resolution)) {
                    const oldResolution = params.resolution;
                    params.resolution = res.value;
                    window.simResolution = params.resolution;

                    if (window.simulation) {
                        const oldSimulation = window.simulation;

                        // Calculate normalized source position (0-1 range)
                        const sourceNormalizedX = oldSimulation.source.x / oldSimulation.cols;
                        const sourceNormalizedY = oldSimulation.source.y / oldSimulation.rows;

                        // Dispose old simulation
                        oldSimulation.dispose();

                        // Create new simulation with new resolution
                        // Scale the dimensions by the ratio of new to old resolution to maintain same number of cells
                        const scaleRatio = params.resolution / oldResolution;
                        window.simulation = new WaveSimulation(
                            Math.floor(window.width),
                            Math.floor(window.height),
                            params.resolution
                        );

                        // Calculate new source position based on normalized coordinates
                        const newSourceX = Math.floor(sourceNormalizedX * window.simulation.cols);
                        const newSourceY = Math.floor(sourceNormalizedY * window.simulation.rows);

                        // Re-apply all parameters with scaled source position
                        window.simulation.setSource(newSourceX, newSourceY);
                        window.simulation.setAirAbsorption(params.airAbsorption / 100);
                        window.simulation.setWallAbsorption(params.wallAbsorption / 100);
                        window.simulation.setFrequency(params.frequency);

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
            params.visualizationMode = params.visualizationMode === 'pressure' ? 'intensity' : 'pressure';
            window.visualizationMode = params.visualizationMode;
        }

        ImGui.SameLine();
        if (ImGui.Button(params.paused ? "Resume" : "Pause", new ImGui.Vec2(buttonWidth, 0))) {
            params.paused = !params.paused;
            window.paused = params.paused;
        }

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