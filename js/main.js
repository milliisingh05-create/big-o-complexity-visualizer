"use strict";

const SORT_ARRAY_SIZE = 18;
const COMPARE_DELAY = 180;
const WRITE_DELAY = 130;
const DEFAULT_INPUT_SIZE = 10;
const SAFE_INPUT_MIN = 1;
const SAFE_INPUT_MAX = 1000;
const DEFAULT_SORTING_ALGORITHM = "bubble-sort";
const SAFE_OPERATION_LIMIT = Number.MAX_SAFE_INTEGER;
const SUPPORTED_SORTING_ALGORITHMS = new Set(["bubble-sort", "merge-sort"]);

// Shared complexity definitions drive the chart, calculations, and explanations.
const complexities = {
  constant: {
    label: "O(1)",
    name: "Constant Time",
    color: "#2563EB",
    calculate: () => 1,
    explain: "Constant time stays the same no matter how large the input becomes."
  },
  logarithmic: {
    label: "O(log n)",
    name: "Logarithmic Time",
    color: "#16A34A",
    calculate: (inputSize) => Math.log2(inputSize),
    explain: "Logarithmic time grows slowly because each step usually reduces the remaining work."
  },
  linear: {
    label: "O(n)",
    name: "Linear Time",
    color: "#7C3AED",
    calculate: (inputSize) => inputSize,
    explain: "Linear time grows at the same rate as the input size."
  },
  linearithmic: {
    label: "O(n log n)",
    name: "Linearithmic Time",
    color: "#F59E0B",
    calculate: (inputSize) => inputSize * Math.log2(inputSize),
    explain: "Linearithmic time is common in efficient comparison sorting algorithms."
  },
  quadratic: {
    label: "O(n^2)",
    name: "Quadratic Time",
    color: "#DC2626",
    calculate: (inputSize) => inputSize * inputSize,
    explain: "Quadratic time grows quickly because each item may be compared with many other items."
  },
  exponential: {
    label: "O(2^n)",
    name: "Exponential Time",
    color: "#DB2777",
    calculate: (inputSize) => Math.pow(2, inputSize),
    explain: "Exponential time grows extremely fast and becomes impractical for larger inputs."
  }
};

const inputSizeSlider = document.querySelector("#input-size");
const inputSizeOutput = document.querySelector("#input-size-output");
const updateChartButton = document.querySelector("#update-chart");
const complexityCheckboxes = document.querySelectorAll('input[name="complexity"]');
const complexityResults = document.querySelector("#complexity-results");
const selectedComplexityName = document.querySelector("#selected-complexity-name");
const selectedComplexityDescription = document.querySelector("#selected-complexity-description");
const chartCanvas = document.querySelector("#complexity-chart");
const cheatSheetSearch = document.querySelector("#cheat-sheet-search");
const cheatSheetRows = document.querySelectorAll("#cheat-sheet-body tr");
const cheatSheetEmpty = document.querySelector("#cheat-sheet-empty");
const sortingAlgorithm = document.querySelector("#sorting-algorithm");
const generateArrayButton = document.querySelector("#generate-array");
const startSortingButton = document.querySelector("#start-sorting");
const sortingDisplay = document.querySelector("#sorting-display");
const sortingStatus = document.querySelector("#sorting-status");
const comparisonCount = document.querySelector("#comparison-count");
const secondaryOperationLabel = document.querySelector("#secondary-operation-label");
const swapCount = document.querySelector("#swap-count");
const bubbleSortInfo = document.querySelector("#bubble-sort-info");
const mergeSortInfo = document.querySelector("#merge-sort-info");

let sortingValues = [];
let activeExplanationKey = "constant";
let complexityChart = null;
let chartLoadErrorShown = false;
let comparisons = 0;
let secondaryOperations = 0;
let isSorting = false;
let calculationFrameId = 0;

