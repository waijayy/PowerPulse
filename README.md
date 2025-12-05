# PowerPulse ⚡

PowerPulse is an AI-powered energy management dashboard designed to help Malaysian households monitor, analyze, and optimize their electricity usage. Built for the modern energy-conscious user, it combines real-time insights, AI detection, and personalized AI recommendations to reduce energy waste and save money on TNB bills.

## 🚀 Features

-   **AI Energy Planner**: Powered by **Llama 3.3 70B**, this feature generates personalized appliance schedules optimized for Time-of-Use (ToU) rates (Peak vs. Off-Peak) to maximize savings without compromising comfort.
-   **Smart Insights**:
    -   **Phantom Load Detection**: Uses ML algorithms to analyze meter readings and detect standby power waste.
    -   **Efficiency Scoring**: Rates your appliances against efficient standards to identify energy hogs.
-   **Interactive Stimulator**:
    -   **Appliance Simulator**: Simulate different usage patterns to see potential cost impacts.
    -   **Solar Potential Simulator**: Estimate ROI and savings for solar panel installation based on your location (e.g., Selangor, Penang) and usage.
-   **Intelligent Chatbot**: A context-aware AI assistant that knows your specific appliances and usage patterns, ready to answer questions and provide tailored energy-saving advice.
-   **Bill & Budget Tracking**: Set monthly targets and track progress with advanced algorithms that estimate usage hours for each appliance to prevent bill shock.
-   **Appliance Management**: Detailed breakdown of appliance usage, including peak and off-peak hour analysis.
-   **Responsive Design**: Fully responsive UI that works seamlessly on desktop and mobile devices.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Integration**: [Groq SDK](https://console.groq.com/) (Llama 3.3 70B)
- **ML Service**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **ML Libraries**: TensorFlow, Scikit-learn, Pandas, NumPy
- **Charts**: [Recharts](https://recharts.org/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🏁 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project
- Python installed

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/powerpulse.git
    cd powerpulse
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables**
    Create a `.env.local` file in the root directory and add your Supabase credentials:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GROQ_API_KEY=your_groq_api_key

    ```

4.  **Database Setup**
    Run the SQL scripts provided in `database_setup.sql` in your Supabase SQL Editor to set up the necessary tables (profiles, appliances, planning) and security policies.
    
    This single script handles:
    - Creating the `profiles` table with budget and bill tracking
    - Creating the `appliances` table for device management
    - Creating the `planning` table for AI-generated energy plans
    - Setting up Row Level Security (RLS) policies

5.  **Set up ML Service**
    To enable phantom load detection and energy forecasting:
    
    a. Navigate to the `ml-service` directory:
       ```bash
       cd ml-service
       ```
    
    b. Install Python dependencies:
       ```bash
       pip install -r requirements.txt
       ```
    
    c. **Train the Models**:
       You need to run the training scripts to generate the necessary model files and appliance profiles.
       
       1. Generate appliance profiles (K-Means Clustering):
          ```bash
          python logic_training.py
          ```
          This creates `appliance_profiles.json`.
          
       2. Train forecasting models (LSTM):
          ```bash
          python train_models.py
          ```
          This creates the model files in the `models/` directory.
    
    d. Start the FastAPI server:
       ```bash
       python -m uvicorn main:app --reload --port 8000
       ```
       The API will run on `http://localhost:8000` (default for FastAPI) or the port specified.
    

6.  **Set up AI Features (Groq)**
    To enable the AI-powered energy planner:
    
    a. Sign up for an account at [Groq Console](https://console.groq.com/).
    b. Create a new API Key.
    c. Add the key to your `.env.local` file as `GROQ_API_KEY`.
    
    The planner uses the `llama-3.3-70b-versatile` model to generate personalized energy optimization plans based on your appliance usage and budget targets.

7.  **Run the Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

