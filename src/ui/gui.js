// GUI state
class GUI {
    constructor() {
        this.params = this.loadParams();
        this.initialized = false;
        this.imguiCanvas = null;
    }

    loadParams() {
        try {
            const saved = localStorage.getItem('wave-sim-params');
            const params = saved ? JSON.parse(saved) : window.params;
            // Ensure all required parameters exist by merging with defaults
            return {
                ...window.params,  // Start with defaults
                ...params,         // Override with saved values
                // Ensure nested objects are properly merged
                controls: {
                    ...window.params.controls,
                    ...(params.controls || {})
                },
                physics: {
                    ...window.params.physics,
                    ...(params.physics || {})
                },
                room: {
                    ...window.params.room,
                    ...(params.room || {})
                },
                medium: {
                    ...window.params.medium,
                    ...(params.medium || {})
                },
                source: {
                    ...window.params.source,
                    ...(params.source || {})
                }
            };
        } catch (e) {
            console.warn('Failed to load params, using defaults:', e);
            return window.params;
        }
    }

    saveParams() {
        try {
            localStorage.setItem('wave-sim-params', JSON.stringify(this.params));
        } catch (e) {
            console.warn('Failed to save params:', e);
        }
    }

    exportParams() {
        const dataStr = JSON.stringify(this.params, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'wave-sim-params.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async importParams() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    const newParams = JSON.parse(text);

                    // Merge with defaults to ensure all required parameters exist
                    this.params = {
                        ...window.params,
                        ...newParams,
                        controls: {
                            ...window.params.controls,
                            ...(newParams.controls || {})
                        },
                        physics: {
                            ...window.params.physics,
                            ...(newParams.physics || {})
                        },
                        room: {
                            ...window.params.room,
                            ...(newParams.room || {})
                        },
                        medium: {
                            ...window.params.medium,
                            ...(newParams.medium || {})
                        },
                        source: {
                            ...window.params.source,
                            ...(newParams.source || {})
                        }
                    };

                    // Save to localStorage
                    this.saveParams();

                    // Stop and dispose current simulation
                    if (window.simManager) {
                        window.simManager.dispose();
                    }

                    // Create new simulation manager with new parameters
                    window.simManager = new SimulationManager(this.params);
                    window.simulation = window.simManager.simulation;

                    // Initialize and start
                    window.simulation.initialize(this.params.controls.frequency);
                    window.simManager.start();

                    resolve(true);
                } catch (error) {
                    console.error('Failed to import parameters:', error);
                    resolve(false);
                }
            };

