class WaveSource {
    constructor(cols, rows, dx) {
        this.cols = cols;
        this.rows = rows;
        this.dx = dx;

        // Source parameters
        this.x = Math.floor(cols * SimConfig.source.defaultX);
        this.y = Math.floor(rows * SimConfig.source.defaultY);
        this.frequency = SimConfig.source.defaultFrequency;
        this.amplitude = SimConfig.source.defaultAmplitude;

        // State
        this.isActive = false;
        this.time = 0;
        this.cycleComplete = false;
        this.warningMessage = null;
    }

    setPosition(x, y, cellSize, walls, speedOfSound) {
        const newX = Math.floor(x / cellSize + 0.5);
        const newY = Math.floor(y / cellSize + 0.5);

        if (this._isValidPosition(newX, newY, walls, speedOfSound)) {
            this.x = newX;
            this.y = newY;
            return true;
        }
        return false;
    }

    _isValidPosition(x, y, walls, speedOfSound) {
        // Check if position is inside walls
        if (walls[x + y * this.cols] === 1) {
            this.warningMessage = {
                text: "Cannot place source inside walls!",
                timeLeft: 5
            };
            return false;
        }

        // Check distance to nearest wall
        const wavelengthCells = speedOfSound / (this.frequency * this.dx);
        const searchRadius = Math.ceil(wavelengthCells);
        let minDistance = this._findMinWallDistance(x, y, walls, searchRadius);

        if (minDistance < wavelengthCells) {
            this.warningMessage = {
                text: `Source too close to wall! Distance: ${minDistance.toFixed(1)} cells, Wavelength: ${wavelengthCells.toFixed(1)} cells`,
                timeLeft: 5
            };
            return false;
        }

        this.warningMessage = null;
        return true;
    }

    _findMinWallDistance(x, y, walls, searchRadius) {
        let minDistance = Infinity;

        const startX = Math.max(0, x - searchRadius);
        const endX = Math.min(this.cols, x + searchRadius);
        const startY = Math.max(0, y - searchRadius);
        const endY = Math.min(this.rows, y + searchRadius);

        for (let i = startX; i < endX; i++) {
            for (let j = startY; j < endY; j++) {
                if (walls[i + j * this.cols] === 1) {
                    const distance = Math.sqrt((i - x) ** 2 + (j - y) ** 2);
                    minDistance = Math.min(minDistance, distance);
                }
            }
        }

        return minDistance;
    }

    setFrequency(freq, walls, speedOfSound) {
        this.frequency = freq;
        if (this.x !== undefined && this.y !== undefined) {
            this._isValidPosition(this.x, this.y, walls, speedOfSound);
        }
    }

    trigger() {
        this.isActive = true;
        this.time = 0;
        this.cycleComplete = false;
    }

    updateSource(pressureField, dt) {
        if (!this.isActive) return;

        const gaussianWidth = SimConfig.physics.gaussianWidth;
        const gaussianAmplitude = Math.exp(-this.time * this.time / gaussianWidth);
        const sourceIdx = this.x + this.y * this.cols;

        if (gaussianAmplitude >= 0.01 && !this.cycleComplete) {
            const phase = 2 * Math.PI * this.frequency * this.time;

            if (phase <= Math.PI) {
                const sourceValue = this.amplitude * gaussianAmplitude * Math.sin(phase);
                console.log('Emitting pressure:', sourceValue, 'at position:', this.x, this.y);
                this._applySourcePressure(pressureField, sourceIdx, sourceValue);
            } else {
                console.log('Cycle complete');
                this.cycleComplete = true;
            }

            this.time += dt;
        } else {
            console.log('Source inactive or amplitude too low');
            this.isActive = false;
        }
    }

    _applySourcePressure(pressureField, sourceIdx, sourceValue) {
        pressureField.current[sourceIdx] += sourceValue;

        // Add to neighbors for smoother emission
        if (this.x > 0)
            pressureField.current[sourceIdx - 1] += sourceValue * 0.5;
        if (this.x < this.cols - 1)
            pressureField.current[sourceIdx + 1] += sourceValue * 0.5;
        if (this.y > 0)
            pressureField.current[sourceIdx - this.cols] += sourceValue * 0.5;
        if (this.y < this.rows - 1)
            pressureField.current[sourceIdx + this.cols] += sourceValue * 0.5;
    }

    updateWarning(dt) {
        if (this.warningMessage && this.warningMessage.timeLeft > 0) {
            this.warningMessage.timeLeft -= dt;
            if (this.warningMessage.timeLeft <= 0) {
                this.warningMessage = null;
            }
        }
    }
} 