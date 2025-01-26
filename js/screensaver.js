var canvas;
var gl;

var aspectratio = 1; 
var scene = [];
const first_time = performance.now();

const RESOLUTION_DIVIDER = 1;
const grid_separation = 0.1;
const radius = 0.01;
const length = 0.1;
const circle_resolution = 8;
const circle_strand_amount = 25;
const initial_offset = 0.005;
const min_length = 0.35;
const speed = 10; // Higher -> lower speed

const vertex_shader_code = `
    precision mediump float;

    attribute vec2 vertex_position;
    attribute vec3 vertex_color;
    uniform float u_aspect_ratio;

    varying vec3 fragment_color;
    
    void main() {
        fragment_color = vertex_color;
        vec2 position = vertex_position;
        position.x = position.x * u_aspect_ratio;
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragment_shader_code = `
    precision mediump float;
    
    varying vec3 fragment_color;
    
    void main() {
        gl_FragColor = vec4(fragment_color, 1.0);

    }
`

function setError (message) {
    document.getElementById('error').innerText = message;
}

function resized () {
    width = window.outerWidth;
    height = window.outerHeight;

    // Set actual canvas size to scaled down resolution
    canvas.width = width / RESOLUTION_DIVIDER;
    canvas.height = height / RESOLUTION_DIVIDER;
    
    // Set display size to full resolution
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    gl.viewport(0, 0, canvas.width, canvas.height);

    aspectratio = canvas.width / canvas.height;
}

function createCircle (radius, segments, centerx, centery) {
    var circle = [];
    var step = (2 * Math.PI) / segments;
    for (var i = 0; i < segments; i++) {
        var angle = step * i;
        circle.push(
            centerx + radius * Math.cos(angle), 
            centery + radius * Math.sin(angle));
        circle.push(
            centerx + radius * Math.cos(angle + step), 
            centery + radius * Math.sin(angle + step));
        circle.push(centerx, centery);
    }

    return [circle, segments * 3];
}

function createScene () {
    scene = [];
    for (let x = - 1 * aspectratio; x < 1 * aspectratio; x += grid_separation) {
        for (let y = -1; y < 1; y += grid_separation) {
            let newnode = new Node(x, y, false, 'circle');
            scene.push(newnode);
            let children = newnode.createChildren();
            children.forEach(child => {
                scene.push(child);
            });
        }
    }
}

const diff = (a, b, threshold) => {
    let distance = Math.abs(a - b);
    return Math.max(0, Math.min(1, 1 - (distance / threshold)));
};

class Node {
    constructor (x, y, is_child, type) {
        this.x = x;
        this.y = y;
        this.type = type == 'circle' ? 0 : 1;
        this.verts = 0;
        this.children = [];
        this.is_child = is_child;
        this.layer = 0;

        this.strandlength = 0;
        this.strandAngle = 0;
    }

    setLayer (layer) {this.layer = layer;}

    getColor (time) {
        let shade = this.layer/circle_strand_amount;
        
        const hue_shift = 0.2; // Rotating hue over time
        

        let time_start = Math.min(1, Math.abs(time - first_time) / 2000);
        let col_per_length = Math.max(0, Math.min(1, this.strandlength * 3));
        let col = shade * col_per_length * time_start; // time_start will go from 0 to 1 over 2 seconds

        let r = col * diff(this.strandAngle, 0, Math.PI / 2);
        let b = col * (1 - Math.max(0, Math.min(1, this.strandlength * 3)));
        let g = col * diff(this.strandAngle, Math.PI, Math.PI / 2);

        return [r, g, b];
    }

    createChildren () {
        
        for (let i = 0; i < circle_strand_amount; i++) {
            let new_node = new Node (this.x + i * initial_offset, this.y + i * initial_offset, true, 'circle'); 
            new_node.setLayer(i);
            this.children.push(new_node);
        }
        return this.children;
    }

    updatePositions (time) {
        if (this.is_child) return;

        noise.seed(50);
        let angle = noise.perlin2(this.x + time/speed, this.y + time/speed) * 2 * Math.PI;
        noise.seed(150);
        let length = Math.abs(0.01 + (min_length * noise.perlin2((this.x + time/speed)/4, (this.y + time/speed)/4)));
        
        let endx = this.x + (Math.sin(angle) * length);
        let endy = this.y + (Math.cos(angle) * length);
        
        let vector = [(endx - this.x) / circle_strand_amount, (endy - this.y) / circle_strand_amount];
        for (let i = 1; i <= circle_strand_amount; i++) {
            this.children[i - 1].x = this.x + vector[0] * i;
            this.children[i - 1].y = this.y + vector[1] * i;
            this.children[i - 1].strandlength = length; 
            this.children[i - 1].strandAngle = angle; 
        }

        this.strandlength = length;
        this.strandAngle = angle;
    }
}

function startAnimation () {
    console.log('Starting animation...');

    canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl');

    // Old browser webgl check
    if (!gl) {
        gl = canvas.getContext('experimental-webgl');
    }

    if (!gl) {
        setError('WebGL not supported');
        return;
    }

    // Change canvas resoltion
    resized ();
    createScene ();

    // Draw background
    gl.clearColor(0, 0, 0, 1.0); // Black (RGBA)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // Clear the color buffer & depth buffer

    // Bind vertex shader
    var vertex_shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertex_shader, vertex_shader_code);
    gl.compileShader(vertex_shader);
    if (!gl.getShaderParameter(vertex_shader, gl.COMPILE_STATUS)) { // Check for compilation errors
        console.error('Vertex shader error: ' + gl.getShaderInfoLog(vertex_shader));
        return;
    }
    
    // Bind fragment shader
    var fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragment_shader, fragment_shader_code);
    gl.compileShader(fragment_shader);
    if (!gl.getShaderParameter(fragment_shader, gl.COMPILE_STATUS)) { // Check for compilation errors
        console.error('Fragment shader error: ' + gl.getShaderInfoLog(fragment_shader));
        return;
    }

    // Create program
    var program = gl.createProgram();

    // Attach shaders to the program
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);

    // Link program to the context
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { // Check for errors
        console.error('Program linking error: ' + gl.getProgramInfoLog(program));
        return;
    }
    // Only for debugging, additional check
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) { // Check for errors
        console.error('Program validation error: ' + gl.getProgramInfoLog(program));
        return;
    }

    var last_time = performance.now();
    const loop = () => {

        var time = performance.now() / 1000;

        scene.forEach(node => {
            if (node.is_child) return;
            node.updatePositions(time);
        });
    

        //  --------------------------------------------------------
        // VERTEX BUFFER
        //  --------------------------------------------------------

        // X, Y Vertex positions ; RBG color [0 - 1]
        var vertex_positions = [];
        var amount_verts = 0;
        for (let i = 0; i < scene.length; i++) {
            let [s_circle, s_amount_verts] = createCircle(radius, circle_resolution, scene[i].x, scene[i].y); 
            s_circle.forEach(vertex_pos => {
                vertex_positions.push(vertex_pos);
            });
            scene[i].verts = s_amount_verts;
            amount_verts += s_amount_verts;
        }

        var vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); // Bind buffer to the context
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_positions), gl.STATIC_DRAW); // Fill buffer with data

        // After vertex buffer creation, add color buffer creation
        var color_buffer = gl.createBuffer();

        var position_attribute_location = gl.getAttribLocation(program, 'vertex_position'); // Gets location of the vertex_position attribute in the shader
        gl.vertexAttribPointer(
            position_attribute_location, // Attribute location
            2, // Number of elements per vertex (vec2 = 2)
            gl.FLOAT, // Type of elements, 32 bit float
            gl.FALSE, // Normalized data
            2 * Float32Array.BYTES_PER_ELEMENT, // Only position data, no interleaving
            0 // Offset from the beginning of a single vertex to this attribute, no offset in this case
        );
        gl.enableVertexAttribArray(position_attribute_location); // Enable the attribute

        // Color buffer setup
        gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);

        var colors = new Float32Array(amount_verts * 3); // 3 components per color (RGB)
        let colorIndex = 0;
        for (let i = 0; i < scene.length; i++) { // For each node in scene
            let currentNode = scene[i];
            let [rn, gn, bn] = currentNode.getColor(performance.now());
            for (let j = 0; j < currentNode.verts; j++) { // For each vertex in node
                colors[colorIndex++] = rn;
                colors[colorIndex++] = gn;
                colors[colorIndex++] = bn;
            }
        }
            
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

        var color_attribute_location = gl.getAttribLocation(program, 'vertex_color');
        gl.vertexAttribPointer(
            color_attribute_location,
            3,
            gl.FLOAT,
            gl.FALSE,
            3 * Float32Array.BYTES_PER_ELEMENT, // 3 components per color
            0
        );
        gl.enableVertexAttribArray(color_attribute_location);
        
        //  --------------------------------------------------------
        // RENDER LOOP
        // --------------------------------------------------------
        
        gl.useProgram(program); // Use the program

        // Set aspect ratio in shader
        var aspectUniformLocation = gl.getUniformLocation(program, 'u_aspect_ratio');
        gl.uniform1f(aspectUniformLocation, 1.0 / aspectratio); // Inverse because we want to compress the x axis

        /*
        var last_time = performance.now();
        function animation_loop () {
            var time = performance.now() / 1000;

            // Draw background
            gl.clearColor(0, 0, 0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // bind circle's vertex buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

            // Redraw circle
            gl.drawArrays(gl.TRIANGLES, 0, amount_verts);
            last_time = calcFps(last_time);
            
            // New frame req
            requestAnimationFrame(animation_loop);
        }
        requestAnimationFrame(animation_loop); */

        last_time = calcFps(last_time);
        // Draw background
        gl.clearColor(0, 0, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Redraw circle
        gl.drawArrays(gl.TRIANGLES, 0, amount_verts);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

function calcFps (last_time) {
    var fps = 1000 / (performance.now() - last_time);
    last_time = performance.now();
    document.getElementById('fps-counter').innerText = 'FPS: ' + fps.toFixed(2);
    return last_time;
}

function debounce(func, wait) { // Wait in miliseconds before executing
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.addEventListener('resize', debounce(startAnimation, 1000)); // Wait 1 second before redrawing after resize, to avoid overload