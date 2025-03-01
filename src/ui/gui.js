// GUI implementation using Tweakpane
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

        // Performance monitoring
        this.fpsHistory = new Array(60).fill(0);
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.physicsUpdatesPerSecond = this.simulationApp ?
            1000 / this.simulationApp.updateInterval : 60;

        // Store reference to pane and containers
        this.pane = null;
        this.performanceMonitor = null;
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
            };
        } catch (e) {
            console.error('Error loading params:', e);
            return window.params;
        }
    }

    saveParams() {
        try {
            localStorage.setItem('wave-sim-params', JSON.stringify(this.params));
        } catch (e) {
            console.error('Error saving params:', e);
        }
    }

    async init() {
        // Create main Tweakpane instance
        this.pane = new Tweakpane.Pane({
            container: document.getElementById('pane-container'),
            title: 'Sound Wave Simulation'
        });

        // Add sections for controls
        this.setupControls();
        this.setupPerformanceMonitor();
        this.setupNotes();

        // Update the GUI to match current settings
        this.updateDisplay();

        return true;
    }

    setupControls() {
        // Simulation Control Folder
        const simFolder = this.pane.addFolder({ title: 'Simulation Controls' });

        // Visualization mode dropdown
        simFolder.addInput(this.params.controls, 'visualizationMode', {
            options: {
                Pressure: 'pressure',
                Intensity: 'intensity'
            }
        }).on('change', (ev) => {
            if (this.simulationApp && this.simulationApp.renderer) {
                this.simulationApp.renderer.setVisualizationMode(ev.value);
                this.saveParams();
            }
        });

        // Resolution slider
        simFolder.addInput(this.params.controls, 'resolution', {
            min: 1,
            max: 16,
            step: 1
        }).on('change', (ev) => {
            if (this.simulationApp) {
                this.simulationApp.setResolution(ev.value);
                this.saveParams();
            }
        });

        // Pause button
        simFolder.addInput(this.params.controls, 'paused', {
            label: 'Pause Simulation'
        }).on('change', (ev) => {
            if (this.simulationApp) {
                if (ev.value) {
                    this.simulationApp.pause();
                } else {
                    this.simulationApp.resume();
                }
                this.saveParams();
            }
        });

        // Visualization Folder
        const visFolder = this.pane.addFolder({ title: 'Visualization' });

        // Contrast slider
        visFolder.addInput(this.params.controls, 'contrast', {
            min: 1,
            max: 100,
            step: 1
        }).on('change', (ev) => {
            if (this.simulationApp && this.simulationApp.renderer) {
                // Convert slider value [1-100] to exponential contrast value [1-2^4]
                const normalizedValue = (ev.value - 1) / 99;
                const contrastValue = Math.pow(2, normalizedValue * 4);
                this.simulationApp.renderer.setContrastValue(contrastValue);
                this.saveParams();
            }
        });

        // Low clip slider
        visFolder.addInput(this.params.controls, 'lowClip', {
            min: 0,
            max: 100,
            step: 1
        }).on('change', (ev) => {
            if (this.simulationApp && this.simulationApp.renderer) {
                // Convert percentage [0-100] to [0-1]
                const clipValue = ev.value / 100;
                this.simulationApp.renderer.setLowClipValue(clipValue);
                this.saveParams();
            }
        });

        // Physics Folder
        const physicsFolder = this.pane.addFolder({ title: 'Physics' });

        // Frequency slider
        physicsFolder.addInput(this.params.controls, 'frequency', {
            min: 20,
            max: 1000,
            step: 1
        }).on('change', (ev) => {
            if (this.simulationApp && this.simulationApp.physicsEngine &&
                this.simulationApp.physicsEngine.source) {
                this.simulationApp.physicsEngine.source.setFrequency(ev.value);
                this.saveParams();
            }
        });

        // Air absorption slider
        physicsFolder.addInput(this.params.controls, 'airAbsorption', {
            min: 0,
            max: 100,
            step: 1
        }).on('change', (ev) => {
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                // Convert percentage to actual value
                const absValue = (ev.value / 100) * this.params.medium.maxAirAbsorption;
                this.simulationApp.physicsEngine.setAirAbsorption(absValue);
                this.saveParams();
            }
        });

        // Wall absorption slider
        physicsFolder.addInput(this.params.controls, 'wallAbsorption', {
            min: 0,
            max: 100,
            step: 1
        }).on('change', (ev) => {
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                // Convert percentage to [0-1]
                const absValue = ev.value / 100;
                this.simulationApp.physicsEngine.setWallAbsorption(absValue);
                this.saveParams();
            }
        });

        // Add Reset button
        this.pane.addButton({ title: 'Reset to Defaults' }).on('click', () => {
            if (this.simulationApp) {
                this.resetToDefaults();
            }
        });
    }

    setupPerformanceMonitor() {
        // Create a folder for performance monitoring
        const perfFolder = this.pane.addFolder({
            title: 'Performance Monitor',
            expanded: false
        });

        // Create objects to monitor
        this.performanceStats = {
            fps: '0 FPS',
            physics: '0 updates/s',
            cells: '0 cells'
        };

        // Add performance monitors with empty values
        this.performanceMonitor = {
            fps: perfFolder.addMonitor(this.performanceStats, 'fps', {
                label: 'Render FPS'
            }),
            physics: perfFolder.addMonitor(this.performanceStats, 'physics', {
                label: 'Physics Updates'
            }),
            cells: perfFolder.addMonitor(this.performanceStats, 'cells', {
                label: 'Grid Cells'
            })
        };
    }

    setupNotes() {
        // Create a folder for notes/help
        const notesFolder = this.pane.addFolder({
            title: 'Help & Information',
            expanded: false
        });

        // Create info objects
        const infoControls = { text: 'Left click to move source' };
        const infoNotes = { text: 'Grid resolution affects performance' };

        // Add explanation text
        notesFolder.addMonitor(infoControls, 'text', {
            label: 'Controls'
        });

        notesFolder.addMonitor(infoNotes, 'text', {
            label: 'Notes'
        });
    }

    updateDisplay() {
        // Update performance monitor if available
        if (this.performanceMonitor && this.performanceStats) {
            // Calculate average FPS
            const currentTime = performance.now();
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;

            this.fpsHistory.shift();
            this.fpsHistory.push(1000 / deltaTime);

            const avgFps = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;

            // Update FPS counter
            this.performanceStats.fps = `${Math.round(avgFps)} FPS`;

            // Update physics updates counter
            this.performanceStats.physics = `${Math.round(this.physicsUpdatesPerSecond)} updates/s`;

            // Update cell count if simulation is available
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                const cellCount = this.simulationApp.physicsEngine.grid ?
                    this.simulationApp.physicsEngine.grid.width * this.simulationApp.physicsEngine.grid.height : 0;
                this.performanceStats.cells = `${cellCount.toLocaleString()} cells`;
            }
        }

        // Refresh the pane to update displayed values
        if (this.pane) {
            this.pane.refresh();
        }
    }

    resetToDefaults() {
        // Reset to default values from window.params
        this.params.controls = { ...window.params.controls };

        // Apply to UI and simulation
        if (this.simulationApp) {
            // Update visualization mode
            if (this.simulationApp.renderer) {
                this.simulationApp.renderer.setVisualizationMode(this.params.controls.visualizationMode);

                // Convert contrast value
                const normalizedValue = (this.params.controls.contrast - 1) / 99;
                const contrastValue = Math.pow(2, normalizedValue * 4);
                this.simulationApp.renderer.setContrastValue(contrastValue);

                // Convert low clip value
                this.simulationApp.renderer.setLowClipValue(this.params.controls.lowClip / 100);

                // Set resolution
                this.simulationApp.setResolution(this.params.controls.resolution);
            }

            // Update physics settings
            if (this.simulationApp.physicsEngine) {
                if (this.simulationApp.physicsEngine.source) {
                    this.simulationApp.physicsEngine.source.setFrequency(this.params.controls.frequency);
                }

                // Apply air absorption
                const airAbsValue = (this.params.controls.airAbsorption / 100) * this.params.medium.maxAirAbsorption;
                this.simulationApp.physicsEngine.setAirAbsorption(airAbsValue);

                // Apply wall absorption
                this.simulationApp.physicsEngine.setWallAbsorption(this.params.controls.wallAbsorption / 100);
            }

            // Set pause state
            if (this.params.controls.paused) {
                this.simulationApp.pause();
            } else {
                this.simulationApp.resume();
            }
        }

        // Update the pane to reflect new values
        if (this.pane) {
            this.pane.refresh();
        }

        // Save default params
        this.saveParams();
    }

    render() {
        // Update performance stats
        this.frameCount++;
        if (this.frameCount % 10 === 0) {
            this.updateDisplay();
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.pane) {
            this.pane.dispose();
            this.pane = null;
        }
        this.performanceMonitor = null;
    }
}

// Export for browser use
window.GUI = GUI;