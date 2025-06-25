# LoadProfileAnalyzer

Eine moderne Web-Anwendung zur Analyse von Jahres-Stromlastgängen mit interaktiven Visualisierungen und PNG-Download-Funktionalität.

![Demo](assets/img/demo.gif)

## 🚀 Features

### Datenverarbeitung
- **Drag & Drop Upload** - Einfaches Hochladen von CSV-Dateien
- **Automatische Validierung** - Überprüfung von Zeitstempel-Format und Datenkonsistenz
- **Mehrspalten-Support** - Analyse mehrerer Messpunkte gleichzeitig
- **Fehlerbehandlung** - Robuste Behandlung von Fehlwerten und ungültigen Daten

### Analysen & Visualisierungen
- **📊 Lastdauerkurve** - Sortierte Leistungswerte über Überschreitungsdauer
- **📈 Histogramm** - Verteilung der Leistungswerte
- **🔥 Heatmap** - Wochentagsprofil (Stunde × Wochentag)
- **📅 Monatsverbrauch** - Aggregierte Verbrauchsdaten pro Monat
- **📦 Boxplots** - Monatliche Verteilungen mit Quartilen und Ausreißern
- **⏰ Tagesprofil-Vergleich** - Werktag vs. Wochenende
- **⚡ Peak-Shaving-Analyse** - Interaktive Lastkappungs-Szenarien

### KPI-Dashboard
- **Jahresverbrauch** (MWh/Jahr)
- **Spitzenleistung** (kW)
- **Benutzungsstunden**
- **95-Perzentil der Last**

### Benutzerfreundlichkeit
- **Responsive Design** - Optimiert für Desktop, Tablet und Mobile
- **PNG-Download** - Jede Grafik als hochauflösende PNG-Datei speicherbar
- **Deutsche Benutzeroberfläche**
- **Interaktive Peak-Shaving-Simulation** mit Echtzeit-Einsparungsberechnung

## 📋 Unterstützte Datenformate

### CSV-Anforderungen
- **Zeitstempel**: ISO-8601 Format mit Zeitzone (Europe/Berlin)
  - Beispiel: `2024-01-01T00:00:00+01:00`
- **Leistungsspalten**: Numerische Werte in kW
- **Maximale Dateigröße**: 50 MB
- **Typische Auflösung**: 15-Minuten-Intervalle

### Beispiel CSV-Struktur
```csv
timestamp,load_kw,load_2_kw
2024-01-01T00:00:00+01:00,25.5,18.2
2024-01-01T00:15:00+01:00,23.1,16.8
2024-01-01T00:30:00+01:00,21.8,15.9
...
```

## 🛠️ Installation & Deployment

### GitHub Pages (Empfohlen)
1. Repository forken oder klonen
2. In GitHub Settings → Pages → Source: "Deploy from a branch"
3. Branch: `main`, Folder: `/docs`
4. Die Anwendung ist verfügbar unter: `https://ihr-username.github.io/LoadProfileAnalyzer/`

### Lokale Entwicklung
```bash
# Repository klonen
git clone https://github.com/ihr-username/LoadProfileAnalyzer.git
cd LoadProfileAnalyzer

# Lokalen Server starten (z.B. mit Python)
cd docs
python -m http.server 8000

# Oder mit Node.js
npx serve .
```

### Manuelle Überprüfung

Um die Histogramm-Funktion ohne Daten zu testen, kann in der Browser-Konsole
folgender Befehl ausgeführt werden:

```javascript
const a = new LoadAnalyzer();
a.createHistogramBins([], 5);
// => [{min: 0, max: 0, count: 0}, ...]
```

## 📁 Projektstruktur

```
LoadProfileAnalyzer/
├── docs/                           # GitHub Pages Root
│   ├── index.html                  # Haupt-HTML-Datei
│   ├── assets/
│   │   ├── css/
│   │   │   └── style.css          # Zusätzliche Styles
│   │   ├── js/
│   │   │   └── main.js            # Hauptlogik
│   │   └── img/
│   │       ├── logo.svg           # Logo
│   │       └── demo.gif           # Demo-Animation
│   └── samples/
│       └── demo.csv               # Beispiel-Datensatz
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions Workflow
├── README.md                      # Diese Datei
├── LICENSE                        # MIT-Lizenz
└── package.json                   # Projekt-Metadaten
```

## 🔧 Technische Details

### Tech-Stack
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js 4.4.1
- **CSV-Parsing**: PapaParse 5.4.1
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions

### Browser-Kompatibilität
- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile Browser (iOS Safari, Chrome Mobile)

### Performance
- **Optimiert für große Datensätze** (bis zu 35.000 Datenpunkte)
- **Intelligente Daten-Sampling** für Visualisierungen
- **Lazy Loading** von Chart-Komponenten
- **Responsive Chart-Rendering**

## 📊 Verwendung

1. **CSV-Datei hochladen**
   - Datei per Drag & Drop ablegen oder File-Picker verwenden
   - Automatische Validierung und Fortschrittsanzeige

2. **Datenspalten auswählen**
   - Checkbox-Interface für Mehrspalten-Analyse
   - Dynamische Chart-Updates

3. **Interaktive Analysen**
   - Peak-Shaving-Simulation mit Schieberegler
   - Hover-Tooltips für detaillierte Werte
   - Zoom und Pan in Diagrammen

4. **Ergebnisse exportieren**
   - PNG-Download für jede Grafik
   - Hochauflösende Bilder für Berichte

## 🤝 Beitragen

Contributions sind willkommen! Bitte:

1. Fork das Repository
2. Feature-Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Pull Request öffnen

## 📝 Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe [LICENSE](LICENSE) für Details.

## 🐛 Bekannte Einschränkungen

- **Browser-Storage**: Keine Persistierung zwischen Sessions (GitHub Pages Limitierung)
- **Dateigröße**: 50 MB Limit für optimale Performance
- **Chart-Komplexität**: Sehr große Datensätze werden automatisch gesampled

## 📞 Support

Bei Fragen oder Problemen:
- [Issues auf GitHub](https://github.com/ihr-username/LoadProfileAnalyzer/issues) erstellen
- [Discussions](https://github.com/ihr-username/LoadProfileAnalyzer/discussions) für Fragen

---

**Entwickelt mit ❤️ für die Energieanalyse**
