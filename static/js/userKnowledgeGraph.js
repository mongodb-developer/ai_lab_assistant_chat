// static/js/userKnowledgeGraph.js
import { initializeKnowledgeGraph, searchKnowledgeGraph, updateKnowledgeGraph, resetGraph } from './sharedKnowledgeGraph.js';

document.addEventListener('DOMContentLoaded', function() {
    const knowledgeGraphTab = document.getElementById('knowledge-graph-tab');
    const searchKnowledgeGraphBtn = document.getElementById('search-knowledge-graph');
    const knowledgeGraphSearchInput = document.getElementById('knowledge-graph-search');
    const graphContainer = document.getElementById('graph-container');

    let graphInitialized = false;

    knowledgeGraphTab.addEventListener('shown.bs.tab', function (e) {
        if (!graphInitialized) {
            // Ensure the container has a height
            if (graphContainer && !graphContainer.style.height) {
                graphContainer.style.height = '600px';
            }
            initializeKnowledgeGraph('graph-container', 'knowledge-graph-search', 'search-knowledge-graph');
            graphInitialized = true;
        }
    });

    const resetButton = document.getElementById('reset-graph');
    if (resetButton) {
        resetButton.addEventListener('click', resetGraph);
    }

    if (searchKnowledgeGraphBtn && knowledgeGraphSearchInput) {
        searchKnowledgeGraphBtn.addEventListener('click', () => {
            searchKnowledgeGraph('graph-container', knowledgeGraphSearchInput.value);
        });

        knowledgeGraphSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchKnowledgeGraph('graph-container', knowledgeGraphSearchInput.value);
            }
        });
    }

    // Listen for custom event to update the graph
    document.addEventListener('updateKnowledgeGraph', function(e) {
        if (graphInitialized) {
            updateKnowledgeGraph(e.detail.question, e.detail.answer);
        }
    });
});