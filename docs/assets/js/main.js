import Papa from 'papaparse';
import Chart from 'chart.js/auto';
import 'chartjs-chart-matrix'; // echte Heatmap-Unterstützung
import { parse, isValid } from 'date-fns';

class LoadAnalyzer {
  constructor() {
    this.rawData = null;
    this.data = null;
    this.resampled = null;
    this.selectedColumns = [];
    this.charts = {};
    this.maxFileSize = 50 * 1024 * 1024; // 50 MB
    this.unitMode = 'power'; // 'power' (kW) oder 'energy' (kWh)
    this.resolution = null; // in Stunden
    this.customDateFormat = null;
    this.customGroups = [];
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resolutionSelect = document.getElementById('resolution-select');
    const unitSwitch = document.getElementById('unit-switch');
    const formatInput = document.getElementById('date-format-input');
    const addGroupBtn = document.getElementById('add-group-btn');

    // Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    dropZone.addEventListener('drop', this.handleFileDrop.bind(this));

    // File Input
    fileInput.addEventListener('change', e => {
      if (e.target.files.length > 0) this.processFile(e.target.files[0]);
    });

    // Auflösungswahl
    resolutionSelect.addEventListener('change', e => {
      this.resolution = parseFloat(e.target.value) || null;
      if (this.rawData) {
        this.applyResampling();
        this.generateAnalytics();
      }
    });

    // Einheiten-Umschaltung
    unitSwitch.addEventListener('change', e => {
      this.unitMode = e.target.checked ? 'energy' : 'power';
      if (this.data) this.generateAnalytics();
    });

    // Benutzerdefiniertes Datumsformat
    formatInput.addEventListener('input', e => {
      this.customDateFormat = e.target.value || null;
    });

    // Custom Groups
    addGroupBtn.addEventListener('click', () => this.showAddGroupModal());
    document.getElementById('group-save-btn')?.addEventListener('click', this.saveCustomGroup.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  }

  handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
    const files = e.dataTransfer.files;
    if (files.length > 0) this.processFile(files[0]);
  }

  processFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.showError('Bitte wählen Sie eine CSV-Datei aus.');
      return;
    }
    if (file.size > this.maxFileSize) {
      this.showError('Datei ist zu groß. Maximale Größe: 50 MB');
      return;
    }
    this.showProgress(0, 'Datei wird gelesen...');
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: this.handleParseComplete.bind(this),
      error: this.handleParseError.bind(this),
    });
  }

  handleParseComplete(results) {
    if (results.errors.length > 0) console.warn('CSV Parsing Warnings:', results.errors);
    this.rawData = results.data;
    this.headers = Object.keys(this.rawData[0] || {});
    this.showTimestampSelection();
    this.showProgress(25, 'Daten wurden geladen');
  }

  handleParseError(error) {
    this.showError(`Fehler beim Einlesen der CSV: ${error.message}`);
  }

  showTimestampSelection() {
    const container = document.getElementById('timestamp-selection');
    const dateSelect = document.getElementById('date-column');
    const timeSelect = document.getElementById('time-column');
    const formatInput = document.getElementById('date-format-input');

    dateSelect.innerHTML = '';
    timeSelect.innerHTML = '<option value="">(keine)</option>';
    formatInput.value = this.customDateFormat || '';

    this.headers.forEach(h => {
      const optDate = document.createElement('option');
      optDate.value = h;
      optDate.textContent = h;
      dateSelect.appendChild(optDate);
      const optTime = document.createElement('option');
      optTime.value = h;
      optTime.textContent = h;
      timeSelect.appendChild(optTime);
    });

    // Automatischer Vorschlag
    const guess = this.findTimestampColumns(this.headers);
    if (guess.timestamp) {
      dateSelect.value = guess.timestamp;
      timeSelect.value = '';
    } else {
      if (guess.date) dateSelect.value = guess.date;
      if (guess.time) timeSelect.value = guess.time;
    }

    container.classList.remove('hidden');
  }

  handleTimestampConfirm() {
    const dateCol = document.getElementById('date-column').value;
    const timeCol = document.getElementById('time-column').value || null;
    try {
      this.data = this.validateAndProcessData(this.rawData, dateCol, timeCol);
      document.getElementById('timestamp-selection').classList.add('hidden');
      this.setupColumnSelection();
      this.applyResampling();
      this.generateAnalytics();
      this.showMainContent();
      this.showProgress(100, 'Fertig!');
      setTimeout(() => this.hideProgress(), 500);
    } catch (e) {
      this.showError(e.message);
    }
  }

  validateAndProcessData(rawData, dateCol, timeCol) {
    if (!rawData || rawData.length === 0) throw new Error('CSV-Datei ist leer oder konnte nicht gelesen werden.');
    const loadCols = Object.keys(rawData[0]).filter(h => h !== dateCol && h !== timeCol && this.isNumericColumn(rawData, h));
    if (loadCols.length === 0) throw new Error('Keine numerischen Lastspalten gefunden.');
    const processed = rawData.map(r => {
      const ts = this.parseTimestamp(r[dateCol], timeCol ? r[timeCol] : null);
      if (!ts) return null;
      const row = { timestamp: ts };
      loadCols.forEach(c => {
        row[c] = this.cleanNumericValue(r[c]);
      });
      return row;
    }).filter(r => r).sort((a, b) => a.timestamp - b.timestamp);
    if (processed.length === 0) throw new Error('Keine gültigen Datenzeilen nach der Bereinigung gefunden.');
    this.detectGaps(processed);
    return { data: processed, columns: loadCols, dateCol, timeCol };
  }

  findTimestampColumns(headers) {
    const tsP = ['timestamp', 'datetime', 'zeitstempel'];
    const dateP = ['date', 'datum'];
    const timeP = ['time', 'uhrzeit'];
    const timestamp = headers.find(h => tsP.some(p => h.toLowerCase().includes(p)));
    const date = headers.find(h => dateP.some(p => h.toLowerCase().includes(p)));
    const time = headers.find(h => timeP.some(p => h.toLowerCase().includes(p)));
    return { timestamp, date, time };
  }

  parseTimestamp(dateStr, timeStr) {
    if (!dateStr) return null;
    const combined = timeStr ? `${dateStr} ${timeStr}` : dateStr;
    // Benutzerdefiniertes Format
    if (this.customDateFormat) {
      const dt = parse(combined, this.customDateFormat, new Date());
      if (isValid(dt)) return dt;
    }
    // ISO / native
    const dtIso = new Date(combined);
    if (!isNaN(dtIso.getTime())) return dtIso;
    // DMY
    const dmy = /^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
    let m = combined.match(dmy);
    if (m) {
      let [_, d, mth, y, h = 0, min = 0, s = 0] = m;
      if (y.length === 2) y = '20' + y;
      return new Date(y, mth - 1, d, h, min, s);
    }
    return null;
  }

  detectGaps(processed) {
    const diffs = [];
    for (let i = 1; i < processed.length; i++) {
      diffs.push((processed[i].timestamp - processed[i-1].timestamp) / 1000);
    }
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const gaps = diffs.filter(d => d > avg * 1.5);
    if (gaps.length) console.warn('Lücken in den Zeitstempeln erkannt:', gaps.length);
  }

  applyResampling() {
    if (!this.data) return;
    if (!this.resolution) {
      this.resampled = this.data.data;
      return;
    }
    const buckets = {};
    this.data.data.forEach(r => {
      const t = r.timestamp.getTime();
      const key = Math.floor(t / 1000 / 3600 / this.resolution);
      if (!buckets[key]) buckets[key] = { count: 0, timestamp: new Date(key * this.resolution * 3600 * 1000) };
      this.data.columns.forEach(c => {
        buckets[key][c] = (buckets[key][c] || 0) + r[c];
      });
      buckets[key].count++;
    });
    this.resampled = Object.values(buckets).map(b => {
      const row = { timestamp: b.timestamp };
      this.data.columns.forEach(c => {
        row[c] = b[c] / b.count;
      });
      return row;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  setupColumnSelection() {
    const container = document.getElementById('column-checkboxes');
    container.innerHTML = '';
    this.data.columns.forEach(col => {
      const div = document.createElement('div'); div.className = 'flex items-center';
      div.innerHTML = `
        <input type="checkbox" id="col-${col}" value="${col}" checked class="h-4 w-4 text-blue-600 border-gray-300 rounded">
        <label for="col-${col}" class="ml-2 text-sm text-gray-700">${col}</label>
      `;
      container.appendChild(div);
      div.querySelector('input').addEventListener('change', this.handleColumnSelection.bind(this));
    });
    this.selectedColumns = [...this.data.columns];
  }

  handleColumnSelection() {
    const checkboxes = document.querySelectorAll('#column-checkboxes input[type="checkbox"]');
    this.selectedColumns = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    this.generateAnalytics();
  }

  generateAnalytics() {
    if (!this.data || this.selectedColumns.length === 0) return;
    this.generateKPIs();
    this.generateLoadDurationCurve();
    this.generateHistogram();
    this.generateRealHeatmap();
    this.generateMonthlyChart();
    this.generateBoxplots();
    this.generateDailyProfile();
    this.generatePeakShaving();
  }

  generateKPIs() {
    const container = document.getElementById('kpi-dashboard'); container.innerHTML = '';
    this.selectedColumns.forEach(col => {
      const vals = this.resampled.map(r => r[col]).filter(v => v > 0);
      const total = this.calculateTotalConsumption(col);
      const peak = Math.max(...vals);
      const utilH = peak ? total / peak : 0;
      const p95 = this.calculatePercentile(vals.sort((a,b)=>b-a), 95);
      const card = document.createElement('div'); card.className = 'bg-white rounded-lg shadow-md p-6';
      card.innerHTML = `
        <h4 class="text-lg font-semibold mb-4 text-center">${col}</h4>
        <div class="space-y-3">
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">${(total/1000).toFixed(1)}</div>
            <div class="text-sm text-gray-600">${this.unitMode==='energy'?'MWh':'kW'}${this.unitMode==='power'?'/h':''}</div>
          </div>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="text-center"><div class="font-semibold">${peak.toFixed(1)}</div><div class="text-gray-600">Spitzenlast (kW)</div></div>
            <div class="text-center"><div class="font-semibold">${utilH.toFixed(0)}</div><div class="text-gray-600">Benutzungsstunden</div></div>
            <div class="text-center"><div class="font-semibold">${p95.toFixed(1)}</div><div class="text-gray-600">95-Perzentil (kW)</div></div>
            <div class="text-center"><div class="font-semibold">${vals.length.toLocaleString()}</div><div class="text-gray-600">Messpunkte</div></div>
          </div>
        </div>`;
      container.appendChild(card);
    });
  }

  generateLoadDurationCurve() {
    const ctx = document.getElementById('loadDurationChart').getContext('2d');
    this.charts.loadDuration?.destroy();
    const datasets = this.selectedColumns.map((col,i) => {
      const vals = this.resampled.map(r=>r[col]).filter(v=>v>0).sort((a,b)=>b-a);
      return { label: col, data: vals.map((v,idx)=>({x:idx/vals.length*100,y:v})), borderColor:this.getColor(i), backgroundColor:this.getColor(i,0.1), fill:false, tension:0.1 };
    });
    this.charts.loadDuration = new Chart(ctx, { type:'line', data:{datasets}, options:{responsive:true, plugins:{title:{display:true,text:'Lastdauerkurve'},legend:{display:this.selectedColumns.length>1}}, scales:{x:{title:{display:true,text:'Überschreitungsdauer (%)'},min:0,max:100},y:{title:{display:true,text:'Leistung (kW)'},beginAtZero:true}} }});
  }

  generateHistogram() {
    const ctx = document.getElementById('histogramChart').getContext('2d');
    this.charts.histogram?.destroy();
    const col = this.selectedColumns[0];
    const vals = this.resampled.map(r=>r[col]).filter(v=>v>0);
    const bins = this.createHistogramBins(vals,20);
    this.charts.histogram = new Chart(ctx, { type:'bar', data:{ labels:bins.map(b=>`${b.min.toFixed(1)}-${b.max.toFixed(1)}`), datasets:[{label:'Häufigkeit', data:bins.map(b=>b.count), borderWidth:1, backgroundColor:this.getColor(0,0.6), borderColor:this.getColor(0)}]}, options:{responsive:true, plugins:{title:{display:true,text:`Leistungsverteilung - ${col}`},legend:{display:false}}, scales:{x:{title:{display:true,text:'Leistung (kW)'}},y:{title:{display:true,text:'Anzahl Messpunkte'}}}}});
  }

  createHistogramBins(vals,numBins) {
    if (!vals.length) return Array.from({length:numBins},()=>({min:0,max:0,count:0}));
    const min=Math.min(...vals), max=Math.max(...vals), w=(max-min)/numBins; const bins=[];
    for(let i=0;i<numBins;i++){ const lo=min+w*i, hi=lo+w; const cnt=vals.filter(v=>v>=lo&&(i===numBins-1?v<=hi:v<hi)).length; bins.push({min:lo,max:hi,count:cnt}); }
    return bins;
  }

  generateRealHeatmap() {
    const ctx = document.getElementById('heatmapChart').getContext('2d');
    this.charts.heatmap?.destroy();
    const col = this.selectedColumns[0];
    const points = this.resampled.map(r=>{ const d=r.timestamp; const day=(d.getDay()+6)%7; const hour=d.getHours(); return {x:day,y:hour,v:r[col]}; });
    const maxV = Math.max(...points.map(p=>p.v));
    this.charts.heatmap = new Chart(ctx, { type:'matrix', data:{datasets:[{label:col,data:points, backgroundColor:ctx=>{ const v=ctx.dataset.data[ctx.dataIndex].v; const alpha=v/maxV; return `rgba(59,130,246,${0.3+0.7*alpha})`; }, width:({chart})=>chart.chartArea.width/7-1, height:({chart})=>chart.chartArea.height/24-1 }]}, options:{plugins:{tooltip:{callbacks:{title:ctx=>`Tag: ${['Mo','Di','Mi','Do','Fr','Sa','So'][ctx[0].parsed.x]}, Stunde: ${ctx[0].parsed.y}:00`, label:ctx=>`Wert: ${ctx[0].raw.v.toFixed(2)}`}}}, scales:{x:{type:'linear',min:0,max:6,ticks:{callback:i=>['Mo','Di','Mi','Do','Fr','Sa','So'][i]}}, y:{type:'linear',min:0,max:23,ticks:{stepSize:1}}}}});
  }

  generateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    this.charts.monthly?.destroy();
    const monthly = Array.from({length:12},()=>({})); const interval=this.estimateIntervalHours();
    this.resampled.forEach(r=>{ const m=r.timestamp.getMonth(); this.selectedColumns.forEach(col=>{ monthly[m][col]=(monthly[m][col]||0)+(r[col]*interval)/1000; }); });
    const datasets = this.selectedColumns.map((col,i)=>({ label:col,data:monthly.map(m=>m[col]||0), backgroundColor:this.getColor(i,0.7), borderColor:this.getColor(i), borderWidth:1 }));
    this.charts.monthly = new Chart(ctx,{type:'bar',data:{labels:['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],datasets}, options:{responsive:true, plugins:{title:{display:true,text:'Monatsverbrauch'},legend:{display:this.selectedColumns.length>1}}, scales:{x:{title:{display>true,text:'Monat'}},y:{title:{display:true,text:'Verbrauch (MWh)'}}}}});
  }

  generateBoxplots() {
    const ctx = document.getElementById('boxplotChart').getContext('2d');
    this.charts.boxplot?.destroy();
    const col = this.selectedColumns[0];
    const monthlyData = Array.from({length:12},()=>[]);
    this.resampled.forEach(r=> monthlyData[r.timestamp.getMonth()].push(r[col]));
    const stats = monthlyData.map(data=>{ if(!data.length) return {min:0,q1:0,median:0,q3:0,max:0}; const s=[...data].sort((a,b)=>a-b); return {min:s[0],q1:this.calculatePercentile(s,25),median:this.calculatePercentile(s,50),q3:this.calculatePercentile(s,75),max:s[s.length-1]}; });
    const datasets=[{label:'Median',data:stats.map(s=>s.median),borderColor:this.getColor(0),fill:false},{label:'25-75 Perzentil',data:stats.map(s=>s.q3),borderColor:this.getColor(1),backgroundColor:this.getColor(1,0.2),fill:'+1'},{label:'',data:stats.map(s=>s.q1),borderColor:this.getColor(1),fill:false}];
    this.charts.boxplot=new Chart(ctx,{type:'line',data:{labels:['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],datasets},options:{responsive:true,plugins:{title:{display:true,text:`Monatliche Verteilung - ${col}`},legend:{filter:item=>item.text!==''}},scales:{x:{title:{display:true,text:'Monat'}},y:{title:{display:true,text:'Leistung (kW)'}}},elements:{point:{radius:4}}}});
  }

  generateDailyProfile() {
    const ctx = document.getElementById('dailyProfileChart').getContext('2d');
    this.charts.dailyProfile?.destroy();
    const col = this.selectedColumns[0];
    const wd=Array.from({length:24},()=>[]), we=Array.from({length:24},()=>[]);
    this.resampled.forEach(r=>{ const h=r.timestamp.getHours(); (r.timestamp.getDay()>=1&&r.timestamp.getDay()<=5?wd:we)[h].push(r[col]); });
    const getAvg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    this.charts.dailyProfile=new Chart(ctx,{type:'line',data:{labels:Array.from({length:24},(_,i)=>`${i}:00`),datasets:[{label:'Werktag (Mo-Fr)',data:wd.map(getAvg),borderColor:this.getColor(0),fill:false,tension:0.3},{label:'Wochenende (Sa-So)',data:we.map(getAvg),borderColor:this.getColor(1),fill:false,tension:0.3}]},options:{responsive:true,plugins:{title:{display:true,text:`Tagesprofil-Vergleich - ${col}`}},scales:{x:{title:{display:true,text:'Uhrzeit'}},y:{title:{display:true,text:'Durchschnittliche Leistung (kW)'}}}}});
  }

  generatePeakShaving() {
    const ctx = document.getElementById('peakShavingChart').getContext('2d');
    this.charts.peakShaving?.destroy();
    const col=this.selectedColumns[0];
    const vals=this.resampled.map(r=>r[col]);
    const maxVal=Math.max(...vals);
    const threshold=(document.getElementById('peak-shaving-slider').value/100)*maxVal;
    const interval=this.estimateIntervalHours();
    const savings=vals.reduce((sum,v)=>sum+(v>threshold?(v-threshold)*interval:0),0);
    document.getElementById('peak-shaving-savings').textContent=`${savings.toFixed(1)} kWh`;
    const sampleRate=Math.max(1,Math.floor(this.resampled.length/1000));
    const sample=this.resampled.filter((_,i)=>i%sampleRate===0);
    this.charts.peakShaving=new Chart(ctx,{type:'line',data:{labels:sample.map((_,i)=>i),datasets:[{label:'Originallast',data:sample.map(r=>r[col]),borderColor:'rgba(239,68,68,0.8)',fill:false,pointRadius:0,borderWidth:1},{label:'Gekappte Last',data:sample.map(r=>Math.min(r[col],threshold)),borderColor:'rgba(34,197,94,0.8)',fill:false,pointRadius:0,borderWidth:1},{label:'Kappungsgrenze',data:Array(sample.length).fill(threshold),borderColor:'rgba(255,159,64,1)',borderDash:[5,5],fill:false,pointRadius:0,borderWidth:2}]},options:{responsive:true,plugins:{title:{display:true,text:`Peak-Shaving-Szenario - ${col}`}},scales:{x:{display:false},y:{title:{display:true,text:'Leistung (kW)'}}},elements:{line:{tension:0}}}});
  }

  calculateTotalConsumption(col) {
    const dataArr = this.resampled;
    const interval = this.estimateIntervalHours();
    const sum = dataArr.reduce((a,r)=>a + r[col]*interval,0);
    return this.unitMode==='energy' ? sum : sum/interval;
  }

  estimateIntervalHours() {
    if (!this.resampled || this.resampled.length < 2) return 0.25;
    const delta = (this.resampled[1].timestamp - this.resampled[0].timestamp) / (1000*3600);
    return Math.max(delta, 0.01);
  }

  calculatePercentile(sorted, p) {
    const idx = Math.ceil((p/100)*sorted.length)-1;
    return sorted[Math.max(0,idx)] || 0;
  }

  isNumericColumn(data,col) {
    const sample = Math.min(100,data.length);
    let cnt=0;
    for (let i=0;i<sample;i++) {
      const v=data[i][col];
      if (typeof v==='number'&&!isNaN(v) || typeof v==='string'&&!isNaN(parseFloat(v))) cnt++;
    }
    return cnt/sample > 0.7;
  }

  cleanNumericValue(v) {
    if (typeof v==='number'&&!isNaN(v)) return v;
    if (typeof v==='string') {
      const p=parseFloat(v);
      return isNaN(p)?0:p;
    }
    return 0;
  }

  showProgress(pct,msg) {
    const bar=document.getElementById('progress-bar');
    document.getElementById('progress-container').classList.remove('hidden');
    bar.style.width=`${pct}%`;
    document.getElementById('progress-text').textContent=msg;
  }

  hideProgress() {
    document.getElementById('progress-container').classList.add('hidden');
  }

  showError(msg) {
    const e=document.getElementById('error-message');
    e.textContent=msg;
    e.classList.remove('hidden');
    this.hideProgress();
  }

  showMainContent() {
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('upload-section').style.display='none';
  }

  showAddGroupModal() {
    // TODO: Modal implementieren
    console.log('Custom Group Modal öffnen');
  }

  saveCustomGroup() {
    // TODO: Einlesen der Modal-Daten und this.customGroups.push(...)
    console.log('Custom Group speichern');
  }
}

// Chart Download
export function downloadChart(chartId) {
  const canvas = document.getElementById(chartId);
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `${chartId}_${new Date().toISOString().split('T')[0]}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

document.addEventListener('DOMContentLoaded', () => new LoadAnalyzer());