            input.click();
        });
    }

    async init() {
        try {
            console.log('Initializing ImGui...');

            // Create and setup canvas
            this.imguiCanvas = document.createElement('canvas');
            const container = document.getElementById('controls-container');
            this.imguiCanvas.width = container.clientWidth;
            this.imguiCanvas.height = container.clientHeight;
            this.imguiCanvas.style.position = 'absolute';
            this.imguiCanvas.style.top = '0';
            this.imguiCanvas.style.left = '0';
            this.imguiCanvas.style.width = '100%';
            this.imguiCanvas.style.height = '100%';
            document.getElementById('imgui-container').appendChild(this.imguiCanvas);

            // Initialize ImGui
            await ImGui.default();

            // Create context
            const ctx = ImGui.CreateContext();
            ImGui.SetCurrentContext(ctx);

            // Enable ini file persistence
            const io = ImGui.GetIO();
            io.IniFilename = "imgui.ini";  // Set to null to disable persistence

            // Setup style
            ImGui.StyleColorsDark();
            const style = ImGui.GetStyle();
            style.WindowRounding = 0;
            style.WindowBorderSize = 0;

            // Init implementation
            const gl = this.imguiCanvas.getContext('webgl2', { alpha: true }) ||
                this.imguiCanvas.getContext('webgl', { alpha: true });
            ImGui_Impl.Init(gl);

            // Handle window resize
            window.addEventListener('resize', () => {
                const container = document.getElementById('controls-container');
                this.imguiCanvas.width = container.clientWidth;
                this.imguiCanvas.height = container.clientHeight;
                gl.viewport(0, 0, this.imguiCanvas.width, this.imguiCanvas.height);
            });

            // Wait for simulation manager to be initialized
            const waitForSimManager = () => {
                return new Promise((resolve) => {
                    const check = () => {
                        if (window.simManager) {
                            resolve();
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            };

            // Wait for simulation manager
            await waitForSimManager();

            // Initialize GUI state from simulation
            window.simulation = window.simManager.simulation;
            window.visualizationMode = this.params.controls.visualizationMode;
            window.paused = this.params.controls.paused;
            window.contrastValue = Math.pow(2, (this.params.controls.contrast - 1) / 99 * 4);
            window.lowClipValue = this.params.controls.lowClip / 100;
            window.simResolution = this.params.controls.resolution;

            this.initialized = true;
            console.log('ImGui initialization completed');
        } catch (error) {
            console.error('Error initializing ImGui:', error);
            throw error;
        }
    }

    render() {
        if (!this.initialized) return;

        ImGui_Impl.NewFrame();
        ImGui.NewFrame();

        const windowFlags = ImGui.WindowFlags.NoCollapse |
            ImGui.WindowFlags.NoMove |
            ImGui.WindowFlags.NoResize |
            ImGui.WindowFlags.NoBringToFrontOnFocus |
            ImGui.WindowFlags.NoTitleBar;

        ImGui.SetNextWindowPos(new ImGui.Vec2(0, 0));
        ImGui.SetNextWindowSize(new ImGui.Vec2(this.imguiCanvas.width, this.imguiCanvas.height));

        ImGui.Begin("Wave Simulation Controls", null, windowFlags);

        // Add a custom title since we removed the title bar
        ImGui.Text("Wave Simulation Controls");

        // Add import/export buttons
        const importExportButtonWidth = ImGui.GetContentRegionAvail().x / 2 - 5;
        if (ImGui.Button("Export Parameters", new ImGui.Vec2(importExportButtonWidth, 0))) {
            this.exportParams();
        }
        ImGui.SameLine();
        if (ImGui.Button("Import Parameters", new ImGui.Vec2(importExportButtonWidth, 0))) {
            this.importParams();
        }

        ImGui.Separator();

        // Air absorption slider
        const airAbs = [this.params.controls.airAbsorption];
        if (ImGui.SliderFloat("Air Absorption (%)", airAbs, 0.0, 100.0, "%.1f%%")) {
            this.params.controls.airAbsorption = airAbs[0];
            window.simulation.setAirAbsorption(
                airAbs[0] / 100,
                this.params.medium.maxAirAbsorption
            );
            this.saveParams();
        }

        // Wall absorption slider
        const wallAbs = [this.params.controls.wallAbsorption];
        if (ImGui.SliderFloat("Wall Absorption (%)", wallAbs, 0.0, 100.0, "%.1f%%")) {
            this.params.controls.wallAbsorption = wallAbs[0];
            window.simulation.setWallAbsorption(wallAbs[0] / 100);
            this.saveParams();
        }

        // Frequency slider
        const freq = [this.params.controls.frequency];
        if (ImGui.SliderFloat("Frequency (Hz)", freq, 20.0, 500.0, "%.1f Hz")) {
            this.params.controls.frequency = freq[0];
            window.simulation.setFrequency(freq[0]);
            this.saveParams();
        }

        // Contrast slider
        const contrast = [this.params.controls.contrast];
        if (ImGui.SliderFloat("Contrast", contrast, 1.0, 100.0, "%.1f")) {
            this.params.controls.contrast = contrast[0];
            // Map slider value [1,100] to contrast range [1.0, 15.0] with exponential curve
            const normalizedValue = (this.params.controls.contrast - 1) / 99;
            window.contrastValue = Math.pow(2, normalizedValue * 4);
        }

        // Low clip slider
        const lowClip = [this.params.controls.lowClip];
        if (ImGui.SliderFloat("Low Clip (%)", lowClip, 0.0, 100.0, "%.1f%%")) {
            this.params.controls.lowClip = lowClip[0];
            window.lowClipValue = this.params.controls.lowClip / 100;
        }

        ImGui.Separator();

        // Resolution combo
        const resolutions = [
            { label: 'Very Fast (16px)', value: 16 },
            { label: 'Fast (8px)', value: 8 },
            { label: 'Medium (4px)', value: 4 },
            { label: 'Fine (2px)', value: 2 }
        ];

        const currentRes = resolutions.find(r => r.value === this.params.controls.resolution);
        if (ImGui.BeginCombo("Resolution", currentRes.label)) {
            for (const res of resolutions) {
                if (ImGui.Selectable(res.label, res.value === this.params.controls.resolution)) {
                    if (window.simulation) {
                        // Use the safe resolution change method
                        window.simulation = window.simManager.changeResolution(res.value);
                        this.params.controls.resolution = res.value;
                        window.simResolution = res.value;
                        this.saveParams();
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
            this.params.controls.visualizationMode = this.params.controls.visualizationMode === 'pressure' ? 'intensity' : 'pressure';
            window.visualizationMode = this.params.controls.visualizationMode;
        }

        ImGui.SameLine();
        if (ImGui.Button(this.params.controls.paused ? "Resume" : "Pause", new ImGui.Vec2(buttonWidth, 0))) {
            this.params.controls.paused = !this.params.controls.paused;
            window.paused = this.params.controls.paused;
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
            const timeScale = 1 / this.params.controls.frequency; // One period

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
        ImGui.Render();
        ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
    }
}

// Initialize GUI
const gui = new GUI();
gui.init().catch(console.error);

// Export for p5.js
window.renderGUI = () => gui.render(); 