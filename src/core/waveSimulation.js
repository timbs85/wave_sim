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

        // Calculate derived values (CFL condition)
        this.dx = params.room.physicalWidth / this.cols;
        this.dt = this.dx / (this.c * Math.sqrt(2));  // Ensures stability

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

        // Medium properties (direct values, no scaling)
        this.wallAbsorption = params.controls.wallAbsorption / 100;
        this.airAbsorption = (params.controls.airAbsorption / 100) * params.medium.maxAirAbsorption;

        this.isInitialized = false;

        // Energy tracking
        this.totalEnergy = 0;
        this.lastEnergyCheck = 0;
        this.energyCheckInterval = 10;
    }

    setPhysicsParams(physics) {
        this.c = physics.speedOfSound;
        this.rho = physics.density;
    }

    async initialize(frequency = window.params.source.defaultFrequency) {
        this.source.setFrequency(frequency);
        this.pressureField.reset();
        this.isInitialized = true;
        this.source.trigger();
        return Promise.resolve();
    }

    update() {
        // Basic two-step recursion
        this.pressureField.updatePressure(
            this.geometry.getWalls(),
            this.dt,
            this.dx,
            this.c,
            this.rho,
            this.wallAbsorption,
            this.airAbsorption
        );

        // Update source and track power
        if (this.source.isActive) {
            this.source.updateSource(this.pressureField, this.dt);
            this.pressureField.inputPower = this.source.getCurrentPower();
        } else {
            this.pressureField.inputPower = 0;
        }

        // Energy balance check
        this.lastEnergyCheck++;
        if (this.lastEnergyCheck >= this.energyCheckInterval) {
            this.checkEnergyBalance();
            this.lastEnergyCheck = 0;
        }
    }

    checkEnergyBalance() {
        // Calculate total energy
        this.pressureField.calculateEnergy(this.geometry.getWalls());
        const newEnergy = this.pressureField.energyAcoustic + this.pressureField.energyWall;

        // Check energy balance equation from slides
        const energyChange = newEnergy - this.totalEnergy;
        const powerBalance = this.pressureField.inputPower -
                           this.pressureField.powerLossWall -
                           this.pressureField.powerLossField;

        // Apply damping if energy increases against power balance
        if (energyChange > powerBalance * this.dt * this.energyCheckInterval) {
            const dampingFactor = Math.max(0.95,
                1.0 - (energyChange - powerBalance * this.dt * this.energyCheckInterval) / newEnergy);
            this.pressureField.applyDamping(dampingFactor);
        }

        this.totalEnergy = newEnergy;
    }

    setSource(gridX, gridY) {
        return this.source.setPosition(gridX, gridY, this.geometry.getWalls());
    }

    setFrequency(freq) {
        this.source.setFrequency(freq);
        this.pressureField.setFrequency(freq);
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