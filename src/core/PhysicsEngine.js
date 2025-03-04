/**
 * PhysicsEngine
 *
 * Handles the physics simulation of wave propagation.
 * This class is completely independent of rendering concerns.
 */
class PhysicsEngine {
    constructor(params) {
        // Grid dimensions
        this.width = params.room.width;
        this.height = params.room.height;
        this.cellSize = params.controls.resolution;
        this.cols = Math.floor(this.width / this.cellSize);
        this.rows = Math.floor(this.height / this.cellSize);

        // Store physics parameters
        this.c = params.physics.speedOfSound;
        this.rho = params.physics.density;

        // Calculate derived values
        this.dx = params.room.physicalWidth / this.cols;
        this.dt = this.dx / (this.c * Math.sqrt(2));

        // Initialize components
        this.geometry = new RoomGeometry(
            this.cols,
            this.rows,
            params.room
        );

        this.pressureField = new PressureField(
            this.cols,
            this.rows,
            params.physics.minPressureThreshold
        );

        this.source = new WaveSource({
            cols: this.cols,
            rows: this.rows,
            dx: this.dx,
            frequency: params.source.defaultFrequency,
            amplitude: params.source.defaultAmplitude,
            x: Math.floor(this.cols * params.source.defaultX),
            y: Math.floor(this.rows * params.source.defaultY)
        });

        // Medium properties
        this.wallAbsorption = params.controls.wallAbsorption / 100;
        this.airAbsorption = (params.controls.airAbsorption / 100) * params.medium.maxAirAbsorption;

        this.isInitialized = false;
        this.isDisposed = false;

        // Set up wall change notification
        this.onWallsChanged = null;
        this.geometry.onWallsChanged = () => {
            if (this.onWallsChanged) {
                this.onWallsChanged();
            }
        };
    }

    /**
     * Initialize the physics engine
     */
    async initialize(frequency) {
        // Set initial parameters
        this.source.setFrequency(frequency);

        // Reset pressure field
        this.pressureField.reset();

        // Mark as initialized
        this.isInitialized = true;

        // Trigger the source
        this.source.trigger();

        return Promise.resolve();
    }

    /**
     * Update the simulation state by one time step
     */
    update() {
        if (this.isDisposed || !this.isInitialized) return;

        // Update pressure and velocity fields
        this.pressureField.updatePressure(
            this.geometry.getWalls(),
            this.dt,
            this.dx,
            this.c,
            this.rho,
            this.wallAbsorption,
            this.airAbsorption
        );

        // Update source
        if (this.source.isActive) {
            this.source.updateSource(this.pressureField, this.dt);
        }
    }

    /**
     * Set the source position
     */
    setSource(gridX, gridY) {
        return this.source.setPosition(gridX, gridY, this.geometry.getWalls());
    }

    /**
     * Set the source frequency
     */
    setFrequency(freq) {
        this.source.setFrequency(freq);
        if (this.isInitialized) {
            this.triggerImpulse();
        }
    }

    /**
     * Set air absorption coefficient
     */
    setAirAbsorption(value, maxAirAbsorption) {
        this.airAbsorption = value * maxAirAbsorption;
    }

    /**
     * Set wall absorption coefficient
     */
    setWallAbsorption(value) {
        this.wallAbsorption = value;
    }

    /**
     * Trigger an impulse at the source
     */
    async triggerImpulse() {
        // Reset pressure field
        this.pressureField.reset();

        // Trigger the source
        this.source.trigger();

        return Promise.resolve();
    }

    /**
     * Get pressure at a specific grid position
     */
    getPressure(x, y) {
        return this.pressureField.getPressure(x, y);
    }

    /**
     * Get velocity at a specific grid position
     */
    getVelocity(x, y) {
        return this.pressureField.getVelocity(x, y);
    }

    /**
     * Get the entire pressure field data
     */
    getPressureField() {
        return this.pressureField;
    }

    /**
     * Get the room geometry
     */
    getGeometry() {
        return this.geometry;
    }

    /**
     * Get the wave source
     */
    getSource() {
        return this.source;
    }

    /**
     * Get the walls array
     */
    getWalls() {
        return this.geometry.getWalls();
    }

    /**
     * Update source warning
     */
    updateWarning() {
        this.source.updateWarning(this.dt);
    }

    /**
     * Get warning message
     */
    get warningMessage() {
        return this.source.warningMessage;
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.pressureField) {
            this.pressureField.dispose();
        }
        this.isDisposed = true;
    }
}

// Export for browser use
window.PhysicsEngine = PhysicsEngine;