document.addEventListener("DOMContentLoaded", function () {
    console.log("Script.js loaded");

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create SVG container
    const svgContainer = d3.select("#tree-container")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const svg = svgContainer.append("g").attr("transform", "translate(50,50)");

    // Add zoom behavior
    const zoom = d3.zoom()
    .scaleExtent([0.25, 2]) // Allows zooming out further
    .on("zoom", (event) => {
        svg.attr("transform", event.transform);
    });

    svgContainer.call(zoom);

    // Set initial zoom level to half
    svgContainer.call(zoom.transform, d3.zoomIdentity.scale(0.5));

    let originalData = [];

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

            if (parentID !== null && !nodes.has(parentID)) {
                nodes.set(parentID, { id: parentID, name: parentName, parent: null });
            }

            if (!nodes.has(childID)) {
                nodes.set(childID, { id: childID, name: childName, parent: parentID });
            } else {
                nodes.get(childID).parent = parentID;
            }
        });

        let transformedData = Array.from(nodes.values());
        originalData = transformedData;

        const roots = findRootNodes(transformedData);
        if (roots.length > 0) {
            drawTreeFromRoot(roots[0], transformedData);
        }

        // Search functionality
        document.getElementById("searchButton").addEventListener("click", () => handleSearch(originalData));
        document.getElementById("searchInput").addEventListener("keypress", function (event) {
            if (event.key === "Enter") {
                handleSearch(originalData);
            }
        });
    });

    function findRootNodes(data) {
        let childSet = new Set(data.map(d => d.id));
        return data.filter(d => d.parent === null || !childSet.has(d.parent));
    }

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

    function drawTreeFromRoot(rootNode, data) {
        svg.selectAll("*").remove();
        const root = d3.hierarchy(buildHierarchy(data, rootNode));
        drawTree(root, 100);
    }

    function drawTree(root, xOffset) {
        const treeLayout = d3.tree().nodeSize([100, 300]);
        treeLayout(root);
    
        svg.selectAll(".link")
            .data(root.links())
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("d", d3.linkHorizontal()
                .x(d => d.y + xOffset)
                .y(d => d.x));
    
        const node = svg.selectAll(".node")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y + xOffset},${d.x})`);
    
        node.append("circle").attr("r", 14);
    
        node.append("text")
            .attr("dy", "0.35em")
            .attr("x", d => (d.children ? -20 : 20))
            .attr("text-anchor", d => (d.children ? "end" : "start"))
            .text(d => `${d.data.name} (${d.data.id})`)
            .attr("class", "node-label");
    
        // Attach hover events for nodes
        node.on("mouseover", (event, d) => showHoverBox(d.data.name, d.data.id))
            .on("mouseout", hideHoverBox);
    
        // Attach hover events for labels
        svg.selectAll(".node-label")
            .on("mouseover", (event, d) => showHoverBox(d.data.name, d.data.id))
            .on("mouseout", hideHoverBox);
    }
    

    function displayFamilyTree(searchId, data) {
        const selectedNode = data.find(d => d.id === searchId);
        if (!selectedNode) {
            alert("Node not found!");
            return;
        }

        let familySet = new Set();
        let filteredData = [];

        function addAncestors(id) {
            let node = data.find(d => d.id === id);
            while (node && node.parent) {
                node = data.find(d => d.id === node.parent);
                if (node && !familySet.has(node.id)) {
                    familySet.add(node.id);
                    filteredData.push(node);
                }
            }
        }

        function addDescendants(id, depth) {
            let node = data.find(d => d.id === id);
            if (node) {
                familySet.add(node.id);
                filteredData.push(node);

                let children = data.filter(d => d.parent === node.id);
                if (depth > 0) {
                    children.forEach(child => addDescendants(child.id, depth - 1));
                }
            }
        }

        function addSiblings(id) {
            let node = data.find(d => d.id === id);
            if (node && node.parent) {
                let siblings = data.filter(d => d.parent === node.parent && d.id !== node.id);
                siblings.forEach(sibling => {
                    if (!familySet.has(sibling.id)) {
                        familySet.add(sibling.id);
                        filteredData.push(sibling);
                    }
                });
            }
        }

        addAncestors(searchId);
        addSiblings(searchId);
        addDescendants(searchId, 2);

        const roots = findRootNodes(filteredData);
        svg.selectAll("*").remove();
        if (roots.length > 0) {
            const root = d3.hierarchy(buildHierarchy(filteredData, roots[0]));
            drawTree(root, 100);

            // Center the searched node
            centerNode(root, searchId);
        }

        d3.selectAll(".node-label")
            .filter(d => d.data.id === searchId)
            .style("font-weight", "bold")
            .style("fill", "blue");
    }

    function centerNode(root, searchId) {
        let foundNode = root.descendants().find(d => d.data.id === searchId);
        if (foundNode) {
            const xCenter = width / 2 - foundNode.y;
            const yCenter = height / 2 - foundNode.x;

            svg.transition()
                .duration(750)
                .attr("transform", `translate(${xCenter},${yCenter})`);
        }
    }

    function handleSearch(data) {
        const query = document.getElementById("searchInput").value.trim().toLowerCase();
    
        if (query === "") {
            // Reset to original tree view
            svg.selectAll("*").remove();
            const roots = findRootNodes(originalData);
            if (roots.length > 0) {
                drawTreeFromRoot(roots[0], originalData);
            }
            return;
        }
    
        if (!isNaN(query)) {
            displayFamilyTree(+query, data);
            return;
        }
    
        const nameMatches = data.filter(d => d.name.toLowerCase().includes(query));
    
        if (nameMatches.length === 0) {
            alert("No matching names found!");
            return;
        }
    
        createSelectionBox(nameMatches, data);
    }
    

    function createSelectionBox(matches, data) {
        let selectionBox = document.getElementById("selectionBox");
        if (selectionBox) selectionBox.remove();
    
        selectionBox = document.createElement("div");
        selectionBox.setAttribute("id", "selectionBox");
        selectionBox.style.position = "absolute";
        selectionBox.style.background = "#5c84c4"; // Light blue background
        selectionBox.style.padding = "10px";
        selectionBox.style.top = "50px";
        selectionBox.style.left = "50px";
        selectionBox.style.display = "flex";
        selectionBox.style.flexWrap = "wrap"; // Wrap items to the next line
        selectionBox.style.gap = "10px";
        selectionBox.style.maxWidth = "1315px"; // Limit max width
        selectionBox.style.border = "1px solid #90CAF9";
        selectionBox.style.boxShadow = "2px 2px 10px rgba(0,0,0,0.2)";
        selectionBox.style.borderRadius = "8px";
    
        matches.forEach(match => {
            const option = document.createElement("div");
            option.style.cursor = "pointer";
            option.style.width = "100px"; // Fixed width per entry
            option.style.textAlign = "center";
            option.style.overflow = "hidden";
            option.style.wordWrap = "break-word";
            option.style.padding = "5px";
            option.style.borderRadius = "5px";
            option.style.background = "#BBDEFB"; // Slightly darker blue for contrast
    
            const imgSrc = `https://oa.cc.iitk.ac.in/Oa/Jsp/Photo/${match.id}_0.jpg`;

            option.innerHTML = `
                <img src="${imgSrc}" width="80" style="border-radius: 5px;" onerror="this.onerror=null; this.src='blank.png';">
                <div style="font-weight: bold; margin-top: 5px;">${match.name}</div>
                <div style="margin-top: 2px;">${match.id}</div>
            `;
    
            option.onclick = () => {
                displayFamilyTree(match.id, data);
                selectionBox.remove();
            };
    
            selectionBox.appendChild(option);
        });
    
        document.body.appendChild(selectionBox);
    }
    
    // Create hover box at the bottom left corner
