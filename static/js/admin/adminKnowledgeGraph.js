import { initializeKnowledgeGraph } from '../sharedKnowledgeGraph.js';

document.addEventListener('DOMContentLoaded', function() {
    const graphContainer = document.getElementById('graph-container');
    const searchInput = document.getElementById('knowledge-graph-search');
    const searchButton = document.getElementById('search-knowledge-graph');

    if (!graphContainer) console.error('Graph container element not found');
    if (!searchInput) console.error('Search input element not found');
    if (!searchButton) console.error('Search button element not found');

    if (graphContainer && searchInput && searchButton) {
        initializeKnowledgeGraph('graph-container', 'knowledge-graph-search', 'search-knowledge-graph');
    } else {
        console.error('One or more required elements for the knowledge graph are missing');
    }

    const addEmbeddingsButton = document.getElementById('add-embeddings-button');
    if (addEmbeddingsButton) {
        addEmbeddingsButton.addEventListener('click', addEmbeddings);
    } else {
        console.warn('Add embeddings button not found');
    }

    const knowledgeGraphTab = document.getElementById('knowledge-graph-tab');
    if (knowledgeGraphTab) {
        knowledgeGraphTab.addEventListener('shown.bs.tab', showKnowledgeGraph);
    } else {
        console.error('Knowledge graph tab element not found');
    }
});

async function addEmbeddings() {
    const statusDiv = document.getElementById('embedding-status');
    const addEmbeddingsButton = document.getElementById('add-embeddings-button');

    if (!statusDiv) {
        console.error('Embedding status div not found');
        return;
    }

    statusDiv.innerHTML = 'Adding embeddings...';

    if (addEmbeddingsButton) {
        addEmbeddingsButton.disabled = true;
    }

    try {
        const response = await fetch('/api/knowledge_graph/add_embeddings', {
            method: 'POST',
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        statusDiv.innerHTML = `Embeddings added successfully. ${result.added_count} documents updated.`;
    } catch (error) {
        console.error('Error adding embeddings:', error);
        statusDiv.innerHTML = 'An error occurred while adding embeddings.';
    } finally {
        if (addEmbeddingsButton) {
            addEmbeddingsButton.disabled = false;
        }
    }
}

export function showKnowledgeGraph() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('Main content div not found');
        return;
    }
    mainContent.innerHTML = '';

    const knowledgeGraphContainer = document.createElement('div');
    knowledgeGraphContainer.id = 'knowledge-graph-container';
    knowledgeGraphContainer.innerHTML = `
        <h2>Knowledge Graph Visualization</h2>
        <div class="row mb-3">
            <div class="col-md-8">
                <input type="text" id="knowledge-graph-search" class="form-control" placeholder="Search knowledge graph">
            </div>
            <div class="col-md-4">
                <button id="search-knowledge-graph" class="btn btn-primary">Search</button>
            </div>
        </div>
        <div id="graph-container" style="width: 100%; height: 70vh; border: 1px solid #ddd;"></div>
        <div id="concept-details" class="mt-3"></div>
        <button id="add-embeddings-button" class="btn btn-secondary mt-3">Add Embeddings</button>
        <div id="embedding-status" class="mt-2"></div>
    `;

    mainContent.appendChild(knowledgeGraphContainer);

    // Now that we've created the elements, we can initialize the graph
    initializeKnowledgeGraph('graph-container', 'knowledge-graph-search', 'search-knowledge-graph');

    // Add event listener for the add embeddings button
    const addEmbeddingsButton = document.getElementById('add-embeddings-button');
    if (addEmbeddingsButton) {
        addEmbeddingsButton.addEventListener('click', addEmbeddings);
    } else {
        console.warn('Add embeddings button not found');
    }
}