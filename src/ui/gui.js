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

                // Resolution is fixed at medium quality
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
        // Create main Tweakpane instance directly in the GUI container
        this.pane = new Tweakpane.Pane({
            container: document.getElementById('gui-container'),
            title: 'Sound Wave Simulation' // Use title directly in the pane
        });

        // Add sections for controls
        this.setupControls();
        this.setupPerformanceMonitor();

        // Set up draggable GUI (but without collapsible functionality)
        this.setupDraggableGUI();

        // Update the GUI to match current settings
        this.updateDisplay();

        return true;
    }

    setupControls() {
        // Helper function to create inputs with common patterns
        const createControlInput = (paramKey, options, callback) => {
            return this.pane.addInput(this.params.controls, paramKey, options)
                .on('change', (ev) => {
                    if (callback && this.simulationApp) {
                        callback(ev.value);
                        this.saveParams();
                    }
                });
        };

        // Visualization mode dropdown
        createControlInput('visualizationMode', {
            options: {
                Pressure: 'pressure',
                Intensity: 'intensity'
            }
        }, (value) => {
            if (this.simulationApp.renderer) {
                this.simulationApp.renderer.setVisualizationMode(value);
            }
        });

        // Pause button
        createControlInput('paused', {
            label: 'Pause Simulation'
        }, (value) => {
            if (value) {
                this.simulationApp.pause();
            } else {
                this.simulationApp.resume();
            }
        });

        // Contrast slider
        createControlInput('contrast', {
            min: 1,
            max: 100,
            step: 1
        }, (value) => {
            if (this.simulationApp.renderer) {
                // Convert slider value [1-100] to exponential contrast value [1-2^4]
                const normalizedValue = (value - 1) / 99;
                const contrastValue = Math.pow(2, normalizedValue * 4);
                this.simulationApp.renderer.setContrastValue(contrastValue);
            }
        });

        // Low clip slider
        createControlInput('lowClip', {
            min: 0,
            max: 100,
            step: 1
        }, (value) => {
            if (this.simulationApp.renderer) {
                // Convert percentage [0-100] to [0-1]
                const clipValue = value / 100;
                this.simulationApp.renderer.setLowClipValue(clipValue);
            }
        });

        // Frequency slider
        createControlInput('frequency', {
            min: 20,
            max: 1000,
            step: 1
        }, (value) => {
            if (this.simulationApp.physicsEngine &&
                this.simulationApp.physicsEngine.source) {
                this.simulationApp.physicsEngine.source.setFrequency(value);
            }
        });

        // Air absorption slider
        createControlInput('airAbsorption', {
            min: 0,
            max: 100,
            step: 1
        }, (value) => {
            if (this.simulationApp.physicsEngine) {
                // Convert percentage to actual value
                const absValue = (value / 100) * this.params.medium.maxAirAbsorption;
                this.simulationApp.physicsEngine.setAirAbsorption(absValue);
            }
        });

        // Wall absorption slider
        createControlInput('wallAbsorption', {
            min: 0,
            max: 100,
            step: 1
        }, (value) => {
            if (this.simulationApp.physicsEngine) {
                // Convert percentage to [0-1]
                const absValue = value / 100;
                this.simulationApp.physicsEngine.setWallAbsorption(absValue);
            }
        });

        // Add Trigger Impulse button
        this.pane.addButton({ title: 'Trigger Impulse' }).on('click', () => {
            if (this.simulationApp && this.simulationApp.physicsEngine) {
                this.simulationApp.physicsEngine.triggerImpulse();
            }
        });
    }

    setupPerformanceMonitor() {
        // Create objects to monitor
        this.performanceStats = {
            fps: '0 FPS',
            physics: '0 updates/s',
            cells: '0 cells'
        };

        // Add performance monitors with empty values
        this.performanceMonitor = {
            fps: this.pane.addMonitor(this.performanceStats, 'fps', {
                label: 'Render FPS'
            }),
            physics: this.pane.addMonitor(this.performanceStats, 'physics', {
                label: 'Physics Updates'
            }),
            cells: this.pane.addMonitor(this.performanceStats, 'cells', {
                label: 'Grid Cells'
            })
        };
    }

    updateDisplay() {
        // Update performance monitor if available
        if (this.performanceMonitor && this.performanceStats) {
            // Calculate average FPS from history
            const avgFps = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;

            // Update FPS counter
            this.performanceStats.fps = `${Math.round(avgFps)} FPS`;

            // Update physics updates counter - use exact configured value
            if (this.simulationApp) {
                // Display the exact configured rate
                this.performanceStats.physics = `${this.simulationApp.config.updateRate} updates/s`;
            } else {
                this.performanceStats.physics = `60 updates/s`;
            }

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

    render() {
        // Update performance stats
        this.frameCount++;

        // Calculate current FPS on every frame for accuracy
        const currentTime = performance.now();
        const frameDelta = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Add current frame rate to history
        this.fpsHistory.shift();
        this.fpsHistory.push(1000 / frameDelta);

        // Only update the display every 10 frames to avoid UI thrashing
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

    /**
     * Set up draggable GUI functionality
     */
    setupDraggableGUI() {
        const guiContainer = document.getElementById('gui-container');
        if (!guiContainer) return;

        // Load saved position
        try {
            const savedPosition = localStorage.getItem('wave-sim-gui-position');
            if (savedPosition) {
                const position = JSON.parse(savedPosition);
                guiContainer.style.top = `${position.top}px`;
                guiContainer.style.right = `${position.right}px`;
            }
        } catch (e) {
            console.error('Error loading GUI state:', e);
        }

        // Simple drag implementation with right-based positioning
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, startRight, startTop;

        // Make the whole container draggable by the Tweakpane title bar
        guiContainer.addEventListener('mousedown', (e) => {
            // Only start dragging if we're clicking on the title bar element
            if (!e.target.closest('.tp-rotv_t')) return;

            const rect = guiContainer.getBoundingClientRect();
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;

            // Calculate right position once
            const windowWidth = window.innerWidth;
            startRight = windowWidth - rect.right;
            startTop = rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            // Calculate movement deltas
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            // Only consider it a move if it's moved more than 3 pixels in any direction
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                hasMoved = true;
            }

            // Update position - maintain right anchor
            const newRight = Math.max(10, startRight - deltaX);
            const newTop = Math.max(10, startTop + deltaY);

            guiContainer.style.right = `${newRight}px`;
            guiContainer.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', (e) => {
            if (!isDragging) return;

            isDragging = false;
            const rect = guiContainer.getBoundingClientRect();
            localStorage.setItem('wave-sim-gui-position', JSON.stringify({
                top: rect.top,
                right: window.innerWidth - rect.right
            }));
        });
    }
}

// Export for browser use
window.GUI = GUI;