 // -------------------- Классы --------------------
 class Node {
  constructor(id, x, y, flow) {
    this.id = parseInt(id);
    this.x = parseFloat(x);
    this.y = parseFloat(y);
    this.flow = parseFloat(flow);
  }
}

class Pipe {
  constructor(startNode, endNode, pipeName = null) {
    this.startNode = startNode;
    this.endNode = endNode;
    this.pipeName = pipeName;
    this.length = this.calculateLength();
  }
  calculateLength() {
    const dx = this.endNode.x - this.startNode.x;
    const dy = this.endNode.y - this.startNode.y;
    return parseFloat(Math.sqrt(dx * dx + dy * dy).toFixed(2));
  }
}

// -------------------- Глобальные переменные --------------------
const diameters = []; // Данные из tubes.json
let nodes = [];
let pipes = [];
let currentMatrix = null; // Для хранения текущей матрицы
let gaussSteps = []; // Для хранения шагов метода Гаусса

// -------------------- Инициализация --------------------
document.addEventListener("DOMContentLoaded", () => {
  loadTubesJSON();

  // Переключение отображения секции выбора диаметра для пластиковых труб
  document
    .getElementById("material")
    .addEventListener("change", function () {
      document.getElementById("diameterSection").style.display =
        this.value === "plastic" ? "block" : "none";
    });

  document
    .getElementById("addNodeBtn")
    .addEventListener("click", addNode);
  document
    .getElementById("addConnectionBtn")
    .addEventListener("click", addConnection);
  document
    .getElementById("buildNetworkBtn")
    .addEventListener("click", buildNetwork);
  document
    .getElementById("solveMatrixBtn")
    .addEventListener("click", solveSystem);
  document
    .getElementById("toggleDetailedSolutionBtn")
    .addEventListener("click", toggleDetailedSolution);
  document
    .getElementById("showMatrixBtn")
    .addEventListener("click", showMatrix);
});

function loadTubesJSON() {
  fetch("pipes.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          "Ошибка загрузки pipes.json: " + response.statusText
        );
      }
      return response.json();
    })
    .then((data) => {
      diameters.length = 0;
      const diameterSelect = document.getElementById("diameter");
      diameterSelect.innerHTML =
        '<option value="">Выберите диаметр</option>';
      data.forEach((tube) => {
        diameters.push(tube);
        const option = new Option(
          tube["Обозначение в проекте"],
          tube["Обозначение в проекте"]
        );
        diameterSelect.add(option);
      });
    })
    .catch((error) => {
      console.error("Ошибка при загрузке JSON:", error);
      alert("Не удалось загрузить данные о трубах");
    });
}

// -------------------- Добавление узлов --------------------
function addNode() {
  const id = document.getElementById("nodeId").value.trim();
  const x = document.getElementById("nodeX").value.trim();
  const y = document.getElementById("nodeY").value.trim();
  let flow = document.getElementById("nodeFlow").value.trim();

  if (!id || !x || !y || flow === "") {
    alert("Заполните все поля узла корректными данными!");
    return;
  }

  flow = parseFloat(flow);

  if (nodes.some((n) => n.id == id)) {
    alert("Узел с таким ID уже существует!");
    return;
  }

  // Если это первый узел (насосная станция), автоматически рассчитываем его расход
  if (nodes.length === 0 && flow === 0) {
    alert(
      "Для первого узла (насосной станции) расход будет рассчитан автоматически"
    );
  }

  const node = new Node(id, x, y, flow);
  nodes.push(node);

  updateNodeSelects();
  clearNodeInputs();
  buildNetwork();
}

// Функция для расчета расхода насосной станции
function calculatePumpNodeFlow() {
  if (nodes.length < 2) return;

  // Находим узел насосной станции (обычно это первый узел)
  const pumpNode = nodes[0];

  // Суммируем все положительные расходы в других узлах
  let totalFlow = 0;
  for (let i = 1; i < nodes.length; i++) {
    totalFlow += nodes[i].flow;
  }

  // Устанавливаем отрицательный расход для узла насосной станции
  pumpNode.flow = -totalFlow;

  // Обновляем отображение
  buildNetwork();
}

