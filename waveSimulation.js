class WaveSimulation {
    constructor(width, height, cellSize = 2) {
        // Grid dimensions
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.floor(width / cellSize);
        this.rows = Math.floor(height / cellSize);

        // Physical parameters
        this.c = SimConfig.physics.speedOfSound;
        this.rho = SimConfig.physics.density; // Air density
        this.dx = SimConfig.room.physicalWidth / this.cols;

        // Time step (CFL condition for interleaved scheme)
        this.dt = this.dx / (this.c * Math.sqrt(2));

        // Medium properties
        this.wallAbsorption = SimConfig.medium.defaultWallAbsorption;
        this.airAbsorption = SimConfig.medium.defaultAirAbsorption;

        // Initialize components
        this.geometry = new RoomGeometry(this.cols, this.rows);
        this.pressureField = new PressureField(this.cols, this.rows);
        this.source = new WaveSource(this.cols, this.rows, this.dx);

        // Precalculate neighbor information
        this.pressureField.precalculateNeighborInfo(this.geometry.getWalls());
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

    setSource(x, y) {
        this.source.setPosition(x, y, this.cellSize, this.geometry.getWalls(), this.c);
    }

    setFrequency(freq) {
        this.source.setFrequency(freq, this.geometry.getWalls(), this.c);
    }

    setAirAbsorption(value) {
        this.airAbsorption = value * SimConfig.medium.maxAirAbsorption;
    }

    setWallAbsorption(value) {
        this.wallAbsorption = value;
    }

    triggerImpulse() {
        this.source.trigger();
        this.pressureField.reset();
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
        this.pressureField.dispose();
    }
} 