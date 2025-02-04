// ==================== //
// render.js - Universal Render Service
// ==================== //

/**
 * Universal Render Service
 * This service renders content in various formats, including text, JSON, Markdown, HTML, PDF, medical files (DICOM), audio, video, CSV, Excel, Word documents, 3D models, and virtual worlds.
 * It uses a plugin-based architecture to support new formats dynamically.
 *
 * @module render
 */

import { marked } from 'marked'; // For Markdown rendering
import * as pdfjsLib from 'pdfjs-dist'; // For PDF rendering
import { DicomParser } from 'dicom-parser'; // For DICOM (medical image) rendering
import sanitizeHtml from 'sanitize-html'; // For HTML sanitization
import Papa from 'papaparse'; // For CSV parsing
import * as XLSX from 'xlsx'; // For Excel parsing
import mammoth from 'mammoth'; // For Word document rendering
import * as THREE from 'three'; // For 3D model rendering
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // For GLTF models
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'; // For FBX models
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'; // For OBJ models

// ==================== //
// Renderer Plugins
// ==================== //

/**
 * Renders CSV content as an interactive table.
 * @param {string} response - The CSV content to render.
 * @returns {DocumentFragment} - A DocumentFragment containing the rendered table.
 */
const renderCsv = (response) => {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');

    // Parse CSV using PapaParse
    const results = Papa.parse(response, { header: true });
    const table = document.createElement('table');
    table.classList.add('csv-table');

    // Add header row
    const headerRow = document.createElement('tr');
    results.meta.fields.forEach((field) => {
        const th = document.createElement('th');
        th.textContent = field;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Add data rows
    results.data.forEach((row) => {
        const tr = document.createElement('tr');
        results.meta.fields.forEach((field) => {
            const td = document.createElement('td');
            td.textContent = row[field];
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });

    container.appendChild(table);
    fragment.appendChild(container);
    return fragment;
};

/**
 * Renders Excel content as a table.
 * @param {ArrayBuffer} response - The Excel file to render.
 * @returns {DocumentFragment} - A DocumentFragment containing the rendered table.
 */
const renderExcel = (response) => {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');

    // Parse Excel file using SheetJS
    const workbook = XLSX.read(response, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const html = XLSX.utils.sheet_to_html(sheet);

    container.innerHTML = html;
    fragment.appendChild(container);
    return fragment;
};

/**
 * Renders Word document content as HTML.
 * @param {ArrayBuffer} response - The Word document to render.
 * @returns {Promise<DocumentFragment>} - A Promise resolving to a DocumentFragment containing the rendered HTML.
 */
const renderWord = async (response) => {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');

    // Convert Word document to HTML using Mammoth.js
    const result = await mammoth.convertToHtml({ arrayBuffer: response });
    container.innerHTML = result.value;

    fragment.appendChild(container);
    return fragment;
};

/**
 * Renders 3D models (GLTF, FBX, OBJ).
 * @param {ArrayBuffer} response - The 3D model file to render.
 * @param {string} format - The format of the 3D model ('gltf', 'fbx', 'obj').
 * @returns {Promise<DocumentFragment>} - A Promise resolving to a DocumentFragment containing the rendered 3D model.
 */
const render3DModel = async (response, format) => {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '500px';
    container.style.position = 'relative';

    // Set up Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Load 3D model based on format
    let model;
    switch (format) {
        case 'gltf':
            const gltfLoader = new GLTFLoader();
            model = await gltfLoader.loadAsync(URL.createObjectURL(new Blob([response])));
            scene.add(model.scene);
            break;

        case 'fbx':
            const fbxLoader = new FBXLoader();
            model = await fbxLoader.loadAsync(URL.createObjectURL(new Blob([response])));
            scene.add(model);
            break;

        case 'obj':
            const objLoader = new OBJLoader();
            model = await objLoader.loadAsync(URL.createObjectURL(new Blob([response])));
            scene.add(model);
            break;

        default:
            throw new Error(`Unsupported 3D model format: ${format}`);
    }

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    // Position the camera
    camera.position.z = 5;

    // Render loop
    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };
    animate();

    fragment.appendChild(container);
    return fragment;
};

/**
 * Renders virtual worlds using WebXR and Three.js.
 * @param {Object} response - The virtual world configuration (e.g., scene, assets).
 * @returns {Promise<DocumentFragment>} - A Promise resolving to a DocumentFragment containing the rendered virtual world.
 */
const renderVirtualWorld = async (response) => {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '500px';
    container.style.position = 'relative';

    // Set up Three.js scene for WebXR
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.xr.enabled = true;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Add WebXR button
    const xrButton = document.createElement('button');
    xrButton.textContent = 'Enter VR';
    xrButton.style.position = 'absolute';
    xrButton.style.top = '10px';
    xrButton.style.left = '10px';
    xrButton.addEventListener('click', () => {
        renderer.xr.setSession(navigator.xr.requestSession('immersive-vr'));
    });
    container.appendChild(xrButton);

    // Add objects to the scene (e.g., from response)
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Position the camera
    camera.position.z = 5;

    // Render loop
    const animate = () => {
        requestAnimationFrame(animate);
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
    };
    animate();

    fragment.appendChild(container);
    return fragment;
};

// ==================== //
// Renderer Registry
// ==================== //

/**
 * A registry of renderers for different formats.
 * This object maps format names (e.g., 'text', 'json', 'markdown') to their respective rendering functions.
 * New formats can be added by extending this object.
 */
const renderers = {
    text: renderText,
    json: renderJson,
    markdown: renderMarkdown,
    html: renderHtml,
    pdf: renderPdf,
    dicom: renderDicom,
    audio: renderAudio,
    video: renderVideo,
    csv: renderCsv,
    excel: renderExcel,
    word: renderWord,
    gltf: (response) => render3DModel(response, 'gltf'),
    fbx: (response) => render3DModel(response, 'fbx'),
    obj: (response) => render3DModel(response, 'obj'),
    virtualworld: renderVirtualWorld,
};

// ==================== //
// Main Render Function
// ==================== //

/**
 * Renders a response in the specified format.
 * This function is the main entry point for rendering content and supports extensibility for new formats.
 *
 * @param {string|Object|ArrayBuffer} response - The response to render. Can be text, JSON, Markdown, HTML, PDF, DICOM, audio, video, CSV, Excel, Word documents, 3D models, or virtual worlds.
 * @param {string} format - The format to render the response in ('text', 'json', 'markdown', 'html', 'pdf', 'dicom', 'audio', 'video', 'csv', 'excel', 'word', 'gltf', 'fbx', 'obj', 'virtualworld').
 * @returns {Promise<DocumentFragment>} - A Promise resolving to a DocumentFragment containing the rendered content.
 *
 * @example
 * // Render CSV
 * const csvFragment = await renderResponse(csvContent, 'csv');
 *
 * // Render 3D model (GLTF)
 * const gltfFragment = await renderResponse(gltfArrayBuffer, 'gltf');
 *
 * // Render virtual world
 * const virtualWorldFragment = await renderResponse(virtualWorldConfig, 'virtualworld');
 */
export async function renderResponse(response, format = 'text') {
    // Validate the response
    if (!response) {
        const errorFragment = document.createDocumentFragment();
        errorFragment.appendChild(document.createTextNode('Error: No response provided.'));
        return errorFragment;
    }

    // Get the appropriate renderer for the specified format
    const renderer = renderers[format] || ((response) => {
        const errorFragment = document.createDocumentFragment();
        errorFragment.appendChild(document.createTextNode(`Unsupported format: ${format}`));
        return errorFragment;
    });

    try {
        // Render the response using the selected renderer
        return await renderer(response);
    } catch (error) {
        console.error('Error rendering response:', error);

        // Return an error message if rendering fails
        const errorFragment = document.createDocumentFragment();
        errorFragment.appendChild(document.createTextNode('Error: Failed to render response.'));
        return errorFragment;
    }
}