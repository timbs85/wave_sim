/**
 * InputHandler
 *
 * Handles user input and translates it to simulation actions.
 * Separates input handling from both physics and rendering.
 */
class InputHandler {
    constructor(simulationApp) {
        this.simulationApp = simulationApp;
        this.isMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Bind methods to maintain 'this' context
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);

        // Initialize event listeners
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for user input
     */
    setupEventListeners() {
        // Get the canvas element from the renderer
        const canvas = this.simulationApp.renderer.canvas;

        // Add mouse event listeners
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('mouseleave', this.onMouseUp);

        // Add keyboard event listeners
        document.addEventListener('keypress', this.onKeyPress);
    }

    /**
     * Handle mouse down event
     */
    onMouseDown(event) {
        this.isMouseDown = true;
        this.lastMouseX = event.offsetX;
        this.lastMouseY = event.offsetY;

        // Process the initial click
        this.processMouseInput(this.lastMouseX, this.lastMouseY);
    }

    /**
     * Handle mouse move event
     */
    onMouseMove(event) {
        if (!this.isMouseDown) return;

        this.lastMouseX = event.offsetX;
        this.lastMouseY = event.offsetY;

        // Process the mouse drag
        this.processMouseInput(this.lastMouseX, this.lastMouseY);
    }

    /**
     * Handle mouse up event
     */
    onMouseUp() {
        this.isMouseDown = false;
    }

    /**
     * Handle key press event
     */
    onKeyPress(event) {
        // Example key handlers
        switch (event.key.toLowerCase()) {
            case ' ':
                // Space bar - toggle pause
                this.simulationApp.togglePause();
                break;
            case 'r':
                // R key - reset simulation
                this.simulationApp.resetSimulation();
                break;
            case 'p':
                // P key - switch to pressure visualization
                this.simulationApp.setVisualizationMode('pressure');
                break;
            case 'i':
                // I key - switch to intensity visualization
                this.simulationApp.setVisualizationMode('intensity');
                break;
        }
    }

    /**
     * Process mouse input and translate to simulation actions
     */
    processMouseInput(mouseX, mouseY) {
        const physicsEngine = this.simulationApp.physicsEngine;
        const renderer = this.simulationApp.renderer;

        if (!physicsEngine || !renderer) return;

        // Convert screen coordinates to simulation grid coordinates
        const simPos = renderer.screenToSimulation(
            mouseX,
            mouseY,
            physicsEngine.cols,
            physicsEngine.rows
        );

        // Check if the position is within the simulation bounds
        if (simPos.x >= 0 && simPos.x < physicsEngine.cols &&
            simPos.y >= 0 && simPos.y < physicsEngine.rows) {

            // Set the source position and trigger an impulse
            if (physicsEngine.setSource(simPos.x, simPos.y)) {
                physicsEngine.triggerImpulse();
            }
        }
    }

    /**
     * Remove all event listeners
     */
    dispose() {
        const canvas = this.simulationApp.renderer.canvas;

        // Remove mouse event listeners
        canvas.removeEventListener('mousedown', this.onMouseDown);
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('mouseup', this.onMouseUp);
        canvas.removeEventListener('mouseleave', this.onMouseUp);

        // Remove keyboard event listeners
        document.removeEventListener('keypress', this.onKeyPress);
    }
}

// Export for both module and global use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputHandler };
}

if (typeof window !== 'undefined') {
    window.InputHandler = InputHandler;
}