const hoverBox = document.createElement("div");
hoverBox.setAttribute("id", "hoverBox");
hoverBox.style.position = "fixed";
hoverBox.style.bottom = "20px";
hoverBox.style.left = "20px";
hoverBox.style.width = "150px"; // Fixed width
hoverBox.style.background = "#9fbded"; // Light blue color
hoverBox.style.border = "1px solid black";
hoverBox.style.padding = "8px";
hoverBox.style.display = "none";
hoverBox.style.boxShadow = "2px 2px 10px rgba(0,0,0,0.2)";
hoverBox.style.textAlign = "center";
hoverBox.style.overflow = "hidden"; // Prevents overflow
hoverBox.style.wordWrap = "break-word"; // Ensures long names wrap
hoverBox.style.fontFamily = "Arial, sans-serif"; // Better readability
hoverBox.style.borderRadius = "10px";

hoverBox.innerHTML = `
    <img id="hoverImg" src="" width="100" style="display: block; margin: 5px auto; border-radius: 5px;">
    <div id="hoverName" style="font-weight: bold; margin-top: 5px; word-wrap: break-word;"></div>
    <div id="hoverID" style="margin-top: 2px;"></div>
`;
document.body.appendChild(hoverBox);

// Function to show hover box
function showHoverBox(name, id) {
    const imgElement = document.getElementById("hoverImg");
    const imgSrc = `https://oa.cc.iitk.ac.in/Oa/Jsp/Photo/${id}_0.jpg`;

    imgElement.src = imgSrc;
    imgElement.onerror = function () {
        this.onerror = null;
        this.src = "blank.png";
    };

    document.getElementById("hoverName").textContent = name;
    document.getElementById("hoverID").textContent = id;
    hoverBox.style.display = "block";
}


// Function to hide hover box
function hideHoverBox() {
    hoverBox.style.display = "none";
}

// Attach hover events to nodes
d3.selectAll(".node").each(function (d) {
    d3.select(this)
        .on("mouseover", () => showHoverBox(d.data.name, d.data.id))
        .on("mouseout", hideHoverBox);
});

// Attach hover events to name labels
d3.selectAll(".node-label").each(function (d) {
    d3.select(this)
        .on("mouseover", () => showHoverBox(d.data.name, d.data.id))
        .on("mouseout", hideHoverBox);
});



});
