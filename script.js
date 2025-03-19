document.addEventListener("DOMContentLoaded", function () {
    console.log("Script.js loaded");

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create SVG container
    const svg = d3.select("#tree-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(50,50)");

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.5, 2])
        .on("zoom", (event) => {
            svg.attr("transform", event.transform);
        });

    d3.select("svg").call(zoom);

    let originalData = []; // Store full dataset

    // Load data from CSV
    d3.csv("family_tree.csv").then(function (data) {
        if (!data || data.length === 0) {
            console.error("CSV data is empty or not loaded correctly.");
            return;
        }

        let nodes = new Map();
        data.forEach(d => {
            let parentID = d["Parent ID"] ? +d["Parent ID"] : null;
            let parentName = d["Parent Name"];
            let childID = +d["Child ID"];
            let childName = d["Child Name"];

            // Ensure parent exists in the dataset
            if (parentID !== null && !nodes.has(parentID)) {
                nodes.set(parentID, { id: parentID, name: parentName, parent: null });
            }

            // Add child node
            nodes.set(childID, { id: childID, name: childName, parent: parentID });
        });

        originalData = Array.from(nodes.values()); // Store full dataset
        const roots = findRootNodes(originalData);

        if (roots.length > 0) {
            drawTreeFromRoot(roots[0], originalData); // Show first root initially
        }

        // Search functionality
        const searchInput = document.getElementById("searchInput");
        const searchButton = document.getElementById("searchButton");

        function handleSearch() {
            const searchId = searchInput.value.trim();

            if (searchId === "") {
                // Reset to first root tree if search is empty
                if (roots.length > 0) {
                    svg.selectAll("*").remove();
                    drawTreeFromRoot(roots[0], originalData);
                }
                return;
            }

            highlightNode(+searchId, originalData);
        }

        // Search button click event
        searchButton.addEventListener("click", handleSearch);

        // Trigger search when "Enter" is pressed
        searchInput.addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                handleSearch();
            }
        });
    });

    // Find root nodes (nodes without parents)
    function findRootNodes(data) {
        let childSet = new Set(data.map(d => d.id));
        return data.filter(d => d.parent === null || !childSet.has(d.parent));
    }

    // Convert CSV to hierarchical format
    function buildHierarchy(data, rootNode) {
        let map = new Map();
        data.forEach(d => map.set(d.id, { ...d, children: [] }));

        let root = map.get(rootNode.id);
        data.forEach(d => {
            if (d.parent !== null && map.has(d.parent)) {
                map.get(d.parent).children.push(map.get(d.id));
            }
        });

        return root;
    }

    // Draw tree for a single root node
    function drawTreeFromRoot(rootNode, data) {
        svg.selectAll("*").remove(); // Clear previous tree
        const root = d3.hierarchy(buildHierarchy(data, rootNode));
        drawTree(root, 100);
    }

    // Draw tree structure
    function drawTree(root, xOffset) {
        const treeLayout = d3.tree().nodeSize([100, 300]);
        treeLayout(root);

        // Draw links
        svg.selectAll(".link")
            .data(root.links())
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("d", d3.linkHorizontal()
                .x(d => d.y + xOffset)
                .y(d => d.x));

        // Draw nodes
        const node = svg.selectAll(".node")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y + xOffset},${d.x})`);

        node.append("circle")
            .attr("r", 14);

        node.append("text")
            .attr("dy", "0.35em")
            .attr("x", d => (d.children ? -20 : 20))
            .attr("text-anchor", d => (d.children ? "end" : "start"))
            .text(d => `${d.data.name} (${d.data.id})`);
    }

    // Highlight a node and show relatives
    function highlightNode(searchId, data) {
        const selectedNode = data.find(d => d.id === searchId);
        if (!selectedNode) {
            alert("Node not found!");
            return;
        }

        let parents = [];
        let siblings = [];
        let current = selectedNode;

        // Find up to 2 generations of parents
        for (let i = 0; i < 2; i++) {
            if (current.parent !== null) {
                let parent = data.find(d => d.id === current.parent);
                if (parent) {
                    parents.push(parent);
                    current = parent;
                }
            }
        }

        // Find siblings (all children of the immediate parent)
        if (selectedNode.parent !== null) {
            siblings = data.filter(d => d.parent === selectedNode.parent && d.id !== searchId);
        }

        let children = [];
        function findChildren(node, depth) {
            if (depth >= 2) return;
            let directChildren = data.filter(d => d.parent === node.id);
            children.push(...directChildren);
            directChildren.forEach(child => findChildren(child, depth + 1));
        }
        findChildren(selectedNode, 0);

        let filteredData = [selectedNode, ...parents, ...siblings, ...children];

        const roots = findRootNodes(filteredData);
        svg.selectAll("*").remove();
        if (roots.length > 0) {
            drawTreeFromRoot(roots[0], filteredData);
        }
    }
});
