/**
 * p5.js sketch for wave simulation
 *
 * This file is now a thin wrapper around the SimulationApp class,
 * which handles the coordination of physics and rendering.
 */

// Global application instance
let app;

// p5.js setup function - runs once at the beginning
function setup() {
    // Create a p5 canvas for compatibility, but we won't use it directly
    // Our renderer will create its own canvas
    noCanvas();

    // Disable automatic looping - we'll use requestAnimationFrame
    noLoop();

    // Initialize the application
    initializeApp();
}

// Initialize the application
async function initializeApp() {
    try {
        console.log('Initializing application...');

        // Create and initialize the simulation app
        app = new SimulationApp({
            updateRate: 60,
            simResolution: window.params?.controls?.resolution || 8,
            visualizationMode: 'pressure',
            contrastValue: 1.0,
            lowClipValue: 0.0
        });

        // Initialize the application
        await app.initialize();

        // Make app globally accessible for debugging
        window.app = app;

        // Set up window resize handler
        window.addEventListener('resize', () => {
            app.handleResize();
        });

        // Set up unload handler
        window.addEventListener('unload', () => {
            if (app) {
                app.dispose();
            }
        });

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}

// p5.js draw function - not used in our new architecture
function draw() {
    // This function is intentionally empty
    // The rendering is now handled by the SimulationApp class
    }

// p5.js windowResized function - delegate to app
function windowResized() {
    if (app) {
        app.handleResize();
    }
}