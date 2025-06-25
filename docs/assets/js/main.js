y: { title: { display: true, text: 'Leistung (kW)' } }
                },
                elements: {
                    point: { radius: 4 }
                }
            }
        });
    }

    calculateMonthlyBoxplotData(column) {
        const monthlyData = Array.from({length: 12}, () => []);
        
        this.data.data.forEach(row => {
            const month = new Date(row.timestamp).getMonth();
            monthlyData[month].push(row[column]);
        });

        return monthlyData.map(data => {
            if (data.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
            
            const sorted = [...data].sort((a, b) => a - b);
            return {
                min: sorted[0],
                q1: this.calculatePercentile(sorted, 25),
                median: this.calculatePercentile(sorted, 50),
                q3: this.calculatePercentile(sorted, 75),
                max: sorted[sorted.length - 1]
            };
        });
    }

    generateDailyProfile() {
        const ctx = document.getElementById('dailyProfileChart').getContext('2d');
        
        if (this.charts.dailyProfile) {
            this.charts.dailyProfile.destroy();
        }

        const column = this.selectedColumns[0];
        const profileData = this.calculateDailyProfiles(column);

        this.charts.dailyProfile = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Werktag (Mo-Fr)',
                    data: profileData.weekday,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: false,
                    tension: 0.3
                }, {
                    label: 'Wochenende (Sa-So)',
                    data: profileData.weekend,
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: false,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Tagesprofil-Vergleich - ${column}`
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Uhrzeit' } },
                    y: { title: { display: true, text: 'Durchschnittliche Leistung (kW)' } }
                }
            }
        });
    }

    calculateDailyProfiles(column) {
        const weekdayData = Array.from({length: 24}, () => []);
        const weekendData = Array.from({length: 24}, () => []);

        this.data.data.forEach(row => {
            const date = new Date(row.timestamp);
            const hour = date.getHours();
            const dayOfWeek = date.getDay();
            
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
                weekdayData[hour].push(row[column]);
            } else { // Saturday and Sunday
                weekendData[hour].push(row[column]);
            }
        });

        return {
            weekday: weekdayData.map(hourData => 
                hourData.length > 0 ? hourData.reduce((sum, val) => sum + val, 0) / hourData.length : 0
            ),
            weekend: weekendData.map(hourData => 
                hourData.length > 0 ? hourData.reduce((sum, val) => sum + val, 0) / hourData.length : 0
            )
        };
    }

    generatePeakShaving() {
        const ctx = document.getElementById('peakShavingChart').getContext('2d');
        
        if (this.charts.peakShaving) {
            this.charts.peakShaving.destroy();
        }

        this.updatePeakShaving();
    }

    updatePeakShaving() {
        const sliderValue = document.getElementById('peak-shaving-slider').value;
        document.getElementById('peak-shaving-value').textContent = sliderValue;

        const column = this.selectedColumns[0];
        const values = this.data.data.map(row => row[column]);
        const maxValue = Math.max(...values);
        const threshold = (sliderValue / 100) * maxValue;
        
        const intervalHours = this.estimateIntervalHours();
        const savings = values.reduce((sum, val) => {
            return sum + (val > threshold ? (val - threshold) * intervalHours : 0);
        }, 0);

        document.getElementById('peak-shaving-savings').textContent = `${savings.toFixed(1)} kWh`;

        // Create chart showing original vs capped load
        const ctx = document.getElementById('peakShavingChart').getContext('2d');
        
        if (this.charts.peakShaving) {
            this.charts.peakShaving.destroy();
        }

        // Sample data for visualization (use every nth point to avoid performance issues)
        const sampleRate = Math.max(1, Math.floor(this.data.data.length / 1000));
        const sampledData = this.data.data.filter((_, index) => index % sampleRate === 0);

        this.charts.peakShaving = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sampledData.map((_, index) => index),
                datasets: [{
                    label: 'Originallast',
                    data: sampledData.map(row => row[column]),
                    borderColor: 'rgba(239, 68, 68, 0.8)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                }, {
                    label: 'Gekappte Last',
                    data: sampledData.map(row => Math.min(row[column], threshold)),
                    borderColor: 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                }, {
                    label: 'Kappungsgrenze',
                    data: Array(sampledData.length).fill(threshold),
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Peak-Shaving-Szenario - ${column}`
                    }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Zeitverlauf' },
                        display: false // Hide x-axis labels for cleaner look
                    },
                    y: { title: { display: true, text: 'Leistung (kW)' } }
                },
                elements: {
                    line: { tension: 0 }
                }
            }
        });
    }

    getColor(index, alpha = 1) {
        const colors = [
            `rgba(59, 130, 246, ${alpha})`,   // Blue
            `rgba(16, 185, 129, ${alpha})`,   // Green
            `rgba(245, 101, 101, ${alpha})`,  // Red
            `rgba(251, 191, 36, ${alpha})`,   // Yellow
            `rgba(139, 92, 246, ${alpha})`,   // Purple
            `rgba(236, 72, 153, ${alpha})`,   // Pink
            `rgba(14, 165, 233, ${alpha})`,   // Light Blue
            `rgba(34, 197, 94, ${alpha})`     // Light Green
        ];
        return colors[index % colors.length];
    }

    showProgress(percent, message) {
        document.getElementById('progress-container').classList.remove('hidden');
        document.getElementById('progress-bar').style.width = `${percent}%`;
        document.getElementById('progress-text').textContent = message;
    }

    hideProgress() {
        document.getElementById('progress-container').classList.add('hidden');
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        this.hideProgress();
    }

    showMainContent() {
        document.getElementById('main-content').classList.remove('hidden');
        document.getElementById('upload-section').style.display = 'none';
    }
}

