// static/js/shared_knowledge_graph.js
let nodes = [];
let links = [];
let simulation;
let svg;
let selectedNode = null;

function initializeKnowledgeGraph(containerId, searchInputId, searchButtonId) {
    const container = document.getElementById(containerId);
    const searchInput = document.getElementById(searchInputId);
    const searchButton = document.getElementById(searchButtonId);

    if (!container) {
        console.error(`Knowledge graph container with id "${containerId}" not found`);
        return;
    }

    const resetButton = document.getElementById('reset-graph');
    if (resetButton) {
        resetButton.addEventListener('click', resetGraph);
    }


    if (searchButton) {
        searchButton.addEventListener('click', () => searchKnowledgeGraph(containerId, searchInput.value));
    } else {
        console.warn(`Search button with id "${searchButtonId}" not found`);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                searchKnowledgeGraph(containerId, searchInput.value);
            }
        });
    } else {
        console.warn(`Search input with id "${searchInputId}" not found`);
    }

    // Clear any existing content
    container.innerHTML = '';

    // Set the width and height based on the container's size
    const width = container.clientWidth;
    const height = container.clientHeight || 400;

    svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height);

    simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    visualizeKnowledgeGraph(containerId);
}

function resetGraph() {
    if (selectedNode) {
        deselectNode(selectedNode);
        selectedNode = null;
    }
    
    // Reset all nodes and links to original state
    svg.selectAll(".node")
        .attr("r", 5)
        .attr("fill", "#69b3a2");

    svg.selectAll(".link")
        .attr("stroke-width", 1)
        .attr("stroke", "#999");

    // Clear node details display
    clearNodeDetails();
}

function clearNodeDetails() {
    const detailsContainer = document.getElementById("concept-details");
    if (detailsContainer) {
        detailsContainer.innerHTML = "";
    }
}

function handleNodeClick(event, d) {
    if (selectedNode === d) {
        resetGraph();
    } else {
        if (selectedNode) {
            deselectNode(selectedNode);
        }
        selectedNode = d;
        highlightNode(d);
        highlightConnectedNodes(d);
        displayNodeDetails(d);
        triggerChatQuery(d);
    }
}

function highlightNode(node) {
    d3.select(event.currentTarget)
        .attr("r", 8)
        .attr("fill", "#ff0000");
}

function deselectNode() {
    if (selectedNode) {
        d3.select(`circle[id='${selectedNode.id}']`)
            .attr("r", 5)
            .attr("fill", "#69b3a2");
        selectedNode = null;

        // Reset all nodes and links to original state
        resetGraphHighlighting();

        // Clear node details display
        clearNodeDetails();
    }
}

function highlightConnectedNodes(node) {
    // Highlight links connected to this node
    svg.selectAll(".link")
        .attr("stroke-width", l => (l.source === node || l.target === node) ? 2 : 1)
        .attr("stroke", l => (l.source === node || l.target === node) ? "#ff0000" : "#999");

    // Highlight nodes connected to this node
    svg.selectAll(".node")
        .attr("r", n => (n === node || links.some(l => (l.source === node && l.target === n) || (l.target === node && l.source === n))) ? 8 : 5)
        .attr("fill", n => (n === node || links.some(l => (l.source === node && l.target === n) || (l.target === node && l.source === n))) ? "#ff0000" : "#69b3a2");
}

function resetGraphHighlighting() {
    svg.selectAll(".link")
        .attr("stroke-width", 1)
        .attr("stroke", "#999");

    svg.selectAll(".node")
        .attr("r", 5)
        .attr("fill", "#69b3a2");
}

