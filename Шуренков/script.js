const canvas = document.getElementById("waterSupplyCanvas");
const ctx = canvas.getContext("2d");

const nodes = [];
const sections = [];

async function loadDiameters() {
  try {
    const response = await fetch("./pipes.json");
    if (!response.ok) throw new Error("Не удалось загрузить pipes.json");

    const data = await response.json();
    const select = document.getElementById("sectionDiameter");
    select.innerHTML = "";

    data.forEach((item) => {
      const label = item["Обозначение в проекте "].trim();
      const diameterMeters = parseFloat(
        item["Dвн - внутренний диаметр, расчетный м"]
      );
      if (!isNaN(diameterMeters)) {
        const option = document.createElement("option");
        option.value = diameterMeters;
        option.textContent = label;
        select.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Ошибка загрузки данных о диаметрах:", error);
    alert("Не удалось загрузить данные из pipes.json");
  }
}

function clearForm() {
  const nodeForm = document.getElementById("nodeForm");
  const sectionForm = document.getElementById("sectionForm");

  if (nodeForm) nodeForm.reset();
  if (sectionForm) sectionForm.reset();

  ["velocity", "head-loss", "reynolds", "section-length"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerText = "";
  });

  localStorage.removeItem("hydraulicResults");
}

function calculateVelocity(diameterMeters, flowRate) {
  return (4 * flowRate) / (Math.PI * Math.pow(diameterMeters, 2));
}

function calculateFrictionFactor(reynolds, diameterMeters, roughness) {
  if (reynolds === 0) return 0.02;

  let lambda = 0.02;
  for (let i = 0; i < 100; i++) {
    const denominator = reynolds * Math.sqrt(lambda);
    const temp =
      -2 * Math.log10(roughness / (3.7 * diameterMeters) + 2.51 / denominator);
    lambda = 1 / Math.pow(temp, 2);
  }
  return lambda;
}

function calculateHeadLoss(diameterMeters, length, flowRate, lambda) {
  const velocity = calculateVelocity(diameterMeters, flowRate);
  const g = 9.81;
  return ((lambda * velocity * velocity) / (2 * g)) * (length / diameterMeters);
}

function calculateLength(section) {
  const startNode = nodes.find((node) => node.id === section.startNode);
  const endNode = nodes.find((node) => node.id === section.endNode);

  if (!startNode || !endNode) return 0;

  return Math.sqrt(
    Math.pow(endNode.x - startNode.x, 2) + Math.pow(endNode.y - startNode.y, 2)
  );
}

function calculate() {
  const flowRateInput = document.getElementById("sectionFlowRate");
  const materialInput = document.getElementById("sectionMaterial");
  const sectionIdInput = document.getElementById("sectionId");

  if (!flowRateInput || !materialInput || !sectionIdInput) {
    alert("Отсутствуют необходимые элементы формы!");
    return;
  }

  const flowRate = parseFloat(flowRateInput.value) / 1000; // м³/с
  const material = materialInput.value;
  const sectionId = parseInt(sectionIdInput.value);

  const section = sections.find((sec) => sec.id === sectionId);

  if (!section) {
    alert("Указанный участок не найден!");
    return;
  }

  const diameterMeters = section.diameter;
  const length = calculateLength(section);

  if (
    isNaN(diameterMeters) ||
    diameterMeters < 0.01 ||
    diameterMeters > 2 ||
    isNaN(length) ||
    length <= 0 ||
    isNaN(flowRate) ||
    flowRate <= 0
  ) {
    alert("Введите корректные данные!");
    return;
  }

  const viscosity = 1.31e-6;
  const velocity = calculateVelocity(diameterMeters, flowRate);
  const reynolds = (velocity * diameterMeters) / viscosity;

  let roughness;
  switch (material.toLowerCase()) {
    case "steel":
      roughness = 0.00015;
      break;
    case "polyethylene":
      roughness = 0.0000015;
      break;
    default:
      alert("Некорректный материал!");
      return;
  }

  const lambda = calculateFrictionFactor(reynolds, diameterMeters, roughness);
  const headLoss = calculateHeadLoss(diameterMeters, length, flowRate, lambda);

  document.getElementById("velocity").innerText = velocity.toFixed(2);
  document.getElementById("head-loss").innerText = headLoss.toFixed(2);
  document.getElementById("reynolds").innerText = reynolds.toFixed(0);
  document.getElementById("section-length").innerText = length.toFixed(2);

  saveResults(velocity, headLoss, reynolds, length);
}

function saveResults(velocity, headLoss, reynolds, length) {
  const results = { velocity, headLoss, reynolds, length };
  localStorage.setItem("hydraulicResults", JSON.stringify(results));
  alert("Результаты сохранены!");
}

function loadResults() {
  const savedResults = localStorage.getItem("hydraulicResults");
  if (savedResults) {
    try {
      const results = JSON.parse(savedResults);
      document.getElementById("velocity").innerText =
        results.velocity.toFixed(2);
      document.getElementById("head-loss").innerText =
        results.headLoss.toFixed(2);
      document.getElementById("reynolds").innerText =
        results.reynolds.toFixed(0);
      document.getElementById("section-length").innerText =
        results.length.toFixed(2);
    } catch (e) {
      console.warn("Ошибка при загрузке сохранённых результатов:", e);
    }
  }
}

function addNode() {
  const id = parseInt(document.getElementById("nodeId").value);
  const x = parseInt(document.getElementById("nodeX").value);
  const y = parseInt(document.getElementById("nodeY").value);
  const flowRate = parseFloat(document.getElementById("nodeFlowRate").value);

  if (isNaN(id) || isNaN(x) || isNaN(y) || isNaN(flowRate)) {
    alert("Введите корректные данные для узла!");
    return;
  }

  if (nodes.some((node) => node.id === id)) {
    alert("Узел с таким ID уже существует!");
    return;
  }

  nodes.push({ id, x, y, flowRate });
  drawNetwork();
}

function addSection() {
  const id = parseInt(document.getElementById("sectionId").value);
  const startNode = parseInt(document.getElementById("startNode").value);
  const endNode = parseInt(document.getElementById("endNode").value);
  const material = document.getElementById("sectionMaterial").value;
  const diameter = parseFloat(document.getElementById("sectionDiameter").value);

  if (isNaN(id) || isNaN(startNode) || isNaN(endNode) || isNaN(diameter)) {
    alert("Введите корректные данные для участка!");
    return;
  }

  if (sections.some((section) => section.id === id)) {
    alert("Участок с таким ID уже существует!");
    return;
  }

  if (
    !nodes.some((node) => node.id === startNode) ||
    !nodes.some((node) => node.id === endNode)
  ) {
    alert("Один из узлов не существует!");
    return;
  }

  sections.push({ id, startNode, endNode, material, diameter });
  drawNetwork();
}

function drawNode(node) {
  ctx.beginPath();
  ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
  ctx.fillStyle = "blue";
  ctx.fill();
  ctx.strokeStyle = "black";
  ctx.stroke();

  ctx.font = "12px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`Узел ${node.id}`, node.x + 15, node.y - 10);
  ctx.fillText(`Расход: ${node.flowRate} м³/ч`, node.x + 15, node.y + 10);
}

function drawSection(section) {
  const startNode = nodes.find((node) => node.id === section.startNode);
  const endNode = nodes.find((node) => node.id === section.endNode);
  if (!startNode || !endNode) return;

  const length = calculateLength(section);

  ctx.beginPath();
  ctx.moveTo(startNode.x, startNode.y);
  ctx.lineTo(endNode.x, endNode.y);
  ctx.strokeStyle = section.material === "steel" ? "green" : "orange";
  ctx.lineWidth = 3;
  ctx.stroke();

  const midX = (startNode.x + endNode.x) / 2;
  const midY = (startNode.y + endNode.y) / 2;

  ctx.font = "12px Arial";
  ctx.fillStyle = "black";
  ctx.fillText(`Участок ${section.id}`, midX, midY - 10);
  ctx.fillText(`Длина: ${length.toFixed(2)} м`, midX, midY + 10);
  ctx.fillText(`Материал: ${section.material}`, midX, midY + 25);
  ctx.fillText(
    `Диаметр: ${(section.diameter * 1000).toFixed(0)} мм`,
    midX,
    midY + 40
  );
}

function drawNetwork() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sections.forEach(drawSection);
  nodes.forEach(drawNode);
}

function computeIncidenceMatrix() {
  if (nodes.length === 0 || sections.length === 0) {
    alert("Сначала добавьте узлы и участки!");
    return;
  }

  const nodeIds = nodes.map((node) => node.id);
  const sectionIds = sections.map((section) => section.id);

  const matrix = nodeIds.map((nodeId) =>
    sectionIds.map((sectionId) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return 0;
      if (section.startNode === nodeId) return -1;
      if (section.endNode === nodeId) return 1;
      return 0;
    })
  );

  const container = document.getElementById("matrixOutput");
  if (!container) {
    alert("Добавьте элемент с id='matrixOutput' в HTML.");
    return;
  }

  let html =
    "<table border='1' style='border-collapse: collapse; text-align:center;'><tr><th>Узел / Участок</th>";
  sectionIds.forEach((id) => {
    html += `<th>${id}</th>`;
  });
  html += "</tr>";

  matrix.forEach((row, i) => {
    html += `<tr><td>${nodeIds[i]}</td>`;
    row.forEach((val) => {
      html += `<td>${val}</td>`;
    });
    html += "</tr>";
  });

  html += "</table>";
  container.innerHTML = html;

  // После вычисления матрицы ищем циклы
  const adjacencyList = buildAdjacencyList(nodes, sections);
  const cycles = findCycles(adjacencyList);
  console.log("Найденные циклы (контура) в сети:", cycles);
}

// Строим списки смежности из узлов и участков (неориентированный граф)
function buildAdjacencyList(nodes, sections) {
  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, []));

  sections.forEach((section) => {
    adjacency.get(section.startNode).push(section.endNode);
    adjacency.get(section.endNode).push(section.startNode);
  });

  return adjacency;
}

// Поиск всех циклов в неориентированном графе с помощью DFS
function findCycles(adjacency) {
  const cycles = [];
  const visited = new Set();

  function dfs(current, parent, path) {
    visited.add(current);
    path.push(current);

    for (const neighbor of adjacency.get(current)) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, current, path);
      } else if (neighbor !== parent && path.includes(neighbor)) {
        // Цикл найден — извлечём путь цикла
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex);
        // Для уникальности, отсортируем и проверим, чтобы не было дубликатов
        const sortedCycle = [...new Set(cycle)].sort((a, b) => a - b).join("-");
        if (!cycles.some((c) => c.join("-") === sortedCycle)) {
          cycles.push(cycle);
        }
      }
    }

    path.pop();
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, null, []);
    }
  }

  return cycles;
}
window.onload = () => {
  loadDiameters();
  loadResults();
  drawNetwork();
};
