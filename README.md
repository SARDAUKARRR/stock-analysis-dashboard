# stock-analysis-dashboard

---

### What it does

* **Main Chart:** Shows daily price candlesticks, volume, and overlays for the 50 & 200-day moving averages.
* **Indicator Panels:** Separate charts for RSI and MACD to see momentum at a glance.
* **Company Info:** Displays the company's profile, key financial numbers (like market cap and P/E ratio), and the latest news headlines.

### Tech Used

* **HTML, CSS, Vanilla JavaScript:** No frameworks, just the fundamentals.
* **[Finnhub.io API](https://finnhub.io/):** Powers all the market data (prices, news, fundamentals).
* **[Lightweight Charts™ by TradingView](https://www.tradingview.com/lightweight-charts/):** Used for the fast and interactive charts.

### How to Run It

1.  **Download the files:** Grab the `index.html`, `style.css`, and `script.js` files and put them in a folder.
2.  **Get a free API key:** You'll need one from **[Finnhub.io](https://finnhub.io/register)** to fetch data.
3.  **Open `index.html`:** Just open this file in your browser.
4.  **Enter your key:** The sidebar on the right will ask for your API key. Once you enter it, the app will start working.

### Your Privacy

This is a purely client-side application.

* **Your API key is safe.** It's stored **only in your browser's local storage**. I don't have access to it, and it's never sent to any server other than Finnhub's.
* **I don't collect any data.** Period.

### Disclaimer

This is an educational project, not a professional trading tool. The data comes from Finnhub and might have delays. Please do not use it for making real investment decisions.
