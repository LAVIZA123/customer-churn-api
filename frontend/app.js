let API_BASE_URL = 'http://localhost:8000';
let ACTIVE_API_URL = 'http://localhost:8000';

// Global session history
let predictionHistory = JSON.parse(localStorage.getItem('churn_prediction_history') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    checkApiHealth();
    setInterval(checkApiHealth, 3000); // Poll health status every 3 seconds

    setupEventListeners();
    renderHistoryTable();
    updateMetricsSummary();
}

// 1. Health Check
async function checkApiHealth() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const metricApiStatus = document.getElementById('metricApiStatus');
    const apiCardIcon = document.getElementById('apiCardIcon');

    const hostsToTry = [ACTIVE_API_URL, 'http://localhost:8000', 'http://127.0.0.1:8000'];
    let isConnected = false;

    for (const baseUrl of hostsToTry) {
        try {
            const response = await fetch(`${baseUrl}/health`, { method: 'GET', mode: 'cors' });
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok') {
                    ACTIVE_API_URL = baseUrl;
                    isConnected = true;
                    break;
                }
            }
        } catch (e) {
            // Try next candidate host
        }
    }

    if (isConnected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'API Online';
        metricApiStatus.textContent = 'Online';
        metricApiStatus.style.color = 'var(--risk-low)';
        apiCardIcon.className = 'metric-icon green';
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'API Offline';
        metricApiStatus.textContent = 'Offline';
        metricApiStatus.style.color = 'var(--risk-high)';
        apiCardIcon.className = 'metric-icon red';
    }
}

// 2. Setup Event Listeners
function setupEventListeners() {
    const form = document.getElementById('churnForm');
    form.addEventListener('submit', handlePredictSubmit);

    document.getElementById('btnPresetHighRisk').addEventListener('click', loadHighRiskPreset);
    document.getElementById('btnPresetLowRisk').addEventListener('click', loadLowRiskPreset);
    document.getElementById('btnClearHistory').addEventListener('click', clearHistory);
}

// 3. Preset Loaders
function loadHighRiskPreset() {
    const form = document.getElementById('churnForm');
    const highRiskData = {
        gender: "Female",
        SeniorCitizen: "0",
        Partner: "No",
        Dependents: "No",
        tenure: 1,
        PhoneService: "Yes",
        MultipleLines: "No",
        InternetService: "Fiber optic",
        OnlineSecurity: "No",
        OnlineBackup: "No",
        DeviceProtection: "No",
        TechSupport: "No",
        StreamingTV: "Yes",
        StreamingMovies: "Yes",
        Contract: "Month-to-month",
        PaperlessBilling: "Yes",
        PaymentMethod: "Electronic check",
        MonthlyCharges: 95.85,
        TotalCharges: 95.85
    };

    populateForm(form, highRiskData);
}

function loadLowRiskPreset() {
    const form = document.getElementById('churnForm');
    const lowRiskData = {
        gender: "Male",
        SeniorCitizen: "0",
        Partner: "Yes",
        Dependents: "Yes",
        tenure: 48,
        PhoneService: "Yes",
        MultipleLines: "Yes",
        InternetService: "DSL",
        OnlineSecurity: "Yes",
        OnlineBackup: "Yes",
        DeviceProtection: "Yes",
        TechSupport: "Yes",
        StreamingTV: "Yes",
        StreamingMovies: "Yes",
        Contract: "Two year",
        PaperlessBilling: "No",
        PaymentMethod: "Bank transfer (automatic)",
        MonthlyCharges: 75.40,
        TotalCharges: 3619.20
    };

    populateForm(form, lowRiskData);
}

function populateForm(form, data) {
    for (const [key, value] of Object.entries(data)) {
        const el = form.elements[key];
        if (el) {
            el.value = value;
        }
    }
}

