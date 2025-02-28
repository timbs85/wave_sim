class SimulationManager {
    constructor(params) {
        this.simulation = null;
        this.isRunning = false;
        this.updateInterval = 1000 / 60; // 60Hz default
        this.intervalId = null;
        this.params = params;  // Store params for recreation
    }

    async initialize(params) {
        // Stop any existing simulation
        this.stop();

        // Dispose of existing simulation if any
        if (this.simulation) {
            this.simulation.dispose();
        }

        // Create new simulation
        this.simulation = new WaveSimulation(params);

        // Wait for the simulation to initialize
        await this.simulation.initialize(params.controls.frequency);

        // Set initial source position
        const sourceX = Math.floor(this.simulation.cols * params.source.defaultX);
        const sourceY = Math.floor(this.simulation.rows * params.source.defaultY);
        this.simulation.setSource(sourceX, sourceY);

        // Start simulation loop
        this.start();

        return this.simulation;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.intervalId = setInterval(() => {
                if (!window.paused && this.simulation && !this.simulation.pressureField?.disposed) {
                    this.simulation.update();
                }
            }, this.updateInterval);
        }
    }

    stop() {
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.isRunning = false;
            this.intervalId = null;
        }
    }

    setUpdateRate(hz) {
        this.updateInterval = 1000 / hz;
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }

    dispose() {
        this.stop();
        if (this.simulation) {
            this.simulation.dispose();
            this.simulation = null;
        }
    }

    // Method to safely change resolution
    async changeResolution(newResolution) {
        // Stop the simulation loop
        this.stop();

        // Store current source position
        const oldSimulation = this.simulation;
        const sourceNormalizedX = oldSimulation.source.x / oldSimulation.cols;
        const sourceNormalizedY = oldSimulation.source.y / oldSimulation.rows;

        // Update params with new resolution
        this.params.controls.resolution = newResolution;

        // Dispose old simulation
        oldSimulation.dispose();

        // Create new simulation
        this.simulation = new WaveSimulation(this.params);

        // Wait for the simulation to initialize
        await this.simulation.initialize(this.params.controls.frequency);

        // Calculate new source position based on normalized coordinates
        const newSourceX = Math.floor(sourceNormalizedX * this.simulation.cols);
        const newSourceY = Math.floor(sourceNormalizedY * this.simulation.rows);

        // Set source position
        this.simulation.setSource(newSourceX, newSourceY);

        // Restart the simulation loop
        this.start();

        return this.simulation;
    }

    // Proxy methods to simulation for compatibility
    getPressure(x, y) {
        return this.simulation?.getPressure(x, y) ?? 0;
    }

    getVelocity(x, y) {
        return this.simulation?.getVelocity(x, y) ?? 0;
    }

    setSource(x, y) {
        return this.simulation?.setSource(x, y) ?? false;
    }

    triggerImpulse() {
        this.simulation?.triggerImpulse();
    }

    setFrequency(freq) {
        this.simulation?.setFrequency(freq);
    }

    setAirAbsorption(value, maxAirAbsorption) {
        this.simulation?.setAirAbsorption(value, maxAirAbsorption);
    }

    setWallAbsorption(value) {
        this.simulation?.setWallAbsorption(value);
    }

    // Proxy getters for compatibility
    get pressureField() {
        return this.simulation?.pressureField;
    }

    get geometry() {
        return this.simulation?.geometry;
    }

    get source() {
        return this.simulation?.source;
    }

    get cols() {
        return this.simulation?.cols ?? 0;
    }

    get rows() {
        return this.simulation?.rows ?? 0;
    }

    get width() {
        return this.simulation?.width ?? 0;
    }

    get height() {
        return this.simulation?.height ?? 0;
    }
}

// Export for both module and global use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SimulationManager };
}

if (typeof window !== 'undefined') {
    window.SimulationManager = SimulationManager;
}