function displayNodeDetails(node) {
    const detailsContainer = document.getElementById("concept-details");
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <h3>${node.id}</h3>
            <p>Connected to: ${getConnectedNodes(node).join(", ")}</p>
        `;
    }
}

function getConnectedNodes(node) {
    return links
        .filter(l => l.source === node || l.target === node)
        .map(l => l.source === node ? l.target.id : l.source.id);
}

function triggerChatQuery(node) {
    const event = new CustomEvent('knowledgeGraphNodeClicked', {
        detail: { nodeId: node.id }
    });
    document.dispatchEvent(event);
}

async function searchKnowledgeGraph(containerId, searchTerm) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Knowledge graph container with id "${containerId}" not found`);
        return;
    }

    container.innerHTML = '';
    try {
        const response = await fetch(`/api/knowledge_graph/search?term=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const searchResults = await response.json();

        // Transform search results into the format expected by D3
        const graphData = transformSearchResultsToGraphData(searchResults);

        // Update the visualization with the search results
        visualizeKnowledgeGraph(containerId, graphData);
    } catch (error) {
        console.error('Error searching knowledge graph:', error);
    }
}

function transformSearchResultsToGraphData(searchResults) {
    const nodes = [];
    const links = [];
    const nodeSet = new Set();

    searchResults.forEach(item => {
        if (!nodeSet.has(item.concept)) {
            nodes.push({ id: item.concept });
            nodeSet.add(item.concept);
        }

        item.related_concepts.forEach(related => {
            if (!nodeSet.has(related.concept)) {
                nodes.push({ id: related.concept });
                nodeSet.add(related.concept);
            }
            links.push({
                source: item.concept,
                target: related.concept,
                relationship: related.relationship
            });
        });
    });

    return { nodes, links };
}

async function visualizeKnowledgeGraph(containerId, graphData = null) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous visualization

    try {
        if (!graphData) {
            const response = await fetch('/api/knowledge_graph/data');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            graphData = await response.json();
        }

        if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.links)) {
            console.error('Invalid graph data');
            container.innerHTML = '<p>Invalid data for visualization.</p>';
            return;
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        graphData.nodes.forEach(node => {
            if (typeof node.x === 'undefined' || typeof node.y === 'undefined') {
                node.x = Math.random() * width;
                node.y = Math.random() * height;
            }
        });

        svg = d3.select(container).append("svg")
            .attr("width", width)
            .attr("height", height);

        // Add a group for zooming and panning
        const g = svg.append("g");

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        simulation = d3.forceSimulation(graphData.nodes)
            .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX())
            .force("y", d3.forceY());

        const link = g.append("g")
            .attr("class", "links")
            .selectAll("path")
            .data(graphData.links)
            .enter().append("path")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("fill", "none");

        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(graphData.nodes)
            .enter().append("circle")
            .attr("r", 5)
            .attr("fill", "#69b3a2")
            .call(drag(simulation))
            .on("click", handleNodeClick);

        const label = g.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(graphData.nodes)
            .enter().append("text")
            .text(d => d.id)
            .attr("font-size", 10)
            .attr("dx", 12)
            .attr("dy", ".35em");

        simulation.on("tick", () => {
            link.attr("d", linkArc);
            node.attr("cx", d => d.x)
                .attr("cy", d => d.y);
            label.attr("x", d => d.x)
                .attr("y", d => d.y);
        });

        function linkArc(d) {
            const dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        }

        // ... (keep the existing zoom controls code)

        // Run simulation for a set number of ticks
        simulation.tick(300);

    } catch (error) {
        console.error('Error visualizing knowledge graph:', error);
        container.innerHTML = '<p>An error occurred while visualizing the knowledge graph.</p>';
    }
}

export function updateKnowledgeGraph(question, answer) {
    // Extract key concepts from the answer
    const questionStr = String(question);
    const answerStr = String(answer);
    const concepts = extractConcepts(questionStr + " " + answerStr);

    // Update the graph with new concepts
    addNewNodesToGraph(concepts);
}

function addNewNodesToGraph(newConcepts) {
    let updated = false;

    newConcepts.forEach(concept => {
        if (!nodes.some(node => node.id === concept)) {
            nodes.push({id: concept});
            updated = true;

            // Connect new node to existing nodes
            nodes.forEach(existingNode => {
                if (existingNode.id !== concept) {
                    links.push({source: concept, target: existingNode.id});
                }
            });
        }
    });

    // Create links between new concepts
    for (let i = 0; i < newConcepts.length; i++) {
        for (let j = i + 1; j < newConcepts.length; j++) {
            if (!links.some(link => 
                (link.source.id === newConcepts[i] && link.target.id === newConcepts[j]) ||
                (link.source.id === newConcepts[j] && link.target.id === newConcepts[i])
            )) {
                links.push({source: newConcepts[i], target: newConcepts[j]});
                updated = true;
            }
        }
    }

    // Update the D3 simulation with new nodes and links
    if (updated) {
        updateSimulation();
    }
}

function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

function updateSimulation() {
    if (!svg || !simulation) {
        console.warn('Graph not initialized yet');
        return;
    }

    // Update nodes
    let node = svg.select(".nodes").selectAll("circle")
        .data(nodes, d => d.id);

    node.exit().remove();

    let nodeEnter = node.enter().append("circle")
        .attr("r", 5)
        .attr("fill", "#69b3a2")
        .call(drag(simulation))
        .on("click", handleNodeClick);

    node = nodeEnter.merge(node);

    // Update links
    let link = svg.select(".links").selectAll("path")
        .data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

    link.exit().remove();

    let linkEnter = link.enter().append("path")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("fill", "none");

    link = linkEnter.merge(link);

    // Update labels
    let label = svg.select(".labels").selectAll("text")
        .data(nodes, d => d.id);

    label.exit().remove();

    let labelEnter = label.enter().append("text")
        .text(d => d.id)
        .attr("font-size", 10)
        .attr("dx", 12)
        .attr("dy", ".35em");

    label = labelEnter.merge(label);

    // Update and restart the simulation
    simulation.nodes(nodes);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();

    // Update positions on tick
    simulation.on("tick", () => {
        link.attr("d", linkArc);
        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);
        label.attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    function linkArc(d) {
        const dx = d.target.x - d.source.x,
              dy = d.target.y - d.source.y,
              dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    }
}

function extractConcepts(text) {
    // This is a simple example. You might want to use a more sophisticated
    // method to extract key concepts, possibly using NLP techniques.
    const textStr = String(text);

    const words = text.toLowerCase().split(/\W+/);
    const concepts = words.filter(word => word.length > 5).slice(0, 5);
    return [...new Set(concepts)]; // Remove duplicates
}

export { initializeKnowledgeGraph, searchKnowledgeGraph, resetGraph };


