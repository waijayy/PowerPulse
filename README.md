# PowerPulse ⚡

PowerPulse is an AI-powered energy management dashboard designed to help households monitor, analyze, and optimize their electricity usage. Built for the modern energy-conscious user, it provides real-time insights, budget tracking, and personalized recommendations to reduce energy waste and save money.

## 🚀 Features

- **Budget Tracking**: Set monthly budget targets and track your progress to avoid bill shock.
- **Appliance Management**: detailed breakdown of appliance usage, including peak and off-peak hour analysis.
- **Smart Insights**: AI-driven recommendations for optimal appliance scheduling based on rates and grid health.
- **Bill Management**: Track your historical bills and usage data in one place.
- **Responsive Design**: Fully responsive UI that works seamlessly on desktop and mobile devices.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Integration**: [Groq SDK](https://console.groq.com/) (Llama 3.3 70B)
- **Phantom API**: [Flask](https://flask.palletsprojects.com/) (Python)
- **Charts**: [Recharts](https://recharts.org/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🏁 Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

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
    PHANTOM_API_URL=http://localhost:5000
    ```
    
    **Note**: `PHANTOM_API_URL` is optional and defaults to `http://localhost:5000`. If your phantom detection API is running on a different URL, update this value.

4.  **Database Setup**
    Run the SQL scripts provided in `database_setup.sql` in your Supabase SQL Editor to set up the necessary tables (profiles, appliances, planning) and security policies.
    
    This single script handles:
    - Creating the `profiles` table with budget and bill tracking
    - Creating the `appliances` table for device management
    - Creating the `planning` table for AI-generated energy plans
    - Setting up Row Level Security (RLS) policies

5.  **Set up Phantom Load Detection (Optional)**
    To enable phantom load detection in the Insights page:
    
    a. Navigate to the `phantom-api` directory:
       ```bash
       cd phantom-api
       ```
    
    b. Install Python dependencies:
       ```bash
       pip install -r requirements.txt
       ```
    
    c. Train and save the model (if not already done):
       ```bash
       python setup_model.py
       ```
    
    d. Start the Flask API server:
       ```bash
       python flask_api.py
       ```
       The API will run on `http://localhost:5000` by default.
    
    **Note**: The Insights page will work without the phantom API, but will show default values. The API is used to analyze power consumption patterns and detect phantom loads.

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

## 📱 Usage

1.  **Sign Up/Login**: Create an account to start tracking your energy.
2.  **Setup Profile**: Enter your current bill details and register your appliances.
3.  **Dashboard**: View your usage trends and budget status.
4.  **Profile**: Update your budget target, bill details, and manage appliances.
5.  **Audit**: Get a detailed breakdown of appliance costs and potential savings.
6.  **Insights**: View personalized recommendations and energy waste analysis.