// Finite number parsing keeps unexpected strings, NaN, and Infinity away from UI math.
function parseFiniteNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clampNumber(value, min, max, fallback) {
  const numericValue = parseFiniteNumber(value, fallback);
  return Math.min(Math.max(numericValue, min), max);
}

function getInputRange() {
  const minimum = clampNumber(inputSizeSlider?.min, SAFE_INPUT_MIN, SAFE_INPUT_MAX, 1);
  const maximum = clampNumber(inputSizeSlider?.max, SAFE_INPUT_MIN, SAFE_INPUT_MAX, 50);

  // Range normalization prevents a broken or edited slider from creating invalid labels.
  return {
    min: Math.min(minimum, maximum),
    max: Math.max(minimum, maximum)
  };
}

function getSafeInputSize() {
  const { min, max } = getInputRange();
  const fallback = clampNumber(DEFAULT_INPUT_SIZE, min, max, min);
  const inputSize = Math.round(clampNumber(inputSizeSlider?.value, min, max, fallback));

  // Keep the DOM value synchronized after browser devtools or script changes.
  if (inputSizeSlider && inputSizeSlider.value !== String(inputSize)) {
    inputSizeSlider.value = String(inputSize);
  }

  if (inputSizeSlider) {
    inputSizeSlider.setAttribute("aria-valuemin", String(min));
    inputSizeSlider.setAttribute("aria-valuemax", String(max));
    inputSizeSlider.setAttribute("aria-valuenow", String(inputSize));
    inputSizeSlider.setAttribute("aria-valuetext", `${inputSize} items`);
  }

  return inputSize;
}

function isSupportedComplexity(key) {
  return Object.prototype.hasOwnProperty.call(complexities, key);
}

function getSelectedComplexities() {
  // Filtering protects chart and explanation code from unexpected checkbox values.
  return Array.from(complexityCheckboxes)
    .filter((checkbox) => checkbox.checked && isSupportedComplexity(checkbox.value))
    .map((checkbox) => checkbox.value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "Too large";
  }

  if (value >= 1000000) {
    return value.toExponential(2);
  }

  return Number(value.toFixed(2)).toLocaleString();
}

function calculateSafely(key, inputSize) {
  const complexity = complexities[key];

  if (!complexity) {
    return null;
  }

  const safeInputSize = clampNumber(inputSize, getInputRange().min, getInputRange().max, DEFAULT_INPUT_SIZE);
  const value = complexity.calculate(safeInputSize);

  // Invalid, negative, and unsafe values are never passed through to Chart.js or text output.
  if (!Number.isFinite(value) || value < 0 || value > SAFE_OPERATION_LIMIT) {
    return null;
  }

  return value;
}

function createLabels(inputSize) {
  const safeInputSize = Math.round(clampNumber(inputSize, getInputRange().min, getInputRange().max, DEFAULT_INPUT_SIZE));
  return Array.from({ length: safeInputSize }, (_, index) => index + 1);
}

function createDataset(key, labels) {
  const complexity = complexities[key];

  if (!complexity) {
    return null;
  }

  return {
    label: complexity.label,
    data: labels.map((input) => calculateSafely(key, input)),
    borderColor: complexity.color,
    backgroundColor: complexity.color,
    borderWidth: 3,
    pointRadius: labels.length <= 20 ? 3 : 0,
    pointHoverRadius: 5,
    tension: 0.25
  };
}

function showChartLoadError() {
  if (!chartCanvas || chartLoadErrorShown) {
    return;
  }

  chartCanvas.insertAdjacentText("afterend", "Chart.js could not be loaded.");
  chartLoadErrorShown = true;
}

function createChart(inputSize, selectedKeys) {
  if (!chartCanvas) {
    return;
  }

  if (!window.Chart) {
    showChartLoadError();
    return;
  }

  const labels = createLabels(inputSize);
  const datasets = selectedKeys.map((key) => createDataset(key, labels)).filter(Boolean);

  try {
    complexityChart = new window.Chart(chartCanvas, {
      type: "line",
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index"
        },
        plugins: {
          legend: {
            position: "bottom"
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Input size (n)"
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Operations"
            },
            ticks: {
              callback: (value) => formatNumber(value)
            }
          }
        }
      }
    });
  } catch (error) {
    // A failed third-party chart initialization should not stop the rest of the app.
    console.error("Unable to initialize the complexity chart.", error);
    complexityChart = null;
    showChartLoadError();
  }
}

