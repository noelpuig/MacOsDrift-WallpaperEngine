var canvas;
var gl;

var aspectratio = 1; 
var scene = [];
const time_offset = Math.random() * 1000000000;
const first_time = performance.now() + time_offset;

const RESOLUTION_DIVIDER = 1;
const grid_size = 20;
const grid_separation = 1 / grid_size;
const geometry_radius = 0.1;
const circle_radius = 0.002;
const length = 0.1;
const circle_resolution = 3;
const circle_strand_amount = 30;
const initial_offset = 0.005;
const max_length = 0.4;
const speed = 10; // Higher -> lower speed

var running_animation_id = 0;

const noise0 = new NoiseFactory();
const noise1 = new NoiseFactory();
const noise2 = new NoiseFactory();
const noise3 = new NoiseFactory();

// Initialize with different seeds
noise0.seed(50);
noise1.seed(150);
noise2.seed(250);
noise3.seed(350);

const vertex_shader_code = `
    precision mediump float;

    attribute vec2 vertex_position;
    attribute vec4 vertex_color;
    attribute vec2 v_center;
    uniform float u_aspect_ratio;

    varying vec4 fragment_color;
    varying vec2 frag_pos;
    varying vec2 v_frag_center;

    void main() {
        fragment_color = vertex_color;
        v_frag_center = v_center;

        // Keep frag_pos unscaled for correct circle shape
        frag_pos = vertex_position;

        // Only scale x for on-screen positioning
        gl_Position = vec4(vertex_position.x * u_aspect_ratio, vertex_position.y, 0.0, 1.0);
    }
`;

const fragment_shader_code = `
    precision mediump float;

    varying vec4 fragment_color;
    varying vec2 frag_pos;

    varying vec2 v_frag_center;

    void main() {
        float dist = distance(frag_pos, v_frag_center);

        float circle_radius = 0.005;
        float smoothWidth = 0.001;
        float alpha = 1.0 - smoothstep(circle_radius - smoothWidth, circle_radius, dist);

        if (alpha < 0.05) discard;

        gl_FragColor = fragment_color;
    }
`;

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

function createGeometry (geometry_radius, segments, centerx, centery) {
    /*
    Square geometry:
        +-------+
        |\      |
        | \     |
        |  \    |
        |   \   |
        |    \  |
        |     \ |
        +------+ 
    */
    var geometry = [
        // Triangle 1
        centerx + geometry_radius,
        centery + geometry_radius, // +, +
        centerx - geometry_radius, 
        centery + geometry_radius, // -, +
        centerx + geometry_radius,
        centery - geometry_radius, // +, -
        // Triangle 2
        centerx - geometry_radius,
        centery + geometry_radius, // -, +
        centerx - geometry_radius,
        centery - geometry_radius, // -, -
        centerx + geometry_radius,
        centery - geometry_radius // +, -
    ]

    return [geometry, 6];
}

function createScene () {
    scene = [];
    const extra = grid_separation; // Space for extra nodes over the borders
    for (let x = (- 1 - extra) * aspectratio; x < (1 + extra) * aspectratio; x += grid_separation) {
        for (let y = -1 - extra; y < 1 + extra; y += grid_separation) {
            let newnode = new Node(x, y, false, 'circle');
            scene.push(newnode);
            let children = newnode.createChildren();
            children.forEach(child => {
                scene.push(child);
            });
        }
    }
}

function moveGeometry(vertex_positions, scene) {
    let vertexIndex = 0;
    for (let j = 0; j < scene.length; j++) {
        // Triangle 1
        vertex_positions[vertexIndex++] = scene[j].x + geometry_radius;
        vertex_positions[vertexIndex++] = scene[j].y + geometry_radius; // +, +
        vertex_positions[vertexIndex++] = scene[j].x - geometry_radius; 
        vertex_positions[vertexIndex++] = scene[j].y + geometry_radius; // -, +
        vertex_positions[vertexIndex++] = scene[j].x + geometry_radius;
        vertex_positions[vertexIndex++] = scene[j].y - geometry_radius; // +, -
        // Triangle 2
        vertex_positions[vertexIndex++] = scene[j].x - geometry_radius;
        vertex_positions[vertexIndex++] = scene[j].y + geometry_radius; // -, +
        vertex_positions[vertexIndex++] = scene[j].x - geometry_radius;
        vertex_positions[vertexIndex++] = scene[j].y - geometry_radius; // -, -
        vertex_positions[vertexIndex++] = scene[j].x + geometry_radius;
        vertex_positions[vertexIndex++] = scene[j].y - geometry_radius; // +, -
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
        this.angle_offset = 0;
        this.strandlength = 0;
        this.strandAngle = 0;
    }

    setLayer (layer) {this.layer = layer;}

    getColor (time) {
        let shade = this.layer/circle_strand_amount;
        
        let time_start = Math.min(1, Math.abs(time - first_time) / 2000);
        let col_per_length = Math.max(0, Math.min(1, this.strandlength * 3));
        let alpha = shade * col_per_length * time_start;
        alpha = Math.max(0, Math.min(1, alpha * 2.5));

        let r = alpha * diff(this.strandAngle, 0, Math.PI / 2);
        let b = alpha * (1 - Math.max(0, Math.min(1, this.strandlength * 3)));
        let g = alpha * diff(this.strandAngle, Math.PI, Math.PI / 2);

        const desat = 0.95;
        
        r = Math.max(0, r * desat);
        g = Math.max(0, g * desat);
        b = Math.max(0, b * desat);

        return [r, g * 1.1, b * 1.1, alpha];
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

        let posdivider = 1.6;
        // Use different noise instances instead of reseeding
        let angle = noise0.perlin2(this.x/posdivider + time/speed, this.y/posdivider + time/speed) * 2 * Math.PI;
        let length = 0.01 + (max_length * noise1.perlin2((this.x/posdivider + time/speed)/4, (this.y/posdivider + time/speed)/4));
        this.angle_offset += 0.001 * noise2.perlin2(this.x/posdivider + time/30, this.y/posdivider + time/30);

        let endx = this.x + (Math.sin(angle + this.angle_offset) * length);
        let endy = this.y + (Math.cos(angle + this.angle_offset) * length);
        
        let vector = [(endx - this.x) / circle_strand_amount, (endy - this.y) / circle_strand_amount];
        for (let i = 1; i <= circle_strand_amount; i++) {
            this.children[i - 1].x = this.x + vector[0] * i;
            this.children[i - 1].y = this.y + vector[1] * i;
            this.children[i - 1].strandlength = Math.abs(length); 
            this.children[i - 1].strandAngle = angle; 
        }

        this.strandlength = Math.abs(length);
        this.strandAngle = angle;
    }
}

