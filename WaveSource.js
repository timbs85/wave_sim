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

    setPosition(x, y, cellSize, walls, c) {
        const newX = Math.floor(x / cellSize);
        const newY = Math.floor(y / cellSize);

        // Check if new position is valid (not in a wall)
        if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows) {
            const idx = newX + newY * this.cols;
            if (!walls[idx]) {
                this.x = newX;
                this.y = newY;
                console.log('Source position set to:', this.x, this.y);
                return;
            }
        }
        console.log('Invalid source position:', x, y);
    }

    setFrequency(freq, walls, c) {
        this.frequency = freq;

        // Calculate wavelength in grid cells
        const wavelength = c / freq;
        const wavelengthCells = wavelength / this.dx;

        // Check if wavelength is resolvable on the grid
        if (wavelengthCells < 8) {
            this.warningMessage = {
                text: 'Warning: Frequency too high for grid resolution',
                timeout: 3
            };
        } else {
            this.warningMessage = null;
        }

        console.log('Source frequency set to:', freq, 'Hz');
    }

    trigger() {
        this.isActive = true;
        this.time = 0;
        this.cycleComplete = false;
        console.log('Source triggered');
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
        pressureField.pressure[sourceIdx] += sourceValue;

        // Add to neighbors for smoother emission
        if (this.x > 0)
            pressureField.pressure[sourceIdx - 1] += sourceValue * 0.5;
        if (this.x < this.cols - 1)
            pressureField.pressure[sourceIdx + 1] += sourceValue * 0.5;
        if (this.y > 0)
            pressureField.pressure[sourceIdx - this.cols] += sourceValue * 0.5;
        if (this.y < this.rows - 1)
            pressureField.pressure[sourceIdx + this.cols] += sourceValue * 0.5;
    }

    updateWarning(dt) {
        if (this.warningMessage && this.warningMessage.timeout > 0) {
            this.warningMessage.timeout -= dt;
            if (this.warningMessage.timeout <= 0) {
                this.warningMessage = null;
            }
        }
    }
} 