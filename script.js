/**
 * Pro Stock Analysis Dashboard
 * This script orchestrates the entire dashboard. It handles:
 * - API key management with localStorage.
 * - A complex UI with a "locked" state.
 * - Multiple, concurrent API calls to Finnhub.
 * - Rendering of advanced charts with Lightweight Charts, including overlays and sub-panels.
 * - Dynamic updates of company profile, metrics, and news.
 */

// --- 1. Global State & DOM References ---

const state = {
    apiKey: null,
    currentTicker: 'AAPL',
    isLoading: false,
};

// Organize all DOM element lookups in one place for clean access.
const dom = {
    mainContent: document.getElementById('main-content'),
    // Header
    tickerInput: document.getElementById('ticker-input'),
    submitBtn: document.getElementById('submit-btn'),
    companyLogo: document.getElementById('company-logo'),
    companyName: document.getElementById('company-name'),
    companyTicker: document.getElementById('company-ticker'),
    // Metrics
    metricsContainer: document.getElementById('metrics-container'),
    // Charts
    priceChartTitle: document.getElementById('price-chart-title'),
    priceChartContainer: document.getElementById('price-chart-container'),
    rsiChartContainer: document.getElementById('rsi-chart-container'),
    macdChartContainer: document.getElementById('macd-chart-container'),
    // Info
    profileContainer: document.getElementById('profile-container'),
    newsContainer: document.getElementById('news-container'),
    // Sidebar
    apiKeyInput: document.getElementById('api-key-input'),
    saveApiKeyBtn: document.getElementById('save-api-key-btn'),
    statusLog: document.getElementById('status-log'),
};

// Initialize charts and series globally to be accessible for updates.
const charts = {
    price: createChart(dom.priceChartContainer, true), // Main chart with volume
    rsi: createChart(dom.rsiChartContainer),
    macd: createChart(dom.macdChartContainer),
};

const series = {
    candlestick: charts.price.addCandlestickSeries({
        upColor: 'var(--green)', downColor: 'var(--red)',
        borderVisible: false, wickUpColor: 'var(--green)', wickDownColor: 'var(--red)',
    }),
    volume: charts.price.addHistogramSeries({
        color: '#263238', priceFormat: { type: 'volume' },
        priceScaleId: 'volume_scale',
    }),
    sma50: charts.price.addLineSeries({ color: 'orange', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }),
    sma200: charts.price.addLineSeries({ color: 'cyan', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }),
    rsi: charts.rsi.addLineSeries({ color: '#2962FF', lineWidth: 2 }),
    macdLine: charts.macd.addLineSeries({ color: '#2962FF', lineWidth: 2 }),
    macdSignal: charts.macd.addLineSeries({ color: '#FF6D00', lineWidth: 2 }),
    macdHist: charts.macd.addHistogramSeries({
        color: '#26a69a', priceFormat: { type: 'volume' },
    }),
};


// --- 2. Main Application Flow ---

/**
 * Initializes the entire application on page load.
 */
function initialize() {
    logStatus('Application initializing...');
    setupEventListeners();
    setupRsiChartLines();
    handleApiKey();
}

/**
 * Checks for a saved API key and sets the initial UI state.
 */
function handleApiKey() {
    const storedKey = localStorage.getItem('finnhubApiKey');
    if (storedKey) {
        state.apiKey = storedKey;
        dom.apiKeyInput.value = storedKey;
        logStatus('API Key found in browser memory.', 'success');
        toggleDashboardLock(false);
        fetchAndDisplayDashboard();
    } else {
        logStatus('API Key not found. Please enter a key to begin.', 'info');
        toggleDashboardLock(true);
    }
}

/**
 * The primary function to fetch all data and update the entire dashboard.
 */
async function fetchAndDisplayDashboard() {
    if (state.isLoading || !state.apiKey) {
        if (!state.apiKey) alert("Please save a valid API key before loading data.");
        return;
    }

    setUiLoading(true);
    state.currentTicker = dom.tickerInput.value.toUpperCase();

    try {
        logStatus(`Fetching all data for ${state.currentTicker}...`);
        
        const data = await fetchAllEndpoints(state.currentTicker);
        logStatus('All data received. Processing...');

        // Process and update each part of the UI
        updateProfileUI(data.profile, data.quote);
        updateMetricsUI(data.metrics, data.quote);
        updateNewsUI(data.news);
        
        // Calculate SMA before updating charts
        const sma50Data = calculateSMA(data.candles.c, 50);
        const sma200Data = calculateSMA(data.candles.c, 200);
        updateChartsUI(data, sma50Data, sma200Data);
        
        logStatus(`Dashboard updated for ${state.currentTicker}.`, 'success');

    } catch (error) {
        console.error("Dashboard Error:", error);
        logStatus(`Error: ${error.message}`, 'error');
        alert(`Failed to load dashboard: ${error.message}`);
    } finally {
        setUiLoading(false);
    }
}


