// GUI state
class GUI {
    constructor(simulationApp = null) {
        this.simulationApp = simulationApp;
        this.params = this.loadParams();

        // Sync params with simulationApp if available
        if (this.simulationApp) {
            // Sync visualization mode
            this.params.controls.visualizationMode = this.simulationApp.config.visualizationMode;

            // Sync paused state
            this.params.controls.paused = this.simulationApp.isPaused;

            // Sync renderer settings
            if (this.simulationApp.renderer) {
                const settings = this.simulationApp.renderer.getSettings();

                // Convert contrast value back to slider value [1-100]
                if (settings.contrastValue) {
                    const normalizedValue = Math.log2(settings.contrastValue) / 4;
                    this.params.controls.contrast = Math.round(normalizedValue * 99 + 1);
                }

                // Convert low clip value back to percentage [0-100]
                if (settings.lowClipValue !== undefined) {
                    this.params.controls.lowClip = Math.round(settings.lowClipValue * 100);
                }

                // Sync resolution
                if (settings.simResolution) {
                    this.params.controls.resolution = settings.simResolution;
                }
            }

            // Sync physics settings
            if (this.simulationApp.physicsEngine) {
                const physics = this.simulationApp.physicsEngine;

                // Sync frequency
                if (physics.source && physics.source.signal) {
                    this.params.controls.frequency = physics.source.signal.frequency;
                }

                // Sync air absorption
                if (physics.airAbsorption !== undefined && this.params.medium.maxAirAbsorption) {
                    this.params.controls.airAbsorption = Math.round(
                        (physics.airAbsorption / this.params.medium.maxAirAbsorption) * 100
                    );
                }

                // Sync wall absorption
                if (physics.wallAbsorption !== undefined) {
                    this.params.controls.wallAbsorption = Math.round(physics.wallAbsorption * 100);
                }
            }

            // Save the synced params
            this.saveParams();
        }

        this.initialized = false;
        this.imguiCanvas = null;

        // Initialize pressure history buffer for waveform display
        this.pressureHistory = new Array(200).fill(0);

        // Performance monitoring
        this.fpsHistory = new Array(60).fill(0);
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.physicsUpdatesPerSecond = this.simulationApp ?
            1000 / this.simulationApp.updateInterval : 60;
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

                    this.saveParams();
                    resolve(this.params);
                } catch (e) {
                    console.error('Error importing parameters:', e);
                    resolve(null);
                }
            };

            input.click();
        });
    }

    async init() {
        try {
            // Get the container
            const container = document.getElementById('controls-container');
            const imguiContainer = document.getElementById('imgui-container');
            imguiContainer.innerHTML = ''; // Clear any existing content

            // Create a new canvas
            this.imguiCanvas = document.createElement('canvas');
            this.imguiCanvas.width = container.clientWidth;
            this.imguiCanvas.height = container.clientHeight;

            // Style the canvas
            this.imguiCanvas.style.position = 'absolute';
            this.imguiCanvas.style.top = '0';
            this.imguiCanvas.style.left = '0';
            this.imguiCanvas.style.width = '100%';
            this.imguiCanvas.style.height = '100%';
            this.imguiCanvas.style.zIndex = '30';
            this.imguiCanvas.style.pointerEvents = 'auto';
            this.imguiCanvas.tabIndex = 1;

            // Add the canvas to the DOM
            imguiContainer.appendChild(this.imguiCanvas);

            // Focus the canvas
            this.imguiCanvas.focus();

            // Initialize ImGui
            await ImGui.default();

            // Create ImGui context
            ImGui.CreateContext();

            // Configure ImGui IO
            const io = ImGui.GetIO();
            io.IniFilename = "imgui.ini";
            io.ConfigFlags |= ImGui.ConfigFlags.NavEnableKeyboard;

            // Set up style
            ImGui.StyleColorsDark();
            const style = ImGui.GetStyle();
            style.WindowRounding = 0;
            style.WindowBorderSize = 0;
            style.FontGlobalScale = 1.2;

            // Initialize ImGui implementation
            ImGui_Impl.Init(this.imguiCanvas);

            // Add debug event listeners
            this.imguiCanvas.addEventListener('mousedown', (e) => {
                console.log('ImGui canvas mousedown event', e.clientX, e.clientY);
            });

            this.imguiCanvas.addEventListener('click', () => {
                console.log('ImGui canvas clicked');
                this.imguiCanvas.focus();
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                this.imguiCanvas.width = container.clientWidth;
                this.imguiCanvas.height = container.clientHeight;
            });

            // Initialize GUI state from simulation
            if (this.simulationApp) {
                // Use the SimulationApp instance for initialization
                this.simulationApp.setVisualizationMode(this.params.controls.visualizationMode);
                this.simulationApp.isPaused = this.params.controls.paused;

                // Update renderer settings
                this.simulationApp.renderer.updateSettings({
                    contrastValue: Math.pow(2, (this.params.controls.contrast - 1) / 99 * 4),
                    lowClipValue: this.params.controls.lowClip / 100,
                    simResolution: this.params.controls.resolution
                });
            } else {
                // Fallback to global variables for backward compatibility
                window.visualizationMode = this.params.controls.visualizationMode;
                window.paused = this.params.controls.paused;
                window.contrastValue = Math.pow(2, (this.params.controls.contrast - 1) / 99 * 4);
                window.lowClipValue = this.params.controls.lowClip / 100;
                window.simResolution = this.params.controls.resolution;
            }

            this.initialized = true;
        } catch (error) {
            console.error('Error initializing ImGui:', error);
            throw error;
        }
    }

    render() {
        if (!this.initialized) return;

        try {
            // Calculate FPS
            const now = performance.now();
            this.frameCount++;

            // Update FPS counter once per second
            if (now - this.lastFrameTime >= 1000) {
                const fps = Math.round(this.frameCount * 1000 / (now - this.lastFrameTime));
                this.fpsHistory.shift();
                this.fpsHistory.push(fps);
                this.frameCount = 0;
                this.lastFrameTime = now;
            }

            // Start a new ImGui frame
            ImGui_Impl.NewFrame();
            ImGui.NewFrame();

            const windowFlags = ImGui.WindowFlags.NoCollapse |
                ImGui.WindowFlags.NoMove |
                ImGui.WindowFlags.NoResize |
                ImGui.WindowFlags.NoTitleBar;

            // Main control panel
            ImGui.SetNextWindowPos(new ImGui.ImVec2(0, 0));
            ImGui.SetNextWindowSize(new ImGui.ImVec2(this.imguiCanvas.width, this.imguiCanvas.height));

            ImGui.Begin("Wave Simulation Controls", null, windowFlags);

            // Check if we have a valid simulation
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                this.renderControls();
            } else if (window.simManager && window.simulation) {
                // Fallback to global variables for backward compatibility
                this.renderControls();
            } else {
                ImGui.Text("Simulation is being reinitialized...");
            }

            ImGui.End();

            // Render the ImGui frame
            ImGui.Render();

            // Render ImGui draw data
            ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
        } catch (error) {
            console.error('Error rendering ImGui:', error);
        }
    }

    renderControls() {
        // Add a custom title since we removed the title bar
        ImGui.Text("Wave Simulation Controls");

        // Display performance metrics
        const avgFps = this.fpsHistory.filter(fps => fps > 0).length > 0 ?
            this.fpsHistory.filter(fps => fps > 0).reduce((sum, fps) => sum + fps, 0) /
            this.fpsHistory.filter(fps => fps > 0).length :
            0;
        ImGui.Text(`FPS: ${Math.round(avgFps)} | Physics Rate: ${this.physicsUpdatesPerSecond.toFixed(1)} Hz`);

        // Add import/export buttons
        const importExportButtonWidth = ImGui.GetContentRegionAvail().x / 2 - 5;
        if (ImGui.Button("Export Parameters", new ImGui.ImVec2(importExportButtonWidth, 0))) {
            this.exportParams();
        }
        ImGui.SameLine();
        if (ImGui.Button("Import Parameters", new ImGui.ImVec2(importExportButtonWidth, 0))) {
            this.importParams().then(async (params) => {
                if (params && this.simulationApp) {
                    // Use the SimulationApp to reinitialize the simulation
                    await this.simulationApp.changeResolution(this.params.controls.resolution);
                }
            });
        }

        ImGui.Separator();

        // Air absorption slider
        const airAbs = [this.params.controls.airAbsorption];
        if (ImGui.SliderFloat("Air Absorption (%)", airAbs, 0.0, 100.0, "%.1f%%")) {
            this.params.controls.airAbsorption = airAbs[0];

            if (this.simulationApp && this.simulationApp.physicsEngine) {
                this.simulationApp.physicsEngine.setAirAbsorption(
                    airAbs[0] / 100,
                    this.params.medium.maxAirAbsorption
                );
            } else if (window.simulation) {
                window.simulation.setAirAbsorption(
                    airAbs[0] / 100,
                    this.params.medium.maxAirAbsorption
                );
            }

            this.saveParams();
        }

        // Wall absorption slider
        const wallAbs = [this.params.controls.wallAbsorption];
        if (ImGui.SliderFloat("Wall Absorption (%)", wallAbs, 0.0, 100.0, "%.1f%%")) {
            this.params.controls.wallAbsorption = wallAbs[0];

            if (this.simulationApp && this.simulationApp.physicsEngine) {
                this.simulationApp.physicsEngine.setWallAbsorption(wallAbs[0] / 100);
            } else if (window.simulation) {
                window.simulation.setWallAbsorption(wallAbs[0] / 100);
            }

            this.saveParams();
        }

        // Frequency slider
        const freq = [this.params.controls.frequency];
        if (ImGui.SliderFloat("Frequency (Hz)", freq, 20.0, 500.0, "%.1f Hz")) {
            this.params.controls.frequency = freq[0];

            if (this.simulationApp) {
                // Use the updated method that no longer applies amplitude scaling
                this.simulationApp.setFrequency(freq[0]);
            } else if (window.simulation) {
                window.simulation.setFrequency(freq[0]);
            }

            this.saveParams();
        }

        // Brightness slider (new)
        const brightness = [this.params.controls.brightness || 100];
        if (ImGui.SliderFloat("Brightness", brightness, 1.0, 200.0, "%.1f%%")) {
            this.params.controls.brightness = brightness[0];
            // Map slider value [1,200] to brightness scale [0.01,2.0]
            const brightnessScale = brightness[0] / 100;

            if (this.simulationApp && this.simulationApp.renderer) {
                this.simulationApp.renderer.updateSettings({ brightnessScale });
            }

            this.saveParams();
        }

        // Contrast slider
        const contrast = [this.params.controls.contrast];
        if (ImGui.SliderFloat("Contrast", contrast, 1.0, 100.0, "%.1f")) {
            this.params.controls.contrast = contrast[0];
            // Map slider value [1,100] to contrast range [1.0, 15.0] with exponential curve
            const normalizedValue = (this.params.controls.contrast - 1) / 99;
            const contrastValue = Math.pow(2, normalizedValue * 4);

            if (this.simulationApp && this.simulationApp.renderer) {
                this.simulationApp.renderer.updateSettings({ contrastValue });
            } else {
                window.contrastValue = contrastValue;
            }
        }

        // Low clip slider
        const lowClip = [this.params.controls.lowClip];
        if (ImGui.SliderFloat("Low Clip (%)", lowClip, 0.0, 100.0, "%.1f%%")) {
            this.params.controls.lowClip = lowClip[0];
            const lowClipValue = this.params.controls.lowClip / 100;

            if (this.simulationApp && this.simulationApp.renderer) {
                this.simulationApp.renderer.updateSettings({ lowClipValue });
            } else {
                window.lowClipValue = lowClipValue;
            }
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
                    if (this.simulationApp) {
                        // Use the SimulationApp to change resolution
                        this.simulationApp.changeResolution(res.value).then(() => {
                            this.params.controls.resolution = res.value;
                            this.saveParams();
                        });
                    }
                }
            }
            ImGui.EndCombo();
        }

        ImGui.Separator();

        // Control buttons in a row
        const buttonWidth = ImGui.GetContentRegionAvail().x / 3 - 5;

        if (ImGui.Button("Trigger Impulse", new ImGui.ImVec2(buttonWidth, 0))) {
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                this.simulationApp.physicsEngine.triggerImpulse();
            } else if (window.simulation) {
                window.simulation.triggerImpulse();
            }
        }

        ImGui.SameLine();
        if (ImGui.Button("Toggle Visualization", new ImGui.ImVec2(buttonWidth, 0))) {
            this.params.controls.visualizationMode = this.params.controls.visualizationMode === 'pressure' ? 'intensity' : 'pressure';

            if (this.simulationApp && this.simulationApp.renderer) {
                this.simulationApp.setVisualizationMode(this.params.controls.visualizationMode);
            } else {
                window.visualizationMode = this.params.controls.visualizationMode;
            }
        }

        ImGui.SameLine();
        if (ImGui.Button(this.params.controls.paused ? "Resume" : "Pause", new ImGui.ImVec2(buttonWidth, 0))) {
            this.params.controls.paused = !this.params.controls.paused;

            if (this.simulationApp) {
                this.simulationApp.togglePause();
            } else {
                window.paused = this.params.controls.paused;
            }
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
            new ImGui.ImVec2(graphPos.x + graphWidth, graphPos.y + graphHeight),
            ImGui.COL32(30, 30, 30, 255)
        );

        // Draw grid lines
        const gridColor = ImGui.COL32(50, 50, 50, 255);
        const numVerticalLines = 10;
        for (let i = 1; i < numVerticalLines; i++) {
            const x = graphPos.x + (graphWidth * i) / numVerticalLines;
            drawList.AddLine(
                new ImGui.ImVec2(x, graphPos.y),
                new ImGui.ImVec2(x, graphPos.y + graphHeight),
                gridColor
            );
        }
        for (let i = 1; i < 4; i++) {
            const y = graphPos.y + (graphHeight * i) / 4;
            drawList.AddLine(
                new ImGui.ImVec2(graphPos.x, y),
                new ImGui.ImVec2(graphPos.x + graphWidth, y),
                gridColor
            );
        }

        // Update pressure history with current pressure at source
        if (!this.params.controls.paused) {
            let currentPressure = 0;

            // Get the current pressure at the source position
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                const source = this.simulationApp.physicsEngine.getSource();
                if (source) {
                    // Get pressure at source position
                    currentPressure = this.simulationApp.physicsEngine.getPressure(source.x, source.y);

                    // Update at a consistent rate based on physics update rate
                    // Calculate how many frames to skip to match physics rate
                    const physicsRate = this.physicsUpdatesPerSecond;
                    const renderRate = avgFps || 60;
                    const updateEveryNFrames = Math.max(1, Math.round(renderRate / physicsRate));

                    if (this.frameCount % updateEveryNFrames === 0) {
                        this.pressureHistory.shift();
                        this.pressureHistory.push(currentPressure);
                    }
                }
            } else if (window.simulation && window.simulation.source) {
                const source = window.simulation.source;
                currentPressure = window.simulation.getPressure(source.x, source.y);

                // Legacy update method
                this.pressureHistory.shift();
                this.pressureHistory.push(currentPressure);
            }
        }

        // Draw zero line
        drawList.AddLine(
            new ImGui.ImVec2(graphPos.x, graphPos.y + graphHeight * 0.5),
            new ImGui.ImVec2(graphPos.x + graphWidth, graphPos.y + graphHeight * 0.5),
            ImGui.COL32(100, 100, 100, 255)
        );

        // Draw the waveform from pressure history
        const points = [];
        const numPoints = this.pressureHistory.length;
        // Pressure typically ranges from -1 to 1
        const maxPressure = 1.0;

        for (let i = 0; i < numPoints; i++) {
            const x = graphPos.x + (i / numPoints) * graphWidth;
            // Normalize pressure value to [-0.45, 0.45] range for display
            const normalizedValue = Math.max(-0.45, Math.min(0.45, this.pressureHistory[i] / maxPressure));
            const y = graphPos.y + (0.5 - normalizedValue) * graphHeight;
            points.push(new ImGui.ImVec2(x, y));
        }

        // Draw the waveform
        for (let i = 0; i < points.length - 1; i++) {
            drawList.AddLine(
                points[i],
                points[i + 1],
                ImGui.COL32(255, 255, 0, 255),
                1.5
            );
        }

        ImGui.Dummy(new ImGui.ImVec2(0, graphHeight + 10)); // Add space after the graph
    }
}

// Export for browser use
window.GUI = GUI;