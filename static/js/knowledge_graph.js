export function showKnowledgeGraph() {
    const container = document.getElementById('graph-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    container.innerHTML = '';

    const svg = d3.select("#graph-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g");
    const searchContainer = d3.select("#graph-container")
        .append("div")
        .attr("class", "search-container")
        .style("position", "absolute")
        .style("top", "10px")
        .style("right", "10px")
        .style("z-index", "1000");

    searchContainer.append("input")
        .attr("type", "text")
        .attr("placeholder", "Search concepts...")
        .attr("class", "form-control")
        .on("input", handleSearch);

    let graphData;
    let node, link, label;

    function updateGraph(data) {
        graphData = data;
        // Clear existing graph
        g.selectAll("*").remove();

        link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(graphData.links)
            .join("line")
            .attr("stroke-width", d => Math.sqrt(d.value));

        node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(graphData.nodes)
            .join("circle")
            .attr("r", 5)
            .attr("fill", d => d.group === 1 ? "#69b3a2" : "#404080")
            .call(drag(simulation));

        label = g.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(graphData.nodes)
            .join("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .text(d => d.id)
            .attr('font-size', 8)
            .attr('font-weight', 'bold');

        node.on("click", showConceptDetails);

        simulation
            .nodes(graphData.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(graphData.links);

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        }
    }

    function handleSearch() {
        const searchTerm = this.value.toLowerCase();
        if (searchTerm === "") {
            // Reset the graph to its original state
            node.attr("opacity", 1).attr("r", 5);
            link.attr("opacity", 1);
            label.attr("opacity", 1);
            return;
        }

        // Find nodes that match the search term
        const matchedNodes = graphData.nodes.filter(n => 
            n.id.toLowerCase().includes(searchTerm)
        );

        // Find links connected to matched nodes
        const matchedLinks = graphData.links.filter(l => 
            matchedNodes.includes(l.source) || matchedNodes.includes(l.target)
        );

        // Highlight matched nodes and their connections
        node.attr("opacity", n => matchedNodes.includes(n) ? 1 : 0.1)
            .attr("r", n => matchedNodes.includes(n) ? 8 : 5);
        link.attr("opacity", l => matchedLinks.includes(l) ? 1 : 0.1);
        label.attr("opacity", n => matchedNodes.includes(n) ? 1 : 0.1);

        // If there are matched nodes, zoom to fit them
        if (matchedNodes.length > 0) {
            const bounds = getBounds(matchedNodes);
            zoomToFit(bounds);
        }
    }

    function getBounds(nodes) {
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    function zoomToFit(bounds) {
        const dx = bounds.width;
        const dy = bounds.height;
        const x = bounds.x + (dx / 2);
        const y = bounds.y + (dy / 2);

        const scale = 0.8 / Math.max(dx / width, dy / height);
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        svg.transition().duration(500).call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);
    const controlsContainer = d3.select("#graph-container")
        .append("div")
        .attr("class", "graph-controls")
        .style("position", "absolute")
        .style("top", "10px")
        .style("left", "10px")
        .style("background-color", "rgba(255, 255, 255, 0.7)")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("z-index", "1000");  

    controlsContainer.append("button")
        .attr("class", "btn btn-secondary btn-sm me-1")
        .text("-")
        .on("click", () => zoomBy(0.8));

    controlsContainer.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .text("Reset")
        .on("click", resetZoom);

    const zoomControls = d3.select("#graph-container")
        .append("div")
        .attr("class", "zoom-controls")
        .style("position", "absolute")
        .style("top", "10px")
        .style("left", "10px");

    zoomControls.append("button")
        .attr("class", "btn btn-secondary btn-sm me-1")
        .text("+")
        .on("click", () => zoomBy(1.2));

    zoomControls.append("button")
        .attr("class", "btn btn-secondary btn-sm me-1")
        .text("-")
        .on("click", () => zoomBy(0.8));

    zoomControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .text("Reset")
        .on("click", resetZoom);

    function zoomBy(factor) {
        svg.transition().duration(300).call(
            zoom.scaleBy, factor
        );
    }
    function pan(dx, dy) {
        svg.transition().duration(300).call(
            zoom.translateBy, dx, dy
        );
    }
    function resetZoom() {
        svg.transition().duration(300).call(
            zoom.transform, d3.zoomIdentity
        );
    }
    const panControls = controlsContainer.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "repeat(3, 1fr)")
        .style("gap", "2px")
        .style("margin-top", "5px");

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8598;")
        .on("click", () => pan(-50, -50));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8593;")
        .on("click", () => pan(0, -50));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8599;")
        .on("click", () => pan(50, -50));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8592;")
        .on("click", () => pan(-50, 0));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8634;")
        .on("click", resetZoom);

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8594;")
        .on("click", () => pan(50, 0));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8601;")
        .on("click", () => pan(-50, 50));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8595;")
        .on("click", () => pan(0, 50));

    panControls.append("button")
        .attr("class", "btn btn-secondary btn-sm")
        .html("&#8600;")
        .on("click", () => pan(50, 50));
    // Add a button for resetting the zoom
    container.insertAdjacentHTML('beforeend', '<button id="reset-zoom" class="btn btn-secondary mt-2">Reset Zoom</button>');
    document.getElementById('reset-zoom').addEventListener('click', () => {
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    function updateGraph(graphData) {
        // Clear existing graph
        g.selectAll("*").remove();

        const link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(graphData.links)
            .join("line")
            .attr("stroke-width", d => Math.sqrt(d.value));

        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(graphData.nodes)
            .join("circle")
            .attr("r", 5)
            .attr("fill", d => d.group === 1 ? "#69b3a2" : "#404080")
            .call(drag(simulation));

        const label = g.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(graphData.nodes)
            .join("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .text(d => d.id)
            .attr('font-size', 8)
            .attr('font-weight', 'bold');

        node.on("click", showConceptDetails);

        simulation
            .nodes(graphData.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(graphData.links);

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        }
    }

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    function showConceptDetails(event, d) {
        fetch(`/api/explore_concept/${d.id}`)
            .then(response => response.json())
            .then(data => {
                const detailsDiv = document.getElementById('concept-details');
                detailsDiv.innerHTML = `
                    <h3>${data.concept}</h3>
                    <h4>Related Concepts:</h4>
                    <ul>
                        ${data.related_concepts.map(rc => `<li>${rc.concept}: ${rc.relationship}</li>`).join('')}
                    </ul>
                `;
            })
            .catch(error => console.error('Error:', error));
    }

    // Fetch and render the graph data
    fetch('/api/knowledge_graph')
        .then(response => response.json())
        .then(data => updateGraph(data))
        .catch(error => console.error('Error:', error));
}

// Make sure to call showKnowledgeGraph when the tab is shown
document.addEventListener('DOMContentLoaded', () => {
    const knowledgeGraphTab = document.getElementById('view-knowledge-graph-link');
    if (knowledgeGraphTab) {
        knowledgeGraphTab.addEventListener('click', showKnowledgeGraph);
    }

    document.getElementById('add-embeddings-button').addEventListener('click', function() {
        fetch('/admin/add_embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Embeddings added successfully!');
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An unexpected error occurred.');
        });
    });
});