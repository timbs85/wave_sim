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

        // Create array for multiple sources
        this.sources = [];

        // Add initial source
        this.addSource({
            cols: this.cols,
            rows: this.rows,
            dx: this.dx,
            frequency: params.source.defaultFrequency,
            amplitude: params.source.defaultAmplitude,
            x: Math.floor(this.cols * params.source.defaultX),
            y: Math.floor(this.rows * params.source.defaultY)
        });

        // Keep a reference to current source for backward compatibility
        this.source = this.sources[0];

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

        // Update all sources
        for (const source of this.sources) {
            if (source.isActive) {
                source.updateSource(this.pressureField, this.dt);
            }
        }
    }

    /**
     * Add a new source to the simulation
     */
    addSource(params) {
        const source = new WaveSource(params);
        this.sources.push(source);
        return this.sources.length - 1; // Return the index of the new source
    }

    /**
     * Get all sources
     */
    getSources() {
        return this.sources;
    }

    /**
     * Set the source position
     */
    setSource(gridX, gridY) {
        return this.source.setPosition(gridX, gridY);
    }

    /**
     * Move a specific source to a new position
     */
    moveSource(sourceIndex, gridX, gridY) {
        if (sourceIndex >= 0 && sourceIndex < this.sources.length) {
            return this.sources[sourceIndex].setPosition(gridX, gridY);
        }
        return false;
    }

    /**
     * Check if a point is close to any source
     * Returns the index of the closest source if within threshold, or -1 if none found
     */
    findSourceNear(gridX, gridY, threshold = 3) {
        let closestIdx = -1;
        let closestDist = threshold * threshold;

        for (let i = 0; i < this.sources.length; i++) {
            const source = this.sources[i];
            const dx = source.x - gridX;
            const dy = source.y - gridY;
            const distSq = dx * dx + dy * dy;

            if (distSq < closestDist) {
                closestDist = distSq;
                closestIdx = i;
            }
        }

        return closestIdx;
    }

    /**
     * Set the source frequency
     */
    setFrequency(freq) {
        // Update all sources
        for (const source of this.sources) {
            source.setFrequency(freq);
        }

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
     * Trigger an impulse at all sources
     */
    async triggerImpulse() {
        // Reset pressure field
        this.pressureField.reset();

        // Trigger all sources
        for (const source of this.sources) {
            source.trigger();
        }

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