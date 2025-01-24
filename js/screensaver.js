var canvas;
var gl;

const QUALITY_DIVIDER = 1;

const vertex_shader_code = `
    precision mediump float;

    attribute vec2 vertex_position;
    attribute vec3 vertex_color;
    attribute vec2 object_position;
    uniform float u_aspect_ratio;

    varying vec3 fragment_color;
    
    void main() {
        fragment_color = vertex_color;
        vec2 position = vertex_position + object_position;
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

var aspectratio = 1; 
var scene = [];

function setError (message) {
    document.getElementById('error').innerText = message;
}

function resized () {
    width = window.outerWidth;
    height = window.outerHeight;

    // Set actual canvas size to scaled down resolution
    canvas.width = width / QUALITY_DIVIDER;
    canvas.height = height / QUALITY_DIVIDER;
    
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

const separation = 0.1;
const radius = 0.02;
const length = 0.1;
const circle_resolution = 12;

function createScene () {
    scene = [];
    for (let x = - 1 * aspectratio; x < 1 * aspectratio; x += separation) {
        for (let y = -1; y < 1; y += separation) {
            let col = noise.perlin2(x, y);
            scene.push(new node(x, y, 'circle', col, col, col));
        }
    }
}

class node {
    constructor (x, y, type, r, g, b) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.g = g;
        this.b = b;
        this.type = type == 'circle' ? 0 : 1;
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

    //  --------------------------------------------------------
    // VERTEX BUFFER
    //  --------------------------------------------------------


    // X, Y Vertex positions ; RBG color [0 - 1]
    var [circle, amount_verts] = createCircle(radius, circle_resolution, 0, 0);
    console.log(circle);

    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); // Bind buffer to the context
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circle), gl.STATIC_DRAW); // Fill buffer with data

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

    //  --------------------------------------------------------
    // RENDER LOOP
    // --------------------------------------------------------
    
    gl.useProgram(program); // Use the program

    // Set aspect ratio in shader
    var aspectUniformLocation = gl.getUniformLocation(program, 'u_aspect_ratio');
    gl.uniform1f(aspectUniformLocation, 1.0 / aspectratio); // Inverse because we want to compress the x axis

    
    var position =  [0.5, 0.5]
    object_positions = [];
    var last_time = performance.now();
    function animation_loop () {
        var time = performance.now() / 1000;

        // Draw background
        gl.clearColor(0, 0, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for (let i = 0; i < scene.length; i++) {
            let node = scene[i];

            // Create position buffer
            var positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            
            // Fill buffer with position data
            var positions = new Float32Array(amount_verts * 2); // 2 components per position
            for (let i = 0; i < amount_verts * 2; i += 2) {
                positions[i] = node.x;     // x
                positions[i + 1] = node.y; // y
            }
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

            // Set up object position attribute
            var object_position_location = gl.getAttribLocation(program, 'object_position');
            gl.vertexAttribPointer(
                object_position_location,
                2,              // vec2
                gl.FLOAT,
                false,
                0,
                0 // no offset
            );
            gl.enableVertexAttribArray(object_position_location);

            // Color buffer setup
            gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
            var colors = new Float32Array(amount_verts * 3); // 3 components per color (RGB)
            for (let j = 0; j < amount_verts * 3; j += 3) {
                colors[j] = node.r;
                colors[j + 1] = node.g;
                colors[j + 2] = node.b;
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

            // bind circle's vertex buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

            // Redraw circle
            gl.drawArrays(gl.TRIANGLES, 0, amount_verts);
        }
        last_time = calcFps(last_time);
        
        // New frame req
        requestAnimationFrame(animation_loop);
    }
    requestAnimationFrame(animation_loop);

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