// --- 3. API & Data Handling ---

/**
 * Fetches data from all required Finnhub endpoints concurrently.
 * @param {string} ticker The stock symbol to fetch data for.
 */
function fetchAllEndpoints(ticker) {
    // We need candle data going back far enough for a 200-day SMA.
    const to = Math.floor(Date.now() / 1000);
    const from = to - (365 * 24 * 60 * 60); // Approx. 1 year ago

    const endpoints = {
        profile: `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${state.apiKey}`,
        quote: `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${state.apiKey}`,
        metrics: `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${state.apiKey}`,
        candles: `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${state.apiKey}`,
        rsi: `https://finnhub.io/api/v1/indicator?symbol=${ticker}&resolution=D&from=${from}&to=${to}&indicator=rsi&timeperiod=14&token=${state.apiKey}`,
        macd: `https://finnhub.io/api/v1/indicator?symbol=${ticker}&resolution=D&from=${from}&to=${to}&indicator=macd&token=${state.apiKey}`,
        news: `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${state.apiKey}`
    };

    const promises = Object.entries(endpoints).map(([key, url]) => 
        fetch(url).then(res => {
            if (!res.ok) throw new Error(`Network response for ${key} was not ok.`);
            return res.json();
        }).then(data => ({ key, data }))
    );

    return Promise.all(promises).then(results => {
        // Convert the array of results back into a named object.
        const dataObject = results.reduce((acc, { key, data }) => {
            acc[key] = data;
            return acc;
        }, {});
        if (dataObject.candles.s !== 'ok') throw new Error('Failed to fetch historical candle data.');
        return dataObject;
    });
}


// --- 4. UI Update Functions ---

function updateProfileUI(profile, quote) {
    dom.companyName.textContent = profile.name || 'Company Name';
    dom.companyTicker.textContent = profile.ticker || 'TICKER';
    dom.companyLogo.src = profile.logo || '';
    dom.priceChartTitle.innerText = `${profile.name || state.currentTicker} Daily Chart`;

    dom.profileContainer.innerHTML = `
        <p><span>Industry:</span> ${profile.finnhubIndustry || 'N/A'}</p>
        <p><span>Website:</span> <a href="${profile.weburl}" target="_blank">${profile.weburl || 'N/A'}</a></p>
        <p><span>Exchange:</span> ${profile.exchange || 'N/A'}</p>
    `;
}

function updateMetricsUI(metricsData, quoteData) {
    const metrics = metricsData.metric;
    dom.metricsContainer.innerHTML = `
        <div class="metric-card card">
            <span class="label">Current Price</span>
            <span class="value">$${quoteData.c?.toFixed(2) || '0.00'}</span>
        </div>
        <div class="metric-card card">
            <span class="label">Market Cap</span>
            <span class="value">${(metrics.marketCapitalization / 1000)?.toFixed(2) || '0.00'}B</span>
        </div>
        <div class="metric-card card">
            <span class="label">52-Week High</span>
            <span class="value">$${metrics['52WeekHigh']?.toFixed(2) || '0.00'}</span>
        </div>
        <div class="metric-card card">
            <span class="label">52-Week Low</span>
            <span class="value">$${metrics['52WeekLow']?.toFixed(2) || '0.00'}</span>
        </div>
        <div class="metric-card card">
            <span class="label">P/E Ratio</span>
            <span class="value">${metrics.peNormalizedAnnual?.toFixed(2) || 'N/A'}</span>
        </div>
    `;
}

function updateNewsUI(news) {
    // Show the top 5 most recent articles
    dom.newsContainer.innerHTML = news.slice(0, 5).map(article => `
        <div class="news-item">
            <a href="${article.url}" target="_blank">${article.headline}</a>
            <p>${new Date(article.datetime * 1000).toLocaleDateString()} - ${article.source}</p>
        </div>
    `).join('');
}

