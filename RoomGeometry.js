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
        const corridorHeight = Math.floor(this.rows * corridorRatio);

        // Position of rooms
        const margin = Math.floor(this.cols * marginRatio);
        const leftRoomX = margin;
        const rightRoomX = this.cols - margin - roomWidth;
        const roomY = Math.floor((this.rows - roomHeight) / 2);

        // Draw rooms and corridor
        this.drawRectWalls(leftRoomX, roomY, roomWidth, roomHeight);
        this.drawRectWalls(rightRoomX, roomY, roomWidth, roomHeight);
        this.createCorridor(leftRoomX + roomWidth, rightRoomX, roomY, corridorHeight);
    }

    createCorridor(startX, endX, roomY, corridorHeight) {
        const corridorY = Math.floor((this.rows - corridorHeight) / 2);

        // Draw corridor walls
        for (let x = startX; x < endX; x++) {
            this.walls[x + corridorY * this.cols] = 1;                    // Top wall
            this.walls[x + (corridorY + corridorHeight) * this.cols] = 1; // Bottom wall
        }

        // Create openings
        for (let j = corridorY + 1; j < corridorY + corridorHeight; j++) {
            this.walls[startX + j * this.cols] = 0;  // Left room opening
            this.walls[endX + j * this.cols] = 0;    // Right room opening
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
        return this.walls[i + j * this.cols] === 1;
    }

    getWalls() {
        return this.walls;
    }
} 