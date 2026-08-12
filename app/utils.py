import os
import joblib
import pandas as pd

def get_app_dir():
    return os.path.dirname(os.path.abspath(__file__))

def load_artifacts():
    app_dir = get_app_dir()
    model_path = os.path.join(app_dir, 'model.pkl')
    transformer_path = os.path.join(app_dir, 'transformer.pkl')

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")
    if not os.path.exists(transformer_path):
        raise FileNotFoundError(f"Transformer file not found at {transformer_path}")

    model = joblib.load(model_path)
    transformer = joblib.load(transformer_path)
    return model, transformer

def preprocess_input(customer_data):
    if isinstance(customer_data, dict):
        df = pd.DataFrame([customer_data])
    elif isinstance(customer_data, pd.DataFrame):
        df = customer_data.copy()
    else:
        raise ValueError("Input data must be a dictionary or pandas DataFrame")

    # Drop non-feature columns if present
    for col in ['customerID', 'Churn', 'Unnamed: 0']:
        if col in df.columns:
            df = df.drop(columns=[col])

    # Convert TotalCharges to numeric
    if 'TotalCharges' in df.columns:
        df['TotalCharges'] = pd.to_numeric(df['TotalCharges'], errors='coerce')

    return df
