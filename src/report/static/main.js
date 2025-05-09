fetch('report.json')
    .then(response => response.json())
    .then(data => {

        const winRate = data.winTrades + data.loseTrades > 0
            ? ((data.winTrades / (data.winTrades + data.loseTrades)) * 100).toFixed(2)
            : '0.00';
        document.getElementById('stats').innerText =
            `Initial: ${parseFloat(data.initialBalance.toFixed(4))}, Final: ${parseFloat(data.finalBalance.toFixed(4))}, Fees: ${parseFloat(data.fees.toFixed(4))}, Wins: ${data.winTrades}, Losses: ${data.loseTrades}, Win Rate: ${winRate}%`;

        const time = data.lines.map(d => d.time);
        const open = data.lines.map(d => d.open);
        const close = data.lines.map(d => d.close);
        const low = data.lines.map(d => d.low);
        const high = data.lines.map(d => d.high);
        const equity = data.lines.map(d => d.equity);
        const volume = data.lines.map(d => d.volume);

        // 根据涨跌分颜色
        const volumeColors = data.lines.map(d => d.close >= d.open ? 'rgba(0,200,0,0.6)' : 'rgba(200,0,0,0.6)');

        const excludeKeys = ['time', 'close', 'equity', 'volume', 'open', 'low', 'high', 'buy', 'sell', 'price'];
        const indicatorKeys = Object.keys(data.lines[0]).filter(k => !excludeKeys.includes(k));

        const traces = [
            {
                x: time,
                y: equity,
                name: 'Equity',
                mode: 'lines',
                line: { color: 'blue' },
                yaxis: 'y1'
            },
            {
                name: "Candle",
                x: time,
                open: open,
                high: high,
                low: low,
                close: close,
                type: 'candlestick',
                increasing: { line: { color: 'green' } },
                decreasing: { line: { color: 'red' } },
                yaxis: 'y2'
            },
            {
                x: time,
                y: volume,
                name: 'Volume',
                type: 'bar',
                marker: { color: volumeColors },
                yaxis: 'y3'
            }
        ];

        indicatorKeys.forEach(key => {
            traces.push({
                x: time,
                y: data.lines.map(d => d[key]),
                name: key,
                mode: 'lines',
                yaxis: 'y2'
            });
        });

        const buyPoints = data.lines.filter(d => d.buy);
        const sellPoints = data.lines.filter(d => d.sell);
        traces.push({
            x: buyPoints.map(d => d.time),
            y: buyPoints.map(d => d.price),
            name: 'Buy',
            mode: 'markers',
            marker: { color: 'blue', size: 12, symbol: 'triangle-up' },
            yaxis: 'y2'
        });
        traces.push({
            x: sellPoints.map(d => d.time),
            y: sellPoints.map(d => d.price),
            name: 'Sell',
            mode: 'markers',
            marker: { color: 'orange', size: 12, symbol: 'triangle-down' },
            yaxis: 'y2'
        });

        const layout = {
            grid: { rows: 3, columns: 1, subplots: [['xy'], ['xy2'], ['xy3']], roworder: 'top to bottom' },
            yaxis: { title: 'Equity', domain: [0.8, 1],fixedrange: false },
            yaxis2: { title: 'Price / Indicators', domain: [0.3, 0.8],fixedrange: false },
            yaxis3: { title: 'Volume', domain: [0, 0.3],fixedrange: false },
            height: 900,
            margin: {
                t: 20,
                l: 60,
                r: 30,
                b: 60
            },
            hovermode: 'x unified'
        };

        Plotly.newPlot('chart', traces, layout);
    });