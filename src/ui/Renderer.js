/**
 * Renderer
 *
 * Handles the rendering of the wave simulation.
 * This class is completely independent of physics concerns.
 */
class Renderer {
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.width = canvas.width;
        this.height = canvas.height;

        // Create UI layer canvas
        this.uiCanvas = document.createElement('canvas');
        this.uiCanvas.width = canvas.width;
        this.uiCanvas.height = canvas.height;
        this.uiCtx = this.uiCanvas.getContext('2d');

        // Visualization settings
        this.contrastValue = config.contrastValue || 1.0;
        this.lowClipValue = config.lowClipValue || 0.0;
        this.visualizationMode = config.visualizationMode || 'pressure';
        this.simResolution = config.simResolution || 2; // Fixed at medium quality
        this.brightnessScale = config.brightnessScale || 16; // Fixed brightness for medium resolution

        // Initialize color lookup tables
        this.PRESSURE_STEPS = 1024;
        this.colorLookup = this.initColorLookup();

        // Image data for direct pixel manipulation
        this.imageData = null;
        this.wallsDrawn = false;
    }

    /**
     * Initialize color lookup tables for different visualization modes
     */
    initColorLookup() {
        const colorLookup = {
            pressure: new Uint8Array(this.PRESSURE_STEPS * 4),
            intensity: new Uint8Array(this.PRESSURE_STEPS * 4)
        };

        // Pre-calculate pressure colors
        for (let i = 0; i < this.PRESSURE_STEPS; i++) {
            // Apply non-linear mapping to pressure range for better visual dynamics
            const normalizedI = i / (this.PRESSURE_STEPS - 1);
            const pressureRange = 1.0; // Full range of pressure values
            const pressure = (normalizedI * 2 - 1) * pressureRange; // Map to [-range, +range]

            // Apply non-linear contrast curve for better visualization
            const curvedPressure = Math.sign(pressure) * Math.pow(Math.abs(pressure), 0.7);
            const intensity = this.map(curvedPressure, -1, 1, 0, 1);

            const idx = i * 4;

            // Pressure mode colors
            if (intensity > 0.5) {
                colorLookup.pressure[idx] = Math.floor(this.map(intensity, 0.5, 1, 0, 255)); // Red
                colorLookup.pressure[idx + 1] = 0;  // Green
                colorLookup.pressure[idx + 2] = 0;  // Blue
            } else {
                colorLookup.pressure[idx] = 0;      // Red
                colorLookup.pressure[idx + 1] = 0;  // Green
                colorLookup.pressure[idx + 2] = Math.floor(this.map(intensity, 0, 0.5, 255, 0)); // Blue
            }
            colorLookup.pressure[idx + 3] = 255;    // Alpha

            // Intensity mode colors - use curved pressure for better contrast
            const gray = Math.floor(this.map(Math.abs(curvedPressure), 0, 1, 0, 255));
            colorLookup.intensity[idx] = gray;
            colorLookup.intensity[idx + 1] = gray;
            colorLookup.intensity[idx + 2] = gray;
            colorLookup.intensity[idx + 3] = 255;
        }

        return colorLookup;
    }

    /**
     * Map a value from one range to another
     */
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    /**
     * Update renderer settings
     */
    updateSettings(settings) {
        if (settings.contrastValue !== undefined) this.contrastValue = settings.contrastValue;
        if (settings.lowClipValue !== undefined) this.lowClipValue = settings.lowClipValue;
        if (settings.visualizationMode !== undefined) this.visualizationMode = settings.visualizationMode;
        if (settings.simResolution !== undefined) this.simResolution = settings.simResolution;
        if (settings.brightnessScale !== undefined) this.brightnessScale = settings.brightnessScale;
    }

    /**
     * Set visualization mode
     */
    setVisualizationMode(mode) {
        this.visualizationMode = mode;
    }

    /**
     * Set contrast value
     */
    setContrastValue(value) {
        this.contrastValue = value;
    }

    /**
     * Set low clip value
     */
    setLowClipValue(value) {
        this.lowClipValue = value;
    }

    /**
     * Get current renderer settings
     */
    getSettings() {
        return {
            contrastValue: this.contrastValue,
            lowClipValue: this.lowClipValue,
            visualizationMode: this.visualizationMode,
            simResolution: this.simResolution,
            brightnessScale: this.brightnessScale
        };
    }

    /**
     * Handle window resize
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.uiCanvas.width = width;
        this.uiCanvas.height = height;
    }

    /**
     * Get pressure color index for the lookup table
     */
    getPressureColorIndex(pressure) {
        // Apply brightness scaling to the pressure value
        const scaledPressure = pressure * this.brightnessScale;

        // Apply contrast to the pressure value
        const contrastedPressure = scaledPressure * this.contrastValue;

        // Apply low clip - if absolute pressure is below threshold, set to zero
        const clippedPressure = Math.abs(contrastedPressure) < this.lowClipValue ? 0 : contrastedPressure;

        // Map pressure to lookup table index with clamping
        const normalizedPressure = (clippedPressure + 1.0) / 2.0; // Map from [-1,1] to [0,1]
        const clampedPressure = Math.max(0, Math.min(1, normalizedPressure));
        return Math.floor(clampedPressure * (this.PRESSURE_STEPS - 1));
    }

    /**
     * Calculate display scale to fit simulation in canvas
     */
    getDisplayScale(cols, rows) {
        // Calculate the simulation's actual dimensions in pixels
        const simWidth = cols * this.simResolution;
        const simHeight = rows * this.simResolution;

        // Calculate scale factors while preserving aspect ratio
        const containerAspect = this.width / this.height;
        const simAspect = simWidth / simHeight;

        if (containerAspect > simAspect) {
            // Container is wider than simulation - fit to height
            return this.height / simHeight;
        } else {
            // Container is taller than simulation - fit to width
            return this.width / simWidth;
        }
    }

    /**
     * Calculate display offset to center simulation in canvas
     */
    getDisplayOffset(cols, rows, scaleFactor) {
        const simWidth = cols * this.simResolution;
        const simHeight = rows * this.simResolution;
        return {
            x: (this.width - simWidth * scaleFactor) / 2,
            y: (this.height - simHeight * scaleFactor) / 2
        };
    }

    /**
     * Convert screen coordinates to simulation grid coordinates
     */
    screenToSimulation(screenX, screenY, cols, rows) {
        const scaleFactor = this.getDisplayScale(cols, rows);
        const { x: offsetX, y: offsetY } = this.getDisplayOffset(cols, rows, scaleFactor);

        return {
            x: Math.floor((screenX - offsetX) / (this.simResolution * scaleFactor)),
            y: Math.floor((screenY - offsetY) / (this.simResolution * scaleFactor))
        };
    }

    /**
     * Draw walls and source on UI layer
     */
    drawUI(physicsEngine) {
        const cols = physicsEngine.cols;
        const rows = physicsEngine.rows;
        const walls = physicsEngine.getWalls();
        const source = physicsEngine.getSource();
        const scaleFactor = this.getDisplayScale(cols, rows);
        const { x: offsetX, y: offsetY } = this.getDisplayOffset(cols, rows, scaleFactor);

        // Clear UI canvas
        this.uiCtx.clearRect(0, 0, this.width, this.height);

        // Draw walls
        this.uiCtx.save();
        this.uiCtx.translate(offsetX, offsetY);
        this.uiCtx.scale(scaleFactor, scaleFactor);

        for (let gridY = 0; gridY < rows; gridY++) {
            for (let gridX = 0; gridX < cols; gridX++) {
                const idx = gridX + gridY * cols;
                if (walls[idx] > 0) {
                    const isAnechoic = walls[idx] === 2;
                    this.uiCtx.fillStyle = isAnechoic ? 'rgba(32, 32, 32, 0.25)' : 'rgba(128, 128, 128, 1)';
                    this.uiCtx.fillRect(
                        gridX * this.simResolution,
                        gridY * this.simResolution,
                        this.simResolution,
                        this.simResolution
                    );
                }
            }
        }

        // Draw source indicator
        this.uiCtx.strokeStyle = 'yellow';
        this.uiCtx.lineWidth = 1 / scaleFactor;
        this.uiCtx.beginPath();
        const sourceX = source.x * this.simResolution;
        const sourceY = source.y * this.simResolution;
        const sourceDiameter = Math.max(8, this.simResolution / 2);
        this.uiCtx.arc(
            sourceX + this.simResolution / 2 - 0.5,  // Slight left adjustment
            sourceY + this.simResolution / 2 - 0.5,  // Slight up adjustment
            sourceDiameter / 2,
            0,
            Math.PI * 2
        );
        this.uiCtx.stroke();

        this.uiCtx.restore();
    }

    /**
     * Update UI elements (walls and source)
     */
    updateUI(physicsEngine) {
        this.drawUI(physicsEngine);
    }

    /**
     * Render the simulation
     */
    render(physicsEngine, deltaTime = 16.67) {
        if (!physicsEngine || !physicsEngine.getPressureField()) return;

        const cols = physicsEngine.cols;
        const rows = physicsEngine.rows;

        // Clear the canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Ensure imageData is properly sized
        const imageWidth = cols * this.simResolution;
        const imageHeight = rows * this.simResolution;
        if (!this.imageData || this.imageData.width !== imageWidth || this.imageData.height !== imageHeight) {
            this.imageData = new ImageData(imageWidth, imageHeight);
            if (!this.prevPressureField) {
                this.prevPressureField = new Float32Array(cols * rows);
            }
        }

        // Resize previous pressure field if needed
        if (this.prevPressureField && this.prevPressureField.length !== cols * rows) {
            this.prevPressureField = new Float32Array(cols * rows);
        }

        // Get display parameters
        const scaleFactor = this.getDisplayScale(cols, rows);
        const { x: offsetX, y: offsetY } = this.getDisplayOffset(cols, rows, scaleFactor);

        // Render the simulation
        const currentLookup = this.colorLookup[this.visualizationMode];
        const pixels = new Uint8Array(this.imageData.data.buffer);

        // Calculate interpolation factor
        const interpolationFactor = physicsEngine.simulationApp ?
            Math.min(1.0, physicsEngine.simulationApp.physicsAccumulator / physicsEngine.simulationApp.updateInterval) : 0;

        // Update pixel buffer
        for (let gridY = 0; gridY < rows; gridY++) {
            for (let gridX = 0; gridX < cols; gridX++) {
                const idx = gridX + gridY * cols;
                const cellStartX = gridX * this.simResolution;
                const cellStartY = gridY * this.simResolution;

                for (let py = 0; py < this.simResolution; py++) {
                    const rowOffset = ((cellStartY + py) * imageWidth + cellStartX) * 4;
                    for (let px = 0; px < this.simResolution; px++) {
                        const fx = px / this.simResolution;
                        const fy = py / this.simResolution;

                        let pressure;
                        if (gridX > 0 && gridX < cols - 1 && gridY > 0 && gridY < rows - 1) {
                            const p00 = physicsEngine.getPressure(gridX, gridY);
                            const p10 = physicsEngine.getPressure(gridX + 1, gridY);
                            const p01 = physicsEngine.getPressure(gridX, gridY + 1);
                            const p11 = physicsEngine.getPressure(gridX + 1, gridY + 1);

                            const p0 = p00 * (1 - fx) + p10 * fx;
                            const p1 = p01 * (1 - fx) + p11 * fx;
                            pressure = p0 * (1 - fy) + p1 * fy;
                        } else {
                            pressure = physicsEngine.getPressure(gridX, gridY);
                        }

                        const prevPressure = this.prevPressureField ? this.prevPressureField[idx] || 0 : 0;
                        let interpolatedPressure = pressure;
                        if (this.prevPressureField && interpolationFactor > 0) {
                            interpolatedPressure = prevPressure + (pressure - prevPressure) * interpolationFactor;
                        }

                        if (this.prevPressureField) {
                            this.prevPressureField[idx] = pressure;
                        }

                        const lookupIdx = this.getPressureColorIndex(interpolatedPressure) * 4;
                        const pixelOffset = rowOffset + px * 4;
                        pixels[pixelOffset] = currentLookup[lookupIdx];
                        pixels[pixelOffset + 1] = currentLookup[lookupIdx + 1];
                        pixels[pixelOffset + 2] = currentLookup[lookupIdx + 2];
                        pixels[pixelOffset + 3] = currentLookup[lookupIdx + 3];
                    }
                }
            }
        }

        // Draw the simulation
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageWidth;
        tempCanvas.height = imageHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(this.imageData, 0, 0);

        // Enable image smoothing for the main context
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Draw pressure field
        this.ctx.drawImage(
            tempCanvas,
            offsetX, offsetY,
            imageWidth * scaleFactor,
            imageHeight * scaleFactor
        );

        // Draw UI layer
        this.ctx.drawImage(this.uiCanvas, 0, 0);
    }
}

// Export for browser use
window.Renderer = Renderer;