function updateChart(inputSize, selectedKeys) {
  if (!chartCanvas) {
    return;
  }

  if (!complexityChart) {
    createChart(inputSize, selectedKeys);
    return;
  }

  const labels = createLabels(inputSize);
  const datasets = selectedKeys.map((key) => createDataset(key, labels)).filter(Boolean);

  complexityChart.data.labels = labels;
  complexityChart.data.datasets = datasets;

  try {
    complexityChart.update();
  } catch (error) {
    // Chart update failures are contained so controls and sorting keep working.
    console.error("Unable to update the complexity chart.", error);
    complexityChart = null;
    showChartLoadError();
  }
}

function updateCalculations() {
  const inputSize = getSafeInputSize();
  const selectedKeys = getSelectedComplexities();

  if (!selectedKeys.includes(activeExplanationKey)) {
    activeExplanationKey = selectedKeys[0] || "";
  }

  if (inputSizeOutput) {
    inputSizeOutput.value = String(inputSize);
    inputSizeOutput.textContent = String(inputSize);
  }

  if (complexityResults) {
    complexityResults.replaceChildren();

    selectedKeys.forEach((key) => {
      const complexity = complexities[key];
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      const operationCount = calculateSafely(key, inputSize);

      term.textContent = `${complexity.label} - ${complexity.name}`;
      detail.textContent = `${formatNumber(operationCount)} operations at n = ${inputSize}`;

      complexityResults.append(term, detail);
    });

    if (selectedKeys.length === 0) {
      const emptyMessage = document.createElement("dd");
      emptyMessage.textContent = "Select at least one complexity to calculate growth.";
      complexityResults.append(emptyMessage);
    }
  }

  updateExplanation(activeExplanationKey);
  updateChart(inputSize, selectedKeys);
}

function scheduleCalculations() {
  if (calculationFrameId && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(calculationFrameId);
  }

  if (!window.requestAnimationFrame) {
    updateCalculations();
    return;
  }

  calculationFrameId = window.requestAnimationFrame(() => {
    calculationFrameId = 0;
    updateCalculations();
  });
}

function updateExplanation(selectedKey) {
  if (!selectedComplexityName || !selectedComplexityDescription) {
    return;
  }

  if (!selectedKey || !isSupportedComplexity(selectedKey)) {
    selectedComplexityName.textContent = "Selected Complexity";
    selectedComplexityDescription.textContent = "Choose a complexity to see how it behaves.";
    return;
  }

  const complexity = complexities[selectedKey];
  selectedComplexityName.textContent = `${complexity.label} - ${complexity.name}`;
  selectedComplexityDescription.textContent = complexity.explain;
}

function filterCheatSheet() {
  if (!cheatSheetSearch) {
    return;
  }

  const query = cheatSheetSearch.value.trim().toLowerCase();
  let visibleRows = 0;

  cheatSheetRows.forEach((row) => {
    // Empty search deliberately shows all rows instead of leaving stale hidden matches.
    const isVisible = query === "" || (row.textContent || "").toLowerCase().includes(query);
    row.hidden = !isVisible;

    if (isVisible) {
      visibleRows += 1;
    }
  });

  if (cheatSheetEmpty) {
    cheatSheetEmpty.hidden = visibleRows > 0;
  }
}

