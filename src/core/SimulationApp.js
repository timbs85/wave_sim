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
            updateRate: 120,
            simResolution: 2, // Fixed medium resolution
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
            // Force fixed physics update rate of 120Hz
            this.config.updateRate = 120;
            this.updateInterval = 1000 / this.config.updateRate;

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

        // Set up wall change notification
        this.physicsEngine.onWallsChanged = () => {
            if (this.renderer) {
                this.renderer.updateUI(this.physicsEngine);
            }
        };

        return this.physicsEngine;
    }

    /**
     * Initialize the renderer
     */
    initializeRenderer() {
        // Get the canvas element
        const container = document.getElementById('simulation-container');
        const canvas = document.createElement('canvas');

        // Full screen canvas
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        container.appendChild(canvas);

        // Create renderer with visualization settings
        this.renderer = new Renderer(canvas, {
            simResolution: 2, // Fixed medium resolution
            visualizationMode: this.config.visualizationMode,
            contrastValue: this.config.contrastValue,
            lowClipValue: this.config.lowClipValue,
            brightnessScale: 16 // Fixed brightness for medium resolution
        });

        // Initialize UI layer
        if (this.physicsEngine) {
            this.renderer.updateUI(this.physicsEngine);
        }

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
        // Handle window resize
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        // Cache innerWidth/innerHeight
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Set canvas size
        canvas.width = windowWidth;
        canvas.height = windowHeight;

        // Resize renderer
        if (this.renderer) {
            this.renderer.resize(windowWidth, windowHeight);
            // Update UI after resize
            if (this.physicsEngine) {
                this.renderer.updateUI(this.physicsEngine);
            }
        }

        // Redraw
        this.render();
    }

    /**
     * Toggle pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    /**
     * Pause the simulation
     */
    pause() {
        this.isPaused = true;
        return this.isPaused;
    }

    /**
     * Resume the simulation
     */
    resume() {
        this.isPaused = false;
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
     * Now resolution is fixed at medium quality
     */
    changeResolution(resolution) {
        return this.simulation;
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Dispose of components
        if (this.physicsEngine) {
            this.physicsEngine.dispose();
            this.physicsEngine = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }

        if (this.inputHandler) {
            this.inputHandler.dispose();
            this.inputHandler = null;
        }

        // Clear canvas
        const container = document.getElementById('simulation-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * Set the source frequency and maintain amplitude scaling
     */
    setFrequency(freq) {
        if (!this.physicsEngine) return;

        // Set the frequency in the physics engine
        this.physicsEngine.setFrequency(freq);
    }
}

// Export for browser use
window.SimulationApp = SimulationApp;