function updateNodeSelects() {
  const startSelect = document.getElementById("startNode");
  const endSelect = document.getElementById("endNode");

  startSelect.innerHTML = '<option value="">Выберите узел</option>';
  endSelect.innerHTML = '<option value="">Выберите узел</option>';

  nodes.forEach((node) => {
    const option = new Option(
      `Узел ${node.id} (${node.x}, ${node.y})`,
      node.id
    );
    startSelect.add(option.cloneNode(true));
    endSelect.add(option.cloneNode(true));
  });
}

function clearNodeInputs() {
  document.getElementById("nodeId").value = "";
  document.getElementById("nodeX").value = "";
  document.getElementById("nodeY").value = "";
  document.getElementById("nodeFlow").value = "";
}

// -------------------- Добавление соединений --------------------
function addConnection() {
  const material = document.getElementById("material").value;
  if (material === "steel") {
    alert("Данные для стальных труб временно недоступны");
    return;
  }

  const startId = document.getElementById("startNode").value;
  const endId = document.getElementById("endNode").value;
  const pipeName = document.getElementById("diameter").value;

  if (!startId || !endId || startId === endId) {
    alert("Выберите два различных узла для соединения");
    return;
  }

  const startNode = nodes.find((n) => n.id == startId);
  const endNode = nodes.find((n) => n.id == endId);
  if (!startNode || !endNode) {
    alert("Ошибка: не найдены выбранные узлы!");
    return;
  }

  // Проверяем, не существует ли уже такое соединение
  const exists = pipes.some(
    (p) =>
      (p.startNode.id == startId && p.endNode.id == endId) ||
      (p.startNode.id == endId && p.endNode.id == startId)
  );

  if (exists) {
    alert("Такое соединение уже существует!");
    return;
  }

  if (!pipeName) {
    alert("Выберите диаметр трубы");
    return;
  }

  const pipe = new Pipe(startNode, endNode, pipeName);
  pipes.push(pipe);

  updateSegmentDetails();
  buildNetwork();
}

function updateSegmentDetails() {
  const segmentList = document.getElementById("segmentDetails");
  if (!segmentList) return;
  segmentList.innerHTML = "";
  pipes.forEach((pipe, index) => {
    const li = document.createElement("li");
    li.textContent = `Участок ${index + 1}: Узел ${
      pipe.startNode.id
    } → Узел ${pipe.endNode.id} = ${pipe.length} м (${pipe.pipeName})`;
    segmentList.appendChild(li);
  });
}

