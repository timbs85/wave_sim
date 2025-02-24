class WaveSimulation {
    constructor(width, height, cellSize = 2) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;

        // Calculate grid dimensions
        this.cols = Math.floor(width / cellSize);
        this.rows = Math.floor(height / cellSize);

        // Create pressure grids (we need current and previous state)
        const gridSize = this.cols * this.rows;
        this.pressure = new Float32Array(gridSize);
        this.previousPressure = new Float32Array(gridSize);
        this.newPressure = new Float32Array(gridSize);

        // Simulation parameters
        this.c = 343; // Speed of sound in m/s
        this.dx = 0.1; // Grid spacing in meters
        this.dt = (this.dx / (this.c * Math.sqrt(2))) * 0.5; // Time step (CFL condition)

        // Medium and boundary parameters
        this.wallAbsorption = 0.1; // Wall absorption coefficient (0 = full reflection, 1 = full absorption)
        this.airAbsorption = 0.001; // Air absorption coefficient (higher = more absorption per meter)

        // Source parameters
        this.sourceX = Math.floor(this.cols / 2);
        this.sourceY = Math.floor(this.rows / 2);
        this.frequency = 440; // Hz
        this.amplitude = 0.5;
        this.isSourceActive = false;
        this.time = 0;

        // Debug flag to verify absorption
        console.log("Initial absorption:", this.wallAbsorption);

        // Precalculate constants
        this.c2dt2_dx2 = (this.c * this.c * this.dt * this.dt) / (this.dx * this.dx);

        // Precalculate neighbor indices for better performance
        this.neighborIndices = new Int32Array(gridSize * 5);
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = i + j * this.cols;
                this.neighborIndices[baseIdx] = idx;  // Center
                this.neighborIndices[baseIdx + 1] = idx - 1;  // Left
                this.neighborIndices[baseIdx + 2] = idx + 1;  // Right
                this.neighborIndices[baseIdx + 3] = idx - this.cols;  // Up
                this.neighborIndices[baseIdx + 4] = idx + this.cols;  // Down
            }
        }
    }

    setSource(x, y) {
        // Convert pixel coordinates to grid coordinates, centering on the clicked cell
        this.sourceX = Math.floor(x / this.cellSize + 0.5);
        this.sourceY = Math.floor(y / this.cellSize + 0.5);
    }

    setAirAbsorption(value) {
        // Convert 0-1 range to appropriate air absorption values
        // At 0, sound travels far (low absorption)
        // At 1, sound is quickly absorbed by air
        this.airAbsorption = value * 0.015; // Scale to reasonable range
        console.log("Air absorption coefficient:", this.airAbsorption);
    }

    setWallAbsorption(value) {
        this.wallAbsorption = value;
        console.log("Wall absorption coefficient:", this.wallAbsorption);
    }

    setFrequency(freq) {
        this.frequency = freq;
    }

    triggerImpulse() {
        this.isSourceActive = true;
        this.time = 0;
        this.pressure.fill(0);
        this.previousPressure.fill(0);
        this.newPressure.fill(0);
    }

    // Simplified wall check - returns true if position is at a wall
    isWall(i, j) {
        return i === 0 || i === this.cols - 1 || j === 0 || j === this.rows - 1;
    }

    update() {
        // Update pressure values
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = this.neighborIndices[baseIdx];
                const idxLeft = this.neighborIndices[baseIdx + 1];
                const idxRight = this.neighborIndices[baseIdx + 2];
                const idxUp = this.neighborIndices[baseIdx + 3];
                const idxDown = this.neighborIndices[baseIdx + 4];

                // Standard FDTD update
                this.newPressure[idx] = (
                    2 * this.pressure[idx] -
                    this.previousPressure[idx] +
                    this.c2dt2_dx2 * (
                        this.pressure[idxRight] +
                        this.pressure[idxLeft] +
                        this.pressure[idxDown] +
                        this.pressure[idxUp] -
                        4 * this.pressure[idx]
                    )
                );

                // Apply wall absorption if adjacent to a wall
                if (i === 1 || i === this.cols - 2 || j === 1 || j === this.rows - 2) {
                    this.newPressure[idx] *= (1 - this.wallAbsorption);
                }

                // Apply air absorption
                this.newPressure[idx] *= (1 - this.airAbsorption);

                // Clean up very small values to prevent perpetual ripples
                if (Math.abs(this.newPressure[idx]) < 0.001) {
                    this.newPressure[idx] = 0;
                }
            }
        }

        // Add source if active
        if (this.isSourceActive) {
            const gaussianWidth = 0.0001;
            const gaussianAmplitude = Math.exp(-this.time * this.time / gaussianWidth);
            const sourceIdx = this.sourceX + this.sourceY * this.cols;

            if (gaussianAmplitude >= 0.01) {
                const sourceValue = this.amplitude * gaussianAmplitude *
                    Math.sin(2 * Math.PI * this.frequency * this.time);

                // Add the pulse to source point and immediate neighbors for smoother emission
                this.newPressure[sourceIdx] += sourceValue;
                if (this.sourceX > 0) this.newPressure[sourceIdx - 1] += sourceValue * 0.5;
                if (this.sourceX < this.cols - 1) this.newPressure[sourceIdx + 1] += sourceValue * 0.5;
                if (this.sourceY > 0) this.newPressure[sourceIdx - this.cols] += sourceValue * 0.5;
                if (this.sourceY < this.rows - 1) this.newPressure[sourceIdx + this.cols] += sourceValue * 0.5;

                this.time += this.dt;
            } else {
                this.isSourceActive = false;
            }
        }

        // Swap buffers
        const temp = this.previousPressure;
        this.previousPressure = this.pressure;
        this.pressure = this.newPressure;
        this.newPressure = temp;
    }

    getPressure(x, y) {
        const i = Math.floor(x / this.cellSize);
        const j = Math.floor(y / this.cellSize);
        if (i >= 0 && i < this.cols && j >= 0 && j < this.rows) {
            return this.pressure[i + j * this.cols];
        }
        return 0;
    }
} 