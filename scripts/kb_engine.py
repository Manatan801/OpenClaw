import os
import sys
import json
import time
import argparse
import numpy as np
from openai import OpenAI
from pathlib import Path

# Config
KB_ROOT = "/app/workspace/knowledge_base"
INDEX_FILE = os.path.join(KB_ROOT, ".kb_index.json")
API_KEY = os.environ.get("LLM_API_KEY") 
# Note: openclaw injects keys differently depending on config, but usually env vars.
# If LLM_API_KEY is not set, we might need to look at openclaw config, but for now we assume standard env.

if not API_KEY:
    # Fallback to check auth-profiles if env is missing (CLI manual usage)
    try:
        with open("/app/config/agents/main/agent/auth-profiles.json") as f:
            data = json.load(f)
            API_KEY = data.get("openai", {}).get("apiKey")
            # If it's a template var, we are stuck, but in container it should be set.
    except Exception:
        pass

if not API_KEY or "${" in API_KEY:
    print("Error: LLM_API_KEY not found or invalid.")
    sys.exit(1)

client = OpenAI(api_key=API_KEY, base_url="https://openrouter.ai/api/v1")

def get_embedding(text):
    text = text.replace("\n", " ")
    return client.embeddings.create(input=[text], model="openai/text-embedding-3-small").data[0].embedding

def load_index():
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_index(index):
    with open(INDEX_FILE, 'w') as f:
        json.dump(index, f)

def build_index():
    index = load_index()
    updated = False
    print(f"Scanning {KB_ROOT}...")
    
    current_files = set()

    for root, dirs, files in os.walk(KB_ROOT):
        # Skip hidden folders
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file in files:
            if not file.endswith(".md"): continue
            
            path = os.path.join(root, file)
            rel_path = os.path.relpath(path, KB_ROOT)
            current_files.add(rel_path)
            
            mtime = os.path.getmtime(path)
            
            # Check if needs update
            if rel_path in index and index[rel_path]['mtime'] == mtime:
                continue
            
            print(f"Indexing: {rel_path}")
            try:
                with open(path, 'r') as f:
                    content = f.read()
                
                # Simple full-text embedding for now (can chunk later if needed)
                # Truncate content approx tokens to avoid errors (8k limit usually)
                content_trunc = content[:12000] 
                
                vector = get_embedding(content_trunc)
                index[rel_path] = {
                    "mtime": mtime,
                    "vector": vector,
                    "content": content[:200] + "..." # Store snippet
                }
                updated = True
            except Exception as e:
                print(f"Failed to index {rel_path}: {e}")

    # Remove deleted files
    for existing_path in list(index.keys()):
        if existing_path not in current_files:
            print(f"Removing deleted: {existing_path}")
            del index[existing_path]
            updated = True

    if updated:
        save_index(index)
        print("Index updated.")
    else:
        print("Index is up to date.")

def search(query, top_k=5):
    index = load_index()
    if not index:
        print("Index is empty. Run 'build' first.")
        return

    query_vec = get_embedding(query)
    results = []

    for path, data in index.items():
        doc_vec = data['vector']
        # Cosine similarity
        score = np.dot(query_vec, doc_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec))
        results.append((score, path, data['content']))

    results.sort(key=lambda x: x[0], reverse=True)

    print(f"--- Top {top_k} results for '{query}' ---")
    for score, path, content in results[:top_k]:
        print(f"[{score:.2f}] {path}")
        print(f"Snippet: {content.replace(chr(10), ' ')[:100]}...")
        print("")

def store(path, content):
    full_path = os.path.join(KB_ROOT, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    with open(full_path, 'w') as f:
        f.write(content)
    
    print(f"Saved to {path}")
    # Update index immediately
    mtime = os.path.getmtime(full_path)
    vector = get_embedding(content[:12000])
    
    index = load_index()
    index[path] = {
        "mtime": mtime,
        "vector": vector,
        "content": content[:200] + "..."
    }
    save_index(index)
    print("Index updated.")

def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest='command')
    
    subparsers.add_parser('build')
    
    search_parser = subparsers.add_parser('search')
    search_parser.add_argument('query', type=str)
    
    store_parser = subparsers.add_parser('store')
    store_parser.add_argument('path', type=str)
    store_parser.add_argument('content', type=str)

    args = parser.parse_args()

    if args.command == 'build':
        build_index()
    elif args.command == 'search':
        search(args.query)
    elif args.command == 'store':
        store(args.path, args.content)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
