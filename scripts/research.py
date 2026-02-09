import os
import sys
import datetime
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("LLM_API_BASE_URL", "https://openrouter.ai/api/v1")

# Model to use (Perplexity Online Model)
MODEL_NAME = "perplexity/sonar" 

def research_with_perplexity(topic):
    """
    Use Perplexity API via OpenRouter to research a topic.
    Returns the markdown report directly from the LLM.
    """
    print(f"🔍 Researching with Perplexity: {topic}")
    
    if not OPENROUTER_API_KEY:
        print("❌ Error: OPENROUTER_API_KEY not found.")
        return None

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/Manatan801/openclaw", # Required by OpenRouter
        "X-Title": "OpenClaw MISA"
    }

    # Prompt engineering for a good report
    system_prompt = """You are MISA, an intelligent research assistant.
Your task is to research the given topic using your online capabilities and generate a comprehensive report.
Format the output in clean Markdown.
Structure:
- Title (with date)
- Executive Summary
- Key Findings / Latest News (bullet points with citations)
- Detailed Analysis
- Conclusion / Outlook for the user
Language: Japanese (unless requested otherwise).
"""

    user_prompt = f"Please research the following topic deeply and provide a structured report:\n\nTopic: {topic}"

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3, # Lower temperature for more factual output
        "max_tokens": 4000
    }

    try:
        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=120 # Give enough time for research
        )
        
        if response.status_code != 200:
            print(f"❌ API Error: {response.status_code} - {response.text}")
            return None
            
        data = response.json()
        content = data['choices'][0]['message']['content']
        return content

    except Exception as e:
        print(f"❌ Request Error: {e}")
        return None

def send_report(filename, topic):
    """
    Send the file to Discord Webhook.
    """
    if not WEBHOOK_URL:
        print("❌ Error: DISCORD_WEBHOOK_URL is not set.")
        return

    try:
        with open(filename, "rb") as f:
            files = {
                "file": (filename, f, "text/markdown")
            }
            payload = {
                "content": f"🧠 **Perplexity Research Report**: {topic}"
            }
            response = requests.post(WEBHOOK_URL, data=payload, files=files)
            
            if response.status_code in [200, 204]:
                print("✅ Report sent to Discord successfully.")
            else:
                print(f"❌ Failed to send report: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Error sending report: {e}")

def main():
    # 1. Get Keyword from Args or Default
    if len(sys.argv) > 1:
        keyword = sys.argv[1]
    else:
        keyword = "個人開発 AIツール"

    # 2. Research (Perplexity)
    report_content = research_with_perplexity(keyword)
    
    if not report_content:
        print("⚠️ Research failed.")
        return

    # 3. Save
    today_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_keyword = "".join([c for c in keyword if c.isalnum() or c in (' ', '-', '_')]).strip().replace(" ", "_")
    filename = f"perplexity_report_{safe_keyword}_{today_str}.md"
    
    with open(filename, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"💾 Saved report to {filename}")
    
    # 4. Send
    send_report(filename, keyword)
    
    # Cleanup (Optional)
    # os.remove(filename)

if __name__ == "__main__":
    main()