function sleep(milliseconds) {
  const delay = Math.max(0, parseFiniteNumber(milliseconds, 0));

  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function updateSortingStatus(message) {
  if (sortingStatus) {
    sortingStatus.textContent = message;
  }

  if (sortingDisplay) {
    sortingDisplay.setAttribute("aria-label", message);
  }
}

function resetSortingStats() {
  comparisons = 0;
  secondaryOperations = 0;

  if (comparisonCount) {
    comparisonCount.textContent = String(comparisons);
  }

  if (swapCount) {
    swapCount.textContent = String(secondaryOperations);
  }
}

function updateSortingControls(disabled) {
  [generateArrayButton, startSortingButton, sortingAlgorithm].forEach((control) => {
    if (!control) {
      return;
    }

    // Native disabled plus aria-disabled keeps the in-progress state clear to assistive tech.
    control.disabled = disabled;
    control.setAttribute("aria-disabled", String(disabled));
  });
}

function getSelectedSortingAlgorithm() {
  const selectedAlgorithm = sortingAlgorithm?.value || DEFAULT_SORTING_ALGORITHM;
  return SUPPORTED_SORTING_ALGORITHMS.has(selectedAlgorithm) ? selectedAlgorithm : DEFAULT_SORTING_ALGORITHM;
}

function beginSorting(label) {
  isSorting = true;
  updateSortingControls(true);
  resetSortingStats();
  updateSortingInfo();
  updateSortingStatus(`${label} visualization in progress.`);
}

function finishSorting(label) {
  renderSortingBars({
    sortedFromIndex: 0
  });
  updateSortingStatus(`${label} visualization complete.`);
  isSorting = false;
  updateSortingControls(false);
}

function updateSortingInfo() {
  const isMergeSort = getSelectedSortingAlgorithm() === "merge-sort";

  if (secondaryOperationLabel) {
    secondaryOperationLabel.textContent = isMergeSort ? "Writes" : "Swaps";
  }

  if (bubbleSortInfo) {
    bubbleSortInfo.hidden = isMergeSort;
  }

  if (mergeSortInfo) {
    mergeSortInfo.hidden = !isMergeSort;
  }
}

function sanitizeSortingValue(value) {
  return Math.round(clampNumber(value, 0, 100, 0));
}

function generateSortingArray() {
  if (isSorting) {
    return;
  }

  updateSortingInfo();
  sortingValues = Array.from({ length: SORT_ARRAY_SIZE }, () => Math.floor(Math.random() * 90) + 10);
  resetSortingStats();
  renderSortingBars();
  updateSortingStatus("New random array generated.");
}

function renderSortingBars(state = {}) {
  if (!sortingDisplay) {
    return;
  }

  const comparing = new Set(Array.isArray(state.comparing) ? state.comparing : []);
  const swapping = new Set(Array.isArray(state.swapping) ? state.swapping : []);
  const writing = new Set(Array.isArray(state.writing) ? state.writing : []);
  const sortedFromIndex = Math.round(clampNumber(state.sortedFromIndex, 0, sortingValues.length, sortingValues.length));
  const fragment = document.createDocumentFragment();

  // Values are clamped before rendering so invalid data cannot create broken bar heights.
  sortingValues = sortingValues.map(sanitizeSortingValue);

  // Bars are recreated as a tiny fragment, keeping animation state explicit per frame.
  sortingValues.forEach((value, index) => {
    const bar = document.createElement("span");
    bar.className = "sorting-bar";
    bar.style.height = `${value}%`;
    bar.title = String(value);
    bar.setAttribute("aria-hidden", "true");

    if (comparing.has(index)) {
      bar.classList.add("is-comparing");
    }

    if (swapping.has(index)) {
      bar.classList.add("is-swapping");
    }

    if (writing.has(index)) {
      bar.classList.add("is-writing");
    }

    if (index >= sortedFromIndex) {
      bar.classList.add("is-sorted");
    }

    fragment.append(bar);
  });

  sortingDisplay.replaceChildren(fragment);
}

async function runBubbleSort() {
  if (isSorting) {
    return;
  }

  beginSorting("Bubble Sort");

  try {
    for (let pass = 0; pass < sortingValues.length - 1; pass += 1) {
      let swappedThisPass = false;

      for (let index = 0; index < sortingValues.length - pass - 1; index += 1) {
        comparisons += 1;

        if (comparisonCount) {
          comparisonCount.textContent = String(comparisons);
        }

        renderSortingBars({
          comparing: [index, index + 1],
          sortedFromIndex: sortingValues.length - pass
        });
        await sleep(COMPARE_DELAY);

        if (sortingValues[index] > sortingValues[index + 1]) {
          secondaryOperations += 1;

          if (swapCount) {
            swapCount.textContent = String(secondaryOperations);
          }

          [sortingValues[index], sortingValues[index + 1]] = [sortingValues[index + 1], sortingValues[index]];
          swappedThisPass = true;
          renderSortingBars({
            swapping: [index, index + 1],
            sortedFromIndex: sortingValues.length - pass
          });
          await sleep(COMPARE_DELAY);
        }
      }

      renderSortingBars({
        sortedFromIndex: sortingValues.length - pass - 1
      });

      if (!swappedThisPass) {
        break;
      }
    }
  } finally {
    finishSorting("Bubble Sort");
  }
}

async function mergeSections(start, middle, end) {
  const leftValues = sortingValues.slice(start, middle);
  const rightValues = sortingValues.slice(middle, end);
  const mergedValues = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftValues.length && rightIndex < rightValues.length) {
    const leftDisplayIndex = start + leftIndex;
    const rightDisplayIndex = middle + rightIndex;

    comparisons += 1;

    if (comparisonCount) {
      comparisonCount.textContent = String(comparisons);
    }

    renderSortingBars({
      comparing: [leftDisplayIndex, rightDisplayIndex]
    });
    await sleep(COMPARE_DELAY);

    if (leftValues[leftIndex] <= rightValues[rightIndex]) {
      mergedValues.push(leftValues[leftIndex]);
      leftIndex += 1;
    } else {
      mergedValues.push(rightValues[rightIndex]);
      rightIndex += 1;
    }
  }

  mergedValues.push(...leftValues.slice(leftIndex), ...rightValues.slice(rightIndex));

  for (let index = 0; index < mergedValues.length; index += 1) {
    const writeIndex = start + index;

    sortingValues[writeIndex] = sanitizeSortingValue(mergedValues[index]);
    secondaryOperations += 1;

    if (swapCount) {
      swapCount.textContent = String(secondaryOperations);
    }

    renderSortingBars({
      writing: [writeIndex]
    });
    await sleep(WRITE_DELAY);
  }
}

