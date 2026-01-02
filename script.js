// Init with default processes
document.addEventListener('DOMContentLoaded', () => {
    addProcess(0, 5, 1);
    addProcess(2, 3, 2);
    addProcess(4, 1, 3);

    setupAllCustomSelects();

    // Collapse history panel on mobile by default
    if (window.innerWidth <= 768) {
        const panel = document.getElementById('historyPanel');
        const toggleBtn = document.getElementById('historyToggleBtn');
        if (panel) {
            panel.classList.add('collapsed');
            if (toggleBtn) toggleBtn.style.transform = 'rotate(0deg)'; // Down arrow when collapsed
        }
    }
});

function togglePriority() {
    const btn = document.getElementById('prioToggleBtn');
    const input = document.getElementById('priorityMode');

    // Toggle the active class
    btn.classList.toggle("active");

    // Update hidden input using active state
    input.value = btn.classList.contains("active") ? "1" : "0";


}


function setupAllCustomSelects() {
    const selects = document.querySelectorAll('.custom-select');

    selects.forEach(selectContainer => {
        const trigger = selectContainer.querySelector('.select-trigger');
        const optionsContainer = selectContainer.querySelector('.select-options');
        const options = selectContainer.querySelectorAll('.option');
        const hiddenInput = selectContainer.querySelector('input[type="hidden"]');

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other selects
            document.querySelectorAll('.custom-select').forEach(s => {
                if (s !== selectContainer) s.classList.remove('open');
            });
            selectContainer.classList.toggle('open');
        });

        // Handle Option Click
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.getAttribute('data-value');
                const text = option.textContent;

                // Update UI
                trigger.textContent = text;
                hiddenInput.value = value;

                // Style active option
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // Close dropdown
                selectContainer.classList.remove('open');
            });
        });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        const openSelect = document.querySelector('.custom-select.open');
        if (openSelect && !openSelect.contains(e.target)) {
            openSelect.classList.remove('open');
        }
    });
}