function startAnimation () {
    console.log('Starting animation...');

    canvas = document.getElementById('canvas');
    
    // Disable alpha, antialias, preserveDrawingBuffer, desynchronized -> performance
    const contextAttributes = {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: false,
        desynchronized: false
    };
    
    gl = canvas.getContext('webgl', contextAttributes);

    // Old browser webgl check
    if (!gl) {
        gl = canvas.getContext('experimental-webgl', contextAttributes);
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

    // DEBUGGING
    /*
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
    */

    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Get the vertex ID extension
    const ext = gl.getExtension('OES_vertex_array_object');
    if (!ext) {
        console.warn('OES_vertex_array_object not supported');
    }

    // X, Y Vertex positions create circles
    var vertex_positions = [];
    var amount_verts = 0;

    // Keep a running start index
    for (let i = 0; i < scene.length; i++) {
        scene[i].vertStart = amount_verts; // New: track start index
        let [s_circle, s_amount_verts] = createGeometry(geometry_radius, circle_resolution, scene[i].x, scene[i].y);
        vertex_positions.push(...s_circle);
        scene[i].verts = s_amount_verts;
        amount_verts += s_amount_verts;
    }

    var last_time = performance.now() + time_offset;
    
    var center_positions = [];
    for (let i = 0; i < scene.length; i++) {
        for (let j = 0; j < 6; j++) center_positions.push(scene[i].x, scene[i].y);
    }

    running_animation_id++;
    let animation_id = running_animation_id;
    const loop = () => {
        if (animation_id != running_animation_id) return; // Stop multiple animations from running at the same time
        let real_time = performance.now();
        var time = (real_time + time_offset) / 1000;

        scene.forEach(node => {
            if (node.is_child) return;
            node.updatePositions(time);
        });
    
        // X, Y Vertex positions
        moveGeometry(vertex_positions, scene); 

        //  --------------------------------------------------------
        // VERTEX BUFFER
        //  --------------------------------------------------------

        var vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); // Bind buffer to the context
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_positions), gl.STATIC_DRAW); // Fill buffer with data
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

        for (let i = 0; i < scene.length; i++) {
            const baseIndex = i * (6 * 2); // 6 vertices, each needs 2 floats
            for (let j = 0; j < 6; j++) {
                center_positions[baseIndex + j * 2]     = scene[i].x;
                center_positions[baseIndex + j * 2 + 1] = scene[i].y;
            }
        }

        // Center buffer
        var v_center_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, v_center_buffer); // Bind buffer to the context
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(center_positions), gl.STATIC_DRAW); // Fill buffer with data
        var center_attribute_location = gl.getAttribLocation(program, 'v_center');

        gl.vertexAttribPointer(
            center_attribute_location, // Attribute location
            2, // Number of elements per vertex (vec2 = 2)
            gl.FLOAT, // Type of elements, 32 bit float
            gl.FALSE, // Normalized data
            2 * Float32Array.BYTES_PER_ELEMENT, // Only position data, no interleaving
            0 // Offset from the beginning of a single vertex to this attribute, no offset in this case
        );
        gl.enableVertexAttribArray(center_attribute_location); // Enable the attribute

        // Color buffer setup
        var color_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
        var colors = new Float32Array(amount_verts * 4); // 4 components per color (RGBA)
        let colorIndex = 0;
        for (let i = 0; i < scene.length; i++) {
            let currentNode = scene[i];
            const [r, g, b, a] = currentNode.getColor(real_time + time_offset);
            // Fill colors for all vertices of this node
            for (let j = 0; j < currentNode.verts; j++) {
                colors[colorIndex++] = r;
                colors[colorIndex++] = g;
                colors[colorIndex++] = b;
                colors[colorIndex++] = a;
            }
        }
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

        var color_attribute_location = gl.getAttribLocation(program, 'vertex_color');
        gl.vertexAttribPointer(
            color_attribute_location,
            4,                          // vec4 (RGBA)
            gl.FLOAT,
            false,
            0,                         // Tightly packed
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

        last_time = calcFps(last_time);
        // Draw background
        gl.clearColor(0, 0, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Draw just this node's vertices
        gl.drawArrays(gl.TRIANGLES, 0, amount_verts);
        
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

function calcFps (last_time) {
    var fps = 1000 / ((performance.now() + time_offset) - last_time);
    last_time = performance.now() + time_offset;
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