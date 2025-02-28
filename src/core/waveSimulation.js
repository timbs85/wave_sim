class WaveSimulation {
    constructor(params) {
        // Grid dimensions
        this.width = params.room.width;
        this.height = params.room.height;
        this.cellSize = params.controls.resolution;
        this.cols = Math.floor(this.width / this.cellSize);
        this.rows = Math.floor(this.height / this.cellSize);

        // Store physics parameters
        this.setPhysicsParams(params.physics);

        // Calculate derived values
        this.dx = params.room.physicalWidth / this.cols;
        this.dt = this.dx / (this.c * Math.sqrt(2));

        // Initialize components with only needed params
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
        this.setMediumParams(params.controls, params.medium);

        this.isInitialized = false;
    }

    setPhysicsParams(physics) {
        this.c = physics.speedOfSound;
        this.rho = physics.density;
    }

    setMediumParams(controls, medium) {
        this.wallAbsorption = controls.wallAbsorption / 100;
        this.airAbsorption = (controls.airAbsorption / 100) * medium.maxAirAbsorption;
    }

    async initialize(frequency = window.params.source.defaultFrequency) {
        // Set initial parameters
        this.source.setFrequency(frequency);

        // Reset pressure field
        this.pressureField.reset();

        // Recalculate neighbor information
        this.pressureField.precalculateNeighborInfo(this.geometry.getWalls());

        // Mark as initialized
        this.isInitialized = true;

        // Trigger the source
        this.source.trigger();

        // Return a resolved promise to ensure async completion
        return Promise.resolve();
    }

    update() {
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

    setSource(gridX, gridY) {
        return this.source.setPosition(gridX, gridY, this.geometry.getWalls());
    }

    setFrequency(freq) {
        this.source.setFrequency(freq);
        if (this.isInitialized) {
            this.triggerImpulse();
        }
    }

    setAirAbsorption(value, maxAirAbsorption) {
        this.airAbsorption = value * maxAirAbsorption;
    }

    setWallAbsorption(value) {
        this.wallAbsorption = value;
    }

    async triggerImpulse() {
        // Reset pressure field
        this.pressureField.reset();

        // Recalculate neighbor information
        this.pressureField.precalculateNeighborInfo(this.geometry.getWalls());

        // Trigger the source
        this.source.trigger();

        // Return a resolved promise to ensure async completion
        return Promise.resolve();
    }

    getPressure(x, y) {
        return this.pressureField.getPressure(x, y, this.cellSize);
    }

    getVelocity(x, y) {
        return this.pressureField.getVelocity(x, y, this.cellSize);
    }

    updateWarning() {
        this.source.updateWarning(this.dt);
    }

    get warningMessage() {
        return this.source.warningMessage;
    }

    dispose() {
        if (this.pressureField) {
            this.pressureField.dispose();
        }
    }
}