async function mergeSortRange(start, end) {
  if (end - start <= 1) {
    return;
  }

  const middle = Math.floor((start + end) / 2);

  await mergeSortRange(start, middle);
  await mergeSortRange(middle, end);
  await mergeSections(start, middle, end);
}

async function runMergeSort() {
  if (isSorting) {
    return;
  }

  beginSorting("Merge Sort");

  try {
    await mergeSortRange(0, sortingValues.length);
  } finally {
    finishSorting("Merge Sort");
  }
}

function startSortingVisualization() {
  if (sortingValues.length === 0) {
    generateSortingArray();
  }

  if (getSelectedSortingAlgorithm() === "merge-sort") {
    runMergeSort();
    return;
  }

  runBubbleSort();
}

inputSizeSlider?.addEventListener("input", scheduleCalculations);
updateChartButton?.addEventListener("click", updateCalculations);
complexityCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    if (checkbox.checked && isSupportedComplexity(checkbox.value)) {
      activeExplanationKey = checkbox.value;
    }

    scheduleCalculations();
  });
});
cheatSheetSearch?.addEventListener("input", filterCheatSheet);
generateArrayButton?.addEventListener("click", generateSortingArray);
sortingAlgorithm?.addEventListener("change", () => {
  resetSortingStats();
  updateSortingInfo();
  renderSortingBars();
});
startSortingButton?.addEventListener("click", startSortingVisualization);

// Initialization is safe even when optional DOM pieces are missing.
generateSortingArray();
updateCalculations();