// -------------------- Построение схемы на Canvas --------------------
function buildNetwork() {
  const canvas = document.getElementById("networkCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Масштабирование и центрирование схемы
  const padding = 50;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  nodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const scaleX = (canvas.width - 2 * padding) / Math.max(maxX - minX, 1);
  const scaleY = (canvas.height - 2 * padding) / Math.max(maxY - minY, 1);
  const scale = Math.min(scaleX, scaleY);

  function transformX(x) {
    return padding + (x - minX) * scale;
  }

  function transformY(y) {
    return canvas.height - padding - (y - minY) * scale;
  }

  // Отрисовка труб
  pipes.forEach((pipe) => {
    const startX = transformX(pipe.startNode.x);
    const startY = transformY(pipe.startNode.y);
    const endX = transformX(pipe.endNode.x);
    const endY = transformY(pipe.endNode.y);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Отрисовка отметки длины трубы в середине линии
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    ctx.fillStyle = "#2c3e50";
    ctx.font = "12px Arial";
    ctx.fillText(`${pipe.length} м`, midX + 10, midY);
  });

  // Отрисовка узлов
  nodes.forEach((node) => {
    const x = transformX(node.x);
    const y = transformY(node.y);

    // Круг узла
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = "#e74c3c";
    ctx.fill();
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Текст с ID узла и расходом
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#2c3e50";
    ctx.fillText(node.id, x - (node.id < 10 ? 4 : 8), y + 4);

    ctx.font = "12px Arial";
    ctx.fillText(`${node.flow} л/с`, x + 15, y + 5);
  });
}

// -------------------- Гидравлический расчет --------------------
function calculateHydraulics(pipe, flowRate) {
  const material = document.getElementById("material").value;
  let diameter, roughness;

  if (material === "steel") {
    diameter = 0.1; // Для стальных труб
    roughness = 0.00015;
  } else {
    const tube = diameters.find(
      (t) => t["Обозначение в проекте"] === pipe.pipeName
    );
    if (tube) {
      diameter =
        tube["Dн - наружный диаметр"] || tube["Диаметр, мм"] || 20;
      diameter = diameter / 1000; // Переводим в метры
    } else {
      diameter = 0.02; // По умолчанию 20 мм
    }
    roughness = 0.0000015; // Для пластиковых труб
  }

  const flowRateM3 = Math.abs(flowRate) / 1000; // Переводим л/с в м³/с
  const velocity = (4 * flowRateM3) / (Math.PI * Math.pow(diameter, 2));
  const Re = (velocity * diameter) / 1.31e-6; // Число Рейнольдса

  // Расчет коэффициента гидравлического трения (лямбда)
  let lambda;
  if (Re < 2000) {
    // Ламинарный режим
    lambda = 64 / Re;
  } else {
    // Турбулентный режим (формула Альтшуля)
    const relativeRoughness = roughness / diameter;
    lambda = 0.11 * Math.pow(relativeRoughness + 68 / Re, 0.25);
  }

  // Потери напора по длине (Дарси-Вейсбаха)
  const g = 9.81;
  const headLoss =
    (lambda * pipe.length * Math.pow(velocity, 2)) / (diameter * 2 * g);

  return {
    velocity: velocity.toFixed(3),
    headLoss: headLoss.toFixed(3),
    reynolds: Math.round(Re),
    lambda: lambda,
    diameter: diameter,
  };
}

// -------------------- Решение системы уравнений --------------------
function solveSystem() {
  // Перед расчетом обновляем расход насосной станции
  calculatePumpNodeFlow();

  if (nodes.length < 2 || pipes.length === 0) {
    alert("Добавьте минимум 2 узла и 1 соединение для расчёта.");
    return;
  }

  const logText = ["=== Начало расчета ==="];

  // 1. Формируем матрицу системы уравнений
  const matrix = [];
  gaussSteps = []; // Очищаем предыдущие шаги

  // Уравнения баланса расходов для каждого узла (кроме первого)
  for (let i = 1; i < nodes.length; i++) {
    const row = new Array(pipes.length).fill(0);
    let sumFlow = 0;

    pipes.forEach((pipe, j) => {
      if (pipe.startNode.id === nodes[i].id) {
        row[j] = -1; // Узел - начало участка
        sumFlow -= nodes[i].flow;
      } else if (pipe.endNode.id === nodes[i].id) {
        row[j] = 1; // Узел - конец участка
        sumFlow += nodes[i].flow;
      }
    });

    row.push(sumFlow);
    matrix.push(row);
  }

  logText.push("\nМатрица уравнений по узлам:");
  logText.push(matrixToString(matrix));

  // 2. Находим контура (циклы) в сети
  const cycles = findCycles();
  logText.push("\nНайдено контуров: " + cycles.length);

  // Добавляем уравнения для контуров
  cycles.forEach((cycle) => {
    const row = new Array(pipes.length).fill(0);

    cycle.forEach((sign, pipeIdx) => {
      if (sign !== 0) {
        row[pipeIdx] = sign;
      }
    });

    row.push(0); // Правая часть уравнения контура всегда 0
    matrix.push(row);

    logText.push(
      `Контур: ${cycle
        .map((s, i) => (s !== 0 ? `${s > 0 ? "+" : "-"}уч${i + 1}` : ""))
        .filter(Boolean)
        .join(" ")} = 0`
    );
  });

  logText.push("\nПолная матрица системы (узлы + контуры):");
  logText.push(matrixToString(matrix));

  // Сохраняем матрицу для отображения
  currentMatrix = {
    matrix: matrix,
    cycles: cycles,
    nodes: nodes,
    pipes: pipes,
  };

  // 3. Решаем систему методом Гаусса
  const solution = solveGauss(matrix, pipes.length);

  if (!solution) {
    alert("Не удалось решить систему уравнений");
    return;
  }

  logText.push("\nПервичное решение (расходы по участкам):");
  solution.forEach((q, i) => {
    logText.push(`Участок ${i + 1}: ${q.toFixed(4)} л/с`);
  });

  // 4. Корректировка методом Кросса
  logText.push("\n=== Корректировка по контурам ===");
  const correctedSolution = crossMethod(solution, cycles, logText);

  // 5. Вывод результатов
  displayResults(solution, correctedSolution, logText);

  document.getElementById("detailedSolution").innerHTML =
    logText.join("\n");
  document.getElementById("detailedSolution").style.display = "none";
}

// Поиск циклов (контуров) в сети
function findCycles() {
  if (nodes.length === 0 || pipes.length === 0) return [];

  const graph = {};
  nodes.forEach((n) => {
    graph[n.id] = [];
  });

  pipes.forEach((pipe, index) => {
    graph[pipe.startNode.id].push({
      neighbor: pipe.endNode.id,
      pipeIndex: index,
    });
    graph[pipe.endNode.id].push({
      neighbor: pipe.startNode.id,
      pipeIndex: index,
    });
  });

  const visited = {};
  const parent = {};
  const treeEdges = new Set();

  function dfs(u) {
    visited[u] = true;
    graph[u].forEach((item) => {
      if (!visited[item.neighbor]) {
        parent[item.neighbor] = { parent: u, edge: item.pipeIndex };
        treeEdges.add(item.pipeIndex);
        dfs(item.neighbor);
      }
    });
  }

  const startNodeId = nodes[0].id;
  dfs(startNodeId);

  // Находим хорды (не вошедшие в дерево)
  const chords = [];
  pipes.forEach((pipe, index) => {
    if (!treeEdges.has(index)) {
      chords.push(index);
    }
  });

  // Для каждой хорды находим цикл
  const cycles = [];
  chords.forEach((chordIndex) => {
    const chord = pipes[chordIndex];
    const u = chord.startNode.id;
    const v = chord.endNode.id;

    // Находим путь между u и v в дереве
    const path = [];
    let current = u;
    while (current !== undefined) {
      path.push(current);
      current = parent[current]?.parent;
    }

    current = v;
    const pathV = [];
    while (current !== undefined) {
      pathV.push(current);
      current = parent[current]?.parent;
    }

    // Находим общий узел (корень пути)
    let lca = null;
    for (let node of path) {
      if (pathV.includes(node)) {
        lca = node;
        break;
      }
    }

    // Собираем полный цикл
    const cycle = [];
    for (let node of path) {
      if (node === lca) break;
      cycle.push(node);
    }

    for (let node of pathV.reverse()) {
      if (node === lca) break;
      cycle.push(node);
    }

    // Добавляем начальный узел для замыкания цикла
    cycle.push(u);

    // Создаем уравнение контура
    const cycleRow = new Array(pipes.length).fill(0);
    cycleRow[chordIndex] = 1; // Хорда всегда +1

    // Добавляем ребра дерева с учетом направления
    for (let i = 0; i < cycle.length - 1; i++) {
      const a = cycle[i];
      const b = cycle[i + 1];

      const pipe = pipes.find(
        (p) =>
          (p.startNode.id == a && p.endNode.id == b) ||
          (p.startNode.id == b && p.endNode.id == a)
      );

      if (pipe) {
        const idx = pipes.indexOf(pipe);
        const sign =
          pipe.startNode.id == a && pipe.endNode.id == b ? 1 : -1;
        cycleRow[idx] = -sign; // Ребра дерева идут с обратным знаком
      }
    }

    cycles.push(cycleRow);
  });

  return cycles;
}

// Решение системы методом Гаусса
function solveGauss(matrix, n) {
  const m = matrix.length;
  if (m < n) {
    console.error("Система имеет бесконечно много решений");
    return null;
  }

  // Создаем копию матрицы для работы
  const workMatrix = matrix.map((row) => [...row]);

  // Сохраняем начальное состояние матрицы
  saveGaussStep(workMatrix, "Начальная матрица");

  // Прямой ход
  for (let i = 0; i < n; i++) {
    // Поиск ведущего элемента
    let maxRow = i;
    for (let j = i + 1; j < m; j++) {
      if (Math.abs(workMatrix[j][i]) > Math.abs(workMatrix[maxRow][i])) {
        maxRow = j;
      }
    }

    // Перестановка строк
    if (maxRow !== i) {
      [workMatrix[i], workMatrix[maxRow]] = [
        workMatrix[maxRow],
        workMatrix[i],
      ];
      saveGaussStep(
        workMatrix,
        `Перестановка строк ${i + 1} и ${maxRow + 1}`
      );
    }

    // Проверка на вырожденность
    if (Math.abs(workMatrix[i][i]) < 1e-10) {
      console.error("Матрица вырождена");
      return null;
    }

    // Нормализация строки
    const pivot = workMatrix[i][i];
    for (let j = i; j <= n; j++) {
      workMatrix[i][j] /= pivot;
    }
    saveGaussStep(
      workMatrix,
      `Нормализация строки ${i + 1} (деление на ${pivot.toFixed(2)})`
    );

    // Исключение
    for (let k = 0; k < m; k++) {
      if (k !== i && workMatrix[k][i] !== 0) {
        const factor = workMatrix[k][i];
        for (let j = i; j <= n; j++) {
          workMatrix[k][j] -= factor * workMatrix[i][j];
        }
        saveGaussStep(
          workMatrix,
          `Исключение переменной из строки ${k + 1} (вычитание строки ${
            i + 1
          } * ${factor.toFixed(2)})`
        );
      }
    }
  }

  // Извлечение решения
  const solution = new Array(n);
  for (let i = 0; i < n; i++) {
    solution[i] = workMatrix[i][n] || 0;
  }

  return solution;
}

// Сохранение шага метода Гаусса
function saveGaussStep(matrix, description) {
  // Создаем глубокую копию матрицы
  const matrixCopy = matrix.map((row) => [...row]);
  gaussSteps.push({
    matrix: matrixCopy,
    description: description,
  });
}

// Метод Кросса для корректировки расходов
function crossMethod(initialSolution, cycles, logText) {
  const solution = [...initialSolution];
  const maxIterations = 100;
  const tolerance = 0.5; // Допустимая невязка, м

  logText.push("\nНачало корректировки методом Кросса");

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxDelta = 0;

    cycles.forEach((cycle, cycleIndex) => {
      let sumHeadLoss = 0;
      let sumDerivative = 0;

      logText.push(`\nКонтур ${cycleIndex + 1}, итерация ${iter + 1}:`);

      // Вычисляем сумму потерь напора в контуре
      cycle.forEach((sign, pipeIdx) => {
        if (sign !== 0) {
          const pipe = pipes[pipeIdx];
          const q = solution[pipeIdx];
          const hyd = calculateHydraulics(pipe, q);
          const headLoss = parseFloat(hyd.headLoss) || 0;

          sumHeadLoss += sign * headLoss;
          logText.push(
            `Уч.${pipeIdx + 1}: q=${q.toFixed(4)}, h=${headLoss.toFixed(
              4
            )}, знак=${sign}`
          );

          // Вычисляем производную dh/dq = 2 * k * q
          const k =
            (hyd.lambda * pipe.length) /
            ((2 *
              9.81 *
              Math.pow(hyd.diameter, 5) *
              Math.pow(Math.PI, 2)) /
              16);
          sumDerivative += 2 * k * Math.abs(q);
        }
      });

      logText.push(`Сумма потерь: ${sumHeadLoss.toFixed(4)} м`);

      // Если невязка превышает допуск, корректируем расходы
      if (Math.abs(sumHeadLoss) > tolerance) {
        const deltaQ = -sumHeadLoss / (2 * sumDerivative);
        logText.push(`Дельта q: ${deltaQ.toFixed(6)}`);

        // Применяем поправку к участкам контура
        cycle.forEach((sign, pipeIdx) => {
          if (sign !== 0) {
            solution[pipeIdx] += sign * deltaQ;
            maxDelta = Math.max(maxDelta, Math.abs(deltaQ));
          }
        });
      }
    });

    // Проверка сходимости
    if (maxDelta < 0.01) {
      logText.push(`\nСходимость достигнута на итерации ${iter + 1}`);
      break;
    }
  }

  return solution;
}

