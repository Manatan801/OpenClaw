import os
import datetime
import requests
from dotenv import load_dotenv

def send_report():
    # 1. Load environment variables
    load_dotenv()
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")

    if not webhook_url:
        print("Error: DISCORD_WEBHOOK_URL not found in .env")
        return

    # 2. Generate Dummy Report
    today = datetime.datetime.now().strftime("%Y%m%d")
    report_content = f"""# Market Radar Report ({today})

## Technology Trends
- **AI Agents**: Autonomous agents are becoming mainstream.
- **Quantum Computing**: New breakthroughs in error correction.
- **Green Energy**: Fusion power sees incremental gains.

## Summary
The market is shifting towards autonomous systems and sustainable energy solutions.
"""
    
    filename = f"report_{today}.md"
    
    # 3. Save to file
    with open(filename, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Report generated: {filename}")

    # 4. Send to Discord via Webhook (as a file)
    try:
        with open(filename, "rb") as f:
            files = {
                "file": (filename, f, "text/markdown")
            }
            # Optional: Add a message content
            data = {
                "content": f"📊 **Market Radar Report** ({today}) is ready."
            }
            
            response = requests.post(webhook_url, data=data, files=files)
            
            if response.status_code == 200 or response.status_code == 204:
                print("✅ Report sent successfully to Discord!")
            else:
                print(f"❌ Failed to send report. Status: {response.status_code}, Response: {response.text}")
                
    except Exception as e:
        print(f"❌ An error occurred: {e}")

    # Optional: Clean up file after sending
    # os.remove(filename)

if __name__ == "__main__":
    send_report()