// 4. Form Submit & API Call
async function handlePredictSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const btnPredict = document.getElementById('btnPredict');
    const btnText = btnPredict.querySelector('.btn-text');
    const btnSpinner = document.getElementById('btnSpinner');

    // Collect Form Data
    const tenureVal = parseInt(form.elements['tenure'].value) || 0;
    const monthlyVal = parseFloat(form.elements['MonthlyCharges'].value) || 0;
    const totalVal = parseFloat(form.elements['TotalCharges'].value) || 0;

    const customerPayload = {
        customer: {
            gender: form.elements['gender'].value,
            SeniorCitizen: parseInt(form.elements['SeniorCitizen'].value) || 0,
            Partner: form.elements['Partner'].value,
            Dependents: form.elements['Dependents'].value,
            tenure: tenureVal,
            PhoneService: form.elements['PhoneService'].value,
            MultipleLines: form.elements['MultipleLines'].value,
            InternetService: form.elements['InternetService'].value,
            OnlineSecurity: form.elements['OnlineSecurity'].value,
            OnlineBackup: form.elements['OnlineBackup'].value,
            DeviceProtection: form.elements['DeviceProtection'].value,
            TechSupport: form.elements['TechSupport'].value,
            StreamingTV: form.elements['StreamingTV'].value,
            StreamingMovies: form.elements['StreamingMovies'].value,
            Contract: form.elements['Contract'].value,
            PaperlessBilling: form.elements['PaperlessBilling'].value,
            PaymentMethod: form.elements['PaymentMethod'].value,
            MonthlyCharges: monthlyVal,
            TotalCharges: totalVal,
            tenure_years: tenureVal / 12.0,
            spend_per_month: monthlyVal
        }
    };

    // UI Loading State
    btnPredict.disabled = true;
    btnText.textContent = "Processing...";
    btnSpinner.classList.remove('hidden');

    try {
        const response = await fetch(`${ACTIVE_API_URL}/predict`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerPayload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Prediction failed');
        }

        const result = await response.json();
        
        // Render Result
        renderResult(result);

        // Record History Entry
        const historyEntry = {
            id: 'CUST-' + Math.floor(1000 + Math.random() * 9000),
            contract: customerPayload.customer.Contract,
            tenure: tenureVal,
            monthlyCharges: monthlyVal,
            probability: result.churn_probability,
            prediction: result.churn_prediction,
            timestamp: new Date().toLocaleTimeString()
        };

        predictionHistory.unshift(historyEntry);
        if (predictionHistory.length > 20) predictionHistory.pop();
        localStorage.setItem('churn_prediction_history', JSON.stringify(predictionHistory));

        renderHistoryTable();
        updateMetricsSummary();

    } catch (err) {
        alert("Error connecting to prediction API: " + err.message);
    } finally {
        btnPredict.disabled = false;
        btnText.textContent = "Predict Churn";
        btnSpinner.classList.add('hidden');
    }
}

// 5. Render Result Card
function renderResult(result) {
    const placeholder = document.getElementById('resultPlaceholder');
    const resultContent = document.getElementById('resultContent');
    const riskMeter = document.getElementById('riskMeter');
    const riskPercentage = document.getElementById('riskPercentage');
    const predictionBadge = document.getElementById('predictionBadge');
    const recommendationBox = document.getElementById('recommendationBox');
    const recommendationMsg = document.getElementById('recommendationMsg');

    placeholder.classList.add('hidden');
    resultContent.classList.remove('hidden');

    const probPct = Math.round(result.churn_probability * 100);
    riskPercentage.textContent = `${probPct}%`;

    const isHighRisk = result.churn_prediction === 'Yes' || result.churn_probability >= 0.5;

    if (isHighRisk) {
        riskMeter.className = 'risk-meter-circle high-risk';
        predictionBadge.className = 'prediction-badge high-risk';
        predictionBadge.textContent = 'YES';
        recommendationBox.className = 'recommendation-box high-risk';
        recommendationMsg.textContent = '⚠️ Customer is likely to churn. Immediate retention intervention recommended.';
    } else {
        riskMeter.className = 'risk-meter-circle low-risk';
        predictionBadge.className = 'prediction-badge low-risk';
        predictionBadge.textContent = 'NO';
        recommendationBox.className = 'recommendation-box low-risk';
        recommendationMsg.textContent = '🛡️ Customer is unlikely to churn. Normal relationship management.';
    }
}

// 6. Render History Table
function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    if (predictionHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-table-msg">No predictions recorded in this session yet.</td></tr>`;
        return;
    }

    predictionHistory.forEach(item => {
        const tr = document.createElement('tr');
        const isHigh = item.prediction === 'Yes';
        const badgeClass = isHigh ? 'prediction-badge high-risk' : 'prediction-badge low-risk';

        tr.innerHTML = `
            <td><strong>${item.id}</strong></td>
            <td>${item.contract}</td>
            <td>${item.tenure} mos</td>
            <td>$${item.monthlyCharges.toFixed(2)}</td>
            <td><strong>${(item.probability * 100).toFixed(0)}%</strong></td>
            <td><span class="${badgeClass}">${item.prediction}</span></td>
            <td>${isHigh ? '⚠️ High Risk' : '🛡️ Low Risk'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 7. Update Metrics
function updateMetricsSummary() {
    const metricTotal = document.getElementById('metricTotal');
    const metricHighRisk = document.getElementById('metricHighRisk');
    const metricAvgProb = document.getElementById('metricAvgProb');

    const total = predictionHistory.length;
    metricTotal.textContent = total;

    if (total === 0) {
        metricHighRisk.textContent = '0';
        metricAvgProb.textContent = '0.0%';
        return;
    }

    const highCount = predictionHistory.filter(i => i.prediction === 'Yes').length;
    const sumProb = predictionHistory.reduce((acc, i) => acc + i.probability, 0);
    const avgProb = (sumProb / total) * 100;

    metricHighRisk.textContent = highCount;
    metricAvgProb.textContent = avgProb.toFixed(1) + '%';
}

function clearHistory() {
    predictionHistory = [];
    localStorage.removeItem('churn_prediction_history');
    renderHistoryTable();
    updateMetricsSummary();
}
