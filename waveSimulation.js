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

        // Create wall grid (1 = wall, 0 = air)
        this.walls = new Uint8Array(gridSize);

        // Create neighbor information arrays
        this.nonWallNeighborCount = new Uint8Array(gridSize);
        this.neighborIndices = new Int32Array(gridSize * 5);

        // Create the room layout
        this.createRoomLayout();

        // Precalculate neighbor information
        this.precalculateNeighborInfo();

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
        this.cycleComplete = false; // Track if we've completed our half cycle

        // Debug flag to verify absorption
        console.log("Initial absorption:", this.wallAbsorption);

        // Precalculate constants
        this.c2dt2_dx2 = (this.c * this.c * this.dt * this.dt) / (this.dx * this.dx);

        // Add warning message state
        this.warningMessage = null;
    }

    createRoomLayout() {
        // Room dimensions (in grid cells)
        const roomWidth = Math.floor(this.cols * 0.40);  // Each room takes ~40% of width
        const roomHeight = Math.floor(this.rows * 0.70);  // Rooms take 70% of height
        const corridorHeight = Math.floor(this.rows * 0.15);  // Corridor is 15% of height

        // Position of rooms
        const margin = Math.floor(this.cols * 0.05);  // 5% margin from edges
        const leftRoomX = margin;
        const rightRoomX = this.cols - margin - roomWidth;
        const roomY = Math.floor((this.rows - roomHeight) / 2);  // Center vertically

        // Draw left room (complete rectangle)
        this.drawRectWalls(leftRoomX, roomY, roomWidth, roomHeight);

        // Draw right room (complete rectangle)
        this.drawRectWalls(rightRoomX, roomY, roomWidth, roomHeight);

        // Calculate corridor position
        const corridorY = Math.floor((this.rows - corridorHeight) / 2);  // Center corridor vertically
        const corridorStartX = leftRoomX + roomWidth;
        const corridorEndX = rightRoomX;

        // Draw corridor walls (just the parallel sections)
        // Top wall
        for (let x = corridorStartX; x < corridorEndX; x++) {
            this.walls[x + corridorY * this.cols] = 1;
        }
        // Bottom wall
        for (let x = corridorStartX; x < corridorEndX; x++) {
            this.walls[x + (corridorY + corridorHeight) * this.cols] = 1;
        }

        // Create openings by removing wall sections
        // Left room opening
        for (let j = corridorY + 1; j < corridorY + corridorHeight; j++) {
            this.walls[corridorStartX + j * this.cols] = 0;
        }
        // Right room opening
        for (let j = corridorY + 1; j < corridorY + corridorHeight; j++) {
            this.walls[corridorEndX + j * this.cols] = 0;
        }

        // Set initial source position to center of left room
        this.sourceX = leftRoomX + Math.floor(roomWidth / 2);
        this.sourceY = roomY + Math.floor(roomHeight / 2);
    }

    precalculateNeighborInfo() {
        // Calculate neighbor indices and non-wall neighbor counts
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const baseIdx = (i + j * this.cols) * 5;
                const idx = i + j * this.cols;

                // Store center and neighbor indices
                this.neighborIndices[baseIdx] = idx;      // Center
                this.neighborIndices[baseIdx + 1] = idx - 1;  // Left
                this.neighborIndices[baseIdx + 2] = idx + 1;  // Right
                this.neighborIndices[baseIdx + 3] = idx - this.cols;  // Up
                this.neighborIndices[baseIdx + 4] = idx + this.cols;  // Down

                // Count non-wall neighbors
                if (!this.walls[idx]) {  // Only count for non-wall cells
                    let count = 0;
                    if (!this.isWall(i - 1, j)) count++;
                    if (!this.isWall(i + 1, j)) count++;
                    if (!this.isWall(i, j - 1)) count++;
                    if (!this.isWall(i, j + 1)) count++;
                    this.nonWallNeighborCount[idx] = count;
                }
            }
        }
    }

    drawRectWalls(x, y, width, height) {
        // Draw horizontal walls
        for (let i = x; i < x + width; i++) {
            this.walls[i + y * this.cols] = 1;  // Top wall
            this.walls[i + (y + height) * this.cols] = 1;  // Bottom wall
        }

        // Draw vertical walls (including corners)
        for (let j = y; j <= y + height; j++) {
            this.walls[x + j * this.cols] = 1;  // Left wall
            this.walls[(x + width) + j * this.cols] = 1;  // Right wall
        }
    }

    setSource(x, y) {
        const newSourceX = Math.floor(x / this.cellSize + 0.5);
        const newSourceY = Math.floor(y / this.cellSize + 0.5);

        // Don't allow placing source in walls
        if (this.isWall(newSourceX, newSourceY)) {
            this.warningMessage = {
                text: "Cannot place source inside walls!",
                timeLeft: 5
            };
            return;
        }

        // Find distance to nearest wall
        let minDistance = Infinity;
        const searchRadius = Math.ceil(this.c / (this.frequency * this.dx)); // wavelength in cells

        for (let i = Math.max(0, newSourceX - searchRadius); i < Math.min(this.cols, newSourceX + searchRadius); i++) {
            for (let j = Math.max(0, newSourceY - searchRadius); j < Math.min(this.rows, newSourceY + searchRadius); j++) {
                if (this.isWall(i, j)) {
                    const distance = Math.sqrt((i - newSourceX) ** 2 + (j - newSourceY) ** 2);
                    minDistance = Math.min(minDistance, distance);
                }
            }
        }

        const wavelengthCells = this.c / (this.frequency * this.dx);

        if (minDistance < wavelengthCells) {
            this.warningMessage = {
                text: `Source too close to wall! Distance: ${minDistance.toFixed(1)} cells, Wavelength: ${wavelengthCells.toFixed(1)} cells`,
                timeLeft: 5
            };
        } else {
            this.warningMessage = null;
        }

        this.sourceX = newSourceX;
        this.sourceY = newSourceY;
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

        // Check if source position is still valid with new frequency
        if (this.sourceX !== undefined && this.sourceY !== undefined) {
            // Find distance to nearest wall
            let minDistance = Infinity;
            const searchRadius = Math.ceil(this.c / (this.frequency * this.dx)); // wavelength in cells

            for (let i = Math.max(0, this.sourceX - searchRadius); i < Math.min(this.cols, this.sourceX + searchRadius); i++) {
                for (let j = Math.max(0, this.sourceY - searchRadius); j < Math.min(this.rows, this.sourceY + searchRadius); j++) {
                    if (this.isWall(i, j)) {
                        const distance = Math.sqrt((i - this.sourceX) ** 2 + (j - this.sourceY) ** 2);
                        minDistance = Math.min(minDistance, distance);
                    }
                }
            }

            const wavelengthCells = this.c / (this.frequency * this.dx);

            if (minDistance < wavelengthCells) {
                this.warningMessage = {
                    text: `Source too close to wall! Distance: ${minDistance.toFixed(1)} cells, Wavelength: ${wavelengthCells.toFixed(1)} cells`,
                    timeLeft: 5
                };
            } else {
                this.warningMessage = null;
            }
        }
    }

    triggerImpulse() {
        this.isSourceActive = true;
        this.time = 0;
        this.cycleComplete = false;
        this.pressure.fill(0);
        this.previousPressure.fill(0);
        this.newPressure.fill(0);
    }

    isWall(i, j) {
        if (i < 0 || i >= this.cols || j < 0 || j >= this.rows) return true;
        return this.walls[i + j * this.cols] === 1;
    }

    update() {
        // Update pressure values
        for (let i = 1; i < this.cols - 1; i++) {
            for (let j = 1; j < this.rows - 1; j++) {
                const idx = i + j * this.cols;

                // Skip update for wall cells
                if (this.walls[idx] === 1) continue;

                const baseIdx = idx * 5;
                const idxLeft = this.neighborIndices[baseIdx + 1];
                const idxRight = this.neighborIndices[baseIdx + 2];
                const idxUp = this.neighborIndices[baseIdx + 3];
                const idxDown = this.neighborIndices[baseIdx + 4];

                // Use precalculated neighbor sum
                let neighborSum = 0;
                if (!this.walls[idxLeft]) neighborSum += this.pressure[idxLeft];
                if (!this.walls[idxRight]) neighborSum += this.pressure[idxRight];
                if (!this.walls[idxUp]) neighborSum += this.pressure[idxUp];
                if (!this.walls[idxDown]) neighborSum += this.pressure[idxDown];

                // Modified FDTD update using precalculated neighbor count
                this.newPressure[idx] = (
                    2 * this.pressure[idx] -
                    this.previousPressure[idx] +
                    this.c2dt2_dx2 * (
                        neighborSum -
                        this.nonWallNeighborCount[idx] * this.pressure[idx]
                    )
                );

                // Apply wall absorption if adjacent to a wall
                if (this.nonWallNeighborCount[idx] < 4) {  // If has any wall neighbors
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

            if (gaussianAmplitude >= 0.01 && !this.cycleComplete) {
                // Calculate phase of the wave (0 to π)
                const phase = 2 * Math.PI * this.frequency * this.time;

                // Only continue if we haven't completed a half cycle
                if (phase <= Math.PI) {
                    // Use sin for 0 to π to get only positive portion
                    const sourceValue = this.amplitude * gaussianAmplitude * Math.sin(phase);

                    // Add the pulse to source point and immediate neighbors for smoother emission
                    this.newPressure[sourceIdx] += sourceValue;
                    if (this.sourceX > 0) this.newPressure[sourceIdx - 1] += sourceValue * 0.5;
                    if (this.sourceX < this.cols - 1) this.newPressure[sourceIdx + 1] += sourceValue * 0.5;
                    if (this.sourceY > 0) this.newPressure[sourceIdx - this.cols] += sourceValue * 0.5;
                    if (this.sourceY < this.rows - 1) this.newPressure[sourceIdx + this.cols] += sourceValue * 0.5;
                } else {
                    this.cycleComplete = true;
                }

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

    // Add this method to update warning timer
    updateWarning() {
        if (this.warningMessage && this.warningMessage.timeLeft > 0) {
            this.warningMessage.timeLeft -= this.dt;
            if (this.warningMessage.timeLeft <= 0) {
                this.warningMessage = null;
            }
        }
    }

    dispose() {
        // Clear all array references for garbage collection
        this.pressure = null;
        this.previousPressure = null;
        this.newPressure = null;
        this.walls = null;
        this.nonWallNeighborCount = null;
        this.neighborIndices = null;
    }
} 