// Вывод результатов расчета
function displayResults(initialSolution, correctedSolution, logText) {
  const solutionSection = document.getElementById("solutionSection");

  // Таблица с первичным решением
  const tbody = document.querySelector("#solutionTable tbody");
  tbody.innerHTML = "";

  initialSolution.forEach((q, i) => {
    const pipe = pipes[i];
    const hyd = calculateHydraulics(pipe, q);

    const tr = document.createElement("tr");
    tr.innerHTML = `
              <td>${pipe.startNode.id} → ${pipe.endNode.id} (${
      pipe.pipeName
    })</td>
              <td>${q.toFixed(4)}</td>
              <td>${hyd.velocity}</td>
              <td>${hyd.headLoss}</td>
              <td>${hyd.reynolds}</td>
          `;
    tbody.appendChild(tr);
  });

  // Таблица с корректированным решением
  const correctionDiv = document.getElementById("correctionResults");
  correctionDiv.innerHTML = `
          <h3>Скорректированные расходы</h3>
          <table>
              <thead>
                  <tr>
                      <th>Участок</th>
                      <th>Расход (л/с)</th>
                      <th>Скорость (м/с)</th>
                      <th>Потери напора (м)</th>
                  </tr>
              </thead>
              <tbody>
                  ${correctedSolution
                    .map((q, i) => {
                      const pipe = pipes[i];
                      const hyd = calculateHydraulics(pipe, q);
                      return `
                          <tr>
                              <td>${pipe.startNode.id} → ${
                        pipe.endNode.id
                      } (${pipe.pipeName})</td>
                              <td>${q.toFixed(4)}</td>
                              <td>${hyd.velocity}</td>
                              <td>${hyd.headLoss}</td>
                          </tr>
                      `;
                    })
                    .join("")}
              </tbody>
          </table>
      `;

  logText.push("\n=== Результаты расчета ===");
  logText.push("Первичные и скорректированные расходы:");
  initialSolution.forEach((q, i) => {
    logText.push(
      `Уч.${i + 1}: было ${q.toFixed(4)}, стало ${correctedSolution[
        i
      ].toFixed(4)} л/с`
    );
  });
}