function updateChartsUI(data, sma50Data, sma200Data) {
    const candles = data.candles;
    const candlestickData = candles.t.map((time, index) => ({
        time: time,
        open: candles.o[index],
        high: candles.h[index],
        low: candles.l[index],
        close: candles.c[index],
    }));
    
    const volumeData = candles.t.map((time, index) => ({
        time: time,
        value: candles.v[index],
        color: candles.c[index] > candles.o[index] ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
    }));

    const rsiPlotData = data.rsi.t.map((time, index) => ({ time, value: data.rsi.rsi[index] }));
    const macdLineData = data.macd.t.map((time, index) => ({ time, value: data.macd.macd[index] }));
    const macdSignalData = data.macd.t.map((time, index) => ({ time, value: data.macd.signal[index] }));
    const macdHistData = data.macd.t.map((time, index) => {
        const histValue = data.macd.macdHist[index];
        return {
            time,
            value: histValue,
            color: histValue >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        };
    });

    series.candlestick.setData(candlestickData);
    series.volume.setData(volumeData);
    series.rsi.setData(rsiPlotData);
    series.macdLine.setData(macdLineData);
    series.macdSignal.setData(macdSignalData);
    series.macdHist.setData(macdHistData);
    
    // Combine candle timestamps with SMA values
    const sma50PlotData = sma50Data.map((value, index) => ({ time: candles.t[index + 49], value }));
    const sma200PlotData = sma200Data.map((value, index) => ({ time: candles.t[index + 199], value }));
    series.sma50.setData(sma50PlotData);
    series.sma200.setData(sma200PlotData);

    // Auto-fit charts after loading data
    Object.values(charts).forEach(chart => chart.timeScale().fitContent());
}


// --- 5. Event Listeners and Initialization ---

function setupEventListeners() {
    dom.submitBtn.addEventListener('click', fetchAndDisplayDashboard);
    dom.saveApiKeyBtn.addEventListener('click', handleKeySubmission);
}

function handleKeySubmission() {
    const userKey = dom.apiKeyInput.value.trim();
    if (userKey) {
        state.apiKey = userKey;
        localStorage.setItem('finnhubApiKey', userKey);
        logStatus('API Key saved successfully.', 'success');
        toggleDashboardLock(false);
        fetchAndDisplayDashboard();
    } else {
        logStatus('Please enter a valid API key.', 'error');
        alert("API Key field cannot be empty.");
    }
}

function initialize() {
    logStatus('Application initializing. Please provide an API key.');
    setupEventListeners();
    setupRsiChartLines();
    handleApiKey();
}


// --- 6. Helper Utilities ---

function createChart(container, hasVolume = false) {
    const chart = LightweightCharts.createChart(container, {
        layout: { 
            background: { color: 'var(--card-bg)' }, 
            textColor: 'var(--text-primary)' 
        },
        grid: { 
            vertLines: { color: 'var(--border-color)' }, 
            horzLines: { color: 'var(--border-color)' } 
        },
        timeScale: { 
            timeVisible: true, 
            secondsVisible: false,
            borderColor: 'var(--border-color)',
        },
        rightPriceScale: {
            borderColor: 'var(--border-color)',
        },
    });

    if (hasVolume) {
        chart.priceScale('volume_scale').applyOptions({
            scaleMargins: { top: 0.7, bottom: 0 },
        });
    }
    return chart;
}

function setupRsiChartLines() {
    series.rsi.createPriceLine({ value: 70, color: 'var(--red)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Overbought' });
    series.rsi.createPriceLine({ value: 30, color: 'var(--green)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Oversold' });
}

function setUiLoading(isLoading) {
    state.isLoading = isLoading;
    dom.submitBtn.innerText = isLoading ? "Loading..." : "Load Data";
    dom.submitBtn.disabled = isLoading;
}

function toggleDashboardLock(isLocked) {
    dom.mainContent.classList.toggle('locked', isLocked);
}

function logStatus(message, type = 'info') {
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    dom.statusLog.prepend(entry); // Prepend to show latest on top
}

function calculateSMA(data, period) {
    if (!data || data.length < period) return [];
    
    let results = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j];
        }
        results.push(sum / period);
    }
    return results;
}

// --- Application Start ---
document.addEventListener('DOMContentLoaded', initialize);
