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

        // Track which source is being dragged (if any)
        this.draggingSourceIndex = -1;

        // Track if shift key is pressed
        this.isShiftPressed = false;

        // Bind methods to maintain 'this' context
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);

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
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }

    /**
     * Handle key down event
     */
    onKeyDown(event) {
        if (event.key === 'Shift') {
            this.isShiftPressed = true;
        }
    }

    /**
     * Handle key up event
     */
    onKeyUp(event) {
        if (event.key === 'Shift') {
            this.isShiftPressed = false;
        }
    }

    /**
     * Handle mouse down event
     */
    onMouseDown(event) {
        this.isMouseDown = true;
        this.lastMouseX = event.offsetX;
        this.lastMouseY = event.offsetY;

        // Process the initial click
        this.processMouseDown(this.lastMouseX, this.lastMouseY);
    }

    /**
     * Handle mouse move event
     */
    onMouseMove(event) {
        if (!this.isMouseDown) return;

        const mouseX = event.offsetX;
        const mouseY = event.offsetY;

        // Process mouse drag if we're dragging a source
        if (this.draggingSourceIndex >= 0) {
            this.processDragSource(mouseX, mouseY);
        }

        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
    }

    /**
     * Handle mouse up event
     */
    onMouseUp() {
        this.isMouseDown = false;
        this.draggingSourceIndex = -1;
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
     * Process mouse down event
     */
    processMouseDown(mouseX, mouseY) {
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

            // Check if we're clicking near an existing source
            const sourceIndex = physicsEngine.findSourceNear(simPos.x, simPos.y);

            if (sourceIndex >= 0) {
                // We're clicking on a source - prepare to drag it
                this.draggingSourceIndex = sourceIndex;
            } else if (this.isShiftPressed) {
                // Shift+click on empty space - add a new source
                const params = {
                    cols: physicsEngine.cols,
                    rows: physicsEngine.rows,
                    dx: physicsEngine.dx,
                    frequency: physicsEngine.source.signal.frequency,
                    amplitude: physicsEngine.source.signal.amplitude,
                    x: Math.floor(simPos.x),
                    y: Math.floor(simPos.y)
                };

                // Add the new source
                const newSourceIndex = physicsEngine.addSource(params);

                // Activate the new source
                physicsEngine.sources[newSourceIndex].trigger();

                // Update UI to show new source
                if (this.simulationApp.renderer) {
                    this.simulationApp.renderer.updateUI(physicsEngine);
                }
            }
            // If not shift-click and not clicking a source, do nothing
        }
    }

    /**
     * Process dragging a source
     */
    processDragSource(mouseX, mouseY) {
        const physicsEngine = this.simulationApp.physicsEngine;
        const renderer = this.simulationApp.renderer;

        if (!physicsEngine || !renderer || this.draggingSourceIndex < 0) return;

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

            // Move the source to the new position
            if (physicsEngine.moveSource(this.draggingSourceIndex, simPos.x, simPos.y)) {
                // Update UI to show new source position
                if (this.simulationApp.renderer) {
                    this.simulationApp.renderer.updateUI(physicsEngine);
                }
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
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }
}

// Export for browser use
window.InputHandler = InputHandler;