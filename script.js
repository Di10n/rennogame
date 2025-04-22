document.addEventListener('DOMContentLoaded', () => {
    // Canvas setup
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const gridSize = 17; // Exactly 17x17 grid
    
    // Set canvas dimensions to match exactly 17 grid cells
    function resizeCanvas() {
        // Get the computed width of the canvas element
        const displayWidth = canvas.clientWidth;
        
        // Calculate cell size based on available width
        const cellSize = Math.floor(displayWidth / gridSize);
        
        // Set canvas dimensions to exactly fit 17x17 cells (no extra space)
        canvas.width = cellSize * gridSize;
        canvas.height = cellSize * gridSize;
        
        return cellSize;
    }
    
    // Call resize once at the start and get initial cell size
    let cellSize = resizeCanvas();
    
    // Animation constants
    const FPS = 60;
    const MOVE_DURATION = 1000 / 7; // Time to move one cell in ms (7 cells per second)
    
    // Load game images and make sure they're ready before drawing
    const petreaImg = new Image();
    petreaImg.src = 'petreas.png';
    
    const rennoImg = new Image();
    rennoImg.src = 'renno.png';
    
    // Make sure images are loaded before initial draw
    let imagesLoaded = 0;
    const totalImages = 2;
    
    function imageLoaded() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            // Both images loaded, now safe to draw
            placeFood(true);
            // Set initial rotation to 0 degrees for the starting screen
            currentRotation = 0;
            draw();
        }
    }
    
    petreaImg.onload = imageLoaded;
    rennoImg.onload = imageLoaded;
    
    // Game state
    let snake = [
        { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) }
    ];
    let food = {};
    let direction = 'up';
    let nextDirection = 'up';
    let lastDirection = 'up';
    let animationProgress = 0; // 0 to 1 for smooth animation
    let lastFrameTime = 0;
    let moveTimer = 0;
    let score = 0;
    let highScore = localStorage.getItem('snakeHighScore') || 0;
    let gameActive = false;
    let gameLoop;
    let inputQueue = [];
    let previousGamePlayed = false; // Track if a game has been played
    let currentRotation = 0; // Current rotation angle of the snake head
    let cooldownActive = false; // Cooldown flag after dying
    let cooldownTimer = 0; // Timer for cooldown period
    const COOLDOWN_DURATION = 500; // 0.5 seconds in milliseconds
    
    // Game state variables
    let hasInteracted = false;
    
    // Track positions for smooth animation
    let prevPositions = [];
    let nextPositions = [];

    // DOM elements
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('highScore');
    const startButton = document.getElementById('start');
    const upButton = document.getElementById('up');
    const leftButton = document.getElementById('left');
    const rightButton = document.getElementById('right');
    const downButton = document.getElementById('down');

    // Update high score display
    highScoreElement.textContent = highScore;
    
    // Set initial button text based on device
    updateStartButtonText();

    // Random food placement
    function placeFood(forceNew = true) {
        // If we already have food and don't want to force new placement, skip
        if (!forceNew && food.x !== undefined && food.y !== undefined) {
            return;
        }
        
        let valid = false;
        while (!valid) {
            food = {
                x: Math.floor(Math.random() * gridSize),
                y: Math.floor(Math.random() * gridSize)
            };

            // Check if food is not on snake
            valid = true;
            for (let segment of snake) {
                if (segment.x === food.x && segment.y === food.y) {
                    valid = false;
                    break;
                }
            }
        }
    }

    // Draw game elements
    function draw() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid with alternating shades for better visibility
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                // Alternating pattern for grid cells
                if ((i + j) % 2 === 0) {
                    ctx.fillStyle = '#e0e0e0'; // Light gray
                } else {
                    ctx.fillStyle = '#d0d0d0'; // Slightly darker gray
                }
                
                // Fill the cell
                ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
            }
        }
        
        // Draw grid lines for better definition
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        
        // Draw grid lines
        for (let i = 0; i <= gridSize; i++) {
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, canvas.height);
            ctx.stroke();

            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(canvas.width, i * cellSize);
            ctx.stroke();
        }

        // Draw food (petreas.png) - 73.2% larger while maintaining center position
        try {
            const scaleFactor = 1.732; // 73.2% larger
            const originalSize = cellSize;
            const newSize = originalSize * scaleFactor;
            const offset = (newSize - originalSize) / 2; // To keep centered
            
            ctx.drawImage(
                petreaImg, 
                food.x * cellSize - offset, 
                food.y * cellSize - offset, 
                newSize, 
                newSize
            );
        } catch (e) {
            console.error("Error drawing food image:", e);
        }

        // Draw snake
        try {
            // First draw the snake body (all segments at once)
            drawSnakePath();
            
            // Then draw the head (if it exists)
            if (snake.length > 0) {
                // Calculate head position
                let xPos, yPos;
                const i = 0; // Head is at index 0
                
                if (gameActive) {
                    // Use animation for game in progress - safely access arrays
                    // These should exist for the head, but just in case, add a safety check
                    const prev = (prevPositions.length > 0) ? prevPositions[0] : snake[0];
                    const next = (nextPositions.length > 0) ? nextPositions[0] : snake[0];
                    
                    // Simple linear interpolation for animation
                    const dx = next.x - prev.x;
                    const dy = next.y - prev.y;
                    
                    // Handle edge wrapping for animation
                    if (Math.abs(dx) > 1) {
                        if (dx > 0) { // Right to left
                            xPos = ((prev.x + (dx - gridSize) * animationProgress) * cellSize + gridSize * cellSize) % (gridSize * cellSize);
                        } else { // Left to right
                            xPos = ((prev.x + (dx + gridSize) * animationProgress) * cellSize + gridSize * cellSize) % (gridSize * cellSize);
                        }
                    } else {
                        xPos = (prev.x + dx * animationProgress) * cellSize;
                    }
                    
                    if (Math.abs(dy) > 1) {
                        if (dy > 0) { // Bottom to top
                            yPos = ((prev.y + (dy - gridSize) * animationProgress) * cellSize + gridSize * cellSize) % (gridSize * cellSize);
                        } else { // Top to bottom
                            yPos = ((prev.y + (dy + gridSize) * animationProgress) * cellSize + gridSize * cellSize) % (gridSize * cellSize);
                        }
                    } else {
                        yPos = (prev.y + dy * animationProgress) * cellSize;
                    }
                } else {
                    // Static positions for when game is not active
                    xPos = snake[i].x * cellSize;
                    yPos = snake[i].y * cellSize;
                }
                
                // Draw head using renno.png - 73.2% larger while maintaining center position
                const scaleFactor = 1.732; // 73.2% larger
                const originalSize = cellSize - 1;
                const newSize = originalSize * scaleFactor;
                const offset = (newSize - originalSize) / 2; // To keep centered
                
                // Save the current context state
                ctx.save();
                
                // Translate to the center of where the image will be
                ctx.translate(xPos + (originalSize/2), yPos + (originalSize/2));
                
                // Determine the target rotation angle based on direction
                let targetRotation = 0;
                
                if (gameActive) {
                    // During gameplay, use the rotations from the previous edit
                    switch(direction) {
                        case 'up':
                            targetRotation = 0; // 0 degrees
                            break;
                        case 'right':
                            targetRotation = Math.PI/2; // 90 degrees
                            break;
                        case 'down':
                            targetRotation = Math.PI; // 180 degrees
                            break;
                        case 'left':
                            targetRotation = -Math.PI/2; // -90 degrees
                            break;
                    }
                } else {
                    // Before the game starts, set to 0 degrees
                    targetRotation = 0; // 0 degrees
                }
                
                // Calculate the rotation angle with smoothing
                // If we're already in a game, use the current rotation as a starting point
                if (gameActive) {
                    // Handle special case of rotating between right (0) and left (PI)
                    if (Math.abs(targetRotation - currentRotation) > Math.PI) {
                        // Adjust for shortest path rotation
                        if (targetRotation > currentRotation) {
                            currentRotation += 2 * Math.PI;
                        } else {
                            targetRotation += 2 * Math.PI;
                        }
                    }
                    
                    // Smoothly interpolate between current and target rotation
                    currentRotation = currentRotation + (targetRotation - currentRotation) * Math.min(1, animationProgress * 3);
                    
                    // Normalize the angle to keep it within 0-2PI range
                    currentRotation = currentRotation % (2 * Math.PI);
                    if (currentRotation < 0) currentRotation += 2 * Math.PI;
                } else {
                    // If game isn't active, just use the target rotation
                    currentRotation = targetRotation;
                }
                
                ctx.rotate(currentRotation);
                
                // Draw the image centered at the origin (0,0 after translation)
                ctx.drawImage(
                    rennoImg, 
                    -newSize/2, 
                    -newSize/2, 
                    newSize, 
                    newSize
                );
                
                // Restore the context to its original state
                ctx.restore();
            }
        } catch (e) {
            console.error("Error drawing snake:", e);
        }
    }

    // Helper function to draw rounded rectangles
    function drawRoundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
    
    // Helper function to determine direction between two points
    function getDirection(x1, y1, x2, y2) {
        // Handle wrap-around cases for grid boundaries
        let dx = x2 - x1;
        let dy = y2 - y1;
        
        // Check for grid wrap-around and adjust the direction
        if (Math.abs(dx) > 1) {
            dx = (dx > 0) ? -1 : 1; // Wrapped around the grid
        }
        
        if (Math.abs(dy) > 1) {
            dy = (dy > 0) ? -1 : 1; // Wrapped around the grid
        }
        
        // Return the primary direction
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }
    
    // Draw all snake body segments at once as a continuous path
    function drawSnakePath() {
        if (snake.length <= 1) return; // Only head
        
        // Use a consistent width for the snake body (same as Google's snake game)
        const bodyWidth = cellSize * 0.85;
        
        // Start a new path for the entire snake body
        ctx.beginPath();
        ctx.fillStyle = '#3D9970'; // Dark green for body
        
        // Draw each segment based on its position in the snake
        for (let i = 1; i < snake.length; i++) {
            // Safely access animation arrays to prevent "undefined" errors
            // that could happen when snake grows
            const safeGetPrev = (idx) => {
                // If index is out of bounds, use the last valid entry
                if (idx >= prevPositions.length) {
                    return prevPositions[prevPositions.length - 1] || snake[snake.length - 1];
                }
                return prevPositions[idx] || snake[idx];
            };
            
            const safeGetNext = (idx) => {
                // If index is out of bounds, use the last valid entry
                if (idx >= nextPositions.length) {
                    return nextPositions[nextPositions.length - 1] || snake[snake.length - 1];
                }
                return nextPositions[idx] || snake[idx];
            };
            
            // Get current, previous and next segments for connections
            const current = gameActive ? 
                {x: safeGetPrev(i).x + (safeGetNext(i).x - safeGetPrev(i).x) * animationProgress,
                 y: safeGetPrev(i).y + (safeGetNext(i).y - safeGetPrev(i).y) * animationProgress} : 
                snake[i];
                
            const prev = gameActive ? 
                {x: safeGetPrev(i-1).x + (safeGetNext(i-1).x - safeGetPrev(i-1).x) * animationProgress,
                 y: safeGetPrev(i-1).y + (safeGetNext(i-1).y - safeGetPrev(i-1).y) * animationProgress} : 
                snake[i-1];
                
            const next = i < snake.length - 1 ? (gameActive ? 
                {x: safeGetPrev(i+1).x + (safeGetNext(i+1).x - safeGetPrev(i+1).x) * animationProgress,
                 y: safeGetPrev(i+1).y + (safeGetNext(i+1).y - safeGetPrev(i+1).y) * animationProgress} : 
                snake[i+1]) : null;
                
            // Convert grid positions to pixel coordinates
            const currentX = current.x * cellSize;
            const currentY = current.y * cellSize;
            const prevX = prev.x * cellSize;
            const prevY = prev.y * cellSize;
            const nextX = next ? next.x * cellSize : null;
            const nextY = next ? next.y * cellSize : null;
            
            // Draw rectangle connecting this segment to previous and next
            // For Google-style snake, we use rounded rectangles that overlap
            drawSnakeSegment(currentX, currentY, prevX, prevY, nextX, nextY, bodyWidth, i === snake.length - 1);
        }
    }
    
    // Draw a segment that connects to adjacent segments
    function drawConnectedSegment(x, y, width, height, fromDir, toDir) {
        // This function is replaced by drawSnakePath for full body drawing
        drawRoundedRect(x, y, width, height, 5);
    }
    
    // Draw a tail segment that connects only to the previous segment
    function drawTailSegment(x, y, width, height, fromDir) {
        // This function is replaced by drawSnakePath for full body drawing
        drawRoundedRect(x, y, width, height, 5);
    }
    
    // Helper function to draw a single snake segment as part of the path
    function drawSnakeSegment(currentX, currentY, prevX, prevY, nextX, nextY, width, isTail) {
        const halfWidth = width / 2;
        
        // Center points of each cell
        const currentCenterX = currentX + cellSize / 2;
        const currentCenterY = currentY + cellSize / 2;
        
        const prevCenterX = prevX + cellSize / 2;
        const prevCenterY = prevY + cellSize / 2;
        
        // Direction vectors
        const toPrevX = prevCenterX - currentCenterX;
        const toPrevY = prevCenterY - currentCenterY;
        
        // Calculate connection direction
        let angle = Math.atan2(toPrevY, toPrevX);
        
        // Draw a circle for the current segment
        ctx.beginPath();
        ctx.arc(currentCenterX, currentCenterY, halfWidth, 0, Math.PI * 2);
        ctx.fill();
        
        // Connect to previous segment
        ctx.beginPath();
        ctx.moveTo(
            currentCenterX + Math.cos(angle + Math.PI/2) * halfWidth,
            currentCenterY + Math.sin(angle + Math.PI/2) * halfWidth
        );
        ctx.lineTo(
            prevCenterX + Math.cos(angle + Math.PI/2) * halfWidth,
            prevCenterY + Math.sin(angle + Math.PI/2) * halfWidth
        );
        ctx.lineTo(
            prevCenterX + Math.cos(angle - Math.PI/2) * halfWidth,
            prevCenterY + Math.sin(angle - Math.PI/2) * halfWidth
        );
        ctx.lineTo(
            currentCenterX + Math.cos(angle - Math.PI/2) * halfWidth,
            currentCenterY + Math.sin(angle - Math.PI/2) * halfWidth
        );
        ctx.closePath();
        ctx.fill();
        
        // Connect to next segment if not the tail
        if (!isTail && nextX !== null && nextY !== null) {
            const nextCenterX = nextX + cellSize / 2;
            const nextCenterY = nextY + cellSize / 2;
            
            const toNextX = nextCenterX - currentCenterX;
            const toNextY = nextCenterY - currentCenterY;
            
            angle = Math.atan2(toNextY, toNextX);
            
            ctx.beginPath();
            ctx.moveTo(
                currentCenterX + Math.cos(angle + Math.PI/2) * halfWidth,
                currentCenterY + Math.sin(angle + Math.PI/2) * halfWidth
            );
            ctx.lineTo(
                nextCenterX + Math.cos(angle + Math.PI/2) * halfWidth,
                nextCenterY + Math.sin(angle + Math.PI/2) * halfWidth
            );
            ctx.lineTo(
                nextCenterX + Math.cos(angle - Math.PI/2) * halfWidth,
                nextCenterY + Math.sin(angle - Math.PI/2) * halfWidth
            );
            ctx.lineTo(
                currentCenterX + Math.cos(angle - Math.PI/2) * halfWidth,
                currentCenterY + Math.sin(angle - Math.PI/2) * halfWidth
            );
            ctx.closePath();
            ctx.fill();
        }
    }

    // Game loop with animation
    function gameUpdate(currentTime) {
        if (!lastFrameTime) lastFrameTime = currentTime;
        
        // Calculate elapsed time
        const elapsed = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
        // Update our movement timer
        moveTimer += elapsed;
        
        // Calculate animation progress as a fraction of MOVE_DURATION
        // This ensures it's exactly MOVE_DURATION per cell
        animationProgress = Math.min(moveTimer / MOVE_DURATION, 1);
        
        // If animation is complete, update game state
        if (moveTimer >= MOVE_DURATION) {
            // Save last direction for animation smoothing
            lastDirection = direction;
            
            // Store current positions as previous
            prevPositions = snake.map(segment => ({...segment}));
            
            // Process input queue
            if (inputQueue.length > 0) {
                // Use the most recent input from the queue
                const input = inputQueue.shift();
                
                // Check if it's a valid direction change (not opposite)
                if ((input === 'up' && direction !== 'down') ||
                    (input === 'down' && direction !== 'up') ||
                    (input === 'left' && direction !== 'right') ||
                    (input === 'right' && direction !== 'left')) {
                        
                    nextDirection = input;
                }
            }
            
            // Apply the next direction
            direction = nextDirection;

            // Create new head position based on direction
            const head = { ...snake[0] };
            switch (direction) {
                case 'up':
                    head.y -= 1;
                    break;
                case 'down':
                    head.y += 1;
                    break;
                case 'left':
                    head.x -= 1;
                    break;
                case 'right':
                    head.x += 1;
                    break;
            }

            // Check for wall collision - now game over instead of wrap around
            if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
                gameOver();
                return;
            }

            // Check for self collision
            for (let i = 1; i < snake.length; i++) {
                if (snake[i].x === head.x && snake[i].y === head.y) {
                    gameOver();
                    return;
                }
            }

            // Add new head
            snake.unshift(head);

            // Check for food collision
            if (head.x === food.x && head.y === food.y) {
                // Increase score (1 point per apple)
                score += 1;
                scoreElement.textContent = score;

                // Update high score if needed
                if (score > highScore) {
                    highScore = score;
                    highScoreElement.textContent = highScore;
                    localStorage.setItem('snakeHighScore', highScore);
                }
                
                // No speed increase to match Google's snake behavior
                // (Google snake maintains constant speed regardless of score)

                // IMPORTANT: When growing, we need to properly update the animation arrays
                // We'll add the last segment position to both prev and next positions
                // to ensure smooth animation during growth
                const lastSegmentPos = {...snake[snake.length - 1]};
                
                // Store the new target positions with the duplicate last segment
                // This prevents blinking by ensuring position arrays have the right number of elements
                nextPositions = snake.map(segment => ({...segment}));
                nextPositions.push({...lastSegmentPos}); // Add duplicate of last segment
                
                // Place new food (always force new placement when eating)
                placeFood(true);
            } else {
                // Remove tail if no food eaten
                snake.pop();
                
                // Store the new target positions (normal case, not growing)
                nextPositions = snake.map(segment => ({...segment}));
            }
            
            // Reset timer for next movement
            moveTimer = 0;
            animationProgress = 0;
        }
        
        // Use the main draw function for consistency
        draw();
        
        // Continue game loop if active
        if (gameActive) {
            requestAnimationFrame(gameUpdate);
        }
    }


    // Start game animation loop
    function startGameLoop() {
        if (gameActive) {
            lastFrameTime = 0;
            animationProgress = 0;
            moveTimer = 0;
            requestAnimationFrame(gameUpdate);
        }
    }

    // Helper function to detect if running on a mobile device
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }
    
    
    // Update button text based on device type
    function updateStartButtonText() {
        if (isMobileDevice()) {
            startButton.textContent = gameActive ? 'Restart Game' : 'Start Game (or swipe in any direction)';
        } else {
            startButton.textContent = gameActive ? 'Restart Game' : 'Start Game (or press any arrow key)';
        }
    }
    
    // Game over function
    function gameOver() {
        gameActive = false;
        
        // Different text for mobile and desktop
        if (isMobileDevice()) {
            startButton.textContent = 'Restart Game (or swipe in any direction)';
        } else {
            startButton.textContent = 'Restart Game (or press any arrow key)';
        }

        // Set cooldown after dying
        cooldownActive = true;
        cooldownTimer = 0;
        
        // Animate the cooldown with requestAnimationFrame
        requestAnimationFrame(updateCooldown);

        // Flash effect on game over
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Update cooldown timer
    function updateCooldown(timestamp) {
        if (!lastFrameTime) lastFrameTime = timestamp;
        
        // Calculate elapsed time
        const elapsed = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        
        // Update cooldown timer
        cooldownTimer += elapsed;
        
        // Check if cooldown is complete
        if (cooldownTimer >= COOLDOWN_DURATION) {
            cooldownActive = false;
            cooldownTimer = 0;
        } else {
            // Continue the cooldown animation
            requestAnimationFrame(updateCooldown);
        }
    }

    // Initialize or restart game
    function initGame(startDir = 'up') {
        // If cooldown is active, don't allow game to start
        if (cooldownActive) return;
        
        // Update canvas size if it has changed
        const newCellSize = resizeCanvas();
        if (newCellSize !== cellSize) {
            cellSize = newCellSize;
        }
        
        // Update button text based on device type
        updateStartButtonText();
        
        // Reset game state
        snake = [
            { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) }
        ];
        
        // Set initial direction based on parameter or default to up
        direction = startDir;
        nextDirection = startDir;
        lastDirection = startDir;
        
        // Reset the rotation angle to match the starting direction
        // Rotated 90 degrees clockwise from previous setup
        switch(startDir) {
            case 'up':
                currentRotation = 0; // 0 degrees (was -90)
                break;
            case 'right':
                currentRotation = Math.PI/2; // 90 degrees (was 0)
                break;
            case 'down':
                currentRotation = Math.PI; // 180 degrees (was 90)
                break;
            case 'left':
                currentRotation = -Math.PI/2; // -90 degrees (was 180)
                break;
        }
        
        // Reset cooldown state
        cooldownActive = false;
        cooldownTimer = 0;
        
        inputQueue = [];
        animationProgress = 0;
        lastFrameTime = 0;
        moveTimer = 0;
        score = 0;
        scoreElement.textContent = '0';
        gameActive = true;
        startButton.textContent = 'Restart Game';
        
        // Initialize position arrays with starting position
        prevPositions = snake.map(segment => ({...segment}));
        nextPositions = snake.map(segment => ({...segment}));

        // Check if the food is on the snake's start position
        let foodOnSnake = false;
        if (food.x === snake[0].x && food.y === snake[0].y) {
            foodOnSnake = true;
        }
        
        // Only generate new food if it would collide with the snake
        // This keeps the initial food in place when first starting the game
        if (foodOnSnake) {
            placeFood(true);
        }
        
        // Track that a game has been played
        previousGamePlayed = true;

        // Start game loop
        startGameLoop();
    }

    // Event listeners
    startButton.addEventListener('click', () => {
        // If cooldown is active, ignore button press
        if (cooldownActive) return;
        
        if (!gameActive) {
            initGame();
        } else {
            gameOver();
            initGame();
        }
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        // Check if it's an arrow key
        const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
        
        // If cooldown is active, ignore all inputs
        if (cooldownActive) return;
        
        // Determine direction from key press
        let dir = '';
        switch (e.key) {
            case 'ArrowUp':
                dir = 'up';
                e.preventDefault();
                break;
            case 'ArrowDown':
                dir = 'down';
                e.preventDefault();
                break;
            case 'ArrowLeft':
                dir = 'left';
                e.preventDefault();
                break;
            case 'ArrowRight':
                dir = 'right';
                e.preventDefault();
                break;
            default:
                return; // Not an arrow key
        }
        
        // If game is not active and an arrow key is pressed, start the game with that direction
        if (!gameActive && isArrowKey) {
            initGame(dir); // Pass the direction to initGame
            return;
        }
        
        // Regular controls when game is active
        if (!gameActive) return;

        // Add to input queue if not already the last input
        if (inputQueue.length === 0 || inputQueue[inputQueue.length - 1] !== dir) {
            inputQueue.push(dir);
            
            // Limit queue size to avoid memory issues
            if (inputQueue.length > 3) {
                inputQueue = inputQueue.slice(-3);
            }
        }
    });

    
    // Helper function for mobile controls
    function handleDirectionButton(dir) {
        // If cooldown is active, ignore all inputs
        if (cooldownActive) return;
        
        // If game is not active, start it with the specified direction
        if (!gameActive) {
            initGame(dir);
            return;
        }
        
        // Add to input queue if not already the last input (same as keyboard)
        if (inputQueue.length === 0 || inputQueue[inputQueue.length - 1] !== dir) {
            inputQueue.push(dir);
            
            // Limit queue size to avoid memory issues
            if (inputQueue.length > 3) {
                inputQueue = inputQueue.slice(-3);
            }
        }
    }

    // Mobile controls
    upButton.addEventListener('click', () => {
        handleDirectionButton('up');
    });

    downButton.addEventListener('click', () => {
        handleDirectionButton('down');
    });

    leftButton.addEventListener('click', () => {
        handleDirectionButton('left');
    });

    rightButton.addEventListener('click', () => {
        handleDirectionButton('right');
    });

    // Initial food placement will happen in the imageLoaded function
    // If images load instantly from cache, trigger the draw manually
    if (petreaImg.complete && rennoImg.complete && imagesLoaded < totalImages) {
        placeFood(true);
        // Set initial rotation to 0 degrees for the starting screen
        currentRotation = 0;
        draw();
    }
    
    // Add window resize handler to keep the game responsive
    window.addEventListener('resize', () => {
        // Only resize if the game isn't active to avoid disruption during play
        if (!gameActive) {
            const newCellSize = resizeCanvas();
            // Always redraw to ensure proper grid display
            cellSize = newCellSize;
            draw();
        }
    });
    
    // Touch swipe controls for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    // Minimum distance for a swipe to be registered
    const minSwipeDistance = 30;
    
    // Set up touch event listeners on the entire document
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, false);
    
    document.addEventListener('touchend', (e) => {
        // If cooldown is active, ignore touch inputs
        if (cooldownActive) return;
        
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        
        handleSwipe();
    }, false);
    
    // Prevent scrolling when touching the game container
    document.querySelector('.game-container').addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    function handleSwipe() {
        // Calculate horizontal and vertical distance
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Check if the swipe distance meets the minimum threshold
        if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
            return; // Not a swipe, just a tap
        }
        
        // Determine the direction of the swipe
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 0) {
                handleDirectionButton('right');
            } else {
                handleDirectionButton('left');
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                handleDirectionButton('down');
            } else {
                handleDirectionButton('up');
            }
        }
    }
});