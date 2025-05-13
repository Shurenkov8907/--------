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
      const diameterMeters = item["Dвн - внутренний диаметр, расчетный м"];

      const option = document.createElement("option");
      option.value = diameterMeters;
      option.textContent = label;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Ошибка загрузки данных о диаметрах:", error);
    alert("Не удалось загрузить данные из pipes.json");
  }
}

function clearForm() {
  document.getElementById("nodeForm").reset();
  document.getElementById("sectionForm").reset();
  document.getElementById("velocity").innerText = "";
  document.getElementById("head-loss").innerText = "";
  document.getElementById("reynolds").innerText = "";
  document.getElementById("section-length").innerText = "";
  localStorage.removeItem("hydraulicResults");
}

function calculateHeadLoss(diameterMeters, length, flowRate, lambda) {
  const velocity = calculateVelocity(diameterMeters, flowRate);
  return (
    ((lambda * Math.pow(velocity, 2)) / (2 * 9.8)) *
    (length / diameterMeters)
  );
}

function calculateVelocity(diameterMeters, flowRate) {
  return (4 * flowRate) / (Math.PI * Math.pow(diameterMeters, 2));
}

function calculateFrictionFactor(reynolds, diameterMeters, roughness) {
  let lambda = 0.02;
  for (let i = 0; i < 100; i++) {
    const temp =
      -2 *
      Math.log10(
        roughness / (3.7 * diameterMeters) +
          2.51 / (reynolds * Math.sqrt(lambda))
      );
    lambda = 1 / Math.pow(temp, 2);
  }
  return lambda;
}

function calculate() {
  const diameterMeters = parseFloat(
    document.getElementById("sectionDiameter").value
  );
  const flowRate =
    parseFloat(document.getElementById("sectionFlowRate").value) / 1000;
  const material = document.getElementById("sectionMaterial").value;
  const sectionId = parseInt(document.getElementById("sectionId").value);
  const section = sections.find((sec) => sec.id === sectionId);

  if (!section) {
    alert("Указанный участок не найден!");
    return;
  }

  const length = calculateLength(section);

  if (
    isNaN(diameterMeters) ||
    isNaN(length) ||
    isNaN(flowRate) ||
    diameterMeters < 0.01 ||
    diameterMeters > 2 ||
    length <= 0 ||
    flowRate <= 0
  ) {
    alert("Введите корректные данные!");
    return;
  }

  const viscosity = 1.31e-6;
  const velocity = calculateVelocity(diameterMeters, flowRate);
  const reynolds = (velocity * diameterMeters) / viscosity;

  let roughness;
  if (material === "steel") roughness = 0.00015;
  else if (material === "polyethylene") roughness = 0.0000015;
  else {
    alert("Некорректный материал!");
    return;
  }

  const lambda = calculateFrictionFactor(reynolds, diameterMeters, roughness);
  const headLoss = calculateHeadLoss(
    diameterMeters,
    length,
    flowRate,
    lambda
  );

  document.getElementById("velocity").innerText = velocity.toFixed(2);
  document.getElementById("head-loss").innerText = headLoss.toFixed(2);
  document.getElementById("reynolds").innerText = reynolds.toFixed(0);
  document.getElementById("section-length").innerText = length;

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
    const results = JSON.parse(savedResults);
    document.getElementById("velocity").innerText =
      results.velocity.toFixed(2);
    document.getElementById("head-loss").innerText =
      results.headLoss.toFixed(2);
    document.getElementById("reynolds").innerText =
      results.reynolds.toFixed(0);
    document.getElementById("section-length").innerText = results.length;
  }
}

function addNode() {
  const id = parseInt(document.getElementById("nodeId").value);
  const x = parseInt(document.getElementById("nodeX").value);
  const y = parseInt(document.getElementById("nodeY").value);
  const flowRate = parseFloat(document.getElementById("nodeFlowRate").value);

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
  const diameter = parseFloat(
    document.getElementById("sectionDiameter").value
  );

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

function calculateLength(section) {
  const startNode = nodes.find((node) => node.id === section.startNode);
  const endNode = nodes.find((node) => node.id === section.endNode);
  return Math.sqrt(
    Math.pow(endNode.x - startNode.x, 2) +
      Math.pow(endNode.y - startNode.y, 2)
  ).toFixed(2);
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
  ctx.fillText(`Длина: ${length} м`, midX, midY + 10);
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

window.onload = () => {
  loadResults();
  loadDiameters();
};
