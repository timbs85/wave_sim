class RoomGeometry {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.walls = new Uint8Array(cols * rows);
        this.createLayout();
    }

    createLayout() {
        const { leftRoomRatio, roomHeightRatio, corridorRatio, marginRatio } = SimConfig.room;

        // Room dimensions (in grid cells)
        const roomWidth = Math.floor(this.cols * leftRoomRatio);
        const roomHeight = Math.floor(this.rows * roomHeightRatio);
        const doorHeight = Math.floor(this.rows * corridorRatio);

        // Position of room
        const margin = Math.floor(this.cols * marginRatio);
        const roomX = margin;
        const roomY = Math.floor((this.rows - roomHeight) / 2);

        // Draw room walls
        this.drawRectWalls(roomX, roomY, roomWidth, roomHeight);

        // Create door opening by removing part of the right wall
        const doorY = Math.floor((this.rows - doorHeight) / 2);
        for (let j = doorY; j < doorY + doorHeight; j++) {
            this.walls[(roomX + roomWidth) + j * this.cols] = 0;
        }
    }

    drawRectWalls(x, y, width, height) {
        // Draw horizontal walls
        for (let i = x; i < x + width; i++) {
            this.walls[i + y * this.cols] = 1;               // Top wall
            this.walls[i + (y + height) * this.cols] = 1;    // Bottom wall
        }

        // Draw vertical walls
        for (let j = y; j <= y + height; j++) {
            this.walls[x + j * this.cols] = 1;               // Left wall
            this.walls[(x + width) + j * this.cols] = 1;     // Right wall
        }
    }

    isWall(i, j) {
        if (i < 0 || i >= this.cols || j < 0 || j >= this.rows) return true;
        return this.walls[i + j * this.cols] > 0;
    }

    getWalls() {
        return this.walls;
    }
} 