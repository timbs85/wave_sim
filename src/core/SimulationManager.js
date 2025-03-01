class SimulationManager {
    constructor(params) {
        this.simulation = null;
        this.isRunning = false;
        this.updateInterval = 1000 / 60; // 60Hz default
        this.intervalId = null;
        this.params = params;  // Store params for recreation

        // Create proxy methods dynamically
        this.setupProxyMethods();
    }

    // Set up proxy methods for simulation
    setupProxyMethods() {
        // Methods to proxy through to the simulation
        const methodsToProxy = [
            'getPressure', 'getVelocity', 'setSource',
            'triggerImpulse', 'setFrequency',
            'setAirAbsorption', 'setWallAbsorption'
        ];

        // Create proxy methods
        methodsToProxy.forEach(method => {
            this[method] = (...args) => {
                return this.simulation?.[method]?.(...args);
            };
        });

        // Define getters using Object.defineProperties
        Object.defineProperties(this, {
            pressureField: { get: () => this.simulation?.pressureField },
            geometry: { get: () => this.simulation?.geometry },
            source: { get: () => this.simulation?.source },
            cols: { get: () => this.simulation?.cols ?? 0 },
            rows: { get: () => this.simulation?.rows ?? 0 },
            width: { get: () => this.simulation?.width ?? 0 },
            height: { get: () => this.simulation?.height ?? 0 }
        });
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

    // Method to safely change resolution - now resolution is fixed
    changeResolution(resolution) {
        return this.simulation;
    }
}

// Export for browser use
window.SimulationManager = SimulationManager;