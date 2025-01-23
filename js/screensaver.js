const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // ANTI ALIASING
var width, height;
var scene = [];

var max = 0;

const FPS = 30;
const FRAME_INTERVAL = 1000 / FPS;
let lastFrameTime = 0;

// Add at the top with other constants
const QUALITY_DIVIDER = 1; // Divide resolution by 2 (half resolution)

function round(value) {
    return Math.round(value * 1000) / 1000;
}

/*
    fac values [0 - 1], determines the blend factor
    between the two values A, B
*/
function blend (A, B, fac) {
    return A * (1 - fac) + B * fac
}

class obj {
    constructor (radius_end, radius_start, ind, x, y) {
        this.radius_start = radius_start;
        this.radius_end = radius_end;
        this.ind = ind;
        this.x = x;
        this.y = y;
    }

    draw (time) {
        //const length = 145;
        const divider = 500;
        
        var length = 50 + (noise.perlin2(this.x * Math.sin(time + 12.4) / divider, this.y * Math.cos(time) / divider) * 100);
        const angle = noise.perlin2(this.x * Math.sin(time) / divider, this.y * Math.sin(time + 40) / divider) * Math.PI * 2;
        
        let endx = this.x + Math.cos(angle) * length;
        let endy = this.y + Math.sin(angle) * length;

        // Apply darkness based on length
        let totalLength = Math.sqrt((endx - this.x) * (endx - this.x) + (endy - this.y) * (endy - this.y));
        // Length of the strand
        let dist = Math.max(0, Math.min(1, totalLength / 50)); // 200 is the threshold for turning black

        // The 2 that multiplies res. is the number of pixels per distance, more = smoother
        const resolution = (1 / totalLength) * 2; 
        let first = false;
        for (let i = 0; i < 1 || !first; i += resolution) {
            first = true;
            if (first && i >= 1) i = 1;
            let x = round(this.x + (endx - this.x) * i);
            let y = round(this.y + (endy - this.y) * i);
            let radius = round(this.radius_start * i + this.radius_end * (1 - i));
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    
            var colStart = [0, 0, 0]
            var colEnd = [255, 255, 255]

            // Distance color
            let r = blend(colStart[0], colEnd[0], i);
            let g = blend(colStart[1], colEnd[1], i);
            let b = blend(colStart[2], colEnd[2], i);
        
            r = blend(0, r, dist);
            g = blend(0, g, dist);
            b = blend(0, b, dist);
            
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`; 
            ctx.fill();
        }
    }
}

function createScene () {
    const spacing = 45;
    const circle_diameter = 10;

    var objects = [];

    var ind = 0;
    for (let x = 0 - spacing - circle_diameter; x < width + spacing + circle_diameter; x += spacing) {
        for (let y = 0 - spacing - circle_diameter; y < width + spacing + circle_diameter; y += spacing) {

            const circle = new obj(circle_diameter / 2, (circle_diameter / 2)  + 1, ind, x, y);
            objects.push(circle);
            ind ++;
        }
    }

    return objects;
}

function drawFrame () {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const time = Date.now() / 15000;
    scene.forEach(circle => {
        circle.draw(time);
    });
    console.log(max);
}

function window_scaled () {
    console.log('Resized');

    width = window.outerWidth;
    height = window.outerHeight;

    // Set actual canvas size to scaled down resolution
    canvas.width = width / QUALITY_DIVIDER;
    canvas.height = height / QUALITY_DIVIDER;
    
    // Set display size to full resolution
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    

    scene = []
    scene = createScene();
    drawFrame();
}
window_scaled();
window.addEventListener('resize', window_scaled);

function animate(currentTime) {
    requestAnimationFrame(animate);
    
    const deltaTime = currentTime - lastFrameTime;

    if (deltaTime >= FRAME_INTERVAL) {
        lastFrameTime = currentTime - (deltaTime % FRAME_INTERVAL);
        drawFrame();
    }
}
requestAnimationFrame(animate);
