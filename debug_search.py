from duckduckgo_search import DDGS
import json

def test_search(keyword, region=None):
    print(f"--- Searching: {keyword} (Region: {region}) ---")
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(keyword, region=region, max_results=3))
            if results:
                print(json.dumps(results, indent=2, ensure_ascii=False))
            else:
                print("NO RESULTS")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_search("test")
    test_search("量子コンピュータ", region="jp-jp")
    test_search("量子コンピュータ", region="wt-wt") # World wide
