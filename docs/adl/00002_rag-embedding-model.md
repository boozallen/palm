# ADR 00002: RAG Embedding Models

## Context
OpenAI is introducing two new embedding models: a smaller and highly efficient text-embedding-3-small model, and a larger and more powerful text-embedding-3-large model. The previous model was text-embedding-ada-002, and the two new models are a significant upgrade in terms of performance, price, and accuracy. The new models were trained with a technique that allows developers to trade-off performance and cost of using embeddings. Specifically, developers can shorten embeddings (i.e. remove some numbers from the end of the sequence) without the embedding losing its concept-representing properties by passing in the dimensions API parameter. For example, on the MTEB benchmark, a text-embedding-3-large embedding can be shortened to a size of 256 while still outperforming an unshortened text-embedding-ada-002 embedding with a size of 1536.

## Decision
For V1 of the RAG pipeline, we will create embeddings through OpenAI using the text-embedding-3-small model with an embedding size of 512.
The resulting embeddings will be stored in a vector database using the Docker image that supports Postgres v15: ankane/pgvector. This is the official way to implement pgvector.

The text-embedding-3-small model provides the best value per dollar with better performance compared to the previous model.

MODEL					ROUGH PAGES PER DOLLAR	EXAMPLE PERFORMANCE ON MTEB EVAL
text-embedding-3-small	62,500					62.3%
text-embedding-3-large	9,615					64.6%
text-embedding-ada-002	12,500					61.0%


Using the dimensions API parameter, we can shorten the embedding down from 1536 dimensions, trading off some accuracy in exchange for the smaller vector size of 512.

					ada v2		text-embedding-3-small			text-embedding-3-large
Embedding size		1536		512		1536					256		1024	3072
Average MTEB score	61.0		61.6	62.3					62.0	64.1	64.6


## Status
Status: *Proposed*

## Consequences
Positive Consequences
1. Reduced computational resources: The text-embedding-3-small model requires fewer computational resources, such as memory and GPU, to run efficiently.
2. Faster processing: The text-embedding-3-small model is faster than text-embedding-3-large, which is beneficial when processing large amounts of data or when quick results are needed (RAG pipeline consideration).

Negative Consequences
1. Lower Accuracy: The main disadvantage of using the text-embedding-3-small model is that it may not be as accurate as the text-embedding-3-large model. It might miss some important information in complex queries.
2. Oversimplified Results: The results might be oversimplified and lacking in depth due to the small size of the model. The text-embedding-3-large model can go into depth when answering questions, providing more comprehensive and detailed results.

## References
https://openai.com/blog/new-embedding-models-and-api-updates
https://platform.openai.com/docs/guides/embeddings/what-are-embeddings
https://github.com/pgvector/pgvector

