import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense, Input
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

def create_sequences(data, labels, segment_length):
    """
    Transforms time series data into sliding window sequences for CNN input.

    Args:
        data (np.array): The appliance power consumption values.
        labels (np.array): The binary phantom load labels corresponding to the data.
        segment_length (int): The length of each input sequence (sliding window).

    Returns:
        tuple: X (input sequences), y (labels for the midpoint of each sequence).
    """
    X, y = [], []
    for i in range(len(data) - segment_length):
        X.append(data[i:(i + segment_length)])
        mid_point_index = i + segment_length // 2
        if mid_point_index < len(labels):
            y.append(labels[mid_point_index])
        else:
            break
    return np.array(X), np.array(y)

def build_cnn_model(segment_length):
    """
    Builds and compiles the CNN model for phantom load detection.

    Args:
        segment_length (int): The length of the input sequences.

    Returns:
        tensorflow.keras.models.Sequential: The compiled CNN model.
    """
    model = Sequential()
    model.add(Input(shape=(segment_length, 1)))
    model.add(Conv1D(filters=32, kernel_size=5, activation='relu'))
    model.add(MaxPooling1D(pool_size=2))
    model.add(Flatten())
    model.add(Dense(units=64, activation='relu'))
    model.add(Dense(units=1, activation='sigmoid'))
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

def train_and_evaluate_model(
    power_series,
    phantom_labels,
    segment_length=50,
    epochs=20,
    batch_size=32
):
    """
    Orchestrates the data preparation, model training, and evaluation process.

    Args:
        power_series (pd.Series): The appliance power consumption time series.
        phantom_labels (pd.Series): The binary phantom load labels time series.
        segment_length (int): The length of each input sequence.
        epochs (int): Number of epochs for training.
        batch_size (int): Batch size for training.

    Returns:
        tensorflow.keras.models.Sequential: The trained model.
        dict: Evaluation results (loss, accuracy, classification_report, confusion_matrix).
    """
    # 1. Create sequences
    X, y = create_sequences(power_series.values, phantom_labels.values, segment_length)

    # 2. Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 3. Reshape for CNN input
    X_train = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
    X_test = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)

    # 4. Build and compile model
    model = build_cnn_model(segment_length)

    # 5. Train model
    print("\nStarting model training...")
    history = model.fit(
        X_train,
        y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_data=(X_test, y_test),
        verbose=0 # Set verbose to 1 for progress bar
    )
    print("Model training complete.")

    # 6. Evaluate model
    print("\nEvaluating model on test data...")
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Loss: {loss:.4f}")
    print(f"Test Accuracy: {accuracy:.4f}")

    y_pred_proba = model.predict(X_test, verbose=0)
    y_pred_binary = (y_pred_proba > 0.5).astype(int)

    clf_report = classification_report(y_test, y_pred_binary, output_dict=True)
    conf_matrix = confusion_matrix(y_test, y_pred_binary)

    print("\nClassification Report:")
    print(classification_report(y_test, y_pred_binary))
    print("\nConfusion Matrix:")
    print(conf_matrix)

    return model, {
        'loss': loss,
        'accuracy': accuracy,
        'classification_report': clf_report,
        'confusion_matrix': conf_matrix
    }


# Example Usage (if running this script directly):
if __name__ == '__main__':
    # --- Placeholder for loading your data --- #
    # In a real application, you would load your single_appliance_power_series
    # and phantom_load_labels from a CSV, HDF5, etc.
    # For demonstration, we'll use the pre-existing synthetic data from the notebook environment.
    try:
        # Assuming single_appliance_power_series and phantom_load_labels are available globally from notebook
        # If running as a standalone script, these would need to be loaded from files.
        if 'single_appliance_power_series' in locals() and 'phantom_load_labels' in locals():
            print("Using pre-existing synthetic data for example usage.")
            power_data = single_appliance_power_series
            labels_data = phantom_load_labels
        else:
            # If running standalone, create dummy data or load from file
            print("Generating dummy data for example usage (standalone script).")
            num_minutes_dummy = 1000
            datetime_index_dummy = pd.date_range(start='2023-01-01 00:00:00', periods=num_minutes_dummy, freq='1min')
            power_data = pd.Series(np.random.rand(num_minutes_dummy) * 200, index=datetime_index_dummy, name='power')
            # Simulate some phantom loads
            labels_data = pd.Series(0, index=datetime_index_dummy, name='labels')
            labels_data[power_data.between(5, 15)] = 1 # Example phantom load definition

    except NameError:
        print("Generating dummy data for example usage (standalone script, no pre-existing data).")
        num_minutes_dummy = 1000
        datetime_index_dummy = pd.date_range(start='2023-01-01 00:00:00', periods=num_minutes_dummy, freq='1min')
        power_data = pd.Series(np.random.rand(num_minutes_dummy) * 200, index=datetime_index_dummy, name='power')
        labels_data = pd.Series(0, index=datetime_index_dummy, name='labels')
        labels_data[power_data.between(5, 15)] = 1

    trained_model, eval_results = train_and_evaluate_model(
        power_data, labels_data, segment_length=50, epochs=10, batch_size=32
    )

    print("\n--- Summary of Example Run ---")
    print(f"Final Test Accuracy: {eval_results['accuracy']:.4f}")
    print("Model can now be used for prediction: trained_model.predict(new_X)")