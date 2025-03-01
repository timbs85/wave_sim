/**
 * Main entry point for wave simulation
 *
 * This file initializes the SimulationApp and handles application lifecycle.
 * It replaces the p5.js sketch.js entry point with a plain JavaScript implementation.
 */

// Global application instance
let app;

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing wave simulation...');
    initializeApp();
});

// Initialize the application
async function initializeApp() {
    try {
        // Create and initialize the simulation app
        app = new SimulationApp({
            updateRate: 60,
            simResolution: 2, // Fixed medium resolution
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

        // Define p5.js compatibility functions
        // These are needed for any code that might still expect p5.js functions
        window.windowResized = () => {
            if (app) {
                app.handleResize();
            }
        };

        console.log('Wave simulation initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}