import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from app.utils import load_artifacts, preprocess_input

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Load model and transformer at startup
try:
    model, transformer = load_artifacts()
    logger.info("Successfully loaded model.pkl and transformer.pkl")
except Exception as e:
    logger.error(f"Error loading artifacts: {e}")
    model, transformer = None, None

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "status": "ok",
        "message": "Customer Churn Prediction API is running",
        "endpoints": {
            "health": "/health (GET)",
            "predict": "/predict (POST)"
        }
    }), 200

@app.route('/health', methods=['GET'])
def health():
    if model is None or transformer is None:
        return jsonify({"status": "error", "message": "Model artifacts not loaded"}), 500
    return jsonify({"status": "ok"}), 200

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    try:
        data = request.get_json()
        if not data or 'customer' not in data:
            logger.warning("Invalid request: missing 'customer' field in JSON payload")
            return jsonify({"error": "Missing 'customer' field in request body"}), 400

        customer_dict = data['customer']
        
        # Preprocess input
        df = preprocess_input(customer_dict)
        
        # Transform features
        X_transformed = transformer.transform(df)
        
        # Predict churn probability
        probabilities = model.predict_proba(X_transformed)
        churn_prob = float(probabilities[0][1])
        
        prediction = "Yes" if churn_prob >= 0.5 else "No"
        
        response = {
            "churn_probability": round(churn_prob, 2),
            "churn_prediction": prediction
        }
        logger.info(f"Prediction successful: churn_probability={response['churn_probability']}, churn_prediction={prediction}")
        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask API server on http://localhost:8000...")
    app.run(host='0.0.0.0', port=8000, debug=False)