// Chart download functionality
function downloadChart(chartId) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    // Create download link
    const link = document.createElement('a');
    link.download = `${chartId}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    new LoadAnalyzer();
});// Stromverbrauchsanalyse - Hauptlogik
class LoadAnalyzer {
    constructor() {
        this.data = null;
        this.selectedColumns = [];
        this.charts = {};
        this.maxFileSize = 50 * 1024 * 1024; // 50 MB
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        // Drag & Drop Events
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('drop', this.handleFileDrop.bind(this));

        // File Input Change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.processFile(e.target.files[0]);
            }
        });

        // Peak Shaving Slider
        const slider = document.getElementById('peak-shaving-slider');
        if (slider) {
            slider.addEventListener('input', this.updatePeakShaving.bind(this));
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
    }

    handleFileDrop(e) {
        e.preventDefault();
        const dropZone = e.currentTarget;
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        // Validate file
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showError('Bitte wählen Sie eine CSV-Datei aus.');
            return;
        }

        if (file.size > this.maxFileSize) {
            this.showError('Datei ist zu groß. Maximale Größe: 50 MB');
            return;
        }

        this.showProgress(0, 'Datei wird gelesen...');

        // Parse CSV
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: this.handleParseComplete.bind(this),
            error: this.handleParseError.bind(this)
        });
    }

    handleParseComplete(results) {
        try {
            this.showProgress(25, 'Daten werden validiert...');
            
            if (results.errors.length > 0) {
                console.warn('CSV Parsing Warnings:', results.errors);
            }

            // Validate and process data
            this.data = this.validateAndProcessData(results.data);
            
            this.showProgress(50, 'Spalten werden erkannt...');
            this.setupColumnSelection();
            
            this.showProgress(75, 'Visualisierungen werden erstellt...');
            this.generateAnalytics();
            
            this.showProgress(100, 'Fertig!');
            setTimeout(() => {
                this.hideProgress();
                this.showMainContent();
            }, 500);

        } catch (error) {
            this.showError(error.message);
        }
    }

    handleParseError(error) {
        this.showError(`Fehler beim Einlesen der CSV: ${error.message}`);
    }

    validateAndProcessData(rawData) {
        if (!rawData || rawData.length === 0) {
            throw new Error('CSV-Datei ist leer oder konnte nicht gelesen werden.');
        }

        const headers = Object.keys(rawData[0]);
        const timestampColumn = this.findTimestampColumn(headers);
        
        if (!timestampColumn) {
            throw new Error('Keine Zeitstempel-Spalte gefunden. Erwartet wird eine Spalte mit Datum/Zeit in ISO-8601 Format.');
        }

        const loadColumns = headers.filter(h => h !== timestampColumn && this.isNumericColumn(rawData, h));
        
        if (loadColumns.length === 0) {
            throw new Error('Keine numerischen Lastspalten gefunden.');
        }

        // Process and clean data
        const processedData = rawData
            .filter(row => row[timestampColumn]) // Remove rows without timestamp
            .map(row => {
                const timestamp = new Date(row[timestampColumn]);
                if (isNaN(timestamp.getTime())) {
                    return null; // Invalid timestamp
                }

                const processedRow = { timestamp };
                loadColumns.forEach(col => {
                    processedRow[col] = this.cleanNumericValue(row[col]);
                });

                return processedRow;
            })
            .filter(row => row !== null) // Remove invalid rows
            .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp

        if (processedData.length === 0) {
            throw new Error('Keine gültigen Datenzeilen nach der Bereinigung gefunden.');
        }

        // Check for monotonic timestamps
        this.validateTimestampSequence(processedData);

        return {
            data: processedData,
            columns: loadColumns,
            timestampColumn
        };
    }

    findTimestampColumn(headers) {
        const timestampPatterns = ['timestamp', 'time', 'datetime', 'date', 'zeit'];
        return headers.find(h => 
            timestampPatterns.some(pattern => 
                h.toLowerCase().includes(pattern)
            )
        ) || headers[0]; // Fallback to first column
    }

    isNumericColumn(data, columnName) {
        const sampleSize = Math.min(100, data.length);
        let numericCount = 0;
        
        for (let i = 0; i < sampleSize; i++) {
            const value = data[i][columnName];
            if (typeof value === 'number' && !isNaN(value)) {
                numericCount++;
            } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                numericCount++;
            }
        }
        
        return numericCount / sampleSize > 0.7; // At least 70% numeric values
    }

    cleanNumericValue(value) {
        if (typeof value === 'number' && !isNaN(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0; // Default for null/undefined/invalid values
    }

    validateTimestampSequence(data) {
        const gaps = [];
        for (let i = 1; i < Math.min(data.length, 1000); i++) {
            if (data[i].timestamp <= data[i-1].timestamp) {
                gaps.push(i);
            }
        }
        
        if (gaps.length > data.length * 0.1) {
            console.warn('Zeitstempel-Reihenfolge ist nicht vollständig monoton steigend.');
        }
    }

    setupColumnSelection() {
        const container = document.getElementById('column-checkboxes');
        container.innerHTML = '';

        this.data.columns.forEach(column => {
            const div = document.createElement('div');
            div.className = 'flex items-center';
            
            div.innerHTML = `
                <input type="checkbox" id="col-${column}" value="${column}" checked 
                       class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                <label for="col-${column}" class="ml-2 text-sm text-gray-700">${column}</label>
            `;
            
            container.appendChild(div);
            
            // Add event listener
            div.querySelector('input').addEventListener('change', this.handleColumnSelection.bind(this));
        });

        // Initialize with all columns selected
        this.selectedColumns = [...this.data.columns];
    }

    handleColumnSelection() {
        const checkboxes = document.querySelectorAll('#column-checkboxes input[type="checkbox"]');
        this.selectedColumns = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        if (this.selectedColumns.length > 0) {
            this.generateAnalytics();
        }
    }

    generateAnalytics() {
        if (!this.data || this.selectedColumns.length === 0) return;

        this.generateKPIs();
        this.generateLoadDurationCurve();
        this.generateHistogram();
        this.generateHeatmap();
        this.generateMonthlyChart();
        this.generateBoxplots();
        this.generateDailyProfile();
        this.generatePeakShaving();
    }

    generateKPIs() {
        const container = document.getElementById('kpi-dashboard');
        container.innerHTML = '';

        this.selectedColumns.forEach(column => {
            const values = this.data.data.map(row => row[column]).filter(v => v > 0);
            const sortedValues = [...values].sort((a, b) => b - a);
            
            const totalConsumption = this.calculateTotalConsumption(column);
            const peakLoad = Math.max(...values);
            const utilizationHours = totalConsumption / peakLoad;
            const percentile95 = this.calculatePercentile(sortedValues, 95);

            const kpiCard = document.createElement('div');
            kpiCard.className = 'bg-white rounded-lg shadow-md p-6';
            kpiCard.innerHTML = `
                <h4 class="text-lg font-semibold mb-4 text-center">${column}</h4>
                <div class="space-y-3">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600">${(totalConsumption/1000).toFixed(1)}</div>
                        <div class="text-sm text-gray-600">MWh/Jahr</div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="text-center">
                            <div class="font-semibold">${peakLoad.toFixed(1)}</div>
                            <div class="text-gray-600">Spitzenlast (kW)</div>
                        </div>
                        <div class="text-center">
                            <div class="font-semibold">${utilizationHours.toFixed(0)}</div>
                            <div class="text-gray-600">Benutzungsstunden</div>
                        </div>
                        <div class="text-center">
                            <div class="font-semibold">${percentile95.toFixed(1)}</div>
                            <div class="text-gray-600">95-Perzentil (kW)</div>
                        </div>
                        <div class="text-center">
                            <div class="font-semibold">${values.length.toLocaleString()}</div>
                            <div class="text-gray-600">Messpunkte</div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(kpiCard);
        });
    }

    calculateTotalConsumption(column) {
        // Assuming 15-minute intervals, calculate total consumption
        const intervalHours = this.estimateIntervalHours();
        return this.data.data.reduce((sum, row) => sum + (row[column] * intervalHours), 0);
    }

    estimateIntervalHours() {
        if (this.data.data.length < 2) return 0.25; // Default 15 minutes
        
        const interval = (this.data.data[1].timestamp - this.data.data[0].timestamp) / (1000 * 60 * 60);
        return Math.max(0.01, interval); // Minimum 0.01 hours (36 seconds)
    }

    calculatePercentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)] || 0;
    }

    generateLoadDurationCurve() {
        const ctx = document.getElementById('loadDurationChart').getContext('2d');
        
        if (this.charts.loadDuration) {
            this.charts.loadDuration.destroy();
        }

        const datasets = this.selectedColumns.map((column, index) => {
            const values = this.data.data.map(row => row[column]).filter(v => v > 0);
            const sortedValues = [...values].sort((a, b) => b - a);
            
            return {
                label: column,
                data: sortedValues.map((value, i) => ({
                    x: (i / sortedValues.length) * 100,
                    y: value
                })),
                borderColor: this.getColor(index),
                backgroundColor: this.getColor(index, 0.1),
                fill: false,
                tension: 0.1
            };
        });

        this.charts.loadDuration = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Lastdauerkurve'
                    },
                    legend: {
                        display: this.selectedColumns.length > 1
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Überschreitungsdauer (%)' },
                        min: 0,
                        max: 100
                    },
                    y: {
                        title: { display: true, text: 'Leistung (kW)' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    generateHistogram() {
        const ctx = document.getElementById('histogramChart').getContext('2d');
        
        if (this.charts.histogram) {
            this.charts.histogram.destroy();
        }

        // Use first selected column for histogram
        const column = this.selectedColumns[0];
        const values = this.data.data.map(row => row[column]).filter(v => v > 0);
        const bins = this.createHistogramBins(values, 20);

        this.charts.histogram = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`),
                datasets: [{
                    label: 'Häufigkeit',
                    data: bins.map(bin => bin.count),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Leistungsverteilung - ${column}`
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: 'Leistung (kW)' } },
Anzahl Messpunkte' } }
                }
            }
        });
    }

    createHistogramBins(values, numBins) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binWidth = (max - min) / numBins;
        const bins = [];

        for (let i = 0; i < numBins; i++) {
            const binMin = min + i * binWidth;
            const binMax = binMin + binWidth;
            const count = values.filter(v => v >= binMin && (i === numBins - 1 ? v <= binMax : v < binMax)).length;
            
            bins.push({ min: binMin, max: binMax, count });
        }

        return bins;
    }

    generateHeatmap() {
        const ctx = document.getElementById('heatmapChart').getContext('2d');
        
        if (this.charts.heatmap) {
            this.charts.heatmap.destroy();
        }

        const column = this.selectedColumns[0];
        const heatmapData = this.createHeatmapData(column);

        this.charts.heatmap = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
                datasets: Array.from({length: 24}, (_, hour) => ({
                    label: `${hour}:00`,
                    data: heatmapData[hour] || [0,0,0,0,0,0,0],
                    backgroundColor: this.getHeatmapColor(hour),
                    stack: 'hours'
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Wochentagsprofil - ${column}`
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { title: { display: true, text: 'Wochentag' } },
                    y: { 
                        title: { display: true, text: 'Durchschnittliche Leistung (kW)' },
                        stacked: false
                    }
                }
            }
        });
    }

    createHeatmapData(column) {
        const heatmapData = {};
        
        // Initialize data structure
        for (let hour = 0; hour < 24; hour++) {
            heatmapData[hour] = new Array(7).fill(0);
        }

        const hourlyData = {};
        this.data.data.forEach(row => {
            const date = new Date(row.timestamp);
            const hour = date.getHours();
            const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
            
            const key = `${hour}-${dayOfWeek}`;
            if (!hourlyData[key]) {
                hourlyData[key] = [];
            }
            hourlyData[key].push(row[column]);
        });

        // Calculate averages
        Object.keys(hourlyData).forEach(key => {
            const [hour, dayOfWeek] = key.split('-').map(Number);
            const average = hourlyData[key].reduce((sum, val) => sum + val, 0) / hourlyData[key].length;
            heatmapData[hour][dayOfWeek] = average;
        });

        return heatmapData;
    }

    getHeatmapColor(hour) {
        const intensity = hour / 23;
        return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
    }

    generateMonthlyChart() {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        const monthlyData = this.calculateMonthlyData();
        const datasets = this.selectedColumns.map((column, index) => ({
            label: column,
            data: monthlyData.map(month => month[column] || 0),
            backgroundColor: this.getColor(index, 0.7),
            borderColor: this.getColor(index),
            borderWidth: 1
        }));

        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
                datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monatsverbrauch'
                    },
                    legend: {
                        display: this.selectedColumns.length > 1
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Monat' } },
                    y: { title: { display: true, text: 'Verbrauch (MWh)' } }
                }
            }
        });
    }

    calculateMonthlyData() {
        const monthlyData = Array.from({length: 12}, () => ({}));
        const intervalHours = this.estimateIntervalHours();

        this.data.data.forEach(row => {
            const month = new Date(row.timestamp).getMonth();
            this.selectedColumns.forEach(column => {
                if (!monthlyData[month][column]) {
                    monthlyData[month][column] = 0;
                }
                monthlyData[month][column] += (row[column] * intervalHours) / 1000; // Convert to MWh
            });
        });

        return monthlyData;
    }

    generateBoxplots() {
        const ctx = document.getElementById('boxplotChart').getContext('2d');
        
        if (this.charts.boxplot) {
            this.charts.boxplot.destroy();
        }

        const column = this.selectedColumns[0];
        const monthlyBoxData = this.calculateMonthlyBoxplotData(column);

        // Create box plot using line chart with error bars simulation
        const datasets = [{
            label: 'Median',
            data: monthlyBoxData.map(data => data.median),
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: false
        }, {
            label: '25-75 Perzentil',
            data: monthlyBoxData.map(data => data.q3),
            borderColor: 'rgba(16, 185, 129, 0.8)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: '+1'
        }, {
            label: '',
            data: monthlyBoxData.map(data => data.q1),
            borderColor: 'rgba(16, 185, 129, 0.8)',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: false
        }];

        this.charts.boxplot = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
                datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Monatliche Verteilung - ${column}`
                    },
                    legend: {
                        filter: (item) => item.text !== ''
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Monat' } },
                    y: { title: { display: true, text: '
