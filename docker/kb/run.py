import os
from flask import Flask, jsonify, request
import chromadb

# create and initialize Chroma collection
chroma_client = chromadb.Client()
collection = chroma_client.get_or_create_collection(name='my_knowledge_base')
collection.upsert(
  documents=[
    "Population of New York City is approximately 8.4 million as of 2020.",
    "The GDP of California was about $3.2 trillion in 2021.",
    "The unemployment rate in Texas was 6.9% in 2020.",
    "Florida's population was around 21.5 million in 2020.",
    "The GDP of Illinois was approximately $900 billion in 2021.",
    "The unemployment rate in Ohio was 5.5% in 2020.",
    "Georgia's GDP was about $600 billion in 2021.",
    "The population of Pennsylvania was roughly 12.8 million in 2020.",
    "The unemployment rate in Michigan was 8.2% in 2020.",
  ],
  ids=['id1', 'id2', 'id3', 'id4', 'id5', 'id6', 'id7', 'id8', 'id9']
)

app = Flask(__name__)

def search_knowledge_base(knowledge_base_id):
  local_kb_api_key = os.getenv('LOCAL_KB_API_KEY')
  auth_header = request.headers.get('Authorization')
  api_key = None
  if auth_header:
      api_key = auth_header.split(" ")[1] # expected format: "Bearer <apiKey>"
  else:
      return jsonify({"error": "Authorization header missing"}), 401
  if api_key is None:
    return jsonify({"error": "API key is missing"}), 401
  if api_key != local_kb_api_key:
    return jsonify({"error": "Invalid API key"}), 401

  try:
    collection = chroma_client.get_collection(name=knowledge_base_id)
  except chromadb.errors.InvalidCollectionException:
    return jsonify({'error': f'Collection {knowledge_base_id} does not exist.'}), 404

  query = request.args.get('query')
  n = request.args.get('n', 2)
  try:
    n = int(n)
  except ValueError:
    return jsonify({'error': 'n must be an integer.'}), 400

  chroma_results = collection.query(query_texts=[query], n_results=n)
  ids = chroma_results['ids'][0]
  documents = chroma_results['documents'][0]
  distances = chroma_results['distances'][0]
  results = [
    {'id': id, 'rank': rank, 'content': content, 'score': score}
    for id, rank, content, score in zip(ids, range(len(ids)), documents, distances)
  ]

  total_results = len(results)

  return jsonify({'totalResults': total_results, 'results': results})

# supports KbProvider - PalmKbApiSource
@app.route('/api/v1/knowledgebases/<knowledge_base_id>/search', methods=['GET'])
def search_palm(knowledge_base_id):
  return search_knowledge_base(knowledge_base_id)

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=5000, debug=True)
