import os
import argparse
import logging
import requests
import pandas as pd

def setup_logging():
    logs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(logs_dir, exist_ok=True)
    log_file = os.path.join(logs_dir, 'batch_log.txt')

    logger = logging.getLogger('batch_logger')
    logger.setLevel(logging.INFO)
    logger.handlers = []  # Clear existing handlers

    file_handler = logging.FileHandler(log_file, mode='w')
    console_handler = logging.StreamHandler()

    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

def run_batch_scoring(input_path, api_url="http://localhost:8000/predict", output_path="scored_customers.csv"):
    logger = setup_logging()
    logger.info(f"Starting batch scoring for input file: {input_path}")

    # Use 127.0.0.1 if localhost to avoid Windows IPv6 resolution latency
    request_url = api_url.replace("localhost", "127.0.0.1") if "localhost" in api_url else api_url

    if not os.path.exists(input_path):
        logger.error(f"Input file not found: {input_path}")
        raise FileNotFoundError(f"Input file not found: {input_path}")

    df = pd.read_csv(input_path)
    total_requests = len(df)
    logger.info(f"Loaded {total_requests} customer record(s).")

    churn_probabilities = []
    churn_predictions = []
    successful_predictions = 0
    failed_predictions = 0

    session = requests.Session()

    for idx, row in df.iterrows():
        customer_dict = row.to_dict()
        
        # MUST NOT send Churn target column to the prediction API
        if 'Churn' in customer_dict:
            del customer_dict['Churn']

        # Clean NaN values for JSON serialization
        cleaned_dict = {}
        for k, v in customer_dict.items():
            if pd.isna(v):
                cleaned_dict[k] = None
            else:
                cleaned_dict[k] = v

        payload = {"customer": cleaned_dict}

        try:
            response = session.post(request_url, json=payload, timeout=10)
            if response.status_code == 200:
                res_data = response.json()
                prob = res_data.get("churn_probability")
                pred = res_data.get("churn_prediction")

                churn_probabilities.append(prob)
                churn_predictions.append(pred)
                successful_predictions += 1
            else:
                logger.error(f"Row {idx}: API returned status code {response.status_code} - {response.text}")
                churn_probabilities.append(None)
                churn_predictions.append(None)
                failed_predictions += 1

        except Exception as e:
            logger.error(f"Row {idx}: Request failed with exception: {e}")
            churn_probabilities.append(None)
            churn_predictions.append(None)
            failed_predictions += 1

    df['churn_probability'] = churn_probabilities
    df['churn_prediction'] = churn_predictions

    # Save output CSV
    df.to_csv(output_path, index=False)
    logger.info(f"Successfully saved predictions to {output_path}")

    # Calculate statistics
    valid_probs = [p for p in churn_probabilities if p is not None]
    avg_probability = sum(valid_probs) / len(valid_probs) if valid_probs else 0.0

    # Required logging statistics
    logger.info("=== BATCH SCORING SUMMARY ===")
    logger.info(f"Total number of requests: {total_requests}")
    logger.info(f"Successful predictions: {successful_predictions}")
    logger.info(f"Failed predictions: {failed_predictions}")
    logger.info(f"Average churn probability: {avg_probability:.4f}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Batch Scoring Script for Customer Churn API")
    parser.add_argument('--input', type=str, required=True, help="Path to input CSV file")
    args = parser.parse_args()

    run_batch_scoring(args.input)