function addProcess(at = 0, bt = 1, prio = 1) {
    const container = document.getElementById('processContainer');
    const rowCount = container.children.length + 1;

    const row = document.createElement('div');
    row.className = 'process-row';
    row.innerHTML = `
        <div class="pid-text">P${rowCount}</div>
        <input type="number" value="${at}" min="0" class="at-input">
        <input type="number" value="${bt}" min="1" class="bt-input">
        <input type="number" value="${prio}" min="1" class="prio-input">
        <button class="remove-btn" onclick="removeProcess(this)" aria-label="Remove process">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    container.appendChild(row);
}

function removeProcess(btn) {
    const container = document.getElementById('processContainer');
    if (container.children.length > 1) {
        btn.closest('.process-row').remove();
        updatePIDs();
    } else {
        alert("You need at least one process!");
    }
}

function updatePIDs() {
    const rows = document.querySelectorAll('.process-row');
    rows.forEach((row, index) => {
        row.querySelector('.pid-text').textContent = 'P' + (index + 1);
    });
}

function runSimulation() {
    // 1. Parse Input from DOM
    const rows = document.querySelectorAll('.process-row');
    const algo = document.getElementById('algorithm').value;
    const tq = parseInt(document.getElementById('timeQuantum').value);
    const prioMode = parseInt(document.getElementById('priorityMode').value); // 0 or 1

    let processes = Array.from(rows).map((row, index) => {
        const at = parseInt(row.querySelector('.at-input').value) || 0;
        const bt = parseInt(row.querySelector('.bt-input').value) || 1;
        const prio = parseInt(row.querySelector('.prio-input').value) || 1;

        return {
            id: index + 1,
            at: at,
            bt: bt,
            prio: prio,
            rem_bt: bt, // for RR/Preemptive
            ct: 0, tat: 0, wt: 0
        };
    });

    let gantt = []; // Stores { id, start, end }

    // 2. Algorithm Logic
    if (algo === 'FCFS') {
        processes.sort((a, b) => a.at - b.at);
        let currentTime = 0;

        processes.forEach(p => {
            if (currentTime < p.at) {
                gantt.push({ id: 'IDLE', start: currentTime, end: p.at });
                currentTime = p.at;
            }
            gantt.push({ id: p.id, start: currentTime, end: currentTime + p.bt });
            currentTime += p.bt;

            p.ct = currentTime;
            p.tat = p.ct - p.at;
            p.wt = p.tat - p.bt;
        });

    } else if (algo === 'SJF') { // Non-Preemptive
        let currentTime = 0;
        let completed = 0;
        let n = processes.length;
        let isCompleted = new Array(n).fill(false);

        while (completed < n) {
            let idx = -1;
            let minBt = Infinity;

            // Find process with min burst time that has arrived
            for (let i = 0; i < n; i++) {
                if (processes[i].at <= currentTime && !isCompleted[i]) {
                    if (processes[i].bt < minBt) {
                        minBt = processes[i].bt;
                        idx = i;
                    }
                }
            }

            if (idx !== -1) {
                gantt.push({ id: processes[idx].id, start: currentTime, end: currentTime + processes[idx].bt });
                currentTime += processes[idx].bt;
                processes[idx].ct = currentTime;
                processes[idx].tat = processes[idx].ct - processes[idx].at;
                processes[idx].wt = processes[idx].tat - processes[idx].bt;
                isCompleted[idx] = true;
                completed++;
            } else {
                gantt.push({ id: 'IDLE', start: currentTime, end: currentTime + 1 });
                currentTime++;
            }
        }

    } else if (algo === 'SJF_PRE') { // Preemptive
        let currentTime = 0;
        let completed = 0;
        let n = processes.length;

        // Loop until all processes are completed
        while (completed < n) {
            let idx = -1;
            let minRem = Infinity;

            // Find process with shortest remaining time that has arrived
            for (let i = 0; i < n; i++) {
                if (processes[i].at <= currentTime && processes[i].rem_bt > 0) {
                    if (processes[i].rem_bt < minRem) {
                        minRem = processes[i].rem_bt;
                        idx = i;
                    }
                }
            }

            if (idx !== -1) {
                // Check if we can merge with previous block in Gantt to avoid fragmentation
                let lastBlock = gantt[gantt.length - 1];
                if (lastBlock && lastBlock.id === processes[idx].id && lastBlock.end === currentTime) {
                    lastBlock.end++;
                } else {
                    gantt.push({ id: processes[idx].id, start: currentTime, end: currentTime + 1 });
                }

                processes[idx].rem_bt--;
                currentTime++;

                if (processes[idx].rem_bt === 0) {
                    completed++;
                    processes[idx].ct = currentTime;
                    processes[idx].tat = processes[idx].ct - processes[idx].at;
                    processes[idx].wt = processes[idx].tat - processes[idx].bt;
                }
            } else {
                // IDLE
                let lastBlock = gantt[gantt.length - 1];
                if (lastBlock && lastBlock.id === 'IDLE' && lastBlock.end === currentTime) {
                    lastBlock.end++;
                } else {
                    gantt.push({ id: 'IDLE', start: currentTime, end: currentTime + 1 });
                }
                currentTime++;
            }
        }

    } else if (algo === 'PRIORITY') { // Non-Preemptive
        let currentTime = 0;
        let completed = 0;
        let n = processes.length;
        let isCompleted = new Array(n).fill(false);

        while (completed < n) {
            let idx = -1;
            let bestPrio = (prioMode === 0) ? Infinity : -Infinity;

            // Find best priority process that has arrived
            for (let i = 0; i < n; i++) {
                if (processes[i].at <= currentTime && !isCompleted[i]) {
                    let isBetter = false;
                    if (prioMode === 0) { // Lower # = High
                        if (processes[i].prio < bestPrio) isBetter = true;
                    } else { // Higher # = High
                        if (processes[i].prio > bestPrio) isBetter = true;
                    }

                    if (isBetter) {
                        bestPrio = processes[i].prio;
                        idx = i;
                    }
                }
            }

            if (idx !== -1) {
                gantt.push({ id: processes[idx].id, start: currentTime, end: currentTime + processes[idx].bt });
                currentTime += processes[idx].bt;
                processes[idx].ct = currentTime;
                processes[idx].tat = processes[idx].ct - processes[idx].at;
                processes[idx].wt = processes[idx].tat - processes[idx].bt;
                isCompleted[idx] = true;
                completed++;
            } else {
                gantt.push({ id: 'IDLE', start: currentTime, end: currentTime + 1 });
                currentTime++;
            }
        }

    } else if (algo === 'RR') {
        // Sort by arrival initially
        processes.sort((a, b) => a.at - b.at);

        let currentTime = 0;
        let completed = 0;
        let queue = [];
        let n = processes.length;

        // Push first process(es)
        if (n > 0) {
            // Logic to handle gap at start
            if (processes[0].at > 0) {
                gantt.push({ id: 'IDLE', start: 0, end: processes[0].at });
                currentTime = processes[0].at;
            }
            queue.push(0);
            processes[0].inQ = true;
        }

        while (completed < n) {
            if (queue.length === 0) {
                // Jump to next arrival
                let nextIdx = -1;
                for (let i = 0; i < n; i++) {
                    if (processes[i].rem_bt > 0 && !processes[i].inQ) {
                        nextIdx = i; break;
                    }
                }
                if (nextIdx !== -1) {
                    if (processes[nextIdx].at > currentTime) {
                        gantt.push({ id: 'IDLE', start: currentTime, end: processes[nextIdx].at });
                        currentTime = processes[nextIdx].at;
                    }
                    queue.push(nextIdx);
                    processes[nextIdx].inQ = true;
                } else {
                    break; // Should be done
                }
            }

            let idx = queue.shift();
            let execTime = Math.min(tq, processes[idx].rem_bt);

            gantt.push({ id: processes[idx].id, start: currentTime, end: currentTime + execTime });
            processes[idx].rem_bt -= execTime;
            currentTime += execTime;

            // Check for new arrivals
            for (let i = 0; i < n; i++) {
                if (processes[i].at <= currentTime && processes[i].rem_bt > 0 && !processes[i].inQ && i !== idx) {
                    queue.push(i);
                    processes[i].inQ = true;
                }
            }

            if (processes[idx].rem_bt > 0) {
                queue.push(idx);
            } else {
                completed++;
                processes[idx].ct = currentTime;
                processes[idx].tat = processes[idx].ct - processes[idx].at;
                processes[idx].wt = processes[idx].tat - processes[idx].bt;
            }
        }
    }

    // 3. Render Output
    renderTable(processes);
    // Calculate stats for history
    const totalTat = processes.reduce((acc, p) => acc + p.tat, 0);
    const totalWt = processes.reduce((acc, p) => acc + p.wt, 0);
    const avgTat = (totalTat / processes.length).toFixed(2);
    const avgWt = (totalWt / processes.length).toFixed(2);
    const totalTime = processes[processes.length - 1].ct || gantt[gantt.length - 1].end;

    renderGantt(gantt, totalTime);

    // 4. Add to History
    addToHistory(algo, avgTat, avgWt, gantt, totalTime);
}

function renderTable(data) {
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    let totalTat = 0, totalWt = 0;

    data.sort((a, b) => a.id - b.id).forEach(p => {
        totalTat += p.tat;
        totalWt += p.wt;
        tbody.innerHTML += `
        <tr>
            <td>P${p.id}</td>
            <td>${p.at}</td>
            <td>${p.bt}</td>
            <td>${p.ct}</td>
            <td>${p.tat}</td>
            <td>${p.wt}</td>
        </tr>
    `;
    });

    document.getElementById('stats').innerHTML = `
    <div class="stat-item">
        <div class="stat-label">Avg Turnaround</div>
        <div class="stat-value">${(totalTat / data.length).toFixed(2)}</div>
    </div>
    <div class="stat-item">
        <div class="stat-label">Avg Waiting</div>
        <div class="stat-value">${(totalWt / data.length).toFixed(2)}</div>
    </div>
`;
}

let ganttTimeouts = [];

function clearGanttTimeouts() {
    ganttTimeouts.forEach(id => clearTimeout(id));
    ganttTimeouts = [];
}

function renderGantt(ganttData, totalTime) {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = '';
    clearGanttTimeouts();

    // Merge consecutive IDLEs or same PIDs for cleaner look
    // (Optional step omitted for simplicity)

    ganttData.forEach((item, index) => {
        const timeoutId = setTimeout(() => {
            const duration = item.end - item.start;
            const widthPct = (duration / totalTime) * 100;

            const block = document.createElement('div');
            // Cycle through pid-1, pid-2, pid-3
            const pidClass = item.id === 'IDLE' ? 'idle' : (((item.id - 1) % 3) + 1);
            block.className = `gantt-block pid-${pidClass}`;
            block.style.width = '0%'; // Start with 0 width for animation effect
            block.style.opacity = '0';
            block.innerHTML = `
            <span class="gantt-time-marker">${item.start}</span>
            <div class="pid-label">${item.id === 'IDLE' ? 'Idle' : 'P' + item.id}</div>
            ${item === ganttData[ganttData.length - 1] ? `<span class="end-time-marker">${item.end}</span>` : ''} 
        `;
            chart.appendChild(block);

            // Animate opening
            requestAnimationFrame(() => {
                block.style.transition = 'all 0.5s ease-out';
                block.style.width = `${widthPct}%`;
                block.style.opacity = '1';
            });

        }, index * 600); // 600ms delay between each block

        ganttTimeouts.push(timeoutId);
    });
}

function addToHistory(algo, avgTat, avgWt, ganttData, totalTime) {
    const list = document.getElementById('historyList');
    const emptyMsg = document.getElementById('emptyHistoryMsg');
    if (emptyMsg) emptyMsg.style.display = 'none';

    const item = document.createElement('div');
    item.className = 'history-item';

    // Get timestamp
    const timeStr = new Date().toLocaleTimeString();

    // Build simplified gantt html
    let miniGanttHtml = `<div class="mini-start-time">0</div>`;

    ganttData.forEach(block => {
        const duration = block.end - block.start;
        const widthPct = (duration / totalTime) * 100;
        let color = 'rgba(255,255,255,0.1)';
        let textColor = 'rgba(255, 255, 255, 0.9)'; // Default to white text

        if (block.id !== 'IDLE') {
            // Match simplified colors from main css
            const pidMod = ((block.id - 1) % 3) + 1;
            if (pidMod === 1) { color = '#43334C'; textColor = 'white'; }
            if (pidMod === 2) { color = '#E83C91'; textColor = 'white'; }
            if (pidMod === 3) { color = '#F8F4EC'; textColor = '#43334C'; } // Dark text for light bg
        } else {
            color = 'rgba(239, 68, 68, 0.4)'; // Reddish for idle in history
            textColor = 'white';
        }
        const pidText = block.id === 'IDLE' ? '' : 'P' + block.id;

        miniGanttHtml += `
            <div class="mini-block" style="width: ${widthPct}%; background: ${color}; color: ${textColor};" title="${block.id === 'IDLE' ? 'Idle' : 'P' + block.id}">
                ${pidText}
                <span class="mini-time">${block.end}</span>
            </div>`;
    });

    item.innerHTML = `
        <div class="history-header">
            <span class="history-algo">${algo}</span>
            <span class="history-time">${timeStr}</span>
        </div>
        <div class="history-stats-grid">
            <div class="h-stat">
                <label>AVG T.A.T</label>
                <span>${avgTat}</span>
            </div>
            <div class="h-stat">
                <label>AVG WAIT</label>
                <span>${avgWt}</span>
            </div>
        </div>
        <div class="mini-gantt" style="position: relative;">
            ${miniGanttHtml}
        </div>
    `;

    // Prepend to top
    list.insertBefore(item, list.firstChild);
}

function clearHistory() {
    const list = document.getElementById('historyList');
    const emptyMsg = document.getElementById('emptyHistoryMsg');

    // Remove all items except the empty message
    const items = list.querySelectorAll('.history-item');
    items.forEach(item => item.remove());

    if (emptyMsg) emptyMsg.style.display = 'block';
}

// Toggle history panel collapse (for mobile)
function toggleHistoryPanel() {
    const panel = document.getElementById('historyPanel');
    const toggleBtn = document.getElementById('historyToggleBtn');

    panel.classList.toggle('collapsed');

    // Rotate the chevron icon: down when collapsed, up when expanded
    if (panel.classList.contains('collapsed')) {
        toggleBtn.style.transform = 'rotate(0deg)'; // Down arrow
    } else {
        toggleBtn.style.transform = 'rotate(180deg)'; // Up arrow
    }
}
