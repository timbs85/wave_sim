/**
 * SimulationApp
 *
 * Main application controller that coordinates the physics engine, renderer, and input handler.
 * Handles initialization, animation loop, and cleanup.
 */
class SimulationApp {
    constructor(config = {}) {
        // Store configuration
        this.config = Object.assign({
            updateRate: 60,
            simResolution: 8,
            visualizationMode: 'pressure',
            contrastValue: 1.0,
            lowClipValue: 0.0
        }, config);

        // Component references
        this.physicsEngine = null;
        this.renderer = null;
        this.inputHandler = null;
        this.gui = null;

        // Animation state
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        this.lastRenderTime = 0;
        this.updateInterval = 1000 / this.config.updateRate;
        this.physicsAccumulator = 0;
        this.isPaused = false;

        // Initialization state
        this.isInitialized = false;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Initialize physics engine
            await this.initializePhysicsEngine();

            // Initialize renderer
            this.initializeRenderer();

            // Initialize input handler
            this.inputHandler = new InputHandler(this);

            // Initialize GUI if available
            if (window.GUI) {
                this.gui = new GUI(this);
                await this.gui.init();

                // Export render function for compatibility
                window.renderGUI = () => {
                    if (this.gui) this.gui.render();
                };
            }

            // Start animation loop
            this.startAnimationLoop();

            // Set initialization flag
            this.isInitialized = true;

            console.log('Application initialization complete');
            return true;
        } catch (error) {
            console.error('Failed to initialize application:', error);
            return false;
        }
    }

    /**
     * Initialize the physics engine
     */
    async initializePhysicsEngine() {
        // Create physics engine with parameters
        this.physicsEngine = new PhysicsEngine(window.params);

        // Initialize the physics engine
        await this.physicsEngine.initialize(window.params.controls.frequency);

        // Calculate brightness scale for renderer based on resolution
        this.updateBrightnessScale(this.config.simResolution);

        return this.physicsEngine;
    }

    /**
     * Update brightness scale for renderer based on resolution
     * This only affects the visual display, not the simulation
     */
    updateBrightnessScale(resolution) {
        if (!this.renderer) return;

        // Calculate brightness scaling factor based on resolution
        const baseResolution = 8;
        const resolutionRatio = baseResolution / resolution;
        const brightnessScale = resolutionRatio * resolutionRatio;

        // Apply the scaling factor to the renderer
        this.renderer.updateSettings({ brightnessScale });

        console.log(`Applied brightness scaling: ${brightnessScale.toFixed(2)}x for resolution ${resolution}px`);
    }

    /**
     * Apply amplitude scaling based on resolution
     * This only affects the simulation, not the GUI display
     */
    applyAmplitudeScaling(resolution) {
        // This method is kept for backward compatibility but does nothing now
        console.log(`Amplitude scaling removed: simulation now uses consistent amplitude regardless of resolution`);
    }

    /**
     * Initialize the renderer
     */
    initializeRenderer() {
        // Get the canvas element
        const container = document.getElementById('simulation-container');
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        container.appendChild(canvas);

        // Create renderer with visualization settings
        this.renderer = new Renderer(canvas, {
            simResolution: this.config.simResolution,
            visualizationMode: this.config.visualizationMode,
            contrastValue: this.config.contrastValue,
            lowClipValue: this.config.lowClipValue,
            brightnessScale: 1.0 // Default brightness scale
        });

        // Update brightness scale based on resolution
        this.updateBrightnessScale(this.config.simResolution);

        return this.renderer;
    }

    /**
     * Start the animation loop
     */
    startAnimationLoop() {
        if (this.animationFrameId) return;

        // Initialize timing variables
        this.lastUpdateTime = performance.now();
        this.lastRenderTime = this.lastUpdateTime;
        this.physicsAccumulator = 0;

        const animate = (timestamp) => {
            this.animationFrameId = requestAnimationFrame(animate);

            // Calculate delta time since last frame
            const currentTime = performance.now();
            const deltaTime = currentTime - this.lastUpdateTime;
            this.lastUpdateTime = currentTime;

            // Update physics with fixed timestep
            this.updatePhysics(deltaTime);

            // Render with delta time
            const renderDeltaTime = currentTime - this.lastRenderTime;
            this.lastRenderTime = currentTime;
            this.render(renderDeltaTime);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Update the physics simulation with fixed timestep
     */
    updatePhysics(deltaTime) {
        if (!this.physicsEngine || this.isPaused) return;

        // Add time to the accumulator
        this.physicsAccumulator += deltaTime;

        // Share accumulator with physics engine for interpolation
        if (this.physicsEngine) {
            this.physicsEngine.simulationApp = this;
        }

        // Update physics in fixed timesteps
        while (this.physicsAccumulator >= this.updateInterval) {
            this.physicsEngine.update();
            this.physicsAccumulator -= this.updateInterval;
        }
    }

    /**
     * Update the simulation state (legacy method, redirects to updatePhysics)
     */
    update(timestamp) {
        // Calculate time delta
        const elapsed = timestamp - this.lastUpdateTime;
        this.updatePhysics(elapsed);
    }

    /**
     * Render the current state
     */
    render(deltaTime) {
        if (!this.renderer || !this.physicsEngine) return;

        // Render the simulation with delta time
        this.renderer.render(this.physicsEngine, deltaTime);

        // Render GUI if available
        if (this.gui && typeof this.gui.render === 'function') {
            this.gui.render();
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (!this.renderer) return;

        const container = document.getElementById('simulation-container');
        this.renderer.resize(container.clientWidth, container.clientHeight);
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    /**
     * Reset the simulation
     */
    async resetSimulation() {
        if (!this.physicsEngine) return;

        await this.physicsEngine.triggerImpulse();
    }

    /**
     * Set visualization mode
     */
    setVisualizationMode(mode) {
        if (!this.renderer) return;

        this.renderer.updateSettings({ visualizationMode: mode });
        this.config.visualizationMode = mode;
    }

    /**
     * Change simulation resolution
     */
    async changeResolution(resolution) {
        // Store current source position
        const oldPhysicsEngine = this.physicsEngine;
        const sourceNormalizedX = oldPhysicsEngine.source.x / oldPhysicsEngine.cols;
        const sourceNormalizedY = oldPhysicsEngine.source.y / oldPhysicsEngine.rows;

        // Update configuration
        this.config.simResolution = resolution;
        window.params.controls.resolution = resolution;

        // Dispose old physics engine
        oldPhysicsEngine.dispose();

        // Create new physics engine
        this.physicsEngine = new PhysicsEngine(window.params);

        // Initialize the new physics engine
        await this.physicsEngine.initialize(window.params.controls.frequency);

        // Calculate new source position based on normalized coordinates
        const newSourceX = Math.floor(sourceNormalizedX * this.physicsEngine.cols);
        const newSourceY = Math.floor(sourceNormalizedY * this.physicsEngine.rows);

        // Set source position
        this.physicsEngine.setSource(newSourceX, newSourceY);

        // Update renderer resolution
        this.renderer.updateSettings({ simResolution: resolution });

        // Update brightness scale for the new resolution
        this.updateBrightnessScale(resolution);

        return this.physicsEngine;
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Stop animation loop
        this.stopAnimationLoop();

        // Dispose input handler
        if (this.inputHandler) {
            this.inputHandler.dispose();
            this.inputHandler = null;
        }

        // Dispose physics engine
        if (this.physicsEngine) {
            this.physicsEngine.dispose();
            this.physicsEngine = null;
        }

        // Dispose GUI if available
        if (this.gui && typeof this.gui.dispose === 'function') {
            this.gui.dispose();
            this.gui = null;
        }

        console.log('Application disposed');
    }

    /**
     * Set the source frequency and maintain amplitude scaling
     */
    setFrequency(freq) {
        if (!this.physicsEngine) return;

        // Set the frequency in the physics engine
        this.physicsEngine.setFrequency(freq);
    }

    /**
     * Stop the animation loop
     */
    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log('Animation loop stopped');
        }
    }
}

// Export for browser use
window.SimulationApp = SimulationApp;