// -------------------- Вспомогательные функции --------------------
function matrixToString(mat) {
  let str = "";
  const colWidths = new Array(mat[0].length).fill(0);

  // Определяем максимальную ширину для каждого столбца
  mat.forEach((row) => {
    row.forEach((val, j) => {
      const valStr = val.toFixed(4);
      colWidths[j] = Math.max(colWidths[j], valStr.length);
    });
  });

  // Форматируем вывод
  mat.forEach((row) => {
    row.forEach((val, j) => {
      const valStr = val.toFixed(4).padStart(colWidths[j]);
      str += valStr + "  ";
    });
    str += "\n";
  });

  return str;
}

function toggleDetailedSolution() {
  const detailedDiv = document.getElementById("detailedSolution");
  const toggleBtn = document.getElementById("toggleDetailedSolutionBtn");

  if (
    detailedDiv.style.display === "none" ||
    detailedDiv.style.display === ""
  ) {
    detailedDiv.style.display = "block";
    toggleBtn.textContent = "Скрыть подробное решение";
  } else {
    detailedDiv.style.display = "none";
    toggleBtn.textContent = "Показать подробное решение";
  }
}

function showMatrix() {
  if (!currentMatrix) {
    alert("Сначала выполните расчет системы");
    return;
  }

  const matrixDisplay = document.getElementById("matrixDisplay");
  matrixDisplay.innerHTML = "";

  // Создаем таблицу для отображения матрицы и шагов метода Гаусса
  const table = document.createElement("table");

  // Заголовок таблицы
  const thead = document.createElement("thead");
  let headerRow = document.createElement("tr");

  // Заголовки для матрицы
  const matrixHeader = document.createElement("th");
  matrixHeader.textContent = "Матрица системы";
  matrixHeader.colSpan = currentMatrix.matrix[0].length + 1;
  headerRow.appendChild(matrixHeader);

  // Заголовок для шагов решения
  const stepsHeader = document.createElement("th");
  stepsHeader.textContent = "Процесс решения (метод Гаусса)";
  headerRow.appendChild(stepsHeader);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Подзаголовок с номерами участков и свободными членами
  headerRow = document.createElement("tr");

  // Номера участков
  for (let i = 0; i < currentMatrix.pipes.length; i++) {
    const th = document.createElement("th");
    th.textContent = `Уч.${i + 1}`;
    th.className = "matrix-header";
    headerRow.appendChild(th);
  }

  // Свободные члены
  const freeTh = document.createElement("th");
  freeTh.textContent = "Св.чл.";
  freeTh.className = "matrix-header";
  headerRow.appendChild(freeTh);

  // Пустой заголовок для столбца с решением
  const solutionTh = document.createElement("th");
  solutionTh.className = "matrix-header";
  headerRow.appendChild(solutionTh);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Тело таблицы с уравнениями
  const tbody = document.createElement("tbody");

  // Уравнения по узлам
  for (let i = 0; i < currentMatrix.nodes.length - 1; i++) {
    const row = document.createElement("tr");

    // Заголовок строки (уравнение узла)
    const nodeHeader = document.createElement("td");
    nodeHeader.textContent = `Узел ${currentMatrix.nodes[i + 1].id}`;
    nodeHeader.className = "matrix-header";
    row.appendChild(nodeHeader);

    // Коэффициенты уравнения
    for (let j = 0; j < currentMatrix.pipes.length; j++) {
      const td = document.createElement("td");
      td.className = "matrix-cell";
      td.textContent = currentMatrix.matrix[i][j].toFixed(2);
      if (currentMatrix.matrix[i][j] === 0) td.classList.add("zero-cell");
      row.appendChild(td);
    }

    // Свободный член
    const freeTd = document.createElement("td");
    freeTd.className = "matrix-cell";
    freeTd.textContent =
      currentMatrix.matrix[i][currentMatrix.pipes.length].toFixed(2);
    row.appendChild(freeTd);

    // Шаги решения (если есть)
    const stepTd = document.createElement("td");
    if (gaussSteps.length > 0 && i < gaussSteps[0].matrix.length) {
      stepTd.innerHTML = `<div class="gauss-explanation">${gaussSteps[0].description}</div>`;
      stepTd.className = "gauss-step";
    }
    row.appendChild(stepTd);

    tbody.appendChild(row);
  }

  // Уравнения контуров
  for (let i = 0; i < currentMatrix.cycles.length; i++) {
    const row = document.createElement("tr");
    const cycleRow =
      currentMatrix.matrix[currentMatrix.nodes.length - 1 + i];

    // Заголовок строки (уравнение контура)
    const cycleHeader = document.createElement("td");
    cycleHeader.textContent = `Контур ${i + 1}`;
    cycleHeader.className = "matrix-header";
    row.appendChild(cycleHeader);

    // Коэффициенты уравнения
    for (let j = 0; j < currentMatrix.pipes.length; j++) {
      const td = document.createElement("td");
      td.className = "matrix-cell";
      td.textContent = cycleRow[j].toFixed(2);
      if (cycleRow[j] === 0) td.classList.add("zero-cell");
      row.appendChild(td);
    }

    // Свободный член
    const freeTd = document.createElement("td");
    freeTd.className = "matrix-cell";
    freeTd.textContent = cycleRow[currentMatrix.pipes.length].toFixed(2);
    row.appendChild(freeTd);

    // Шаги решения (если есть)
    const stepTd = document.createElement("td");
    if (
      gaussSteps.length > 0 &&
      currentMatrix.nodes.length - 1 + i < gaussSteps[0].matrix.length
    ) {
      stepTd.innerHTML = `<div class="gauss-explanation">${gaussSteps[0].description}</div>`;
      stepTd.className = "gauss-step";
    }
    row.appendChild(stepTd);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  matrixDisplay.appendChild(table);

  // Добавляем кнопки для навигации по шагам метода Гаусса
  if (gaussSteps.length > 1) {
    const navDiv = document.createElement("div");
    navDiv.style.marginTop = "10px";
    navDiv.style.textAlign = "center";

    const prevButton = document.createElement("button");
    prevButton.textContent = "Предыдущий шаг";
    prevButton.addEventListener("click", () => showGaussStep(-1));
    navDiv.appendChild(prevButton);

    const nextButton = document.createElement("button");
    nextButton.textContent = "Следующий шаг";
    nextButton.addEventListener("click", () => showGaussStep(1));
    navDiv.appendChild(nextButton);

    const stepInfo = document.createElement("span");
    stepInfo.id = "gaussStepInfo";
    stepInfo.style.margin = "0 15px";
    navDiv.appendChild(stepInfo);

    matrixDisplay.appendChild(navDiv);

    // Инициализируем отображение шагов
    currentGaussStep = 0;
    updateGaussStepDisplay();
  }

  matrixDisplay.style.display = "block";
}

let currentGaussStep = 0;

function showGaussStep(direction) {
  currentGaussStep += direction;
  if (currentGaussStep < 0) currentGaussStep = 0;
  if (currentGaussStep >= gaussSteps.length)
    currentGaussStep = gaussSteps.length - 1;

  updateGaussStepDisplay();
}

function updateGaussStepDisplay() {
  const stepInfo = document.getElementById("gaussStepInfo");
  if (!stepInfo) return;

  stepInfo.textContent = `Шаг ${currentGaussStep + 1} из ${
    gaussSteps.length
  }`;

  // Обновляем матрицу для текущего шага
  const matrixCells = document.querySelectorAll(
    "#matrixDisplay tbody td.matrix-cell"
  );
  const stepDescriptions = document.querySelectorAll(
    "#matrixDisplay tbody td.gauss-step"
  );

  // Обновляем значения в матрице
  for (let i = 0; i < gaussSteps[currentGaussStep].matrix.length; i++) {
    const row = gaussSteps[currentGaussStep].matrix[i];
    for (let j = 0; j < row.length; j++) {
      const cellIndex = i * (currentMatrix.pipes.length + 1) + j;
      if (cellIndex < matrixCells.length) {
        matrixCells[cellIndex].textContent = row[j].toFixed(2);
        matrixCells[cellIndex].className = "matrix-cell";
        if (row[j] === 0)
          matrixCells[cellIndex].classList.add("zero-cell");

        // Подсвечиваем ведущий элемент
        if (
          i === currentGaussStep &&
          j === currentGaussStep &&
          currentGaussStep < currentMatrix.pipes.length
        ) {
          matrixCells[cellIndex].classList.add("pivot-cell");
        }
      }
    }
  }

  // Обновляем описания шагов
  stepDescriptions.forEach((td, i) => {
    if (i < gaussSteps.length) {
      td.innerHTML = `<div class="gauss-explanation">${gaussSteps[currentGaussStep].description}</div>`;
    }
  });
}